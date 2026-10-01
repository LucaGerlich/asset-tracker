/**
 * Email Templates
 * Pre-defined templates for various notification types
 */

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Escape a value for safe interpolation into an HTML document body/attribute.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render an HTML email template, HTML-escaping every substituted value.
 * Variables come from user-controlled data (asset names, notes, user names,
 * etc.) and must never be interpolated raw into an HTML body.
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) return match;
    return escapeHtml(value.toString());
  });
}

/**
 * Render a plain-text template (e.g. an email subject line) without
 * HTML-escaping substituted values. Subjects are not parsed as HTML, so
 * escaping would corrupt them (e.g. turning `&` into a literal `&amp;`).
 */
export function renderTextTemplate(
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

  setPassword: {
    subject: "Set Your Password - Asset Tracker",
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to Asset Tracker</h2>
      <p>Hello {{userName}},</p>
      <p>An account has been created for you at <strong>{{organizationName}}</strong>. Please set your password to get started.</p>
      <p style="margin: 30px 0;">
        <a href="{{setPasswordUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Your Password</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #2563eb;">{{setPasswordUrl}}</p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">This link expires in 72 hours. If you didn't expect this email, you can safely ignore it.</p>
      <p>Best regards,<br>Asset Tracker System</p>
    </div>
  `,
  },
  reservationRequest: {
    subject: "New Asset Request: {{assetName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Asset Reservation Request</h2>
        <p>A user has requested to reserve an asset that requires your approval:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Requested By</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{requesterName}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Asset</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetName}} ({{assetTag}})</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Period</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{startDate}} — {{endDate}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Notes</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{notes}}</td>
          </tr>
        </table>
        <p>Please log in to the Asset Tracker to approve or reject this request.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },
  reservationApproved: {
    subject: "Request Approved: {{assetName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Reservation Approved</h2>
        <p>Hello {{userName}},</p>
        <p>Your reservation request has been <strong style="color: #16a34a;">approved</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Asset</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetName}} ({{assetTag}})</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Period</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{startDate}} — {{endDate}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Approved By</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{approverName}}</td>
          </tr>
        </table>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },
  reservationRejected: {
    subject: "Request Rejected: {{assetName}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Reservation Rejected</h2>
        <p>Hello {{userName}},</p>
        <p>Your reservation request has been <strong style="color: #dc2626;">rejected</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Asset</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{assetName}} ({{assetTag}})</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Reason</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{notes}}</td>
          </tr>
        </table>
        <p>If you have questions, please contact your administrator.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  ticketAssigned: {
    subject: "Ticket Assigned: {{ticketTitle}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Ticket Assigned to You</h2>
        <p>Hello {{assigneeName}},</p>
        <p>You have been assigned a ticket:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Title</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{ticketTitle}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Priority</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{priority}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Description</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{descriptionPreview}}</td>
          </tr>
        </table>
        <p>Please log in to the Asset Tracker to view and work on this ticket.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  ticketComment: {
    subject: "New Comment on: {{ticketTitle}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Comment on Your Ticket</h2>
        <p>Hello {{recipientName}},</p>
        <p><strong>{{commenterName}}</strong> commented on your ticket:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Ticket</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{ticketTitle}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Comment</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{commentText}}</td>
          </tr>
        </table>
        <p>Please log in to the Asset Tracker to view the full conversation.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },

  maintenanceCompleted: {
    subject: "Maintenance Completed: {{assetName}}",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #16a34a;">Maintenance Completed</h2>
    <p>Hello {{userName}},</p>
    <p>A maintenance task has been completed:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Task</strong></td><td style="padding: 10px; border: 1px solid #ddd;">{{taskTitle}}</td></tr>
      <tr><td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Asset</strong></td><td style="padding: 10px; border: 1px solid #ddd;">{{assetName}}</td></tr>
      <tr><td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Completed</strong></td><td style="padding: 10px; border: 1px solid #ddd;">{{completedDate}}</td></tr>
      <tr><td style="padding: 10px; border: 1px solid #ddd; background: #dbeafe;"><strong>Next Due</strong></td><td style="padding: 10px; border: 1px solid #ddd; background: #dbeafe;">{{nextDueDate}}</td></tr>
    </table>
    <p>Best regards,<br>Asset Tracker System</p>
  </div>`,
  },

  ticketStatusChanged: {
    subject: "Ticket Updated: {{ticketTitle}}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">Ticket Status Updated</h2>
        <p>Hello {{creatorName}},</p>
        <p>The status of your ticket has been updated:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Ticket</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{ticketTitle}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Previous Status</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{oldStatus}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #dbeafe;"><strong>New Status</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; background: #dbeafe;">{{newStatus}}</td>
          </tr>
        </table>
        <p>Please log in to the Asset Tracker to view your ticket.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },
  accessExpiry7Day: {
    subject: "Access Expiring in 7 Days",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">Access Expiry Warning</h2>
        <p>Hello {{userName}},</p>
        <p>Your access to the Asset Tracker will expire in <strong>7 days</strong> on <strong>{{expiryDate}}</strong>.</p>
        <p>If you need continued access, please contact your administrator.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },
  accessExpiry1Day: {
    subject: "Access Expiring Tomorrow",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Access Expiring Tomorrow</h2>
        <p>Hello {{userName}},</p>
        <p>Your access to the Asset Tracker will expire <strong>tomorrow</strong> on <strong>{{expiryDate}}</strong>.</p>
        <p>If you need continued access, please contact your administrator immediately.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },
  accessExpired: {
    subject: "Access Has Been Revoked",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Access Revoked</h2>
        <p>Hello {{userName}},</p>
        <p>Your access to the Asset Tracker has expired and has been revoked as of <strong>{{expiryDate}}</strong>.</p>
        <p>If you believe this is an error, please contact your administrator.</p>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },
  scheduledReport: {
    subject: "Your {{reportType}} Report",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Scheduled Report</h2>
        <p>Hello {{userName}},</p>
        <p>Your <strong>{{reportType}}</strong> report is attached.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; width: 30%;"><strong>Report Type</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{reportType}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Format</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{format}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5;"><strong>Generated</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{generatedAt}}</td>
          </tr>
        </table>
        <p>Best regards,<br>Asset Tracker System</p>
      </div>
    `,
  },
};

export type TemplateType = keyof typeof emailTemplates;
