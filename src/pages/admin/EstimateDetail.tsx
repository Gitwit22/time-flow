import {
  ArrowLeft,
  ArrowRightCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatLongDate } from "@/lib/date";
import { useAppStore } from "@/store/appStore";
import type { Estimate, EstimateGroup, EstimateItem, EstimateItemCategory, EstimateStatus } from "@/types";

const CATEGORIES: EstimateItemCategory[] = [
  "labor",
  "materials",
  "equipment",
  "rental",
  "permit",
  "travel",
  "other",
];

const CATEGORY_LABELS: Record<EstimateItemCategory, string> = {
  labor: "Labor",
  materials: "Materials",
  equipment: "Equipment",
  rental: "Rental",
  permit: "Permit",
  travel: "Travel",
  other: "Other",
};

const STATUS_OPTIONS: { value: EstimateStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

const STATUS_BADGE_CLASSES: Record<EstimateStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  viewed: "bg-purple-100 text-purple-700",
  accepted: "bg-green-100 text-green-700",
  declined: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

function calcLineTotal(qty: number, price: number, discount = 0) {
  return Math.max(0, (qty * price) - discount);
}

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function calcTotals(estimate: Estimate) {
  const subtotal = estimate.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = estimate.discount ?? 0;
  const taxableBase = Math.max(0, subtotal - discount);
  const taxAmount = taxableBase * (estimate.taxRate ?? 0);
  const total = taxableBase + taxAmount + (estimate.fees ?? 0);
  return { subtotal, taxAmount, total };
}

export default function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const estimates = useAppStore((s) => s.estimates);
  const clients = useAppStore((s) => s.clients);
  const projects = useAppStore((s) => s.projects);
  const updateEstimate = useAppStore((s) => s.updateEstimate);
  const duplicateEstimate = useAppStore((s) => s.duplicateEstimate);
  const deleteEstimate = useAppStore((s) => s.deleteEstimate);

  const estimate = estimates.find((e) => e.id === id);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Must be before early return to satisfy rules-of-hooks
  const { subtotal, taxAmount, total } = useMemo(
    () => (estimate ? calcTotals(estimate) : { subtotal: 0, taxAmount: 0, total: 0 }),
    [estimate],
  );

  if (!estimate) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Estimate not found.</p>
        <Button variant="outline" asChild>
          <Link to="/platform/estimates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Estimates
          </Link>
        </Button>
      </div>
    );
  }

  const client = clients.find((c) => c.id === estimate.clientId);

  // ─── Patch helpers ──────────────────────────────────────────────────────────

  function patch(updates: Partial<Estimate>) {
    updateEstimate(estimate!.id, updates);
  }

  function patchItems(items: EstimateItem[]) {
    patch({ items });
  }

  // ─── Item helpers ────────────────────────────────────────────────────────────

  function addItem(groupId?: string) {
    const sortOrder = estimate!.items.length;
    const item: EstimateItem = {
      id: newId("estimate-item"),
      groupId,
      category: "labor",
      description: "",
      quantity: 1,
      unitPrice: 0,
      lineTotal: 0,
      sortOrder,
    };
    patchItems([...estimate!.items, item]);
  }

  function updateItem(itemId: string, changes: Partial<EstimateItem>) {
    const items = estimate!.items.map((item) => {
      if (item.id !== itemId) return item;
      const merged = { ...item, ...changes };
      merged.lineTotal = calcLineTotal(merged.quantity, merged.unitPrice, merged.discount ?? 0);
      return merged;
    });
    patchItems(items);
  }

  function removeItem(itemId: string) {
    patchItems(estimate!.items.filter((item) => item.id !== itemId));
  }

  function moveItem(itemId: string, direction: "up" | "down") {
    const items = [...estimate!.items];
    const idx = items.findIndex((item) => item.id === itemId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    patchItems(items.map((item, i) => ({ ...item, sortOrder: i })));
  }

  function duplicateItem(itemId: string) {
    const source = estimate!.items.find((item) => item.id === itemId);
    if (!source) return;
    const copy: EstimateItem = {
      ...source,
      id: newId("estimate-item"),
      sortOrder: estimate!.items.length,
    };
    patchItems([...estimate!.items, copy]);
  }

  // ─── Group helpers ───────────────────────────────────────────────────────────

  function addGroup() {
    const group: EstimateGroup = {
      id: newId("estimate-group"),
      name: "New Section",
      sortOrder: estimate!.groups.length,
    };
    patch({ groups: [...estimate!.groups, group] });
  }

  function updateGroup(groupId: string, changes: Partial<EstimateGroup>) {
    patch({
      groups: estimate!.groups.map((g) => (g.id === groupId ? { ...g, ...changes } : g)),
    });
  }

  function removeGroup(groupId: string) {
    patch({
      groups: estimate!.groups.filter((g) => g.id !== groupId),
      items: estimate!.items.filter((item) => item.groupId !== groupId),
    });
  }

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function handleSend() {
    patch({ status: "sent" });
    toast({ title: "Estimate marked as Sent" });
  }

  function handleConvert() {
    if (estimate!.convertedProjectId || estimate!.convertedAt) {
      toast({ title: "Already marked for conversion" });
      return;
    }
    patch({ convertedAt: new Date().toISOString() });
    toast({ title: "Convert to Project", description: "Estimate flagged — link to a project in the Projects page." });
  }

  function handleDuplicate() {
    const copy = duplicateEstimate(estimate!.id);
    if (copy) {
      navigate(`/platform/estimates/${copy.id}`);
      toast({ title: "Duplicated", description: copy.estimateNumber });
    }
  }

  function handleDelete() {
    deleteEstimate(estimate!.id);
    navigate("/platform/estimates");
    toast({ title: "Estimate deleted" });
  }

  // Ungrouped items (no groupId or group not found)
  const groupIds = new Set(estimate.groups.map((g) => g.id));
  const ungroupedItems = estimate.items.filter((item) => !item.groupId || !groupIds.has(item.groupId));
  const sortedGroups = [...estimate.groups].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/platform/estimates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1 flex items-center gap-2 justify-center">
          <span className="text-lg font-semibold font-mono">{estimate.estimateNumber}</span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[estimate.status]}`}
          >
            {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => toast({ title: "PDF coming soon", description: "PDF generation will be added in a future update." })}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          {estimate.status === "draft" && (
            <Button variant="outline" size="sm" onClick={handleSend}>
              <Send className="mr-2 h-4 w-4" />
              Send
            </Button>
          )}
          <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleConvert} disabled={!!(estimate.convertedProjectId || estimate.convertedAt)}>
            <ArrowRightCircle className="mr-2 h-4 w-4" />
            {(estimate.convertedProjectId || estimate.convertedAt) ? "Converted" : "Convert to Project"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        {/* ─── LEFT COLUMN (65%) ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Select
                  value={estimate.clientId}
                  onValueChange={(val) => patch({ clientId: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input value={client?.name ?? ""} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <Label>Contact</Label>
                <Input value={client?.contactName ?? ""} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={client?.contactEmail ?? ""} readOnly className="bg-muted/40" />
              </div>
              <div className="space-y-1.5">
                <Label>Project (optional)</Label>
                <Select
                  value={estimate.projectId ?? "none"}
                  onValueChange={(val) => patch({ projectId: val === "none" ? undefined : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects
                      .filter((p) => p.clientId === estimate.clientId)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Line Items</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addGroup}>
                  <Plus className="mr-1 h-3 w-3" />
                  Add Section
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              {/* Ungrouped items */}
              <LineItemsSection
                items={ungroupedItems}
                allItems={estimate.items}
                onAddItem={() => addItem()}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onMoveItem={moveItem}
                onDuplicateItem={duplicateItem}
              />

              {/* Grouped items */}
              {sortedGroups.map((group) => {
                const groupItems = estimate.items
                  .filter((item) => item.groupId === group.id)
                  .sort((a, b) => a.sortOrder - b.sortOrder);
                const collapsed = collapsedGroups.has(group.id);
                return (
                  <div key={group.id} className="border-t">
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/20">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {collapsed ? (
                          <ChevronRight className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      <Input
                        value={group.name}
                        onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                        className="h-7 text-sm font-medium border-0 bg-transparent px-0 focus-visible:ring-0 max-w-[200px]"
                      />
                      <div className="ml-auto">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => removeGroup(group.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {!collapsed && (
                      <LineItemsSection
                        items={groupItems}
                        allItems={estimate.items}
                        onAddItem={() => addItem(group.id)}
                        onUpdateItem={updateItem}
                        onRemoveItem={removeItem}
                        onMoveItem={moveItem}
                        onDuplicateItem={duplicateItem}
                      />
                    )}
                  </div>
                );
              })}

              {/* Totals row */}
              <div className="border-t px-4 py-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Discount ($)</span>
                  <Input
                    type="number"
                    min={0}
                    value={estimate.discount ?? 0}
                    onChange={(e) => patch({ discount: parseFloat(e.target.value) || 0 })}
                    className="w-32 h-7 text-right"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tax rate (%)</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={((estimate.taxRate ?? 0) * 100).toFixed(1)}
                    onChange={(e) => patch({ taxRate: (parseFloat(e.target.value) || 0) / 100 })}
                    className="w-32 h-7 text-right"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
                {(estimate.fees ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fees</span>
                    <span>{formatCurrency(estimate.fees ?? 0)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {(estimate.depositPercent ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Deposit ({estimate.depositPercent}%)</span>
                    <span>{formatCurrency((total * (estimate.depositPercent ?? 0)) / 100)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Notes visible to the customer…"
                value={estimate.notes ?? ""}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Terms &amp; Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Standard terms and conditions…"
                value={estimate.terms ?? ""}
                onChange={(e) => patch({ terms: e.target.value })}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* ─── RIGHT COLUMN (35%) ──────────────────────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-6">
          {/* Estimate Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estimate Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Select
                  value={estimate.status}
                  onValueChange={(val) => patch({ status: val as EstimateStatus })}
                >
                  <SelectTrigger className="h-7 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimate #</span>
                <span className="font-mono">{estimate.estimateNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatLongDate(estimate.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Expiration</span>
                <Input
                  type="date"
                  value={estimate.expirationDate ?? ""}
                  onChange={(e) => patch({ expirationDate: e.target.value || undefined })}
                  className="h-7 w-[140px] text-xs"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Deposit (%)</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={estimate.depositPercent ?? ""}
                  placeholder="0"
                  onChange={(e) => patch({ depositPercent: parseFloat(e.target.value) || undefined })}
                  className="h-7 w-[80px] text-xs text-right"
                />
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {(estimate.discount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-600">−{formatCurrency(estimate.discount ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>TOTAL</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {(estimate.depositPercent ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Deposit due</span>
                  <span>{formatCurrency((total * (estimate.depositPercent ?? 0)) / 100)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Approval section (post-send) */}
          {estimate.status !== "draft" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Approval</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${estimate.status === "sent" || estimate.status === "viewed" || estimate.status === "accepted" ? "bg-blue-500" : "bg-gray-300"}`} />
                  <span>Sent</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${estimate.status === "viewed" || estimate.status === "accepted" ? "bg-purple-500" : "bg-gray-300"}`} />
                  <span>Viewed</span>
                </div>
                {estimate.status === "accepted" ? (
                  <div className="space-y-1 rounded-md bg-green-50 p-3">
                    <p className="font-medium text-green-700">✔ Accepted</p>
                    {estimate.signature ? (
                      <>
                        <p className="text-xs text-muted-foreground">Signed by: {estimate.signature.customerName}</p>
                        <p className="text-xs text-muted-foreground">{formatLongDate(estimate.signature.acceptedAt)}</p>
                      </>
                    ) : estimate.acceptedAt ? (
                      <p className="text-xs text-muted-foreground">{formatLongDate(estimate.acceptedAt)}</p>
                    ) : null}
                  </div>
                ) : estimate.status === "declined" ? (
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="font-medium text-red-700">✗ Declined</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gray-300" />
                    <span className="text-muted-foreground">Waiting…</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {estimate.estimateNumber}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Line Items Section Component ────────────────────────────────────────────

function LineItemsSection({
  items,
  allItems,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onMoveItem,
  onDuplicateItem,
}: {
  items: EstimateItem[];
  allItems: EstimateItem[];
  onAddItem: () => void;
  onUpdateItem: (id: string, changes: Partial<EstimateItem>) => void;
  onRemoveItem: (id: string) => void;
  onMoveItem: (id: string, direction: "up" | "down") => void;
  onDuplicateItem: (id: string) => void;
}) {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div>
      {sorted.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-16">Qty</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-32">Category</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground w-28">Unit Price</th>
                <th className="text-right px-4 py-2 font-medium text-muted-foreground w-24">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onUpdate={(changes) => onUpdateItem(item.id, changes)}
                  onRemove={() => onRemoveItem(item.id)}
                  onMoveUp={() => onMoveItem(item.id, "up")}
                  onMoveDown={() => onMoveItem(item.id, "down")}
                  onDuplicate={() => onDuplicateItem(item.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="px-4 py-2">
        <Button size="sm" variant="ghost" onClick={onAddItem}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Item
        </Button>
      </div>
    </div>
  );
}

function LineItemRow({
  item,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: {
  item: EstimateItem;
  onUpdate: (changes: Partial<EstimateItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  return (
    <tr className="border-b last:border-0 hover:bg-muted/10 group">
      <td className="px-4 py-1.5">
        <Input
          type="number"
          min={0}
          step={0.01}
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: parseFloat(e.target.value) || 0 })}
          className="h-7 w-16 text-center"
        />
      </td>
      <td className="px-4 py-1.5">
        <Input
          value={item.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Description"
          className="h-7"
        />
      </td>
      <td className="px-4 py-1.5">
        <Select
          value={item.category}
          onValueChange={(val) => onUpdate({ category: val as EstimateItemCategory })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-1.5">
        <Input
          type="number"
          min={0}
          step={0.01}
          value={item.unitPrice}
          onChange={(e) => onUpdate({ unitPrice: parseFloat(e.target.value) || 0 })}
          className="h-7 w-28 text-right"
        />
      </td>
      <td className="px-4 py-1.5 text-right font-medium">
        {formatCurrency(item.lineTotal)}
      </td>
      <td className="px-2 py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveUp}>Move Up</DropdownMenuItem>
            <DropdownMenuItem onClick={onMoveDown}>Move Down</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}
