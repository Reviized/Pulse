"use server";

import { revalidatePath } from "next/cache";
import { logBuildMock } from "@/lib/data/build-mocks";
import { loadBlueprintData } from "../_lib/blueprint";

export type LogSnapshotResult = { success: boolean; reason?: string };

/**
 * Writes a durable, timestamped checkpoint of the blueprint's summary
 * counts to build_mocks (feature: "system_blueprint"), so "track updates
 * with timestamps" has a real row history in the same table Build Status
 * already displays, rather than only living in this page's live-computed
 * render.
 */
export async function logBlueprintSnapshot(): Promise<LogSnapshotResult> {
  const data = await loadBlueprintData();
  const note = `${data.counts.paved} paved, ${data.counts.gravel} gravel, ${data.counts.notBuilt} not built, of ${data.counts.total} tracked features`;
  await logBuildMock("system_blueprint", data.counts.gravel + data.counts.notBuilt > 0 ? "gravel" : "paved", note);
  revalidatePath("/admin/build-status");
  revalidatePath("/admin/blueprint");
  return { success: true };
}
