/**
 * Email Module Exports
 */

export { sendEmail, queueEmail, processEmailQueue, testEmailConnection, isEmailConfigured } from './service';
export { createEmailProvider } from './providers';
export { emailTemplates, renderTemplate, type TemplateType, type TemplateVariables } from './templates';
export { EMAIL_PROVIDERS, type EmailProvider, type EmailOptions, type EmailSendResult } from './types';
