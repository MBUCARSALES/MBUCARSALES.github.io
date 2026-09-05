// ============================================================================
// MBU CAR SALES — DVLA NUMBER PLATE LOOKUP
// ----------------------------------------------------------------------------
// A tiny proxy that sits between the admin app and the DVLA.
//
// Why it exists: the DVLA API key must never appear in the website's code,
// and the DVLA does not allow browsers to call it directly. This function
// holds the key privately and does the call on our behalf.
//
// HOW TO DEPLOY (no command line needed):
//   1. Supabase dashboard → Edge Functions → "Deploy a new function"
//   2. Name it exactly:  dvla-lookup
//   3. Paste this entire file in, and deploy.
//   4. Edge Functions → Secrets → add:  DVLA_API_KEY = your key
//
// Get a free API key at:
//   https://developer-portal.driver-vehicle-licensing.api.gov.uk/
//   (Register, request access to "Vehicle Enquiry Service". Takes a few days.)
//
// Until the key exists this returns a clear message and the admin app simply
// falls back to typing the details in by hand — nothing breaks.
// ============================================================================

const DVLA_URL =
  'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });

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

  const apiKey = Deno.env.get('DVLA_API_KEY');
  if (!apiKey) {
    return json(
      { error: 'Plate lookup isn’t switched on yet — type the details in by hand.' },
      503
    );
  }

  // --- read and tidy the registration ---------------------------------------
  let reg = '';
  try {
    const body = await req.json();
    reg = String(body.registrationNumber ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  } catch {
    return json({ error: 'Could not read that request.' }, 400);
  }

  if (reg.length < 2 || reg.length > 8) {
    return json({ error: 'That doesn’t look like a UK number plate.' }, 400);
  }

  // --- ask the DVLA ---------------------------------------------------------
  try {
    const res = await fetch(DVLA_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ registrationNumber: reg })
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { /* keep empty */ }

    if (res.status === 404) {
      return json({ error: 'The DVLA has no record of that plate. Check it and try again.' }, 404);
    }
    if (res.status === 400) {
      return json({ error: 'That plate isn’t in a valid format.' }, 400);
    }
    if (res.status === 401 || res.status === 403) {
      console.error('DVLA auth failed:', text);
      return json({ error: 'Lookup key was rejected. Type the details in for now.' }, 502);
    }
    if (res.status === 429) {
      return json({ error: 'Too many lookups just now — wait a minute and try again.' }, 429);
    }
    if (!res.ok) {
      console.error('DVLA error', res.status, text);
      return json({ error: 'The DVLA service is having a moment. Type it in by hand.' }, 502);
    }

    // Pass back only what the admin form actually uses.
    return json({
      registrationNumber:      data.registrationNumber ?? reg,
      make:                    data.make ?? null,
      yearOfManufacture:       data.yearOfManufacture ?? null,
      monthOfFirstRegistration:data.monthOfFirstRegistration ?? null,
      colour:                  data.colour ?? null,
      fuelType:                data.fuelType ?? null,
      engineCapacity:          data.engineCapacity ?? null,   // in cc
      co2Emissions:            data.co2Emissions ?? null,
      motStatus:               data.motStatus ?? null,
      motExpiryDate:           data.motExpiryDate ?? null,
      taxStatus:               data.taxStatus ?? null,
      taxDueDate:              data.taxDueDate ?? null,
      wheelplan:               data.wheelplan ?? null,
      markedForExport:         data.markedForExport ?? null,
      // Note: the DVLA does NOT return the model or trim — those still get
      // typed in by hand. Nothing we can do about that.
      _note: 'model and trim are not provided by the DVLA'
    });

  } catch (err) {
    console.error('Lookup failed:', err);
    return json({ error: 'Could not reach the DVLA. Type the details in by hand.' }, 502);
  }
});
