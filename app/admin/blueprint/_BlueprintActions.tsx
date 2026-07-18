"use client";

import { useState } from "react";
import { logBlueprintSnapshot } from "../_actions/blueprint";

export function BlueprintActions({ markdown }: { markdown: string }) {
  const [snapshotMsg, setSnapshotMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function download() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-3-blueprint-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function snapshot() {
    setBusy(true);
    setSnapshotMsg(null);
    const result = await logBlueprintSnapshot();
    setBusy(false);
    setSnapshotMsg(result.success ? "logged to build_mocks" : result.reason ?? "failed");
  }

  return (
    <div className="pa-btn-row" style={{ marginBottom: 28 }}>
      <button className="pa-btn" onClick={download}>
        Download as Markdown
      </button>
      <button className="pa-btn ghost" onClick={snapshot} disabled={busy}>
        {busy ? "Logging…" : "Log this snapshot to Build History"}
      </button>
      {snapshotMsg && <span className="pa-save-status ok">{snapshotMsg}</span>}
    </div>
  );
}
