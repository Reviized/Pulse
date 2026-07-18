import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const experienceId = typeof body?.experienceId === "string" ? body.experienceId : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";

  if (!experienceId || !email || !code) {
    return NextResponse.json({ error: "experienceId, email, and code are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    // gravel road: unlock anyway so a live demo never dead-ends on a missing key,
    // but never claim the lead was actually saved
    return NextResponse.json({
      success: true,
      gravel: true,
      unlocked: true,
      sessionKey: crypto.randomUUID(),
      reason: "SUPABASE_SERVICE_ROLE_KEY not configured, lead was not saved",
    });
  }

  const { data: experience } = await admin
    .from("experiences")
    .select("access_code")
    .eq("id", experienceId)
    .maybeSingle();
  if (!experience) return NextResponse.json({ error: "experience not found" }, { status: 404 });

  if (code.toUpperCase() !== experience.access_code.toUpperCase()) {
    return NextResponse.json({ success: true, unlocked: false, error: "That access code doesn't match." });
  }

  const { error } = await admin.from("leads").insert({ experience_id: experienceId, email });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, gravel: false, unlocked: true, sessionKey: crypto.randomUUID() });
}
