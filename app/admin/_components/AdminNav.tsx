"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Experience } from "@/types/database";

const SCOPED_TABS = [
  { href: "/admin/content", label: (mode: string | null) => (mode === "train" ? "Curriculum Manager" : "Slide Manager") },
  { href: "/admin/profiles", label: () => "Profiles" },
  { href: "/admin/replica-studio", label: () => "Replica Studio" },
  { href: "/admin/integrations", label: () => "Integrations" },
  { href: "/admin/pulse-check", label: () => "Pulse Check" },
];

export function AdminNav({ experiences }: { experiences: Experience[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentExp = searchParams.get("exp") ?? experiences[0]?.id ?? "";
  const selected = experiences.find((e) => e.id === currentExp) ?? null;

  const withExp = (href: string) => (currentExp ? `${href}?exp=${currentExp}` : href);

  return (
    <div className="pa-topbar">
      <div className="pa-mark">
        <b>PULSE</b> ADMIN
        <span className="pa-pulse-point">REViiZED &amp; Pulse team only</span>
      </div>

      <div className="pa-tabs">
        <Link href="/admin/build-status" className={`pa-tab ${pathname === "/admin/build-status" ? "active" : ""}`}>
          Build Status
        </Link>
        {SCOPED_TABS.map((tab) => (
          <Link
            key={tab.href}
            href={withExp(tab.href)}
            className={`pa-tab ${pathname === tab.href ? "active" : ""}`}
          >
            {tab.label(selected?.mode ?? null)}
          </Link>
        ))}
      </div>

      <div className="pa-exp-picker">
        <span>Experience</span>
        <select
          value={currentExp}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value) params.set("exp", e.target.value);
            else params.delete("exp");
            const target = pathname === "/admin/build-status" ? "/admin/content" : pathname;
            window.location.href = params.toString() ? `${target}?${params.toString()}` : target;
          }}
        >
          <option value="">Select an experience…</option>
          {experiences.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.company_name ?? exp.source_url} · {exp.mode}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
