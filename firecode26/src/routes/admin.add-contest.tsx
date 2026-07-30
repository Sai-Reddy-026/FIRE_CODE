import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/site/AppShell";
import { AddContestWizard } from "@/components/admin/AddContestWizard";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/admin/add-contest")({
  head: () => ({
    meta: [
      { title: "Add Contest Wizard — FireCode Admin" },
      {
        name: "description",
        content: "Create and publish new algorithm contests using the multi-step wizard.",
      },
    ],
  }),
  component: AdminAddContestPage,
});

function AdminAddContestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    } else if (user && user.role !== "admin") {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  if (user && user.role !== "admin") {
    return null;
  }

  return (
    <AppShell>
      <AddContestWizard />
    </AppShell>
  );
}
