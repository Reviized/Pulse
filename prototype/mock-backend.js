/* Contract mock of the Supabase backend for wiring verification only.
   Implements the same REST/functions shapes the page calls. */
const http = require("http");
const { URL } = require("url");

const state = { experiences: {}, nextSlideRows: {} };

/* seed: two pre-existing experiences, one without slides */
function seed() {
  const now = new Date().toISOString();
  state.experiences["exp-seed-1"] = {
    row: {
      id: "exp-seed-1", name: "Acme Industrial", company_name: "Acme Industrial Group",
      source_url: "https://acme.example.com", mode: "inform", status: "active",
      scrape_data: { pages: 12 }, brand_colors: { primary: "#7A5CFF", secondary: "#2B2B33" },
      brand_logo_url: null,
      executives: [{ exec_id: "exec_001", name: "Dana Reyes", title: "Chief Executive Officer", role_priority: 1 }],
      scrape_completed_at: now, brief_generated_at: now, slides_generated_at: now, created_at: now
    },
    slides: [
      { id: "sl-a1", experience_id: "exp-seed-1", slide_number: 0, layout_type: "text_only", eyebrow: "welcome", headline: "Acme Industrial Group", body: "Built from the live website.", created_at: now },
      { id: "sl-a2", experience_id: "exp-seed-1", slide_number: 1, layout_type: "media_full", headline: "A word from Dana", script_text: "We move heavy things carefully.", assigned_exec_id: "exec_001", audio_url: "http://127.0.0.1:9971/storage/test.wav", created_at: now },
      { id: "sl-a3", experience_id: "exp-seed-1", slide_number: 2, layout_type: "stats", headline: "The numbers", items: [{ value: "34", label: "Years running" }, { value: "980", label: "Projects delivered" }], created_at: now }
    ]
  };
  state.experiences["exp-seed-2"] = {
    row: { id: "exp-seed-2", name: "emptyco.com", company_name: null, source_url: "https://emptyco.com", mode: "inform", status: "draft", created_at: now },
    slides: []
  };
}
seed();

function makeExperience(id, url) {
  const t0 = Date.now();
  const host = new URL(url).hostname.replace(/^www\./, "");
  const rec = {
    createdAtMs: t0,
    row: { id, name: host, company_name: null, source_url: url, mode: "inform", status: "draft", created_at: new Date().toISOString() },
    slides: []
  };
  state.experiences[id] = rec;
  return rec;
}

/* progressive pipeline simulation on the mock side */
function materialize(rec) {
  if (!rec.createdAtMs) return;
  const el = Date.now() - rec.createdAtMs;
  const r = rec.row;
  if (el > 2000 && !r.scrape_completed_at) {
    r.scrape_completed_at = new Date().toISOString();
    r.scrape_data = { pages: 9, chars: 41200 };
    r.company_name = "Wichita State University";
  }
  if (el > 3500 && !r.brand_colors) {
    r.brand_colors = { primary: "#FFCD00", secondary: "#000000" };
    r.executives = [{ exec_id: "exec_001", name: "Rick Muma", title: "President", role_priority: 1 }];
  }
  if (el > 5000 && !r.creative_brief) {
    r.creative_brief = { slides: 5 };
    r.brief_generated_at = new Date().toISOString();
  }
  if (el > 6500 && rec.slides.length === 0) {
    const now = new Date().toISOString();
    rec.slides = [
      { id: "sl-1", experience_id: r.id, slide_number: 0, layout_type: "text_only", eyebrow: "a pulse experience", headline: r.company_name, body: "Generated from the live scrape of " + r.source_url, created_at: now },
      { id: "sl-2", experience_id: r.id, slide_number: 1, layout_type: "media_full_frame", headline: "A message from the President", script_text: "Welcome. Everything you are about to see came off our real website minutes ago.", assigned_exec_id: "exec_001", audio_url: "http://127.0.0.1:9971/storage/test.wav", created_at: now },
      { id: "sl-3", experience_id: r.id, slide_number: 2, layout_type: "split", eyebrow: "what we do", headline: "Programs that work", body: "Applied learning, real employers, real outcomes.", chips: ["Engineering", "Business", "Health"], created_at: now },
      { id: "sl-4", experience_id: r.id, slide_number: 3, layout_type: "stats", headline: "By the numbers", items: [{ value: "23k", label: "Students" }, { value: "300+", label: "Programs" }, { value: "$400M", label: "Research" }], created_at: now },
      { id: "sl-5", experience_id: r.id, slide_number: 4, layout_type: "waveform", eyebrow: "in their words", headline: "Hear the campus", body: "Narration renders via ElevenLabs in the live build.", audio_url: "http://127.0.0.1:9971/storage/test.wav", created_at: now }
    ];
    r.slides_generated_at = now;
  }
}

function silentWav() {
  const samples = 800, rate = 8000;
  const buf = Buffer.alloc(44 + samples);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples, 4); buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples, 40);
  buf.fill(128, 44);
  return buf;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://127.0.0.1:9971");
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, prefer",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Range"
  };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); res.end(); return; }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let parsed = {};
    try { parsed = body ? JSON.parse(body) : {}; } catch (e) {}
    const send = (code, data, extra) =>  {
      res.writeHead(code, Object.assign({ "Content-Type": "application/json" }, cors, extra || {}));
      res.end(JSON.stringify(data));
    };

    Object.values(state.experiences).forEach(materialize);

    if (u.pathname === "/storage/test.wav") {
      res.writeHead(200, Object.assign({ "Content-Type": "audio/wav" }, cors));
      res.end(silentWav());
      return;
    }
    if (u.pathname === "/rest/v1/experiences" && req.method === "GET") {
      const idEq = (u.searchParams.get("id") || "").replace("eq.", "");
      let rows = Object.values(state.experiences).map((r) => r.row);
      if (idEq) rows = rows.filter((r) => r.id === idEq);
      rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      send(200, rows, { "Content-Range": "0-" + rows.length + "/" + rows.length });
      return;
    }
    if (u.pathname === "/rest/v1/experiences" && req.method === "POST") {
      const id = "exp-rest-" + Math.random().toString(36).slice(2, 8);
      const rec = makeExperience(id, parsed.source_url || "https://x.example.com");
      send(201, [rec.row]);
      return;
    }
    if (u.pathname === "/rest/v1/slides" && req.method === "GET") {
      const expEq = (u.searchParams.get("experience_id") || "").replace("eq.", "");
      const rec = state.experiences[expEq];
      send(200, rec ? rec.slides : []);
      return;
    }
    if (u.pathname === "/rest/v1/leads" && req.method === "POST") { send(201, []); return; }
    if (u.pathname === "/functions/v1/pulse-experiences" && req.method === "POST") {
      if (!parsed.url) { send(400, { error: "url required" }); return; }
      const id = "exp-fn-" + Math.random().toString(36).slice(2, 8);
      makeExperience(id, parsed.url);
      send(200, { success: true, experience_id: id });
      return;
    }
    if (/^\/functions\/v1\/pulse-(scrape|design-dna|brief|slides-generate)$/.test(u.pathname)) {
      send(200, { success: true, step: u.pathname.split("/").pop() });
      return;
    }
    send(404, { error: "not found: " + req.method + " " + u.pathname });
  });
});
server.listen(9971, "127.0.0.1", () => console.log("mock backend on 9971"));
