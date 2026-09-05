// ============================================================================
// MBU CAR SALES — VEHICLE LOOKUP  (DVLA + MOT history, combined)
// ----------------------------------------------------------------------------
// One call from the phone → everything known about a car from its number plate.
//
// Calls two free government APIs in parallel and merges the results:
//   1. DVLA Vehicle Enquiry Service  → make, year, colour, fuel, engine, tax
//   2. DVSA MOT History              → MODEL, full mileage history, advisories
//
// The MOT API is the important one for buying. It gives you the model (which
// the DVLA does not), every odometer reading ever recorded, and every advisory
// — which is how you spot a clocked car or one about to need £900 of welding
// while you're still stood in the auction hall.
//
// This also does the analysis server-side: mileage per year, clocking checks,
// advisory grouping and MOT pass rate. The phone just draws the result.
//
// ----------------------------------------------------------------------------
// DEPLOY (no command line needed)
//   Supabase → Edge Functions → Deploy a new function
//   Name it exactly:  vehicle-lookup
//   Paste this file in. Deploy.
//
// SECRETS  (Edge Functions → Secrets)
//   DVLA_API_KEY        — from developer-portal.driver-vehicle-licensing.api.gov.uk
//   MOT_CLIENT_ID       ┐
//   MOT_CLIENT_SECRET   │ from documentation.history.mot.api.gov.uk
//   MOT_API_KEY         │ (free, register for the MOT History API)
//   MOT_TENANT_ID       ┘ the tenant id in your issued token URL
//
// Everything degrades gracefully: no MOT keys → you still get DVLA data.
// No keys at all → a clear message and manual entry still works.
// ============================================================================

const DVLA_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
const MOT_URL  = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' }
  });

/* ---------------------------------------------------------------------------
   MOT access tokens last 60 minutes. Cache in memory so a busy afternoon at
   the auction doesn't fetch a new one for every single car.
   --------------------------------------------------------------------------- */
let tokenCache: { token: string; expires: number } | null = null;

async function getMotToken(): Promise<string | null> {
  const id = Deno.env.get('MOT_CLIENT_ID');
  const secret = Deno.env.get('MOT_CLIENT_SECRET');
  const tenant = Deno.env.get('MOT_TENANT_ID');
  if (!id || !secret || !tenant) return null;

  if (tokenCache && tokenCache.expires > Date.now() + 60_000) return tokenCache.token;

  try {
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: id,
        client_secret: secret,
        // DVSA send you a scope URL when you register. This is the usual one;
        // set MOT_SCOPE as a secret if yours differs.
        scope: Deno.env.get('MOT_SCOPE') || 'https://tapi.dvsa.gov.uk/.default'
      })
    });
    if (!res.ok) { console.error('MOT token failed', res.status, await res.text()); return null; }

    const data = await res.json();
    tokenCache = {
      token: data.access_token,
      expires: Date.now() + (data.expires_in ?? 3600) * 1000
    };
    return tokenCache.token;
  } catch (err) {
    console.error('MOT token error', err);
    return null;
  }
}

/* --------------------------------------------------------------------------- */
async function fetchDvla(reg: string) {
  const key = Deno.env.get('DVLA_API_KEY');
  if (!key) return { ok: false, reason: 'no_key' as const };

  try {
    const res = await fetch(DVLA_URL, {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ registrationNumber: reg })
    });
    if (res.status === 404) return { ok: false, reason: 'not_found' as const };
    if (!res.ok) { console.error('DVLA', res.status, await res.text()); return { ok: false, reason: 'error' as const }; }
    return { ok: true as const, data: await res.json() };
  } catch (err) {
    console.error('DVLA error', err);
    return { ok: false, reason: 'error' as const };
  }
}

