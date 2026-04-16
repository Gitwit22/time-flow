import { FormEvent, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getActiveUser,
  getViewerClientIdForUser,
  loginWithCredentials,
  registerContractor,
  toAppIdentity,
} from "@/lib/auth";
import { getPlatformSession } from "@/lib/platformApi";
import { useAppStore } from "@/store/appStore";
import { useToast } from "@/hooks/use-toast";

type LoginTab = "signin" | "signup";

function getNextPath(role: "contractor" | "client_viewer") {
  return role === "client_viewer" ? "/client" : "/platform";
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const setViewerClientContext = useAppStore((state) => state.setViewerClientContext);
  const markAuthenticated = useAppStore((state) => state.markAuthenticated);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);

  const existingPlatformSession = getPlatformSession();
  const existingLocalUser = getActiveUser();

  const initialTab: LoginTab = useMemo(() => {
    const mode = (searchParams.get("mode") ?? "signin").toLowerCase();
    if (mode === "signup") return "signup";
    return "signin";
  }, [searchParams]);

  const [tab, setTab] = useState<LoginTab>(initialTab);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupLoginId, setSignupLoginId] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromPath =
    (location.state as { from?: string } | null)?.from ??
    getNextPath(existingLocalUser?.role ?? "contractor");

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const user = await loginWithCredentials(loginId, password);
      const identity = toAppIdentity(user);
      syncCurrentUser(identity);
      markAuthenticated();
      setViewerClientContext(
        user.role === "client_viewer" ? getViewerClientIdForUser(user.id) : undefined,
        user.role === "client_viewer",
      );
      await hydrateFromApi();
      navigate(fromPath, { replace: true });
    } catch (error) {
      toast({
        title: "Unable to sign in",
        description: error instanceof Error ? error.message : "Check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const user = await registerContractor(signupName, signupLoginId, signupPassword);
      const identity = toAppIdentity(user);
      syncCurrentUser(identity);
      markAuthenticated();
      setViewerClientContext(undefined, false);
      await hydrateFromApi();
      navigate("/platform", { replace: true });
    } catch (error) {
      toast({
        title: "Unable to create account",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-heading">TimeFlow Login</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in directly to TimeFlow with database-backed sessions. Suite launch tokens are optional.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(value) => setTab(value as LoginTab)} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form className="space-y-4" onSubmit={handleSignIn}>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-login">Email / Login</Label>
                  <Input
                    id="signin-login"
                    value={loginId}
                    onChange={(event) => setLoginId(event.target.value)}
                    placeholder="user@example.com"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form className="space-y-4" onSubmit={handleSignUp}>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    value={signupName}
                    onChange={(event) => setSignupName(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-login">Email / Login</Label>
                  <Input
                    id="signup-login"
                    value={signupLoginId}
                    onChange={(event) => setSignupLoginId(event.target.value)}
                    placeholder="you@company.com"
                    autoComplete="username"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
