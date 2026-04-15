import { ChangeEvent, useMemo, useState } from "react";
import { Archive, Download, Eye, FolderOpen, Loader2, Pencil, RotateCcw, Save, Upload } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createAttachedDocumentDraft, getDefaultDocumentTitle } from "@/lib/documents";
import { formatLongDate } from "@/lib/date";
import type { AttachedDocument } from "@/types";

interface DocumentManagerProps {
  contextLabel: string;
  documents: AttachedDocument[];
  currentUserName: string;
  readOnly?: boolean;
  maxFileBytes?: number;
  onAdd: (document: Omit<AttachedDocument, "id">) => Promise<void>;
  onUpdate: (documentId: string, updates: Partial<AttachedDocument>) => Promise<void>;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload via the Cloudflare Pages Function (/api/upload).
 * Returns the R2 object key on success.
 * Throws with a user-facing message on failure.
 */
async function uploadToCloud(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/upload", { method: "POST", body: form });

  if (!response.ok) {
    let message = "Storage upload failed.";
    try {
      const json = await response.json() as { error?: string };
      if (json.error) message = json.error;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }

  const json = await response.json() as { key: string };
  return json.key;
}

/** True when running in production (i.e. the Pages Function is available). */
function isCloudAvailable() {
  // In dev (npm run dev / Vite) there is no /api/* Function available
  // unless the user also runs `wrangler pages dev`. We detect production
  // by checking that we are not on localhost.
  return typeof window !== "undefined" && !window.location.hostname.includes("localhost");
}

export function DocumentManager({
  contextLabel,
  documents,
  currentUserName,
  readOnly,
  maxFileBytes = isCloudAvailable() ? 10 * 1024 * 1024 : 1024 * 1024,
  onAdd,
  onUpdate,
}: DocumentManagerProps) {
  const { toast } = useToast();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingNote, setPendingNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const activeDocuments = useMemo(() => documents.filter((document) => document.status === "active"), [documents]);
  const archivedDocuments = useMemo(() => documents.filter((document) => document.status === "archived"), [documents]);

  const [isUploading, setIsUploading] = useState(false);

  const handleUpdateDocument = async (documentId: string, updates: Partial<AttachedDocument>) => {
    try {
      await onUpdate(documentId, updates);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The document could not be updated.";
      toast({ title: "Update failed", description: message, variant: "destructive" });
      throw error;
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const limitLabel = isCloudAvailable()
      ? `${Math.round(maxFileBytes / 1024 / 1024)} MB`
      : `${Math.round(maxFileBytes / 1024)} KB`;

    if (file.size > maxFileBytes) {
      toast({ title: "Document too large", description: `Use a file under ${limitLabel}.`, variant: "destructive" });
      event.target.value = "";
      return;
    }

    setPendingFile(file);
    setPendingTitle(getDefaultDocumentTitle(file.name));
    setPendingNote("");
    event.target.value = "";
  };

  const handleSaveDocument = async () => {
    if (!pendingFile) {
      return;
    }

    if (!pendingTitle.trim()) {
      toast({ title: "Document title required", description: "Give the document a title before saving.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      if (isCloudAvailable()) {
        // Production: upload to R2 via Pages Function; store the key, not a data URL
        const storageKey = await uploadToCloud(pendingFile);
        await onAdd(createAttachedDocumentDraft(pendingFile, "", currentUserName, pendingTitle, pendingNote, storageKey));
      } else {
        // Dev fallback: store as base64 data URL in localStorage
        const dataUrl = await readAsDataUrl(pendingFile);
        await onAdd(createAttachedDocumentDraft(pendingFile, dataUrl, currentUserName, pendingTitle, pendingNote));
      }
      toast({ title: "Document saved", description: `${pendingTitle.trim()} was attached to this ${contextLabel}.` });
      setPendingFile(null);
      setPendingTitle("");
      setPendingNote("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The document could not be attached.";
      toast({ title: "Upload failed", description: message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly ? (
        <div className="rounded-xl border bg-muted/20 p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Upload document</Label>
            <Input type="file" onChange={handleFileSelect} />
          </div>
          {pendingFile ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Document title</Label>
                <Input value={pendingTitle} onChange={(event) => setPendingTitle(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Original filename</Label>
                <Input value={pendingFile.name} disabled />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs">Optional note</Label>
                <Textarea className="min-h-24 resize-none" value={pendingNote} onChange={(event) => setPendingNote(event.target.value)} />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <Button onClick={() => void handleSaveDocument()} disabled={isUploading}>
                  {isUploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" /> Save Document</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPendingFile(null);
                    setPendingTitle("");
                    setPendingNote("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeDocuments.length ? (
        <div className="space-y-3">
          {activeDocuments.map((document) => (
            <div key={document.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  {editingId === document.id ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} className="sm:max-w-xs" />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void (async () => {
                            if (!editingTitle.trim()) {
                              return;
                            }

                            await handleUpdateDocument(document.id, { title: editingTitle.trim() });
                            setEditingId(null);
                            setEditingTitle("");
                          })()}
                        >
                          <Save className="mr-1.5 h-3.5 w-3.5" /> Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-medium">{document.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Original file: {document.originalFilename}</p>
                  <p className="text-sm text-muted-foreground">Uploaded by {document.uploadedBy} on {formatLongDate(document.uploadedAt)}</p>
                  {document.note ? <p className="text-sm text-muted-foreground">{document.note}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={document.storageKey ? `/api/file/${document.storageKey}` : document.dataUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={document.storageKey ? `/api/file/${document.storageKey}` : document.dataUrl}
                      download={document.originalFilename}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                    </a>
                  </Button>
                  {!readOnly ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(document.id);
                          setEditingTitle(document.title);
                        }}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Rename
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void handleUpdateDocument(document.id, { status: "archived" })}>
                        <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderOpen} title="No active documents" description={`Upload a document to keep practical reference files attached to this ${contextLabel}.`} />
      )}

      {archivedDocuments.length ? (
        <div className="space-y-3">
          <div>
            <h3 className="font-heading text-sm font-semibold">Archived Documents</h3>
            <p className="text-sm text-muted-foreground">Archived files stay available for reference and can be restored.</p>
          </div>
          {archivedDocuments.map((document) => (
            <div key={document.id} className="rounded-xl border border-dashed p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-medium">{document.title}</p>
                  <p className="text-sm text-muted-foreground">Original file: {document.originalFilename}</p>
                  <p className="text-sm text-muted-foreground">Uploaded by {document.uploadedBy} on {formatLongDate(document.uploadedAt)}</p>
                </div>
                {!readOnly ? (
                  <Button variant="outline" size="sm" onClick={() => void handleUpdateDocument(document.id, { status: "active" })}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
