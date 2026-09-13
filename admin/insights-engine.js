/* ============================================================================
   MBU ADMIN: the insight engine
   ----------------------------------------------------------------------------
   Looks at every car for sale and, where one needs a decision, NAMES THE CAR
   and PICKS ONE CAUSE, instead of "it's usually the price or the photos".

   The reasoning is explicit rules, written out below, not a model guessing.
   Each rule rules the other causes OUT with the numbers it already has:
     · 23 photos and people spending a minute on it → not presentation
     · priced in line with the market                → not obviously price
     · nobody is reaching the page                   → not being turned down
   The sentences are templates filled from those numbers. A model could be
   asked to reword them later; it should never be asked to do this part.

   Pure functions, no DOM and no network, so the same file can run in the
   admin app, in a test, or in the weekly summary email.

   Every threshold is in THRESHOLDS at the top so it can be tuned against
   real figures without touching the rules.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MBU_INSIGHTS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const THRESHOLDS = {
    MIN_PEOPLE: 20,            // people on a car before its contact rate means anything
    MIN_TRACKED_DAYS: 5,       // days of new tracking on a car before judging it
    GOOD_PHOTOS: 12,           // this many photos and presentation is ruled out
    FEW_PHOTOS: 8,             // fewer than this is worth saying even without tracking
    QUICK_EXIT_SECONDS: 10,    // must match quick_exits in car_interest
    QUICK_EXIT_SHARE: 0.6,     // this share leaving that fast = first impression problem
    MIN_MEASURED: 8,           // people with time-on-page before trusting the share above
    ENGAGED_SECONDS: 30,       // median time that counts as "spending time on it"
    AGEING_WATCH_DAYS: 45,
    AGEING_ACT_DAYS: 60,
    PRICE_STALE_DAYS: 21,      // no price change in this long on an ageing car
    MARKET_MAX_AGE_DAYS: 60,   // price book checks older than this are ignored
    AT_MAX_AGE_DAYS: 14,       // Auto Trader figures older than this are ignored
    ABOVE_MARKET_MIN: 150,     // £ above the top of the market before calling it
    LOW_TRAFFIC_SHARE: 0.4,    // under 40% of the typical car's people a week
    LOW_TRAFFIC_MIN_DAYS: 10,
    HOT_CONTACTS_7D: 3,
    FALLING_MIN_PREV: 10,      // people in the previous week before calling a drop
    HAGGLE_MIN_SALES: 3,       // sales needed before "your usual haggle" is quoted
    AGEING_STEP_PCT: 3         // price step suggested when there's no market figure
  };

  const SEVERITY_ORDER = { act: 0, watch: 1, good: 2 };
  const DAY = 86400000;

  /* ------------------------------------------------------------ helpers */
  const norm = s => String(s == null ? '' : s).trim().toLowerCase();
  const money = n => n == null ? 'no price' : '£' + Math.round(n).toLocaleString('en-GB');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const daysBetween = (a, b) => Math.max(0, Math.floor((b - a) / DAY));
  const toTime = d => d == null ? null : (d instanceof Date ? d.getTime() : new Date(d).getTime());

  function median(values) {
    const v = values.filter(n => n != null && !isNaN(n)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /** Dealer-style price at or under a figure: 6,200 → 6,195, 6,475 → 6,395. */
  function priceAtOrUnder(n) {
    if (n == null || n < 200) return n;
    return Math.floor((n + 5) / 100) * 100 - 5;
  }

  /** Dealer-style price nearest a figure: 6,475 → 6,495, 6,180 → 6,195. */
  function priceNear(n) {
    if (n == null || n < 200) return n;
    return Math.round((n + 5) / 100) * 100 - 5;
  }

  /** "Focus" → "Focuses", "3 Series" → "3 Series", "A3" → "A3s". */
  function models(car) {
    const name = car.model || car.make;
    if (!name) return 'these';
    if (/series$/i.test(name)) return name;
    if (/(s|x|z|ch|sh)$/i.test(name)) return name + 'es';
    return name + 's';
  }

  function carTitle(car) {
    return [car.year, car.make, car.model].filter(Boolean).join(' ') || 'This car';
  }

  function seconds(s) {
    if (s == null) return null;
    if (s < 60) return plural(s, 'second');
    const m = Math.round(s / 60);
    return m === 1 ? 'about a minute' : `about ${m} minutes`;
  }

  const shortDate = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const HPI_NAMES = { cat_s: 'Cat S', cat_n: 'Cat N', cat_d: 'Cat D', cat_c: 'Cat C' };

  /* -------------------------------------------------------------- market
     Where "the market" comes from, best first:
       1. Auto Trader, if connected and checked in the last fortnight
       2. Your own price book, for this model and year, in the last 60 days
       3. What you've actually sold this model for, plus your usual haggle
     Only the first two are what similar cars are ADVERTISED at. The third is
     a weaker guide and the wording says so.
     ------------------------------------------------------------------- */
  function marketFor(car, ctx) {
    const now = ctx.now;

    const at = car.at_market;
    const atTime = toTime(car.val_updated_at);
    if (at && atTime && daysBetween(atTime, now) <= THRESHOLDS.AT_MAX_AGE_DAYS) {
      const comp = at.competitors || {};
      return {
        source: 'autotrader',
        when: atTime,
        retail: car.val_retail != null ? car.val_retail : at.retail,
        indicator: car.at_price_indicator || at.indicator || null,
        bands: at.bands || null,
        low: comp.low != null ? comp.low : null,
        high: comp.high != null ? comp.high : null,
        typical: comp.median != null ? comp.median : (car.val_retail != null ? car.val_retail : at.retail),
        count: comp.count || null
      };
    }

    const pool = (ctx.checks || []).filter(pc => {
      if (!pc.typical) return false;
      if (norm(pc.make) !== norm(car.make)) return false;
      if (pc.model && car.model && norm(pc.model) !== norm(car.model)) return false;
      if (!pc.model && car.model) return false;
      const t = toTime(pc.created_at);
      if (!t || daysBetween(t, now) > THRESHOLDS.MARKET_MAX_AGE_DAYS) return false;
      if (pc.year && car.year && Math.abs(pc.year - car.year) > 1) return false;
      if (pc.mileage && car.mileage && Math.abs(pc.mileage - car.mileage) > car.mileage * 0.4) return false;
      return true;
    });
    if (pool.length) {
      const own = pool.filter(pc => pc.car_id === car.id);
      const use = own.length ? own : pool;
      const lows = use.map(pc => pc.low).filter(Boolean);
      const highs = use.map(pc => pc.high).filter(Boolean);
      return {
        source: 'price_book',
        when: Math.max(...use.map(pc => toTime(pc.created_at))),
        typical: Math.round(median(use.map(pc => pc.typical))),
        low: lows.length ? Math.min(...lows) : null,
        high: highs.length ? Math.max(...highs) : null,
        checks: use.length
      };
    }

    const ageing = ctx.ageing[car.id];
    if (ageing && ageing.avg_achieved != null) {
      const haggle = ctx.haggle;
      return {
        source: 'own_sales',
        achieved: Number(ageing.avg_achieved),
        haggle,
        typical: Number(ageing.avg_achieved) + (haggle != null ? haggle : 0)
      };
    }
    return null;
  }

  /** How far above the market this price sits, and the price that would fix it. */
  function positionFor(car, market) {
    if (!market || car.price == null) return null;

    if (market.source === 'autotrader' && market.bands && market.bands.GOOD) {
      const top = market.bands.GOOD.to;
      const rating = market.indicator;
      const above = car.price - top;
      return {
        above,
        isAbove: above > 0 && /^(FAIR|HIGH)$/i.test(rating || 'HIGH'),
        target: top,
        hardCeiling: true        // a price over this lands in the next band up
      };
    }

    // Your own sales already include the haggle, so aim at that figure itself.
    // Otherwise the top of what similar cars are advertised at, or a little over typical.
    const top = market.source === 'own_sales' ? market.typical
      : market.high != null
      ? Math.min(market.high, Math.round(market.typical * 1.05))
      : Math.round(market.typical * 1.03);
    const above = car.price - top;
    return { above, isAbove: above > THRESHOLDS.ABOVE_MARKET_MIN, target: top, hardCeiling: false };
  }

  function marketSentence(car, market) {
    const model = models(car);
    if (market.source === 'autotrader') {
      const parts = [];
      if (market.indicator) {
        parts.push(`Auto Trader rates this price ${market.indicator.toUpperCase()}` +
          (market.bands && market.bands.GOOD ? `. Their good price band tops out at ${money(market.bands.GOOD.to)}.` : '.'));
      } else if (market.retail != null) {
        parts.push(`Auto Trader values it at ${money(market.retail)} retail.`);
      }
      if (market.count && market.low != null && market.high != null) {
        parts.push(`${plural(market.count, 'similar car')} ${market.count === 1 ? 'is' : 'are'} advertised between ${money(market.low)} and ${money(market.high)}.`);
      }
      return parts.join(' ');
    }
    if (market.source === 'price_book') {
      const range = market.low != null && market.high != null && market.high > market.low
        ? `${money(market.low)} to ${money(market.high)}`
        : `around ${money(market.typical)}`;
      return `Similar ${model} were advertising at ${range} when you checked on ${shortDate(market.when)}.`;
    }
    // own sales
    return market.haggle != null
      ? `You've sold ${model} for ${money(market.achieved)} on average. Add your usual ${money(market.haggle)} of haggling and that points to asking about ${money(market.typical)}.`
      : `You've sold ${model} for ${money(market.achieved)} on average, before any haggling.`;
  }

  const MARKET_LABEL = { autotrader: 'Auto Trader', price_book: 'your price book', own_sales: 'your past sales' };

  /* ------------------------------------------------------------ the rules */
  function analyseCar(car, ctx) {
    if (car.status !== 'available') return null;
    const T = THRESHOLDS;
    const now = ctx.now;

    const active = (ctx.actions || []).filter(a =>
      a.car_id === car.id && (!a.until || toTime(a.until) > now));
    if (active.some(a => a.action === 'snoozed')) return { snoozed: true };
    const pricedOk = active.some(a => a.action === 'priced_ok' && a.price_at_action === car.price);

    const i = ctx.interest[car.id] || null;
    const ageing = ctx.ageing[car.id] || null;
    const images = Array.isArray(car.images) ? car.images : [];
    const photos = images.length;
    const listed = toTime(car.listed_at || car.created_at) || now;
    const days = daysBetween(listed, now);

    const lastChange = toTime(ageing && ageing.last_price_change);
    const priceAge = lastChange ? daysBetween(lastChange, now) : days;

    const since = ctx.trackingSince ? Math.max(ctx.trackingSince, listed) : null;
    const trackedDays = since ? daysBetween(since, now) : 0;
    const people = i ? i.visitors : 0;
    const contacted = i ? Math.max(i.contacted || 0, i.enquiries_since_tracking || 0) : 0;
    const tracked = !!(i && ctx.trackingSince && trackedDays >= T.MIN_TRACKED_DAYS);
    const measured = i ? i.measured_people || 0 : 0;
    const quickShare = measured ? (i.quick_exits || 0) / measured : null;
    const medianSecs = i ? i.median_seconds : null;

    const market = marketFor(car, ctx);
    const pos = positionFor(car, market);

    const base = {
      carId: car.id,
      title: carTitle(car),
      facts: [
        money(car.price),
        plural(days, 'day'),
        tracked ? plural(people, 'person', 'people') : null,
        tracked ? (contacted === 1 ? '1 got in touch' : `${contacted} got in touch`) : null
      ].filter(Boolean).join(' · '),
      days,
      market,
      photos
    };
    const finding = (rule, cause, severity, lines, extra) =>
      Object.assign({}, base, { rule, cause, severity, lines: lines.filter(Boolean) }, extra || {});

    const suggestion = (target, hardCeiling) => {
      const p = hardCeiling ? priceAtOrUnder(target) : priceNear(target);
      return p != null && car.price != null && p < car.price ? { price: p, label: `Drop to ${money(p)}` } : null;
    };

    /* 1. No photos at all */
    if (photos === 0) {
      return finding('no_photos', 'photos', 'act',
        ['No photos, so it isn\'t getting a fair look from anyone.'],
        { actions: ['add_photos', 'snooze'] });
    }

    /* 2. Plenty of people, nobody in touch: pick the cause */
    const lowContact = tracked && people >= T.MIN_PEOPLE && contacted === 0;
    if (lowContact) {
      const opener = `${plural(people, 'person', 'people')} ${people === 1 ? 'has' : 'have'} looked in ${plural(trackedDays, 'day')} and nobody has got in touch.`;

      if (photos < T.GOOD_PHOTOS) {
        return finding('no_contact', 'photos', 'act', [
          opener,
          `Only ${plural(photos, 'photo')}. That is the first thing to fix: people can't see enough of it to pick up the phone.`,
          pos && pos.isAbove ? `It may be priced high too, but sort the photos first so you know which one it was.` : null
        ], {
          advice: `Add at least ${T.GOOD_PHOTOS - photos} more: inside, the dashboard showing the mileage, the boot and any marks.`,
          actions: ['add_photos', 'snooze']
        });
      }

      if (quickShare != null && measured >= T.MIN_MEASURED && quickShare >= T.QUICK_EXIT_SHARE) {
        return finding('no_contact', 'first_impression', 'act', [
          opener,
          `${plural(photos, 'photo')} is plenty, but ${Math.round(quickShare * 100)}% of people leave within ${T.QUICK_EXIT_SECONDS} seconds, before they get to them.`,
          `They'd already seen the price on the stock page before tapping in, so this points at the main photo or the title rather than the price.`
        ], {
          advice: 'Change the main photo to the best angle of the car and check the title reads right.',
          actions: ['add_photos', 'snooze']
        });
      }

      const presentation = medianSecs != null && medianSecs >= T.ENGAGED_SECONDS
        ? `${plural(photos, 'photo')} and people spend ${seconds(medianSecs)} on it, so this isn't presentation.`
        : `${plural(photos, 'photo')} is plenty, so this isn't presentation.`;

      if (pricedOk) return null;   // you've told it the price is right at this figure

      if (pos && pos.isAbove) {
        const sug = suggestion(pos.target, pos.hardCeiling);
        return finding('no_contact', 'price', 'act', [
          presentation,
          marketSentence(car, market),
          `You're about ${money(Math.round(pos.above / 50) * 50)} above that and it's showing in the contact rate.`
        ], { suggestion: sug, actions: ['reprice', 'priced_ok', 'snooze'] });
      }

      if (pos) {
        const hpi = HPI_NAMES[car.hpi_status];
        return finding('no_contact', 'unclear', 'watch', [
          presentation,
          `It's priced in line with ${MARKET_LABEL[market.source]} (${money(pos.target)} at the top), so it isn't obviously the price either.`,
          hpi ? `As a ${hpi} it has to be clearly cheaper than clean ones before people ring.` : null,
          `Check the description answers what buyers ask first: MOT, service history and owners.`
        ], { actions: ['edit', 'autotrader', 'snooze'] });
      }

      return finding('no_contact', 'price_unchecked', 'act', [
        presentation,
        `When people look this much and don't ring, it is usually the price, but there's nothing to check it against yet.`
      ], {
        advice: `Check what ${models(car)} are up for and record it. Next time this will tell you the gap.`,
        actions: ['check_market', 'priced_ok', 'snooze']
      });
    }

    /* 3. Getting calls: say so, so nobody cuts a price that's working */
    if (i && (i.contacted_7d || 0) >= T.HOT_CONTACTS_7D) {
      return finding('hot', 'demand', 'good', [
        `${plural(i.contacted_7d, 'person', 'people')} got in touch about it this week.`,
        pos && pos.isAbove
          ? `It's above ${MARKET_LABEL[market.source]} and still getting calls, so hold the price.`
          : `Hold the price.`
      ], { actions: [] });
    }

    /* 4. Hardly anyone reaching it: visibility, not price */
    const baseRate = ctx.baseline.peoplePerWeek;
    if (i && ctx.trackingSince && trackedDays >= T.LOW_TRAFFIC_MIN_DAYS && baseRate != null && baseRate >= 5) {
      const perWeek = people / trackedDays * 7;
      if (perWeek < baseRate * T.LOW_TRAFFIC_SHARE) {
        const acts = [];
        if (!car.featured) acts.push('feature');
        if (!car.at_published) acts.push('autotrader');
        acts.push('listing_pack', 'snooze');
        return finding('low_traffic', 'visibility', 'watch', [
          `Only ${plural(people, 'person', 'people')} in ${plural(trackedDays, 'day')}, against about ${Math.round(baseRate)} a week for your other cars.`,
          `People aren't turning it down, they aren't finding it.`
        ], {
          advice: [!car.featured ? 'feature it on the homepage' : null,
                   !car.at_published ? 'give it an Auto Trader slot' : null,
                   'post it on Facebook'].filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase()) + '.',
          actions: acts
        });
      }
    }

    /* 5. Interest falling away */
    if (i && (i.visitors_prev_7d || 0) >= T.FALLING_MIN_PREV && (i.visitors_7d || 0) <= i.visitors_prev_7d / 2) {
      return finding('falling', 'interest_falling', 'watch', [
        `Interest has dropped from ${plural(i.visitors_prev_7d, 'person', 'people')} last week to ${i.visitors_7d} this week.`,
        pos && pos.isAbove ? marketSentence(car, market) : null
      ], {
        suggestion: pos && pos.isAbove && !pricedOk ? suggestion(pos.target, pos.hardCeiling) : null,
        actions: pos && pos.isAbove && !pricedOk ? ['reprice', 'priced_ok', 'snooze'] : ['check_market', 'snooze']
      });
    }

    /* 6. Sitting with the same price */
    if (days >= T.AGEING_WATCH_DAYS && priceAge >= T.PRICE_STALE_DAYS && !pricedOk) {
      const tiedUp = (car.purchase_price || 0) + (car.prep_cost || 0);
      const usual = ageing && ageing.avg_days_to_sell != null ? Number(ageing.avg_days_to_sell) : null;
      let sug = null, marketLine = null;
      if (pos && pos.isAbove) { sug = suggestion(pos.target, pos.hardCeiling); marketLine = marketSentence(car, market); }
      else if (car.price != null) {
        sug = suggestion(car.price * (1 - T.AGEING_STEP_PCT / 100));
        if (sug) marketLine = `With nothing to compare it against, a first step of about ${T.AGEING_STEP_PCT}% would be ${money(sug.price)}.`;
      }
      return finding('ageing', 'ageing', days >= T.AGEING_ACT_DAYS ? 'act' : 'watch', [
        lastChange
          ? `${plural(days, 'day')} in stock and the price hasn't moved in ${plural(priceAge, 'day')}.`
          : `${plural(days, 'day')} in stock at the price it went on at.`,
        usual != null ? `You usually sell ${models(car)} in about ${plural(usual, 'day')}.` : null,
        tiedUp ? `${money(tiedUp)} tied up in it.` : null,
        marketLine
      ], { suggestion: sug, actions: sug ? ['reprice', 'priced_ok', 'snooze'] : ['check_market', 'snooze'] });
    }

    /* 7. Thin on photos, even before there's any tracking to prove it */
    if (photos < T.FEW_PHOTOS) {
      return finding('few_photos', 'photos', 'watch', [
        `Only ${plural(photos, 'photo')}. Buyers expect to see inside, the dashboard and the boot before they ring.`
      ], { actions: ['add_photos', 'snooze'] });
    }

    return null;
  }

  /* ------------------------------------------------------------ baseline */
  function buildBaseline(cars, ctx) {
    const perWeek = [];
    const rates = [];
    for (const car of cars) {
      if (car.status !== 'available') continue;
      const i = ctx.interest[car.id];
      if (!i || !ctx.trackingSince) continue;
      const listed = toTime(car.listed_at || car.created_at) || ctx.now;
      const days = daysBetween(Math.max(ctx.trackingSince, listed), ctx.now);
      if (days < THRESHOLDS.MIN_TRACKED_DAYS) continue;
      perWeek.push(i.visitors / days * 7);
      if (i.visitors >= THRESHOLDS.MIN_PEOPLE) {
        rates.push(100 * Math.min(i.contacted || 0, i.visitors) / i.visitors);
      }
    }
    return {
      cars: perWeek.length,
      peoplePerWeek: perWeek.length >= 3 ? median(perWeek) : null,
      contactRatePct: rates.length >= 3 ? Math.round(median(rates) * 10) / 10 : null
    };
  }

  /** Typical £ knocked off the asking price at sale, from cars with both figures. */
  function usualHaggle(cars) {
    const gaps = cars
      .filter(c => c.status === 'sold' && c.price != null && c.sale_price != null)
      .map(c => c.price - c.sale_price)
      .filter(g => g >= 0 && g < 5000);
    if (gaps.length < THRESHOLDS.HAGGLE_MIN_SALES) return null;
    return Math.round(median(gaps) / 5) * 5;
  }

  /**
   * @param {object} input
   * @param {Date|number} [input.now]
   * @param {object[]} input.cars           rows from `cars`
   * @param {object[]} [input.interest]     rows from `car_interest` (schema v6)
   * @param {object[]} [input.ageing]       rows from `stock_ageing`
   * @param {object[]} [input.checks]       rows from `price_checks`
   * @param {object[]} [input.actions]      rows from `insight_actions` (schema v7)
   * @returns {{ findings: object[], snoozed: number, baseline: object, trackingSince: number|null, haggle: number|null }}
   */
  function analyse(input) {
    const now = toTime(input.now) || Date.now();
    const byId = rows => Object.fromEntries((rows || []).map(r => [r.car_id || r.id, r]));
    const interestRows = input.interest || [];
    const since = interestRows.map(r => toTime(r.tracking_since)).find(Boolean) || null;

    const ctx = {
      now,
      interest: byId(interestRows),
      ageing: byId(input.ageing),
      checks: input.checks || [],
      actions: input.actions || [],
      trackingSince: since
    };
    const cars = input.cars || [];
    ctx.haggle = usualHaggle(cars);
    ctx.baseline = buildBaseline(cars, ctx);

    const findings = [];
    let snoozed = 0;
    for (const car of cars) {
      const f = analyseCar(car, ctx);
      if (!f) continue;
      if (f.snoozed) { snoozed++; continue; }
      findings.push(f);
    }
    findings.sort((a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.days - a.days);

    return { findings, snoozed, baseline: ctx.baseline, trackingSince: since, haggle: ctx.haggle };
  }

  return { analyse, THRESHOLDS, priceAtOrUnder, priceNear, positionFor, marketFor, usualHaggle };
});
