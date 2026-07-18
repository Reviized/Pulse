import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchHtml, htmlToText, extractImageCandidates } from "@/lib/fetch-html";
import { forcedToolCall, AnthropicUnavailable, enforceCopyRules } from "@/lib/anthropic";
import { replaceProfilesForExperience } from "@/lib/data/profiles";
import { rehostImage } from "@/lib/storage";
import { findKnownSubject } from "@/lib/known-subjects";
import type { Narrator, ProfileInsert } from "@/types/database";

type ExtractedMember = {
  name: string;
  title: string;
  bio: string;
  headshot_url: string | null;
};

const EXTRACT_TEAM_TOOL = {
  name: "extract_team",
  description:
    "Extract up to 4 real, named leadership or team members from a company's website content, in the exact order the page lists them.",
  input_schema: {
    type: "object",
    properties: {
      members: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            bio: { type: "string", description: "One sentence, grounded in the page content." },
            headshot_url: {
              type: ["string", "null"],
              description: "Absolute image URL for this specific person if one is clearly present in the provided image candidates, else null.",
            },
          },
          required: ["name", "title", "bio", "headshot_url"],
        },
      },
    },
    required: ["members"],
  },
};

function tokenMatch(preferredName: string, candidate: string): boolean {
  const p = preferredName.toLowerCase().trim().split(/\s+/);
  const c = candidate.toLowerCase().trim().split(/\s+/);
  if (p.length === 0 || c.length === 0) return false;
  return p[0] === c[0] || p[p.length - 1] === c[c.length - 1];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const experienceId = typeof body?.experienceId === "string" ? body.experienceId : "";
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!experienceId || !rawUrl) {
    return NextResponse.json({ error: "experienceId and url are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      success: true,
      gravel: true,
      reason: "SUPABASE_SERVICE_ROLE_KEY not configured — profiles table is service-role write only",
    });
  }

  const { data: experience, error: expError } = await admin
    .from("experiences")
    .select("*")
    .eq("id", experienceId)
    .maybeSingle();
  if (expError || !experience) {
    return NextResponse.json({ error: "experience not found" }, { status: 404 });
  }

  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const html = await fetchHtml(url);
  if (!html) {
    return NextResponse.json({ success: true, gravel: true, reason: "site did not respond or blocked the request" });
  }

  const text = htmlToText(html);
  const images = extractImageCandidates(html, url);

  let members: ExtractedMember[] = [];
  try {
    const result = await forcedToolCall<{ members: ExtractedMember[] }>({
      system:
        "You extract real, named team or leadership members from raw company website text. Never invent people who are not clearly named on the page. If no real named individuals are present, return an empty members array. Order matches the page. Bios are one sentence each, grounded only in the provided content, no em or en dashes.",
      user: `Page text:\n${text}\n\nImage candidates on this page (src | alt text):\n${images
        .map((i) => `${i.src} | ${i.alt}`)
        .join("\n")}`,
      tool: EXTRACT_TEAM_TOOL,
      maxTokens: 1500,
    });
    members = result.members ?? [];
  } catch (err) {
    if (err instanceof AnthropicUnavailable) {
      return NextResponse.json({ success: true, gravel: true, reason: "ANTHROPIC_API_KEY not configured" });
    }
    return NextResponse.json({ success: true, gravel: true, reason: "team extraction failed" });
  }

  const companyName = experience.company_name ?? undefined;
  const profileInserts: Omit<ProfileInsert, "experience_id" | "workspace_id">[] = [];
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (!m.name?.trim()) continue;
    const known = findKnownSubject(m.name);

    let headshotUrl: string | null = null;
    if (m.headshot_url) {
      const rehosted = await rehostImage(m.headshot_url, "headshots", `${experienceId}-${i}`);
      headshotUrl = rehosted.url;
    }
    if (!headshotUrl && known?.headshot_url) headshotUrl = known.headshot_url;

    profileInserts.push({
      name: m.name.trim(),
      title: m.title ? enforceCopyRules(m.title, companyName) : null,
      bio: m.bio ? enforceCopyRules(m.bio, companyName) : null,
      headshot_url: headshotUrl,
      source_photo_url: m.headshot_url ?? null,
      role: "Viewer",
      eleven_voice_id: known?.eleven_voice_id ?? null,
      display_order: i,
    });
  }

  const profiles = await replaceProfilesForExperience(experienceId, experience.workspace_id, profileInserts);

  // Narrator reanchoring (Section 8, item 3): match by name across the
  // regeneration boundary, never by trusting a stale profileId.
  let narrator: Narrator | null = experience.narrator;
  if (narrator?.preferredName) {
    const match = profiles.find((p) => tokenMatch(narrator!.preferredName, p.name));
    narrator = match
      ? { ...narrator, profileId: match.id, name: match.name, title: match.title ?? narrator.title }
      : { ...narrator, profileId: null };
  } else if (!narrator && profiles.length > 0) {
    // gravel-road default: first detected leader opens the deck (Section 9)
    const first = profiles[0];
    narrator = {
      profileId: first.id,
      preferredName: first.name,
      name: first.name,
      title: first.title ?? "",
      voiceId: first.eleven_voice_id,
      videoUrl: first.replica_video_url,
    };
  }

  if (narrator !== experience.narrator) {
    await admin.from("experiences").update({ narrator }).eq("id", experienceId);
  }

  return NextResponse.json({ success: true, gravel: false, profiles, narrator });
}
