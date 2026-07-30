import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — FireCode" },
      { name: "description", content: "Set a new password for your FireCode account." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <AuthShell
        title="Invalid reset link"
        subtitle="This password reset link is missing a token. Please request a new one."
        footer={
          <Link to="/forgot-password" className="font-medium text-foreground hover:underline">
            Request new link
          </Link>
        }
      >
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          The reset token is missing or malformed.
        </div>
      </AuthShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    const re = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
    if (!re.test(password)) {
      setErrorMsg("Password must be at least 8 characters with a letter and number.");
      return;
    }
    setStatus("loading");
    try {
      await api.post("/accounts/reset-password", { token, newPassword: password });
      setStatus("success");
      setTimeout(() => navigate({ to: "/login" }), 2500);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Reset link is invalid or expired. Please request a new one.");
    }
  };

  if (status === "success") {
    return (
      <AuthShell
        title="Password updated"
        subtitle="Your password has been reset. All other sessions have been signed out."
        footer={
          <Link to="/login" className="font-medium text-foreground hover:underline">
            Sign in now
          </Link>
        }
      >
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          Redirecting to login page…
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set new password"
      subtitle="Choose a strong password. All your other sessions will be signed out."
      footer={
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="new-pw">New password</Label>
          <Input
            id="new-pw"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={status === "loading"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-pw">Confirm password</Label>
          <Input
            id="confirm-pw"
            type="password"
            placeholder="Repeat your new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            disabled={status === "loading"}
          />
        </div>
        {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
        <Button
          type="submit"
          className="w-full ember-gradient text-primary-foreground border-0 hover:brightness-110"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
