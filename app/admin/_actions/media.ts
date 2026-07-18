"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type UploadResult = { success: boolean; url?: string; reason?: string; gravel?: boolean };

function extFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("quicktime")) return "mov";
  return "jpg";
}

/**
 * Section 5's storage buckets already exist (0002_storage_buckets.sql);
 * these actions are the write side. Gravel-road note: there is no
 * image-processing dependency in package.json (adding one needs the
 * package.json sign-off this build can't get autonomously — CLAUDE.md's
 * "ask" list), so the "downscale to max 1600px" rule from Section 5 is not
 * applied here — the original upload is stored as-is. Pave this by adding
 * sharp (or an edge-safe resize) once that dependency is approved.
 */
export async function uploadSlideMedia(slideId: string, formData: FormData): Promise<UploadResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const file = formData.get("media");
  if (!(file instanceof File) || file.size === 0) return { success: false, reason: "no file selected" };

  const path = `${slideId}-${Date.now()}.${extFor(file.type)}`;
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from("slide-media").upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (uploadError) return { success: false, reason: uploadError.message };

  const { data: publicUrl } = admin.storage.from("slide-media").getPublicUrl(path);
  const mediaKind = file.type.startsWith("video") ? "video" : "image";

  const { error: updateError } = await admin
    .from("slides")
    .update({ media_url: publicUrl.publicUrl, media_kind: mediaKind })
    .eq("id", slideId);
  if (updateError) return { success: false, reason: updateError.message };

  revalidatePath("/admin/content");
  return { success: true, url: publicUrl.publicUrl };
}

export async function uploadModuleMedia(moduleId: string, formData: FormData): Promise<UploadResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const file = formData.get("media");
  if (!(file instanceof File) || file.size === 0) return { success: false, reason: "no file selected" };

  const path = `${moduleId}-${Date.now()}.${extFor(file.type)}`;
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from("slide-media").upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (uploadError) return { success: false, reason: uploadError.message };

  const { data: publicUrl } = admin.storage.from("slide-media").getPublicUrl(path);
  const mediaKind = file.type.startsWith("video") ? "video" : "image";

  const { error: updateError } = await admin
    .from("training_modules")
    .update({ media_url: publicUrl.publicUrl, media_kind: mediaKind })
    .eq("id", moduleId);
  if (updateError) return { success: false, reason: updateError.message };

  revalidatePath("/admin/content");
  return { success: true, url: publicUrl.publicUrl };
}

export async function uploadProfileHeadshot(profileId: string, formData: FormData): Promise<UploadResult> {
  const admin = createAdminClient();
  if (!admin) return { success: false, gravel: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured" };

  const file = formData.get("headshot");
  if (!(file instanceof File) || file.size === 0) return { success: false, reason: "no file selected" };

  const path = `${profileId}-${Date.now()}.${extFor(file.type)}`;
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from("headshots").upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (uploadError) return { success: false, reason: uploadError.message };

  const { data: publicUrl } = admin.storage.from("headshots").getPublicUrl(path);

  const { error: updateError } = await admin
    .from("profiles")
    .update({ headshot_url: publicUrl.publicUrl })
    .eq("id", profileId);
  if (updateError) return { success: false, reason: updateError.message };

  revalidatePath("/admin/profiles");
  return { success: true, url: publicUrl.publicUrl };
}
