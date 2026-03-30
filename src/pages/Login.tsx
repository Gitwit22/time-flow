import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export default function Login() {
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
            <Label className="text-xs">Email</Label>
            <Input type="email" placeholder="you@email.com" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Password</Label>
              <Link to="#" className="text-xs text-accent hover:underline">Forgot Password?</Link>
            </div>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/admin">Sign In</Link>
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
