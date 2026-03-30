import { useState } from "react";
import { Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { acceptViewerInvite, toAppIdentity } from "@/lib/auth";
import { useAppStore } from "@/store/appStore";

export default function InviteAcceptance() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState((searchParams.get("code") || "").toUpperCase());
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAcceptInvite = async () => {
    if (!inviteCode.trim() || !name.trim() || !password.trim()) {
      toast({ title: "Missing fields", description: "Enter invite code, name, and password." });
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await acceptViewerInvite(inviteCode, name, password);
      syncCurrentUser(toAppIdentity(user));
      toast({ title: "Invite accepted", description: "Viewer access has been enabled for your account." });
      navigate("/client", { replace: true });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Could not accept invite.";
      toast({ title: "Invite failed", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-primary mb-3">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <CardTitle className="font-heading text-xl">You've Been Invited</CardTitle>
          <p className="text-sm text-muted-foreground">Use your invite code to create viewer access and review company logs and invoices.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Invite Code</Label>
            <Input placeholder="TF-XXXXXXXX" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Your Name</Label>
            <Input placeholder="Jane Smith" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Create Password</Label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleAcceptInvite} disabled={isSubmitting}>
            {isSubmitting ? "Accepting Invite..." : "Accept & View Work Logs"}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            <span>Already have an account? </span>
            <Link to="/login" className="text-accent hover:underline font-medium">Sign In</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
