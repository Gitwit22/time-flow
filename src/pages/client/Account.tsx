import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ClientAccount() {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="page-header">
        <h1 className="page-title">Account</h1>
        <p className="page-subtitle">Manage your login and contact details.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input defaultValue="Sarah Johnson" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input defaultValue="sarah@acme.com" readOnly className="bg-muted" />
          </div>
          <Button size="sm">Update Profile</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Current Password</Label>
            <Input type="password" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">New Password</Label>
            <Input type="password" />
          </div>
          <Button size="sm">Update Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}
