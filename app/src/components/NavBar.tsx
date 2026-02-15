"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePatientContext } from "@/context/PatientContext";

const LINKS = [
  { href: "/", label: "Operations" },
  { href: "/nurse", label: "Nurse" },
  { href: "/doctor", label: "Doctor" },
];

function HeartbeatMonitor({ active }: { active: boolean }) {
  return (
    <svg
      width="32"
      height="18"
      viewBox="0 0 64 28"
      fill="none"
      className="overflow-visible"
    >
      {/* Flat line path */}
      <polyline
        points="0,14 18,14 22,14 26,2 30,26 34,8 38,18 42,14 64,14"
        stroke={active ? "#34d399" : "#555"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={active ? "heartbeat-line" : ""}
      />
      {/* Sweep dot that traces the line */}
      {active && (
        <circle r="2.5" fill="#34d399" className="heartbeat-dot">
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path="M0,14 L18,14 L22,14 L26,2 L30,26 L34,8 L38,18 L42,14 L64,14"
          />
        </circle>
      )}
      {/* Glow filter for active state */}
      {active && (
        <defs>
          <filter id="hb-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
    </svg>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const { simState } = usePatientContext();

  return (
    <header className="bg-white header-glow px-6 py-3.5 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <HeartbeatMonitor active={simState.is_running} />
        <h1 className="text-base font-mono font-bold tracking-widest text-foreground/90 uppercase">
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
              className={`rounded-md px-4 py-2 text-sm font-mono font-medium transition-colors ${
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
