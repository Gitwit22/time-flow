import { getActiveAuthToken, getActiveUser } from "@/lib/auth";
import { getPlatformSession, TIMEFLOW_API_BASE } from "@/lib/platformApi";
import type { AttachedDocument } from "@/types";

export type TimeflowDocumentEntityType = "client" | "project";

interface TimeflowDocumentRecord extends AttachedDocument {
  entityType: TimeflowDocumentEntityType;
  entityId: string;
  createdAt: string;
  updatedAt: string;
}

interface TimeflowDocumentsResponse {
  documents: TimeflowDocumentRecord[];
}

function getPartitionHeaderValue() {
  if (typeof import.meta !== "undefined" && (import.meta as Record<string, unknown>).env) {
    const env = (import.meta as Record<string, unknown>).env as Record<string, string | undefined>;
    if (env.VITE_APP_PARTITION?.trim()) return env.VITE_APP_PARTITION.trim();
  }
  return "timeflow";
}

function buildHeaders(contentType = true): Headers {
  const headers = new Headers();
  headers.set("x-app-partition", getPartitionHeaderValue());
  if (contentType) {
    headers.set("Content-Type", "application/json");
  }

  const platformToken = getPlatformSession()?.token;
  const authToken = getActiveAuthToken();
  const token = platformToken || authToken;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = buildHeaders(true);
  const customHeaders = init.headers ? new Headers(init.headers) : undefined;
  customHeaders?.forEach((value, key) => headers.set(key, value));

  const response = await fetch(`${TIMEFLOW_API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(errorBody.error || "Request failed.");
  }

  return response;
}

export async function listTimeflowDocuments(entityType: TimeflowDocumentEntityType): Promise<Record<string, AttachedDocument[]>> {
  const response = await apiFetch(`/api/timeflow/documents?entityType=${encodeURIComponent(entityType)}`, {
    method: "GET",
  });

  const data = (await response.json()) as TimeflowDocumentsResponse;
  const grouped: Record<string, AttachedDocument[]> = {};

  for (const doc of data.documents ?? []) {
    if (!doc.entityId) continue;
    const current = grouped[doc.entityId] || [];
    grouped[doc.entityId] = [...current, doc];
  }

  return grouped;
}

export async function createTimeflowDocument(
  entityType: TimeflowDocumentEntityType,
  entityId: string,
  document: Omit<AttachedDocument, "id">,
): Promise<AttachedDocument> {
  const user = getActiveUser();
  const response = await apiFetch("/api/timeflow/documents", {
    method: "POST",
    body: JSON.stringify({
      entityType,
      entityId,
      title: document.title,
      originalFilename: document.originalFilename,
      note: document.note,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      storageKey: document.storageKey,
      uploadedBy: document.uploadedBy || user?.name,
      uploadedAt: document.uploadedAt,
    }),
  });

  const data = (await response.json()) as { document: AttachedDocument };
  return data.document;
}

export async function updateTimeflowDocument(
  documentId: string,
  updates: Partial<AttachedDocument>,
): Promise<AttachedDocument> {
  const response = await apiFetch(`/api/timeflow/documents/${encodeURIComponent(documentId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: updates.title,
      note: updates.note,
      status: updates.status,
    }),
  });

  const data = (await response.json()) as { document: AttachedDocument };
  return data.document;
}

export async function uploadTimeflowDocumentFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await apiFetch("/api/timeflow/documents/upload", {
    method: "POST",
    headers: buildHeaders(false),
    body: form,
  });

  const data = (await response.json()) as { key?: string };
  if (!data.key) {
    throw new Error("Upload succeeded but no storage key was returned.");
  }

  return data.key;
}

export function getTimeflowDocumentDownloadUrl(documentId: string): string {
  return `${TIMEFLOW_API_BASE}/api/timeflow/documents/${encodeURIComponent(documentId)}/download`;
}
