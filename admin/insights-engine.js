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

   TUNED AGAINST REAL DATA, 13 September 2026 (33 cars, 14 sales):
     · the 14 sales took a median of 12 days, but 19 cars hadn't sold yet and
       12 of those were already 21 days old. Counting only the cars that sold
       makes selling look twice as fast as it is, so selling speed counts the
       unsold ones too (a survival curve) and says nothing until it can
     · the website turned about 1.8% of page views into a contact, so "nobody
       got in touch" only means something after enough people have looked
     · 70% of stock was Cat N or Cat S, so market figures for clean cars are
       never used as if they were the price for a Cat car
     · haggling ran from nothing to 17% of the asking price, so it's a %
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MBU_INSIGHTS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const THRESHOLDS = {
    /* ---- contact ---------------------------------------------------------
       Zero contacts on a car only means something once enough people have
       looked that zero would be unlikely by chance at your normal contact
       rate. At 3%, 20 people with nobody in touch happens more often than
       not; it takes about 76 before it's under 10%. */
    MIN_PEOPLE: 20,             // never judge a car on fewer people than this
    MIN_PEOPLE_CAP: 150,        // and never ask for more than this
    PRIOR_CONTACT_RATE: 0.03,   // used until the new tracking has its own figure
    BASELINE_MIN_PEOPLE: 150,   // people across all cars before your own rate is trusted
    ZERO_CONTACT_CHANCE: 0.1,   // "unlikely by chance" means under 10%
    MIN_TRACKED_DAYS: 5,        // days of new tracking on a car before judging it

    /* ---- presentation --------------------------------------------------- */
    GOOD_PHOTOS: 12,            // this many photos and presentation is ruled out
    FEW_PHOTOS: 8,              // fewer than this is worth saying even without tracking
    QUICK_EXIT_SECONDS: 10,     // must match quick_exits in car_interest
    QUICK_EXIT_SHARE: 0.6,      // this share leaving that fast = first impression problem
    MIN_MEASURED: 8,            // people with time-on-page before trusting the share above
    ENGAGED_SECONDS: 30,        // median time that counts as "spending time on it"

    /* ---- selling speed ---------------------------------------------------
       "Sitting" means "longer than most of YOUR cars take to sell": worth a
       look once 3 in 4 of your cars would have sold, a decision once 9 in 10
       would. Worked out from sold AND unsold cars, because counting only the
       ones that sold makes everything look faster than it is. Until there's
       enough history to say, the fixed days below are used. */
    TURN_MIN_SALES: 8,          // sales needed before your own selling speed is used
    TURN_MIN_AT_RISK: 5,        // cars still unsold at a point for it to count
    TURN_LOOKBACK_DAYS: 180,    // cars listed within this long
    AGEING_MIN_WATCH_DAYS: 14,  // never earlier than this, however fast things sell
    AGEING_MIN_ACT_DAYS: 21,
    AGEING_WATCH_DAYS: 45,      // until your own figures are known
    AGEING_ACT_DAYS: 60,        // until your own figures are known
    PRICE_STALE_DAYS: 21,       // an ageing car whose price moved more recently than
                                //   min(this, your usual selling time) is left alone
    AGEING_STEP_PCT: 3,         // price step suggested when there's no market figure

    /* ---- market ---------------------------------------------------------- */
    MARKET_MAX_AGE_DAYS: 60,    // price book checks older than this are ignored
    AT_MAX_AGE_DAYS: 14,        // Auto Trader figures older than this are ignored
    ABOVE_MARKET_MIN: 150,      // £ above the top of the market before calling it
    HAGGLE_MIN_SALES: 3,        // sales needed before "your usual haggle" is quoted

    /* ---- Cat N / Cat S ---------------------------------------------------
       Price book checks and Auto Trader figures are for CLEAN cars. Set how
       far below a clean one you normally price each category, as a %, and
       Cat cars are compared against that. Left as null (unknown), a Cat car
       is only called "above the market" when it's above clean cars too,
       which can't be wrong, and priced-like-clean is flagged without a
       suggested figure. */
    CAT_DISCOUNT_PCT: { cat_n: null, cat_s: 14, cat_d: null, cat_c: null },
    // cat_s 14: the dealer's own example, 13 Sept 2026. The Cat S Jeep Avenger at
    // £11,999 would be about £14,000 clean. One car, so treat as rough. Cat N not
    // given yet. Once Auto Trader is connected its figures are the guide instead,
    // and if its valuation for a Cat car already allows for the category, set
    // CAT_DISCOUNT_ON_AUTOTRADER to false so it isn't knocked off twice.
    CAT_DISCOUNT_ON_AUTOTRADER: true,

    /* ---- traffic -------------------------------------------------------- */
    LOW_TRAFFIC_SHARE: 0.4,     // under 40% of the typical car's people a week
    LOW_TRAFFIC_MIN_DAYS: 10,
    LOW_TRAFFIC_MIN_BASELINE: 3,// typical car needs this many people a week to compare
    HOT_CONTACTS_7D: 3,
    FALLING_MIN_PREV: 10        // people in the previous week before calling a drop
  };

  const SEVERITY_ORDER = { act: 0, watch: 1, good: 2 };
  const DAY = 86400000;

  /* ------------------------------------------------------------ helpers */
  const money = n => n == null ? 'no price' : '£' + Math.round(n).toLocaleString('en-GB');
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const daysBetween = (a, b) => Math.max(0, Math.floor((b - a) / DAY));
  const toTime = d => d == null ? null : (d instanceof Date ? d.getTime() : new Date(d).getTime());

  /* Makes and models are typed by hand, so "Mercedes", "mercedes-benz" and
     "Mercedes-Benz" must all be the same thing when matching history, the
     price book and car requests. Display spelling is left alone. */
  const MAKE_ALIASES = { mercedes: 'mercedesbenz', merc: 'mercedesbenz', mb: 'mercedesbenz',
                         vw: 'volkswagen', landrover: 'landrover', rangerover: 'landrover' };
  const squash = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const makeKey = s => { const k = squash(s); return MAKE_ALIASES[k] || k; };
  const modelKey = s => squash(s).replace(/class$/, '');   // "A Class" = "A-Class" = "A"

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

  /** Sold cars of the same make and model, spelling differences ignored. */
  function sameModelSold(car, cars) {
    if (!car.make || !car.model) return [];
    const mk = makeKey(car.make), md = modelKey(car.model);
    return (cars || []).filter(c => c.status === 'sold' && c.id !== car.id
      && (c.sale_price != null || c.price != null)
      && makeKey(c.make) === mk && modelKey(c.model) === md);
  }

  /* -------------------------------------------------------------- market
     Where "the market" comes from, best first:
       1. Auto Trader, if connected and checked in the last fortnight
       2. Your own price book, for this model and year, in the last 60 days
       3. What you've actually sold this model for, allowing for your usual haggle
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
      if (makeKey(pc.make) !== makeKey(car.make)) return false;
      if (pc.model && car.model && modelKey(pc.model) !== modelKey(car.model)) return false;
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

    // Worked out from the cars themselves, so "Mercedes" and "Mercedes-Benz"
    // count as the same thing (the stock_ageing view only lower-cases them)
    const same = sameModelSold(car, ctx.cars);
    if (same.length) {
      const achieved = Math.round(same.reduce((n, c) => n + (c.sale_price != null ? c.sale_price : c.price), 0) / same.length);
      const pct = ctx.haggle ? ctx.haggle.pct : null;
      return {
        source: 'own_sales',
        achieved,
        sold: same.length,
        hagglePct: pct,
        // Sale prices already have the haggle taken off, so the asking price
        // that gets you there is higher by your usual discount
        typical: pct ? Math.round(achieved / (1 - pct / 100)) : achieved
      };
    }
    return null;
  }

  /**
   * How far above the market this price sits, and the price that would fix it.
   * Cat N / Cat S cars are compared with clean-car figures cut by the
   * discount in THRESHOLDS.CAT_DISCOUNT_PCT, when one has been set.
   */
  function positionFor(car, market) {
    if (!market || car.price == null) return null;
    const cat = HPI_NAMES[car.hpi_status] ? car.hpi_status : null;
    const discount = cat && market.source !== 'own_sales'
      && (market.source !== 'autotrader' || THRESHOLDS.CAT_DISCOUNT_ON_AUTOTRADER)
      ? THRESHOLDS.CAT_DISCOUNT_PCT[cat] : null;
    const factor = discount != null ? 1 - discount / 100 : 1;
    const info = { cat, catDiscount: discount };

    if (market.source === 'autotrader' && market.bands && market.bands.GOOD) {
      const top = Math.round(market.bands.GOOD.to * factor);
      const above = car.price - top;
      const isAbove = discount != null
        ? above > 0
        : above > 0 && /^(FAIR|HIGH)$/i.test(market.indicator || 'HIGH');
      return Object.assign(info, {
        above, isAbove, target: top,
        hardCeiling: discount == null,     // a price over GOOD.to lands in the next band up
        likeClean: !!cat && discount == null && !isAbove && car.price >= market.bands.GOOD.from
      });
    }

    // Your own sales already allow for the haggle, so aim at that figure itself.
    // Otherwise the top of what similar cars are advertised at, or a little over typical.
    const cleanTop = market.source === 'own_sales' ? market.typical
      : market.high != null
      ? Math.min(market.high, Math.round(market.typical * 1.05))
      : Math.round(market.typical * 1.03);
    const top = Math.round(cleanTop * factor);
    const above = car.price - top;
    const isAbove = above > THRESHOLDS.ABOVE_MARKET_MIN;
    return Object.assign(info, {
      above, isAbove, target: top, hardCeiling: false,
      likeClean: !!cat && discount == null && market.source !== 'own_sales'
        && !isAbove && car.price >= market.typical
    });
  }

  function marketSentence(car, market, pos) {
    const model = models(car);
    const catName = pos && pos.cat ? HPI_NAMES[pos.cat] : null;
    let s;
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
      s = parts.join(' ');
    } else if (market.source === 'price_book') {
      const range = market.low != null && market.high != null && market.high > market.low
        ? `${money(market.low)} to ${money(market.high)}`
        : `around ${money(market.typical)}`;
      s = `Similar ${model} were advertising at ${range} when you checked on ${shortDate(market.when)}.`;
    } else {
      return market.hagglePct
        ? `You've sold ${model} for ${money(market.achieved)} on average. Your cars usually go for about ${market.hagglePct}% under the asking price, which points to asking about ${money(Math.round(market.typical / 10) * 10)}.`
        : `You've sold ${model} for ${money(market.achieved)} on average, before any haggling.`;
    }
    if (catName && pos.catDiscount != null) {
      s += ` Allowing ${pos.catDiscount}% for it being a ${catName}, that's about ${money(pos.target)}.`;
    } else if (catName) {
      s += ` Those are figures for clean cars, and as a ${catName} it would normally sit below them.`;
    }
    return s;
  }

  const MARKET_LABEL = { autotrader: 'Auto Trader', price_book: 'your price book', own_sales: 'your past sales' };

  /* ------------------------------------------------------------ the rules */
  function analyseCar(car, ctx) {
    if (car.status !== 'available') return null;
    const T = THRESHOLDS;
    const now = ctx.now;
    const speed = ctx.speed;

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
    const firstImpression = quickShare != null && measured >= T.MIN_MEASURED && quickShare >= T.QUICK_EXIT_SHARE;

    const market = marketFor(car, ctx);
    const pos = positionFor(car, market);
    const catName = HPI_NAMES[car.hpi_status] || null;

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

    /* 2. People looking, nobody in touch: pick the cause
       STRONG: enough people that zero contacts is unlikely to be chance.
               That alone says something is wrong, so a cause is always given.
       WEAK:   at least MIN_PEOPLE but not that many. Zero contacts proves
               nothing on its own, so a card only appears when something
               else independently points at a cause: few photos, people
               leaving in seconds, or a price above the market. */
    if (tracked && people >= T.MIN_PEOPLE && contacted === 0) {
      const strong = people >= ctx.minPeople;
      const oneIn = Math.round(1 / ctx.baseline.contactRate);
      const opener = strong
        ? `${plural(people, 'person', 'people')} ${people === 1 ? 'has' : 'have'} looked in ${plural(trackedDays, 'day')} and nobody has got in touch. Normally about 1 in ${oneIn} would have.`
        : `${plural(people, 'person', 'people')} ${people === 1 ? 'has' : 'have'} looked in ${plural(trackedDays, 'day')} and nobody has got in touch yet.`;

      if (photos < T.GOOD_PHOTOS) {
        return finding('no_contact', 'photos', strong ? 'act' : 'watch', [
          opener,
          `Only ${plural(photos, 'photo')}. That is the first thing to fix: people can't see enough of it to pick up the phone.`,
          pos && pos.isAbove ? `It may be priced high too, but sort the photos first so you know which one it was.` : null
        ], {
          advice: `Add at least ${T.GOOD_PHOTOS - photos} more: inside, the dashboard showing the mileage, the boot and any marks.`,
          actions: ['add_photos', 'snooze']
        });
      }

      if (firstImpression) {
        return finding('no_contact', 'first_impression', strong ? 'act' : 'watch', [
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

      if (!pricedOk && pos && pos.isAbove) {
        const gap = money(Math.round(pos.above / 50) * 50);
        return finding('no_contact', 'price', strong ? 'act' : 'watch', [
          opener,
          presentation,
          marketSentence(car, market, pos),
          strong
            ? `You're about ${gap} above that and it's showing in the contact rate.`
            : `You're about ${gap} above that, which would explain it.`
        ], { suggestion: suggestion(pos.target, pos.hardCeiling), actions: ['reprice', 'priced_ok', 'snooze'] });
      }

      if (!pricedOk && pos && pos.likeClean) {
        return finding('no_contact', 'price_cat', strong ? 'act' : 'watch', [
          opener,
          presentation,
          `It's priced like a clean one. ${marketSentence(car, market, pos)}`,
          `That is the likeliest reason nobody has got in touch${strong ? '' : ' yet'}.`
        ], { actions: ['check_market', 'priced_ok', 'snooze'] });
      }

      if (!strong || pricedOk) return null;

      if (pos) {
        return finding('no_contact', 'unclear', 'watch', [
          opener,
          presentation,
          `It's priced in line with ${MARKET_LABEL[market.source]} (${money(pos.target)} at the top), so it isn't obviously the price either.`,
          `Check the description answers what buyers ask first: MOT, service history and owners.`
        ], { actions: ctx.atSlotsKnown ? ['edit', 'autotrader', 'snooze'] : ['edit', 'snooze'] });
      }

      return finding('no_contact', 'price_unchecked', 'act', [
        opener,
        presentation,
        `When that happens it is usually the price, but there's nothing to check it against yet.`
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
    if (i && ctx.trackingSince && trackedDays >= T.LOW_TRAFFIC_MIN_DAYS
        && baseRate != null && baseRate >= T.LOW_TRAFFIC_MIN_BASELINE) {
      const perWeek = people / trackedDays * 7;
      if (perWeek < baseRate * T.LOW_TRAFFIC_SHARE) {
        const acts = [];
        if (!car.featured) acts.push('feature');
        if (!car.at_published && ctx.atSlotsKnown) acts.push('autotrader');
        acts.push('listing_pack', 'snooze');
        return finding('low_traffic', 'visibility', days >= speed.actDays ? 'act' : 'watch', [
          `Only ${plural(people, 'person', 'people')} in ${plural(trackedDays, 'day')}, against about ${Math.round(baseRate)} a week for your other cars.`,
          speed.own && days >= speed.watchDays
            ? `It's been in stock ${plural(days, 'day')}. Three in four of your cars have sold by ${speed.watchDays}.` : null,
          `People aren't turning it down, they aren't finding it.`
        ], {
          advice: [!car.featured ? 'feature it on the homepage' : null,
                   !car.at_published && ctx.atSlotsKnown ? 'give it an Auto Trader slot' : null,
                   'post it on Facebook'].filter(Boolean).join(', ').replace(/^./, c => c.toUpperCase()) + '.',
          actions: acts
        });
      }
    }

    /* 5. Interest falling away */
    if (i && (i.visitors_prev_7d || 0) >= T.FALLING_MIN_PREV && (i.visitors_7d || 0) <= i.visitors_prev_7d / 2) {
      return finding('falling', 'interest_falling', 'watch', [
        `Interest has dropped from ${plural(i.visitors_prev_7d, 'person', 'people')} last week to ${i.visitors_7d} this week.`,
        pos && pos.isAbove ? marketSentence(car, market, pos) : null
      ], {
        suggestion: pos && pos.isAbove && !pricedOk ? suggestion(pos.target, pos.hardCeiling) : null,
        actions: pos && pos.isAbove && !pricedOk ? ['reprice', 'priced_ok', 'snooze'] : ['check_market', 'snooze']
      });
    }

    /* 6. In stock longer than your cars usually take to sell
       Measured against YOUR selling speed. Picks a cause from whatever
       evidence there is: people leaving in seconds points at presentation,
       otherwise the price, against the market when there's a figure. */
    if (days >= speed.watchDays && priceAge >= speed.staleDays && !pricedOk) {
      const severity = days >= speed.actDays ? 'act' : 'watch';
      const tiedUp = (car.purchase_price || 0) + (car.prep_cost || 0);
      // Only the ones that sold, and it says so: the unsold ones aren't in this figure
      const soldSame = sameModelSold(car, ctx.cars).filter(c => c.sold_at && (c.listed_at || c.created_at));
      const usualModel = soldSame.length
        ? Math.round(median(soldSame.map(c => daysBetween(toTime(c.listed_at || c.created_at), toTime(c.sold_at)))))
        : null;
      const opener = !speed.own ? `${plural(days, 'day')} in stock.`
        : days >= speed.actDays && speed.p90Days != null
        ? `${plural(days, 'day')} in stock. Nine in ten of your cars have sold by ${speed.p90Days} days.`
        : `${plural(days, 'day')} in stock. Three in four of your cars have sold by ${speed.watchDays} days.`;
      const priceLine = lastChange && priceAge < days
        ? `The price last changed ${plural(priceAge, 'day')} ago.`
        : `Still at the price it went on at.`;
      const modelLine = usualModel == null ? null
        : soldSame.length === 1
        ? `The ${car.model} you sold took ${plural(usualModel, 'day')}.`
        : `The ${models(car)} you've sold took about ${plural(usualModel, 'day')}.`;
      const tiedLine = tiedUp ? `${money(tiedUp)} tied up in it.` : null;

      if (firstImpression) {
        return finding('ageing', 'first_impression', severity, [
          opener,
          `${Math.round(quickShare * 100)}% of people leave within ${T.QUICK_EXIT_SECONDS} seconds, so they're not getting as far as the photos.`,
          tiedLine
        ], {
          advice: 'Change the main photo to the best angle of the car and check the title reads right, before touching the price.',
          actions: ['add_photos', 'snooze']
        });
      }

      const engaged = medianSecs != null && medianSecs >= T.ENGAGED_SECONDS
        ? `People who look spend ${seconds(medianSecs)} on it, so it isn't the listing putting them off.` : null;

      if (pos && pos.isAbove) {
        return finding('ageing', 'price', severity, [
          opener, priceLine, engaged, marketSentence(car, market, pos),
          `You're about ${money(Math.round(pos.above / 50) * 50)} above that.`, tiedLine
        ], { suggestion: suggestion(pos.target, pos.hardCeiling), actions: ['reprice', 'priced_ok', 'snooze'] });
      }

      if (pos && pos.likeClean) {
        return finding('ageing', 'price_cat', severity, [
          opener, priceLine, engaged,
          `It's priced like a clean one. ${marketSentence(car, market, pos)}`,
          tiedLine
        ], { actions: ['check_market', 'priced_ok', 'snooze'] });
      }

      let sug = null, marketLine = null;
      if (pos) {
        marketLine = `It's priced in line with ${MARKET_LABEL[market.source]}, so a big cut shouldn't be needed.`;
        if (car.price != null) sug = suggestion(car.price * (1 - T.AGEING_STEP_PCT / 100));
      } else if (car.price != null) {
        sug = suggestion(car.price * (1 - T.AGEING_STEP_PCT / 100));
        if (sug) marketLine = `With nothing to compare it against, a first step of about ${T.AGEING_STEP_PCT}% would be ${money(sug.price)}.`;
      }
      return finding('ageing', 'ageing', severity, [
        opener, priceLine, modelLine, engaged,
        catName && !pos ? `Check it against other ${catName} cars, not clean ones.` : null,
        tiedLine, marketLine
      ], { suggestion: sug, actions: sug ? ['reprice', 'check_market', 'priced_ok', 'snooze'] : ['check_market', 'snooze'] });
    }

    /* 7. Thin on photos, even before there's any tracking to prove it */
    if (photos < T.FEW_PHOTOS) {
      return finding('few_photos', 'photos', 'watch', [
        `Only ${plural(photos, 'photo')}. Buyers expect to see inside, the dashboard and the boot before they ring.`
      ], { actions: ['add_photos', 'snooze'] });
    }

    return null;
  }

  /* ------------------------------------------------------------ baseline
     Contact rate is POOLED (everyone who got in touch ÷ everyone who looked,
     across all cars) rather than a median of each car's rate. When most
     cars have no contacts, the median is 0 and useless. */
  function buildBaseline(cars, ctx) {
    const T = THRESHOLDS;
    const perWeek = [];
    let looked = 0, got = 0;

    for (const car of cars) {
      const i = ctx.interest[car.id];
      if (!i || !ctx.trackingSince) continue;
      looked += i.visitors || 0;
      got += Math.min(i.visitors || 0, Math.max(i.contacted || 0, i.enquiries_since_tracking || 0));

      if (car.status !== 'available') continue;
      const listed = toTime(car.listed_at || car.created_at) || ctx.now;
      const days = daysBetween(Math.max(ctx.trackingSince, listed), ctx.now);
      if (days >= T.MIN_TRACKED_DAYS) perWeek.push(i.visitors / days * 7);
    }

    const own = looked >= T.BASELINE_MIN_PEOPLE && got > 0;
    const contactRate = own ? got / looked : T.PRIOR_CONTACT_RATE;
    return {
      cars: perWeek.length,
      peoplePerWeek: perWeek.length >= 3 ? median(perWeek) : null,
      contactRate,
      contactRatePct: Math.round(contactRate * 1000) / 10,
      contactRateIsOwn: own,
      peopleCounted: looked
    };
  }

  /** People needed before zero contacts is unlikely to be chance, at this rate. */
  function peopleNeeded(rate) {
    const T = THRESHOLDS;
    if (!(rate > 0 && rate < 1)) return T.MIN_PEOPLE_CAP;
    const n = Math.ceil(Math.log(T.ZERO_CONTACT_CHANCE) / Math.log(1 - rate));
    return Math.min(T.MIN_PEOPLE_CAP, Math.max(T.MIN_PEOPLE, n));
  }

  /**
   * How long your cars take to sell, counting the ones that haven't sold yet.
   *
   * A Kaplan-Meier survival curve: at each day a car sold, the share of cars
   * still unsold drops by (sold that day ÷ cars still unsold on that day). A
   * car that hasn't sold yet counts as "still unsold" for as long as it has
   * been listed, then simply stops counting. That is what stops a batch of
   * slow cars being ignored just because they haven't sold.
   *
   * Only read where at least TURN_MIN_AT_RISK cars were still unsold, so one
   * old car can't decide the answer.
   */
  function sellingSpeed(cars, now) {
    const T = THRESHOLDS;
    const obs = cars
      .filter(c => ['available', 'reserved', 'sold'].includes(c.status) && (c.listed_at || c.created_at))
      .map(c => {
        const start = toTime(c.listed_at || c.created_at);
        const sold = c.status === 'sold' && !!c.sold_at;
        return { start, sold, t: daysBetween(start, sold ? toTime(c.sold_at) : now) };
      })
      .filter(o => now - o.start <= T.TURN_LOOKBACK_DAYS * DAY);

    const sales = obs.filter(o => o.sold).length;
    const times = [...new Set(obs.filter(o => o.sold).map(o => o.t))].sort((a, b) => a - b);
    const curve = [];
    let unsold = 1;
    for (const t of times) {
      const atRisk = obs.filter(o => o.t >= t).length;
      if (atRisk < T.TURN_MIN_AT_RISK) break;
      const soldThen = obs.filter(o => o.sold && o.t === t).length;
      unsold *= 1 - soldThen / atRisk;
      curve.push({ t, unsold, atRisk });
    }
    const soldBy = share => { const p = curve.find(c => c.unsold <= 1 - share); return p ? p.t : null; };
    const last = curve[curve.length - 1] || null;

    const medianDays = soldBy(0.5);
    const p75Days = soldBy(0.75);
    const p90Days = soldBy(0.9);
    const own = sales >= T.TURN_MIN_SALES && p75Days != null;
    const watchDays = own ? Math.max(T.AGEING_MIN_WATCH_DAYS, p75Days) : T.AGEING_WATCH_DAYS;
    const actDays = own
      ? Math.max(T.AGEING_MIN_ACT_DAYS, watchDays + 7, p90Days != null ? p90Days : Math.round(watchDays * 1.5))
      : T.AGEING_ACT_DAYS;

    return {
      own, sales, medianDays, p75Days, p90Days, watchDays, actDays,
      staleDays: Math.max(7, Math.min(T.PRICE_STALE_DAYS, medianDays != null ? medianDays : T.PRICE_STALE_DAYS)),
      // e.g. "46% sold within 19 days" when there isn't enough to say more
      soFar: last ? { days: last.t, soldPct: Math.round((1 - last.unsold) * 100) } : null
    };
  }

  /**
   * How far under the asking price your cars actually go, as a %, from sales
   * with both figures. A % travels across price levels where £ doesn't: £300
   * is 12% on a £2,500 car and 3% on a £10,000 one.
   */
  function usualHaggle(cars) {
    const pcts = cars
      .filter(c => c.status === 'sold' && c.price > 0 && c.sale_price != null)
      .map(c => 100 * (c.price - c.sale_price) / c.price)
      // Negative is real: a popular car can go for MORE than asking to secure it
      .filter(p => p > -25 && p < 40);
    if (pcts.length < THRESHOLDS.HAGGLE_MIN_SALES) return null;
    return {
      pct: Math.round(median(pcts)),
      sales: pcts.length,
      atAsking: pcts.filter(p => p === 0).length,
      aboveAsking: pcts.filter(p => p < 0).length
    };
  }

  /**
   * @param {object} input
   * @param {Date|number} [input.now]
   * @param {object[]} input.cars           rows from `cars`
   * @param {object[]} [input.interest]     rows from `car_interest` (schema v6)
   * @param {object[]} [input.ageing]       rows from `stock_ageing`
   * @param {object[]} [input.checks]       rows from `price_checks`
   * @param {object[]} [input.actions]      rows from `insight_actions` (schema v7)
   * @param {boolean}  [input.atSlotsKnown] true only when at_published reflects Auto Trader
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
      trackingSince: since,
      // Whether "on Auto Trader" on each car can be trusted. The dealer lists cars
      // on Auto Trader without ticking it in the app, so false until the app reads
      // the real advert list from Auto Trader's Stock API.
      atSlotsKnown: !!input.atSlotsKnown
    };
    const cars = input.cars || [];
    ctx.cars = cars;
    ctx.haggle = usualHaggle(cars);
    ctx.speed = sellingSpeed(cars, now);
    ctx.baseline = buildBaseline(cars, ctx);
    ctx.minPeople = peopleNeeded(ctx.baseline.contactRate);

    const findings = [];
    let snoozed = 0;
    for (const car of cars) {
      const f = analyseCar(car, ctx);
      if (!f) continue;
      if (f.snoozed) { snoozed++; continue; }
      findings.push(f);
    }
    // Most urgent first. At the same urgency, a card that names a specific
    // cause (priced above the market, too few photos) comes before a plain
    // "it's been a while", so a batch of old cars can't bury it. Then oldest.
    const generic = f => f.cause === 'ageing' ? 1 : 0;
    findings.sort((a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || generic(a) - generic(b) || b.days - a.days);

    return {
      findings, snoozed,
      baseline: ctx.baseline,
      minPeople: ctx.minPeople,
      speed: ctx.speed,
      trackingSince: since,
      haggle: ctx.haggle
    };
  }

  return {
    analyse, THRESHOLDS, priceAtOrUnder, priceNear, positionFor, marketFor,
    usualHaggle, sellingSpeed, peopleNeeded, makeKey, modelKey
  };
});
