/**
 * Freshdesk API Types
 * Documentation: https://developers.freshdesk.com/api/
 */

/**
 * Freshdesk ticket status values
 */
export enum FreshdeskTicketStatus {
  Open = 2,
  Pending = 3,
  Resolved = 4,
  Closed = 5,
}

/**
 * Freshdesk ticket priority values
 */
export enum FreshdeskTicketPriority {
  Low = 1,
  Medium = 2,
  High = 3,
  Urgent = 4,
}

/**
 * Freshdesk ticket source values
 */
export enum FreshdeskTicketSource {
  Email = 1,
  Portal = 2,
  Phone = 3,
  Chat = 7,
  Mobihelp = 8,
  FeedbackWidget = 9,
  OutboundEmail = 10,
}

/**
 * Freshdesk ticket type - these are custom strings configured in Freshdesk
 * Common types include: "Question", "Incident", "Problem", "Feature Request", "Hardware Request"
 */
export type FreshdeskTicketType = string;

/**
 * Ticket types we care about for hardware/IT support
 */
export const SUPPORTED_TICKET_TYPES = ['Hardware Request', 'Problem'] as const;
export type SupportedTicketType = (typeof SUPPORTED_TICKET_TYPES)[number];

/**
 * Freshdesk Ticket interface
 */
export interface FreshdeskTicket {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  status: FreshdeskTicketStatus;
  priority: FreshdeskTicketPriority;
  source: FreshdeskTicketSource;
  type: FreshdeskTicketType | null;
  requester_id: number;
  responder_id: number | null;
  company_id: number | null;
  group_id: number | null;
  product_id: number | null;
  email_config_id: number | null;
  fr_due_by: string | null;
  due_by: string | null;
  is_escalated: boolean;
  tags: string[];
  cc_emails: string[];
  fwd_emails: string[];
  reply_cc_emails: string[];
  ticket_cc_emails: string[];
  spam: boolean;
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  attachments?: FreshdeskAttachment[];
  requester?: FreshdeskRequester;
}

/**
 * Freshdesk Requester (contact)
 */
export interface FreshdeskRequester {
  id: number;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
}

/**
 * Freshdesk Attachment
 */
export interface FreshdeskAttachment {
  id: number;
  content_type: string;
  size: number;
  name: string;
  attachment_url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Freshdesk API configuration
 */
export interface FreshdeskConfig {
  domain: string; // e.g., "yourcompany" for yourcompany.freshdesk.com
  apiKey: string;
}

/**
 * Freshdesk API response for listing tickets
 */
export interface FreshdeskTicketListResponse {
  tickets: FreshdeskTicket[];
  total?: number;
}

/**
 * Freshdesk ticket filters for API calls
 */
export interface FreshdeskTicketFilters {
  type?: FreshdeskTicketType;
  status?: FreshdeskTicketStatus;
  priority?: FreshdeskTicketPriority;
  requester_id?: number;
  company_id?: number;
  updated_since?: string; // ISO date string
  page?: number;
  per_page?: number;
}

/**
 * API result wrapper
 */
export interface FreshdeskApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Helper functions to convert status/priority to display strings
 */
export function getStatusLabel(status: FreshdeskTicketStatus): string {
  switch (status) {
    case FreshdeskTicketStatus.Open:
      return 'Open';
    case FreshdeskTicketStatus.Pending:
      return 'Pending';
    case FreshdeskTicketStatus.Resolved:
      return 'Resolved';
    case FreshdeskTicketStatus.Closed:
      return 'Closed';
    default:
      return 'Unknown';
  }
}

export function getPriorityLabel(priority: FreshdeskTicketPriority): string {
  switch (priority) {
    case FreshdeskTicketPriority.Low:
      return 'Low';
    case FreshdeskTicketPriority.Medium:
      return 'Medium';
    case FreshdeskTicketPriority.High:
      return 'High';
    case FreshdeskTicketPriority.Urgent:
      return 'Urgent';
    default:
      return 'Unknown';
  }
}

export function getStatusColor(status: FreshdeskTicketStatus): string {
  switch (status) {
    case FreshdeskTicketStatus.Open:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case FreshdeskTicketStatus.Pending:
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case FreshdeskTicketStatus.Resolved:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case FreshdeskTicketStatus.Closed:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getPriorityColor(priority: FreshdeskTicketPriority): string {
  switch (priority) {
    case FreshdeskTicketPriority.Low:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    case FreshdeskTicketPriority.Medium:
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case FreshdeskTicketPriority.High:
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case FreshdeskTicketPriority.Urgent:
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
