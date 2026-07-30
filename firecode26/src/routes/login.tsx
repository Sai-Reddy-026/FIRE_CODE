import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, Chrome } from "lucide-react";
import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — FireCode" },
      {
        name: "description",
        content: "Sign in to FireCode to continue your practice, contests, and submissions.",
      },
      { property: "og:title", content: "Sign in — FireCode" },
      { property: "og:description", content: "Access your FireCode workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:80/api";

  useEffect(() => {
    if (user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameOrEmail.trim()) {
      setError("Email or username is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{
        success: boolean;
        token: string;
        refreshToken: string;
        id: string;
        username: string;
        role: "user" | "admin";
      }>("/accounts/login", {
        username_or_email: usernameOrEmail,
        password,
      });
      // BUG-10 FIX: Pass refreshToken so silent token refresh works after 7-day expiry.
      // Previously this arg was omitted — users on local login could never silently refresh.
      login(res.token, { id: res.id, username: res.username, role: res.role }, res.refreshToken);
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Network error. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="font-medium text-foreground hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="outline"
          className="glass"
          type="button"
          onClick={() => (window.location.href = `${apiBaseUrl}/accounts/auth/github`)}
        >
          <Github className="mr-2 h-4 w-4" /> GitHub
        </Button>
        <Button
          variant="outline"
          className="glass"
          type="button"
          onClick={() => (window.location.href = `${apiBaseUrl}/accounts/auth/google`)}
        >
          <Chrome className="mr-2 h-4 w-4" /> Google
        </Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email or username</Label>
          <Input
            id="email"
            type="text"
            placeholder="you@firecode.dev"
            autoComplete="email"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full ember-gradient text-primary-foreground border-0 hover:brightness-110"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}
