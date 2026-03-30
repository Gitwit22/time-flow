import { useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { registerContractor, toAppIdentity } from "@/lib/auth";
import { useAppStore } from "@/store/appStore";

export default function SignUp() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateAccount = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      toast({ title: "Missing fields", description: "Complete all account fields." });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Password mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await registerContractor(name, email, password);
      syncCurrentUser(toAppIdentity(user));
      toast({ title: "Account created", description: "Your contractor workspace is ready." });
      navigate("/admin", { replace: true });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Account creation failed.";
      toast({ title: "Unable to create account", description, variant: "destructive" });
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
          <CardTitle className="font-heading text-xl">Get Started</CardTitle>
          <p className="text-sm text-muted-foreground">Create your workspace to start tracking time and generating invoices.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Full Name</Label>
            <Input placeholder="John Doe" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email (Login)</Label>
            <Input type="email" placeholder="you@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input type="password" placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm Password</Label>
            <Input type="password" placeholder="••••••••" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleCreateAccount} disabled={isSubmitting}>
            {isSubmitting ? "Creating Account..." : "Create Account"}
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
