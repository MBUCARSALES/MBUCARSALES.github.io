// ============================================================================
// MBU CAR SALES — TRACK  (interest events from the public website)
// ----------------------------------------------------------------------------
// Every "someone looked at / tapped / enquired about this car" event from the
// website comes through here instead of going straight into the database.
//
// Three jobs the browser can't be trusted with:
//
//   1. COUNT PEOPLE, NOT PAGE LOADS, WITHOUT STORING ANYTHING ON THEIR PHONE
//      visitor_hash = sha256(secret + today's date + IP address + browser)
//      Only the scrambled result is kept. The IP address is never written
//      anywhere. The date is part of the recipe, so tomorrow the same person
//      gets a completely different code and can't be followed day to day.
//      Nothing is stored on the visitor's device, so still no cookie banner.
//
//   2. LEAVE BOTS OUT
//      Crawlers, link previewers and automated browsers are flagged is_bot and
//      left out of every figure. They're kept rather than binned, so you can
//      see how much of it there is.
//
//   3. KEEP JUNK OUT
//      Only known event types, only real car ids, sensible sizes, and a cap on
//      how many events one visitor can send in ten minutes.
//
// ----------------------------------------------------------------------------
// DEPLOY (no command line needed)
//   Supabase → Edge Functions → Deploy a new function
//   Name it exactly:  track
//   Paste this file in. Deploy.
//
//   ⚠️ Then turn OFF "Enforce JWT verification" (Verify JWT) for this function.
//      The website calls it with no key at all, so with that switch on every
//      single event is refused with a 401. Nothing here needs a login: it only
//      ever inserts, and it checks everything it inserts.
//
// SECRETS (Edge Functions → Secrets) — optional
//   TRACK_SALT     any long random string. If you don't set one, a salt is
//                  derived from the project's own server key, which works just
//                  as well. Changing it only means today's visitors start
//                  counting afresh.
//
//   SUPABASE_URL and the service role key are provided to every function by
//   Supabase automatically.
//
// TEST IT (from Terminal, after deploying):
//   curl -i -X POST https://<project-id>.supabase.co/functions/v1/track \
//     -H 'Content-Type: text/plain' \
//     -d '{"events":[{"car_id":"<a real car id>","event_type":"view"}]}'
//   → HTTP 204. Then in SQL:  select * from car_events where tracking_v = 2;
// ============================================================================

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

