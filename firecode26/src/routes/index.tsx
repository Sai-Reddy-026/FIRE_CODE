import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Flame,
  Trophy,
  Zap,
  Code2,
  Users,
  ShieldCheck,
  Terminal,
  ArrowRight,
  CheckCircle2,
  LineChart,
  Github,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FireCode — Sharpen your craft, one problem at a time" },
      {
        name: "description",
        content:
          "A premium online judge for modern developers. Curated problems, live contests, and a workspace built for flow.",
      },
      { property: "og:title", content: "FireCode — Sharpen your craft" },
      {
        property: "og:description",
        content: "Curated problems, live contests, elegant workspace.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <Hero />
      <LogoStrip />
      <Features />
      <Workspace />
      <Stats />
      <HowItWorks />
      <Testimonials />
      <CTA />
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,oklch(0.72_0.20_40/0.35),transparent)]"
        aria-hidden
      />
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-28 text-center md:pt-28">
        <Badge
          variant="outline"
          className="mx-auto gap-1.5 border-border/80 bg-card/60 py-1.5 backdrop-blur"
        >
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--color-ember)]" />
          <span className="text-xs">FireCode 2026 · Season One is live</span>
        </Badge>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Sharpen your craft,
          <br />
          <span className="ember-text">one problem at a time.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          A premium online judge for engineers who take their craft seriously. Curated problems,
          live contests, and a coding workspace built for deep flow.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register">
            <Button
              size="lg"
              className="ember-gradient text-primary-foreground border-0 shadow-xl shadow-[color:var(--color-ember)]/30 hover:brightness-110"
            >
              Start solving free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/problems">
            <Button size="lg" variant="outline" className="glass">
              Browse problems
            </Button>
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success)]" /> No credit
            card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success)]" /> 2,400+
            curated problems
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--color-success)]" /> 40+ languages
          </span>
        </div>

        <MockEditor />
      </div>
    </section>
  );
}

