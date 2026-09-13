/* ============================================================================
   AUTO TRADER CONNECT — ADAPTER (admin app only)
   ----------------------------------------------------------------------------
   Everything the admin app knows about Auto Trader goes through here, and
   everything here goes through the `autotrader` Edge Function, which holds
   the key and secret. Nothing secret is ever in this file: it's public.

   SWITCHING IT ON, once Auto Trader have approved access:
     1. Run supabase/schema-v7-insights.sql (if not already)
     2. Deploy supabase/functions/autotrader and add its four secrets
        (AT_KEY, AT_SECRET, AT_ADVERTISER_ID, AT_ENV)
     3. In config.js set  autotrader: { enabled: true, ... }
     4. Admin app → More → Auto Trader → Test the connection
   HANDOVER section 9f has the detail.

   With enabled: false (today) the app works exactly as before: plate lookups
   use the DVLA/MOT function if deployed, the market price comes from your own
   price book, and nothing calls Auto Trader.

   READ-ONLY. Valuations, metrics, similar adverts and your advert list.
   Pushing adverts to Auto Trader is deliberately not built yet: it should be
   written and tested against their sandbox, not blind. ROADMAP §4a.
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.MBU_CONFIG || {};
  const AT = window.MBU_AUTOTRADER = {};

  AT.config = Object.assign({
    enabled: false,
    advertiserId: '',        // informational only; the function uses its own secret
    functionName: 'autotrader',
    maxAdverts: 8            // your current package allowance
  }, CFG.autotrader || {});

  AT.isEnabled = () => !!AT.config.enabled;

  /* The admin app hands over a way to get the signed-in admin's token, so
     this file never touches the Supabase client itself. */
  let getToken = async () => null;
  AT.init = function (opts) {
    if (opts && typeof opts.getToken === 'function') getToken = opts.getToken;
  };

  async function call(action, payload) {
    const token = await getToken();
    if (!token) throw Object.assign(new Error('Your session has expired. Sign in again.'), { code: 'auth' });

    const url = `${(CFG.supabase && CFG.supabase.url || '').replace(/\/$/, '')}/functions/v1/${AT.config.functionName}`;
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(Object.assign({ action }, payload || {}))
      });
    } catch {
      throw Object.assign(new Error('Couldn’t reach Auto Trader. Check your signal.'), { code: 'network' });
    }

    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }

    // A 404 without our own error message means the function isn't deployed
    if (res.status === 404 && !(body && body.error)) {
      throw Object.assign(new Error('The Auto Trader connection hasn’t been deployed to Supabase yet.'), { code: 'not_deployed' });
    }
    if (!res.ok) {
      throw Object.assign(new Error((body && body.error) || 'Auto Trader lookup failed.'), { code: body && body.code, status: res.status });
    }
    return body;
  }

  /** Are the credentials in, and do they work? Never throws. */
  AT.status = async function () {
    try { return await call('status'); }
    catch (err) { return { configured: false, connected: false, error: err.message, code: err.code }; }
  };

  /** Plate (+ mileage) → the car, MOT, valuations, metrics, similar adverts. */
  AT.lookup = (registration, mileage) =>
    call('lookup', { registration, mileage: mileage == null ? null : mileage });

  /** The same for a car in stock, plus where its asking price sits. */
  AT.market = car =>
    call('market', { registration: car.registration, mileage: car.mileage, price: car.price });

  /** What's live on the Auto Trader account, with price indicator and views. */
  AT.stock = () => call('stock');

  /**
   * A market result → the columns it updates on the car (schema-v7), and the
   * price book row it records. Kept here so the shape lives in one place.
   */
  AT.carPatch = function (result) {
    const v = result.valuations || {};
    const m = result.metrics || {};
    const now = new Date().toISOString();
    return {
      at_derivative_id: result.derivativeId || null,
      val_retail: v.retail != null ? v.retail : null,
      val_trade: v.trade != null ? v.trade : null,
      val_partex: v.partExchange != null ? v.partExchange : null,
      retail_rating: m.rating != null ? m.rating : null,
      days_to_sell: m.daysToSell != null ? Math.round(m.daysToSell) : null,
      val_updated_at: now,
      at_price_indicator: result.priceIndicator ? result.priceIndicator.rating : null,
      at_market: {
        checked_at: now,
        env: result.env,
        retail: v.retail != null ? v.retail : null,
        indicator: result.priceIndicator ? result.priceIndicator.rating : null,
        bands: result.priceIndicator ? result.priceIndicator.bands : null,
        competitors: result.competitors ? {
          count: result.competitors.count, low: result.competitors.low,
          median: result.competitors.median, high: result.competitors.high
        } : null,
        metrics: result.metrics || null
      }
    };
  };

  AT.priceCheckRow = function (result, carId) {
    const c = result.competitors;
    const typical = c && c.median != null ? c.median : (result.valuations && result.valuations.retail);
    if (!typical) return null;
    return {
      make: result.make || 'Unknown',
      model: result.model || null,
      year: result.year || null,
      mileage: result.mileageUsed || null,
      low: c ? c.low : null,
      typical,
      high: c ? c.high : null,
      sample_size: c ? c.sampled : null,
      source: 'autotrader_api',
      car_id: carId || null,
      notes: result.env === 'sandbox' ? 'Auto Trader SANDBOX data, not real prices' : null,
      detail: { valuations: result.valuations, metrics: result.metrics, derivative: result.derivative }
    };
  };

  /* --------------------------------------------------------------------------
     STOCK SYNC — NOT BUILT (on purpose)
     The payload mapping below is kept ready. Writing to live adverts should
     be built against the sandbox once access exists.
     -------------------------------------------------------------------------- */
  AT.FIELD_MAP = {
    at_derivative_id:   'vehicle.derivativeId',
    registration:       'vehicle.registration',
    mileage:            'vehicle.odometerReadingMiles',
    colour:             'vehicle.colour',
    year:               'vehicle.firstRegistrationDate',
    price:              'adverts.retailAdverts.suppliedPrice.amountGBP',
    description:        'adverts.retailAdverts.description',
    at_lifecycle_state: 'metadata.lifecycleState'
  };

  /** Our status → Auto Trader lifecycle state */
  AT.LIFECYCLE = {
    draft:     'DUE_IN',
    available: 'FORECOURT',
    reserved:  'SALE_IN_PROGRESS',
    sold:      'SOLD'
  };

  AT.toStockPayload = function (car) {
    return {
      vehicle: {
        registration: (car.registration || '').replace(/\s+/g, '').toUpperCase(),
        derivativeId: car.at_derivative_id || undefined,
        odometerReadingMiles: car.mileage ?? undefined,
        colour: car.colour || undefined
      },
      adverts: {
        retailAdverts: {
          suppliedPrice: car.price != null ? { amountGBP: car.price } : undefined,
          description: car.description || undefined,
          autotraderAdvert: { status: car.at_published ? 'PUBLISHED' : 'NOT_PUBLISHED' }
        }
      },
      metadata: {
        lifecycleState: AT.LIFECYCLE[car.status] || 'FORECOURT'
      },
      media: {
        images: (car.images || [])
          .map(i => ({ href: window.MBU ? window.MBU.img(i, 'full') : null }))
          .filter(i => i.href)
      }
    };
  };

  /** Stock sync is switched off separately from the read-only connection. */
  AT.syncEnabled = () => !!(AT.config.enabled && AT.config.stockSync);

  AT.syncStock = async function (/* car, { publish } */) {
    throw new Error('Pushing adverts to Auto Trader isn’t built yet. Build it against the sandbox first, see ROADMAP.md §4a.');
  };

  /** How many adverts we're allowed to have live, and how many are left. */
  AT.advertAllowance = function (cars) {
    const used = (cars || []).filter(c => c.at_published && c.status !== 'sold').length;
    return { used, limit: AT.config.maxAdverts, remaining: Math.max(0, AT.config.maxAdverts - used) };
  };
})();
