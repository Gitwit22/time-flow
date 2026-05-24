import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { establishAuthSession } from "@/lib/auth";
import { apiAcceptInvite, apiGetInviteInfo } from "@/lib/timeflowApi";
import { useAppStore } from "@/store/appStore";

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const syncCurrentUser = useAppStore((state) => state.syncCurrentUser);
  const markAuthenticated = useAppStore((state) => state.markAuthenticated);
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi);

  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    organizationName: string;
    email: string;
    name?: string;
    role: string;
    expiresAt: string;
  } | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setInviteError("Missing invite token.");
      setLoading(false);
      return;
    }

    let active = true;
    void apiGetInviteInfo(token)
      .then((invite) => {
        if (!active) return;
        setInviteInfo(invite);
        setDisplayName(invite.name || "");
        setEmail(invite.email || "");
      })
      .catch((error) => {
        if (!active) return;
        setInviteError(error instanceof Error ? error.message : "Failed to load invite details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const expiresLabel = useMemo(() => {
    if (!inviteInfo?.expiresAt) return null;
    const date = new Date(inviteInfo.expiresAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }, [inviteInfo?.expiresAt]);

  const handleSubmit = async () => {
    if (!token || !email.trim() || !password.trim()) {
      setInviteError("Email and password are required.");
      return;
    }

    setInviteError(null);
    setSubmitting(true);

    try {
      const response = await apiAcceptInvite({
        token,
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });

      const user = establishAuthSession(response.token, response.user as {
        id: string;
        email: string;
        displayName?: string;
        role: string;
        organizationId?: string;
      });

      syncCurrentUser({
        id: user.id,
        name: user.name,
        email: user.loginId,
        role: user.role,
      });
      markAuthenticated();
      await hydrateFromApi();
      navigate("/platform", { replace: true });
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Failed to accept invite.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Accept Workspace Invite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Loading invite details...</p> : null}

          {!loading && inviteInfo ? (
            <>
              <div className="rounded-md border p-3 text-sm">
                <p>
                  You were invited to join <strong>{inviteInfo.organizationName}</strong> in Time Flow.
                </p>
                <p className="text-muted-foreground mt-1">Role: {inviteInfo.role}</p>
                {expiresLabel ? <p className="text-muted-foreground mt-1">This link expires on {expiresLabel}.</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
              </div>

              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
              </div>

              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}

              <Button className="w-full" onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting ? "Joining workspace..." : "Accept Invite"}
              </Button>
            </>
          ) : null}

          {!loading && inviteError && !inviteInfo ? <p className="text-sm text-destructive">{inviteError}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