// Must match the check constraint in schema-v6-tracking.sql
export const EVENT_TYPES = new Set([
  'view', 'card_click', 'gallery_open',
  'whatsapp_click', 'phone_click', 'email_click',
  'enquire_click', 'enquiry_start', 'enquiry_sent',
  'interest_sent', 'share',
  'engagement', 'video_play'
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8_000;
const MAX_EVENTS = 10;

/* ---------------------------------------------------------------------------
   BOTS
   Most crawlers never run JavaScript, so they never reach this function in
   the first place. These are the ones that do (Googlebot renders pages, and
   scrapers use headless Chrome), plus plain HTTP tools pretending otherwise.
   --------------------------------------------------------------------------- */
// Messaging-app link previewers (WhatsApp, Telegram, Slack) are deliberately
// NOT listed: they never run JavaScript so they can't reach this, and their
// in-app browsers can carry the app's name, which would flag real customers.
// "bot" is matched as a word ending so a Cubot phone isn't mistaken for one.
const BOT_UA = new RegExp([
  '(?<!cu)bot(?:[/;)\\s_-]|$)', 'crawl', 'spider', 'slurp', 'mediapartners',
  'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 'webdriver',
  'lighthouse', 'pagespeed', 'gtmetrix', 'pingdom', 'uptimerobot', 'statuscake',
  'facebookexternalhit', 'facebookcatalog', 'google web preview', 'embedly',
  'python', 'curl/', 'wget', 'go-http', 'java/', 'okhttp', 'axios', 'node-fetch',
  'undici', 'httpclient', 'libwww', 'scrapy', 'feedfetcher', 'bingpreview'
].join('|'), 'i');

export function isBot(ua: string, webdriver: unknown): boolean {
  if (!ua || ua.length < 20) return true;      // real browsers always send a long one
  if (webdriver === true) return true;         // navigator.webdriver, reported by the page
  return BOT_UA.test(ua);
}

export function deviceOf(ua: string): string {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function clientIp(h: Headers): string {
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return h.get('cf-connecting-ip') ?? h.get('x-real-ip') ?? '';
}

export async function visitorHash(salt: string, day: string, ip: string, ua: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${day}|${ip}|${ua}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const intIn = (v: unknown, lo: number, hi: number): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};
const shortText = (v: unknown, max: number, pattern?: RegExp): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim().slice(0, max);
  if (!s) return null;
  return pattern && !pattern.test(s) ? null : s;
};

/** One event from the page → one row for car_events, or null to drop it. */
export function cleanEvent(raw: any) {
  if (!raw || typeof raw !== 'object') return null;
  const car_id = typeof raw.car_id === 'string' ? raw.car_id.toLowerCase() : '';
  const event_type = String(raw.event_type || '');
  if (!UUID.test(car_id) || !EVENT_TYPES.has(event_type)) return null;

  let meta: Record<string, unknown> | null = null;
  if (raw.meta && typeof raw.meta === 'object' && !Array.isArray(raw.meta)) {
    const text = JSON.stringify(raw.meta);
    if (text.length <= 1000) meta = raw.meta;
  }

  const engagement = event_type === 'engagement';
  return {
    car_id,
    event_type,
    source: shortText(raw.source, 40),
    page_id: shortText(raw.page_id, 32, /^[a-z0-9]+$/i),
    duration_ms: engagement ? intIn(raw.duration_ms, 0, 1_800_000) : null,
    photos_seen: engagement ? intIn(raw.photos_seen, 0, 500) : null,
    photo_count: engagement ? intIn(raw.photo_count, 0, 500) : null,
    meta
  };
}

/* ---------------------------------------------------------------------------
   Best-effort flood control. Each running copy of the function remembers who
   sent what in the last ten minutes. It won't stop someone determined with a
   thousand IP addresses, but it stops a script hammering the endpoint from
   one machine turning into a thousand fake views.
   --------------------------------------------------------------------------- */
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 150;
const recent = new Map<string, { start: number; n: number }>();

export function allow(hash: string, count: number, now = Date.now()): boolean {
  if (recent.size > 5000) {
    for (const [k, v] of recent) if (now - v.start > WINDOW_MS) recent.delete(k);
  }
  const r = recent.get(hash);
  if (!r || now - r.start > WINDOW_MS) { recent.set(hash, { start: now, n: count }); return count <= MAX_PER_WINDOW; }
  r.n += count;
  return r.n <= MAX_PER_WINDOW;
}

function serverKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  // Projects on the newer key system may only get the sb_secret_ keys, as JSON
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      const first = parsed.default ?? Object.values(parsed)[0];
      if (typeof first === 'string') return first;
    } catch { /* fall through */ }
  }
  return null;
}

async function saltFor(key: string): Promise<string> {
  const own = Deno.env.get('TRACK_SALT');
  if (own) return own;
  // Derived, never the key itself, so the key can't be worked backwards from a hash
  return await visitorHash('mbu-track-salt', 'v1', key, '');
}

const done = () => new Response(null, { status: 204, headers: CORS });

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return new Response('Use POST', { status: 405, headers: CORS });

  const url = Deno.env.get('SUPABASE_URL');
  const key = serverKey();
  if (!url || !key) {
    console.error('track: SUPABASE_URL or the service key is missing');
    return done();                  // never break the website over tracking
  }

  let body: any;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return done();
    body = JSON.parse(text);
  } catch {
    return done();
  }

  const events = (Array.isArray(body?.events) ? body.events : [body])
    .slice(0, MAX_EVENTS).map(cleanEvent).filter(Boolean);
  if (!events.length) return done();

  const ua = (req.headers.get('user-agent') ?? '').slice(0, 400);
  const bot = isBot(ua, body?.wd);
  const day = new Date().toISOString().slice(0, 10);
  const hash = await visitorHash(await saltFor(key), day, clientIp(req.headers), ua);

  if (!allow(hash, events.length)) return done();

  const device = deviceOf(ua);
  const rows = events.map(e => ({
    ...e,
    tracking_v: 2,
    visitor_hash: hash,
    session_key: e!.page_id,        // older views count distinct session_key
    device,
    is_bot: bot
  }));

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/car_events`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      // 23503 = that car id doesn't exist (deleted car, old link). Not worth logging.
      const detail = await res.text();
      if (!/23503/.test(detail)) console.error('track insert failed', res.status, detail.slice(0, 300));
    }
  } catch (err) {
    console.error('track insert error', err);
  }
  return done();
}

// Only start the server when running inside Supabase. The tests import
// handle() and the helpers without opening a port.
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !(globalThis as any).__TRACK_TEST__) {
  Deno.serve(handle);
}
