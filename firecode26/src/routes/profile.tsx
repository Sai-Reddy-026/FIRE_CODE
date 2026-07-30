import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/site/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Flame, Github, Link2, MapPin, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import { useState, useEffect } from "react";
import { EditProfileModal } from "@/components/site/EditProfileModal";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — FireCode" },
      {
        name: "description",
        content: "Your FireCode profile, achievements, rating history, and submission activity.",
      },
      { property: "og:title", content: "Profile — FireCode" },
      { property: "og:description", content: "Your achievements and progress on FireCode." },
    ],
  }),
  component: ProfilePage,
});

interface UserProfile {
  _id: string;
  username: string;
  email?: string;
  display_name?: string;
  bio?: string;
  location?: string;
  company?: string;
  website?: string;
  github?: string;
  linkedin?: string;
  twitter?: string;
  country?: string;
  avatar_url?: string;
  rating?: number;
  rank?: number;
  points?: number;
  total_points_earned?: number;
  problems_solved_count?: number;
  problems_attempted_count?: number;
  solved_dates?: string[];
  longest_streak?: number;
}

interface ActivityData {
  solved_dates: string[];
  current_streak: number;
  longest_streak: number;
  today_count: number;
  week_count: number;
  month_count: number;
  total_solved: number;
}

function ProfilePage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate({ to: "/login" });
    }
  }, [navigate]);

  const { user: authUser } = useAuth();
  const userId = authUser?.id ?? "";
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: profile, refetch: refetchProfile } = useQuery<UserProfile>({
    queryKey: ["profile", userId],
    queryFn: () => api.get<UserProfile>(`/accounts/id/${userId}`),
    enabled: !!userId,
  });

  const { data: activity } = useQuery<ActivityData>({
    queryKey: ["activity", userId],
    queryFn: () => api.get<ActivityData>(`/problem/activity/${userId}`),
    enabled: !!userId,
  });

  const username = profile?.username || authUser?.username || "user";
  const displayName = profile?.display_name || username;
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const rating = profile?.rating ?? 1500;
  const bio = profile?.bio || "No bio provided.";
  const location = profile?.location || profile?.country || "—";
  const github = profile?.github ? `@${profile.github.replace(/^@/, "")}` : "—";
  const website = profile?.website || "—";
  const streak = activity?.current_streak ?? 0;
  const solvedCount = profile?.problems_solved_count ?? 0;
  const attemptedCount = profile?.problems_attempted_count ?? 0;

  const points = profile?.points ?? 0;
  const totalPointsEarned = profile?.total_points_earned ?? points;
  const codingLevel = Math.floor(points / 100) + 1;

  const stats = [
    { k: String(solvedCount), l: "Solved" },
    { k: String(attemptedCount), l: "Attempted" },
    { k: `${points.toLocaleString()} pts`, l: "Reward Points" },
    { k: `${totalPointsEarned.toLocaleString()} pts`, l: "Total Earned" },
  ];

  return (
    <AppShell>
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 sm:p-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(closest-side,oklch(0.72_0.20_40/0.2),transparent_70%)]" />
        <div className="flex flex-wrap items-start gap-6">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl ember-gradient text-4xl font-black text-primary-foreground shadow-xl shadow-[color:var(--color-ember)]/30">
            {avatarInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">{username}</h1>
              <Badge className="ember-gradient text-primary-foreground border-0">
                Ember · {rating}
              </Badge>
              <Badge variant="outline" className="border-amber-500/40 text-amber-500 font-mono">
                Level {codingLevel}
              </Badge>
            </div>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{bio}</p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {location}
              </span>
              <a
                className="inline-flex items-center gap-1.5 hover:text-foreground"
                href={
                  profile?.github ? `https://github.com/${profile.github.replace(/^@/, "")}` : "#"
                }
              >
                <Github className="h-3.5 w-3.5" /> {github}
              </a>
              <a
                className="inline-flex items-center gap-1.5 hover:text-foreground"
                href={
                  website !== "—"
                    ? website.startsWith("http")
                      ? website
                      : `https://${website}`
                    : "#"
                }
              >
                <Link2 className="h-3.5 w-3.5" /> {website}
              </a>
              <span className="inline-flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-[color:var(--color-ember)]" /> {streak}-day
                streak
              </span>
              <span className="inline-flex items-center gap-1.5 text-[color:var(--color-ember)] font-mono font-medium">
                <Zap className="h-3.5 w-3.5 fill-current" /> {points} points
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Share</Button>
            <Button
              className="ember-gradient text-primary-foreground border-0"
              onClick={() => setEditModalOpen(true)}
            >
              Edit profile
            </Button>
          </div>
        </div>
      </div>

      <EditProfileModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        profile={profile || null}
        userId={userId}
        onSuccess={() => refetchProfile()}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l} className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <div className="font-display text-3xl font-bold ember-text">{s.k}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="achievements" className="mt-6">
        <TabsList>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="contests">Contest history</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: "First Blood", d: "First accepted submission of a weekly round." },
            { t: "Streak 30", d: "Solve at least one problem every day for 30 days." },
            { t: "Graph Master", d: "Solve 100 graph problems." },
            { t: "Speed Demon", d: "Beat 99% runtime on a hard problem." },
            { t: "Contributor", d: "Editorial accepted by the FireCode team." },
            { t: "Top 100", d: "Finish top 100 in a rated round." },
          ].map((a) => (
            <div key={a.t} className="rounded-2xl border border-border/60 bg-card/60 p-5">
              <div className="grid h-10 w-10 place-items-center rounded-lg ember-gradient text-primary-foreground shadow-lg shadow-[color:var(--color-ember)]/30">
                <Award className="h-5 w-5" />
              </div>
              <div className="mt-4 font-semibold">{a.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{a.d}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent
          value="submissions"
          className="mt-6 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
        >
          Detailed submission history coming soon.
        </TabsContent>
        <TabsContent
          value="contests"
          className="mt-6 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground"
        >
          Contest rating chart coming soon.
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
