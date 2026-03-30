import { Send, Copy, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default function EmailPrep() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="page-header">
        <h1 className="page-title">Email Prep</h1>
        <p className="page-subtitle">Prepare and send invoices via email.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Composition */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Compose Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input defaultValue="billing@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CC</Label>
              <Input placeholder="Optional CC addresses..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input defaultValue="Invoice INV-2026-003 — John Doe, Mar 2026" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                className="min-h-[200px] resize-none"
                defaultValue={`Hello,

Attached is my invoice for services rendered during March 1–31, 2026.

Invoice #: INV-2026-003
Amount Due: $9,375.00
Due Date: April 15, 2026

Please let me know if you need any additional information or have questions about the charges.

Thank you for your continued partnership.

Best regards,
John Doe
Software Development Contractor
john@contractor.com`}
              />
            </div>
          </CardContent>
        </Card>

        {/* Attachment & Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Attachment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <span className="text-xs font-bold">PDF</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">INV-2026-003.pdf</p>
                  <p className="text-xs text-muted-foreground">128 KB</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                <Copy className="mr-2 h-4 w-4" />
                Copy Email
              </Button>
              <Button variant="outline" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Invoice
              </Button>
              <Separator className="my-2" />
              <Button variant="outline" className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Gmail
              </Button>
              <Button variant="outline" className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in Outlook
              </Button>
              <Separator className="my-2" />
              <Button className="w-full" disabled>
                <Send className="mr-2 h-4 w-4" />
                Send Directly (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
