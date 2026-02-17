/** Document API client. */

import type {
  Document,
  DocumentCreateRequest,
  DocumentListResponse,
  DocumentUpdateRequest,
} from '../types/document';
import { API_ENDPOINTS } from './config';

/**
 * Document API client
 */
export const documentApi = {
  /**
   * Create a new document
   */
  async create(data: DocumentCreateRequest): Promise<Document> {
    const response = await fetch(API_ENDPOINTS.documents(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create document: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Get list of all documents
   */
  async list(): Promise<DocumentListResponse> {
    const response = await fetch(API_ENDPOINTS.documents());
    if (!response.ok) {
      throw new Error(`Failed to list documents: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Get a single document by ID
   */
  async get(id: string): Promise<Document> {
    const response = await fetch(API_ENDPOINTS.document(id));
    if (!response.ok) {
      throw new Error(`Failed to get document: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Update a document
   */
  async update(id: string, data: DocumentUpdateRequest): Promise<Document> {
    const response = await fetch(API_ENDPOINTS.document(id), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update document: ${response.status}`);
    }

    return response.json();
  },

  /**
   * Delete a document
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(API_ENDPOINTS.document(id), {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete document: ${response.status}`);
    }
  },
};
