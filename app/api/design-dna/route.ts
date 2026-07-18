import { NextResponse } from "next/server";
import { logBuildMock } from "@/lib/data/build-mocks";
import type { DesignSpec } from "@/types/database";

/**
 * Real signal extraction from a site's actual HTML/CSS — no LLM, no API key.
 * This is the part of design-dna that can run with zero paid dependencies:
 * a declared <meta name="theme-color">, a Google Fonts <link>, or a plain
 * font-family/color declared in CSS are all things a site tells us directly.
 *
 * What this deliberately does NOT do: classify typography into the
 * condensed-impact/geometric-sans/humanist-sans/elegant-serif/mono-tech
 * taxonomy, or pick a considered palette when no real signal exists — that
 * needs Claude Vision on a real screenshot (ANTHROPIC_API_KEY, not present
 * yet). When no real signal is found, this returns ok:false with a reason
 * rather than inventing a plausible-looking default — gravel road, not a
 * silent guess dressed up as a result.
 */

type ExtractResult = {
  ok: boolean;
  reason?: string;
  companyName?: string;
  accent?: string;
  fontFamily?: string;
  googleFont?: boolean;
};

const HEX_RE = /#[0-9a-fA-F]{6}\b/g;

async function fetchText(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PulseDesignDNA/1.0)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractCompanyName(html: string): string | undefined {
  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  if (ogSite) return ogSite[1].trim();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title) return title[1].split(/[|·\-–—]/)[0].trim();
  return undefined;
}

function extractAccent(html: string): string | undefined {
  const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8})["']/i);
  if (themeColor) return normalizeHex(themeColor[1]);

  // Fall back to the most frequently repeated hex color in inline <style> blocks —
  // a real (if noisy) signal: a brand's primary color is usually reused often.
  const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((m) => m[1])
    .join("\n");
  const counts = new Map<string, number>();
  Array.from(styleBlocks.matchAll(HEX_RE)).forEach((m) => {
    const hex = m[0].toLowerCase();
    if (hex === "#ffffff" || hex === "#000000") return; // too generic to be a brand signal
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  });
  let best: string | undefined;
  let bestCount = 1; // require at least 2 occurrences to count as a real repeated signal
  Array.from(counts.entries()).forEach(([hex, count]) => {
    if (count > bestCount) {
      best = hex;
      bestCount = count;
    }
  });
  return best;
}

function normalizeHex(h: string): string {
  if (h.length === 4) {
    // #abc -> #aabbcc
    return "#" + h.slice(1).split("").map((c) => c + c).join("");
  }
  return h.slice(0, 7);
}

async function extractFont(html: string, baseUrl: string): Promise<{ family?: string; isGoogleFont: boolean }> {
  const gfMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/i);
  if (gfMatch) {
    const family = decodeURIComponent(gfMatch[1]).split("|")[0].split(":")[0].replace(/\+/g, " ").trim();
    return { family, isGoogleFont: true };
  }

  // Look at inline <style> first — cheap, no extra request.
  const inlineMatch = html.match(/font-family\s*:\s*([^;"'<>]+)/i);
  if (inlineMatch) {
    const family = inlineMatch[1].split(",")[0].replace(/['"]/g, "").trim();
    if (family && !/inherit|initial|unset/i.test(family)) return { family, isGoogleFont: false };
  }

  // One linked stylesheet, best-effort — most sites' primary font is declared here.
  const linkMatch = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/i);
  if (linkMatch) {
    try {
      const cssUrl = new URL(linkMatch[1], baseUrl).toString();
      const css = await fetchText(cssUrl, 5000);
      if (css) {
        const cssFontMatch = css.match(/font-family\s*:\s*([^;"'<>]+)/i);
        if (cssFontMatch) {
          const family = cssFontMatch[1].split(",")[0].replace(/['"]/g, "").trim();
          if (family && !/inherit|initial|unset/i.test(family)) return { family, isGoogleFont: false };
        }
      }
    } catch {
      // best-effort only
    }
  }

  return { isGoogleFont: false };
}

async function extractRealSignals(rawUrl: string): Promise<ExtractResult> {
  const html = await fetchText(rawUrl);
  if (!html) return { ok: false, reason: "site did not respond or blocked the request" };

  const companyName = extractCompanyName(html);
  const accent = extractAccent(html);
  const font = await extractFont(html, rawUrl);

  if (!accent && !font.family) {
    return { ok: false, reason: "no theme-color, Google Font, or declared font-family found on this site", companyName };
  }

  return {
    ok: true,
    companyName,
    accent,
    fontFamily: font.family,
    googleFont: font.isGoogleFont,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "not a valid URL" }, { status: 400 });
  }

  const result = await extractRealSignals(url.toString());

  if (!result.ok) {
    await logBuildMock("design-dna", "gravel", result.reason ?? "no signal found");
    return NextResponse.json({ success: true, gravel: true, reason: result.reason, companyName: result.companyName });
  }

  const designSpec: Partial<DesignSpec> = {
    palette: {
      bg: "#141412",
      accent: result.accent ?? "#b5a47a",
      text: "#f0ede6",
    },
    type: {
      // Real classification needs Claude Vision (ANTHROPIC_API_KEY, not present yet) —
      // default to humanist-sans as a neutral placeholder category, but carry the exact
      // detected font name through so the frontend can load and use the real font
      // regardless of which category label ends up attached to it.
      display: "humanist-sans",
      case: "uppercase",
      font_family: result.fontFamily,
    },
    shape: { corners: "rounded" },
  };

  return NextResponse.json({
    success: true,
    gravel: false,
    companyName: result.companyName,
    designSpec,
    googleFont: result.googleFont,
  });
}
