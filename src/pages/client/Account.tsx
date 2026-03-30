import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/appStore";

export default function ClientAccount() {
  const { toast } = useToast();
  const currentUser = useAppStore((state) => state.currentUser);
  const updateCurrentUser = useAppStore((state) => state.updateCurrentUser);
  const isReadonly = currentUser.role === "client_viewer";
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);

  useEffect(() => {
    setName(currentUser.name);
    setEmail(currentUser.email);
  }, [currentUser.email, currentUser.name]);

  return (
    <div className="space-y-6 max-w-lg">
      <div className="page-header">
        <h1 className="page-title">Account</h1>
        <p className="page-subtitle">Manage your login and contact details.</p>
      </div>

      {isReadonly ? <div className="readonly-banner">Viewer mode: profile editing is disabled.</div> : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} disabled={isReadonly} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={(event) => setEmail(event.target.value)} disabled={isReadonly} className={isReadonly ? "bg-muted" : ""} />
          </div>
          <Button
            size="sm"
            disabled={isReadonly}
            onClick={() => {
              updateCurrentUser({ name, email });
              toast({ title: "Profile updated", description: "Account profile changes were saved." });
            }}
          >
            Update Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Current Password</Label>
            <Input type="password" disabled placeholder="Managed by authentication backend" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">New Password</Label>
            <Input type="password" disabled placeholder="Managed by authentication backend" />
          </div>
          <Button
            size="sm"
            disabled
            onClick={() => {
              toast({ title: "Unavailable", description: "Password updates require backend authentication." });
            }}
          >
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
