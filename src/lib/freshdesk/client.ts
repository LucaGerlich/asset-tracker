/**
 * Freshdesk API Client
 * Handles communication with the Freshdesk API
 * Documentation: https://developers.freshdesk.com/api/
 * 
 * Note: This client uses Node.js Buffer for base64 encoding and should
 * only be used in server-side code (API routes, server components).
 */

import type {
  FreshdeskConfig,
  FreshdeskTicket,
  FreshdeskTicketFilters,
  FreshdeskApiResult,
  FreshdeskTicketType,
} from './types';
import { SUPPORTED_TICKET_TYPES } from './types';

/**
 * Base64 encode a string using Node.js Buffer
 * This function is server-side only
 */
function base64Encode(str: string): string {
  // Buffer is available in Node.js environment (server-side)
  return Buffer.from(str).toString('base64');
}

/**
 * Freshdesk API Client
 */
export class FreshdeskClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: FreshdeskConfig) {
    // Freshdesk domain can be just the subdomain or full URL
    const domain = config.domain.replace(/\.freshdesk\.com\/?$/, '').replace(/^https?:\/\//, '');
    this.baseUrl = `https://${domain}.freshdesk.com/api/v2`;
    // Freshdesk uses API key as username with 'X' as password for Basic Auth
    this.authHeader = `Basic ${base64Encode(`${config.apiKey}:X`)}`;
  }

  /**
   * Make an authenticated request to the Freshdesk API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<FreshdeskApiResult<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.description || errorData.message || `HTTP ${response.status}`;
        return { success: false, error: errorMessage };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test the API connection
   */
  async testConnection(): Promise<boolean> {
    // Try to fetch the first page of tickets with a limit of 1 to minimize data transfer
    const result = await this.request<FreshdeskTicket[]>('/tickets?per_page=1');
    return result.success;
  }

  /**
   * Get all tickets with optional filters
   */
  async getTickets(filters?: FreshdeskTicketFilters): Promise<FreshdeskApiResult<FreshdeskTicket[]>> {
    const params = new URLSearchParams();
    
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.per_page) params.append('per_page', String(filters.per_page));
    if (filters?.updated_since) params.append('updated_since', filters.updated_since);
    
    // Note: Freshdesk filter API uses a different endpoint for complex queries
    // For simple listing, we'll fetch and filter client-side for type filtering
    const queryString = params.toString();
    const endpoint = `/tickets${queryString ? `?${queryString}` : ''}`;
    
    return this.request<FreshdeskTicket[]>(endpoint);
  }

  /**
   * Get tickets filtered by specific types (Hardware Request, Problem)
   * Freshdesk doesn't support type filtering in the list API, so we need to use the search API
   */
  async getTicketsByTypes(
    types: FreshdeskTicketType[] = [...SUPPORTED_TICKET_TYPES],
    page: number = 1,
    perPage: number = 30
  ): Promise<FreshdeskApiResult<FreshdeskTicket[]>> {
    // Use Freshdesk search API for type filtering
    // Search query format: "type:'Hardware Request' OR type:'Problem'"
    const typeQueries = types.map(t => `type:'${t}'`).join(' OR ');
    const query = encodeURIComponent(`(${typeQueries})`);
    
    const result = await this.request<{ results: FreshdeskTicket[]; total: number }>(
      `/search/tickets?query="${query}"&page=${page}`
    );

    if (result.success && result.data) {
      return { success: true, data: result.data.results };
    }

    // If search fails (e.g., search not enabled), fall back to fetching all and filtering
    const allTickets = await this.getTickets({ page, per_page: perPage });
    if (allTickets.success && allTickets.data) {
      const filtered = allTickets.data.filter(
        ticket => ticket.type && types.includes(ticket.type)
      );
      return { success: true, data: filtered };
    }

    return allTickets;
  }

  /**
   * Get a single ticket by ID
   */
  async getTicket(ticketId: number): Promise<FreshdeskApiResult<FreshdeskTicket>> {
    return this.request<FreshdeskTicket>(`/tickets/${ticketId}?include=requester`);
  }

  /**
   * Get ticket conversations (replies)
   */
  async getTicketConversations(ticketId: number): Promise<FreshdeskApiResult<unknown[]>> {
    return this.request<unknown[]>(`/tickets/${ticketId}/conversations`);
  }
}

/**
 * Create a Freshdesk client from configuration
 */
export function createFreshdeskClient(config: FreshdeskConfig): FreshdeskClient {
  if (!config.domain) throw new Error('Freshdesk domain is required');
  if (!config.apiKey) throw new Error('Freshdesk API key is required');
  
  return new FreshdeskClient(config);
}
