import { ChangeEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { updateActiveUserProfile } from "@/lib/auth";
import { useAppStore } from "@/store/appStore";

const MAX_BRANDING_FILE_BYTES = 750 * 1024;

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const settings = useAppStore((state) => state.settings);
  const clients = useAppStore((state) => state.clients);
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const resetApp = useAppStore((state) => state.resetApp);

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [emailTemplate, setEmailTemplate] = useState("");
  const [invoiceLogoDataUrl, setInvoiceLogoDataUrl] = useState<string | undefined>(undefined);
  const [invoiceBannerDataUrl, setInvoiceBannerDataUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    setProfileName(currentUser.name);
    setProfileEmail(currentUser.email);
    setBusinessName(settings.businessName);
    setPaymentInstructions(settings.paymentInstructions);
    setInvoiceNotes(settings.invoiceNotes);
    setEmailTemplate(settings.emailTemplate);
    setInvoiceLogoDataUrl(settings.invoiceLogoDataUrl);
    setInvoiceBannerDataUrl(settings.invoiceBannerDataUrl);
  }, [
    currentUser.email,
    currentUser.name,
    settings.businessName,
    settings.emailTemplate,
    settings.invoiceBannerDataUrl,
    settings.invoiceLogoDataUrl,
    settings.invoiceNotes,
    settings.paymentInstructions,
  ]);

  async function handleBrandingAssetChange(event: ChangeEvent<HTMLInputElement>, asset: "logo" | "banner") {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please upload a PNG, JPG, WEBP, or SVG image.", variant: "destructive" });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_BRANDING_FILE_BYTES) {
      toast({
        title: "Image too large",
        description: "Use an image smaller than 750 KB so it can be stored reliably in the browser.",
        variant: "destructive",
      });
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readImageAsDataUrl(file);
      if (asset === "logo") {
        setInvoiceLogoDataUrl(dataUrl);
      } else {
        setInvoiceBannerDataUrl(dataUrl);
      }
      toast({ title: `${asset === "logo" ? "Logo" : "Banner"} loaded`, description: "Save branding to apply it to invoice downloads." });
    } catch {
      toast({ title: "Upload failed", description: "The image could not be loaded. Try a different file.", variant: "destructive" });
    }

    event.target.value = "";
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your profile, business info, and defaults.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} />
            </div>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Changing your email updates your login ID for future sign-ins. Your current password stays the same.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice Due Days</Label>
              <Input
                type="number"
                value={currentUser.invoiceDueDays}
                onChange={(event) => updateCurrentUser({ invoiceDueDays: Number(event.target.value || 0) })}
              />
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Client billing rates are managed on each client record.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice Frequency</Label>
              <Select
                value={currentUser.invoiceFrequency}
                onValueChange={(value) => updateCurrentUser({ invoiceFrequency: value as typeof currentUser.invoiceFrequency })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Biweekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default Client</Label>
              <Select value={settings.defaultClientId ?? "none"} onValueChange={(value) => updateSettings({ defaultClientId: value === "none" ? undefined : value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              try {
                const previousLoginId = currentUser.email;
                const updatedUser = updateActiveUserProfile({
                  name: profileName,
                  loginId: profileEmail,
                });

                updateCurrentUser({ name: updatedUser.name, email: updatedUser.loginId });

                const loginChanged = previousLoginId !== updatedUser.loginId;
                toast({
                  title: "Profile saved",
                  description: loginChanged
                    ? "Your login email was updated. Use the new email next time you sign in."
                    : "Your profile settings were updated.",
                });
              } catch (error) {
                const description = error instanceof Error ? error.message : "Unable to save profile settings.";
                toast({ title: "Unable to save profile", description, variant: "destructive" });
              }
            }}
          >
            Save Profile
          </Button>
        </CardContent>
      </Card>

      {/* Business Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Business Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Business Name</Label>
              <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Company Viewer Access</Label>
              <Select
                value={settings.companyViewerAccess ? "enabled" : "disabled"}
                onValueChange={(value) => updateSettings({ companyViewerAccess: value === "enabled" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">Enabled</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Instructions</Label>
            <Textarea value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} className="resize-none" />
          </div>
          <Button
            size="sm"
            onClick={() => {
              updateSettings({ businessName, paymentInstructions });
              toast({ title: "Business info saved", description: "Business settings were updated." });
            }}
          >
            Save Business Info
          </Button>
        </CardContent>
      </Card>

      {/* Invoice Defaults */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Invoice Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value="usd" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Timezone</Label>
              <Select value="local" disabled>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local Browser Timezone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default Invoice Notes</Label>
            <Textarea value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email Template (Default Body)</Label>
            <Textarea className="resize-none min-h-[100px]" value={emailTemplate} onChange={(event) => setEmailTemplate(event.target.value)} />
          </div>
          <Button
            size="sm"
            onClick={() => {
              updateSettings({ invoiceNotes, emailTemplate });
              toast({ title: "Defaults saved", description: "Invoice defaults were updated." });
            }}
          >
            Save Defaults
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Invoice Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Add a logo and optional banner image to the printable invoice. Images are stored locally in this browser, so keep them under 750 KB each.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Logo</Label>
                <Input type="file" accept="image/*" onChange={(event) => void handleBrandingAssetChange(event, "logo")} />
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 min-h-28 flex items-center justify-center">
                {invoiceLogoDataUrl ? <img src={invoiceLogoDataUrl} alt="Invoice logo preview" className="max-h-16 max-w-full object-contain" /> : <p className="text-sm text-muted-foreground">No logo uploaded</p>}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setInvoiceLogoDataUrl(undefined)} disabled={!invoiceLogoDataUrl}>
                Remove Logo
              </Button>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Banner</Label>
                <Input type="file" accept="image/*" onChange={(event) => void handleBrandingAssetChange(event, "banner")} />
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 min-h-28 flex items-center justify-center overflow-hidden">
                {invoiceBannerDataUrl ? <img src={invoiceBannerDataUrl} alt="Invoice banner preview" className="max-h-24 w-full object-cover rounded-md" /> : <p className="text-sm text-muted-foreground">No banner uploaded</p>}
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setInvoiceBannerDataUrl(undefined)} disabled={!invoiceBannerDataUrl}>
                Remove Banner
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              updateSettings({ invoiceLogoDataUrl, invoiceBannerDataUrl });
              toast({ title: "Branding saved", description: "Invoice downloads will use your current logo and banner." });
            }}
          >
            Save Branding
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Data Reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Clear all local TimeFlow data and return to a fresh state.</p>
          <Button
            variant="destructive"
            onClick={() => {
              const confirmed = window.confirm("Reset all app data on this browser? This cannot be undone.");
              if (!confirmed) {
                return;
              }

              resetApp();
              toast({ title: "App reset", description: "Local app data was cleared and reinitialized." });
            }}
          >
            Reset App Data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
