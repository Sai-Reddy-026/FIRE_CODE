import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, Chrome } from "lucide-react";
import { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — FireCode" },
      {
        name: "description",
        content: "Create your free FireCode account and start solving curated problems today.",
      },
      { property: "og:title", content: "Create account — FireCode" },
      { property: "og:description", content: "Join 180,000+ engineers on FireCode." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please provide a valid email address.");
      return;
    }
    // BUG-16 FIX: Frontend password validation aligned with backend (8+ chars, letter + digit).
    // Previously validated >= 6 chars — backend requires >= 8 with at least one letter AND one digit.
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      setError("Password must be at least 8 characters with at least one letter and one digit.");
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
      }>("/accounts/signup", { username, email, password });
      // BUG-16 FIX: Pass refreshToken so silent token refresh works after signup.
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
      title="Create your account"
      subtitle="Free forever for the core problem set."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-foreground hover:underline">
            Sign in
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
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg> Google
        </Button>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="name">Username</Label>
          <Input
            id="name"
            placeholder="ada.lovelace"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@firecode.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">8+ characters, at least one letter and one number.</p>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          className="w-full ember-gradient text-primary-foreground border-0 hover:brightness-110"
          disabled={loading}
        >
          {loading ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <a className="underline hover:text-foreground" href="#">
            Terms
          </a>{" "}
          and{" "}
          <a className="underline hover:text-foreground" href="#">
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </AuthShell>
  );
}
