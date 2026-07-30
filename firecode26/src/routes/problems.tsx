import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/problems")({
  component: ProblemsLayout,
});

function ProblemsLayout() {
  return <Outlet />;
}
