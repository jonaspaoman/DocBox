"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Operations" },
  { href: "/nurse", label: "Nurse" },
  { href: "/doctor", label: "Doctor" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="bg-[oklch(0.1_0_0)] header-glow px-6 py-3 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 glow-green" />
        <h1 className="text-sm font-mono font-bold tracking-widest text-foreground/90 uppercase">
          DocBox
        </h1>
      </Link>
      <nav className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
        {LINKS.map(({ href, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-xs font-mono font-medium transition-colors ${
                isActive
                  ? "bg-emerald-600 text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
