// ============================================================================
// MBU CAR SALES — AUTO TRADER CONNECT  (read-only)
// ----------------------------------------------------------------------------
// The one place that talks to Auto Trader. The admin app never sees the key or
// secret: it asks this function, this function asks Auto Trader.
//
// What it does, all READ-ONLY:
//   lookup   plate (+ mileage) → the exact car, MOT history, valuations,
//            Retail Rating and days to sell, and what similar cars are
//            advertised at. Powers the Value tab at the auction.
//   market   the same for a car you already have, plus where YOUR asking
//            price sits on Auto Trader's price indicator (LOW → HIGH) and
//            the price bands. Powers "you're £300 above the market".
//   stock    what's live on your Auto Trader account, with their price
//            indicator and advert views. Nothing is changed.
//   status   are the credentials in, and do they work?
//
// It deliberately does NOT create, edit or remove adverts. Pushing stock to a
// live marketplace should be built and tested against the sandbox once access
// is granted, not written blind. See ROADMAP.md §4a for how sync should work.
//
// ----------------------------------------------------------------------------
// ONE DEALER NOW, MANY LATER
//   Auto Trader ties API access to each dealer's own advertiser account, so
//   this can never be a shared platform key. Today the credentials are this
//   project's function secrets, which is right for one dealer. For a second
//   dealer, move them to a per-tenant row (Supabase Vault) and look them up by
//   the caller's tenant here. Nothing else in the app needs to change.
//
// ----------------------------------------------------------------------------
// DEPLOY (no command line needed)
//   Supabase → Edge Functions → Deploy a new function
//   Name it exactly:  autotrader
//   Paste this file in. Deploy. Leave JWT verification ON (the default): only
//   signed-in admins may call it, and it double-checks that itself.
//
// SECRETS (Edge Functions → Secrets), from Auto Trader once approved:
//   AT_KEY            your API key
//   AT_SECRET         your API secret
//   AT_ADVERTISER_ID  your advertiser id
//   AT_ENV            sandbox  (what they give you first)  or  production
//
//   ⚠️ Auto Trader deletes credentials that go unused for 90 days, in sandbox
//      and production alike.
//
// Docs this follows: https://developers.autotrader.co.uk/api
// ============================================================================

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class AtError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/* ---------------------------------------------------------------- config */
export function atConfig() {
  const key = Deno.env.get('AT_KEY') ?? '';
  const secret = Deno.env.get('AT_SECRET') ?? '';
  const advertiserId = Deno.env.get('AT_ADVERTISER_ID') ?? '';
  const env = (Deno.env.get('AT_ENV') ?? 'sandbox').toLowerCase() === 'production' ? 'production' : 'sandbox';
  const base = env === 'production' ? 'https://api.autotrader.co.uk' : 'https://api-sandbox.autotrader.co.uk';
  return { key, secret, advertiserId, env, base, configured: !!(key && secret && advertiserId) };
}

/* ------------------------------------------------------------ auth token
   Tokens last 15 minutes. Auto Trader ask that you don't authenticate before
   every request, so keep one until a minute before it runs out. */
let token: { value: string; expires: number } | null = null;

async function getToken(cfg: ReturnType<typeof atConfig>, force = false): Promise<string> {
  if (!force && token && token.expires > Date.now() + 60_000) return token.value;
  const res = await fetch(`${cfg.base}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ key: cfg.key, secret: cfg.secret })
  });
  if (!res.ok) {
    console.error('AT authenticate', res.status, (await res.text()).slice(0, 300));
    throw new AtError(502, 'Auto Trader refused the key and secret. Check AT_KEY and AT_SECRET, and AT_ENV matches the credentials (sandbox or production).', 'auth');
  }
  const data = await res.json();
  const expires = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 14 * 60_000;
  token = { value: data.access_token, expires };
  return token.value;
}

async function atFetch(cfg: ReturnType<typeof atConfig>, path: string, init: RequestInit = {}, retried = false): Promise<any> {
  const t = await getToken(cfg);
  const res = await fetch(`${cfg.base}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init.headers || {}), Authorization: `Bearer ${t}` }
  });
  if (res.status === 401 && !retried) {
    token = null;
    return atFetch(cfg, path, init, true);
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 400);
    console.error('AT', init.method || 'GET', path.split('?')[0], res.status, text, res.headers.get('cf-ray') ?? '');
    if (res.status === 403) throw new AtError(403, 'Auto Trader says this account isn’t set up for that yet. It may not be included in your package or integration.', 'forbidden');
    if (res.status === 404) throw new AtError(404, 'Auto Trader has no record for that.', 'not_found');
    if (res.status === 429) throw new AtError(429, 'Auto Trader is limiting requests. Try again in a minute.', 'rate_limited');
    if (res.status === 400) throw new AtError(400, 'Auto Trader couldn’t use that request: ' + text.slice(0, 160), 'bad_request');
    throw new AtError(502, `Auto Trader returned an error (${res.status}).`, 'upstream');
  }
  return res.json();
}

