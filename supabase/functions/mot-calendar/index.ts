// ============================================================================
// MBU CAR SALES — MOT CALENDAR  (a calendar feed the phones subscribe to)
// ----------------------------------------------------------------------------
// Every car MBU still owns (for sale, reserved, drafts) with an MOT date, as a
// calendar: one all-day event on the day each MOT runs out, with a reminder
// two weeks before. The phone's calendar is given this link once (admin app →
// Tools → MOTs → Add to my calendar) and fetches it again by itself every few
// hours, so new dates, passes and sold cars show without doing anything.
// Sold cars drop off: their MOT is the buyer's.
//
// The link carries a long random code (?t=…) that the admin app makes and
// keeps in app_settings (key 'mot_feed', schema-v10). Without the right code
// this answers 401 and says nothing. "Make a new link" in the app changes the
// code, and every old link stops working.
//
// ----------------------------------------------------------------------------
// DEPLOY (no command line needed)
//   Supabase → Edge Functions → Deploy a new function
//   Name it exactly:  mot-calendar
//   Paste this file in. Deploy.
//
//   ⚠️ Then turn OFF "Enforce JWT verification" (Verify JWT) for this function.
//      A phone's calendar fetches the link with no login, so with that switch
//      on every fetch is refused. The code in the link is the lock instead.
//
//   No secrets to add: SUPABASE_URL and the service key are given to every
//   function by Supabase.
//
// TEST IT (after deploying, from Terminal):
//   curl -i https://<project-id>.supabase.co/functions/v1/mot-calendar
//   → 401. With the link from the app (Copy the link) → 200 and BEGIN:VCALENDAR.
// ============================================================================

// Any web page may read the answer (the admin app checks the function is
// there): without the code in the link it's only ever "401, no", so this
// gives nothing away. Phones' calendars don't use it either way.
const OPEN = { 'Access-Control-Allow-Origin': '*' };

const HEADERS_ICS: Record<string, string> = {
  ...OPEN,
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="mbu-mot-dates.ics"',
  'Cache-Control': 'private, max-age=900'
};

export type Car = {
  id: string; year?: number | null; make?: string | null; model?: string | null;
  registration?: string | null; mot_expiry?: string | null; status?: string | null;
};

function serverKey(): string | null {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
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

/** Same answer time whether the first or the last character is wrong. */
export function sameCode(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const plate = (r?: string | null) => {
  const s = String(r || '').toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(s) ? s.slice(0, 4) + ' ' + s.slice(4) : s;
};
const title = (c: Car) => [c.year, c.make, c.model].filter(Boolean).join(' ') || plate(c.registration) || 'A car';
const text = (t: string) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Lines over 75 characters carry on on the next line after a space (RFC 5545)
const fold = (l: string) => { let out = ''; while (l.length > 74) { out += l.slice(0, 74) + '\r\n '; l = l.slice(74); } return out + l; };
const ymd = (d: Date) => d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');

/** The calendar file. The same UID for a car every time, so a date that moves updates the event. */
export function calendar(cars: Car[], now = new Date(), site = 'https://mbucarsales.co.uk'): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const out = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MBU Car Sales//MOT dates//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:MBU MOT dates', 'X-WR-TIMEZONE:Europe/London',
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H', 'X-PUBLISHED-TTL:PT4H'
  ];
  for (const c of cars) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(c.mot_expiry || ''));
    if (!m) continue;
    const day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    const next = new Date(day.getTime() + 86400000);
    const name = title(c) + (c.registration ? ` (${plate(c.registration)})` : '');
    out.push('BEGIN:VEVENT',
      `UID:mot-${c.id}@mbucarsales.co.uk`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
      `SUMMARY:${text('MOT runs out: ' + name)}`,
      `DESCRIPTION:${text(`The MOT on the ${name} runs out today.${c.status === 'draft' ? ' (Not on the website yet.)' : ''}\nPassed already? Tools → MOTs → Passed, in the admin app: ${site}/admin/`)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'TRIGGER:-P14D', 'ACTION:DISPLAY', `DESCRIPTION:${text('MOT runs out in two weeks: ' + name)}`, 'END:VALARM',
      'END:VEVENT');
  }
  out.push('END:VCALENDAR');
  return out.map(fold).join('\r\n') + '\r\n';
}

const say = (status: number, body: string) => new Response(body, { status, headers: { ...OPEN, 'Content-Type': 'text/plain; charset=utf-8' } });

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return say(405, 'Use GET');
  const code = new URL(req.url).searchParams.get('t') || '';
  if (code.length < 32) return say(401, 'This calendar needs its full link.');

  const url = Deno.env.get('SUPABASE_URL');
  const key = serverKey();
  if (!url || !key) { console.error('mot-calendar: SUPABASE_URL or the service key is missing'); return say(500, 'Not set up.'); }
  const rest = (path: string) => fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
  });

  try {
    const s = await rest('app_settings?key=eq.mot_feed&select=value');
    if (!s.ok) { console.error('mot-calendar: settings', s.status, (await s.text()).slice(0, 200)); return say(503, 'Try again later.'); }
    const rows = await s.json();
    const token = rows && rows[0] && rows[0].value && rows[0].value.token;
    if (!sameCode(code, String(token || ''))) return say(401, 'This calendar link has been replaced. Add the new one from the admin app.');

    const c = await rest('cars?select=id,year,make,model,registration,mot_expiry,status&status=in.(available,reserved,draft)&mot_expiry=not.is.null&order=mot_expiry.asc');
    if (!c.ok) { console.error('mot-calendar: cars', c.status, (await c.text()).slice(0, 200)); return say(503, 'Try again later.'); }
    const body = calendar(await c.json());
    return new Response(req.method === 'HEAD' ? null : body, { status: 200, headers: HEADERS_ICS });
  } catch (err) {
    console.error('mot-calendar error', err);
    return say(503, 'Try again later.');
  }
}

// Only start the server when running inside Supabase; the tests import handle()
if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !(globalThis as any).__MOT_TEST__) {
  Deno.serve(handle);
}
