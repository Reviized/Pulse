/**
 * The real REViiZED Digital Replica API contract (Section 7 of the master
 * prompt, source: REViiZED API Documentation v1.1,
 * https://app.reviized.io/api/v1/swagger/). Server-only — the JWT exchange
 * never touches the client (CLAUDE.md hard-won lesson 6 / Section 11 item
 * 13). Every export here throws ReviizedUnavailable when
 * REVIIZED_USERNAME/REVIIZED_PASSWORD aren't configured, matching the same
 * gravel-road shape as lib/anthropic.ts's AnthropicUnavailable — callers
 * catch it and degrade to a labeled gravel response.
 */

const BASE_URL = "https://app.reviized.io/api/v1";

export class ReviizedUnavailable extends Error {}
export class ReviizedApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type TokenCache = { access: string; refresh: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

// Section 7 rate limits: render endpoint 3/minute/user, instant 1/minute/user.
// Poll GET /v1/jobs/{id}/ at most once per minute. Tracked per-process, which
// is the same "server memory, not durable" tradeoff the token cache makes.
const renderCallTimestamps: number[] = [];
const lastPollAtByJobId = new Map<number, number>();

function credentials(): { username: string; password: string } {
  const username = process.env.REVIIZED_USERNAME;
  const password = process.env.REVIIZED_PASSWORD;
  if (!username || !password) {
    throw new ReviizedUnavailable("REVIIZED_USERNAME/PASSWORD not configured");
  }
  return { username, password };
}

async function fetchToken(): Promise<TokenCache> {
  const { username, password } = credentials();
  const res = await fetch(`${BASE_URL}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new ReviizedApiError(res.status, `REViiZED token exchange failed (${res.status})`);
  }
  const data = await res.json();
  // Access tokens expire after 30 minutes (Section 7) — refresh a minute early.
  return { access: data.access, refresh: data.refresh, expiresAt: Date.now() + 29 * 60 * 1000 };
}

async function refreshToken(cache: TokenCache): Promise<TokenCache> {
  const res = await fetch(`${BASE_URL}/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: cache.refresh }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return fetchToken(); // refresh token itself expired, re-authenticate from scratch
  const data = await res.json();
  return { access: data.access, refresh: cache.refresh, expiresAt: Date.now() + 29 * 60 * 1000 };
}

async function getAccessToken(): Promise<string> {
  if (!tokenCache) tokenCache = await fetchToken();
  else if (Date.now() >= tokenCache.expiresAt) tokenCache = await refreshToken(tokenCache);
  return tokenCache.access;
}

/**
 * Authenticated fetch with the documented error handling (Section 7):
 * 401 -> refresh and retry once. 403 -> surface, never retry. 404 -> surface
 * clearly, the id is wrong. 429 -> surface, caller must not tighten polling.
 */
async function reviizedFetch(path: string, init: RequestInit = {}, isRetry = false): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (res.status === 401 && !isRetry) {
    tokenCache = null;
    return reviizedFetch(path, init, true);
  }
  if (res.status === 403) {
    throw new ReviizedApiError(403, "REViiZED denied this request (403) — check account permissions");
  }
  if (res.status === 404) {
    throw new ReviizedApiError(404, "REViiZED returned 404 — the project, video, or voice id is wrong");
  }
  if (res.status === 429) {
    throw new ReviizedApiError(429, "REViiZED rate limit hit (429) — wait at least a minute before retrying");
  }
  return res;
}

export type ReviizedJob = {
  id: number;
  status: "HOLD" | "REQUESTED" | "IN_PROCESS" | "FINALIZING" | "COMPLETE" | "ERROR";
  output?: { url?: string } | null;
};

export async function createJob(payload: {
  project: number;
  name: string;
  script: string;
  video: number;
  voice: number;
  language?: string;
  notes?: string;
  favorite?: boolean;
}): Promise<ReviizedJob> {
  const res = await reviizedFetch("/jobs/create/", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) throw new ReviizedApiError(res.status, `jobs/create failed (${res.status})`);
  return res.json();
}

export async function renderJob(jobId: number, force = false): Promise<void> {
  const now = Date.now();
  while (renderCallTimestamps.length && now - renderCallTimestamps[0] > 60_000) renderCallTimestamps.shift();
  if (renderCallTimestamps.length >= 3) {
    throw new ReviizedApiError(429, "local render-call guard: 3/minute cap already hit, wait before retrying");
  }
  renderCallTimestamps.push(now);

  const res = await reviizedFetch(`/jobs/${jobId}/render/`, {
    method: "PATCH",
    body: JSON.stringify({ force }),
  });
  if (!res.ok) throw new ReviizedApiError(res.status, `jobs/${jobId}/render failed (${res.status})`);
}

/**
 * The "poll at most once per minute" throttle (Section 7) is enforced by
 * the caller (app/api/replica/reviized/[id]/status/route.ts) against our
 * own replica_jobs.updated_at, since that's the durable source of "when did
 * we last actually check" across requests — this in-process map is only a
 * same-instance backstop against a tight client-side retry loop.
 */
export async function getJobStatus(jobId: number): Promise<ReviizedJob> {
  const last = lastPollAtByJobId.get(jobId) ?? 0;
  if (Date.now() - last < 5_000) {
    throw new ReviizedApiError(429, "polled the same job twice within 5s, slow down");
  }
  lastPollAtByJobId.set(jobId, Date.now());

  const res = await reviizedFetch(`/jobs/${jobId}/`);
  if (!res.ok) throw new ReviizedApiError(res.status, `jobs/${jobId} lookup failed (${res.status})`);
  return res.json();
}

export type ReviizedLookups = {
  projects: { id: number; name: string }[];
  videos: { id: number; name: string }[];
  voices: { id: number; name: string }[];
};

let lookupsCache: { data: ReviizedLookups; at: number } | null = null;
const LOOKUPS_TTL_MS = 10 * 60 * 1000;

async function fetchPaginated(path: string): Promise<{ id: number; name: string }[]> {
  const out: { id: number; name: string }[] = [];
  let next: string | null = `${BASE_URL}${path}`;
  while (next) {
    const res: Response = await reviizedFetch(next.replace(BASE_URL, ""));
    if (!res.ok) throw new ReviizedApiError(res.status, `${path} failed (${res.status})`);
    const data = await res.json();
    for (const item of data.results ?? data) {
      out.push({ id: item.id, name: item.name ?? item.title ?? `#${item.id}` });
    }
    next = data.next ?? null;
    if (out.length > 200) break; // sane cap, these are meant to be cached selector lists
  }
  return out;
}

/** Section 7: "call once, cache" for projects/videos/voices. */
export async function getLookups(forceRefresh = false): Promise<ReviizedLookups> {
  if (!forceRefresh && lookupsCache && Date.now() - lookupsCache.at < LOOKUPS_TTL_MS) {
    return lookupsCache.data;
  }
  const [projects, videos, voices] = await Promise.all([
    fetchPaginated("/projects/"),
    fetchPaginated("/videos/"),
    fetchPaginated("/voices/"),
  ]);
  const data = { projects, videos, voices };
  lookupsCache = { data, at: Date.now() };
  return data;
}