/* ------------------------------------------------------------- shaping
   Auto Trader is moving the Vehicles API response from a root `vehicle` to
   `results[0].vehicle` (compulsory from 30 Nov 2026). Accept both. */
export function recordOf(data: any): any | null {
  if (!data) return null;
  if (Array.isArray(data.results)) return data.results[0] ?? null;
  return data.vehicle ? data : null;
}

const gbp = (o: any): number | null => (o && typeof o.amountGBP === 'number' ? o.amountGBP : null);
const val = (o: any): number | null => (o && typeof o.value === 'number' ? Math.round(o.value * 10) / 10 : null);

export function valuationsOf(v: any) {
  if (!v) return null;
  const src = v.adjusted ?? v.marketAverage ?? v;      // stock listings give both
  const out = {
    retail: gbp(src.retail), trade: gbp(src.trade),
    partExchange: gbp(src.partExchange), private: gbp(src.private)
  };
  return Object.values(out).some(n => n != null) ? out : null;
}

export function metricsOf(m: any) {
  if (!m) return null;
  const nat = m.national?.retail ?? m.retail ?? {};
  const loc = m.local?.retail ?? {};
  const pick = (k: string) => val(nat[k]) ?? val(m[k]);
  const out = {
    rating: pick('rating'), daysToSell: pick('daysToSell'),
    supply: pick('supply'), demand: pick('demand'), marketCondition: pick('marketCondition'),
    localRating: val(loc.rating), localDaysToSell: val(loc.daysToSell)
  };
  return Object.values(out).some(n => n != null) ? out : null;
}

/* ------------------------------------------------------ MOT history
   Same output shape as the vehicle-lookup function, so the Value tab draws
   either without caring where it came from. Auto Trader returns the MOT data
   as motTests[] with rfrAndComments[] instead of DVSA's defects[]. */
