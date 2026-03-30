import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
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
              <Input defaultValue="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input defaultValue="john@contractor.com" />
            </div>
          </div>
          <Button size="sm">Save Profile</Button>
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
              <Input defaultValue="John Doe Consulting" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input defaultValue="+1 (555) 123-4567" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Business Address</Label>
            <Input defaultValue="123 Main St, Suite 100, New York, NY 10001" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Payment Instructions</Label>
            <Textarea defaultValue="Bank Transfer: First National Bank, Acct #12345678, Routing #987654321" className="resize-none" />
          </div>
          <Button size="sm">Save Business Info</Button>
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
              <Select defaultValue="usd">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD ($)</SelectItem>
                  <SelectItem value="eur">EUR (€)</SelectItem>
                  <SelectItem value="gbp">GBP (£)</SelectItem>
                  <SelectItem value="cad">CAD (C$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date Format</Label>
              <Select defaultValue="mdy">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                  <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                  <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default Invoice Notes</Label>
            <Textarea defaultValue="Payment due within 15 days of invoice date. Thank you for your business." className="resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email Template (Default Body)</Label>
            <Textarea
              className="resize-none min-h-[100px]"
              defaultValue="Hello, attached is my invoice for services rendered during the selected billing period. Please let me know if anything else is needed. Thank you."
            />
          </div>
          <Button size="sm">Save Defaults</Button>
        </CardContent>
      </Card>
    </div>
  );
}
