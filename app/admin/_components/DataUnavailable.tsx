export function DataUnavailable({ message }: { message: string }) {
  return (
    <div className="pa-empty" style={{ borderColor: "rgba(217,122,122,.4)", color: "var(--bad)" }}>
      Could not load data from Supabase: {message}
      <div className="pa-hint" style={{ marginTop: 8, color: "var(--dim)" }}>
        See{" "}
        <a href="/admin/build-status" style={{ color: "var(--gold)" }}>
          Build Status
        </a>{" "}
        for the live connectivity check.
      </div>
    </div>
  );
}
