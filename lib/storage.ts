import { createAdminClient } from "@/lib/supabase/admin";

type Bucket = "headshots" | "slide-media" | "replicas" | "generated";

function extFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("quicktime") || contentType.includes("mov")) return "mov";
  if (contentType.includes("webm")) return "webm";
  return contentType.startsWith("video/") ? "mp4" : "jpg";
}

/**
 * Generic re-host: downloads sourceUrl and uploads it to Supabase Storage,
 * used for both scraped headshots (Section 5) and rendered replica video
 * output (Section 7: "download and re-host the output to the replicas
 * Storage bucket immediately, never link directly to a REViiZED-hosted URL
 * long-term"). Returns the original source URL as an honest fallback when
 * the admin client or the fetch itself isn't available.
 */
export async function rehostFile(
  sourceUrl: string,
  bucket: Bucket,
  pathHint: string
): Promise<{ url: string; rehosted: boolean }> {
  const admin = createAdminClient();
  if (!admin) return { url: sourceUrl, rehosted: false };

  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return { url: sourceUrl, rehosted: false };
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = extFor(contentType);
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

/** Thin alias kept for existing callers (headshot re-hosting reads more clearly this way). */
export async function rehostImage(
  sourceUrl: string,
  bucket: Bucket,
  pathHint: string
): Promise<{ url: string; rehosted: boolean }> {
  return rehostFile(sourceUrl, bucket, pathHint);
}
