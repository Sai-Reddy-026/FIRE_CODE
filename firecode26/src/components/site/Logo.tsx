import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`group inline-flex items-center gap-2 ${className}`}>
      <span className="relative grid h-8 w-8 place-items-center rounded-lg ember-gradient shadow-lg shadow-[color:var(--color-ember)]/40">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-primary-foreground"
          fill="currentColor"
          aria-hidden
        >
          <path d="M13.5 2c.3 3.5-2 4.5-2 7 0 1.5 1 2.5 2.5 2.5S16 10.5 16 9c1.5 1.5 3 3.5 3 6.5A7 7 0 1 1 5 15.5C5 10 10 8 10 4c1 .5 2.5 1 3.5-2z" />
        </svg>
      </span>
      <span className="font-display text-lg font-bold tracking-tight">
        Fire<span className="ember-text">Code</span>
      </span>
    </Link>
  );
}
