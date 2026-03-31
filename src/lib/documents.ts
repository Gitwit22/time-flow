import type { AttachedDocument } from "@/types";

export type LegacyAttachedDocument = Partial<AttachedDocument> & {
  name?: string;
  visibility?: string;
};

function stripExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, "");
}

export function getDefaultDocumentTitle(filename: string) {
  const stripped = stripExtension(filename).trim();
  return stripped || filename;
}

export function createAttachedDocumentDraft(file: File, dataUrl: string, uploadedBy: string, title: string, note?: string): Omit<AttachedDocument, "id"> {
  return {
    title: title.trim() || getDefaultDocumentTitle(file.name),
    originalFilename: file.name,
    note: note?.trim() || undefined,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    status: "active",
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    dataUrl,
  };
}

export function normalizeAttachedDocumentRecord(document: LegacyAttachedDocument): AttachedDocument {
  const originalFilename = document.originalFilename ?? document.name ?? "document";
  const title = document.title ?? document.name ?? getDefaultDocumentTitle(originalFilename);

  return {
    id: document.id ?? `doc-${crypto.randomUUID()}`,
    title,
    originalFilename,
    note: document.note,
    uploadedBy: document.uploadedBy ?? "Unknown uploader",
    uploadedAt: document.uploadedAt ?? new Date().toISOString(),
    status: document.status === "archived" ? "archived" : "active",
    mimeType: document.mimeType ?? "application/octet-stream",
    sizeBytes: document.sizeBytes ?? 0,
    dataUrl: document.dataUrl ?? "",
  };
}
