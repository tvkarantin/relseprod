import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36";
const IMG = "https://imginn.com";
const REGION = "ap-northeast-1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function decode(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16)))
    .replace(/&#(\d+);/g, (_, x) => String.fromCodePoint(parseInt(x, 10)))
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function usernameOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const value2 = value.trim().replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(value2) ? value2 : null;
}

function metric(value: string | null | undefined): number | null {
  const m = value?.trim().toLowerCase().replace(/,/g, "").match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmb])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const mul = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
  return Number.isFinite(n) ? Math.round(n * mul) : null;
}

function relativeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.trim().toLowerCase();
  if (text === "just now" || text.includes("minute") || text.includes("hour")) return new Date().toISOString();
  const m = text.match(/^(\d+)\s+(day|week|month|year)s?\s+ago$/);
  if (!m) return null;
  const amount = Number(m[1]);
  const d = new Date();
  if (m[2] === "day") d.setUTCDate(d.getUTCDate() - amount);
  else if (m[2] === "week") d.setUTCDate(d.getUTCDate() - amount * 7);
  else if (m[2] === "month") d.setUTCMonth(d.getUTCMonth() - amount);
  else d.setUTCFullYear(d.getUTCFullYear() - amount);
  return d.toISOString();
}

function exactDate(html: string): string | null {
  const m = (decode(html) || html).match(/\bon\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})\b/);
  if (!m) return null;
  const d = new Date(`${m[1]} 12:00:00 UTC`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function page(path: string) {
  const response = await fetch(`${IMG}${path}`, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  return { response, html: await response.text() };
}

function videoFrom(html: string) {
  return decode(html.match(/<video[^>]+src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<source[^>]+src=["']([^"']+)["']/i)?.[1] ?? null);
}

function posterFrom(html: string) {
  return decode(html.match(/<video[^>]+poster=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ?? null);
}

function serviceAuthorized(req: Request) {
  const expected = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const auth = req.headers.get("authorization") || "";
  const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!expected || expected.length !== supplied.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function stableAsset(code: string, kind: "media" | "thumbnail") {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  return base ? `${base}/functions/v1/instagram-imginn?${kind}=${encodeURIComponent(code)}&forceFunctionRegion=${REGION}` : null;
}

function cardsFrom(html: string) {
  const seen = new Set<string>();
  const cards: Array<{shortcode:string; thumbnail:string|null; caption:string|null; likes:number|null; comments:number|null; timestamp:string|null}> = [];
  for (const chunk of html.split('<div class="item">').slice(1)) {
    const shortcode = chunk.match(/href=["']\/p\/([A-Za-z0-9_-]+)\/?["']/i)?.[1];
    if (!shortcode || seen.has(shortcode)) continue;
    seen.add(shortcode);
    cards.push({
      shortcode,
      thumbnail: decode(chunk.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null),
      caption: decode(chunk.match(/<img[^>]+alt=["']([^"']*)["']/i)?.[1] ?? null),
      likes: metric(chunk.match(/class=["']likes["'][\s\S]*?<span>([^<]+)<\/span>/i)?.[1]),
      comments: metric(chunk.match(/class=["']comments["'][\s\S]*?<span>([^<]+)<\/span>/i)?.[1]),
      timestamp: relativeDate(chunk.match(/class=["']time["']>([^<]+)<\/div>/i)?.[1]),
    });
  }
  return cards;
}

async function reels(username: string, limit: number) {
  const listing = await page(`/reels/${encodeURIComponent(username)}/`);
  if (!listing.response.ok || !listing.html.toLowerCase().includes(`@${username.toLowerCase()}`)) {
    throw new Error(`listing_${listing.response.status}`);
  }
  const cards = cardsFrom(listing.html)
    .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
    .slice(0, Math.max(1, Math.min(limit, 50)));
  if (!cards.length) throw new Error("no_reels");

  return Promise.all(cards.map(async (card) => {
    try {
      const detail = await page(`/p/${encodeURIComponent(card.shortcode)}/`);
      if (!detail.response.ok) throw new Error(`detail_${detail.response.status}`);
      return {
        id: card.shortcode,
        shortCode: card.shortcode,
        url: `https://www.instagram.com/reel/${card.shortcode}/`,
        videoUrl: stableAsset(card.shortcode, "media") ?? videoFrom(detail.html),
        displayUrl: stableAsset(card.shortcode, "thumbnail") ?? card.thumbnail ?? posterFrom(detail.html),
        caption: card.caption,
        likesCount: card.likes,
        commentsCount: card.comments,
        timestamp: exactDate(detail.html) ?? card.timestamp,
        videoDuration: null,
        _provider: "imginn",
      };
    } catch {
      return {
        id: card.shortcode,
        shortCode: card.shortcode,
        url: `https://www.instagram.com/reel/${card.shortcode}/`,
        videoUrl: null,
        displayUrl: card.thumbnail,
        caption: card.caption,
        likesCount: card.likes,
        commentsCount: card.comments,
        timestamp: card.timestamp,
        videoDuration: null,
        _provider: "imginn",
      };
    }
  }));
}

async function proxyThumbnail(asset: string, code: string): Promise<Response> {
  const upstream = await fetch(asset, {
    headers: {
      "user-agent": UA,
      referer: `${IMG}/p/${encodeURIComponent(code)}/`,
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });
  if (!upstream.ok) return json({ error: "thumbnail_upstream_failed", status: upstream.status }, 502);
  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const media = url.searchParams.get("media");
    const thumbnail = url.searchParams.get("thumbnail");
    if (media || thumbnail) {
      const code = media || thumbnail || "";
      if (!/^[A-Za-z0-9_-]{3,64}$/.test(code)) return json({ error: "invalid_shortcode" }, 422);
      const detail = await page(`/p/${encodeURIComponent(code)}/`);
      if (!detail.response.ok) return json({ error: "asset_unavailable" }, 404);
      const asset = media ? videoFrom(detail.html) : posterFrom(detail.html);
      if (!asset) return json({ error: "asset_unavailable" }, 404);
      if (thumbnail) return proxyThumbnail(asset, code);
      return new Response(null, {
        status: 302,
        headers: { location: asset, "cache-control": "private, max-age=300", "access-control-allow-origin": "*" },
      });
    }
  }

  if (!serviceAuthorized(req)) return json({ error: "unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const username = usernameOf(body?.username);
  if (!username) return json({ error: "invalid_username" }, 422);
  const rawLimit = Number(body?.limit ?? 20);
  const limit = Math.min(50, Math.max(1, Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20));
  try {
    const items = await reels(username, limit);
    return json({ items, reelsAvailable: items.length > 0, provider: "imginn" });
  } catch (error) {
    return json({ error: "imginn_failed", message: error instanceof Error ? error.message : String(error) }, 502);
  }
});
