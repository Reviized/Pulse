import { NextResponse } from "next/server";
import { logBuildMock } from "@/lib/data/build-mocks";
import type { DesignSpec } from "@/types/database";

/**
 * Real signal extraction from a site's actual HTML/CSS — no LLM, no API key.
 * This is the part of design-dna that can run with zero paid dependencies:
 * a declared <meta name="theme-color">, a Google Fonts <link>, or a plain
 * font-family/color declared in CSS are all things a site tells us directly.
 *
 * Most sites built with a modern framework (Next.js, a Tailwind build, a
 * CSS-in-JS pipeline) don't leave any of that in the raw HTML's inline
 * <style> blocks — their real palette lives in an external, hashed
 * stylesheet, often as CSS custom properties (--color-primary, --brand,
 * etc.) rather than repeated literal hex values. The original version of
 * this only looked at inline <style> blocks and the meta tag, so it missed
 * exactly this case (confirmed against forwardedge.ai — no signal found,
 * silently fell back to gravel) and returned Pulse's own default gold
 * accent instead of anything from the real site. This version also fetches
 * a handful of the page's own linked stylesheets and checks CSS custom
 * properties first, before falling back to the "most repeated hex" guess.
 *
 * What this deliberately does NOT do: classify typography into the
 * condensed-impact/geometric-sans/humanist-sans/elegant-serif/mono-tech
 * taxonomy, or read anything from a rendered screenshot — that needs Claude
 * Vision on an actual browser screenshot, which needs either a paid
 * screenshot API or a headless-browser dependency neither of which are wired
 * up yet (see the System Blueprint). When no real signal is found, this
 * returns ok:false with a reason rather than inventing a plausible-looking
 * default — gravel road, not a silent guess dressed up as a result.
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
const MAX_STYLESHEETS = 4;

// A brand's declared custom property is a far stronger signal than "most
// repeated hex" — try these common names first, in order.
const BRAND_VAR_NAMES = [
  "color-primary", "primary-color", "brand", "brand-color", "accent", "accent-color",
  "color-accent", "theme-color", "primary",
];

function isGrayish(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  // Low saturation (near-gray, near-white, near-black) — almost never a
  // brand accent, and common enough in compiled CSS (borders, neutrals) to
  // drown out the real signal in a "most repeated hex" count.
  return max - min < 18;
}

async function fetchLinkedStylesheets(html: string, baseUrl: string): Promise<string> {
  const hrefs = Array.from(html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi))
    .map((m) => m[1])
    .slice(0, MAX_STYLESHEETS);
  const texts = await Promise.all(
    hrefs.map(async (href) => {
      try {
        const cssUrl = new URL(href, baseUrl).toString();
        return (await fetchText(cssUrl, 5000)) ?? "";
      } catch {
        return "";
      }
    })
  );
  return texts.join("\n");
}

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

function extractAccentFromCustomProperties(css: string): string | undefined {
  // --brand-color: #7c3aed; (or the same with rgb()/no leading -- in the
  // name lookup below) — declared custom properties are an intentional
  // brand statement, a far stronger signal than counting repeated hex
  // values, so these are tried first regardless of where they're declared.
  for (const varName of BRAND_VAR_NAMES) {
    const re = new RegExp(`--${varName}\\s*:\\s*(#[0-9a-fA-F]{3,8})`, "i");
    const m = css.match(re);
    if (m) return normalizeHex(m[1]);
  }
  return undefined;
}

function extractAccentFromRepeatedHex(css: string): string | undefined {
  // The most frequently repeated hex color across the page's own CSS — a
  // real (if noisy) signal: a brand's primary color is usually reused
  // often. Grays/near-white/near-black are filtered out first since
  // compiled CSS is full of repeated neutrals (borders, backgrounds) that
  // would otherwise drown out the actual brand color.
  const counts = new Map<string, number>();
  Array.from(css.matchAll(HEX_RE)).forEach((m) => {
    const hex = m[0].toLowerCase();
    if (isGrayish(hex)) return;
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

function extractAccent(html: string, externalCss: string): string | undefined {
  const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{3,8})["']/i);
  if (themeColor) return normalizeHex(themeColor[1]);

  const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((m) => m[1])
    .join("\n");
  const combined = styleBlocks + "\n" + externalCss;

  return extractAccentFromCustomProperties(combined) ?? extractAccentFromRepeatedHex(combined);
}

function normalizeHex(h: string): string {
  if (h.length === 4) {
    // #abc -> #aabbcc
    return "#" + h.slice(1).split("").map((c) => c + c).join("");
  }
  return h.slice(0, 7);
}

async function extractFont(html: string, externalCss: string): Promise<{ family?: string; isGoogleFont: boolean }> {
  const gfMatch = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&]+)/i);
  if (gfMatch) {
    const family = decodeURIComponent(gfMatch[1]).split("|")[0].split(":")[0].replace(/\+/g, " ").trim();
    return { family, isGoogleFont: true };
  }

  // Look at inline <style> first — cheap, no extra request. The capture
  // deliberately allows quote characters through (a declared value is
  // almost always 'Inter', sans-serif, quotes and all) — they're stripped
  // below rather than excluded from matching, which used to make this
  // never match the common quoted case at all.
  const inlineMatch = html.match(/font-family\s*:\s*([^;<>]+)/i);
  if (inlineMatch) {
    const family = inlineMatch[1].split(",")[0].replace(/['"]/g, "").trim();
    if (family && !/inherit|initial|unset/i.test(family)) return { family, isGoogleFont: false };
  }

  // The page's own external stylesheets (already fetched once and shared
  // with extractAccent) — most sites' primary font is declared here rather
  // than inline.
  const cssFontMatch = externalCss.match(/font-family\s*:\s*([^;<>]+)/i);
  if (cssFontMatch) {
    const family = cssFontMatch[1].split(",")[0].replace(/['"]/g, "").trim();
    if (family && !/inherit|initial|unset/i.test(family)) return { family, isGoogleFont: false };
  }

  return { isGoogleFont: false };
}

async function extractRealSignals(rawUrl: string): Promise<ExtractResult> {
  const html = await fetchText(rawUrl);
  if (!html) return { ok: false, reason: "site did not respond or blocked the request" };

  const externalCss = await fetchLinkedStylesheets(html, rawUrl);
  const companyName = extractCompanyName(html);
  const accent = extractAccent(html, externalCss);
  const font = await extractFont(html, externalCss);

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
      // Real classification needs Claude Vision on an actual screenshot, which
      // needs a rendering step this route doesn't have (see the file header) —
      // default to humanist-sans as a neutral placeholder category, but carry
      // the exact detected font name through so the frontend can load and use
      // the real font regardless of which category label ends up attached to it.
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