function MockEditor() {
  const lines = [
    {
      n: 1,
      code: (
        <>
          <span className="text-[color:var(--color-info)]">function</span>{" "}
          <span className="text-[color:var(--color-ember-glow)]">twoSum</span>(nums, target){" "}
          {"{"}{" "}
        </>
      ),
    },
    {
      n: 2,
      code: (
        <>
          {" "}
          <span className="text-[color:var(--color-info)]">const</span> map ={" "}
          <span className="text-[color:var(--color-info)]">new</span> Map();
        </>
      ),
    },
    {
      n: 3,
      code: (
        <>
          {" "}
          <span className="text-[color:var(--color-info)]">for</span> (
          <span className="text-[color:var(--color-info)]">let</span> i = 0; i {"<"} nums.length;
          i++) {"{"}{" "}
        </>
      ),
    },
    {
      n: 4,
      code: (
        <>
          {" "}
          <span className="text-[color:var(--color-info)]">const</span> need = target - nums[i];
        </>
      ),
    },
    {
      n: 5,
      code: (
        <>
          {" "}
          <span className="text-[color:var(--color-info)]">if</span> (map.has(need)){" "}
          <span className="text-[color:var(--color-info)]">return</span> [map.get(need), i];
        </>
      ),
    },
    { n: 6, code: <> map.set(nums[i], i);</> },
    { n: 7, code: <> {"}"}</> },
    { n: 8, code: <>{"}"}</> },
  ];
  return (
    <div className="mx-auto mt-16 max-w-5xl">
      <div className="glass overflow-hidden rounded-2xl shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-warning)]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-success)]/70" />
            <span className="ml-4 text-xs text-muted-foreground mono">twoSum.js — FireCode</span>
          </div>
          <Badge className="ember-gradient text-primary-foreground border-0">Accepted · 68ms</Badge>
        </div>
        <div className="grid gap-0 md:grid-cols-[1fr,320px]">
          <pre className="mono overflow-x-auto p-5 text-left text-sm leading-relaxed">
            {lines.map((l) => (
              <div key={l.n} className="flex gap-4">
                <span className="w-6 select-none text-right text-muted-foreground/60">{l.n}</span>
                <span>{l.code}</span>
              </div>
            ))}
          </pre>
          <div className="border-t border-border/60 bg-card/40 p-5 md:border-l md:border-t-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Test cases
            </div>
            <ul className="mt-3 space-y-2 mono text-xs">
              {["[2,7,11,15], 9", "[3,2,4], 6", "[3,3], 6"].map((t) => (
                <li
                  key={t}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2"
                >
                  <span className="text-muted-foreground">{t}</span>
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" />
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-md border border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 p-3 text-xs">
              <div className="font-semibold text-[color:var(--color-success)]">
                All tests passed
              </div>
              <div className="mt-1 text-muted-foreground">Runtime beats 96.4%</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LogoStrip() {
  const names = ["Vercel", "Linear", "Stripe", "GitHub", "Notion", "Raycast"];
  return (
    <div className="border-y border-border/60 bg-background/40 py-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center text-xs uppercase tracking-widest text-muted-foreground">
          Engineers from teams you know
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 opacity-70">
          {names.map((n) => (
            <span key={n} className="font-display text-lg font-semibold tracking-tight">
              {n}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Features() {
  const items = [
    {
      icon: Code2,
      title: "Elegant workspace",
      body: "Monaco-powered editor with resizable panels, autosave, and split test runners.",
    },
    {
      icon: Trophy,
      title: "Live contests",
      body: "Weekly rated rounds with a real-time leaderboard, badges, and streaks.",
    },
    {
      icon: Flame,
      title: "Ember streaks",
      body: "Daily heatmaps and streak protection to build a durable practice habit.",
    },
    {
      icon: Zap,
      title: "Fast judging",
      body: "Sub-second execution across 40+ languages on isolated sandboxes.",
    },
    {
      icon: LineChart,
      title: "Deep analytics",
      body: "Per-tag mastery, submission trends, and time complexity insights.",
    },
    {
      icon: ShieldCheck,
      title: "Fair play",
      body: "Plagiarism-resistant runner with signed submissions and audit trails.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeader
        eyebrow="Platform"
        title="Built for developers who care"
        subtitle="Every surface designed to remove friction between you and the problem."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6 transition hover:border-[color:var(--color-ember)]/60"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg ember-gradient text-primary-foreground shadow-lg shadow-[color:var(--color-ember)]/30">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Workspace() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Badge variant="outline" className="border-border/80 bg-card/60">
            <Terminal className="mr-1.5 h-3 w-3" /> Workspace
          </Badge>
          <h2 className="mt-4 font-display text-4xl font-bold tracking-tight md:text-5xl">
            The workspace that <span className="ember-text">respects your flow</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Split panels, keyboard-first navigation, autosave, and a console that shows exactly what
            happened — nothing more.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Monaco editor with 15+ themes",
              "Resizable, dockable test console",
              "Command palette for every action",
              "Distraction-free fullscreen mode",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[color:var(--color-success)]" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="glass rounded-2xl p-4 shadow-2xl shadow-black/40">
          <div className="grid grid-cols-2 gap-3">
            {["Runtime", "Memory", "Tests", "Rank"].map((l, i) => (
              <div key={l} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="text-xs uppercase text-muted-foreground">{l}</div>
                <div className="mt-2 font-display text-2xl font-bold">
                  {["68ms", "42MB", "24/24", "#312"][i]}
                </div>
                <div className="mt-1 text-xs text-[color:var(--color-success)]">
                  Top {[3.6, 12, 100, 4][i]}%
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="mb-2 text-xs uppercase text-muted-foreground">Submission timeline</div>
            <div className="flex items-end gap-1">
              {Array.from({ length: 32 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 rounded-sm ember-gradient"
                  style={{ height: `${20 + ((i * 17) % 60)}px`, opacity: 0.4 + ((i * 7) % 6) / 10 }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const s = [
    { k: "2,412", l: "Problems curated" },
    { k: "180K", l: "Developers solving" },
    { k: "42", l: "Languages supported" },
    { k: "99.98%", l: "Judge uptime" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-16">
      <div className="glass grid gap-6 rounded-2xl p-8 sm:grid-cols-2 lg:grid-cols-4">
        {s.map((x) => (
          <div key={x.l}>
            <div className="font-display text-4xl font-bold ember-text">{x.k}</div>
            <div className="mt-1 text-sm text-muted-foreground">{x.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Pick a problem", d: "Filter by topic, company, difficulty, or pattern." },
    {
      n: "02",
      t: "Solve in flow",
      d: "Write, test, and submit inside a workspace built for depth.",
    },
    { n: "03", t: "Level up", d: "Track mastery, climb the ladder, and earn ember badges." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeader eyebrow="How it works" title="Three steps. Real progress." />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-6"
          >
            <div className="mono text-6xl font-bold text-[color:var(--color-ember)]/20">{s.n}</div>
            <div className="mt-2 text-lg font-semibold">{s.t}</div>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  const items = [
    {
      q: "The workspace alone makes FireCode my daily practice. Everything else is a bonus.",
      a: "Priya S.",
      r: "Senior SWE, fintech",
    },
    {
      q: "Contests are electric. The leaderboard UX is the best I've used.",
      a: "Marco D.",
      r: "Staff Engineer",
    },
    {
      q: "Editorials read like a good technical blog. I actually learn from them.",
      a: "Aya K.",
      r: "New grad → Big Tech",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <SectionHeader eyebrow="Loved by engineers" title="From first submit to top of the ladder" />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map((t) => (
          <figure key={t.a} className="rounded-2xl border border-border/60 bg-card/60 p-6">
            <blockquote className="text-sm leading-relaxed">“{t.q}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full ember-gradient text-sm font-bold text-primary-foreground">
                {t.a[0]}
              </div>
              <div>
                <div className="text-sm font-medium">{t.a}</div>
                <div className="text-xs text-muted-foreground">{t.r}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 p-12 text-center">
        <div className="absolute inset-0 -z-10 grid-bg opacity-30" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(closest-side,oklch(0.72_0.20_40/0.35),transparent)]" />
        <h2 className="font-display text-4xl font-bold md:text-5xl">
          Ready to <span className="ember-text">ignite</span> your practice?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Join 180,000+ engineers building serious depth on FireCode. Free forever for the core
          problem set.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register">
            <Button
              size="lg"
              className="ember-gradient text-primary-foreground border-0 shadow-xl shadow-[color:var(--color-ember)]/30"
            >
              Create your account <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            <Button size="lg" variant="outline">
              <Github className="mr-1.5 h-4 w-4" /> Star on GitHub
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-ember)]">
        {eyebrow}
      </div>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
