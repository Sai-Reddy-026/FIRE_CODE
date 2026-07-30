import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            A premium online judge for developers who care about their craft. Curated problems, live
            contests, and a workspace that respects your flow.
          </p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Product
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a className="hover:text-foreground text-muted-foreground" href="/problems">
                Problems
              </a>
            </li>
            <li>
              <a className="hover:text-foreground text-muted-foreground" href="/contests">
                Contests
              </a>
            </li>
            <li>
              <a className="hover:text-foreground text-muted-foreground" href="/dashboard">
                Dashboard
              </a>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Company
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a className="hover:text-foreground text-muted-foreground" href="#">
                About
              </a>
            </li>
            <li>
              <a className="hover:text-foreground text-muted-foreground" href="#">
                Privacy
              </a>
            </li>
            <li>
              <a className="hover:text-foreground text-muted-foreground" href="#">
                Terms
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FireCode. Compile the future.
      </div>
    </footer>
  );
}