export function analyseMot(tests: any[] | undefined) {
  if (!Array.isArray(tests) || !tests.length) return null;
  const sorted = tests.slice().sort((a, b) =>
    new Date(a.completedDate || 0).getTime() - new Date(b.completedDate || 0).getTime());

  const readings: { date: string; miles: number; result: string }[] = [];
  for (const t of sorted) {
    if (t.odometerValue == null) continue;
    let miles = parseInt(String(t.odometerValue).replace(/[^0-9]/g, ''), 10);
    if (isNaN(miles)) continue;
    if (/^k/i.test(String(t.odometerUnit || ''))) miles = Math.round(miles * 0.621371);
    readings.push({ date: t.completedDate, miles, result: String(t.testResult || '').toUpperCase() });
  }

  const discrepancies: { from: string; to: string; drop: number }[] = [];
  for (let i = 1; i < readings.length; i++) {
    if (readings[i].miles < readings[i - 1].miles - 50) {
      discrepancies.push({ from: readings[i - 1].date, to: readings[i].date, drop: readings[i - 1].miles - readings[i].miles });
    }
  }

  let recentMilesPerYear: number | null = null;
  const cutoff = Date.now() - 3 * 31_557_600_000;
  const recent = readings.filter(r => new Date(r.date).getTime() >= cutoff);
  if (recent.length >= 2) {
    const y = (new Date(recent[recent.length - 1].date).getTime() - new Date(recent[0].date).getTime()) / 31_557_600_000;
    if (y > 0.4) recentMilesPerYear = Math.round((recent[recent.length - 1].miles - recent[0].miles) / y);
  }

  const passes = sorted.filter(t => /^pass/i.test(t.testResult || '')).length;
  const fails = sorted.filter(t => /^fail/i.test(t.testResult || '')).length;
  const latest = sorted[sorted.length - 1];
  const items = (t: any) => (Array.isArray(t?.rfrAndComments) ? t.rfrAndComments : []);
  const currentAdvisories = items(latest)
    .filter((d: any) => /advisory|minor/i.test(d.type || ''))
    .map((d: any) => String(d.text || '').trim()).filter(Boolean);

  const counts: Record<string, number> = {};
  for (const t of sorted.slice(-4)) {
    for (const d of items(t)) {
      const k = String(d.text || '').toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z ]/g, '').trim().slice(0, 60);
      if (k) counts[k] = (counts[k] || 0) + 1;
    }
  }
  const recurring = Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1])
    .slice(0, 5).map(([text, times]) => ({ text, times }));

  return {
    latestMileage: readings.length ? readings[readings.length - 1].miles : null,
    latestTestDate: latest?.completedDate ?? null,
    motExpiryDate: latest?.expiryDate ?? null,
    readings, discrepancies, recentMilesPerYear,
    testCount: sorted.length, passes, fails,
    passRate: sorted.length ? Math.round((passes / sorted.length) * 100) : null,
    currentAdvisories,
    dangerous: items(latest).some((d: any) => d.dangerous === true),
    recurring
  };
}

/** Plain-English warnings, worst first. Read in the auction hall. */
export function buildFlags(mot: ReturnType<typeof analyseMot>, metrics: ReturnType<typeof metricsOf>) {
  const flags: { level: 'bad' | 'warn' | 'ok'; text: string }[] = [];
  if (mot?.discrepancies?.length) {
    const worst = mot.discrepancies.reduce((a, b) => (a.drop > b.drop ? a : b));
    flags.push({ level: 'bad', text: `Mileage went DOWN by ${worst.drop.toLocaleString('en-GB')} between MOTs. Possible clocking, treat with real caution.` });
  }
  if (mot?.dangerous) flags.push({ level: 'bad', text: 'Last MOT recorded a DANGEROUS defect. Check it has actually been fixed.' });
  if (mot?.motExpiryDate) {
    const days = Math.round((new Date(mot.motExpiryDate).getTime() - Date.now()) / 86400000);
    if (days < 0) flags.push({ level: 'warn', text: 'MOT has expired.' });
    else if (days < 60) flags.push({ level: 'warn', text: `Only ${days} days of MOT left. It'll need doing before it sells.` });
  }
  if (mot?.recentMilesPerYear != null && mot.recentMilesPerYear > 20000) {
    flags.push({ level: 'warn', text: `Doing about ${mot.recentMilesPerYear.toLocaleString('en-GB')} miles a year. High, and harder to sell.` });
  }
  if (mot && mot.testCount >= 3 && mot.fails > mot.passes) {
    flags.push({ level: 'warn', text: `Failed more MOTs than it's passed (${mot.fails} of ${mot.testCount}). Often a sign of neglect.` });
  }
  if (mot?.recurring?.length) {
    flags.push({ level: 'warn', text: `Same advisory keeps coming back: "${mot.recurring[0].text}" (${mot.recurring[0].times} tests).` });
  }
  if ((mot?.currentAdvisories?.length ?? 0) >= 4) {
    flags.push({ level: 'warn', text: `${mot!.currentAdvisories.length} advisories on the last MOT. Add up the prep before you bid.` });
  }
  if (metrics?.daysToSell != null && metrics.daysToSell > 60) {
    flags.push({ level: 'warn', text: `Auto Trader reckons these take about ${Math.round(metrics.daysToSell)} days to sell.` });
  }
  if (metrics?.rating != null && metrics.rating < 40) {
    flags.push({ level: 'warn', text: `Low Retail Rating (${Math.round(metrics.rating)}/100). Slow sellers right now.` });
  } else if (metrics?.rating != null && metrics.rating >= 70) {
    flags.push({ level: 'ok', text: `Strong Retail Rating (${Math.round(metrics.rating)}/100). People want these.` });
  }
  if (!flags.some(f => f.level !== 'ok')) flags.unshift({ level: 'ok', text: 'Nothing obviously wrong in the MOT history.' });
  return flags;
}

