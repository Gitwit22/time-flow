import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export default function SignUp() {
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
            <Input placeholder="John Doe" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" placeholder="you@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/admin">Create Account</Link>
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
