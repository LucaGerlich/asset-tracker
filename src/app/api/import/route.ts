import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/api-auth';
import { importJobSchema } from '@/lib/validation-organization';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/audit-log';
import { triggerWebhook } from '@/lib/webhooks';
import { z } from 'zod';

// Entity field mappings for CSV import
const ENTITY_FIELDS: Record<string, string[]> = {
  asset: ['assetname', 'assettag', 'serialnumber', 'specs', 'notes', 'purchaseprice', 'purchasedate', 'mobile', 'requestable'],
  accessory: ['accessoriename', 'accessorietag', 'purchaseprice', 'purchasedate', 'requestable'],
  consumable: ['consumablename', 'purchaseprice', 'purchasedate', 'quantity', 'minQuantity'],
  licence: ['licencekey', 'licensedtoemail', 'purchaseprice', 'purchasedate', 'expirationdate', 'notes', 'requestable'],
  user: ['username', 'email', 'firstname', 'lastname', 'isadmin', 'canrequest'],
  location: ['locationname', 'street', 'housenumber', 'city', 'country'],
};

// Get list of import jobs
export async function GET(req: NextRequest) {
  try {
    const authUser = await requirePermission('import:execute');

    const jobs = await prisma.importJob.findMany({
      where: {
        userId: authUser.id!
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Error fetching import jobs:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch import jobs' }, { status: 500 });
  }
}

// Create a new import job (CSV processing)
export async function POST(req: NextRequest) {
  try {
    const authUser = await requirePermission('import:execute');

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string | null;

    if (!file || !entityType) {
      return NextResponse.json({ error: 'File and entityType are required' }, { status: 400 });
    }

    // Validate entity type
    const validatedInput = importJobSchema.parse({
      entityType,
      fileName: file.name,
      fileSize: file.size,
    });

    // Read and parse CSV
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 });
    }

    const headers = parseCSVLine(lines[0]);
    const expectedFields = ENTITY_FIELDS[validatedInput.entityType];
    
    // Validate headers
    const requiredFields = getRequiredFields(validatedInput.entityType);
    const missingRequired = requiredFields.filter(f => !headers.includes(f));
    
    if (missingRequired.length > 0) {
      return NextResponse.json({ 
        error: `Missing required fields: ${missingRequired.join(', ')}`,
        expectedFields,
        receivedFields: headers
      }, { status: 400 });
    }

    // Create import job
    const job = await prisma.importJob.create({
      data: {
        userId: authUser.id!,
        entityType: validatedInput.entityType,
        fileName: validatedInput.fileName,
        fileSize: validatedInput.fileSize,
        totalRows: lines.length - 1, // Exclude header
        status: 'processing',
        startedAt: new Date(),
      }
    });

    // Process rows (in a real app, this would be done asynchronously)
    const errors: { row: number; error: string }[] = [];
    let successCount = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        const rowData = createRowObject(headers, values);
        
        await createEntity(validatedInput.entityType, rowData, authUser.id!);
        successCount++;
      } catch (err) {
        errors.push({ 
          row: i + 1, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }

      // Update progress every 10 rows
      if (i % 10 === 0) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: { 
            processedRows: i,
            successCount,
            errorCount: errors.length,
          }
        });
      }
    }

    // Finalize job
    const completedJob = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        processedRows: lines.length - 1,
        successCount,
        errorCount: errors.length,
        status: errors.length === lines.length - 1 ? 'failed' : 'completed',
        errors: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      }
    });

    await createAuditLog({
      userId: authUser.id!,
      action: AUDIT_ACTIONS.CREATE,
      entity: 'ImportJob',
      entityId: job.id,
      details: { 
        entityType: validatedInput.entityType, 
        fileName: validatedInput.fileName,
        totalRows: lines.length - 1,
        successCount,
        errorCount: errors.length
      },
    });

    // Trigger webhook
    const webhookEvent = errors.length === lines.length - 1 ? 'import.failed' : 'import.completed';
    await triggerWebhook(webhookEvent, {
      jobId: job.id,
      entityType: validatedInput.entityType,
      totalRows: lines.length - 1,
      successCount,
      errorCount: errors.length,
    });

    return NextResponse.json(completedJob, { status: 201 });
  } catch (error) {
    console.error('Error processing import:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to process import' }, { status: 500 });
  }
}

// Get expected CSV template fields for an entity
export async function OPTIONS(req: NextRequest) {
  const entityType = req.nextUrl.searchParams.get('entityType');
  
  if (!entityType || !ENTITY_FIELDS[entityType]) {
    return NextResponse.json({ 
      availableEntities: Object.keys(ENTITY_FIELDS),
      entityFields: ENTITY_FIELDS
    });
  }

  return NextResponse.json({
    entityType,
    fields: ENTITY_FIELDS[entityType],
    requiredFields: getRequiredFields(entityType),
  });
}

// Helper functions
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function createRowObject(headers: string[], values: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((header, index) => {
    if (values[index] !== undefined) {
      obj[header.toLowerCase()] = values[index];
    }
  });
  return obj;
}

function getRequiredFields(entityType: string): string[] {
  const required: Record<string, string[]> = {
    asset: ['assetname', 'assettag', 'serialnumber'],
    accessory: ['accessoriename', 'accessorietag'],
    consumable: ['consumablename'],
    licence: [],
    user: ['username', 'firstname', 'lastname'],
    location: ['locationname'],
  };
  return required[entityType] || [];
}

async function createEntity(entityType: string, data: Record<string, string>, userId: string): Promise<void> {
  const now = new Date();
  
  switch (entityType) {
    case 'asset':
      await prisma.asset.create({
        data: {
          assetname: data.assetname,
          assettag: data.assettag,
          serialnumber: data.serialnumber,
          specs: data.specs || null,
          notes: data.notes || null,
          purchaseprice: data.purchaseprice ? parseFloat(data.purchaseprice) : null,
          purchasedate: data.purchasedate ? new Date(data.purchasedate) : null,
          mobile: data.mobile ? data.mobile.toLowerCase() === 'true' : null,
          requestable: data.requestable ? data.requestable.toLowerCase() === 'true' : null,
          creation_date: now,
        }
      });
      break;
    
    case 'location':
      await prisma.location.create({
        data: {
          locationname: data.locationname,
          street: data.street || null,
          housenumber: data.housenumber || null,
          city: data.city || null,
          country: data.country || null,
          creation_date: now,
        }
      });
      break;

    // Add more entity types as needed
    default:
      throw new Error(`Import not implemented for entity type: ${entityType}`);
  }
}

export const dynamic = 'force-dynamic';
