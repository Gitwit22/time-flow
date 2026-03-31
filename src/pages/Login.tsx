import { useState } from "react";
import { AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { clearAuthState, getViewerClientIdForUser, loginWithCredentials, toAppIdentity } from "@/lib/auth";
import { useAppStore } from "@/store/appStore";

export default function Login() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const setViewerClientContext = useAppStore((state) => state.setViewerClientContext);
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const handleSignIn = async () => {
    if (!loginId.trim() || !password.trim()) {
      toast({ title: "Missing fields", description: "Enter your login and password." });
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await loginWithCredentials(loginId, password);
      setViewerClientContext(user.role === "client_viewer" ? getViewerClientIdForUser(user.id) : undefined, user.role === "client_viewer");
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
          <div className="border-t pt-3">
            <button
              type="button"
              className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
              onClick={() => setShowRecovery((v) => !v)}
            >
              {showRecovery ? "Hide account recovery" : "Can't access your account?"}
            </button>
            {showRecovery ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>This will clear your login credentials. Your app data (clients, invoices, etc.) is stored separately and will not be lost.</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
                  onClick={() => {
                    clearAuthState();
                    toast({ title: "Login credentials cleared", description: "You can now create a new account with a fresh password." });
                    navigate("/signup", { replace: true });
                  }}
                >
                  Reset credentials and re-register
                </Button>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
