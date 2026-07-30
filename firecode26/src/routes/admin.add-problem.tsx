import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/site/AppShell";
import { AddProblemWizard } from "@/components/admin/AddProblemWizard";
import { useAuth } from "@/context/AuthContext";
import { isLoggedIn } from "@/lib/auth";

export const Route = createFileRoute("/admin/add-problem")({
  head: () => ({
    meta: [
      { title: "Add Problem Wizard — FireCode Admin" },
      {
        name: "description",
        content: "Create and publish new algorithmic challenges using the multi-step wizard.",
      },
    ],
  }),
  component: AdminAddProblemPage,
});

function AdminAddProblemPage() {
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
      <AddProblemWizard />
    </AppShell>
  );
}
