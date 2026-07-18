export function EmptyExperienceState() {
  return (
    <div className="pa-empty">
      No experience selected. Pick one from the picker in the top bar, or{" "}
      <a href="/experiences/new" style={{ color: "var(--gold)" }}>
        create a new one
      </a>
      .
    </div>
  );
}
