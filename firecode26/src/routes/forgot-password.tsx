import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { api } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — FireCode" },
      { name: "description", content: "Reset your FireCode account password." },
      { property: "og:title", content: "Reset password — FireCode" },
      { property: "og:description", content: "We'll email you a reset link." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      await api.post("/accounts/forgot-password", { email });
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  };

  if (status === "sent") {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If an account with that email exists, a password reset link has been sent. Check your inbox (and spam folder)."
        footer={
          <Link to="/login" className="font-medium text-foreground hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
          Password reset email sent successfully.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-medium text-foreground hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            placeholder="you@firecode.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === "loading"}
          />
        </div>
        {status === "error" && <p className="text-sm text-red-400">{errorMsg}</p>}
        <Button
          type="submit"
          className="w-full ember-gradient text-primary-foreground border-0 hover:brightness-110"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
