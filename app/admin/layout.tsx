import "@/app/styles/admin.css";
import { listExperiences } from "@/lib/data/experiences";
import type { Experience } from "@/types/database";
import { AdminNav } from "./_components/AdminNav";
import { errorMessage } from "./_lib/safe-load";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // listExperiences() throws on a real Supabase error, by its documented
  // convention. A layout-level throw is NOT caught by app/admin/error.tsx
  // (Next.js excludes the same-segment layout from its own error boundary),
  // so it's caught here directly — the nav degrades to an empty picker with
  // an honest banner instead of crashing the whole Admin shell.
  let experiences: Experience[] = [];
  let loadError: string | null = null;
  try {
    experiences = await listExperiences();
  } catch (err) {
    loadError = errorMessage(err);
  }

  return (
    <div className="pulse-admin">
      <div className="pa-shell">
        <AdminNav experiences={experiences} />
        {loadError && (
          <div
            style={{
              background: "rgba(217,122,122,.12)",
              borderBottom: "1px solid rgba(217,122,122,.3)",
              padding: "8px 28px",
              fontSize: 11,
              color: "var(--bad)",
            }}
          >
            Supabase is unreachable: {loadError} — see Build Status for the live check.
          </div>
        )}
        <main className="pa-main">{children}</main>
      </div>
    </div>
  );
}
