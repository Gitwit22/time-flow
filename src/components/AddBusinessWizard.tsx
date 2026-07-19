import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";
import type { BusinessType, BusinessIndustry, EstimateHeaderStyle } from "@/types";

interface AddBusinessWizardProps {
  open: boolean;
  onClose: () => void;
}

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "other", label: "Other" },
];

const INDUSTRIES: { value: BusinessIndustry; label: string }[] = [
  { value: "technology", label: "Technology" },
  { value: "construction", label: "Construction" },
  { value: "consulting", label: "Consulting" },
  { value: "creative", label: "Creative / Design" },
  { value: "healthcare", label: "Healthcare" },
  { value: "legal", label: "Legal" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "retail", label: "Retail" },
  { value: "hospitality", label: "Hospitality" },
  { value: "real_estate", label: "Real Estate" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "other", label: "Other" },
];

const HEADER_STYLES: { value: EstimateHeaderStyle; label: string; description: string }[] = [
  { value: "modern", label: "Modern", description: "Clean layout with accent colors" },
  { value: "classic", label: "Classic", description: "Traditional professional look" },
  { value: "minimal", label: "Minimal", description: "Simple and understated" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY", "INR", "MXN", "BRL"];

const PAYMENT_TERMS_OPTIONS = [
  { value: "due_on_receipt", label: "Due on Receipt" },
  { value: "net_15", label: "Net 15" },
  { value: "net_30", label: "Net 30" },
  { value: "net_60", label: "Net 60" },
  { value: "net_90", label: "Net 90" },
];

const STEPS = [
  "Business Details",
  "Business Address",
  "Branding",
  "Financial Settings",
  "Estimate Defaults",
];

interface WizardData {
  // Step 1
  name: string;
  legalName: string;
  businessType: BusinessType | "";
  industry: BusinessIndustry | "";
  email: string;
  phone: string;
  website: string;
  // Step 2
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  useAddressOnDocuments: boolean;
  // Step 3
  logoDataUrl?: string;
  primaryColor: string;
  accentColor: string;
  estimateHeaderStyle: EstimateHeaderStyle;
  // Step 4
  currency: string;
  taxRate: string;
  estimatePrefix: string;
  estimateStartNumber: string;
  invoicePrefix: string;
  invoiceStartNumber: string;
  defaultPaymentTerms: string;
  defaultExpirationDays: string;
  // Step 5
  defaultCustomerNote: string;
  defaultTermsAndConditions: string;
  defaultDepositPercent: string;
  defaultTaxableStatus: boolean;
}

const initialData: WizardData = {
  name: "",
  legalName: "",
  businessType: "",
  industry: "",
  email: "",
  phone: "",
  website: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
  useAddressOnDocuments: true,
  primaryColor: "#2563eb",
  accentColor: "#64748b",
  estimateHeaderStyle: "modern",
  currency: "USD",
  taxRate: "0",
  estimatePrefix: "EST",
  estimateStartNumber: "1001",
  invoicePrefix: "INV",
  invoiceStartNumber: "1001",
  defaultPaymentTerms: "net_30",
  defaultExpirationDays: "30",
  defaultCustomerNote: "",
  defaultTermsAndConditions: "",
  defaultDepositPercent: "25",
  defaultTaxableStatus: true,
};

export function AddBusinessWizard({ open, onClose }: AddBusinessWizardProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const createOrganizationWorkspace = useAppStore((state) => state.createOrganizationWorkspace);
  const seedOrganizationContext = useAppStore((state) => state.seedOrganizationContext);
  const addEstimate = useAppStore((state) => state.addEstimate);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);
  const currentUser = useAppStore((state) => state.currentUser);

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialData);
  const [submitting, setSubmitting] = useState(false);

  function update(updates: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  function canAdvance(): boolean {
    if (step === 0) return data.name.trim().length > 0;
    return true;
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleSubmit(andCreateEstimate: boolean) {
    if (!data.name.trim()) {
      toast({ title: "Business name is required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const newOrgId = await createOrganizationWorkspace(data.name.trim());
      if (!newOrgId) throw new Error("Failed to create business");

      // Seed the extended business data into local state
      seedOrganizationContext({
        organization: {
          id: newOrgId,
          name: data.name.trim(),
          ownerUserId: currentUser.id,
          createdAt: new Date().toISOString(),
          status: "active",
          workspaceType: "team",
          legalName: data.legalName.trim() || undefined,
          businessType: data.businessType || undefined,
          industry: data.industry || undefined,
          email: data.email.trim() || undefined,
          phone: data.phone.trim() || undefined,
          website: data.website.trim() || undefined,
          address: {
            street: data.street.trim() || undefined,
            city: data.city.trim() || undefined,
            state: data.state.trim() || undefined,
            zip: data.zip.trim() || undefined,
            country: data.country.trim() || undefined,
            useOnDocuments: data.useAddressOnDocuments,
          },
          branding: {
            logoDataUrl: data.logoDataUrl,
            primaryColor: data.primaryColor,
            accentColor: data.accentColor,
            estimateHeaderStyle: data.estimateHeaderStyle,
          },
          businessSettings: {
            currency: data.currency,
            taxRate: parseFloat(data.taxRate) / 100 || 0,
            estimatePrefix: data.estimatePrefix.trim() || "EST",
            nextEstimateNumber: parseInt(data.estimateStartNumber) || 1001,
            invoicePrefix: data.invoicePrefix.trim() || "INV",
            nextInvoiceNumber: parseInt(data.invoiceStartNumber) || 1001,
            defaultEstimateExpirationDays: parseInt(data.defaultExpirationDays) || 30,
            defaultPaymentTerms: data.defaultPaymentTerms,
            defaultDepositPercent: parseFloat(data.defaultDepositPercent) || 25,
            defaultCustomerNote: data.defaultCustomerNote.trim() || undefined,
            defaultTermsAndConditions: data.defaultTermsAndConditions.trim() || undefined,
            defaultTaxableStatus: data.defaultTaxableStatus,
          },
        },
      });

      await hydrateFromApi();

      toast({ title: `${data.name} is ready!`, description: "Your new business workspace has been created." });

      onClose();
      setStep(0);
      setData(initialData);

      if (andCreateEstimate) {
        // Create a blank draft estimate and navigate directly to it
        const newEstimate = addEstimate({
          clientId: "",
          status: "draft",
          groups: [],
          items: [],
          discount: 0,
          taxRate: 0,
          fees: 0,
        });
        navigate(`/platform/estimates/${newEstimate.id}`);
      } else {
        navigate("/platform/businesses");
      }
    } catch (err) {
      toast({
        title: "Failed to create business",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function renderStep() {
    switch (step) {
      case 0:
        return <Step1Details data={data} update={update} />;
      case 1:
        return <Step2Address data={data} update={update} />;
      case 2:
        return <Step3Branding data={data} update={update} />;
      case 3:
        return <Step4Financial data={data} update={update} />;
      case 4:
        return <Step5Defaults data={data} update={update} onSubmit={handleSubmit} submitting={submitting} />;
      default:
        return null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setStep(0); setData(initialData); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-primary" />
            <DialogTitle>Add a Business</DialogTitle>
          </div>
          <DialogDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step progress */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < step
                  ? "bg-primary"
                  : i === step
                  ? "bg-primary/60"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {renderStep()}

        {step < 4 && (
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleBack} disabled={step === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button onClick={handleNext} disabled={!canAdvance()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1: Business Details ─────────────────────────────────────────────────

function Step1Details({ data, update }: { data: WizardData; update: (u: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="biz-name">
            Business Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="biz-name"
            placeholder="NXT LVL Technology Solutions"
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-legal">Legal Business Name</Label>
          <Input
            id="biz-legal"
            placeholder="Same as business name if blank"
            value={data.legalName}
            onChange={(e) => update({ legalName: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Business Type</Label>
          <Select value={data.businessType} onValueChange={(v) => update({ businessType: v as BusinessType })}>
            <SelectTrigger>
              <SelectValue placeholder="Select type…" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((bt) => (
                <SelectItem key={bt.value} value={bt.value}>{bt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Industry</Label>
          <Select value={data.industry} onValueChange={(v) => update({ industry: v as BusinessIndustry })}>
            <SelectTrigger>
              <SelectValue placeholder="Select industry…" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>{ind.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="biz-email">Business Email</Label>
          <Input
            id="biz-email"
            type="email"
            placeholder="hello@company.com"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">Can differ from your login email</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-phone">Phone Number</Label>
          <Input
            id="biz-phone"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={data.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="biz-website">Website</Label>
        <Input
          id="biz-website"
          type="url"
          placeholder="https://company.com"
          value={data.website}
          onChange={(e) => update({ website: e.target.value })}
        />
      </div>
    </div>
  );
}

// ─── Step 2: Business Address ─────────────────────────────────────────────────

function Step2Address({ data, update }: { data: WizardData; update: (u: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="biz-street">Street Address</Label>
        <Input
          id="biz-street"
          placeholder="123 Main St"
          value={data.street}
          onChange={(e) => update({ street: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="biz-city">City</Label>
          <Input
            id="biz-city"
            placeholder="Detroit"
            value={data.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-state">State</Label>
          <Input
            id="biz-state"
            placeholder="MI"
            value={data.state}
            onChange={(e) => update({ state: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="biz-zip">ZIP Code</Label>
          <Input
            id="biz-zip"
            placeholder="48201"
            value={data.zip}
            onChange={(e) => update({ zip: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="biz-country">Country</Label>
          <Input
            id="biz-country"
            placeholder="United States"
            value={data.country}
            onChange={(e) => update({ country: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Checkbox
          id="use-address"
          checked={data.useAddressOnDocuments}
          onCheckedChange={(checked) => update({ useAddressOnDocuments: Boolean(checked) })}
        />
        <Label htmlFor="use-address" className="cursor-pointer font-normal">
          Use this address on estimates and invoices
        </Label>
      </div>
    </div>
  );
}

// ─── Step 3: Branding ─────────────────────────────────────────────────────────

function Step3Branding({ data, update }: { data: WizardData; update: (u: Partial<WizardData>) => void }) {
  const { toast } = useToast();

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 750 * 1024) {
      toast({ title: "Logo file too large", description: "Please choose an image under 750 KB.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ logoDataUrl: String(reader.result ?? "") });
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Upload Logo</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20">
            {data.logoDataUrl ? (
              <img src={data.logoDataUrl} alt="Logo preview" className="h-full w-full rounded-lg object-contain" />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground/40" />
            )}
          </div>
          <div>
            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
            <Label
              htmlFor="logo-upload"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Choose image
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPG up to 750 KB</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="primary-color">Primary Brand Color</Label>
          <div className="flex items-center gap-2">
            <input
              id="primary-color"
              type="color"
              value={data.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              className="h-9 w-14 cursor-pointer rounded border border-input"
            />
            <Input
              value={data.primaryColor}
              onChange={(e) => update({ primaryColor: e.target.value })}
              placeholder="#2563eb"
              className="font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accent-color">Accent Color</Label>
          <div className="flex items-center gap-2">
            <input
              id="accent-color"
              type="color"
              value={data.accentColor}
              onChange={(e) => update({ accentColor: e.target.value })}
              className="h-9 w-14 cursor-pointer rounded border border-input"
            />
            <Input
              value={data.accentColor}
              onChange={(e) => update({ accentColor: e.target.value })}
              placeholder="#64748b"
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Estimate Header Style</Label>
        <div className="grid grid-cols-3 gap-3">
          {HEADER_STYLES.map((style) => (
            <button
              key={style.value}
              type="button"
              onClick={() => update({ estimateHeaderStyle: style.value })}
              className={`rounded-lg border-2 p-3 text-left transition-all ${
                data.estimateHeaderStyle === style.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{style.label}</span>
                {data.estimateHeaderStyle === style.value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{style.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Live document preview strip */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Document Preview</p>
        <div className="rounded border bg-white p-3 shadow-sm text-xs">
          <div
            className="flex items-center justify-between rounded px-3 py-2 mb-2"
            style={{ backgroundColor: data.primaryColor + "20", borderLeft: `3px solid ${data.primaryColor}` }}
          >
            <span className="font-bold" style={{ color: data.primaryColor }}>
              {data.name || "Business Name"}
            </span>
            <span style={{ color: data.accentColor }} className="font-medium">ESTIMATE #{data.estimatePrefix || "EST"}-{data.estimateStartNumber || "1001"}</span>
          </div>
          <div className="text-muted-foreground">
            <p>Customer Name</p>
            <p className="text-[10px]">customer@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Financial Settings ───────────────────────────────────────────────

function Step4Financial({ data, update }: { data: WizardData; update: (u: Partial<WizardData>) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Default Currency</Label>
          <Select value={data.currency} onValueChange={(v) => update({ currency: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tax-rate">Default Tax Rate (%)</Label>
          <Input
            id="tax-rate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="0"
            value={data.taxRate}
            onChange={(e) => update({ taxRate: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="est-prefix">Estimate Number Prefix</Label>
          <Input
            id="est-prefix"
            placeholder="EST"
            value={data.estimatePrefix}
            onChange={(e) => update({ estimatePrefix: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="est-start">Starting Number</Label>
          <Input
            id="est-start"
            type="number"
            min="1"
            placeholder="1001"
            value={data.estimateStartNumber}
            onChange={(e) => update({ estimateStartNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="inv-prefix">Invoice Number Prefix</Label>
          <Input
            id="inv-prefix"
            placeholder="INV"
            value={data.invoicePrefix}
            onChange={(e) => update({ invoicePrefix: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-start">Starting Number</Label>
          <Input
            id="inv-start"
            type="number"
            min="1"
            placeholder="1001"
            value={data.invoiceStartNumber}
            onChange={(e) => update({ invoiceStartNumber: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Default Payment Terms</Label>
          <Select value={data.defaultPaymentTerms} onValueChange={(v) => update({ defaultPaymentTerms: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERMS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="exp-days">Default Estimate Expiration (days)</Label>
          <Input
            id="exp-days"
            type="number"
            min="1"
            placeholder="30"
            value={data.defaultExpirationDays}
            onChange={(e) => update({ defaultExpirationDays: e.target.value })}
          />
        </div>
      </div>

      <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Example</p>
        <p>Estimate Prefix: <span className="font-mono">{data.estimatePrefix || "EST"}</span> — Starting: <span className="font-mono">{data.estimateStartNumber || "1001"}</span></p>
        <p>Invoice Prefix: <span className="font-mono">{data.invoicePrefix || "INV"}</span> — Starting: <span className="font-mono">{data.invoiceStartNumber || "1001"}</span></p>
        <p>Default Expiration: <span className="font-mono">{data.defaultExpirationDays || "30"} days</span></p>
      </div>
    </div>
  );
}

// ─── Step 5: Estimate Defaults ────────────────────────────────────────────────

interface Step5Props {
  data: WizardData;
  update: (u: Partial<WizardData>) => void;
  onSubmit: (andCreateEstimate: boolean) => void;
  submitting: boolean;
}

function Step5Defaults({ data, update, onSubmit, submitting }: Step5Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="default-note">Default Customer Note</Label>
        <Textarea
          id="default-note"
          rows={3}
          placeholder="Thank you for your business…"
          value={data.defaultCustomerNote}
          onChange={(e) => update({ defaultCustomerNote: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="default-terms">Default Terms and Conditions</Label>
        <Textarea
          id="default-terms"
          rows={4}
          placeholder="Payment is due within 30 days of the estimate acceptance…"
          value={data.defaultTermsAndConditions}
          onChange={(e) => update({ defaultTermsAndConditions: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="default-deposit">Default Deposit Requirement (%)</Label>
          <Input
            id="default-deposit"
            type="number"
            min="0"
            max="100"
            placeholder="25"
            value={data.defaultDepositPercent}
            onChange={(e) => update({ defaultDepositPercent: e.target.value })}
          />
        </div>
        <div className="flex flex-col justify-end pb-0.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id="default-taxable"
              checked={data.defaultTaxableStatus}
              onCheckedChange={(checked) => update({ defaultTaxableStatus: Boolean(checked) })}
            />
            <Label htmlFor="default-taxable" className="cursor-pointer font-normal">
              Items are taxable by default
            </Label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t">
        <Button
          className="w-full"
          onClick={() => onSubmit(true)}
          disabled={submitting}
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating business…</>
          ) : (
            "Create Business and Make First Estimate"
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onSubmit(false)}
          disabled={submitting}
        >
          Create Business
        </Button>
      </div>
    </div>
  );
}
