import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AuthShell } from "@/components/site/AuthShell";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Authenticating — FireCode" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const err = params.get("error");

    if (err) {
      setError(decodeURIComponent(err));
      return;
    }

    if (!code) {
      setError("OAuth authentication returned no temporary code.");
      return;
    }

    async function exchangeToken() {
      try {
        const res = await api.post<{
          success: boolean;
          token: string;
          refreshToken: string;
          id: string;
          username: string;
          role: "user" | "admin";
        }>("/accounts/auth/exchange", { code });

        // BUG-04 FIX: Pass refreshToken from OAuth exchange so OAuth users
        // receive session persistence equal to email/password users.
        // Previously refreshToken was never generated for OAuth — users were
        // permanently logged out after 7 days with no way to silently refresh.
        login(res.token, { id: res.id, username: res.username, role: res.role }, res.refreshToken);
        navigate({ to: "/dashboard" });
      } catch (e: any) {
        if (e instanceof ApiError) {
          setError(e.message);
        } else {
          setError("OAuth token exchange failed.");
        }
      }
    }

    exchangeToken();
  }, [login, navigate]);

  return (
    <AuthShell
      title="Completing authentication"
      subtitle="Connecting your account..."
      footer={<></>}
    >
      <div className="p-6 text-center text-sm">
        {error ? (
          <div className="space-y-4">
            <p className="text-destructive font-medium">{error}</p>
            <a
              href="/login"
              className="inline-block text-xs text-muted-foreground hover:text-foreground underline"
            >
              Return to sign in
            </a>
          </div>
        ) : (
          <p className="text-muted-foreground">Redirecting to your workspace...</p>
        )}
      </div>
    </AuthShell>
  );
}
