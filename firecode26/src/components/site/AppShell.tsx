import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  ListChecks,
  Trophy,
  User2,
  Settings,
  Bell,
  Search,
  Shield,
  Users,
  Code2,
  BarChart3,
  History,
  Menu,
  LogOut,
  Flame,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ActivityData {
  solved_dates: string[];
  current_streak: number;
  longest_streak: number;
  today_count: number;
  week_count: number;
  month_count: number;
  total_solved: number;
}

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/problems", label: "Problems", icon: ListChecks },
  { to: "/contests", label: "Contests", icon: Trophy },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User2 },
];

const adminItems = [
  { to: "/admin", label: "Admin Console", icon: Shield },
  { to: "/admin/users", label: "Users Management", icon: Users },
  { to: "/admin/problems", label: "Problems CRUD", icon: Code2 },
  { to: "/admin/contests", label: "Contests CRUD", icon: Trophy },
  { to: "/admin/analytics", label: "System Analytics", icon: BarChart3 },
  { to: "/admin/logs", label: "Audit Logs", icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const userId = user?.id ?? "";
  const isAdmin = user?.role === "admin";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: activity } = useQuery<ActivityData>({
    queryKey: ["activity", userId],
    queryFn: () => api.get<ActivityData>(`/problem/activity/${userId}`),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const currentStreak = activity?.current_streak ?? 0;
  const longestStreak = activity?.longest_streak ?? 0;
  const avatarInitial = user?.username ? user.username.charAt(0).toUpperCase() : "U";

  const renderNavLinks = (onNavigate?: () => void) => (
    <>
      <div className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            activeProps={{
              className:
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold bg-accent text-foreground shadow-sm",
            }}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{label}</span>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <div className="pt-6">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Admin Controls
          </div>
          <div className="space-y-1">
            {adminItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                activeProps={{
                  className:
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold bg-accent text-foreground shadow-sm",
                }}
              >
                <Icon className="h-4 w-4 shrink-0 text-[color:var(--color-ember)]" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground antialiased selection:bg-primary/20">
      <div className="mx-auto flex max-w-[1440px]">
        {/* Desktop Sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between border-r border-border/60 p-4 lg:flex overflow-y-auto">
          <div>
            <Logo />
            <nav className="mt-8">{renderNavLinks()}</nav>
          </div>

          <div className="mt-8 space-y-3">
            <div className="rounded-xl border border-border/60 bg-card/60 p-3.5 backdrop-blur">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-[color:var(--color-ember)]" /> Daily Streak
                </span>
                <span className="text-[10px] text-muted-foreground">Best: {longestStreak}d</span>
              </div>
              <div className="mt-1.5 font-display text-2xl font-bold ember-text">
                {currentStreak} Days
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full ember-gradient text-xs font-bold text-primary-foreground">
                  {avatarInitial}
                </div>
                <div className="truncate text-xs">
                  <div className="truncate font-semibold text-foreground">{user?.username}</div>
                  <div className="truncate text-muted-foreground capitalize">{user?.role}</div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                title="Sign out"
                aria-label="Sign out"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content & Header */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile Drawer Trigger */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Toggle navigation menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-4">
                  <SheetHeader className="text-left mb-4">
                    <SheetTitle>
                      <Logo />
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex h-[calc(100vh-6rem)] flex-col justify-between overflow-y-auto">
                    <nav>{renderNavLinks(() => setMobileMenuOpen(false))}</nav>
                    <div className="pt-4 border-t border-border/60">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          logout();
                        }}
                        className="w-full justify-start gap-2 text-destructive"
                      >
                        <LogOut className="h-4 w-4" /> Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="lg:hidden">
                <Logo />
              </div>
            </div>

            <div className="relative hidden max-w-md flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search problems, contests, users..."
                className="pl-9 bg-card/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                className="text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
              </Button>
              <Link to="/profile" aria-label="Open profile">
                <div className="grid h-9 w-9 place-items-center rounded-full ember-gradient text-sm font-bold text-primary-foreground shadow-md transition hover:scale-105">
                  {avatarInitial}
                </div>
              </Link>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-4rem)]">{children}</main>
        </div>
      </div>
    </div>
  );
}
