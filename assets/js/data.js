/* ============================================================================
   MBU CAR SALES / CORE LIBRARY
   Icons, formatting, image handling and the data layer.
   Works with demo data until Supabase is connected in config.js.
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.MBU_CONFIG;
  const MBU = window.MBU = {};

  /* ==========================================================================
     ICONS. Usage: MBU.icon('phone')  or  MBU.icon('phone', 'my-class')
     ========================================================================== */
  const P = 'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const PATHS = {
    phone:    `<path ${P} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>`,
    whatsapp: `<path fill="currentColor" d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.3 5.3 4.6 2 .8 2.7.9 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z"/><path ${P} d="M12 21.5a9.4 9.4 0 0 1-4.8-1.3L2.5 21.5l1.4-4.5A9.5 9.5 0 1 1 12 21.5Z"/>`,
    mail:     `<rect ${P} x="2" y="4" width="20" height="16" rx="2.5"/><path ${P} d="m2.6 6.6 8.3 5.5c.7.4 1.5.4 2.2 0l8.3-5.5"/>`,
    chevronR: `<polyline ${P} points="9 18 15 12 9 6"/>`,
    chevronL: `<polyline ${P} points="15 18 9 12 15 6"/>`,
    chevronD: `<polyline ${P} points="6 9 12 15 18 9"/>`,
    arrowR:   `<line ${P} x1="4" y1="12" x2="19" y2="12"/><polyline ${P} points="13 6 19 12 13 18"/>`,
    menu:     `<line ${P} x1="3" y1="7" x2="21" y2="7"/><line ${P} x1="3" y1="12" x2="21" y2="12"/><line ${P} x1="3" y1="17" x2="21" y2="17"/>`,
    close:    `<line ${P} x1="6" y1="6" x2="18" y2="18"/><line ${P} x1="18" y1="6" x2="6" y2="18"/>`,
    camera:   `<path ${P} d="M3 8.5A2 2 0 0 1 5 6.5h2l1.2-2h7.6L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle ${P} cx="12" cy="12.8" r="3.4"/>`,
    gauge:    `<path ${P} d="M4.2 18a9 9 0 1 1 15.6 0"/><path ${P} d="m14.6 10.4-3 3"/><circle fill="currentColor" cx="12" cy="14.5" r="1.5"/>`,
    calendar: `<rect ${P} x="3" y="5" width="18" height="16" rx="2.5"/><line ${P} x1="3" y1="10" x2="21" y2="10"/><line ${P} x1="8" y1="3" x2="8" y2="6.5"/><line ${P} x1="16" y1="3" x2="16" y2="6.5"/>`,
    fuel:     `<path ${P} d="M4 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15"/><line ${P} x1="2.5" y1="20" x2="14.5" y2="20"/><path ${P} d="M13 9h3a2 2 0 0 1 2 2v5a1.8 1.8 0 0 0 3.5 0V9.5L18.5 6"/>`,
    gearbox:  `<circle ${P} cx="6.5" cy="6" r="2"/><circle ${P} cx="17.5" cy="6" r="2"/><circle ${P} cx="6.5" cy="18" r="2"/><path ${P} d="M6.5 8v8M6.5 12h11V8"/>`,
    door:     `<path ${P} d="M4 20V5.5a1.5 1.5 0 0 1 1.2-1.5l11-2A1.5 1.5 0 0 1 18 3.5V20"/><line ${P} x1="2.5" y1="20" x2="19.5" y2="20"/><circle fill="currentColor" cx="8" cy="13" r="1.2"/>`,
    engine:   `<path ${P} d="M5 9h2V7h5v2h2.5l2.5 2.5h2V9h2v8h-2v-2.5h-2L14.5 17H7v-2H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z"/>`,
    palette:  `<path ${P} d="M12 3a9 9 0 0 0 0 18c1 0 1.7-.8 1.7-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.1 0-1 .8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.3-9-7.3Z"/><circle fill="currentColor" cx="7.5" cy="11" r="1.2"/><circle fill="currentColor" cx="10.5" cy="7.5" r="1.2"/><circle fill="currentColor" cx="15" cy="8.5" r="1.2"/>`,
    shield:   `<path ${P} d="M12 22s8-3.6 8-9.6V5.4L12 2.4 4 5.4v7c0 6 8 9.6 8 9.6Z"/><polyline ${P} points="9 12 11.2 14.2 15.4 10"/>`,
    spanner:  `<path ${P} d="M14.5 6.5a4.5 4.5 0 0 0 5.9 5.9l-8 8a2.6 2.6 0 0 1-3.7-3.7l8-8a4.5 4.5 0 0 0-2.2-2.2Z"/><path ${P} d="M14.5 6.5 18 3l3 3-3.5 3.5"/>`,
    tag:      `<path ${P} d="M20.6 13.6 13.6 20.6a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4V4.5A1.5 1.5 0 0 1 4.7 3h7.7c.5 0 1 .2 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8Z"/><circle fill="currentColor" cx="7.6" cy="7.6" r="1.6"/>`,
    people:   `<circle ${P} cx="9" cy="8" r="3.4"/><path ${P} d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path ${P} d="M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 14.4A6.5 6.5 0 0 1 21.5 20"/>`,
    mapPin:   `<path ${P} d="M20 10.5c0 6-8 11.5-8 11.5s-8-5.5-8-11.5a8 8 0 0 1 16 0Z"/><circle ${P} cx="12" cy="10.3" r="2.8"/>`,
    clock:    `<circle ${P} cx="12" cy="12" r="9"/><polyline ${P} points="12 6.8 12 12 15.5 14"/>`,
    check:    `<polyline ${P} points="4 12.5 9.5 18 20 6.5"/>`,
    checkCirc:`<circle ${P} cx="12" cy="12" r="9"/><polyline ${P} points="8 12.2 11 15.2 16 9.5"/>`,
    search:   `<circle ${P} cx="11" cy="11" r="7"/><line ${P} x1="16.2" y1="16.2" x2="21" y2="21"/>`,
    sliders:  `<line ${P} x1="4" y1="8" x2="20" y2="8"/><line ${P} x1="4" y1="16" x2="20" y2="16"/><circle ${P} cx="9" cy="8" r="2.4"/><circle ${P} cx="15" cy="16" r="2.4"/>`,
    car:      `<path ${P} d="M3 17v-4.2a2 2 0 0 1 .2-.9l2-4A2 2 0 0 1 7 6.8h10a2 2 0 0 1 1.8 1.1l2 4a2 2 0 0 1 .2.9V17"/><line ${P} x1="3" y1="14" x2="21" y2="14"/><circle ${P} cx="7.5" cy="17" r="2"/><circle ${P} cx="16.5" cy="17" r="2"/>`,
    instagram:`<rect ${P} x="3" y="3" width="18" height="18" rx="5"/><circle ${P} cx="12" cy="12" r="4"/><circle fill="currentColor" cx="17.2" cy="6.8" r="1.2"/>`,
    facebook: `<path fill="currentColor" d="M14 9V7.2c0-.8.2-1.2 1.4-1.2H17V3h-2.6C11.3 3 10.3 4.4 10.3 7v2H8v3h2.3v9H14v-9h2.6l.4-3H14Z"/>`,
    star:     `<path ${P} d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>`,
    share:    `<circle ${P} cx="18" cy="5.5" r="2.5"/><circle ${P} cx="6" cy="12" r="2.5"/><circle ${P} cx="18" cy="18.5" r="2.5"/><line ${P} x1="8.2" y1="10.8" x2="15.8" y2="6.7"/><line ${P} x1="8.2" y1="13.2" x2="15.8" y2="17.3"/>`,
    inbox:    `<path ${P} d="M3 13h5l1.5 3h5L16 13h5"/><path ${P} d="M4.6 5.5 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-1.6-7.5A2 2 0 0 0 17.4 4H6.6a2 2 0 0 0-2 1.5Z"/>`,
    doc:      `<path ${P} d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><polyline ${P} points="14 3 14 8 19 8"/><line ${P} x1="9" y1="13" x2="15" y2="13"/><line ${P} x1="9" y1="17" x2="13" y2="17"/>`,
    plus:     `<line ${P} x1="12" y1="5" x2="12" y2="19"/><line ${P} x1="5" y1="12" x2="19" y2="12"/>`,
    filter:   `<path ${P} d="M3 5h18l-7 8v6l-4 2v-8Z"/>`,
    heart:    `<path ${P} d="M12 20.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.8c0 5.1-7.5 9.7-7.5 9.7Z"/>`
  };

  MBU.icon = function (name, cls) {
    const d = PATHS[name];
    if (!d) return '';
    return `<svg viewBox="0 0 24 24" ${cls ? `class="${cls}"` : ''} aria-hidden="true">${d}</svg>`;
  };

  /* ==========================================================================
     FORMATTING
     ========================================================================== */
  const fmt = MBU.fmt = {
    price(n) {
      if (n == null || n === '') return 'POA';
      return '£' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 });
    },
    miles(n) {
      if (n == null || n === '') return 'n/a';
      return Number(n).toLocaleString('en-GB') + ' miles';
    },
    milesShort(n) {
      if (n == null || n === '') return 'n/a';
      return Number(n).toLocaleString('en-GB');
    },
    engine(l) {
      if (!l) return null;
      return Number(l).toFixed(1) + 'L';
    },
    date(d) {
      if (!d) return 'n/a';
      return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    monthYear(d) {
      if (!d) return '';
      return new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    },
    /** "2018 Volkswagen Golf" */
    title(car) {
      return [car.year, car.make, car.model].filter(Boolean).join(' ');
    },
    /** "1.6 TDI SE Nav 5dr" */
    subtitle(car) {
      const bits = [];
      if (car.engine_size) bits.push(Number(car.engine_size).toFixed(1));
      if (car.variant) bits.push(car.variant);
      if (car.doors) bits.push(car.doors + 'dr');
      return bits.join(' ');
    },
    /** UK number plate spacing, best effort */
    reg(r) {
      if (!r) return '';
      const s = String(r).toUpperCase().replace(/\s+/g, '');
      if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(s)) return s.slice(0, 4) + ' ' + s.slice(4);
      return s;
    },
    titleCase(s) {
      if (!s) return '';
      return String(s).replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase());
    },
    /** "3 days ago", "2 weeks ago" */
    ago(d) {
      if (!d) return '';
      const days = Math.floor((Date.now() - new Date(d)) / 86400000);
      if (days <= 0)  return 'today';
      if (days === 1) return 'yesterday';
      if (days < 7)   return days + ' days ago';
      if (days < 14)  return 'last week';
      if (days < 60)  return Math.floor(days / 7) + ' weeks ago';
      return Math.floor(days / 30) + ' months ago';
    }
  };

  /* Human labels for stored values */
  MBU.labels = {
    fuel: {
      petrol: 'Petrol', diesel: 'Diesel', hybrid: 'Hybrid',
      phev: 'Plug-in hybrid', electric: 'Electric', lpg: 'LPG'
    },
    transmission: { manual: 'Manual', automatic: 'Automatic' },
    body: {
      hatchback: 'Hatchback', saloon: 'Saloon', estate: 'Estate', suv: 'SUV',
      coupe: 'Coupe', convertible: 'Convertible', mpv: 'MPV', van: 'Van', pickup: 'Pickup'
    },
    service: { full: 'Full service history', part: 'Part service history', none: 'No service history' },
    hpi: {
      clear: 'HPI Clear', cat_s: 'Category S (recorded, repaired)',
      cat_n: 'Category N (recorded, repaired)', cat_d: 'Category D (recorded, repaired)',
      cat_c: 'Category C (recorded, repaired)'
    },
    status: { available: 'Available', reserved: 'Reserved', sold: 'Sold', draft: 'Draft' }
  };
  MBU.label = (group, key) => (MBU.labels[group] && MBU.labels[group][key]) || fmt.titleCase(key || '');

  /* The fuels anyone can search for or ask us to find, whether or not one is
     on the forecourt today. Searching for an electric car when there isn't
     one should say so and offer the Car Finder, not hide the option. */
  MBU.fuelChoices = ['petrol', 'diesel', 'hybrid', 'electric'];
  /** "Hybrid" takes plug-in hybrids too: anyone asking for one would look at either. */
  MBU.fuelMatches = (carFuel, wanted) => carFuel === wanted || (wanted === 'hybrid' && carFuel === 'phev');
  /** A car's fuel as one of the search choices (a plug-in hybrid searches as hybrid). */
  MBU.fuelChoice = f => f === 'phev' ? 'hybrid' : f;

  /* ==========================================================================
     IMAGES  (Cloudinary with graceful fallback)
     ========================================================================== */
  const PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
       <rect width="800" height="600" fill="#EEF2F7"/>
       <g fill="none" stroke="#B6C1D0" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"
          transform="translate(400 300) scale(9) translate(-12 -12)">
         <path d="M3 17v-4.2a2 2 0 0 1 .2-.9l2-4A2 2 0 0 1 7 6.8h10a2 2 0 0 1 1.8 1.1l2 4a2 2 0 0 1 .2.9V17"/>
         <line x1="3" y1="14" x2="21" y2="14"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>
       </g>
     </svg>`);
  MBU.PLACEHOLDER = PLACEHOLDER;

  /**
   * Build an optimised image URL.
   * @param {object|string} image  image record {public_id,url} or a plain URL
   * @param {string} size  'thumb' | 'card' | 'full' | 'hero'
   */
  MBU.img = function (image, size) {
    if (!image) return PLACEHOLDER;
    const id = typeof image === 'string' ? image : (image.public_id || image.url || '');
    if (!id) return PLACEHOLDER;

    // Already a full URL that isn't Cloudinary, so use it as-is
    if (/^(https?:|data:)/.test(id) && !id.includes('res.cloudinary.com')) return id;

    const cloud = CFG.cloudinary && CFG.cloudinary.cloudName;
    if (!cloud) return /^https?:/.test(id) ? id : PLACEHOLDER;

    const T = {
      thumb: 'c_fill,g_auto,w_400,h_300,q_auto:good,f_auto,dpr_auto',
      card:  'c_fill,g_auto,w_720,h_540,q_auto:good,f_auto,dpr_auto',
      hero:  'c_fill,g_auto,w_1400,h_900,q_auto:good,f_auto,dpr_auto',
      full:  'c_limit,w_1800,q_auto:best,f_auto',
      blur:  'c_fill,w_40,h_30,e_blur:600,q_auto:low,f_auto'
    };
    const t = T[size] || T.card;

    // If a full Cloudinary URL was stored, splice the transform in
    if (id.includes('res.cloudinary.com')) {
      return id.replace(/\/upload\/(v\d+\/)?/, `/upload/${t}/$1`);
    }
    return `https://res.cloudinary.com/${cloud}/image/upload/${t}/${id}`;
  };

  MBU.mainImage = (car, size) => {
    const list = car.images || [];
    return MBU.img(list[0], size || 'card');
  };

  /**
   * Walkaround video URLs.
   * @param {object} video  {public_id}
   * @param {'play'|'poster'} what
   */
  MBU.video = function (video, what) {
    const cloud = CFG.cloudinary && CFG.cloudinary.cloudName;
    const id = video && video.public_id;
    if (!cloud || !id) return '';
    return what === 'poster'
      // A frame one second in. The very first frame is often a blur of tarmac
      ? `https://res.cloudinary.com/${cloud}/video/upload/so_1,w_1200,c_limit,q_auto,f_jpg/${id}.jpg`
      : `https://res.cloudinary.com/${cloud}/video/upload/q_auto,f_auto,w_1280,c_limit/${id}.mp4`;
  };
  MBU.hasVideo = car => !!(car && car.video && car.video.public_id && CFG.cloudinary.cloudName);

  /** Attach a fallback so a broken photo never leaves an empty box */
  MBU.imgTag = function (image, size, alt, cls) {
    const src = MBU.img(image, size);
    return `<img src="${src}" alt="${(alt || '').replace(/"/g, '&quot;')}" loading="lazy" decoding="async"
            ${cls ? `class="${cls}"` : ''} onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;
  };

  /* ==========================================================================
     DATA LAYER
     ========================================================================== */
  /**
   * The public API key.
   *
   * Supabase replaced the old `anon` JWT with a "publishable key"
   * (sb_publishable_...). Both work identically for our purposes, because the
   * gateway swaps an sb_ key for the right internal token, so accept
   * whichever is filled in, preferring the current one.
   */
  const SB_KEY = (CFG.supabase && (CFG.supabase.publishableKey || CFG.supabase.anonKey)) || '';

  const hasBackend = !!(CFG.supabase && CFG.supabase.url && SB_KEY);
  MBU.hasBackend = hasBackend;
  MBU.sbKey = SB_KEY;

  const restUrl = p => `${CFG.supabase.url.replace(/\/$/, '')}/rest/v1/${p}`;
  const restHeaders = () => ({
    apikey: SB_KEY,
    Authorization: 'Bearer ' + SB_KEY,
    'Content-Type': 'application/json'
  });

  let cache = null;
  let cachePromise = null;

  /** Normalise a record so the rest of the site can rely on its shape */
  function normalise(c) {
    let images = c.images;
    if (typeof images === 'string') { try { images = JSON.parse(images); } catch { images = []; } }
    if (!Array.isArray(images)) images = [];

    let features = c.features;
    if (typeof features === 'string') {
      try { features = JSON.parse(features); }
      catch { features = features.split(',').map(s => s.trim()).filter(Boolean); }
    }
    if (!Array.isArray(features)) features = [];

    return Object.assign({}, c, {
      images,
      features,
      price: c.price == null ? null : Number(c.price),
      mileage: c.mileage == null ? null : Number(c.mileage),
      year: c.year == null ? null : Number(c.year),
      doors: c.doors == null ? null : Number(c.doors),
      engine_size: c.engine_size == null ? null : Number(c.engine_size),
      status: c.status || 'available'
    });
  }

  /** True if we tried to reach the database and could not. */
  MBU.loadFailed = false;

  /**
   * Fetch every publicly visible car once, then serve from memory.
   *
   * Reads from the `cars_public` VIEW, never the `cars` table. The view
   * strips the price off sold cars server-side, so a sold price can't be
   * dug out of the network tab, and it drops sold cars older than 6 months.
   */
  MBU.getCars = function () {
    if (cache) return Promise.resolve(cache);
    if (cachePromise) return cachePromise;

    cachePromise = (async () => {
      // No backend configured yet, so show the demo cars to keep the site viewable.
      if (!hasBackend) {
        cache = (window.MBU_DEMO_CARS || []).map(normalise);
        return cache;
      }

      try {
        const q = 'cars_public?select=*&order=sort_index.asc,created_at.desc';
        const res = await fetch(restUrl(q), { headers: restHeaders() });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
        cache = (await res.json()).map(normalise);
        return cache;
      } catch (err) {
        // IMPORTANT: never fall back to demo cars once we are live. Showing
        // customers vehicles that don't exist is far worse than showing none.
        console.error('[MBU] Could not load stock from the database.', err);
        MBU.loadFailed = true;
        cache = [];
        return cache;
      }
    })();
    return cachePromise;
  };

  MBU.getAvailable = async () => {
    const all = await MBU.getCars();
    const showReserved = !CFG.options || CFG.options.showReserved !== false;
    return all.filter(c =>
      c.status === 'available' || (showReserved && c.status === 'reserved'));
  };

  MBU.getSold = async () => {
    const all = await MBU.getCars();
    const days = (CFG.options && CFG.options.soldVisibleDays) || 45;
    const cutoff = Date.now() - days * 86400000;
    return all
      .filter(c => c.status === 'sold' && c.sold_at && new Date(c.sold_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at));
  };

  /**
   * Everything shown on the stock page: available, reserved and recently sold,
   * mixed together in one list. Sold cars are still clearly marked as sold,
   * they're here for social proof and to capture "have you got another one?",
   * not to pad the stock count.
   */
  MBU.getStock = async () => {
    const [live, sold] = await Promise.all([MBU.getAvailable(), MBU.getSold()]);
    return live.concat(sold);
  };

  /**
   * Cars for the homepage rail.
   *
   * Anything ticked as Featured in the admin app comes first and they all
   * show, up to the cap. If fewer than `featuredMin` are ticked the rest of
   * the row is topped up with the newest stock, so the homepage never looks
   * broken just because nobody has ticked anything yet.
   *
   * The row is then ordered dearest first. Which cars appear is still decided
   * by the Featured tickbox exactly as before; this only changes the order
   * they sit in, so the best of the stock leads the homepage. A car with no
   * price goes last rather than reading as free.
   */
  MBU.getFeatured = async () => {
    const opt = CFG.options || {};
    const cap = opt.featuredCount || 9;
    const min = opt.featuredMin || 4;
    const avail = await MBU.getAvailable();
    const starred = avail.filter(c => c.featured);
    // Every branch below builds a NEW array (filter/slice/concat), so sorting
    // it never reorders the shared car cache.
    const picked = starred.length >= min
      ? starred.slice(0, cap)
      : starred.concat(avail.filter(c => !c.featured))
               .slice(0, Math.max(min, starred.length));
    return picked.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  };

  MBU.getCar = async (id) => {
    const all = await MBU.getCars();
    return all.find(c => String(c.id) === String(id) || c.slug === id) || null;
  };

  /* ==========================================================================
     ENQUIRIES
     ========================================================================== */
  MBU.submitEnquiry = async function (payload) {
    const record = Object.assign({ created_at: new Date().toISOString() }, payload);
    let savedToDb = false;

    if (hasBackend) {
      const post = body => fetch(restUrl('enquiries'), {
        method: 'POST',
        headers: Object.assign(restHeaders(), { Prefer: 'return=minimal' }),
        body: JSON.stringify(body)
      });

      try {
        let res = await post(record);

        // Newer fields (part exchange, finance interest) only exist once the
        // v4 migration has been run. Rather than lose a real enquiry over a
        // missing column, strip the optional fields and try once more.
        if (!res.ok && res.status === 400) {
          const detail = await res.text();
          if (/column|schema cache/i.test(detail)) {
            console.warn('[MBU] Retrying enquiry without optional fields:', detail);
            const core = Object.assign({}, record);
            ['part_ex', 'part_ex_details', 'finance_interest'].forEach(k => delete core[k]);
            res = await post(core);
          } else {
            console.warn('[MBU] Enquiry save failed:', res.status, detail);
          }
        }

        savedToDb = res.ok;
        if (!res.ok) console.warn('[MBU] Enquiry save failed:', res.status);
      } catch (e) { console.warn('[MBU] Enquiry save error', e); }
    }

    let emailed = false;
    if (CFG.web3formsKey) {
      try {
        const flat = {
          access_key: CFG.web3formsKey,
          subject: `${payload.kind === 'sell' ? 'Sell your car' : payload.kind === 'car' ? 'Car enquiry' : 'Website enquiry'}: ${payload.name || 'No name'}`,
          from_name: 'MBU Car Sales website',
          name: payload.name, email: payload.email, phone: payload.phone,
          message: payload.message || '',
          vehicle: payload.car_title || '',
          registration: (payload.details && payload.details.registration) || ''
        };
        if (payload.details) {
          Object.entries(payload.details).forEach(([k, v]) => {
            if (v !== '' && v != null) flat['detail_' + k] = String(v);
          });
        }
        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(flat)
        });
        emailed = r.ok;
      } catch (e) { console.warn('[MBU] Email notify error', e); }
    }

    if (!savedToDb && !emailed) throw new Error('No delivery method succeeded');
    return { savedToDb, emailed };
  };

  /* ==========================================================================
     CAR REQUESTS. "Register interest" and the Car Finder page
     ========================================================================== */
  MBU.submitWanted = async function (payload) {
    let savedToDb = false;

    if (hasBackend) {
      try {
        const res = await fetch(restUrl('wanted_requests'), {
          method: 'POST',
          headers: Object.assign(restHeaders(), { Prefer: 'return=minimal' }),
          body: JSON.stringify(payload)
        });
        savedToDb = res.ok;
        if (!res.ok) console.warn('[MBU] Request save failed:', res.status, await res.text());
      } catch (e) { console.warn('[MBU] Request save error', e); }
    }

    let emailed = false;
    if (CFG.web3formsKey) {
      try {
        const wants = [
          payload.make, payload.model,
          payload.budget_max ? 'up to £' + Number(payload.budget_max).toLocaleString('en-GB') : '',
          payload.max_mileage ? 'under ' + Number(payload.max_mileage).toLocaleString('en-GB') + ' miles' : '',
          payload.fuel, payload.transmission, payload.body_type
        ].filter(Boolean).join(', ');

        const r = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: CFG.web3formsKey,
            subject: payload.kind === 'sold_interest'
              ? `Interest in a sold car: ${payload.name || 'No name'}`
              : `Car wanted: ${payload.name || 'No name'}`,
            from_name: 'MBU Car Sales website',
            name: payload.name, email: payload.email, phone: payload.phone,
            looking_for: wants,
            about_car: payload.car_title || '',
            timescale: payload.timescale || '',
            part_exchange: payload.part_ex ? (payload.part_ex_details || 'Yes') : 'No',
            preferred_contact: payload.contact_pref || '',
            message: payload.notes || ''
          })
        });
        emailed = r.ok;
      } catch (e) { console.warn('[MBU] Request email error', e); }
    }

    if (!savedToDb && !emailed) throw new Error('No delivery method succeeded');
    return { savedToDb, emailed };
  };

  /* ==========================================================================
     INTEREST TRACKING. Anonymous, cookieless, no consent banner needed
     --------------------------------------------------------------------------
     What this does NOT do, deliberately:
       · no cookies
       · no localStorage or sessionStorage
       · no device fingerprint
       · nothing stored on the visitor's device at all

     TWO WAYS IN, chosen by `tracking.via` in config.js:

       'function'  Events go to the `track` Edge Function. It works out a
                   daily-changing visitor code from IP + browser + a secret,
                   keeps only that code (never the IP), flags bots, and writes
                   the event. This is what lets Insights count PEOPLE rather
                   than page loads. See supabase/functions/track/index.ts.

       'rest'      The original route, straight into the table. Every page
                   load looks like a new person. Kept so the website carries on
                   counting until the function is deployed.

     `pageId` is a random string for this page load only. It lets the running
     totals for time-on-page be matched up with each other. It dies with the
     page and identifies nobody.
     ========================================================================== */
  const TRACK = Object.assign({ via: 'rest' }, CFG.tracking || {});

  const pageId = (() => {
    try {
      const a = new Uint8Array(8);
      crypto.getRandomValues(a);
      return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return Math.random().toString(36).slice(2, 18);
    }
  })();

  const sent = new Set();   // don't fire the same view twice from one page load

  /* Opening the site from your own machine (or Claude testing it) must not
     book fake views against real cars. On localhost events are logged to the
     console and kept in MBU.trackLog instead of being sent. */
  const trackingOff = location.protocol === 'file:' ||
    /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|)$/.test(location.hostname);
  MBU.trackLog = [];

  const trackEndpoint = () => `${CFG.supabase.url.replace(/\/$/, '')}/functions/v1/track`;

  function sendEvent(event, beacon) {
    if (trackingOff) {
      MBU.trackLog.push(event);
      console.debug('[MBU track, not sent from localhost]', event.event_type, event);
      return;
    }

    if (TRACK.via === 'function') {
      // text/plain with no custom headers is a "simple" request: no CORS
      // preflight, so it survives the page closing and works with sendBeacon.
      const body = JSON.stringify({ events: [event], wd: navigator.webdriver === true });
      if (beacon && navigator.sendBeacon) {
        try {
          if (navigator.sendBeacon(trackEndpoint(), new Blob([body], { type: 'text/plain' }))) return;
        } catch { /* fall through to fetch */ }
      }
      try {
        fetch(trackEndpoint(), {
          method: 'POST', body, keepalive: true,
          headers: { 'Content-Type': 'text/plain' }
        }).catch(() => {});
      } catch { /* tracking must never break the page */ }
      return;
    }

    // 'rest': the original shape only, because new columns would be refused
    // by a database that hasn't had schema-v6 yet. Time-on-page is skipped:
    // without a visitor code it can't be counted per person, so it would only
    // be rows nobody can use.
    if (event.event_type === 'engagement') return;
    const meta = event.meta;
    try {
      fetch(restUrl('car_events'), {
        method: 'POST',
        headers: Object.assign(restHeaders(), { Prefer: 'return=minimal' }),
        body: JSON.stringify({
          car_id: event.car_id,
          event_type: event.event_type,
          session_key: pageId,
          source: event.source,
          meta: meta || null
        }),
        keepalive: true
      }).catch(() => {});
    } catch { /* tracking must never break the page */ }
  }

  /**
   * Record an anonymous interest event.
   * @param {string} eventType  view | card_click | gallery_open |
   *                            whatsapp_click | phone_click | email_click |
   *                            enquire_click | enquiry_start | enquiry_sent |
   *                            interest_sent | share | video_play | engagement
   * @param {string} carId
   * @param {object} [meta]     small, non-personal extras only
   * @param {object} [extra]    { duration_ms, photos_seen, photo_count, beacon }
   */
  MBU.track = function (eventType, carId, meta, extra) {
    if (!hasBackend || !carId) return;                 // demo mode: nothing to record
    if (!/^[0-9a-f-]{36}$/i.test(String(carId))) return; // ignore demo ids

    // One of these per car per page load. Everything else is a genuine repeat
    // action, and the database counts each person once however many times
    // they tap.
    const once = ['view', 'card_click', 'gallery_open', 'enquiry_start', 'video_play'];
    const key = eventType + ':' + carId;
    if (once.includes(eventType)) {
      if (sent.has(key)) return;
      sent.add(key);
    }

    const x = extra || {};
    sendEvent({
      car_id: String(carId),
      event_type: eventType,
      page_id: pageId,
      source: MBU.trackSource || 'direct',
      duration_ms: x.duration_ms,
      photos_seen: x.photos_seen,
      photo_count: x.photo_count,
      meta: meta || null
    }, !!x.beacon);
  };

  /**
   * How long someone actually spent on a car, and how many of its photos they
   * saw. A 90-second read through twelve photos and a three-second bounce are
   * completely different signals, and the old tracking recorded them the same.
   *
   * Time only counts while the page is on screen: switching to WhatsApp and
   * coming back doesn't rack up minutes. Running totals are sent each time the
   * page is hidden (the last moment a phone reliably lets a page say anything),
   * and the database keeps the biggest figure for each page load.
   *
   * @returns {{ photo(index: number): void }}  call photo(i) whenever photo i is shown
   */
  MBU.watchEngagement = function (carId, photoCount) {
    const seen = new Set();
    if (photoCount > 0) seen.add(0);          // the first photo is on screen at load

    let onScreen = 0;
    let since = document.visibilityState === 'visible' ? performance.now() : null;
    let scrollPct = 0;
    let lastSent = -1;
    const CAP = 30 * 60 * 1000;

    const total = () => onScreen + (since != null ? performance.now() - since : 0);

    function flush() {
      const ms = Math.min(CAP, Math.round(total()));
      if (ms - lastSent < 1000 && lastSent >= 0) return;   // nothing new worth sending
      lastSent = ms;
      MBU.track('engagement', carId, { scroll_pct: scrollPct }, {
        duration_ms: ms, photos_seen: seen.size, photo_count: photoCount || 0, beacon: true
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (since != null) { onScreen += performance.now() - since; since = null; }
        flush();
      } else {
        since = performance.now();
      }
    });
    window.addEventListener('pagehide', flush);

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const doc = document.documentElement;
        const pct = Math.round(100 * (window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight));
        scrollPct = Math.max(scrollPct, Math.min(100, pct));
        ticking = false;
      });
    }, { passive: true });

    return { photo: i => { if (i >= 0 && i < photoCount) seen.add(i); } };
  };

  /** Where the visitor came from, for the source column. */
  MBU.trackSource = (() => {
    const p = new URLSearchParams(location.search).get('from');
    if (p) return p.slice(0, 40);
    const ref = document.referrer || '';
    if (!ref) return 'direct';
    try {
      const host = new URL(ref).hostname;
      if (host === location.hostname) {
        if (/stock/.test(ref)) return 'stock';
        if (/index|\/$/.test(ref)) return 'home';
        return 'internal';
      }
      if (/google|bing|duckduck/.test(host)) return 'search';
      if (/facebook|instagram|t\.co|twitter/.test(host)) return 'social';
      if (/autotrader/.test(host)) return 'autotrader';
      return 'referral';
    } catch { return 'direct'; }
  })();

  /**
   * Wire up WhatsApp, phone and email links so taps are counted automatically.
   * @param {string} carId
   * @param {Element} [root]
   * @param {object} [meta]  e.g. { from: 'contact' } to say which page it was
   */
  MBU.autoTrackLinks = function (carId, root, meta) {
    (root || document).addEventListener('click', e => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('https://wa.me/'))  MBU.track('whatsapp_click', carId, meta);
      else if (href.startsWith('tel:'))       MBU.track('phone_click', carId, meta);
      else if (href.startsWith('mailto:'))    MBU.track('email_click', carId, meta);
    }, { capture: true });
  };

  /* ==========================================================================
     WHATSAPP / CONTACT LINKS
     ========================================================================== */
  MBU.waLink = function (text) {
    const num = CFG.business.whatsapp;
    return `https://wa.me/${num}${text ? '?text=' + encodeURIComponent(text) : ''}`;
  };
  /**
   * The link to share for a car.
   *
   * Prefers /c/<id>/, because those pages are pre-rendered with the car's photo and
   * price baked into the preview tags, so forwarding one on WhatsApp shows the
   * actual car instead of our logo. Falls back to the query-string URL if the
   * share pages haven't been generated yet.
   */
  MBU.carUrl = function (car) {
    const base = (CFG.options.siteUrl || '').replace(/\/$/, '');
    return CFG.options.sharePages === false
      ? `${base}/car?id=${encodeURIComponent(car.id)}`
      : `${base}/c/${encodeURIComponent(car.id)}/`;
  };

  MBU.waCarLink = function (car) {
    const url = MBU.carUrl(car);
    return MBU.waLink(
      `Hi MBU Car Sales, I'm interested in the ${fmt.title(car)}` +
      (car.registration ? ` (${fmt.reg(car.registration)})` : '') +
      ` listed at ${fmt.price(car.price)}.\n${url}\n\nIs it still available?`
    );
  };
  MBU.telLink = () => 'tel:' + CFG.business.phoneDial;
  MBU.mailLink = (subject) =>
    'mailto:' + CFG.business.email + (subject ? '?subject=' + encodeURIComponent(subject) : '');

  /* ==========================================================================
     SMALL HELPERS
     ========================================================================== */
  /**
   * Internal link builder.
   *
   * Normally returns the path unchanged, so relative links keep working when
   * you open the site straight off disk. The pre-rendered share pages live at
   * /c/<id>/ and set MBU_LINK_PREFIX to '/', so their links point at the site
   * root instead of at that subfolder.
   */
  MBU.link = p => (window.MBU_LINK_PREFIX || '') + p;

  MBU.qs  = (s, r) => (r || document).querySelector(s);
  MBU.qsa = (s, r) => Array.from((r || document).querySelectorAll(s));
  MBU.param = (k) => new URLSearchParams(location.search).get(k);
  MBU.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  MBU.debounce = (fn, ms = 220) => {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
})();
