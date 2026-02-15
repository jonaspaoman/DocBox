"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePatientContext } from "@/context/PatientContext";
import { AppMode } from "@/context/PatientContext";

const LINKS = [
  { href: "/", label: "Operations" },
  { href: "/nurse", label: "Nurse" },
  { href: "/doctor", label: "Doctor" },
];

function HeartbeatMonitor({ active, color = "#34d399", baseline = false }: { active: boolean; color?: string; baseline?: boolean }) {
  if (baseline) {
    // Red-only pulsing dot for baseline mode
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-3 w-3">
          {active && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          )}
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      </div>
    );
  }

  return (
    <svg
      width="32"
      height="18"
      viewBox="0 0 64 28"
      fill="none"
      className="overflow-visible"
      style={{ "--hb-color": color, "--hb-color-fade": `${color}66` } as React.CSSProperties}
    >
      {/* Flat line path */}
      <polyline
        points="0,14 18,14 22,14 26,2 30,26 34,8 38,18 42,14 64,14"
        stroke={active ? color : "#555"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={active ? "heartbeat-line" : ""}
      />
      {/* Sweep dot that traces the line */}
      {active && (
        <circle r="2.5" fill={color} className="heartbeat-dot">
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

const MODE_OPTIONS: { value: AppMode; label: string }[] = [
  { value: "docbox", label: "DocBox" },
  { value: "baseline", label: "Baseline" },
];

export function NavBar() {
  const pathname = usePathname();
  const { simState, appMode, setAppMode } = usePatientContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  return (
    <header className="bg-white header-glow px-6 py-2 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <HeartbeatMonitor active={simState.is_running} color={appMode === "baseline" ? "#ef4444" : "#34d399"} baseline={appMode === "baseline"} />
        </Link>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={`flex items-center gap-1.5 text-base font-mono font-bold tracking-widest uppercase hover:text-foreground transition-colors ${appMode === "baseline" ? "text-red-500" : "text-foreground/90"}`}
          >
            {appMode === "baseline" ? "Baseline" : "DocBox"}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}>
              <polyline points="2,4 5,7 8,4" />
            </svg>
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setAppMode(opt.value); setDropdownOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <span className={`w-4 ${opt.value === "baseline" ? "text-red-500" : "text-emerald-600"}`}>
                    {appMode === opt.value ? "✓" : ""}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <nav className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
        {LINKS
          .filter(({ href }) => appMode !== "baseline" || href === "/")
          .map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3.5 py-1.5 text-sm font-mono font-medium transition-colors ${
                  isActive
                    ? (appMode === "baseline" ? "bg-red-500 text-white" : "bg-emerald-600 text-white")
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
