/** Hook for document operations. */

import { useCallback, useState } from 'react';

import type { Document, DocumentCreateRequest, DocumentUpdateRequest } from '../services/types/document';
import { documentApi } from '../services/api/documentApi';

export interface UseDocumentReturn {
  documents: Document[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  loadDocuments: () => Promise<void>;
  loadDocument: (id: string) => Promise<void>;
  createDocument: (data: DocumentCreateRequest) => Promise<Document>;
  updateDocument: (id: string, data: DocumentUpdateRequest) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  setCurrentDocument: (doc: Document | null) => void;
}

export function useDocument(): UseDocumentReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await documentApi.list();
      // Expand list items to full documents
      const docs: Document[] = response.documents.map((item) => ({
        ...item,
        content: '',
        created_at: item.updated_at,
      }));
      setDocuments(docs);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load documents';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadDocument = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const doc = await documentApi.get(id);
      setCurrentDocument(doc);

      // Update in list if exists
      setDocuments((prev) =>
        prev.some((d) => d.id === id)
          ? prev.map((d) => (d.id === id ? doc : d))
          : [...prev, doc],
      );
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load document';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createDocument = useCallback(async (data: DocumentCreateRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      const doc = await documentApi.create(data);
      setDocuments((prev) => [...prev, doc]);
      setCurrentDocument(doc);
      return doc;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to create document';
      setError(errorMessage);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateDocument = useCallback(async (id: string, data: DocumentUpdateRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      const doc = await documentApi.update(id, data);
      setDocuments((prev) => prev.map((d) => (d.id === id ? doc : d)));
      if (currentDocument?.id === id) {
        setCurrentDocument(doc);
      }
      return doc;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to update document';
      setError(errorMessage);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [currentDocument]);

  const deleteDocument = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await documentApi.delete(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (currentDocument?.id === id) {
        setCurrentDocument(null);
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to delete document';
      setError(errorMessage);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [currentDocument]);

  return {
    documents,
    currentDocument,
    isLoading,
    error,
    loadDocuments,
    loadDocument,
    createDocument,
    updateDocument,
    deleteDocument,
    setCurrentDocument,
  };
}
