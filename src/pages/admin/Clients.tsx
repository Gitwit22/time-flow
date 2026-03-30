import { Plus, Pencil, Mail, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const clients = [
  {
    id: 1,
    name: "Acme Corp",
    contact: "Sarah Johnson",
    email: "billing@acme.com",
    rate: 150,
    frequency: "Monthly",
    nextInvoice: "Apr 1, 2026",
    portalAccess: true,
  },
  {
    id: 2,
    name: "Beta Inc",
    contact: "Michael Chen",
    email: "accounts@beta.io",
    rate: 125,
    frequency: "Biweekly",
    nextInvoice: "Apr 7, 2026",
    portalAccess: false,
  },
];

export default function Clients() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your clients, rates, and portal access.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-heading">Add New Client</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Company Name</Label>
                  <Input placeholder="Acme Corp" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Person</Label>
                  <Input placeholder="Jane Doe" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Billing Email</Label>
                  <Input type="email" placeholder="billing@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Hourly Rate ($)</Label>
                  <Input type="number" placeholder="150" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice Frequency</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Biweekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Project / Work Type</Label>
                  <Input placeholder="Software Development" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Textarea placeholder="Invoice terms, special instructions..." className="resize-none" />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Enable Client Portal</p>
                  <p className="text-xs text-muted-foreground">Allow client to view time logs & invoices</p>
                </div>
                <Switch />
              </div>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">Save Client</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clients.map((client) => (
          <Card key={client.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-heading font-semibold text-lg">{client.name}</h3>
                  <p className="text-sm text-muted-foreground">{client.contact}</p>
                </div>
                <div className="flex items-center gap-1">
                  {client.portalAccess && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Eye className="h-3 w-3" /> Portal Active
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div>
                  <p className="text-muted-foreground text-xs">Rate</p>
                  <p className="font-medium">${client.rate}/hr</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Frequency</p>
                  <p className="font-medium">{client.frequency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Next Invoice</p>
                  <p className="font-medium">{client.nextInvoice}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <p className="font-medium truncate">{client.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="mr-1.5 h-3.5 w-3.5" /> Invite Viewer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