/* --------------------------------------------------- similar adverts
   Only ever follows the link Auto Trader itself returned, and only on their
   own host, so our token can never be sent anywhere else. */
export function safeCompetitorPath(href: string, cfg: ReturnType<typeof atConfig>): string | null {
  try {
    const u = new URL(href);
    const allowed = new URL(cfg.base).host;
    if (u.protocol !== 'https:' || u.host !== allowed) return null;
    if (!/^\/(stock|search)$/.test(u.pathname)) return null;
    if (!u.searchParams.get('pageSize')) u.searchParams.set('pageSize', '20');
    return u.pathname + u.search;
  } catch { return null; }
}

export function summariseCompetitors(data: any, ownAdvertiserId: string) {
  const results = Array.isArray(data?.results) ? data.results : [];
  const adverts = results
    .filter((r: any) => String(r?.advertiser?.advertiserId ?? '') !== String(ownAdvertiserId))
    .filter((r: any) => !r?.adverts?.retailAdverts?.priceOnApplication)
    .map((r: any) => ({
      price: gbp(r?.adverts?.retailAdverts?.totalPrice) ?? gbp(r?.adverts?.retailAdverts?.suppliedPrice) ?? gbp(r?.adverts?.forecourtPrice),
      mileage: r?.vehicle?.odometerReadingMiles ?? null,
      year: r?.vehicle?.yearOfManufacture != null ? Number(r.vehicle.yearOfManufacture) : null,
      town: r?.advertiser?.location?.town ?? null,
      indicator: r?.adverts?.retailAdverts?.priceIndicatorRating ?? null
    }))
    .filter((a: any) => typeof a.price === 'number' && a.price > 0)
    .sort((a: any, b: any) => a.price - b.price);

  if (!adverts.length) return { count: data?.totalResults ?? 0, sampled: 0, low: null, median: null, high: null, adverts: [] };
  const prices = adverts.map((a: any) => a.price);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
  return {
    count: typeof data?.totalResults === 'number' ? data.totalResults : adverts.length,
    sampled: adverts.length,
    low: prices[0], median, high: prices[prices.length - 1],
    adverts: adverts.slice(0, 8)
  };
}

/* ----------------------------------------------------------- lookups */
async function vehicleCall(cfg: ReturnType<typeof atConfig>, reg: string, mileage: number | null, flags: string[]) {
  const q = new URLSearchParams({ registration: reg, advertiserId: cfg.advertiserId });
  flags.forEach(f => q.set(f, 'true'));
  if (mileage != null && (flags.includes('valuations') || flags.includes('vehicleMetrics'))) {
    q.set('odometerReadingMiles', String(mileage));
  }
  const data = await atFetch(cfg, '/vehicles?' + q.toString());
  const rec = recordOf(data);
  const warnings = [...(data?.warnings ?? []), ...(rec?.warnings ?? [])].map((w: any) => w?.message).filter(Boolean);
  return { rec, warnings };
}

const PART_OF: Record<string, (rec: any) => Record<string, unknown>> = {
  motTests: rec => ({ motTests: rec?.motTests }),
  competitors: rec => ({ links: rec?.links }),
  valuations: rec => ({ valuations: rec?.valuations }),
  vehicleMetrics: rec => ({ vehicleMetrics: rec?.vehicleMetrics })
};

/**
 * Ask for everything in one call. If the account lacks one of the extras
 * (Auto Trader licenses them separately) that call is refused, so fall back
 * to the core record and try each extra on its own, keeping whatever works.
 */
