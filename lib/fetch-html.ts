/** Shared no-key HTML fetch used by design-dna and detect-team. */
export async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PulseBot/1.0)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Strips scripts/styles/tags to plain text, collapsing whitespace, capped in length. */
export function htmlToText(html: string, maxChars = 12000): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, maxChars);
}

/** Pulls (imgSrc, nearby alt/context) pairs so team extraction can associate headshots with names. */
export function extractImageCandidates(html: string, baseUrl: string, max = 40): { src: string; alt: string }[] {
  const out: { src: string; alt: string }[] = [];
  const re = /<img[^>]+>/gi;
  const matches = Array.from(html.matchAll(re));
  for (const m of matches) {
    if (out.length >= max) break;
    const tag = m[0];
    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const altMatch = tag.match(/alt=["']([^"']*)["']/i);
    try {
      const abs = new URL(srcMatch[1], baseUrl).toString();
      out.push({ src: abs, alt: altMatch?.[1] ?? "" });
    } catch {
      // skip unparseable src
    }
  }
  return out;
}
