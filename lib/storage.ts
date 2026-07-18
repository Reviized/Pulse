import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Re-hosts a scraped image to Supabase Storage (Section 5: "hotlinked
 * headshots die on CDN blocks"). Returns the public Storage URL on success,
 * or the original source URL as an honest fallback when the admin client
 * (no SUPABASE_SERVICE_ROLE_KEY) or the fetch itself isn't available, so a
 * pending re-host never blocks the caller.
 */
export async function rehostImage(
  sourceUrl: string,
  bucket: "headshots" | "slide-media" | "replicas" | "generated",
  pathHint: string
): Promise<{ url: string; rehosted: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { url: sourceUrl, rehosted: false };

  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { url: sourceUrl, rehosted: false };
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const buffer = await res.arrayBuffer();
    const path = `${pathHint}-${Date.now()}.${ext}`;

    const { error } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType,
      upsert: true,
    });
    if (error) return { url: sourceUrl, rehosted: false };

    const { data } = admin.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, rehosted: true };
  } catch {
    return { url: sourceUrl, rehosted: false };
  }
}