async function vehicleWith(cfg: ReturnType<typeof atConfig>, reg: string, mileage: number | null, extras: string[], unavailable: string[]) {
  try {
    return await vehicleCall(cfg, reg, mileage, extras);
  } catch (err) {
    if (!(err instanceof AtError) || !['forbidden', 'bad_request'].includes(err.code) || !extras.length) throw err;
    const core = await vehicleCall(cfg, reg, mileage, []);
    for (const f of extras) {
      try {
        const x = await vehicleCall(cfg, reg, mileage, [f]);
        Object.assign(core.rec ?? {}, PART_OF[f](x.rec));
        core.warnings.push(...x.warnings);
      } catch { unavailable.push(f); }
    }
    return core;
  }
}

async function lookup(cfg: ReturnType<typeof atConfig>, reg: string, mileageIn: number | null, price: number | null) {
  const unavailable: string[] = [];
  const first = mileageIn != null
    ? ['motTests', 'competitors', 'valuations', 'vehicleMetrics']
    : ['motTests', 'competitors'];

  const { rec, warnings } = await vehicleWith(cfg, reg, mileageIn, first, unavailable);
  if (!rec?.vehicle) throw new AtError(404, 'Auto Trader has no record for that plate. Check it and try again.', 'not_found');

  const v = rec.vehicle;
  const mot = analyseMot(rec.motTests);
  const mileage = mileageIn ?? mot?.latestMileage ?? null;

  // Didn't know the mileage up front: now we do, from the last MOT
  if (mileageIn == null && mileage != null) {
    try {
      const more = await vehicleWith(cfg, reg, mileage, ['valuations', 'vehicleMetrics'], unavailable);
      rec.valuations = more.rec?.valuations;
      rec.vehicleMetrics = more.rec?.vehicleMetrics;
    } catch (err) { console.error('AT valuations follow-up', err); unavailable.push('valuations', 'vehicleMetrics'); }
  }

  const valuations = valuationsOf(rec.valuations);
  const metrics = metricsOf(rec.vehicleMetrics);

  // Where a given asking price sits on Auto Trader's scale, and the bands
  let priceIndicator: { rating: string | null; bands: any } | null = null;
  if (price != null && v.derivativeId && v.firstRegistrationDate && mileage != null) {
    try {
      const body = {
        vehicle: { derivativeId: v.derivativeId, firstRegistrationDate: v.firstRegistrationDate, odometerReadingMiles: mileage },
        adverts: { retailAdverts: { price: { amountGBP: price } } }
      };
      const r = await atFetch(cfg, `/valuations?advertiserId=${encodeURIComponent(cfg.advertiserId)}`, { method: 'POST', body: JSON.stringify(body) });
      const retail = r?.valuations?.retail;
      if (retail) priceIndicator = { rating: retail.priceIndicatorRating ?? null, bands: retail.priceIndicatorRatingBands ?? null };
    } catch (err) { console.error('AT price indicator', err); unavailable.push('priceIndicator'); }
  }

  let competitors = null;
  const href = rec.links?.competitors?.href;
  if (href) {
    const path = safeCompetitorPath(href, cfg);
    if (path) {
      try { competitors = summariseCompetitors(await atFetch(cfg, path), cfg.advertiserId); }
      catch (err) { console.error('AT competitors', err); unavailable.push('competitors'); }
    }
  }

  const year = v.firstRegistrationDate ? Number(String(v.firstRegistrationDate).slice(0, 4))
             : v.yearOfManufacture ? Number(v.yearOfManufacture) : null;
  const cc = v.engineCapacityCC ?? v.badgeEngineSizeCC ?? null;

  return {
    source: 'autotrader',
    env: cfg.env,
    registration: reg,
    make: v.make ?? null,
    model: v.model ?? null,
    derivative: v.derivative ?? null,
    derivativeId: v.derivativeId ?? null,
    trim: v.trim ?? null,
    year,
    firstRegistrationDate: v.firstRegistrationDate ?? null,
    colour: v.colour ?? null,
    fuelType: v.fuelType ?? null,
    transmissionType: v.transmissionType ?? null,
    bodyType: v.bodyType ?? null,
    doors: v.doors ?? null,
    owners: v.owners ?? null,
    engineLitres: v.badgeEngineSizeLitres ?? (cc ? Number((cc / 1000).toFixed(1)) : null),
    mileageUsed: mileage,
    motExpiryDate: mot?.motExpiryDate ?? null,
    mot,
    valuations,
    metrics,
    priceIndicator,
    competitors,
    flags: buildFlags(mot, metrics),
    unavailable: [...new Set(unavailable)],
    warnings
  };
}

