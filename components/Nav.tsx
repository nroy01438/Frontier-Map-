"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/frontier", label: "Map" },
  { href: "/frontier/expeditions", label: "Expeditions" },
  { href: "/frontier/events", label: "Events" },
  { href: "/frontier/settings", label: "Settings" },
];

export function Nav({ displayName }: { displayName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-8">
        <Link href="/frontier" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Frontier
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = link.href === "/frontier" ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active ? "bg-surface-raised text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted">{displayName}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