async function fetchMot(reg: string) {
  const token = await getMotToken();
  const apiKey = Deno.env.get('MOT_API_KEY');
  if (!token || !apiKey) return { ok: false, reason: 'no_key' as const };

  try {
    const res = await fetch(`${MOT_URL}/${encodeURIComponent(reg)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-API-Key': apiKey,
        Accept: 'application/json'
      }
    });
    if (res.status === 404) return { ok: false, reason: 'not_found' as const };
    if (!res.ok) { console.error('MOT', res.status, await res.text()); return { ok: false, reason: 'error' as const }; }
    return { ok: true as const, data: await res.json() };
  } catch (err) {
    console.error('MOT error', err);
    return { ok: false, reason: 'error' as const };
  }
}

/* ---------------------------------------------------------------------------
   ANALYSIS — the part that actually helps you decide whether to bid
   --------------------------------------------------------------------------- */
interface Reading { date: string; miles: number; result: string }

function analyseMot(mot: any) {
  const tests: any[] = Array.isArray(mot?.motTests) ? mot.motTests.slice() : [];

  // Oldest first, so the mileage should only ever go up
  tests.sort((a, b) =>
    new Date(a.completedDate || 0).getTime() - new Date(b.completedDate || 0).getTime());

  const readings: Reading[] = [];
  for (const t of tests) {
    const raw = t.odometerValue;
    if (raw == null || t.odometerResultType === 'NO_ODOMETER_READING') continue;
    let miles = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
    if (isNaN(miles)) continue;
    if (String(t.odometerUnit || '').toUpperCase() === 'KM') miles = Math.round(miles * 0.621371);
    readings.push({ date: t.completedDate, miles, result: t.testResult });
  }

  // --- clocking check: a reading that goes DOWN is a serious red flag -------
  const discrepancies: { from: string; to: string; drop: number }[] = [];
  for (let i = 1; i < readings.length; i++) {
    if (readings[i].miles < readings[i - 1].miles - 50) {   // 50mi tolerance for typos
      discrepancies.push({
        from: readings[i - 1].date,
        to: readings[i].date,
        drop: readings[i - 1].miles - readings[i].miles
      });
    }
  }

  // --- annual mileage over the last three years ----------------------------
  let milesPerYear: number | null = null;
  if (readings.length >= 2) {
    const first = readings[0], last = readings[readings.length - 1];
    const years = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 31_557_600_000;
    if (years > 0.5) milesPerYear = Math.round((last.miles - first.miles) / years);
  }
  let recentMilesPerYear: number | null = null;
  if (readings.length >= 2) {
    const cutoff = Date.now() - 3 * 31_557_600_000;
    const recent = readings.filter(r => new Date(r.date).getTime() >= cutoff);
    if (recent.length >= 2) {
      const y = (new Date(recent[recent.length - 1].date).getTime()
                 - new Date(recent[0].date).getTime()) / 31_557_600_000;
      if (y > 0.4) recentMilesPerYear = Math.round((recent[recent.length - 1].miles - recent[0].miles) / y);
    }
  }

  // --- pass rate and failure count -----------------------------------------
  const passes = tests.filter(t => t.testResult === 'PASSED').length;
  const fails  = tests.filter(t => t.testResult === 'FAILED').length;

  // --- advisories on the most recent test ----------------------------------
  const latest = tests[tests.length - 1];
  const latestDefects = Array.isArray(latest?.defects) ? latest.defects : [];
  const currentAdvisories = latestDefects
    .filter((d: any) => /ADVISORY|MINOR/i.test(d.type || ''))
    .map((d: any) => String(d.text || '').trim())
    .filter(Boolean);
  const dangerous = latestDefects.some((d: any) => d.dangerous === true);

  // --- recurring advisories: the same thing flagged year after year --------
  const counts: Record<string, number> = {};
  for (const t of tests.slice(-4)) {
    for (const d of (t.defects || [])) {
      const key = String(d.text || '').toLowerCase()
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/[^a-z ]/g, '').trim().slice(0, 60);
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
  }
  const recurring = Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, n]) => ({ text, times: n }));

  return {
    model: mot?.model ?? null,
    make: mot?.make ?? null,
    firstUsedDate: mot?.firstUsedDate ?? null,
    fuelType: mot?.fuelType ?? null,
    colour: mot?.primaryColour ?? null,
    latestMileage: readings.length ? readings[readings.length - 1].miles : null,
    latestTestDate: latest?.completedDate ?? null,
    motExpiryDate: latest?.expiryDate ?? null,
    readings,
    discrepancies,
    milesPerYear,
    recentMilesPerYear,
    testCount: tests.length,
    passes,
    fails,
    passRate: tests.length ? Math.round((passes / tests.length) * 100) : null,
    currentAdvisories,
    dangerous,
    recurring
  };
}

/** Plain-English warnings, worst first. This is what gets read in the hall. */
function buildFlags(dvla: any, mot: ReturnType<typeof analyseMot> | null) {
  const flags: { level: 'bad' | 'warn' | 'ok'; text: string }[] = [];

  if (mot?.discrepancies?.length) {
    const worst = mot.discrepancies.reduce((a, b) => (a.drop > b.drop ? a : b));
    flags.push({
      level: 'bad',
      text: `Mileage went DOWN by ${worst.drop.toLocaleString('en-GB')} between MOTs. Possible clocking — treat with real caution.`
    });
  }
  if (mot?.dangerous) {
    flags.push({ level: 'bad', text: 'Last MOT recorded a DANGEROUS defect. Check it has actually been fixed.' });
  }
  if (dvla?.markedForExport === true) {
    flags.push({ level: 'bad', text: 'Marked for export on DVLA records.' });
  }

  const motStatus = String(dvla?.motStatus || '');
  if (/no.*mot|not valid/i.test(motStatus)) {
    flags.push({ level: 'warn', text: 'No valid MOT — budget for a test and whatever it needs to pass.' });
  } else if (mot?.motExpiryDate) {
    const days = Math.round((new Date(mot.motExpiryDate).getTime() - Date.now()) / 86400000);
    if (days < 0) flags.push({ level: 'warn', text: 'MOT has expired.' });
    else if (days < 60) flags.push({ level: 'warn', text: `Only ${days} days of MOT left — it'll need doing before it sells.` });
  }

  if (mot?.recentMilesPerYear != null && mot.recentMilesPerYear > 20000) {
    flags.push({ level: 'warn', text: `Doing about ${mot.recentMilesPerYear.toLocaleString('en-GB')} miles a year — high, and harder to sell.` });
  }
  if (mot?.fails != null && mot.testCount >= 3 && mot.fails > mot.passes) {
    flags.push({ level: 'warn', text: `Failed more MOTs than it's passed (${mot.fails} of ${mot.testCount}). Often a sign of neglect.` });
  }
  if (mot?.recurring?.length) {
    flags.push({ level: 'warn', text: `Same advisory keeps coming back: "${mot.recurring[0].text}" (${mot.recurring[0].times} tests). Previous owner has been ignoring it.` });
  }
  if (mot?.currentAdvisories?.length >= 4) {
    flags.push({ level: 'warn', text: `${mot.currentAdvisories.length} advisories on the last MOT — add up the prep cost before you bid.` });
  }

  if (String(dvla?.taxStatus || '').toLowerCase() === 'untaxed') {
    flags.push({ level: 'warn', text: 'Currently untaxed.' });
  }

  if (!flags.length) {
    flags.push({ level: 'ok', text: 'Nothing obviously wrong in the DVLA or MOT records.' });
  }
  return flags;
}

/* --------------------------------------------------------------------------- */
/* ============================================================================
   WHO IS ALLOWED TO CALL THIS
   ----------------------------------------------------------------------------
   These lookups spend YOUR DVLA and DVSA quota, and the publishable key that
   the website ships with is public by design. Without this check anyone who
   read the page source could run unlimited number plate lookups on your
   credentials: your quota gets burned (so the bidding tool dies at an auction,
   exactly when you need it) and it almost certainly breaches the DVLA's terms.

   The check asks the database "is the caller an admin?" using the caller's own
   token. is_admin() reads auth.uid(), so:
     · a real signed-in admin  → true
     · the publishable key     → auth.uid() is null → false
     · anything else           → false
   No extra secret is needed here, and no admin list is duplicated.
   ========================================================================== */
async function callerIsAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;

  // Both are injected into every Edge Function by Supabase automatically.
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY')
           ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !key) {
    console.error('SUPABASE_URL / anon key missing — refusing the request.');
    return false;   // fail closed: no way to check means no access
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/is_admin`, {
      method: 'POST',
      headers: { apikey: key, Authorization: auth, 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch (err) {
    console.error('Admin check failed:', err);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  // Signed-in admins only. See callerIsAdmin above.
  if (!(await callerIsAdmin(req))) {
    return json({ error: 'You need to be signed in to the admin app to look up a plate.' }, 401);
  }

  let reg = '';
  try {
    const body = await req.json();
    reg = String(body.registrationNumber ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }
  if (reg.length < 2 || reg.length > 8) {
    return json({ error: 'That doesn’t look like a UK number plate.' }, 400);
  }

  const [dvlaRes, motRes] = await Promise.all([fetchDvla(reg), fetchMot(reg)]);

  if (!dvlaRes.ok && !motRes.ok) {
    if (dvlaRes.reason === 'not_found' || motRes.reason === 'not_found') {
      return json({ error: 'No record found for that plate. Check it and try again.' }, 404);
    }
    if (dvlaRes.reason === 'no_key' && motRes.reason === 'no_key') {
      return json({ error: 'Lookup isn’t switched on yet — type the details in by hand.' }, 503);
    }
    return json({ error: 'Both lookup services are unavailable right now.' }, 502);
  }

  const dvla: any = dvlaRes.ok ? dvlaRes.data : null;
  const mot = motRes.ok ? analyseMot(motRes.data) : null;

  // Prefer DVLA for facts it is authoritative on; take model from MOT because
  // the DVLA simply doesn't hold it.
  const engineCc = dvla?.engineCapacity ?? null;

  return json({
    registration: reg,
    found: { dvla: dvlaRes.ok, mot: motRes.ok },
    motUnavailableReason: motRes.ok ? null : motRes.reason,

    make:        dvla?.make ?? mot?.make ?? null,
    model:       mot?.model ?? null,               // ← only the MOT API has this
    year:        dvla?.yearOfManufacture ?? (mot?.firstUsedDate ? Number(String(mot.firstUsedDate).slice(0, 4)) : null),
    colour:      dvla?.colour ?? mot?.colour ?? null,
    fuelType:    dvla?.fuelType ?? mot?.fuelType ?? null,
    engineCc,
    engineLitres: engineCc ? Number((engineCc / 1000).toFixed(1)) : null,
    co2:         dvla?.co2Emissions ?? null,
    wheelplan:   dvla?.wheelplan ?? null,

    taxStatus:      dvla?.taxStatus ?? null,
    taxDueDate:     dvla?.taxDueDate ?? null,
    motStatus:      dvla?.motStatus ?? null,
    motExpiryDate:  dvla?.motExpiryDate ?? mot?.motExpiryDate ?? null,
    markedForExport: dvla?.markedForExport ?? null,

    mot,
    flags: buildFlags(dvla, mot)
  });
});
