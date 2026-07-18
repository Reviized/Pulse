export function Pill({
  status,
  children,
}: {
  status: "paved" | "gravel" | "bad";
  children: React.ReactNode;
}) {
  return (
    <span className={`pa-pill ${status}`}>
      <span className="dot" />
      {children}
    </span>
  );
}
