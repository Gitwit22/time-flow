import { Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";

export default function InviteAcceptance() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-lg bg-primary mb-3">
            <Users className="h-5 w-5 text-primary-foreground" />
          </div>
          <CardTitle className="font-heading text-xl">You've Been Invited</CardTitle>
          <p className="text-sm text-muted-foreground">John Doe has invited you to view their work logs and invoices on TimeFlow.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Your Name</Label>
            <Input placeholder="Sarah Johnson" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" defaultValue="sarah@acme.com" readOnly className="bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Create Password</Label>
            <Input type="password" placeholder="••••••••" />
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/client">Accept & View Work Logs</Link>
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