async function stockList(cfg: ReturnType<typeof atConfig>) {
  const q = new URLSearchParams({ advertiserId: cfg.advertiserId, pageSize: '100', page: '1', responseMetrics: 'true' });
  const data = await atFetch(cfg, '/stock?' + q.toString());
  const results = Array.isArray(data?.results) ? data.results : [];
  return {
    total: data?.totalResults ?? results.length,
    items: results.map((r: any) => {
      const ra = r?.adverts?.retailAdverts ?? {};
      const rm = r?.responseMetrics ?? r?.vehicle?.responseMetrics ?? null;
      return {
        stockId: r?.metadata?.stockId ?? null,
        lifecycleState: r?.metadata?.lifecycleState ?? null,
        registration: r?.vehicle?.registration ?? null,
        make: r?.vehicle?.make ?? null,
        model: r?.vehicle?.model ?? null,
        price: gbp(ra.totalPrice) ?? gbp(ra.suppliedPrice) ?? gbp(r?.adverts?.forecourtPrice),
        priceIndicator: ra.priceIndicatorRating ?? null,
        advertStatus: ra.autotraderAdvert?.status ?? null,
        viewsLastWeek: rm?.lastWeek?.advertViews ?? null,
        searchViewsLastWeek: rm?.lastWeek?.searchViews ?? null,
        performance: rm?.performanceRating?.rating ?? null
      };
    })
  };
}

/* --------------------------------------------------- who may call this
   Same check as vehicle-lookup: ask the database "is the caller an admin?"
   with the caller's own token. The public key resolves to nobody. */
async function callerIsAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) { console.error('SUPABASE_URL / anon key missing'); return false; }
  try {
    const res = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { apikey: key, Authorization: auth, 'Content-Type': 'application/json' },
      body: '{}'
    });
    return res.ok && (await res.json()) === true;
  } catch (err) {
    console.error('Admin check failed:', err);
    return false;
  }
}

const cleanReg = (v: unknown) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cleanInt = (v: unknown, max: number) => {
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10);
  return isNaN(n) || n <= 0 || n > max ? null : n;
};

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  if (!(await callerIsAdmin(req))) {
    return json({ error: 'You need to be signed in to the admin app to use Auto Trader.' }, 401);
  }

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'Could not read that request.' }, 400); }

  const cfg = atConfig();
  const action = String(body.action ?? '');

  if (action === 'status') {
    if (!cfg.configured) {
      return json({ configured: false, connected: false, env: cfg.env,
        missing: [!cfg.key && 'AT_KEY', !cfg.secret && 'AT_SECRET', !cfg.advertiserId && 'AT_ADVERTISER_ID'].filter(Boolean) });
    }
    try {
      await getToken(cfg, true);
      return json({ configured: true, connected: true, env: cfg.env, advertiserId: '…' + cfg.advertiserId.slice(-3) });
    } catch (err) {
      return json({ configured: true, connected: false, env: cfg.env, error: (err as Error).message });
    }
  }

  if (!cfg.configured) {
    return json({ error: 'Auto Trader isn’t connected yet.', code: 'not_configured' }, 503);
  }

  try {
    if (action === 'lookup' || action === 'market') {
      const reg = cleanReg(body.registration);
      if (reg.length < 2 || reg.length > 8) return json({ error: 'That doesn’t look like a UK number plate.' }, 400);
      const mileage = cleanInt(body.mileage, 999_999);
      const price = action === 'market' ? cleanInt(body.price, 5_000_000) : null;
      return json(await lookup(cfg, reg, mileage, price));
    }
    if (action === 'stock') return json(await stockList(cfg));
    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    if (err instanceof AtError) return json({ error: err.message, code: err.code }, err.status);
    console.error('autotrader', err);
    return json({ error: 'Something went wrong talking to Auto Trader.' }, 500);
  }
}

if (typeof Deno !== 'undefined' && typeof Deno.serve === 'function' && !(globalThis as any).__AT_TEST__) {
  Deno.serve(handle);
}
