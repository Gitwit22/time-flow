import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";

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

  useEffect(() => {
    setProfileName(currentUser.name);
    setProfileEmail(currentUser.email);
    setBusinessName(settings.businessName);
    setPaymentInstructions(settings.paymentInstructions);
    setInvoiceNotes(settings.invoiceNotes);
    setEmailTemplate(settings.emailTemplate);
  }, [currentUser.email, currentUser.name, settings.businessName, settings.emailTemplate, settings.invoiceNotes, settings.paymentInstructions]);

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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Hourly Rate</Label>
              <Input
                type="number"
                value={currentUser.hourlyRate}
                onChange={(event) => updateCurrentUser({ hourlyRate: Number(event.target.value || 0) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Invoice Due Days</Label>
              <Input
                type="number"
                value={currentUser.invoiceDueDays}
                onChange={(event) => updateCurrentUser({ invoiceDueDays: Number(event.target.value || 0) })}
              />
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
              updateCurrentUser({ name: profileName, email: profileEmail });
              toast({ title: "Profile saved", description: "Your profile settings were updated." });
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
