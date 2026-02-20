/**
 * Email Templates
 * Pre-defined templates for various notification types
 */

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined;
}

export function renderTemplate(
  template: string,
  variables: TemplateVariables,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key]?.toString() || match;
  });
}

export const emailTemplates = {
  assetAssignment: {
    subject: "Asset Assigned: {{assetName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Asset Assignment Notification</h2>
        <p>Hello {{userName}},</p>
        <p>An asset has been assigned to you:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Asset Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetName}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Asset Tag</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetTag}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Serial Number</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{serialNumber}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Assigned Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assignedDate}}</td>
          </tr>
        </table>
        <p>Please ensure you take proper care of this asset. If you have any questions, please contact your administrator.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  assetUnassignment: {
    subject: "Asset Unassigned: {{assetName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Asset Unassignment Notification</h2>
        <p>Hello {{userName}},</p>
        <p>An asset has been unassigned from you:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Asset Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetName}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Asset Tag</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetTag}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Unassigned Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{unassignedDate}}</td>
          </tr>
        </table>
        <p>If you still have this asset, please return it to your IT department.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  licenseExpiring: {
    subject: "License Expiring Soon: {{licenseName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">License Expiration Warning</h2>
        <p>Hello {{userName}},</p>
        <p>A license assigned to you is expiring soon:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>License</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{licenseName}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>License Key</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{licenseKey}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #fef3c7;"><strong>Expires On</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; background: #fef3c7;">{{expirationDate}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Days Remaining</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{daysRemaining}}</td>
          </tr>
        </table>
        <p>Please contact your administrator if you need this license to be renewed.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  maintenanceDue: {
    subject: "Maintenance Due: {{assetName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Maintenance Reminder</h2>
        <p>Hello {{userName}},</p>
        <p>Scheduled maintenance is due for an asset:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Asset Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetName}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Asset Tag</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetTag}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Maintenance Type</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{maintenanceTitle}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #dbeafe;"><strong>Due Date</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; background: #dbeafe;">{{dueDate}}</td>
          </tr>
        </table>
        <p>{{maintenanceDescription}}</p>
        <p>Please complete this maintenance task as scheduled.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  lowStockAlert: {
    subject: "Low Stock Alert: {{consumableName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Low Stock Alert</h2>
        <p>Hello Admin,</p>
        <p>The following consumable is running low on stock:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Consumable</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{consumableName}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #fee2e2;"><strong>Current Quantity</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; background: #fee2e2;">{{currentQuantity}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Minimum Threshold</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{minQuantity}}</td>
          </tr>
        </table>
        <p>Please reorder this item to maintain adequate inventory levels.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  warrantyExpiring: {
    subject: "Warranty Expiring: {{assetName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">Warranty Expiration Notice</h2>
        <p>Hello Admin,</p>
        <p>The warranty for the following asset is expiring soon:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Asset Name</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetName}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Asset Tag</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetTag}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Serial Number</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{serialNumber}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #fef3c7;"><strong>Warranty Expires</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; background: #fef3c7;">{{warrantyExpires}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Days Remaining</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{daysRemaining}}</td>
          </tr>
        </table>
        <p>Consider extending the warranty or planning for replacement if necessary.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  passwordReset: {
    subject: "Reset Your Password - Asset Tracker",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your Asset Tracker account.</p>
        <p style="margin: 30px 0;">
          <a href="{{resetUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Your Password</a>
        </p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #2563eb;">{{resetUrl}}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  teamInvitation: {
    subject:
      "You've been invited to join {{organizationName}} on Asset Tracker",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #333;">Team Invitation</h2>
    <p>Hello,</p>
    <p><strong>{{inviterName}}</strong> has invited you to join <strong>{{organizationName}}</strong> on Asset Tracker.</p>
    <p style="margin: 30px 0;">
      <a href="{{inviteUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #2563eb;">{{inviteUrl}}</p>
    <p style="color: #666; font-size: 14px; margin-top: 30px;">This invitation expires in 7 days.</p>
    <p>Best regards,<br>Asset Tracker System</p>
  </div>`,
  },
};

export type TemplateType = keyof typeof emailTemplates;
