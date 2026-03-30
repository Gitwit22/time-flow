import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { loginWithCredentials, toAppIdentity } from "@/lib/auth";
import { useAppStore } from "@/store/appStore";

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!loginId.trim() || !password.trim()) {
      toast({ title: "Missing fields", description: "Enter your login and password." });
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await loginWithCredentials(loginId, password);
      syncCurrentUser(toAppIdentity(user));
      navigate(user.role === "contractor" ? "/admin" : "/client", { replace: true });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Sign in failed.";
      toast({ title: "Unable to sign in", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-primary mb-3">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <CardTitle className="font-heading text-xl">Sign In</CardTitle>
          <p className="text-sm text-muted-foreground">Welcome back to TimeFlow</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Email or Invite Code</Label>
            <Input value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="you@email.com or TF-XXXXXX" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Password</Label>
            </div>
            <Input type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleSignIn} disabled={isSubmitting}>
            {isSubmitting ? "Signing In..." : "Sign In"}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            <span>Don't have an account? </span>
            <Link to="/signup" className="text-accent hover:underline font-medium">Get Started</Link>
          </div>
          <div className="text-center">
            <Link to="/invite" className="text-xs text-muted-foreground hover:underline">Continue as Client Viewer →</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
