import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const openApiPath = path.join(process.cwd(), 'public', 'openapi.json');
    
    if (!fs.existsSync(openApiPath)) {
      return NextResponse.json({ error: 'OpenAPI spec not found' }, { status: 404 });
    }

    const openApiSpec = JSON.parse(fs.readFileSync(openApiPath, 'utf-8'));

    return NextResponse.json(openApiSpec);
  } catch (error) {
    console.error('Error serving OpenAPI spec:', error);
    return NextResponse.json({ error: 'Failed to load API documentation' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
