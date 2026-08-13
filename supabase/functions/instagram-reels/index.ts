import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SECRET_KEY = "instagram_edge_token";
const IMG_INN_REGION = "ap-northeast-1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(raw) ? raw : null;
}

async function expectedInternalToken(): Promise<string | null> {
  const base = Deno.env.get("SUPABASE_URL");
  const role = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !role) return null;
  const response = await fetch(`${base}/rest/v1/internal_service_secrets?key=eq.${SECRET_KEY}&select=value&limit=1`, {
    headers: { apikey: role, authorization: `Bearer ${role}`, accept: "application/json" },
  });
  if (!response.ok) return null;
  const rows = await response.json();
  const value = Array.isArray(rows) ? rows[0]?.value : null;
  return typeof value === "string" && value ? value : null;
}

async function authorized(req: Request) {
  const supplied = req.headers.get("x-internal-token") || "";
  const expected = await expectedInternalToken();
  if (!supplied || !expected || supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function imginn(username: string, limit: number) {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !serviceRole) throw new Error("supabase_server_credentials_missing");
  const response = await fetch(`${base}/functions/v1/instagram-imginn?forceFunctionRegion=${IMG_INN_REGION}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceRole}` },
    body: JSON.stringify({ username, limit }),
  });
  let payload: any = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok || !payload || !Array.isArray(payload.items)) {
    throw new Error(`imginn_${response.status}_${payload?.message ?? payload?.error ?? "invalid_response"}`);
  }
  return payload.items;
}

Deno.serve(async req => {
  if (!(await authorized(req))) return json({ error: "unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body:any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const username = normalizeUsername(body?.username);
  if (!username) return json({ error: "invalid_username" }, 422);
  const rawLimit = Number(body?.limit ?? 20);
  const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20));
  const mode = body?.mode === "summary" ? "summary" : "reels";

  try {
    const items = await imginn(username, limit);
    if (mode === "summary") {
      return json({
        profile: { username, displayName: username, avatarUrl: items[0]?.displayUrl ?? null, followers: null, publications: null },
        items,
        reelsAvailable: items.length > 0,
        provider: "imginn",
        providerRegion: IMG_INN_REGION,
      });
    }
    return json({ items, reelsAvailable: items.length > 0, provider: "imginn", providerRegion: IMG_INN_REGION });
  } catch (error) {
    return json({
      error: "instagram_reels_fetch_failed",
      diagnostics: { provider: "imginn", region: IMG_INN_REGION, detail: error instanceof Error ? error.message : String(error) },
    }, 502);
  }
});
