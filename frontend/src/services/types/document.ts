/** Document-related type definitions. */

export interface DocumentCreateRequest {
  title: string;
  content: string;
}

export interface DocumentUpdateRequest {
  title?: string;
  content?: string;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
}
