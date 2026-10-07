/* ============================================================================
   MBU ADMIN: application logic
   Auth, stock management, photo upload, DVLA lookup, enquiries.
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.MBU_CONFIG;
  const $  = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  /* ======================================================= SETUP CHECK */
  // Supabase replaced the old `anon` JWT with a publishable key
  // (sb_publishable_...). Accept whichever is filled in.
  const SB_KEY = CFG.supabase.publishableKey || CFG.supabase.anonKey || '';

  if (!CFG.supabase.url || !SB_KEY) {
    document.body.innerHTML = `
      <div class="login">
        <div class="login-mark">MBU</div>
        <h1>Almost there</h1>
        <p>The admin app isn’t connected to your database yet.<br><br>
           Open <strong>assets/js/config.js</strong> and paste in your Supabase
           <strong>url</strong> and <strong>publishableKey</strong>.
           Full instructions are in <strong>SETUP.md</strong>, Part 1.4.</p>
      </div>`;
    return;
  }

  const sb = window.supabase.createClient(CFG.supabase.url, SB_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // Auto Trader calls go out with the signed-in admin's own token, never a key
  const AT = window.MBU_AUTOTRADER || null;
  if (AT) AT.init({ getToken: async () => {
    const { data: { session } } = await sb.auth.getSession();
    return session ? session.access_token : null;
  } });

  /* ============================================================ ICONS */
  const P = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const ICONS = {
    check:    `<polyline ${P} points="4 12.5 9.5 18 20 6.5"/>`,
    close:    `<line ${P} x1="6" y1="6" x2="18" y2="18"/><line ${P} x1="18" y1="6" x2="6" y2="18"/>`,
    star:     `<path ${P} d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>`,
    left:     `<polyline ${P} points="15 18 9 12 15 6"/>`,
    right:    `<polyline ${P} points="9 18 15 12 9 6"/>`,
    down:     `<polyline ${P} points="6 9 12 15 18 9"/>`,
    camera:   `<path ${P} d="M3 8.5A2 2 0 0 1 5 6.5h2l1.2-2h7.6L17 6.5h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle ${P} cx="12" cy="12.8" r="3.4"/>`,
    trash:    `<polyline ${P} points="3 6 21 6"/><path ${P} d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path ${P} d="M6 6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6"/>`,
    edit:     `<path ${P} d="M12 20h9"/><path ${P} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
    sold:     `<circle ${P} cx="12" cy="12" r="9"/><polyline ${P} points="8 12.2 11 15.2 16 9.5"/>`,
    pause:    `<circle ${P} cx="12" cy="12" r="9"/><line ${P} x1="10" y1="9" x2="10" y2="15"/><line ${P} x1="14" y1="9" x2="14" y2="15"/>`,
    back:     `<line ${P} x1="19" y1="12" x2="5" y2="12"/><polyline ${P} points="11 18 5 12 11 6"/>`,
    phone:    `<path ${P} d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>`,
    whatsapp: `<path fill="currentColor" d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.3 5.3 4.6 2 .8 2.7.9 3.7.8.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z"/><path ${P} d="M12 21.5a9.4 9.4 0 0 1-4.8-1.3L2.5 21.5l1.4-4.5A9.5 9.5 0 1 1 12 21.5Z"/>`,
    mail:     `<rect ${P} x="2" y="4" width="20" height="16" rx="2.5"/><path ${P} d="m2.6 6.6 8.3 5.5c.7.4 1.5.4 2.2 0l8.3-5.5"/>`,
    car:      `<path ${P} d="M3 17v-4.2a2 2 0 0 1 .2-.9l2-4A2 2 0 0 1 7 6.8h10a2 2 0 0 1 1.8 1.1l2 4a2 2 0 0 1 .2.9V17"/><line ${P} x1="3" y1="14" x2="21" y2="14"/><circle ${P} cx="7.5" cy="17" r="2"/><circle ${P} cx="16.5" cy="17" r="2"/>`,
    eye:      `<path ${P} d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle ${P} cx="12" cy="12" r="3"/>`,
    copy:     `<rect ${P} x="9" y="9" width="12" height="12" rx="2"/><path ${P} d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    inbox:    `<path ${P} d="M3 13h5l1.5 3h5L16 13h5"/><path ${P} d="M4.6 5.5 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-1.6-7.5A2 2 0 0 0 17.4 4H6.6a2 2 0 0 0-2 1.5Z"/>`,
    search:   `<circle ${P} cx="11" cy="11" r="7"/><line ${P} x1="20.5" y1="20.5" x2="16" y2="16"/>`,
    checkCirc:`<circle ${P} cx="12" cy="12" r="9"/><polyline ${P} points="8 12.2 11 15.2 16 9.5"/>`,
    calendar: `<rect ${P} x="3.5" y="5" width="17" height="15.5" rx="2.5"/><line ${P} x1="3.5" y1="10" x2="20.5" y2="10"/><line ${P} x1="8" y1="3" x2="8" y2="7"/><line ${P} x1="16" y1="3" x2="16" y2="7"/>`,
    alert:    `<path ${P} d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-2.9L13.7 4.2a2 2 0 0 0-3.4 0Z"/><line ${P} x1="12" y1="9.5" x2="12" y2="13.5"/><line ${P} x1="12" y1="17" x2="12.01" y2="17"/>`,
    pound:    `<path ${P} d="M17 19.5H7c1.4-1 2.2-2.6 2.2-4.5V8.8A3.8 3.8 0 0 1 13 5a3.9 3.9 0 0 1 3.6 2.4"/><line ${P} x1="6.5" y1="12.5" x2="14" y2="12.5"/>`,
    gauge:    `<path ${P} d="M3.5 16a8.5 8.5 0 1 1 17 0"/><line ${P} x1="12" y1="16" x2="15.5" y2="10.5"/>`,
    note:     `<path ${P} d="M14 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5Z"/><polyline ${P} points="14 3.5 14 8.5 19 8.5"/><line ${P} x1="8.5" y1="13" x2="15.5" y2="13"/><line ${P} x1="8.5" y1="16.5" x2="13" y2="16.5"/>`,
    tag:      `<path ${P} d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3.5 13.5V3.5h10l7.1 7.1a2 2 0 0 1 0 2.8Z"/><circle ${P} cx="8.2" cy="8.2" r="1.3"/>`,
    receipt:  `<path ${P} d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-1.2-.8-1.2.8-2.4-1.6L6 20.5Z"/><line ${P} x1="9" y1="8.5" x2="15" y2="8.5"/><line ${P} x1="9" y1="12" x2="15" y2="12"/><line ${P} x1="9" y1="15.5" x2="12.5" y2="15.5"/>`,
    book:     `<path ${P} d="M4 5.5A2 2 0 0 1 6 3.5h13.5v14H6a2 2 0 0 0-2 2Z"/><path ${P} d="M4 19.5a2 2 0 0 0 2 2h13.5v-4"/><line ${P} x1="8.5" y1="8" x2="15" y2="8"/>`,
    wrench:   `<path ${P} d="M14.7 6.3a4 4 0 0 0 5 5L21 10a5.5 5.5 0 0 1-7.4 6.2L7 22.8a2.1 2.1 0 0 1-3-3l6.6-6.6A5.5 5.5 0 0 1 16.8 6Z"/>`,
    sign:     `<path ${P} d="M3 17.5c2.5 0 3.5-6 6-6s1 6 3.5 6 2.5-3 4-3 1.5 3 4.5 3"/><line ${P} x1="3" y1="21" x2="21" y2="21"/>`,
    print:    `<path ${P} d="M6 9V3.5h12V9"/><rect ${P} x="3" y="9" width="18" height="8" rx="2"/><path ${P} d="M6 14h12v6.5H6Z"/>`,
    share:    `<path ${P} d="M12 15V3.5"/><polyline ${P} points="7.5 8 12 3.5 16.5 8"/><path ${P} d="M5 12v7.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V12"/>`,
    plus:     `<line ${P} x1="12" y1="5" x2="12" y2="19"/><line ${P} x1="5" y1="12" x2="19" y2="12"/>`,
    clock:    `<circle ${P} cx="12" cy="12" r="9"/><polyline ${P} points="12 7 12 12 15.5 14"/>`,
    open:     `<path ${P} d="M14 4h6v6"/><line ${P} x1="20" y1="4" x2="11" y2="13"/><path ${P} d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>`
  };
  const icon = n => ICONS[n] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>` : '';

  /* ======================================================== CONSTANTS */
  const FUELS = [['petrol','Petrol'],['diesel','Diesel'],['hybrid','Hybrid'],
                 ['phev','Plug-in hybrid'],['electric','Electric']];
  const TRANS = [['manual','Manual'],['automatic','Automatic']];
  const BODIES = [['hatchback','Hatchback'],['saloon','Saloon'],['estate','Estate'],['suv','SUV'],
                  ['coupe','Coupe'],['convertible','Convertible'],['mpv','MPV'],['van','Van'],['pickup','Pickup']];
  /* --------------------------------------------------------------------------
     MAKES AND MODELS live in assets/js/makes.js, shared with the website, so
     both spell a make the same way. Anything you type yourself, and anything
     the plate lookup returns, gets added to the drop-downs automatically, and
     every make and model already in your own stock is merged in on top.
     -------------------------------------------------------------------------- */
  const MK = window.MBU_MAKES;
  const MODELS = MK.MODELS;

  /* Plate lookups return capitals ("BMW", "MAZDA CX-3") and title-casing them
     blindly gave "Bmw" and "Cx-3", which then sat in the dropdowns next to the
     proper spelling and stopped your own history and the price book matching.
     Anything we recognise gets its proper spelling; anything we don't is
     title-cased but keeps short and digit-bearing parts in capitals. Matching
     ignores spelling altogether (keyOf / modelKeyOf). */
  const keyOf = MK.makeKey;
  const modelKeyOf = MK.modelKey;
  const canonicalMake = MK.canonicalMake;
  const canonicalModel = MK.canonicalModel;

  const COLOURS = ['Black','White','Silver','Grey','Blue','Red','Green','Blue (metallic)',
                   'Grey (metallic)','Bronze','Beige','Brown','Gold','Orange','Purple','Yellow'];

  const COMMON_FEATURES = [
    'Air conditioning','Climate control','Sat nav','Apple CarPlay','Android Auto','Bluetooth',
    'DAB radio','Cruise control','Adaptive cruise control','Parking sensors','Reversing camera',
    '360° camera','Heated seats','Heated windscreen','Leather seats','Half leather','Panoramic roof',
    'Sunroof','Alloy wheels','LED headlights','Electric windows','Electric mirrors','Isofix',
    'Keyless entry','Start/stop','Tow bar','Spare wheel','Full service history'
  ];
  const LABEL = {
    fuel: Object.fromEntries(FUELS), transmission: Object.fromEntries(TRANS),
    body: Object.fromEntries(BODIES),
    service: { full:'Full history', part:'Part history', none:'No history' },
    hpi: { clear:'HPI Clear', cat_s:'Cat S', cat_n:'Cat N', cat_d:'Cat D', cat_c:'Cat C' }
  };

  /* ============================================================ STATE */
  const state = {
    user: null,
    cars: [],
    enquiries: [],
    requests: [],
    tab: 'available',
    stockSort: remembered('mbu_stock_sort', 'newest'),
    stockQuery: '',
    carSort: remembered('mbu_car_sort', 'views'),       // Insights → Cars
    carPeriod: remembered('mbu_car_period', '30'),
    webScale: remembered('mbu_web_scale', 'week'),      // Insights → Website
    webPick: null,                                      // the bar tapped on the Website chart
    carFig: null,                                       // the car whose figures are open
    compare: [],                                        // cars being compared
    motTab: 'cal', motMonth: null, motDay: null,        // the MOTs screen
    stockMot: false,                                    // Stock: only cars with an MOT to see to
    enqTab: 'new',
    dataTab: 'summary',
    soldMonth: 'all',        // 'all' or 'YYYY-MM', for the Sold tab
    marginOpen: false,       // per-car breakdown under the margin figure
    schema: { v6: null, v7: null, v8: null, v10: null, v14: null },   // optional upgrades: true, false, or null = not checked yet

    view: 'home',
    trail: [],           // the screens Back steps through, newest last (see NAV)
    message: null,       // { kind: 'e' | 'r', id } open in the message view
    homeOpen: new Set(), // Home "Needs you" sections dropped down, by key
    editing: null,       // car being edited (null = new)
    pxFrom: null,        // Quick add is for the car taken in on this part-exchange sale
    photos: [],          // [{public_id,url,width,height,uploading,progress,localUrl}]
    video: null,         // {public_id,duration,width,height} or null
    features: new Set(),
    dirty: false
  };

  /* =========================================================== HELPERS */
  const money = n => n == null || n === '' ? 'No price' : '£' + Number(n).toLocaleString('en-GB');
  const num = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };
  const int = v => { const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };
  const DAY = 86400000;
  const carTitle = c => [c.year, c.make, c.model].filter(Boolean).join(' ')
    || (c.registration ? fmtReg(c.registration) : 'Untitled car');
  const inStock = c => c.status === 'available' || c.status === 'reserved';

  /* How you like a list sorted, kept on this phone only. Private browsing or
     blocked storage just means it starts from the default each time. */
  function remembered(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }
  function remember(key, value) {
    try { localStorage.setItem(key, value); } catch { /* not kept, no harm */ }
  }

  function toast(text, kind) {
    const t = $('#toast');
    t.innerHTML = (kind === 'ok' ? icon('check') : '') + `<span>${esc(text)}</span>`;
    t.classList.add('is-shown');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('is-shown'), 2800);
  }

  function msg(el, text, kind) {
    const e = $(el);
    if (!text) { e.className = 'msg'; e.textContent = ''; return; }
    e.className = 'msg msg--' + (kind || 'info') + ' is-shown';
    e.innerHTML = text;
  }

  function fmtReg(r) {
    const s = String(r || '').toUpperCase().replace(/\s+/g, '');
    return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(s) ? s.slice(0,4) + ' ' + s.slice(4) : s;
  }

  function imgUrl(p, w) {
    if (!p) return '';
    if (p.localUrl) return p.localUrl;
    const id = p.public_id || p.url || p;
    if (typeof id === 'string' && /^(https?:|blob:|data:)/.test(id) && !id.includes('res.cloudinary.com')) return id;
    const cloud = CFG.cloudinary.cloudName;
    if (!cloud) return id;
    const t = `c_fill,g_auto,w_${w || 400},q_auto:good,f_auto`;
    if (String(id).includes('res.cloudinary.com')) return String(id).replace(/\/upload\/(v\d+\/)?/, `/upload/${t}/$1`);
    return `https://res.cloudinary.com/${cloud}/image/upload/${t}/${id}`;
  }

  /* ====================================================== ACTION SHEET */
  function sheet(title, sub, actions) {
    $('#sheetTitle').textContent = title;
    const s = $('#sheetSub');
    s.textContent = sub || ''; s.style.display = sub ? '' : 'none';
    $('#sheetActions').innerHTML = actions.map((a, i) =>
      `<button class="sheet-action ${a.danger ? 'danger' : ''}" data-i="${i}">
         ${a.icon ? icon(a.icon) : ''}
         <div><span>${esc(a.label)}</span>${a.sub ? `<small>${esc(a.sub)}</small>` : ''}</div>
       </button>`).join('');
    $$('#sheetActions .sheet-action').forEach(btn => {
      btn.onclick = () => { closeSheet(); setTimeout(() => actions[+btn.dataset.i].run(), 180); };
    });
    $('#sheet').classList.add('is-open');
    $('#sheetBack').classList.add('is-open');
  }
  function closeSheet() {
    $('#sheet').classList.remove('is-open');
    $('#sheetBack').classList.remove('is-open');
  }
  $('#sheetBack').onclick = closeSheet;
  $('#sheetCancel').onclick = closeSheet;

  function confirmSheet(title, sub, label, run, danger) {
    sheet(title, sub, [{ label, icon: danger ? 'trash' : 'check', danger, run }]);
  }

  /* A sheet with its own markup instead of a list of actions: the car
     picker, the signature pad, the invoice settings. Returns the box to wire
     up. The Cancel button underneath still closes it. */
  function sheetHtml(title, sub, html) {
    $('#sheetTitle').textContent = title;
    const s = $('#sheetSub');
    s.textContent = sub || ''; s.style.display = sub ? '' : 'none';
    const box = $('#sheetActions');
    box.innerHTML = html;
    $('#sheet').classList.add('is-open');
    $('#sheetBack').classList.add('is-open');
    return box;
  }

  /**
   * Pick one of your cars. Search by anything on it; in-stock cars first,
   * then the most recent sales. `filter` narrows the list (in stock only for
   * a price check, say), `extra` adds rows above the cars ("A car that isn't
   * in your stock").
   */
  function pickCar({ title, sub, filter, extra, run }) {
    const order = c => c.status === 'available' || c.status === 'reserved' ? 0 : c.status === 'draft' ? 1 : 2;
    const cars = state.cars.filter(filter || (() => true)).slice()
      .sort((a, b) => order(a) - order(b) || new Date(b.sold_at || b.created_at) - new Date(a.sold_at || a.created_at));
    const row = c => `
      <button class="pick-car" type="button" data-id="${esc(c.id)}">
        ${c.images && c.images[0] ? `<img src="${esc(imgUrl(c.images[0], 160))}" alt="" loading="lazy">`
                                  : `<span class="pick-car-none">${icon('car')}</span>`}
        <span class="pick-car-txt"><strong>${esc(carTitle(c))}</strong>
          <small>${esc([c.registration ? fmtReg(c.registration) : '', c.status === 'sold' ? 'Sold' : c.status === 'draft' ? 'Draft' : c.status === 'reserved' ? 'Reserved' : '', c.price ? money(c.sale_price != null && c.status === 'sold' ? c.sale_price : c.price) : ''].filter(Boolean).join(' · '))}</small></span>
      </button>`;
    const box = sheetHtml(title, sub, `
      ${(extra || []).map((x, i) => `<button class="sheet-action" type="button" data-x="${i}">${icon(x.icon || 'plus')}<div><span>${esc(x.label)}</span>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</div></button>`).join('')}
      ${cars.length > 6 ? `<label class="search pick-search">${icon('search')}<input type="search" placeholder="Search make, model or plate" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search your cars"></label>` : ''}
      <div class="pick-list">${cars.map(row).join('') || '<p class="hint" style="padding:8px 4px">No cars to pick from yet.</p>'}</div>`);
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { closeSheet(); setTimeout(() => extra[+b.dataset.x].run(), 180); });
    box.querySelectorAll('.pick-car').forEach(b => b.onclick = () => {
      const car = state.cars.find(c => c.id === b.dataset.id);
      closeSheet(); setTimeout(() => run(car), 180);
    });
    const q = box.querySelector('.pick-search input');
    if (q) q.oninput = () => {
      const t = q.value.trim();
      box.querySelectorAll('.pick-car').forEach(b => {
        const car = state.cars.find(c => c.id === b.dataset.id);
        b.hidden = !!t && !matchesQuery(car, t);
      });
    };
  }

  /* ================================================================ AUTH
     EMAIL + PASSWORD, and there are two good reasons for it.

     1. Supabase only lets you edit the sign-in email template if you've set
        up your own SMTP server. Without that, the emailed template contains a
        link and no code, so a 6-digit code flow simply isn't available.

     2. A magic link is worse than it looks on iOS. An app added to the home
        screen has its own storage, separate from Safari. Tapping a link in
        Mail signs you into *Safari*, while the home-screen app still shows a
        login screen. Baffling, and impossible for a non-technical user to
        diagnose.

     A password sidesteps both. It works identically wherever it's typed, the
     iPhone keychain remembers it, and there's no email to go missing.
     Forgotten password → reset it in the Supabase dashboard (SETUP §1.5).
     ====================================================================== */
  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const password = $('#loginPassword').value;
    if (!email || !password) {
      msg('#loginMsg', 'Enter your email address and password.', 'err');
      return;
    }

    const btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    msg('#loginMsg', '');

    const { error } = await sb.auth.signInWithPassword({ email, password });

    btn.disabled = false; btn.textContent = 'Sign in';

    if (error) {
      const m = error.message || '';
      msg('#loginMsg',
        /invalid login credentials/i.test(m)
          ? 'That email address and password don’t match. Check for typos. The password is case sensitive.'
        : /email not confirmed/i.test(m)
          ? 'This account hasn’t been confirmed yet. Whoever set it up needs to tick “Auto Confirm User” in Supabase.'
        : /too many requests|rate/i.test(m)
          ? 'Too many attempts. Wait a minute and try again.'
          : esc(m), 'err');
      $('#loginPassword').select();
      return;
    }

    // onAuthStateChange normally starts the app; call boot directly too in
    // case that event has already fired. boot() guards against running twice.
    boot();
  };

  $('#signOutBtn').onclick = () => {
    confirmSheet('Sign out?', 'You’ll need your email address and password to get back in.', 'Sign out',
      async () => { await sb.auth.signOut(); location.reload(); });
  };

  /* ============================================================== BOOT */
  let booting = false;

  async function boot() {
    if (booting || state.user) return;   // getSession and onAuthStateChange can race
    booting = true;
    try { await bootInner(); } finally { booting = false; }
  }

  async function bootInner() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { $('#loginView').style.display = ''; return; }

    // Signed in is not the same as allowed in. Without this check an account
    // that isn't in the `admins` table would just see an empty app with no
    // explanation, which is a horrible thing to debug over the phone.
    const { data: adminRow, error: adminErr } = await sb
      .from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();

    if (adminErr || !adminRow) {
      $('#loginView').style.display = '';
      $('#loginForm').hidden = true;
      $('#loginNote').innerHTML = '';
      msg('#loginMsg',
        `You’re signed in as <strong>${esc(session.user.email)}</strong>, but this
         account hasn’t been given access yet.<br><br>
         Whoever set this up needs to add you to the admin list in Supabase
         (SETUP.md, Part 1.6).`, 'warn');
      if (!$('#notAdminOut')) {          // boot() can run twice; don't stack buttons
        const out = document.createElement('button');
        out.id = 'notAdminOut';
        out.className = 'btn btn--block';
        out.style.cssText = 'color:#A8B6CC;margin-top:14px';
        out.textContent = 'Sign out and try another email';
        out.onclick = async () => { await sb.auth.signOut(); location.reload(); };
        $('#loginMsg').after(out);
      }
      return;
    }

    state.user = session.user;
    $('#loginView').style.display = 'none';
    $('#app').classList.remove('is-hidden');
    $('#whoami').textContent = session.user.email;
    // The website is on the same address, so it shares this storage: visits
    // to it from this browser are left out of the figures (data.js, isStaff).
    // An iPhone's home-screen app keeps its own storage apart from Safari,
    // which is what gear → Don't count this phone is for.
    try { localStorage.setItem('mbu_staff', '1'); } catch { /* private mode */ }

    buildFormControls();
    buildStockTools();
    go('home');
    await Promise.all([loadCars(), loadEnquiries()]);
    // Invoices load after the stock; Home redraws for any delivery due
    checkSchema().then(async () => { if (state.schema.v10) { await loadInvoices(); if (state.view === 'home') renderHome(); } });
    // Home's recommendations come from the insight engine, which needs the
    // interest and ageing figures. go('home') above has already asked for
    // them, alongside the stock, and Home redraws when they land.
  }

  /**
   * Confirm all four SQL files have been run.
   *
   * Without this, skipping one shows up later as a raw Postgres error at the
   * worst possible moment. Usually it is "column cars.video does not exist"
   * the first time someone tries to save a car. This says which file is missing,
   * in words, before that happens.
   */
  async function checkSchema() {
    const checks = [
      ['schema.sql',                 () => sb.from('cars').select('id').limit(1)],
      ['schema-v2-additions.sql',    () => sb.from('wanted_requests').select('id').limit(1)],
      ['schema-v3-price-book.sql',   () => sb.from('price_checks').select('id').limit(1)],
      ['schema-v4-pricing-video.sql',() => sb.from('stock_ageing').select('id').limit(1)]
    ];

    const missing = [];
    for (const [file, run] of checks) {
      try {
        const { error } = await run();
        // "relation does not exist" / "schema cache" both mean: not created yet.
        if (error && /does not exist|schema cache|not find the table/i.test(error.message)) {
          missing.push(file);
        }
      } catch { missing.push(file); }
    }

    // The newer files are upgrades, not setup. Nothing breaks without them, so
    // they're offered in Settings rather than shouted about on Stock.
    const has = async run => {
      try {
        const { error } = await run();
        return !(error && /does not exist|schema cache|not find the table/i.test(error.message));
      } catch { return false; }
    };
    // Edge Functions: 404 means not deployed; anything else means it's there
    const deployed = async (name, method) => {
      try { return (await fetch(CFG.supabase.url.replace(/\/$/, '') + '/functions/v1/' + name, { method, cache: 'no-store' })).status !== 404; }
      catch { return null; }
    };
    const [v6, v7, v8, v10, v11, v14, track, motFn] = await Promise.all([
      has(() => sb.from('tracking_status').select('v2_since').limit(1)),
      has(() => sb.from('insight_actions').select('id').limit(1)),
      has(() => sb.from('cars').select('px_sale').limit(1)),
      has(() => sb.from('invoices').select('id').limit(1)),
      has(() => sb.from('instagram_posts').select('id').limit(1)),
      has(() => sb.rpc('site_stats', { p_from: new Date().toISOString(), p_to: new Date().toISOString(), p_car: null })),
      deployed('track', 'OPTIONS'),
      deployed('mot-calendar', 'GET')
    ]);
    state.schema = Object.assign(state.schema, { v6, v7, v8, v10, v11, v14 });
    state.fns = { track, motCalendar: motFn };
    renderUpgrades();

    if (!missing.length) return;

    const setupMsg =
      `<strong>Setup isn’t finished.</strong><br>
       ${missing.length === 1 ? 'This file hasn’t' : 'These files haven’t'} been run in Supabase yet:
       <br><br>${missing.map(f => '• <strong>' + f + '</strong>').join('<br>')}<br><br>
       Open Supabase → SQL Editor → New query, paste the file in, press Run.
       Do them in the order listed. Until then some things won’t save.`;
    // Home is where you land now, so it has to say so there as well as on Stock
    msg('#stockMsg', setupMsg, 'err');
    msg('#homeMsg', setupMsg, 'err');
  }

  /**
   * Settings → "Ready to switch on". Lists the upgrades that are written but not
   * yet turned on, in the order they have to happen, and says what each gets
   * you. Hidden once there's nothing left to do.
   */
  function renderUpgrades() {
    const items = [];
    const via = (CFG.tracking && CFG.tracking.via) || 'rest';

    const fns = state.fns || {};
    if (state.schema.v14 === false) {
      items.push(['Every page and every tap counted',
        'Run <strong>schema-v14-site-analytics.sql</strong> in Supabase → SQL Editor (after v6). Then Insights → Website, the week’s summary and “Who tapped what” have their figures.']);
    }
    if (state.schema.v6 === false) {
      items.push(['Count people, not page loads',
        'Run <strong>schema-v6-tracking.sql</strong> in Supabase → SQL Editor. Then deploy the <strong>track</strong> function. HANDOVER 9f and 9s have the steps.']);
    } else if (state.schema.v6 && via !== 'function') {
      items.push(['Switch the website to the new tracking',
        `${fns.track ? 'The <strong>track</strong> function is there: paste in the latest copy (7 Oct)' : 'Deploy the <strong>track</strong> function'} with JWT verification off, then set <strong>tracking: { via: \'function\' }</strong> in config.js. People get counted once a day each, bots are left out.`]);
    }
    if (fns.motCalendar === false) {
      items.push(['MOT dates on your phone’s calendar, kept up to date',
        'Deploy the <strong>mot-calendar</strong> function with JWT verification off (HANDOVER 9s). Then Tools → MOTs → Set up the calendar link. Needs v10 too.']);
    }
    if (state.schema.v7 === false) {
      items.push(['"Price is right" and "Remind me" on insights',
        'Run <strong>schema-v7-insights.sql</strong> in Supabase → SQL Editor, after v6.']);
    }
    if (state.schema.v8 === false) {
      items.push(['Part exchange sales',
        'Run <strong>schema-v8-part-exchange.sql</strong> in Supabase → SQL Editor. Then a sale can be marked as a part exchange, and it stays out of your margins until their car sells.']);
    }

    if (state.schema.v10 === false) {
      items.push(['Keep every invoice',
        'Run <strong>schema-v10-invoices.sql</strong> in Supabase → SQL Editor. Invoices can be made and sent without it, but the list, the numbering (MBU-1001 on), recording payments and sharing Invoice details between the two phones need it.']);
    }
    if (state.schema.v11 === false) {
      items.push(['Instagram posts on the homepage',
        'Run <strong>schema-v11-instagram.sql</strong>, connect Instagram to Behold (free) and add its feed address to GitHub as <strong>BEHOLD_FEED_URL</strong>. The steps are at the top of <strong>.github/workflows/instagram-posts.yml</strong>.']);
    }
    $('#upgradesCard').hidden = !items.length;
    $('#upgradesBody').innerHTML = items.map(([title, how]) => `
      <div style="padding:10px 0;border-bottom:1px solid var(--line-2)">
        <strong style="display:block;font-size:15.5px">${esc(title)}</strong>
        <span class="hint" style="display:block;margin-top:3px;font-size:14px;line-height:1.5">${how}</span>
      </div>`).join('');
  }

  /* ---- Settings → Your own visits -------------------------------------------
     Opens the website once with ?staff=1, which leaves the one marker data.js
     looks for (MBU.isStaff), so this phone's visits aren't counted. An
     iPhone's home-screen app keeps its storage apart from Safari, so the link
     can also be copied and opened in the browser you actually use. */
  const staffUrl = () => (CFG.options.siteUrl || location.origin).replace(/\/$/, '') + '/?staff=1';
  $('#staffBtn').onclick = () => window.open(staffUrl(), '_blank', 'noopener');
  $('#staffCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(staffUrl()); toast('Copied. Paste it into Safari or Chrome and open it once', 'ok'); }
    catch { prompt('Open this once in the browser you use:', staffUrl()); }
  };

  /* ---- Settings → Auto Trader ----------------------------------------- */
  function atIntro() {
    if (!AT || !AT.isEnabled()) {
      $('#atStatus').innerHTML = `Not switched on yet. Once Auto Trader approve access, deploy the
        <strong>autotrader</strong> function with your key and secret (HANDOVER 9f), tap Test,
        then set <strong>enabled: true</strong> for autotrader in config.js.`;
    } else {
      $('#atStatus').textContent = 'Switched on. Tap Test to check the connection.';
    }
  }

  $('#atTest').onclick = async () => {
    const btn = $('#atTest');
    const box = $('#atStatus');
    if (!AT) return;
    btn.disabled = true; btn.textContent = 'Testing…';
    const s = await AT.status();
    btn.disabled = false; btn.textContent = 'Test the connection';

    if (s.connected) {
      box.innerHTML = s.env === 'sandbox'
        ? `<span style="color:var(--green-600);font-weight:700">Connected to the Auto Trader sandbox.</span>
           That is test data, not real prices. Switch AT_ENV to production when they give you live credentials.`
        : `<span style="color:var(--green-600);font-weight:700">Connected to Auto Trader.</span>
           Advertiser ${esc(s.advertiserId || '')}.${AT.isEnabled() ? '' : ' Set enabled: true in config.js to start using it.'}`;
    } else if (s.code === 'not_deployed') {
      box.innerHTML = 'The <strong>autotrader</strong> function isn’t deployed in Supabase yet.';
    } else if (s.configured === false && s.missing) {
      box.innerHTML = `The function is deployed but these secrets are missing: <strong>${s.missing.map(esc).join(', ')}</strong>.`;
    } else {
      box.innerHTML = `<span style="color:var(--red-600);font-weight:700">Not connected.</span> ${esc(s.error || '')}`;
    }
  };

  sb.auth.onAuthStateChange((event) => {
    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && !state.user) {
      history.replaceState(null, '', location.pathname);
      boot();
    }
  });

  /* ================================================== MAKE/MODEL PICKERS
     A native dropdown is the fastest thing on a phone, but a fixed list would
     eventually block a car nobody thought of. So every picker carries a
     "Something else" option that reveals a text box, and anything typed there
     (or returned by the plate lookup) is added to the list from then on.
     ==================================================================== */
  const OTHER = '__other';

  /** Everything we know about, ours and the built-in list, sorted. One entry
      per make however it was typed: an old "Bmw" record shows up as BMW. */
  function knownMakes() {
    const byKey = new Map(Object.keys(MODELS).map(m => [keyOf(m), m]));
    state.cars.forEach(c => {
      if (c.make && !byKey.has(keyOf(c.make))) byKey.set(keyOf(c.make), MK.makeName(c.make));
    });
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'en-GB'));
  }

  function knownModels(make) {
    const byKey = new Map((MODELS[MK.knownMake(make)] || []).map(m => [modelKeyOf(m), m]));
    state.cars.forEach(c => {
      if (c.model && (!make || keyOf(c.make) === keyOf(make)) && !byKey.has(modelKeyOf(c.model))) {
        byKey.set(modelKeyOf(c.model), String(c.model).trim());
      }
    });
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'en-GB', { numeric: true }));
  }

  /**
   * Fill a picker, keeping the current value selected if it still exists.
   * @param {string} sel     the <select>
   * @param {string} other   the text input revealed by "Something else"
   * @param {string[]} values
   * @param {string} blank   label for the empty first option
   */
  function fillPicker(sel, other, values, blank) {
    const el = $(sel);
    const keep = el.value;
    el.innerHTML = `<option value="">${blank}</option>` +
      values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('') +
      `<option value="${OTHER}">Something else…</option>`;
    if (keep && [...el.options].some(o => o.value === keep)) el.value = keep;
    syncOther(sel, other);
  }

  function syncOther(sel, other) {
    const show = $(sel).value === OTHER;
    $(other).hidden = !show;
    if (!show) $(other).value = '';
  }

  /** What the picker is actually set to, typed value included. */
  function pickerValue(sel, other) {
    const v = $(sel).value;
    return v === OTHER ? $(other).value.trim() : v;
  }

  /**
   * Set a picker to a value, adding it to the list first if it is new. This
   * is what lets the plate lookup drop in a make nobody has sold before.
   */
  function setPicker(sel, other, value) {
    const el = $(sel);
    if (!value) { el.value = ''; syncOther(sel, other); return; }
    if (![...el.options].some(o => o.value === value)) {
      el.insertBefore(new Option(value, value), el.options[el.options.length - 1]);
    }
    el.value = value;
    syncOther(sel, other);
  }

  /** Make changed, so the model list has to follow it. */
  function wirePickerPair(makeSel, makeOther, modelSel, modelOther) {
    const refreshModels = () => {
      const make = pickerValue(makeSel, makeOther);
      fillPicker(modelSel, modelOther, knownModels(make), 'Choose…');
    };
    $(makeSel).addEventListener('change', () => {
      syncOther(makeSel, makeOther);
      $(modelSel).value = '';
      refreshModels();
    });
    $(makeOther).addEventListener('input', refreshModels);
    $(modelSel).addEventListener('change', () => syncOther(modelSel, modelOther));
    return refreshModels;
  }

  /* ============================================================= NAV
     Five tabs, and the screens you reach from them: the car form, quick
     add, one message in full, the bid tool, settings and every tool. Back
     retraces your steps one screen at a time (Tools → Invoices → one invoice
     → Back → Invoices), and always ends on the tab you started from, so
     fixing a car from a Home alert lands you back on Home.

     The edit screens (car form, quick add) are never stepped back into:
     once saved there's nothing to return to. */
  const TABS = ['home', 'stock', 'enq', 'data', 'tools'];
  const VIEWS = ['home','stock','quick','form','value','enq','msg','data','tools','settings',
                 'invoices','invoice','invprev','pricebook','motcal','motcheck','photos','carfig','carcmp'];
  const NO_RETURN = ['form', 'quick'];
  const TITLES = {
    home: 'Home', stock: 'Your stock', quick: 'Quick add', enq: 'Inbox', msg: 'Message',
    value: 'Before you bid', data: 'Insights', tools: 'Tools', settings: 'Settings',
    invoices: 'Invoices', invoice: 'Invoice', invprev: 'Check and send', pricebook: 'Price book', motcal: 'MOTs',
    motcheck: 'MOT checker', photos: 'Photo guide', carfig: 'Car figures', carcmp: 'Compare cars'
  };
  // Screens that redraw themselves each time they're shown (coming back
  // from a sub-screen included), so a saved invoice is in the list at once
  const ON_SHOW = {};

  function go(view, opts) {
    opts = opts || {};
    if (TABS.includes(view)) state.trail = [];
    else if (!opts.back && view !== state.view && !NO_RETURN.includes(state.view)) state.trail.push(state.view);
    state.view = view;
    VIEWS.forEach(v => { const el = $('#' + v + 'View'); if (el) el.classList.toggle('is-hidden', v !== view); });

    const isForm  = view === 'form';
    const isQuick = view === 'quick';
    const isEdit  = isForm || isQuick || view === 'invoice' || view === 'invprev';
    const isSub   = !TABS.includes(view);
    $('#tabbar').style.display = isEdit ? 'none' : '';
    $('#invBar').hidden  = view !== 'invoice';
    $('#prevBar').hidden = view !== 'invprev';
    $('#addFab').style.display = view === 'stock' ? '' : 'none';
    $('#saveBar').hidden  = !isForm;
    $('#quickBar').hidden = !isQuick;
    $('#backBtn').hidden = !isSub;
    $('#settingsBtn').hidden = isSub;
    $('#topbarSpacer').style.display = isSub ? 'none' : '';
    $('#topbarSpacer2').style.display = isSub ? '' : 'none';

    $('#topTitle').textContent =
      isForm ? (state.editing ? 'Edit car' : 'Add a car') : (opts.title || TITLES[view] || 'MBU Admin');

    // Figures are loaded on demand, and refreshed each time you open the tab
    if (view === 'home') { renderHome(); refreshHomeFigures(); }
    if (view === 'data') loadInsights();
    if (view === 'tools') renderTools();
    if (view === 'settings') atIntro();
    if (ON_SHOW[view]) ON_SHOW[view](opts);

    // A sub-screen keeps lit the tab you came from
    const lit = TABS.includes(view) ? view : (state.trail.find(v => TABS.includes(v)) || 'home');
    $$('#tabbar button').forEach(b => b.classList.toggle('is-on', b.dataset.view === lit));
    window.scrollTo(0, 0);
  }

  const goBack = () => go(state.trail.pop() || 'home', { back: true });

  $$('#tabbar button').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#backBtn').onclick = () => {
    if (!state.dirty || !['form', 'quick', 'invoice'].includes(state.view)) {
      if (state.view !== 'invprev') state.dirty = false;   // edits made on the preview belong to the invoice
      return goBack();
    }
    confirmSheet('Leave without saving?', 'Anything you’ve typed will be lost.',
      'Discard changes', () => { state.dirty = false; goBack(); }, true);
  };
  $('#settingsBtn').onclick = () => go('settings');

  /* ============================================================ HOME
     What needs doing first, then the money, the stock and the messages.
     Nothing here is new data: it's the same cars, messages and insight
     engine the other tabs use, pulled together so the morning check is
     one screen. Every row opens the thing it's about.
     ==================================================================== */

  /* What to do about each kind of insight, as the headline on Home */
  const CAUSE_DO = {
    price: 'Reduce the price', price_unchecked: 'Check the price', price_cat: 'Check the price',
    photos: 'Add more photos', first_impression: 'Sort out the first photos', visibility: 'Get it seen',
    unclear: 'Have a look at the listing', interest_falling: 'Interest is dropping off',
    ageing: 'Review the price', demand: 'Lots of interest: hold the price'
  };

  /* The same, two words each, for the line that sums up a section */
  const CAUSE_SHORT = {
    price: 'reduce price', price_unchecked: 'check price', price_cat: 'check price',
    photos: 'more photos', first_impression: 'first photos', visibility: 'get seen',
    unclear: 'check listing', interest_falling: 'interest dropping', ageing: 'review price',
    demand: 'hold price'
  };

  let homeActs = [];     // what each Home row does when tapped, by index

  /* ======================================================= VERSE OF THE DAY
     A verse of the Qur'an or a hadith, above the money on Home and at the
     top of the Sold tab, and "Mashallah · Barakallah" beside the figures.
     The words and where each comes from are in verses.js; if that file is
     missing, none of this shows and nothing else changes.
     ==================================================================== */
  const VERSES = window.MBU_VERSES || null;

  /** Today's, by the local date: the same on both phones, a new one at midnight. */
  function verseOfTheDay() {
    if (!VERSES || !VERSES.list.length) return null;
    const d = new Date();
    const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
    return VERSES.list[day % VERSES.list.length];
  }

  /* The Islamic date, from the phone's own Umm al-Qura calendar. That's a
     calculated calendar, so it can be a day out from a mosque that goes by
     the moon being sighted; set this to 1 or -1 if it doesn't match yours. */
  const HIJRI_ADJUST_DAYS = 0;

  /** Today in the Islamic calendar, in Arabic and English, or null if the phone can't. */
  function hijriToday() {
    try {
      const d = new Date(Date.now() + HIJRI_ADJUST_DAYS * DAY);
      const fmt = loc => new Intl.DateTimeFormat(loc + '-u-ca-islamic-umalqura',
        { day: 'numeric', month: 'long', year: 'numeric' });
      const en = fmt('en-GB');
      if (en.resolvedOptions().calendar !== 'islamic-umalqura') return null;
      return { en: en.format(d), ar: fmt('ar-SA').format(d) };
    } catch { return null; }
  }

  /** Today, both calendars: the top of Home. */
  function dateHead() {
    const now = new Date();
    const h = hijriToday();
    return `<div class="verse-date">
      <div class="vd-greg">
        <span class="vd-day">${esc(now.toLocaleDateString('en-GB', { weekday: 'long' }))}</span>
        <span class="vd-date">${esc(now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }))}</span>
      </div>
      ${h ? `<div class="vd-hijri">
        <span class="vd-hijri-ar" lang="ar" dir="rtl">${esc(h.ar)}</span>
        <span class="vd-hijri-en">${esc(h.en)}</span>
      </div>` : ''}
    </div>`;
  }

  /**
   * @param {object} [v]      a verse; today's if left out
   * @param {object} [opts]   { dated: true } puts today's date across the top (Home)
   */
  function verseCard(v, opts) {
    v = v || verseOfTheDay();
    if (!v) return opts && opts.dated ? `<div class="verse verse--bare">${dateHead()}</div>` : '';
    const quran = v.kind === 'quran';
    return `<figure class="verse verse--${quran ? 'quran' : 'hadith'}">
      ${opts && opts.dated ? dateHead() : ''}
      <figcaption class="verse-head">
        <span class="verse-tag">${quran ? 'Qur’an' : 'Hadith'}</span>
        <span>For today</span>
      </figcaption>
      <blockquote class="verse-ar" lang="ar" dir="rtl">${esc(v.ar)}</blockquote>
      ${!quran && v.intro ? `<p class="verse-intro">${esc(v.intro)}</p>` : ''}
      <p class="verse-en">${esc(v.en)}</p>
      <a class="verse-ref" href="${esc(v.link)}" target="_blank" rel="noopener">${esc(v.ref)}${v.source ? ' · ' + esc(v.source) : ''}</a>
    </figure>`;
  }

  /** The small badge beside a money figure. Tap it for what it means. */
  const mashallah = () => VERSES
    ? `<button class="mashallah" type="button" data-mashallah aria-label="${esc(VERSES.mashallah.en)}"><span lang="ar" dir="rtl">${esc(VERSES.mashallah.ar)}</span></button>`
    : '';

  function wireMashallah(root) {
    root.querySelectorAll('[data-mashallah]').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        const m = VERSES.mashallah;
        const find = ref => VERSES.list.find(v => v.ref.startsWith(ref));
        sheet(m.en, m.meaning, []);
        $('#sheetActions').innerHTML = [find('Al-Kahf 18:39'), find('Sunan Ibn Majah 3509')]
          .filter(Boolean).map(v => verseCard(v).replace(/<figcaption[\s\S]*?<\/figcaption>/,
            `<figcaption class="verse-head"><span class="verse-tag">${v.kind === 'quran' ? 'Qur’an' : 'Hadith'}</span></figcaption>`)).join('') +
          `<p class="hint" style="padding:4px 4px 0;text-align:center">Said over what Allah has given, so the credit goes where it belongs.</p>`;
      };
    });
  }

  function renderHome() {
    const body = $('#homeBody');
    if (!state.carsLoaded) {
      body.innerHTML = `<div class="section-card"><div class="skel" style="height:120px"></div></div>`.repeat(3);
      return;
    }
    homeActs = [];
    if (insightsAt) analysis = runEngine();

    const sections = homeSections();
    const act = run => homeActs.push(run) - 1;

    /* One kind of thing per row. Tap it and the cars (or messages) it covers
       drop down underneath, each one tapping through to its fix. A section
       with only one thing in it skips the drop-down and goes straight there.
       Anything about one car can be hidden (the clock): for a week, or until
       it changes (HOME HIDDEN, below). */
    const hideBtn = it => it.hid ? `<button class="alert-hide" type="button" data-hide="${esc(it.hid)}" data-what="${esc(it.title + (it.sub ? ' · ' + it.sub : ''))}" aria-label="Hide this for now">${icon('clock')}</button>` : '';
    const section = s => {
      if (s.items.length === 1) {
        const it = s.items[0];
        const [title, sub] = s.single === 'item' ? [it.title, it.sub] : [s.title, it.title];
        return `<div class="alert-wrap"><button class="alert alert--${s.level}" type="button" data-home="${act(it.run)}">
          <span class="alert-ic">${icon(s.icon)}</span>
          <span class="alert-txt"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
          ${icon('right')}
        </button>${hideBtn(Object.assign({}, it, { title, sub }))}</div>`;
      }
      return `<details class="alert-group" data-key="${s.key}"${state.homeOpen.has(s.key) ? ' open' : ''}>
        <summary class="alert alert--${s.level}">
          <span class="alert-ic">${icon(s.icon)}</span>
          <span class="alert-txt"><strong>${esc(s.title)}</strong><small>${esc(s.sub)}</small></span>
          <span class="alert-count">${s.items.length}</span>${icon('down')}
        </summary>
        <div class="alert-items">${s.items.map(it => `<div class="alert-wrap">
          <button class="alert-item" type="button" data-home="${act(it.run)}">
            <i class="dot dot--${it.level || s.level}"></i>
            <span class="alert-txt"><strong>${esc(it.title)}</strong><small>${esc(it.sub)}</small></span>
            ${icon('right')}
          </button>${hideBtn(it)}</div>`).join('')}
        </div>
      </details>`;
    };

    /* Today, this week, and the tidying-up that can wait (folded away) */
    const when = { today: [], week: [], later: [] };
    sections.forEach(x => when[homeWhen(x)].push(x));
    const group = (key, label, list, folded) => !list.length ? '' : folded
      ? `<details class="alerts-more alerts-when" data-key="when:${key}"${state.homeOpen.has('when:' + key) ? ' open' : ''}>
           <summary><span>${esc(label)}</span><span class="home-n">${list.length}</span>${icon('down')}</summary>
           ${list.map(section).join('')}
         </details>`
      : `<div class="alerts-when-h">${esc(label)} <span class="home-n">${list.length}</span></div>${list.map(section).join('')}`;
    const hidden = homeHidden.count;

    body.innerHTML = `
      ${verseCard(null, { dated: true })}

      <div class="home-actions">
        <button class="home-action home-action--primary" type="button" id="hAdd">
          ${icon('car')}<span><strong>Add a car</strong><small>Plate and what you paid</small></span>
        </button>
        <button class="home-action" type="button" id="hBid">
          ${icon('gauge')}<span><strong>Before you bid</strong><small>History and a max bid</small></span>
        </button>
        <button class="home-action home-action--wide" type="button" id="hInvoice">
          ${icon('receipt')}<span><strong>Make an invoice</strong><small>For a sale, a deposit, pay monthly, or anything else</small></span>
        </button>
      </div>

      ${weekCard(true)}

      <h2 class="home-h">Needs you${sections.length ? ` <span class="home-n">${sections.length}</span>` : ''}</h2>
      ${sections.length ? `<div class="card alerts">
          ${group('today', 'Today', when.today)}
          ${group('week', 'This week', when.week)}
          ${group('later', when.today.length || when.week.length ? 'When you have a minute' : 'Tidying up, when you have a minute', when.later, true)}
        </div>`
      : `<div class="card alert-none alert-none--ok">${icon('checkCirc')}<span>Nothing needs you right now.</span></div>`}
      ${hidden ? `<button class="home-hidden" type="button" id="hHidden">${icon('clock')} ${plural(hidden, 'thing')} hidden for now · Show</button>` : ''}
      ${!insightsAt && insightsBusy ? '<p class="note home-note">Checking prices and interest…</p>' : ''}

      ${homeMoney()}
      ${homeStock()}
      ${homeMessages()}
      ${homeOldest()}`;

    $('#hAdd').onclick = () => openQuick();
    $('#hBid').onclick = () => go('value');
    $('#hInvoice').onclick = () => newInvoice();
    $$('#homeBody [data-home]').forEach(b => { b.onclick = () => homeActs[+b.dataset.home](); });
    // Remember which sections are open, so a redraw (a message read, a price
    // changed) doesn't snap them shut
    $$('#homeBody details.alert-group, #homeBody details.alerts-when').forEach(d => {
      d.addEventListener('toggle', () => { d.open ? state.homeOpen.add(d.dataset.key) : state.homeOpen.delete(d.dataset.key); });
    });
    $$('#homeBody [data-hide]').forEach(b => b.onclick = e => { e.stopPropagation(); hideSheet(b.dataset.hide, b.dataset.what); });
    const hh = $('#hHidden');
    if (hh) hh.onclick = hiddenSheet;
    wireSiteBits(body);
    $$('#homeBody [data-go]').forEach(b => {
      b.onclick = () => {
        const [view, tab] = b.dataset.go.split(':');
        if (view === 'stock') { setStockTab(tab || 'available'); go('stock'); }
        else if (view === 'data') openDataTab(tab || 'summary');
        else if (view === 'enq') { setEnqTab(tab || 'new'); go('enq'); }
      };
    });
    wireFigureButtons(body);
    wireCharts(body);
    wireMashallah(body);
  }

  /* ---- Which group a Needs you row goes in ------------------------------- */
  function homeWhen(x) {
    if (['deliveries', 'messages', 'photos'].includes(x.key)) return 'today';
    if (x.key === 'mot' || x.key === 'recs') return x.level === 'red' ? 'today' : x.level === 'grey' ? 'later' : 'week';
    if (['cat', 'unmargined', 'pxcar', 'drafts'].includes(x.key)) return 'week';
    return 'later';
  }

  /* ---- HOME HIDDEN --------------------------------------------------------
     Things about one car hidden from Needs you, as { key: until | 'always' }.
     A key carries what the item is about (an MOT row includes its date), so
     "for good" lasts until that changes, then it can come back. Shared by
     both phones in app_settings ('home_hidden', schema v10), else kept on
     this phone. */
  const homeHidden = { map: null, loading: false, count: 0, list: [] };
  function hiddenMap() {
    if (homeHidden.map) return homeHidden.map;
    try { homeHidden.map = JSON.parse(localStorage.getItem('mbu_home_hidden') || '{}') || {}; } catch { homeHidden.map = {}; }
    if (state.schema.v10 !== false && !homeHidden.loading) {
      homeHidden.loading = true;
      Promise.resolve(sb.from('app_settings').select('value').eq('key', 'home_hidden').maybeSingle()).then(({ data, error }) => {
        if (error || !data || !data.value) return;
        homeHidden.map = Object.assign({}, data.value.items || {});
        if (state.view === 'home') renderHome();
      }).catch(() => {});
    }
    return homeHidden.map;
  }
  const isHidden = key => { const v = hiddenMap()[key]; return v === 'always' || (!!v && new Date(v) > new Date()); };

  async function setHidden(key, value) {
    const m = hiddenMap();
    if (value) m[key] = value; else delete m[key];
    Object.keys(m).forEach(k => { if (m[k] !== 'always' && !(new Date(m[k]) > new Date())) delete m[k]; });
    try { localStorage.setItem('mbu_home_hidden', JSON.stringify(m)); } catch { /* fine */ }
    renderHome();
    if (state.schema.v10) {
      const { error } = await sb.from('app_settings').upsert({ key: 'home_hidden', value: { items: m }, updated_at: new Date().toISOString() });
      if (error) toast('Hidden on this phone only: ' + error.message);
    }
  }

  function hideSheet(key, what) {
    sheet('Hide this for now?', what, [
      { label: 'Hide it for a week', icon: 'clock', sub: 'It comes back on ' + shortDay(addDays(new Date(), 7)),
        run: () => { setHidden(key, addDays(new Date(), 7).toISOString()); toast('Hidden for a week', 'ok'); } },
      { label: 'Hide it until something changes', icon: 'check', sub: 'A new date, a price, a fix: then it can come back',
        run: () => { setHidden(key, 'always'); toast('Hidden', 'ok'); } }
    ]);
  }

  function hiddenSheet() {
    const list = homeHidden.list;
    if (!list.length) return;
    sheet('Hidden for now', 'Tap one to put it back on Home', list.map(h => ({
      label: h.title, sub: [h.sub, hiddenMap()[h.key] === 'always' ? 'until it changes' : 'until ' + shortDay(hiddenMap()[h.key])].filter(Boolean).join(' · '),
      icon: 'clock', run: () => { setHidden(h.key, null); toast('Back on Home', 'ok'); }
    })));
  }

  /**
   * Everything that wants a decision or a missing figure, one section per
   * kind, most urgent first:
   *   MOTs (run out, due, no date) · new messages · price and interest
   *   recommendations · no photos · then the figures and details not filled in.
   * A section takes the colour of its most urgent item.
   *
   * Each section: { key, level, rank, icon, title, sub, items, single }.
   * `single` says how to show a section with one item: 'item' uses that item's
   * own words (an MOT, a recommendation); 'section' keeps the section's
   * headline with the car underneath ("1 Cat car has no damage note").
   */
  function homeSections() {
    const out = [];
    const cars = state.cars;
    homeHidden.count = 0;
    homeHidden.list = [];
    // Leave out what's been hidden, and remember it for "N hidden · Show"
    const keep = (key, title, sub) => {
      if (!isHidden(key)) return true;
      homeHidden.count++;
      homeHidden.list.push({ key, title, sub });
      return false;
    };
    const held = cars.filter(c => inStock(c) || c.status === 'draft');   // cars you still own
    const live = cars.filter(inStock);
    const sold = cars.filter(c => c.status === 'sold');
    const worst = items => ['red', 'amber', 'blue', 'green', 'grey'].find(l => items.some(it => it.level === l)) || 'grey';
    const carSub = c => [carTitle(c), c.registration ? fmtReg(c.registration) : null,
      c.status === 'draft' ? 'draft' : null].filter(Boolean).join(' · ');
    const counted = (n, one, many) => n === 1 ? '1 ' + one : n + ' ' + (many || one + 's');

    /* Deliveries booked for today or earlier and not marked delivered: one
       tap marks it, then the updated invoice is ready to send */
    const today = INV ? INV.today() : '';
    const drops = (IV.list || []).map(r => ({ r, d: toDeliver(r) })).filter(x => x.d && x.d.date && x.d.date <= today)
      .sort((a, b) => a.d.date.localeCompare(b.d.date))
      .map(({ r, d }) => {
        const v = (r.data || {}).vehicle || {};
        return { level: d.date < today ? 'red' : 'amber',
          title: d.date < today ? `Delivery was booked for ${INV.ukDate(d.date)}` : 'Delivery today' + (d.time ? ' (' + d.time + ')' : ''),
          sub: [[v.make, v.model].filter(Boolean).join(' '), r.registration ? fmtReg(r.registration) : '', r.customer_name].filter(Boolean).join(' · '),
          run: () => invoiceSettings().then(() => markDelivered(clone(fromRow(r)))) };
      });
    if (drops.length) out.push({ key: 'deliveries', level: worst(drops), rank: 2, icon: 'car', single: 'item',
      title: counted(drops.length, 'delivery to do', 'deliveries to do'), sub: 'Mark each one delivered, then send the updated invoice', items: drops });

    /* MOTs: run out, running out, and cars with no date, in one place */
    const motHid = c => 'mot:' + c.id + ':' + (c.mot_expiry ? String(c.mot_expiry).slice(0, 10) : 'none');
    const mots = held.filter(c => (motLevel(c) || !c.mot_expiry) && keep(motHid(c), carTitle(c), c.mot_expiry ? motWords(c) : 'No MOT date'))
      .sort((a, b) => (motDays(a) ?? Infinity) - (motDays(b) ?? Infinity))
      .map(c => {
        const lvl = motLevel(c) || 'grey';
        return { level: lvl, days: motDays(c), title: c.mot_expiry ? motWords(c) : 'No MOT date', sub: carSub(c),
          hid: motHid(c), run: () => motSheet(c) };
      });
    const noDate = mots.filter(m => m.days == null).length;
    if (mots.length) mots.push({ level: 'grey', title: noDate > 1 ? `Fill in all ${noDate} missing dates on one screen` : 'See every MOT on the calendar',
      sub: 'Tools → MOTs', run: () => { state.motTab = noDate > 1 ? 'dates' : 'cal'; go('motcal'); } });
    if (mots.length) {
      const ran = mots.filter(m => m.days != null && m.days < 0).length;
      const month = mots.filter(m => m.level === 'red').length - ran;
      const soon = mots.filter(m => m.level === 'amber').length;
      const none = mots.filter(m => m.level === 'grey').length;
      const due = month + soon;
      const level = worst(mots);
      // The headline says what's urgent; the line under it says the rest
      const title = [ran ? (ran === 1 ? '1 MOT has run out' : `${ran} MOTs have run out`) : '',
                     due ? (ran ? `${due} due soon` : counted(due, 'MOT due soon', 'MOTs due soon')) : ''].filter(Boolean).join(', ')
        || counted(none, 'car has no MOT date', 'cars have no MOT date');
      out.push({ key: 'mot', level, rank: level === 'red' ? 1 : level === 'amber' ? 5 : 8, icon: 'calendar', single: 'item',
        title,
        sub: [month ? `${month} within a month` : '', soon ? `${soon} within 3 months` : '',
              none && (ran || due) ? counted(none, 'car with no MOT date', 'cars with no MOT date') : ''].filter(Boolean).join(' · ')
          || (ran ? 'Needs testing before it can go' : 'So you can’t be warned before it runs out'),
        items: mots });
    }

    /* New messages, oldest waiting first */
    const unread = state.enquiries.filter(e => !e.is_read).map(x => ({ k: 'e', x }))
      .concat(state.requests.filter(r => !r.is_read).map(x => ({ k: 'r', x })))
      .sort((a, b) => new Date(a.x.created_at) - new Date(b.x.created_at));
    if (unread.length) {
      out.push({ key: 'messages', level: 'blue', rank: 2, icon: 'inbox', single: 'section',
        title: counted(unread.length, 'new message'),
        sub: unread.length === 1 ? '' : `The oldest has waited since ${ago(unread[0].x.created_at)}`,
        items: unread.map(({ k, x }) => ({ level: 'blue',
          title: x.name || 'No name given',
          sub: [k === 'r' ? 'Car request' : x.car_title || (x.details && x.details.subject) || 'General enquiry', ago(x.created_at)].join(' · '),
          run: () => openMessage(k, x.id) })) });
    }

    /* The insight engine's recommendations, once its figures are in. Most
       urgent first; the no-photos card is left to the photos section below. */
    if (insightsAt && analysis) {
      const also = f => f.suggestion ? f.suggestion.label.replace(/^Drop to/, 'try')
        : f.cause !== 'demand' && CAUSE_LABEL[f.cause] ? CAUSE_LABEL[f.cause] : '';
      const recs = analysis.findings.map((f, i) => ({ f, i })).filter(x => x.f.rule !== 'no_photos')
        .map(({ f, i }) => ({
          level: f.severity === 'good' ? 'green' : f.severity === 'act' ? 'red' : 'amber',
          short: CAUSE_SHORT[f.cause] || 'to look at',
          title: CAUSE_DO[f.cause] || CAUSE_LABEL[f.cause] || 'Worth a look',
          sub: [f.title, also(f)].filter(Boolean).join(' · '),
          run: () => insightSheet(i) }));
      if (recs.length) {
        // "4 reduce price · 5 review price · 1 more photos": what the list is made of
        const kinds = [];
        recs.forEach(r => { const k = kinds.find(x => x.what === r.short); k ? k.n++ : kinds.push({ what: r.short, n: 1 }); });
        const level = worst(recs);
        out.push({ key: 'recs', level, rank: level === 'red' ? 3 : level === 'amber' ? 6 : 9,
          icon: level === 'green' ? 'checkCirc' : 'tag', single: 'item',
          title: counted(recs.length, 'car to look at', 'cars to look at'),
          sub: kinds.map(k => `${k.n} ${k.what}`).join(' · '),
          items: recs });
      }
    }

    /* Gaps in the admin, one section each */
    const gap = (all, o) => {
      const list = all.filter(c => keep(o.key + ':' + c.id, carTitle(c), o.one.replace(/^1 /, '')));
      if (!list.length) return;
      out.push(Object.assign({ level: 'grey', rank: 8, single: 'section' }, o, {
        title: list.length === 1 ? o.one : `${list.length} ${o.many}`,
        items: list.map(c => ({ title: carTitle(c), hid: o.key + ':' + c.id,
          sub: o.itemSub ? o.itemSub(c) : [c.registration ? fmtReg(c.registration) : null,
            c.status === 'sold' ? 'sold' : c.status === 'draft' ? 'draft' : money(c.price)].filter(Boolean).join(' · '),
          run: () => o.fix(c) }))
      }));
    };

    gap(live.filter(c => !(Array.isArray(c.images) && c.images.length)), {
      key: 'photos', level: 'red', rank: 4, icon: 'camera', one: '1 car has no photos', many: 'cars have no photos',
      sub: 'Nobody gives it a fair look without them', fix: c => openForm(c, '#photoArea') });
    gap(live.filter(c => c.hpi_status && c.hpi_status !== 'clear' && !c.condition_notes), {
      key: 'cat', level: 'amber', rank: 7, icon: 'note', one: '1 Cat car has no damage note', many: 'Cat cars have no damage note',
      sub: 'Saying what was done up front sells them', fix: c => openForm(c, '#fCondition'),
      itemSub: c => [LABEL.hpi[c.hpi_status], money(c.price)].filter(Boolean).join(' · ') });
    gap(sold.filter(unmargined), {
      key: 'unmargined', level: 'amber', rank: 7, icon: 'pound', one: '1 sale isn’t in your margin', many: 'sales aren’t in your margin',
      sub: 'What you paid or what it sold for is missing', fix: c => figuresSheet(c),
      itemSub: c => `Sold ${c.sold_at ? shortDay(c.sold_at) : ''} · ${[c.sale_price == null ? 'no sale price' : '', c.purchase_price == null ? 'no purchase price' : ''].filter(Boolean).join(', ')}` });
    gap(sold.filter(c => (carMargin(c) != null || c.px_sale) && c.prep_cost == null), {
      key: 'noprep', icon: 'pound', one: '1 sale has no prep cost', many: 'sales have no prep cost',
      sub: 'Counted as £0 prep, so the margin reads high', fix: c => figuresSheet(c),
      // On a part exchange the prep goes into what their car is worked out at
      itemSub: c => `Sold ${c.sold_at ? shortDay(c.sold_at) : ''} · ${c.px_sale
        ? 'part exchange, their car’s cost leaves the prep out' : `margin ${signed(carMargin(c))} before prep`}` });
    // A part exchange whose car never went in: the profit on that deal would never show
    gap(sold.filter(c => c.px_sale && !pxCarOf(c)), {
      key: 'pxcar', level: 'amber', rank: 7, icon: 'car', one: '1 part exchange car isn’t in yet', many: 'part exchange cars aren’t in yet',
      sub: 'Add it so the profit on the deal shows when it sells', fix: c => addPxCar(c),
      itemSub: c => `Taken in when this sold, ${c.sold_at ? shortDay(c.sold_at) : ''}${pxCarried(c) != null ? ' · goes in at ' + money(pxCarried(c)) : ''}` });
    gap(held.filter(c => c.purchase_price == null), {
      key: 'nopaid', icon: 'pound', one: '1 car has no purchase price', many: 'cars have no purchase price',
      sub: 'No margin to show when it sells', fix: c => figuresSheet(c) });
    gap(cars.filter(c => c.status === 'draft'), {
      key: 'drafts', icon: 'edit', one: '1 draft isn’t on the website', many: 'drafts aren’t on the website',
      sub: 'Bought, not listed yet', fix: c => openForm(c),
      itemSub: c => [c.registration ? fmtReg(c.registration) : null, 'added ' + shortDay(c.created_at)].filter(Boolean).join(' · ') });
    gap(live.filter(c => !c.description), {
      key: 'nodesc', rank: 9, icon: 'note', one: '1 car has no description', many: 'cars have no description',
      sub: 'The website shows nothing under the photos', fix: c => openForm(c, '#fDescription') });
    /* Old records spelt another way ("Bmw", "Hazz"): one sheet tidies the lot */
    const respell = cars.filter(c => MK.spellingFix(c));
    gap(respell, {
      key: 'spelling', rank: 9, icon: 'edit', one: '1 car’s name to tidy', many: 'car names to tidy',
      sub: 'Spelt another way, so the search lists it twice', fix: () => spellingSheet(),
      itemSub: c => MK.spellingFix(c).changes.join(' · ') });

    const LEVEL = { red: 0, blue: 1, amber: 2, green: 3, grey: 4 };
    return out.sort((a, b) => a.rank - b.rank || LEVEL[a.level] - LEVEL[b.level]);
  }

  /**
   * Tidy spellings: every car whose make or model is spelt differently from
   * the proper one ("Bmw" → BMW, "A220" → A Class with A220 in the trim), or
   * looks like a typo ("Hazz" → Jazz). Each can be unticked before saving.
   * The website already shows the certain ones properly; this fixes the
   * records, so the app, the share links and the weekly email agree.
   */
  function spellingSheet() {
    const list = state.cars.map(c => ({ c, fix: MK.spellingFix(c) })).filter(x => x.fix);
    if (!list.length) return toast('Every name is spelt properly', 'ok');
    sheet('Tidy spellings', 'Untick any you’d rather leave as they are', []);
    $('#sheetActions').innerHTML = `
      <div class="figs tidy-list">
        ${list.map(({ c, fix }, i) => `
          <label class="tickrow">
            <input type="checkbox" data-i="${i}" checked>
            <span>
              <strong>${esc(carTitle(c))}${c.registration ? ' · ' + esc(fmtReg(c.registration)) : ''}</strong>
              <small>${fix.changes.map(esc).join('<br>')}</small>
              ${fix.guess ? '<small class="tidy-guess">Looks like a typo. Check it’s right.</small>' : ''}
            </span>
          </label>`).join('')}
        <button class="btn btn--accent btn--block" id="tidyGo" type="button">Tidy ${plural(list.length, 'car')}</button>
      </div>`;

    const ticked = () => $$('#sheetActions input[type=checkbox]').filter(b => b.checked).map(b => list[+b.dataset.i]);
    $$('#sheetActions input[type=checkbox]').forEach(b => b.onchange = () => {
      const n = ticked().length;
      $('#tidyGo').textContent = n ? `Tidy ${plural(n, 'car')}` : 'Nothing ticked';
      $('#tidyGo').disabled = !n;
    });
    $('#tidyGo').onclick = async () => {
      const go = ticked();
      $('#tidyGo').disabled = true;
      $('#tidyGo').textContent = 'Tidying…';
      let done = 0, failed = 0;
      for (const { c, fix } of go) {
        const patch = {};
        ['make', 'model', 'variant'].forEach(k => { if ((fix[k] || null) !== (c[k] || null)) patch[k] = fix[k]; });
        const { error } = await sb.from('cars').update(patch).eq('id', c.id);
        if (error) { failed++; console.warn('Tidy failed', c.id, error); continue; }
        Object.assign(c, patch);
        const row = (stats || []).find(r => String(r.car_id) === String(c.id));
        if (row) Object.assign(row, patch);
        done++;
      }
      closeSheet();
      renderStock();
      if (state.view === 'data' && stats) renderInsights();
      toast(failed ? `Tidied ${done}, ${failed} couldn’t be saved. Try again in a moment.` : `Tidied ${plural(done, 'car')}`, failed ? '' : 'ok');
    };
  }

  /** One insight, in full, with its buttons, from a Home row. */
  function insightSheet(i) {
    const f = analysis && analysis.findings[i];
    if (!f) return;
    sheet(CAUSE_DO[f.cause] || 'Worth a look', '', []);
    $('#sheetActions').innerHTML = insightCard(f, i);
    wireInsightButtons($('#sheetActions'), closeSheet);
  }

  /** The margin, this month against the same point last month, and six months of bars. */
  function homeMoney() {
    const f = marginFigures(new Date());
    const t = f.thisMonth;
    if (!f.allTime.cars.length) return '';

    let compare;
    if (!t.cars.length) compare = `Nothing sold yet this month. ${esc(f.prevName)} made ${signed(f.prevFull.total)}.`;
    else if (!f.prevToDate.counted) compare = `Nothing sold by this point in ${esc(f.prevName)}.`;
    else {
      const diff = t.total - f.prevToDate.total;
      compare = diff === 0 ? `Level with this point in ${esc(f.prevName)}.`
        : `<b class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? 'Up' : 'Down'} ${signed(Math.abs(diff))}</b> on this point in ${esc(f.prevName)}.`;
    }
    const noPrep = t.cars.filter(c => carMargin(c) != null && c.prep_cost == null);
    const missing = t.cars.filter(unmargined);
    const months = monthlyMargins(6);

    return `
      <h2 class="home-h">Money</h2>
      <div class="section-card home-money">
        <div class="hm-label">Margin in ${esc(f.thisName)} so far</div>
        <div class="hm-top"><div class="hm-figure ${t.total < 0 ? 'is-loss' : ''}">${t.counted ? signed(t.total) : '£0'}</div>${mashallah()}</div>
        <div class="hm-compare">${compare} ${t.cars.length ? `${plural(t.cars.length, 'car')} sold.` : ''}</div>
        ${missing.length || noPrep.length || t.px ? `<div class="hm-flags">
          ${missing.length ? `<span class="pill pill--amber">${missing.length} not counted, figure missing</span>` : ''}
          ${noPrep.length ? `<span class="pill pill--grey">${noPrep.length} before prep</span>` : ''}
          ${t.px ? `<span class="pill pill--blue">${t.px} part exchange${t.px === 1 ? '' : 's'}, profit on their car</span>` : ''}
        </div>` : ''}
        ${months.length > 1 ? `<div class="hm-chart">${barChart(months, { compact: true, action: 'open', height: 76 })}</div>` : ''}
        <button class="btn btn--outline btn--sm btn--block" type="button" data-go="data:money">See every sale and the charts</button>
      </div>`;
  }

  /** How much stock, what it's worth, and what's tied up in it. */
  function homeStock() {
    const live = state.cars.filter(inStock);
    const reserved = live.filter(c => c.status === 'reserved').length;
    const drafts = state.cars.filter(c => c.status === 'draft');
    const held = live.concat(drafts);
    const value = live.reduce((n, c) => n + (c.price || 0), 0);
    const costed = held.filter(c => c.purchase_price != null);
    const tied = costed.reduce((n, c) => n + c.purchase_price + (c.prep_cost || 0), 0);

    // Average days to sell, over the last three months of sales
    const recent = state.cars.filter(c => c.status === 'sold' && c.sold_at && Date.now() - new Date(c.sold_at) < 90 * DAY);
    const avgDays = recent.length ? Math.round(recent.reduce((n, c) =>
      n + Math.max(0, (new Date(c.sold_at) - listedAt(c)) / DAY), 0) / recent.length) : null;
    const month = new Date(); month.setDate(1); month.setHours(0, 0, 0, 0);
    const soldThisMonth = state.cars.filter(c => c.status === 'sold' && c.sold_at && new Date(c.sold_at) >= month).length;

    const tile = (go, value, label, sub) => `
      <button class="home-tile" type="button" data-go="${go}">
        <b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}
      </button>`;

    return `
      <h2 class="home-h">Stock ${mashallah()}</h2>
      <div class="home-tiles">
        ${tile('stock:available', nf(live.length), 'In stock',
          [reserved ? reserved + ' reserved' : null, drafts.length ? plural(drafts.length, 'draft') : null].filter(Boolean).join(' · '))}
        ${tile('stock:available', compact(value), 'Stock value', 'at asking prices')}
        ${tile('stock:available', costed.length ? compact(tied) : '£0', 'Money tied up',
          held.length - costed.length ? `${held.length - costed.length} with no cost entered` : `in ${plural(held.length, 'car')}`)}
        ${tile('stock:sold', nf(soldThisMonth), 'Sold this month', avgDays != null ? `about ${avgDays} days to sell` : '')}
      </div>`;
  }

  /** The latest few messages, unread first, each opening in full. */
  function homeMessages() {
    const all = state.enquiries.map(x => ({ k: 'e', x })).concat(state.requests.map(x => ({ k: 'r', x })))
      .sort((a, b) => (a.x.is_read - b.x.is_read) || (new Date(b.x.created_at) - new Date(a.x.created_at)));
    const rows = all.slice(0, 3).map(({ k, x }) => {
      const about = k === 'r' ? ([x.make, x.model].filter(Boolean).join(' ') || 'Car Finder request')
        : x.kind === 'car' ? (x.car_title || 'About a car')
        : x.kind === 'sell' ? (x.car_title ? 'Part exchange' : 'Wants to sell a car')
        : ((x.details && x.details.subject) || 'General enquiry');
      const text = k === 'r' ? x.notes : x.message;
      const i = homeActs.push(() => openMessage(k, x.id)) - 1;
      return `<button class="home-msg" type="button" data-home="${i}">
        <span class="enq-dot ${x.is_read ? 'is-read' : ''}"></span>
        <span class="home-msg-txt">
          <span class="home-msg-top"><strong>${esc(x.name || 'No name given')}</strong><small>${esc(ago(x.created_at))}</small></span>
          <span class="home-msg-about">${esc(about)}</span>
          ${text ? `<span class="home-msg-snip">${esc(text)}</span>` : ''}
        </span>
      </button>`;
    }).join('');

    return `
      <h2 class="home-h">Messages <button class="home-link" type="button" data-go="enq:all">See all</button></h2>
      ${rows ? `<div class="card home-msgs">${rows}</div>`
        : `<div class="card alert-none">${icon('inbox')}<span>No messages yet. Anything from the website lands here.</span></div>`}`;
  }

  /** The three cars that have been in longest: the first ones to think about. */
  function homeOldest() {
    const live = state.cars.filter(c => c.status === 'available').sort((a, b) => listedAt(a) - listedAt(b)).slice(0, 3);
    if (!live.length) return '';
    // Same bands as the Ageing tab: your own selling speed once it's known
    const speed = (analysis && analysis.speed) || { watchDays: 45, actDays: 60 };
    return `
      <h2 class="home-h">Longest in stock <button class="home-link" type="button" data-go="stock:available">All stock</button></h2>
      <div class="card home-cars">${live.map(c => {
        const imgs = Array.isArray(c.images) ? c.images : [];
        const i = homeActs.push(() => carActions(c)) - 1;
        const d = daysIn(c);
        return `<button class="home-car" type="button" data-home="${i}">
          <img src="${imgs.length ? imgUrl(imgs[0], 160) : ''}" alt="" onerror="this.style.visibility='hidden'">
          <span class="home-car-txt"><strong>${esc(carTitle(c))}</strong><small>${money(c.price)}</small></span>
          <span class="pill ${d >= speed.actDays ? 'pill--red' : d >= speed.watchDays ? 'pill--amber' : 'pill--grey'}">${d}d</span>
        </button>`;
      }).join('')}</div>`;
  }

  /* ============================================================ CARS */
  async function loadCars() {
    const list = $('#stockList');
    list.innerHTML = `<div class="card" style="height:94px" ><div class="skel" style="height:100%"></div></div>`.repeat(3);
    const { data, error } = await sb.from('cars').select('*').order('created_at', { ascending: false });
    if (error) {
      msg('#stockMsg', 'Couldn’t load your stock: ' + esc(error.message), 'err');
      list.innerHTML = ''; return;
    }
    msg('#stockMsg', '');
    state.cars = data || [];
    state.carsLoaded = true;
    renderStock();
  }

  $$('#stockTabs button').forEach(b => b.onclick = () => setStockTab(b.dataset.tab));

  function setStockTab(tab) {
    state.tab = tab;
    $$('#stockTabs button').forEach(x => x.classList.toggle('is-on', x.dataset.tab === tab));
    renderStock();
  }

  /* ---- Sorting and searching the stock list ------------------------------
     "Oldest first" on In stock is the same as "longest in stock", which is
     the one you want when deciding what to reprice. On Sold, the dates are
     when it sold rather than when it went on. */
  const listedAt = c => new Date(c.listed_at || c.created_at).getTime() || 0;
  const whenOf = c => state.tab === 'sold' && c.sold_at ? new Date(c.sold_at).getTime() : listedAt(c);
  const priceOf = c => state.tab === 'sold' && c.sale_price != null ? c.sale_price : c.price;
  /** Compare on a number, either direction; a car without one always goes last. */
  const byNum = (f, dir) => (a, b) => {
    const x = f(a), y = f(b);
    if (x == null || y == null) return (x == null) - (y == null);
    return dir * (x - y);
  };
  const makeModel = c => [c.make, c.model].filter(Boolean).join(' ');

  // Short labels: the picker sits beside the search box on a phone
  const SORTS = {
    newest:     ['Newest',        (a, b) => whenOf(b) - whenOf(a)],
    oldest:     ['Oldest',        (a, b) => whenOf(a) - whenOf(b)],
    price_high: ['Dearest',       byNum(priceOf, -1)],
    price_low:  ['Cheapest',      byNum(priceOf, 1)],
    miles_low:  ['Lowest miles',  byNum(c => c.mileage, 1)],
    mot:        ['MOT due first', byNum(motDays, 1)],
    az:         ['A to Z',        (a, b) => makeModel(a).localeCompare(makeModel(b), 'en-GB')]
  };

  function buildStockTools() {
    const sel = $('#stockSort');
    sel.innerHTML = Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}">${label}</option>`).join('');
    if (!SORTS[state.stockSort]) state.stockSort = 'newest';
    sel.value = state.stockSort;
    sel.onchange = () => { state.stockSort = sel.value; remember('mbu_stock_sort', sel.value); renderStock(); };

    const search = $('#stockSearch');
    search.addEventListener('input', () => { state.stockQuery = search.value; renderStock(); });
    $('#stockMotChip').onclick = () => {
      state.stockMot = !state.stockMot;
      $('#stockMotChip').setAttribute('aria-pressed', String(state.stockMot));
      if (state.stockMot) { state.stockSort = 'mot'; sel.value = 'mot'; }
      renderStock();
    };
    // The car form's MOT box: look the date up from the plate typed above it
    $('#fMotGov').onclick = () => {
      const plate = cleanPlate($('#fReg').value);
      if (plate.length < 2) return toast('Type the number plate first');
      window.open(govMot(plate), '_blank', 'noopener');
    };
  }

  /** Everything you might type to find a car: make, model, trim, plate, year, colour. */
  function matchesQuery(c, q) {
    if (!q) return true;
    // Accents and spelling ignored: "citroen" finds Citroën, "merc" and "vw" work
    const fold = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const hay = fold([c.make, MK.makeName(c.make), c.model, c.variant, c.year, c.colour, c.registration,
      LABEL.fuel[c.fuel], LABEL.transmission[c.transmission]]
      .filter(Boolean).join(' '));
    const plate = String(c.registration || '').toLowerCase();
    return fold(q).split(/\s+/).filter(Boolean).every(w =>
      hay.includes(w) || plate.includes(w) || (MK.knownMake(w) && keyOf(w) === keyOf(c.make)));
  }

  /* ---- MOT ---------------------------------------------------------------
     Amber from three months out, red from one month or once it has run out.
     Only for cars you still have: once it's sold the MOT is the buyer's. */
  const MOT_AMBER_DAYS = 90, MOT_RED_DAYS = 30;

  function motDays(c) {
    if (!c.mot_expiry) return null;
    const d = new Date(String(c.mot_expiry).slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / DAY);
  }

  function motLevel(c) {
    if (c.status === 'sold') return null;
    const d = motDays(c);
    return d == null ? null : d < MOT_RED_DAYS ? 'red' : d < MOT_AMBER_DAYS ? 'amber' : null;
  }

  function motWords(c) {
    const d = motDays(c);
    return d == null ? 'No MOT date' : d < 0 ? `MOT ran out ${plural(-d, 'day')} ago`
      : d === 0 ? 'MOT runs out today' : `MOT runs out in ${plural(d, 'day')}`;
  }

  const plural = (n, one, many) => `${nf(n)} ${n === 1 ? one : (many || one + 's')}`;
  const daysIn = c => Math.max(0, Math.round((Date.now() - listedAt(c)) / DAY));

  function renderStock() {
    const list = $('#stockList');
    const byTab = {
      available: state.cars.filter(inStock),
      sold: state.cars.filter(c => c.status === 'sold'),
      draft: state.cars.filter(c => c.status === 'draft')
    };
    $('#nAvailable').textContent = byTab.available.length || '';
    $('#nSold').textContent = byTab.sold.length || '';
    $('#nDraft').textContent = byTab.draft.length || '';

    const all = byTab[state.tab];
    const q = state.stockQuery.trim();
    // "MOT due": run out, due within 90 days, or no date, on cars you still own
    const motDue = c => c.status !== 'sold' && (!!motLevel(c) || !c.mot_expiry);
    const dueN = all.filter(motDue).length;
    if (state.tab === 'sold' || !dueN) state.stockMot = false;
    const chip = $('#stockMotChip');
    chip.hidden = state.tab === 'sold' || !dueN;
    chip.classList.toggle('is-on', state.stockMot);
    chip.innerHTML = `${icon('calendar')} MOT due <b>${dueN}</b>`;
    const cars = all.filter(c => matchesQuery(c, q) && (!state.stockMot || motDue(c))).sort(SORTS[state.stockSort][1]);

    // One line saying what you're looking at, and on In stock what it's worth
    const priced = cars.filter(c => c.price != null);
    const worth = state.tab === 'available' && priced.length
      ? ` · ${money(priced.reduce((n, c) => n + c.price, 0))} at asking` : '';
    const summary = !all.length ? ''
      : state.stockMot ? `${plural(cars.length, 'car')} with an MOT to see to (run out, due in 90 days, or no date)`
      : q ? `${cars.length} of ${all.length} match “${q}”${worth}`
      : `${plural(all.length, state.tab === 'sold' ? 'car sold' : state.tab === 'draft' ? 'draft' : 'car', state.tab === 'sold' ? 'cars sold' : undefined)}${worth}`;
    // Mashallah beside what the stock is worth, as it is beside the money on Home
    const box = $('#stockSummary');
    box.innerHTML = summary ? `<span>${esc(summary)}</span>${worth && !state.stockMot ? mashallah() : ''}` : '';
    wireMashallah(box);

    if (state.view === 'home') renderHome();

    if (!all.length) {
      const copy = {
        available: ['Nothing in stock yet', 'Tap “Add a car” to put your first one on the website.'],
        sold: ['No sold cars yet', 'When you mark a car sold it’ll appear here.'],
        draft: ['No drafts', 'Drafts are cars you’ve started but not published. They’re not on the website.']
      }[state.tab];
      list.innerHTML = `<div class="empty">${icon('car')}<h3>${copy[0]}</h3><p>${copy[1]}</p></div>`;
      return;
    }
    if (!cars.length) {
      list.innerHTML = `<div class="empty">${icon('search')}<h3>Nothing matches</h3>
        <p>Try the make, the model or part of the plate.</p></div>`;
      return;
    }

    list.innerHTML = cars.map(c => {
      const imgs = Array.isArray(c.images) ? c.images : [];
      const sold = c.status === 'sold';
      const meta = [
        sold && c.sold_at ? 'Sold ' + shortDay(c.sold_at) : null,
        !sold && c.status !== 'draft' ? plural(daysIn(c), 'day') + ' in stock' : null,
        c.mileage != null ? Number(c.mileage).toLocaleString('en-GB') + ' mi' : null,
        !sold ? (imgs.length ? imgs.length + ' photo' + (imgs.length === 1 ? '' : 's') : 'No photos') : null,
        sold ? null : c.transmission && LABEL.transmission[c.transmission]
      ].filter(Boolean).join(' · ');

      const pill =
        c.status === 'reserved' ? '<span class="pill pill--amber">Reserved</span>' :
        c.status === 'draft' ? '<span class="pill pill--grey">Draft</span>' :
        sold ? '' :
        !imgs.length ? '<span class="pill pill--red">Needs photos</span>' :
        c.featured ? '<span class="pill pill--blue">Featured</span>' : '';

      const mot = motLevel(c);
      const motPill = mot ? `<button type="button" class="pill pill--${mot} pill-btn" data-motpill="${esc(c.id)}">${icon('calendar')}${
        motDays(c) < 0 ? 'MOT ran out' : 'MOT ' + shortDay(c.mot_expiry)}</button>`
        : state.stockMot && !c.mot_expiry && !sold ? `<button type="button" class="pill pill--grey pill-btn" data-motpill="${esc(c.id)}">${icon('calendar')}No MOT date</button>` : '';

      // On a sold car the useful number is what you made, and whether it's complete
      const mg = sold ? carMargin(c) : null;
      const price = sold
        ? (mg != null ? `<span class="stock-price ${mg < 0 ? 'is-loss' : ''}">${signed(mg)}</span><span class="stock-price-note">margin</span>`
           : carried(c) ? '<span class="stock-price is-px">Part exchange</span><span class="stock-price-note">profit on their car</span>'
           : '<span class="stock-price is-missing">Figures missing</span>')
        : `<span class="stock-price">${money(c.price)}</span>`;
      const soldPill = sold && mg != null && c.prep_cost == null ? '<span class="pill pill--grey">No prep entered</span>' : '';
      // Taken in part exchange (its margin is the profit on both cars), or sold
      // in one where the cash already made a profit; a carried one says so above
      const pxPill = c.px_from || (c.px_sale && mg != null) ? '<span class="pill pill--blue">Part ex</span>' : '';

      const atPill = (c.at_published && !sold)
        ? '<span class="pill pill--accent" style="background:var(--accent-100);color:var(--accent-600)">AT</span>' : '';

      return `
      <div class="card"><div class="stock-row" data-id="${esc(c.id)}">
        ${imgs.length ? `<img class="stock-thumb" src="${imgUrl(imgs[0], 240)}" alt=""
             onerror="this.style.visibility='hidden'">`
          : `<span class="stock-thumb stock-thumb--none">${icon('camera')}</span>`}
        <div class="stock-info">
          <h3>${esc(carTitle(c))}</h3>
          <div class="stock-meta">${esc(meta)}</div>
          <div class="stock-line">
            ${price}
            ${pill}${motPill}${soldPill}${pxPill}${atPill}
          </div>
        </div>
        <span class="stock-chev">${icon('right')}</span>
      </div></div>`;
    }).join('');

    $$('#stockList .stock-row').forEach(row => {
      row.onclick = () => carActions(state.cars.find(c => String(c.id) === row.dataset.id));
    });
    $$('#stockList [data-motpill]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const car = carById(b.dataset.motpill);
      if (car) motSheet(car);
    });
  }

  function carActions(car) {
    if (!car) return;
    const title = [car.year, car.make, car.model].filter(Boolean).join(' ') || 'This car';
    const acts = [];

    // On a sold car the money is the thing you come back to fix, so it goes first
    if (car.status === 'sold') {
      const mg = carMargin(car);
      acts.push({ label: 'Edit the figures', icon: 'pound',
        sub: carried(car) ? 'Part exchange: the profit shows when their car sells'
           : mg == null ? 'A figure is missing, so it isn’t in your margin'
           : car.prep_cost == null ? `Margin ${signed(mg)}, but no prep cost entered yet`
           : `Margin ${signed(mg)}. Paid, prep and what it sold for`,
        run: () => figuresSheet(car) });
      if (car.px_sale) {
        const theirs = pxCarOf(car);
        acts.push(theirs
          ? { label: 'Their car: ' + carTitle(theirs), icon: 'car',
              sub: 'Taken in part exchange' + (theirs.purchase_price != null ? ` at ${money(theirs.purchase_price)}` : ''),
              run: () => carActions(theirs) }
          : { label: 'Add their car', icon: 'car',
              sub: pxCarried(car) != null ? `Goes in at ${money(pxCarried(car))}, worked out from this sale`
                                          : 'What it cost you is worked out from this sale',
              run: () => addPxCar(car) });
      }
    }
    const pxFrom = pxSaleOf(car);
    if (pxFrom) {
      acts.push({ label: 'Part exchange on the ' + carTitle(pxFrom), icon: 'car',
        sub: 'Its cost is what that car cost you minus the cash, so its margin covers both',
        run: () => carActions(pxFrom) });
    }
    acts.push({ label: 'Edit details', icon: 'edit', run: () => openForm(car) });
    if (car.status !== 'sold') {
      acts.push({ label: car.mot_expiry ? motWords(car) : 'MOT: no date yet', icon: 'calendar',
        sub: car.mot_expiry ? `${longDate(motDate(car))}. Change it, or it’s passed` : 'Put the date in, or look it up on GOV.UK',
        run: () => motSheet(car) });
    }
    if (car.status !== 'draft') {
      acts.push({ label: 'Its figures', icon: 'gauge', sub: 'Views, taps and messages, and how it compares',
        run: () => openCarFigures(car.id) });
    }
    if (car.status !== 'sold') {
      acts.push({ label: 'What it cost you', icon: 'pound',
        sub: car.purchase_price == null ? 'Nothing entered yet' : `Paid ${money(car.purchase_price)}${car.prep_cost != null ? ' + ' + money(car.prep_cost) + ' prep' : ', no prep entered'}`,
        run: () => figuresSheet(car) });
    }

    if (car.status !== 'draft') {
      const made = invoicesForCar(car);
      acts.push({ label: 'Make an invoice', icon: 'receipt',
        sub: made.length ? `${made.length} made for this car already (${made.map(r => INV.numberLabel(r.number)).join(', ')})` : car.status === 'reserved' ? 'A deposit receipt, or any other kind' : 'For a sale, a deposit or pay monthly',
        run: () => made.length ? sheet('Invoices for this car', carTitle(car), [
            { label: 'A new one', icon: 'plus', run: () => invoiceForCar(car) },
            ...made.map(r => ({ label: `${INV.numberLabel(r.number)} · ${r.customer_name || 'No name'}`, icon: 'receipt',
              sub: `${(INV.KINDS[r.kind] || {}).label || ''} · ${INV.gbp(r.total)}`, run: () => invoiceActions(fromRow(r)) }))
          ]) : invoiceForCar(car) });
      acts.push({ label: 'Listing pack', icon: 'copy',
        sub: 'Ready-to-paste adverts for Facebook, Gumtree, Instagram',
        run: () => showListingPack(car) });
    }

    if (car.status === 'available' || car.status === 'reserved') {
      acts.push({ label: 'Check the market price', icon: 'search',
        sub: AT && AT.isEnabled() ? 'Asks Auto Trader where your price sits'
                                  : 'See what similar cars are up for and record it',
        run: () => checkMarket(car) });

      const a = advertAllowance();
      const atOn = !!car.at_published;
      acts.push({
        label: atOn ? 'Take off Auto Trader' : 'Put on Auto Trader',
        icon: 'star',
        sub: atOn ? `${a.used} of ${a.limit} adverts used`
                  : a.remaining > 0 ? `${a.remaining} of ${a.limit} advert slots free`
                  : `All ${a.limit} advert slots are in use`,
        run: () => toggleAutoTrader(car)
      });
    }

    if (car.status === 'available') {
      acts.push({ label: 'Mark as sold', icon: 'sold',
        sub: 'Moves it to Recently Sold with the price hidden',
        run: () => setStatus(car, 'sold') });
      acts.push({ label: 'Mark as reserved', icon: 'pause',
        sub: 'Stays visible with a Reserved badge',
        run: () => setStatus(car, 'reserved') });
      acts.push({ label: car.featured ? 'Remove from featured' : 'Feature on the homepage', icon: 'star',
        run: () => toggleFeatured(car) });
    } else if (car.status === 'reserved') {
      acts.push({ label: 'Mark as sold', icon: 'sold', run: () => setStatus(car, 'sold') });
      acts.push({ label: 'Back to available', icon: 'car', run: () => setStatus(car, 'available') });
    } else if (car.status === 'sold') {
      acts.push({ label: 'Put back in stock', icon: 'car', run: () => setStatus(car, 'available') });
    } else {
      acts.push({ label: 'Publish to the website', icon: 'check', run: () => setStatus(car, 'available') });
    }

    if (car.status !== 'draft') {
      acts.push({ label: 'View on the website', icon: 'eye',
        run: () => window.open(`../car?id=${encodeURIComponent(car.id)}&staff=auto`, '_blank') });
    }
    acts.push({ label: 'Delete this car', icon: 'trash', danger: true,
      sub: 'Permanent. No undo.',
      run: () => confirmSheet('Delete this car?',
        `${title} will be removed from the website and your list for good.`,
        'Yes, delete it', () => removeCar(car), true) });

    sheet(title, car.registration ? fmtReg(car.registration) : '', acts);
  }

  async function setStatus(car, status, extra) {
    // Marking sold asks for the figures first: it's the one moment you'll
    // reliably remember what it went for. The sheet calls back here with them.
    if (status === 'sold' && !extra) return figuresSheet(car, { markSold: true });

    const patch = Object.assign({ status, updated_at: new Date().toISOString() }, extra || {});
    if (status === 'sold' && !patch.sold_at) patch.sold_at = new Date().toISOString();
    if (status === 'available' && car.status === 'sold') {
      patch.sold_at = null;
      if (car.px_sale) Object.assign(patch, { px_sale: false, px_cash: null });   // back in stock, so not sold in a part exchange either
    }

    const { error } = await sb.from('cars').update(patch).eq('id', car.id);
    if (error) return toast('Couldn’t update: ' + error.message);
    Object.assign(car, patch);
    syncStats(car);
    renderStock();
    toast(status === 'sold' ? 'Marked as sold' : status === 'reserved' ? 'Marked as reserved'
          : status === 'available' ? 'Now live on the website' : 'Updated', 'ok');
  }

  /* ---- The money on one car ----------------------------------------------
     What you paid, what the prep came to, and on a sold car what it went
     for, with the margin worked out as you type. Also the "Mark as sold"
     screen, so the figures go in at the moment you know them.

     A blank prep box means "not entered yet", not £0. The margin still
     counts it as £0 (so a sale isn't left out for want of it), but it is
     flagged on Home and in the lists until somebody fills it in or taps
     "No prep on this one". */
  function figuresSheet(car, opts) {
    opts = opts || {};
    const markSold = !!opts.markSold;
    const sold = markSold || car.status === 'sold';
    const title = carTitle(car);
    const from = pxSaleOf(car);          // this car came in part exchange
    let px = opts.pxCash != null || !!car.px_sale;   // this car went out in one (an invoice can say so)

    sheet(markSold ? 'Mark as sold' : 'Your figures', title + ' · never shown on the website', []);
    const saleStart = opts.sale != null ? opts.sale : car.sale_price != null ? car.sale_price : markSold && car.price != null ? car.price : '';
    $('#sheetActions').innerHTML = `
      <div class="card figs">
        ${from ? `<p class="figs-px-note">Taken in part exchange on the ${esc(carTitle(from))}. What you paid is
          what that car cost you minus the cash they paid, so this car’s margin is the profit on both.</p>` : ''}
        ${sold ? `
        <div class="f">
          <label for="fgSale">What it sold for</label>
          <div class="money"><input class="in" id="fgSale" type="number" inputmode="numeric" placeholder="0" value="${esc(saleStart)}"></div>
          <span class="hint" id="fgSaleHint"></span>
        </div>
        <button class="chip figs-px" type="button" id="fgPx" aria-pressed="false">Sold with a part exchange</button>
        <div class="figs-px-box" id="fgPxBox" hidden>
          <div class="f">
            <label for="fgCash">Cash they paid on top of their car</label>
            <div class="money"><input class="in" id="fgCash" type="number" inputmode="numeric" placeholder="0" value="${esc(opts.pxCash ?? car.px_cash ?? '')}"></div>
            <span class="hint">Their car goes in at what this one cost you minus this, so the profit shows when it sells.</span>
          </div>
        </div>
        <p class="hint" id="fgPxNote" hidden></p>` : ''}
        <div class="row-2">
          <div class="f">
            <label for="fgPaid">What you paid</label>
            <div class="money"><input class="in" id="fgPaid" type="number" inputmode="numeric" placeholder="0" value="${esc(car.purchase_price ?? '')}"></div>
          </div>
          <div class="f">
            <label for="fgPrep">Prep costs</label>
            <div class="money"><input class="in" id="fgPrep" type="number" inputmode="numeric" placeholder="?" value="${esc(car.prep_cost ?? '')}"></div>
          </div>
        </div>
        <button class="chip figs-noprep" type="button" id="fgNoPrep">No prep on this one (£0)</button>
        <div class="moneyline" id="fgSummary"></div>
        <button class="btn btn--accent btn--block" id="fgSave" style="margin-top:16px">
          ${markSold ? 'Mark as sold' : 'Save the figures'}
        </button>
        ${markSold ? '<p class="hint" style="margin-top:10px;text-align:center">Don’t know them all yet? Leave any box blank and fill it in later.</p>' : ''}
      </div>`;

    const val = sel => { const el = $(sel); return el && el.value.trim() !== '' ? int(el.value) : null; };
    /** The car as it would be saved, for the part exchange sums. */
    const draft = () => Object.assign({}, car, {
      purchase_price: val('#fgPaid'), prep_cost: val('#fgPrep'),
      sale_price: sold ? val('#fgSale') : car.sale_price, px_sale: px, px_cash: px ? val('#fgCash') : null });

    const saleHint = () => {
      const h = $('#fgSaleHint');
      if (!h) return;
      h.textContent = px ? 'The deal price: their cash plus what you allowed for their car. Not used for the margin.'
        : markSold && car.price != null ? `Starts at the advertised price (${money(car.price)}). If it went for less, or more, change it.` : '';
    };

    const summary = () => {
      const paid = val('#fgPaid'), prep = val('#fgPrep');
      const against = sold ? val('#fgSale') : car.price;
      $('#fgNoPrep').classList.toggle('is-on', prep === 0);
      if (paid == null) {
        $('#fgSummary').innerHTML = `<div class="ml-note">Put in what you paid and the ${px ? 'part exchange' : 'margin'} works itself out.</div>`;
        return;
      }
      const inCar = paid + (prep || 0);
      const noPrepNote = prep == null ? `<div class="ml-note">No prep entered, so this is before prep. Tap “No prep on this one” if there wasn’t any.</div>` : '';

      if (px) {
        const d = draft();
        const cash = d.px_cash;
        const allowed = cash != null && d.sale_price != null && d.sale_price > cash ? d.sale_price - cash : null;
        const rows = [`<div class="ml ml--total"><span>Total in this car</span><b>${money(inCar)}</b></div>`];
        if (cash == null) {
          rows.push(`<div class="ml-note">Put in the cash they paid and the app works out what their car goes in at.</div>`);
        } else {
          rows.push(`<div class="ml"><span>Cash they paid</span><b>${money(cash)}</b></div>`);
          const now = pxMadeNow(d);
          if (now > 0) rows.push(`<div class="ml ml--good"><span>Margin made today</span><b>${signed(now)}</b></div>`);
          rows.push(`<div class="ml ml--px"><span>Their car goes in at</span><b>${money(pxCarried(d))}</b></div>`);
          rows.push(`<div class="ml-note">${now > 0
            ? `The cash covered what this one cost you, so ${money(now)} is profit already and counts this month. Whatever their car sells for is profit too.`
            : 'No margin on this one. The profit on the whole deal shows when their car sells.'}${
            allowed != null ? ` You allowed ${money(allowed)} for their car.` : ''}</div>`);
        }
        $('#fgSummary').innerHTML = rows.join('') + noPrepNote;
        return;
      }

      const mg = against != null ? against - inCar : null;
      $('#fgSummary').innerHTML =
        `<div class="ml ml--total"><span>Total in the car</span><b>${money(inCar)}</b></div>` +
        (mg == null ? '' : `<div class="ml ${mg >= 0 ? 'ml--good' : 'ml--bad'}">
          <span>${sold ? (mg >= 0 ? 'Margin on the sale' : 'Lost on the sale') : (mg >= 0 ? 'Margin at asking price' : 'Short by')}</span>
          <b>${signed(mg)}</b></div>`) +
        (from && sold && mg != null ? `<div class="ml-note">That’s the profit on both cars, this one and the ${esc(carTitle(from))}.</div>` : '') +
        noPrepNote;
    };

    const setPx = on => {
      px = on;
      const chip = $('#fgPx');
      if (!chip) return;
      chip.classList.toggle('is-on', on);
      chip.setAttribute('aria-pressed', String(on));
      $('#fgPxBox').hidden = !on;
      saleHint();
      summary();
    };

    ['#fgSale', '#fgPaid', '#fgPrep', '#fgCash'].forEach(s => { const el = $(s); if (el) el.addEventListener('input', summary); });
    $('#fgNoPrep').onclick = () => { $('#fgPrep').value = '0'; summary(); };
    if ($('#fgPx')) {
      $('#fgPx').onclick = () => {
        if (!px && !pxReady()) {
          const note = $('#fgPxNote');
          note.hidden = false;
          note.innerHTML = 'Part exchange needs a one-off database update first: run <strong>schema-v8-part-exchange.sql</strong> (Settings, the gear at the top right → Ready to switch on).';
          return;
        }
        setPx(!px);
        if (px) $('#fgCash').focus();
      };
    }
    setPx(px);

    $('#fgSave').onclick = async () => {
      const before = Object.assign({}, car);
      const patch = { purchase_price: val('#fgPaid'), prep_cost: val('#fgPrep') };
      if (sold) patch.sale_price = val('#fgSale');
      // Only sent once the columns exist, so saving never breaks without v8
      if (sold && (px || car.px_sale) && pxReady()) Object.assign(patch, { px_sale: px, px_cash: px ? val('#fgCash') : null });
      const btn = $('#fgSave');
      btn.disabled = true;

      if (markSold) {
        closeSheet();
        if (opts.soldAt) patch.sold_at = new Date(String(opts.soldAt).slice(0, 10) + 'T12:00:00').toISOString();   // the invoice's sale date
        await setStatus(car, 'sold', patch);
        if (car.status !== 'sold') return;             // didn't save; setStatus has said why
        if (car.px_sale && !pxCarOf(car)) return addPxCar(car);
        if (opts.after) opts.after();
        else setTimeout(() => offerInvoice(car), 350);
        return;
      }
      const { error } = await sb.from('cars').update(patch).eq('id', car.id);
      btn.disabled = false;
      if (error) return toast('Couldn’t save: ' + error.message);
      closeSheet();
      Object.assign(car, patch);
      syncStats(car);
      const followed = await followPx(before, car);
      renderStock();
      if (state.view === 'data' && stats) renderInsights();
      toast(followed || 'Figures saved', 'ok');
      if (opts.after) opts.after();
    };
  }

  /**
   * Their car went in at this sale's cost minus the cash. If those figures
   * change afterwards, their car's cost follows, as long as nobody has typed
   * a different figure into it since.
   * @returns {Promise<string|null>} what to tell you, if anything changed
   */
  async function followPx(before, car) {
    const theirs = car.px_sale && pxCarOf(car);
    if (!theirs) return null;
    const was = pxCarried(before), now = pxCarried(car);
    if (now == null || now === was || theirs.purchase_price !== was) return null;
    const { error } = await sb.from('cars').update({ purchase_price: now }).eq('id', theirs.id);
    if (error) return 'Saved. Their car’s cost couldn’t be updated: ' + error.message;
    theirs.purchase_price = now;
    syncStats(theirs);
    return `Saved. Their car now goes in at ${money(now)}`;
  }

  /**
   * Put the car taken in part exchange into stock: Quick add, with what you
   * paid worked out from the sale and the two cars linked.
   */
  function addPxCar(sale) {
    openQuick();
    state.pxFrom = sale;
    const carriedAt = pxCarried(sale);
    if (carriedAt != null) $('#qPaid').value = carriedAt;
    $('#qNotes').value = `Part exchange on the ${carTitle(sale)}${sale.registration ? ' (' + fmtReg(sale.registration) + ')' : ''}, sold ${
      sale.sold_at ? shortDay(sale.sold_at) : 'today'}.`;
    const madeNow = pxMadeNow(sale);
    msg('#quickMsg', `<strong>Their car, taken in part exchange.</strong> ${carriedAt == null
      ? `Put in what it cost you: what the ${esc(carTitle(sale))} cost minus the cash they paid. When it sells, its margin is the profit on both cars.`
      : madeNow > 0
      ? `The ${money(sale.px_cash)} cash more than covered the ${money(costOf(sale))} in the ${esc(carTitle(sale))}, so ${money(madeNow)} is
         already counted as profit and this goes in at <strong>£0</strong>. Whatever it sells for is profit too.`
      : `What you paid is worked out for you: ${money(costOf(sale))} in the ${esc(carTitle(sale))} minus ${money(sale.px_cash)} cash =
         <strong>${money(carriedAt)}</strong>. When it sells, its margin is the profit on both cars.`}`, 'info');
    renderQuickSummary();
  }

  /** Keep the Insights copy of a car's figures in step without a reload. */
  function syncStats(car) {
    const row = (stats || []).find(s => String(s.car_id) === String(car.id));
    if (!row) return;
    ['status', 'price', 'sold_at', 'purchase_price', 'prep_cost', 'sale_price'].forEach(k => { row[k] = car[k]; });
    row.margin = carMargin(car);
    row.px = carried(car);
  }

  /* ---- Auto Trader advert slots ------------------------------------------
     The package allows a fixed number of live adverts (8 on the current plan).
     This tracks which cars you've chosen for those slots. Once API access is
     switched on, the same flag drives the actual sync (see ROADMAP.md §4). */
  function advertAllowance() {
    const limit = (CFG.autotrader && CFG.autotrader.maxAdverts) || 8;
    const used = state.cars.filter(c => c.at_published && c.status !== 'sold').length;
    return { used, limit, remaining: Math.max(0, limit - used) };
  }

  async function toggleAutoTrader(car) {
    const a = advertAllowance();

    if (!car.at_published && a.remaining <= 0) {
      const listed = state.cars
        .filter(c => c.at_published && c.status !== 'sold')
        .map(c => [c.year, c.make, c.model].filter(Boolean).join(' '));
      sheet('All advert slots are full',
        `Your package allows ${a.limit} adverts at a time. Take one of these off first:`,
        listed.slice(0, 8).map(name => ({ label: name, icon: 'car', run: () => {} }))
          .concat([{ label: 'Cancel', icon: 'close', run: () => {} }]));
      return;
    }

    const next = !car.at_published;
    const { error } = await sb.from('cars')
      .update({ at_published: next, at_lifecycle_state: next ? 'FORECOURT' : null })
      .eq('id', car.id);
    if (error) return toast('Couldn’t update: ' + error.message);

    car.at_published = next;
    renderStock();

    const after = advertAllowance();
    toast(next
      ? `Marked for Auto Trader (${after.used}/${after.limit} slots used)`
      : `Taken off Auto Trader (${after.remaining} slots free)`, 'ok');

    // Once stock sync is built this is where the advert actually goes live.
    // Separate from the read-only connection, so switching that on can't
    // start changing live adverts.
    if (AT && AT.syncEnabled()) {
      AT.syncStock(car, { publish: next }).catch(err => {
        console.warn('Auto Trader sync failed', err);
        toast('Saved here, but the Auto Trader sync failed');
      });
    }
  }

  async function toggleFeatured(car) {
    const { error } = await sb.from('cars').update({ featured: !car.featured }).eq('id', car.id);
    if (error) return toast('Couldn’t update');
    car.featured = !car.featured;
    renderStock();
    toast(car.featured ? 'Featured on the homepage' : 'Removed from featured', 'ok');
  }

  async function removeCar(car) {
    const { error } = await sb.from('cars').delete().eq('id', car.id);
    if (error) return toast('Couldn’t delete: ' + error.message);
    state.cars = state.cars.filter(c => c.id !== car.id);
    renderStock();
    toast('Car deleted', 'ok');
  }

  /* ============================================================= FORM */
  function buildFormControls() {
    chipGroup('#fFuel', FUELS, 'fuel');
    chipGroup('#fTrans', TRANS, 'transmission');
    chipGroup('#fBody', BODIES, 'body_type');
    renderFeatures();

    $('#fHpi').onchange = () => {
      $('#condWrap').hidden = $('#fHpi').value === 'clear';
    };
    $$('#formView input, #formView textarea, #formView select').forEach(el => {
      el.addEventListener('input', () => { state.dirty = true; });
    });

    refreshFormModels = wirePickerPair('#fMake', '#fMakeOther', '#fModel', '#fModelOther');
    $('#fColour').addEventListener('change', () => syncOther('#fColour', '#fColourOther'));

    // Running total under the private figures, updated as you type
    ['#fPurchase', '#fPrep', '#fPrice', '#fSale'].forEach(sel =>
      $(sel).addEventListener('input', renderCostSummary));

    const reg = $('#fReg');
    reg.addEventListener('input', () => { reg.value = reg.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''); });
    $('#lookupBtn').onclick = dvlaLookup;
    $('#draftDescBtn').onclick = draftDescription;
    $('#addFeatureBtn').onclick = addCustomFeature;
    $('#photoInput').onchange = e => handleFiles(Array.from(e.target.files));
    $('#videoInput').onchange = e => handleVideo(e.target.files[0]);
    $('#addFab').onclick = () => openQuick();
    $('#saveDraftBtn').onclick = () => save('draft');
    $('#publishBtn').onclick = () => save('available');

    buildQuickControls();
  }

  /** Set by buildFormControls so other code can rebuild the model list. */
  let refreshFormModels = () => {};

  /**
   * The bit that matters: what the car has cost so far, and what is left in
   * it at the asking price. Shown live under the private figures.
   */
  function renderCostSummary() {
    const box  = $('#costSummary');
    const paid = int($('#fPurchase').value) || 0;
    const prep = int($('#fPrep').value) || 0;
    const ask  = int($('#fPrice').value) || 0;
    // On a sold car, what it actually went for beats what it was advertised at
    const sold = !$('#fSaleWrap').hidden ? int($('#fSale').value) : null;
    const inCar = paid + prep;

    if (!inCar) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;

    const against = sold != null ? sold : ask;
    const margin = against ? against - inCar : null;
    box.innerHTML =
      `<div class="ml ml--total"><span>Total in the car</span><b>${money(inCar)}</b></div>` +
      (margin === null
        ? '<div class="ml-note">Put an asking price in and this will show what is left in it.</div>'
        : `<div class="ml ${margin >= 0 ? 'ml--good' : 'ml--bad'}">
             <span>${margin >= 0 ? (sold != null ? 'Margin on the sale' : 'Margin at asking price') : (sold != null ? 'Lost on the sale' : 'Short by')}</span>
             <b>${money(Math.abs(margin))}</b>
           </div>`);
  }

  /* ========================================================== QUICK ADD
     The auction screen. Everything here is about money: what the car cost,
     what putting it right will cost, and whether there is anything left in
     it. It saves as a draft, so whoever writes the listing up later picks it
     out of the Drafts tab and fills in the rest.
     ==================================================================== */
  let refreshQuickModels = () => {};

  function buildQuickControls() {
    refreshQuickModels = wirePickerPair('#qMake', '#qMakeOther', '#qModel', '#qModelOther');

    const reg = $('#qReg');
    reg.addEventListener('input', () => { reg.value = reg.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ''); });

    ['#qPaid', '#qPrep', '#qTarget'].forEach(sel =>
      $(sel).addEventListener('input', renderQuickSummary));
    $$('#quickView input, #quickView textarea, #quickView select').forEach(el =>
      el.addEventListener('input', () => { state.dirty = true; }));

    $('#qLookup').onclick = quickLookup;
    $('#quickSaveBtn').onclick = () => saveQuick(false);
    $('#quickFullBtn').onclick = () => saveQuick(true);
  }

  function openQuick() {
    state.editing = null;
    state.pxFrom = null;      // addPxCar sets it straight after, for a part exchange
    state.dirty = false;
    ['#qReg', '#qYear', '#qPaid', '#qPrep', '#qTarget', '#qNotes'].forEach(sel => { $(sel).value = ''; });
    fillPicker('#qMake', '#qMakeOther', knownMakes(), 'Choose…');
    fillPicker('#qModel', '#qModelOther', knownModels(''), 'Choose…');
    $('#qHint').textContent = 'Type the plate and tap Look up, or just fill the two boxes below.';
    msg('#quickMsg', '');
    renderQuickSummary();
    go('quick');
    $('#qReg').focus();
  }

  function renderQuickSummary() {
    const paid   = int($('#qPaid').value) || 0;
    const prep   = int($('#qPrep').value) || 0;
    const target = int($('#qTarget').value) || 0;
    const inCar  = paid + prep;
    const box    = $('#quickSummary');

    if (!inCar && !target) {
      box.innerHTML = '<div class="ml-note">Put the figures in and the total works itself out.</div>';
      return;
    }

    const rows = [`<div class="ml ml--total"><span>Total in the car</span><b>${money(inCar)}</b></div>`];

    if (target) {
      const margin = target - inCar;
      const pct = inCar ? Math.round((margin / inCar) * 100) : 0;
      rows.push(`<div class="ml ${margin >= 0 ? 'ml--good' : 'ml--bad'}">
          <span>${margin >= 0 ? 'Profit if it makes that' : 'You would lose'}</span>
          <b>${money(Math.abs(margin))}</b>
        </div>`);
      if (inCar) {
        rows.push(`<div class="ml-note">${margin >= 0
          ? `That is ${pct}% on what you have got in it.`
          : 'There is nothing in this one at that price.'}</div>`);
      }
    } else if (inCar) {
      rows.push('<div class="ml-note">Add what you reckon it sells for to see the profit.</div>');
    }

    box.innerHTML = rows.join('');
  }

  /** Same lookup as the full form, pointed at the quick add fields. */
  async function quickLookup() {
    const plate = $('#qReg').value.replace(/\s+/g, '').toUpperCase();
    const hint = $('#qHint');
    if (plate.length < 2) return void (hint.textContent = 'Type the number plate first.');

    const btn = $('#qLookup');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Looking…';
    hint.textContent = 'Checking the DVLA…';

    try {
      const d = await vehicleLookup(plate);
      const make = d.make;
      const year = d.year ?? d.yearOfManufacture;
      if (make) { setPicker('#qMake', '#qMakeOther', canonicalMake(make)); refreshQuickModels(); }
      if (d.model) setPicker('#qModel', '#qModelOther', canonicalModel(make, d.model));
      if (year) $('#qYear').value = year;
      state.dirty = true;
      hint.innerHTML = make
        ? '<strong style="color:var(--green-600)">Found it.</strong> Check it looks right, then put the money in.'
        : 'Nothing came back for that plate. Fill the boxes in yourself.';
    } catch (err) {
      hint.textContent = 'Couldn’t look that up. Fill the boxes in yourself, it all still works.';
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  /**
   * Save the quick add as a draft.
   * @param {boolean} thenEdit  open the full form on it straight afterwards
   */
  async function saveQuick(thenEdit) {
    const make  = pickerValue('#qMake', '#qMakeOther');
    const model = pickerValue('#qModel', '#qModelOther');
    const plate = $('#qReg').value.replace(/\s+/g, '');

    if (!plate && !make) {
      return msg('#quickMsg', 'Give it a number plate or a make, so you can find it again.', 'warn');
    }

    const target = int($('#qTarget').value);
    const record = {
      status: 'draft',
      registration: plate || null,
      make: canonicalMake(make) || null,
      model: canonicalModel(make, model) || null,
      year: int($('#qYear').value),
      purchase_price: int($('#qPaid').value),
      prep_cost: int($('#qPrep').value),
      // What you reckon it sells for becomes the starting asking price. It is
      // a draft, so nobody sees it until somebody publishes it.
      price: target,
      private_notes: $('#qNotes').value.trim() || null,
      updated_at: new Date().toISOString()
    };
    // Taken in part exchange: linked to the sale it came in on
    const pxFrom = state.pxFrom;
    if (pxFrom) record.px_from = pxFrom.id;

    const btns = [$('#quickSaveBtn'), $('#quickFullBtn')];
    const labels = btns.map(b => b.textContent);
    btns.forEach(b => { b.disabled = true; });
    $('#quickSaveBtn').textContent = 'Saving…';
    msg('#quickMsg', '');

    try {
      const { data, error } = await sb.from('cars').insert(record).select().single();
      if (error) throw error;
      state.cars.unshift(data);
      state.dirty = false;
      state.pxFrom = null;
      renderStock();
      if (pxFrom && !thenEdit) {
        setStockTab('draft');
        go('stock');
        toast('Their car is in as a draft, linked to the sale', 'ok');
      } else if (thenEdit) {
        openForm(data);
        toast('Saved. Now add the photos and the words', 'ok');
      } else {
        setStockTab('draft');
        go('stock');
        toast('Saved as a draft', 'ok');
      }
    } catch (err) {
      console.error(err);
      msg('#quickMsg', 'Couldn’t save: ' + esc(err.message || 'unknown error') +
        '<br>Nothing has been lost. Try again in a moment.', 'err');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      btns.forEach((b, i) => { b.disabled = false; b.textContent = labels[i]; });
    }
  }

  function chipGroup(sel, options, key) {
    const box = $(sel);
    box.innerHTML = options.map(([v, l]) =>
      `<button class="chip" type="button" data-value="${v}">${esc(l)}</button>`).join('');
    box.dataset.key = key;
    box.querySelectorAll('.chip').forEach(chip => {
      chip.onclick = () => {
        const on = chip.classList.contains('is-on');
        box.querySelectorAll('.chip').forEach(c => c.classList.remove('is-on'));
        if (!on) chip.classList.add('is-on');
        state.dirty = true;
      };
    });
  }
  const chipValue = sel => {
    const c = $(sel).querySelector('.chip.is-on');
    return c ? c.dataset.value : null;
  };
  const setChip = (sel, value) => {
    $(sel).querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('is-on', c.dataset.value === value));
  };

  /**
   * Equipment chips, grouped the same way they appear on the website.
   * A well-specced car has 20+ items. As one flat wall of chips that's
   * unusable on a phone, so it's split into the same categories the car
   * page uses.
   */
  function renderFeatures() {
    const F = window.MBU_FEATURES;
    const box = $('#fFeatures');

    // Everything we know about, plus anything typed in by hand
    const known = F ? F.all() : COMMON_FEATURES;
    const all = [...new Set(known.concat([...state.features]))];

    if (!F) {                       // features.js missing, so fall back to flat
      box.innerHTML = all.map(f =>
        `<button class="chip ${state.features.has(f) ? 'is-on' : ''}" type="button"
                 data-f="${esc(f)}">${esc(f)}</button>`).join('');
    } else {
      const groups = F.group(all);
      box.style.display = 'block';
      box.innerHTML = groups.map(g => `
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
                      color:var(--ink-3);margin-bottom:8px">${esc(g.label)}</div>
          <div class="chips">
            ${g.items.map(f =>
              `<button class="chip ${state.features.has(f) ? 'is-on' : ''}" type="button"
                       data-f="${esc(f)}">${esc(f)}</button>`).join('')}
          </div>
        </div>`).join('');
    }

    $$('#fFeatures .chip').forEach(chip => {
      chip.onclick = () => {
        const f = chip.dataset.f;
        state.features.has(f) ? state.features.delete(f) : state.features.add(f);
        chip.classList.toggle('is-on');
        state.dirty = true;
      };
    });
  }

  function addCustomFeature() {
    const v = prompt('What else does this car have?');
    if (!v || !v.trim()) return;
    state.features.add(v.trim());
    renderFeatures();
  }

  /**
   * @param {object|null} car
   * @param {string} [focusSel]  a field to scroll to, e.g. '#fMot' from an MOT alert
   */
  function openForm(car, focusSel) {
    state.editing = car;
    state.dirty = false;
    state.features = new Set(Array.isArray(car && car.features) ? car.features : []);
    state.photos = (car && Array.isArray(car.images) ? car.images : []).map(p =>
      typeof p === 'string' ? { public_id: p } : Object.assign({}, p));
    state.video = (car && car.video && car.video.public_id) ? Object.assign({}, car.video) : null;

    const v = (sel, val) => { $(sel).value = val == null ? '' : val; };
    v('#fReg', car ? fmtReg(car.registration) : '');

    // Rebuild the dropdowns first, so this car's make and model are in them
    fillPicker('#fMake', '#fMakeOther', knownMakes(), 'Choose…');
    // Shown in the proper spelling where we know it; saving keeps it that way
    setPicker('#fMake', '#fMakeOther', (car && MK.makeName(car.make)) || '');
    fillPicker('#fModel', '#fModelOther', knownModels(car && car.make), 'Choose…');
    setPicker('#fModel', '#fModelOther', (car && MK.modelName(car.make, car.model)) || '');
    fillPicker('#fColour', '#fColourOther', COLOURS, 'Choose…');
    setPicker('#fColour', '#fColourOther', (car && car.colour) || '');

    v('#fVariant', car && car.variant); v('#fYear', car && car.year);
    v('#fPrice', car && car.price);
    v('#fMileage', car && car.mileage); v('#fEngine', car && car.engine_size);
    v('#fDoors', car && car.doors); v('#fOwners', car && car.previous_owners);
    v('#fMot', car && car.mot_expiry); v('#fService', (car && car.service_history) || '');
    v('#fHpi', (car && car.hpi_status) || 'clear');
    v('#fCondition', car && car.condition_notes);
    v('#fDescription', car && car.description);
    v('#fPurchase', car && car.purchase_price);
    v('#fPrep', car && car.prep_cost);
    $('#fSaleWrap').hidden = !(car && car.status === 'sold');
    v('#fSale', car && car.sale_price);
    v('#fPrivateNotes', car && car.private_notes);
    $('#fFeatured').checked = !!(car && car.featured);
    renderCostSummary();

    setChip('#fFuel', car && car.fuel);
    setChip('#fTrans', car && car.transmission);
    setChip('#fBody', car && car.body_type);
    $('#condWrap').hidden = $('#fHpi').value === 'clear';

    renderFeatures();
    renderPhotos();
    renderVideo();
    msg('#formMsg', '');
    $('#lookupHint').textContent = 'Type the plate and tap Look up. We’ll fill in what we can.';
    $('#publishBtn').textContent = car && car.status !== 'draft' ? 'Save changes' : 'Publish';
    $('#saveDraftBtn').style.display = car && car.status !== 'draft' ? 'none' : '';

    go('form');
    if (focusSel && $(focusSel)) {
      const field = $(focusSel).closest('.f, .section-card');
      setTimeout(() => {
        field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field.classList.add('is-flagged');
        setTimeout(() => field.classList.remove('is-flagged'), 2400);
      }, 60);
    }
  }

  /* ============================================================ PHOTOS */
  function renderPhotos() {
    const area = $('#photoArea');
    if (!state.photos.length) {
      area.innerHTML = `
        <div class="photo-drop">
          ${icon('camera')}
          <h3>Add your photos</h3>
          <p>Pick them straight from your camera roll.<br>10 to 15 is plenty. They’re shrunk automatically.</p>
          <button class="btn btn--accent btn--block" type="button" id="pickBtn">Choose photos</button>
        </div>`;
    } else {
      area.innerHTML = `
        <div class="photo-grid">
          ${state.photos.map((p, i) => `
            <div class="photo-item ${i === 0 ? 'is-main' : ''}" data-i="${i}">
              <img src="${imgUrl(p, 300)}" alt="">
              ${i === 0 ? '<span class="photo-main-tag">MAIN</span>' : ''}
              ${p.uploading ? `<div class="photo-progress">${p.progress || 0}%</div>` : `
                <div class="photo-actions">
                  <button data-act="left" data-i="${i}" aria-label="Move left" ${i === 0 ? 'style="visibility:hidden"' : ''}>${icon('left')}</button>
                  <button data-act="main" data-i="${i}" aria-label="Make main photo" ${i === 0 ? 'style="visibility:hidden"' : ''}>${icon('star')}</button>
                  <button class="del" data-act="del" data-i="${i}" aria-label="Delete">${icon('trash')}</button>
                </div>`}
            </div>`).join('')}
        </div>
        <button class="btn btn--outline btn--block" type="button" id="pickBtn" style="margin-top:12px">
          ${icon('camera')} Add more photos
        </button>`;
    }

    $('#pickBtn').onclick = () => $('#photoInput').click();
    area.querySelectorAll('[data-act]').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        const i = +btn.dataset.i, act = btn.dataset.act;
        if (act === 'del') state.photos.splice(i, 1);
        if (act === 'main') { const [p] = state.photos.splice(i, 1); state.photos.unshift(p); }
        if (act === 'left') { const p = state.photos[i]; state.photos[i] = state.photos[i-1]; state.photos[i-1] = p; }
        state.dirty = true;
        renderPhotos();
      };
    });
  }

  /* ==========================================================================
     WALKAROUND VIDEO
     --------------------------------------------------------------------------
     A 30-second video does more to sell a used car than any amount of copy,
     and it's the thing that stops someone driving an hour to see a car that
     turns out to be scruffy.

     Practical limits, which the UI enforces rather than letting him find out
     the hard way: iPhone video is enormous (a minute of 4K is ~350MB), and
     Cloudinary's free tier counts video against the same credits as photos.
     So: reject anything over 90MB with advice, and push hard for short clips.
     ========================================================================== */
  const MAX_VIDEO_BYTES = 90 * 1024 * 1024;

  function renderVideo() {
    const area = $('#videoArea');
    const v = state.video;

    if (v && v.uploading) {
      area.innerHTML = `
        <div class="photo-drop">
          <div style="font-size:30px;font-weight:800;color:var(--navy-800)">${v.progress || 0}%</div>
          <p style="margin-top:8px">Uploading. Keep the app open.<br>
             Video takes a while, especially on mobile data.</p>
        </div>`;
      return;
    }

    if (v && v.public_id) {
      area.innerHTML = `
        <div class="photo-item" style="aspect-ratio:16/9;border-radius:var(--r-md)">
          <video src="${videoUrl(v)}" controls playsinline preload="metadata"
                 style="width:100%;height:100%;object-fit:cover;background:#000"></video>
        </div>
        <button class="btn btn--red btn--block btn--sm" id="vidRemove" style="margin-top:10px">
          ${icon('trash')} Remove video
        </button>`;
      $('#vidRemove').onclick = () => {
        confirmSheet('Remove the video?', 'The photos stay. You can add another later.',
          'Remove it', () => { state.video = null; state.dirty = true; renderVideo(); }, true);
      };
      return;
    }

    area.innerHTML = `
      <div class="photo-drop">
        ${icon('camera')}
        <h3>Add a walkaround</h3>
        <p>Under 45 seconds. Round the outside, start it up, show the inside.<br>
           Mention anything you'd point out in person.</p>
        <button class="btn btn--outline btn--block" type="button" id="vidPick">Choose a video</button>
      </div>`;
    $('#vidPick').onclick = () => $('#videoInput').click();
  }

  function videoUrl(v, poster) {
    const cloud = CFG.cloudinary.cloudName;
    const id = v.public_id;
    if (!cloud || !id) return '';
    return poster
      ? `https://res.cloudinary.com/${cloud}/video/upload/so_1,w_800,c_fill,q_auto,f_jpg/${id}.jpg`
      : `https://res.cloudinary.com/${cloud}/video/upload/q_auto,f_auto,w_1280,c_limit/${id}.mp4`;
  }

  async function handleVideo(file) {
    if (!file || !file.type.startsWith('video/')) return;
    $('#videoInput').value = '';

    if (file.size > MAX_VIDEO_BYTES) {
      msg('#formMsg',
        `That video is ${(file.size / 1048576).toFixed(0)}MB. Too big to upload reliably.<br><br>
         Either record a shorter clip, or turn the quality down:
         <strong>iPhone Settings → Camera → Record Video → 1080p at 30fps</strong>.
         That alone usually cuts it by two thirds.`, 'warn');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const v = { uploading: true, progress: 0 };
    state.video = v;
    renderVideo();

    try {
      const up = await uploadToCloudinary(file, pct => {
        v.progress = pct;
        const el = $('#videoArea').querySelector('div[style*="font-size:30px"]');
        if (el) el.textContent = pct + '%';
      }, 'video');

      state.video = {
        public_id: up.public_id,
        duration: up.duration ?? null,
        width: up.width ?? null,
        height: up.height ?? null
      };
      state.dirty = true;
      msg('#formMsg', '');
      toast('Video added', 'ok');
    } catch (err) {
      console.error(err);
      state.video = null;
      msg('#formMsg', 'Video didn’t upload: ' + esc(err.message || 'unknown error') +
        '<br>Try again on wi-fi. Everything else you’ve typed is safe.', 'err');
    }
    renderVideo();
  }

  /** Shrink a photo in the browser before uploading. */
  function compress(file, maxSide = 1800, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        const scale = Math.min(1, maxSide / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        // JPEG has no transparency, so without this a PNG with a clear
        // background comes out with black patches.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          blob => blob ? resolve({ blob, width: w, height: h }) : reject(new Error('Could not process photo')),
          'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo')); };
      img.src = url;
    });
  }

  /**
   * @param {Blob|File} blob
   * @param {Function} onProgress
   * @param {'image'|'video'} kind
   */
  function uploadToCloudinary(blob, onProgress, kind) {
    return new Promise((resolve, reject) => {
      const { cloudName, uploadPreset, folder } = CFG.cloudinary;
      if (!cloudName || !uploadPreset) return reject(new Error('Cloudinary is not set up in config.js'));

      const fd = new FormData();
      fd.append('file', blob);
      fd.append('upload_preset', uploadPreset);
      if (folder) fd.append('folder', folder);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${kind === 'video' ? 'video' : 'image'}/upload`);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        try {
          const r = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && r.public_id) {
            resolve({ public_id: r.public_id, width: r.width, height: r.height, duration: r.duration });
          } else {
            reject(new Error((r.error && r.error.message) || 'Upload failed'));
          }
        } catch { reject(new Error('Upload failed')); }
      };
      xhr.onerror = () => reject(new Error('No connection. Try again on wi-fi'));
      xhr.send(fd);
    });
  }

  async function handleFiles(files) {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (!images.length) return;
    $('#photoInput').value = '';

    const placeholders = images.map(f => {
      const p = { uploading: true, progress: 0, localUrl: URL.createObjectURL(f) };
      state.photos.push(p);
      return p;
    });
    renderPhotos();

    let failed = 0;
    for (let i = 0; i < images.length; i++) {
      const p = placeholders[i];
      try {
        const { blob, width, height } = await compress(images[i]);
        const up = await uploadToCloudinary(blob, pct => {
          p.progress = pct;
          const el = document.querySelector(`.photo-item[data-i="${state.photos.indexOf(p)}"] .photo-progress`);
          if (el) el.textContent = pct + '%';
        });
        Object.assign(p, up, { uploading: false, width, height });
        if (p.localUrl) { URL.revokeObjectURL(p.localUrl); delete p.localUrl; }
      } catch (err) {
        failed++;
        state.photos = state.photos.filter(x => x !== p);
        console.error(err);
        msg('#formMsg', esc(err.message || 'A photo failed to upload.') +
          ' The rest are fine, so try that one again.', 'err');
      }
      renderPhotos();
    }
    state.dirty = true;
    if (!failed) toast(images.length + ' photo' + (images.length === 1 ? '' : 's') + ' added', 'ok');
  }

  /* ======================================================= DVLA LOOKUP */
  /**
   * Ask the lookup functions about a number plate and hand back whatever they
   * know. Shared by the full form and the quick add screen, so there is only
   * one copy of the fallback logic.
   * @param {string} plate  no spaces, upper case
   * @returns {Promise<object>}
   */
  async function vehicleLookup(plate) {
    // Send the signed-in admin's own token, never the publishable key. The
    // lookup functions now check the caller is an admin before spending any
    // DVLA or MOT quota, so the key would be rejected anyway — but there is no
    // reason to make the request at all if the session has expired.
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Your session has expired. Sign in again to look up a plate.');
    const auth = 'Bearer ' + session.access_token;
    const call = fn => fetch(`${CFG.supabase.url}/functions/v1/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ registrationNumber: plate })
    });

    // Try the combined DVLA + MOT lookup, and fall back to the DVLA-only one
    // if that function hasn't been deployed. (See runValuation for why the
    // 404 has to be inspected rather than trusted.)
    let res = await call('vehicle-lookup');
    let d = null;
    try { d = await res.json(); } catch { /* not JSON */ }

    if (res.status === 404 && !(d && d.error)) {
      res = await call('dvla-lookup');
      try { d = await res.json(); } catch { d = null; }
    }

    if (!res.ok) throw new Error((d && d.error) || 'Lookup unavailable');
    if (!d) throw new Error('The lookup service returned something unexpected.');
    return d;
  }

  async function dvlaLookup() {
    const raw = $('#fReg').value.replace(/\s+/g, '').toUpperCase();
    const hint = $('#lookupHint');
    if (raw.length < 4) { hint.textContent = 'Type the full number plate first.'; return; }

    const btn = $('#lookupBtn');
    btn.disabled = true; btn.textContent = '…';
    hint.textContent = 'Checking with the DVLA…';

    try {
      const d = await vehicleLookup(raw);

      const set = (sel, val) => { if (val != null && val !== '' && !$(sel).value) $(sel).value = val; };
      const force = (sel, val) => { if (val != null && val !== '') $(sel).value = val; };

      // The combined lookup returns richer fields; the old DVLA-only function
      // returns the raw DVLA shape. Handle both.
      const make   = d.make;
      const model  = d.model;                                   // MOT history only
      const year   = d.year ?? d.yearOfManufacture;
      const litres = d.engineLitres ?? (d.engineCapacity ? d.engineCapacity / 1000 : null);
      const miles  = d.mot && d.mot.latestMileage != null ? d.mot.latestMileage : null;

      if (make) {
        setPicker('#fMake', '#fMakeOther', canonicalMake(make));
        refreshFormModels();
      }
      if (model)  setPicker('#fModel', '#fModelOther', canonicalModel(make, model));
      if (year)   force('#fYear', year);
      if (d.colour) setPicker('#fColour', '#fColourOther', titleCase(d.colour));
      if (litres) force('#fEngine', Number(litres).toFixed(1));
      if (d.motExpiryDate) set('#fMot', String(d.motExpiryDate).slice(0, 10));
      if (miles != null) set('#fMileage', miles);

      const f = fuelFrom(d.fuelType);
      if (f) setChip('#fFuel', f);

      state.dirty = true;
      hint.innerHTML = model
        ? `<strong style="color:var(--green-600)">Found it.</strong> Make, model, year, colour and
           engine filled in${miles != null ? ', plus the mileage from its last MOT' : ''}.
           Check the mileage against the clock and add the trim.`
        : `<strong style="color:var(--green-600)">Found it.</strong> Filled in what the DVLA knows.
           You’ll still need the model, trim and mileage. The DVLA don’t hold those.`;
      $(model ? '#fVariant' : '#fModel').focus();
      toast('Details filled in', 'ok');

    } catch (err) {
      console.error(err);
      hint.innerHTML = `<strong style="color:var(--amber-600)">Couldn’t look that up.</strong>
        Just type the details in yourself, it all still works. (${esc(err.message)})`;
    } finally {
      btn.disabled = false; btn.textContent = 'Look up';
    }
  }

  const titleCase = s => String(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  /**
   * A fuel as the DVLA or Auto Trader words it, as one of ours. The DVLA says
   * "ELECTRICITY" and "HYBRID ELECTRIC"; Auto Trader says "Petrol Hybrid",
   * "Diesel Plug-in Hybrid", "Electric". Plug-in is checked first because it
   * contains "hybrid"; "ELECTRIC DIESEL" is the DVLA's name for a diesel hybrid.
   * @returns {string|null} petrol | diesel | hybrid | phev | electric | lpg
   */
  function fuelFrom(s) {
    const t = String(s || '').toLowerCase();
    if (!t) return null;
    if (/plug-?in/.test(t)) return 'phev';
    if (/hybrid|petrol\/electric|electric diesel|electric\/diesel/.test(t)) return 'hybrid';
    if (/electric/.test(t)) return 'electric';
    if (/lpg|gas/.test(t)) return 'lpg';
    if (/diesel/.test(t)) return 'diesel';
    if (/petrol/.test(t)) return 'petrol';
    return null;
  }
  /** Same rule as the website: asking for a hybrid takes a plug-in hybrid too. */
  const fuelMatches = (carFuel, wanted) => carFuel === wanted || (wanted === 'hybrid' && carFuel === 'phev');

  /* ================================================ DESCRIPTION HELPER */
  function draftDescription() {
    const g = sel => $(sel).value.trim();
    const year = g('#fYear'), variant = g('#fVariant');
    const make  = pickerValue('#fMake', '#fMakeOther');
    const model = pickerValue('#fModel', '#fModelOther');
    if (!make || !model) { toast('Add the make and model first'); return; }

    const miles = int(g('#fMileage'));
    const fuel = chipValue('#fFuel'), trans = chipValue('#fTrans');
    const service = g('#fService'), hpi = g('#fHpi'), owners = int(g('#fOwners'));
    const mot = g('#fMot'), colour = pickerValue('#fColour', '#fColourOther');
    const feats = [...state.features];

    const bits = [];
    bits.push(`${year ? year + ' ' : ''}${make} ${model}${variant ? ' ' + variant : ''}${colour ? ' in ' + colour.toLowerCase() : ''}.`);

    const facts = [];
    if (miles != null) facts.push(`${miles.toLocaleString('en-GB')} miles`);
    if (owners) facts.push(`${owners} previous owner${owners === 1 ? '' : 's'}`);
    if (service === 'full') facts.push('a full service history');
    else if (service === 'part') facts.push('part service history');
    if (facts.length) bits.push(`It has ${facts.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);

    if (trans === 'automatic') bits.push('Automatic gearbox.');
    if (fuel === 'diesel' && miles > 60000) bits.push('The diesel is well suited to longer runs and is economical with it.');
    if (fuel === 'electric') bits.push('Fully electric, so no fuel to buy and very cheap to run.');
    if (fuel === 'hybrid') bits.push('Hybrid, so it runs on electric around town and saves on fuel.');
    if (fuel === 'phev') bits.push('Plug-in hybrid: charge it at home and short trips can be done on electric alone.');

    if (feats.length) {
      bits.push(`Equipment includes ${feats.slice(0, 6).map(f => f.toLowerCase()).join(', ')}${feats.length > 6 ? ' and more' : ''}.`);
    }
    if (mot) {
      const d = new Date(mot);
      if (!isNaN(d)) bits.push(`MOT runs to ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}.`);
    }
    if (hpi && hpi !== 'clear') {
      bits.push(`This car is a ${LABEL.hpi[hpi]}. See the note above about the damage and how it was repaired. It is priced to reflect that.`);
    } else {
      bits.push('HPI clear.');
    }
    bits.push('Serviced, MOT’d and checked over by us before it goes out. Viewings welcome seven days a week, so give us a ring and we’ll have it ready for you.');

    $('#fDescription').value = bits.join(' ');
    state.dirty = true;
    toast('Description written. Have a read and change anything', 'ok');
    $('#fDescription').focus();
  }

  /* ============================================================== SAVE */
  async function save(status) {
    const g = sel => $(sel).value.trim();
    const make  = pickerValue('#fMake', '#fMakeOther');
    const model = pickerValue('#fModel', '#fModelOther');
    const problems = [];
    if (!make) problems.push('make');
    if (!model) problems.push('model');
    if (status !== 'draft') {
      if (!g('#fYear')) problems.push('year');
      if (!g('#fPrice')) problems.push('price');
      if (!g('#fMileage')) problems.push('mileage');
      if (!state.photos.some(p => p.public_id)) problems.push('at least one photo');
      // The damage explanation is encouraged but NOT required. You can
      // publish a Cat S/N car without it and add the wording later.
    }
    if (state.photos.some(p => p.uploading)) {
      return msg('#formMsg', 'Photos are still uploading. Give them a second.', 'warn');
    }
    if (state.video && state.video.uploading) {
      return msg('#formMsg', 'The video is still uploading. Give it a second.', 'warn');
    }
    if (problems.length) {
      msg('#formMsg', 'Still needed: <strong>' + problems.join(', ') + '</strong>.', 'warn');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const record = {
      status,
      registration: g('#fReg').replace(/\s+/g, '') || null,
      make: canonicalMake(make) || null,
      model: canonicalModel(make, model) || null,
      variant: g('#fVariant') || null,
      year: int(g('#fYear')),
      price: int(g('#fPrice')),
      mileage: int(g('#fMileage')),
      colour: pickerValue('#fColour', '#fColourOther') || null,
      featured: $('#fFeatured').checked,
      fuel: chipValue('#fFuel'),
      transmission: chipValue('#fTrans'),
      body_type: chipValue('#fBody'),
      engine_size: num(g('#fEngine')),
      doors: int(g('#fDoors')),
      previous_owners: int(g('#fOwners')),
      mot_expiry: g('#fMot') || null,
      service_history: g('#fService') || null,
      hpi_status: g('#fHpi') || null,
      condition_notes: g('#fCondition') || null,
      description: g('#fDescription') || null,
      // Private. Excluded from the public view, so these never reach the website
      purchase_price: int(g('#fPurchase')),
      prep_cost: int(g('#fPrep')),
      private_notes: g('#fPrivateNotes') || null,
      // Only a sold car shows the field, so only a sold car can change it
      ...(state.editing && state.editing.status === 'sold' ? { sale_price: int(g('#fSale')) } : {}),
      features: [...state.features],
      // Only keep photos that actually finished uploading and have an id.
      // A half-finished one would render as a broken image on the website.
      images: state.photos
        .filter(p => !p.uploading && p.public_id)
        .map(p => ({ public_id: p.public_id, width: p.width, height: p.height })),
      video: (state.video && state.video.public_id && !state.video.uploading)
        ? state.video : null,
      updated_at: new Date().toISOString()
    };

    const btn = status === 'draft' ? $('#saveDraftBtn') : $('#publishBtn');
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    msg('#formMsg', '');

    try {
      if (state.editing) {
        if (state.editing.status !== 'draft' && status === 'available') record.status = state.editing.status;
        const { data, error } = await sb.from('cars').update(record).eq('id', state.editing.id).select().single();
        if (error) throw error;
        Object.assign(state.editing, data);
      } else {
        const { data, error } = await sb.from('cars').insert(record).select().single();
        if (error) throw error;
        state.cars.unshift(data);
      }
      state.dirty = false;
      const wasNew = !state.editing;
      if (state.editing) syncStats(state.editing);
      // A new car: show it in the list it landed in. An edit: back where you were.
      if (wasNew) { setStockTab(status === 'draft' ? 'draft' : 'available'); go('stock'); }
      else { renderStock(); goBack(); }
      toast(status === 'draft' ? 'Saved as a draft' : wasNew ? 'Live on the website' : 'Saved', 'ok');
    } catch (err) {
      console.error(err);
      msg('#formMsg', 'Couldn’t save: ' + esc(err.message || 'unknown error') +
        '<br>Nothing has been lost. Try again in a moment.', 'err');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }

  /* ========================================================= ENQUIRIES */
  async function loadEnquiries() {
    const [enq, req] = await Promise.all([
      sb.from('enquiries').select('*').eq('archived', false)
        .order('created_at', { ascending: false }).limit(200),
      sb.from('wanted_requests').select('*').eq('archived', false)
        .order('created_at', { ascending: false }).limit(200)
    ]);

    if (enq.error) console.warn(enq.error);
    if (req.error) console.warn(req.error);   // table won't exist until v2 SQL is run

    state.enquiries = enq.data || [];
    state.requests = req.data || [];
    renderEnquiries();
    updateEnqDot();
  }

  function updateEnqDot() {
    const n = state.enquiries.filter(e => !e.is_read).length +
              state.requests.filter(r => !r.is_read).length;
    const dot = $('#enqDot');
    dot.textContent = n > 99 ? '99+' : n;
    dot.classList.toggle('is-zero', n === 0);
    if (state.view === 'home') renderHome();
  }

  const TIMESCALE = {
    asap: 'needs one ASAP', few_weeks: 'next few weeks',
    few_months: 'next few months', looking: 'just looking'
  };

  /** One car request, rendered like an enquiry so the tab feels consistent. */
  function requestRow(r) {
    const when = new Date(r.created_at);
    const wants = [
      [r.make, r.model].filter(Boolean).join(' ') || 'Anything suitable',
      r.budget_max ? 'up to ' + money(r.budget_max) : (r.budget_min ? 'from ' + money(r.budget_min) : null),
      r.max_mileage ? 'under ' + nf(r.max_mileage) + ' mi' : null,
      r.fuel && LABEL.fuel[r.fuel],
      r.transmission && LABEL.transmission[r.transmission],
      r.body_type && LABEL.body[r.body_type]
    ].filter(Boolean).join(' · ');

    return `<div class="card enq-card" data-open="r:${esc(r.id)}" tabindex="0" role="button"
                 aria-label="Open the request from ${esc(r.name || 'someone')}"><div class="enq">
      <span class="enq-dot ${r.is_read ? 'is-read' : ''}"></span>
      <div class="enq-body">
        <h3>${esc(r.name || 'No name given')}
          <span class="pill ${r.kind === 'sold_interest' ? 'pill--blue' : 'pill--grey'}"
                style="margin-left:6px;vertical-align:middle">
            ${r.kind === 'sold_interest' ? 'From a sold car' : 'Car finder'}
          </span>
        </h3>
        <div class="enq-meta">
          ${when.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
          at ${when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
          ${r.timescale ? ' · ' + esc(TIMESCALE[r.timescale] || r.timescale) : ''}
          ${r.part_ex ? ' · has a part exchange' : ''}
        </div>
        <div class="enq-meta" style="margin-top:5px;color:var(--navy-700);font-weight:700">${esc(wants)}</div>
        ${r.car_title ? `<div class="enq-meta" style="margin-top:3px">Saw: ${esc(r.car_title)}</div>` : ''}
        ${r.notes ? `<div class="enq-msg">${esc(r.notes)}</div>` : ''}
        <div class="enq-actions">
          ${contactButtons(r, 'sm')}
          <span class="enq-open">Open ${icon('right')}</span>
        </div>
      </div>
    </div></div>`;
  }

  /**
   * WhatsApp, Call and Email for whoever sent it. WhatsApp opens with a first
   * line already written, naming the car if there is one, so replying is one
   * tap and a send rather than starting from nothing.
   */
  function contactButtons(x, size) {
    const first = String(x.name || '').trim().split(/\s+/)[0];
    const about = x.car_title ? 'the ' + x.car_title : x.kind === 'sell' ? 'your car' : '';
    const hello = `Hi${first ? ' ' + first : ''}, it's MBU Car Sales` +
      (about ? `, about ${about}.` : '. Thanks for getting in touch.');
    const sz = size === 'sm' ? ' btn--sm' : '';
    return [
      x.phone ? `<a class="btn btn--green${sz}" href="https://wa.me/${ukNumber(x.phone)}?text=${encodeURIComponent(hello)}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>` : '',
      x.phone ? `<a class="btn btn--outline${sz}" href="tel:${esc(x.phone)}">${icon('phone')} Call</a>` : '',
      x.email ? `<a class="btn btn--outline${sz}" href="mailto:${esc(x.email)}${x.car_title ? '?subject=' + encodeURIComponent('Re: ' + x.car_title) : ''}" aria-label="Email">${icon('mail')}${size === 'sm' ? '' : ' Email'}</a>` : ''
    ].join('');
  }

  const REQUEST_STATUS = {
    new: 'New', searching: 'Looking for one', matched: 'Found them one', closed: 'Closed'
  };

  async function setRequestStatus(r, status, label) {
    const { error } = await sb.from('wanted_requests')
      .update({ status, is_read: true }).eq('id', r.id);
    if (error) return toast('Couldn’t update');
    r.status = status; r.is_read = true;
    renderEnquiries(); updateEnqDot();
    if (state.view === 'msg') renderMessage();
    toast(label, 'ok');
  }

  $$('#enqTabs button').forEach(b => b.onclick = () => setEnqTab(b.dataset.tab));

  function setEnqTab(tab) {
    state.enqTab = tab;
    $$('#enqTabs button').forEach(x => x.classList.toggle('is-on', x.dataset.tab === tab));
    renderEnquiries();
  }

  function renderEnquiries() {
    const list = $('#enqList');

    /* ---- Car requests get their own tab ---- */
    if (state.enqTab === 'requests') {
      const reqs = state.requests.filter(r => r.status !== 'closed');
      list.innerHTML = reqs.length
        ? reqs.map(requestRow).join('')
        : `<div class="empty">${icon('car')}<h3>No car requests yet</h3>
             <p>When someone uses the Car Finder, or registers interest in a car
             that's sold, it lands here.</p></div>`;
      wireEnquiryButtons(list);
      return;
    }

    /* ---- New: enquiries and requests together, newest first ---- */
    if (state.enqTab === 'new') {
      const unread = state.enquiries.filter(e => !e.is_read).map(e => ({ t: 'e', d: e }))
        .concat(state.requests.filter(r => !r.is_read).map(r => ({ t: 'r', d: r })))
        .sort((a, b) => new Date(b.d.created_at) - new Date(a.d.created_at));

      if (!unread.length) {
        list.innerHTML = `<div class="empty">${icon('inbox')}<h3>Nothing new</h3>
          <p>Anything that comes in from the website lands here.</p></div>`;
        return;
      }
      list.innerHTML = unread.map(x => x.t === 'r' ? requestRow(x.d) : enquiryRow(x.d)).join('');
      wireEnquiryButtons(list);

      clearTimeout(renderEnquiries._t);
      renderEnquiries._t = setTimeout(() => {
        if (state.view === 'enq' && state.enqTab === 'new') markSeen(unread.map(x => x.d));
      }, 2500);
      return;
    }

    const items = state.enquiries;

    if (!items.length) {
      list.innerHTML = `<div class="empty">${icon('inbox')}
        <h3>No enquiries yet</h3>
        <p>When someone fills in a form on the website it’ll show up here.</p></div>`;
      return;
    }

    list.innerHTML = items.map(enquiryRow).join('');
    wireEnquiryButtons(list);
  }

  /** One enquiry, as a card. */
  function enquiryRow(e) {
    const when = new Date(e.created_at);
    // A "sell" enquiry with a car attached came in through the part exchange
    // button on that car's page, so say which car it is against. Answering it
    // is one number (the difference), not two separate conversations.
    const kind = e.kind === 'sell'
                 ? (e.car_title ? 'Part exchange against: ' + e.car_title : 'Wants to sell a car')
               : e.kind === 'car' ? 'About: ' + (e.car_title || 'a car')
               : (e.details && e.details.subject) || 'General enquiry';
    const d = e.details || {};
    const extra = e.kind === 'sell'
      ? [d.registration, [d.make, d.model].filter(Boolean).join(' '),
         d.mileage ? Number(d.mileage).toLocaleString('en-GB') + ' mi' : null,
         d.hpi, d.condition, d.asking_price ? 'Wants ' + d.asking_price : null]
         .filter(Boolean).join(' · ')
      // What they picked on the contact page: still available, part exchange,
      // more photos, a viewing. That decides how you answer, so it belongs on
      // the card rather than two taps away under "More".
      // A general enquiry already uses the subject as its title, so it is not
      // repeated here.
      : e.kind === 'car' ? (d.subject || '')
      : '';

    return `<div class="card enq-card" data-open="e:${esc(e.id)}" tabindex="0" role="button"
                 aria-label="Open the message from ${esc(e.name || 'someone')}"><div class="enq">
      <span class="enq-dot ${e.is_read ? 'is-read' : ''}"></span>
      <div class="enq-body">
        <h3>${esc(e.name || 'No name given')}</h3>
        <div class="enq-meta">${esc(kind)} · ${when.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} at ${when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
        ${extra ? `<div class="enq-meta" style="margin-top:4px;color:var(--navy-700);font-weight:600">${esc(extra)}</div>` : ''}
        ${e.message ? `<div class="enq-msg">${esc(e.message)}</div>` : ''}
        <div class="enq-actions">
          ${contactButtons(e, 'sm')}
          <span class="enq-open">Open ${icon('right')}</span>
        </div>
      </div>
    </div></div>`;
  }

  /** The whole card opens the message. The call and WhatsApp buttons on it still just work. */
  function wireEnquiryButtons(list) {
    list.querySelectorAll('[data-open]').forEach(card => {
      const open = () => { const [kind, id] = card.dataset.open.split(':'); openMessage(kind, id); };
      card.onclick = ev => { if (!ev.target.closest('a, button')) open(); };
      card.onkeydown = ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === card) { ev.preventDefault(); open(); } };
    });
  }

  function ukNumber(phone) {
    let n = String(phone).replace(/[^0-9+]/g, '');
    if (n.startsWith('+')) return n.slice(1);
    if (n.startsWith('0')) return '44' + n.slice(1);
    return n;
  }

  /* ==========================================================================
     ONE MESSAGE, IN FULL
     The cards in the Inbox cut the message at two lines. Tapping one opens
     this: the whole message, every detail the form collected, the car it's
     about, and the ways to answer it. Opening it marks it read.
     ========================================================================== */
  const findMessage = (kind, id) => (kind === 'r' ? state.requests : state.enquiries)
    .find(x => String(x.id) === String(id)) || null;

  function openMessage(kind, id) {
    const x = findMessage(kind, id);
    if (!x) return toast('That message has gone. It may have been archived');
    state.message = { kind, id: x.id };
    renderMessage();
    go('msg');
    if (!x.is_read) {
      sb.from(kind === 'r' ? 'wanted_requests' : 'enquiries').update({ is_read: true }).eq('id', x.id)
        .then(({ error }) => {
          if (error) return;
          x.is_read = true;
          renderEnquiries(); updateEnqDot();
        });
    }
  }

  /** "2 hours ago", "yesterday", "12 days ago": how long they've been waiting. */
  function ago(d) {
    const mins = Math.round((Date.now() - new Date(d)) / 60000);
    if (mins < 2) return 'just now';
    if (mins < 60) return mins + ' minutes ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs === 1 ? 'an hour ago' : hrs + ' hours ago';
    const days = Math.round(hrs / 24);
    return days === 1 ? 'yesterday' : days + ' days ago';
  }

  /* The form fields, in words. Anything not listed is shown with its own name. */
  const DETAIL_LABEL = {
    subject: 'What it’s about', registration: 'Registration', make: 'Make', model: 'Model',
    year: 'Year', mileage: 'Mileage', hpi: 'History', condition: 'Condition',
    asking_price: 'Hoping for', service_history: 'Service history', owners: 'Owners',
    colour: 'Colour', fuel: 'Fuel', transmission: 'Gearbox', preferred_contact: 'Best way to reach them',
    best_time: 'Best time', finance: 'Finance', px: 'Part exchange', source: 'Came from'
  };

  function detailRows(pairs) {
    const shown = pairs.filter(([, v]) => v != null && v !== '' && v !== false);
    if (!shown.length) return '';
    return `<dl class="kv">${shown.map(([k, v]) => {
      const label = DETAIL_LABEL[k] || (k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '));
      const value = v === true ? 'Yes'
        : Array.isArray(v) ? v.join(', ')
        : typeof v === 'object' ? JSON.stringify(v)
        : k === 'mileage' && !isNaN(+v) ? nf(+v) + ' miles'
        : String(v);
      return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
    }).join('')}</dl>`;
  }

  function renderMessage() {
    const m = state.message;
    const x = m && findMessage(m.kind, m.id);
    const body = $('#msgBody');
    if (!x) { body.innerHTML = `<div class="empty">${icon('inbox')}<h3>Message not found</h3></div>`; return; }

    const isReq = m.kind === 'r';
    const when = new Date(x.created_at);
    const whenText = when.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
      ' at ' + when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const kindLabel = isReq
      ? (x.kind === 'sold_interest' ? 'Wants one like a sold car' : 'Car Finder request')
      : x.kind === 'sell' ? (x.car_title ? 'Part exchange' : 'Wants to sell a car')
      : x.kind === 'car' ? 'About a car' : 'General enquiry';

    // The car it's about, if we still have it. Tap for the usual car actions.
    const car = x.car_id ? state.cars.find(c => String(c.id) === String(x.car_id)) : null;
    const carBlock = car ? `
      <button class="msg-car" type="button" id="msgCar">
        <img src="${Array.isArray(car.images) && car.images.length ? imgUrl(car.images[0], 200) : ''}" alt=""
             onerror="this.style.visibility='hidden'">
        <span><strong>${esc(carTitle(car))}</strong>
          <small>${car.status === 'sold' ? 'Sold' : money(car.price)}${car.status === 'reserved' ? ' · Reserved' : ''}${car.registration ? ' · ' + esc(fmtReg(car.registration)) : ''}</small></span>
        ${icon('right')}
      </button>`
      : x.car_title ? `<p class="msg-about">${isReq ? 'Saw' : 'About'}: <strong>${esc(x.car_title)}</strong></p>` : '';

    const d = x.details || {};
    let facts;
    if (isReq) {
      facts = detailRows([
        ['Looking for', [x.make, x.model].filter(Boolean).join(' ') || 'Anything suitable'],
        ['Budget', x.budget_min || x.budget_max
          ? [x.budget_min ? money(x.budget_min) : null, x.budget_max ? money(x.budget_max) : null].filter(Boolean).join(' to ') : null],
        ['Mileage', x.max_mileage ? 'Under ' + nf(x.max_mileage) + ' miles' : null],
        ['Fuel', x.fuel && (LABEL.fuel[x.fuel] || x.fuel)],
        ['Gearbox', x.transmission && (LABEL.transmission[x.transmission] || x.transmission)],
        ['Body', x.body_type && (LABEL.body[x.body_type] || x.body_type)],
        ['When', x.timescale && (TIMESCALE[x.timescale] || x.timescale)],
        ['Part exchange', x.part_ex ? 'Has one' : null],
        ['Status', REQUEST_STATUS[x.status] || x.status]
      ]);
    } else {
      facts = detailRows(Object.entries(d).concat([
        ['part_ex', x.part_ex || null],
        ['part_ex_details', x.part_ex_details || null],
        ['finance', x.finance_interest ? 'Ticked that they’re interested' : null]
      ]));
    }

    const text = isReq ? x.notes : x.message;

    body.innerHTML = `
      <div class="section-card msg-head">
        <span class="pill ${isReq ? 'pill--blue' : 'pill--grey'}">${esc(kindLabel)}</span>
        <h2 class="msg-name">${esc(x.name || 'No name given')}</h2>
        <p class="msg-when">${esc(whenText)} · ${esc(ago(x.created_at))}</p>
        ${x.phone || x.email ? `<p class="msg-contact">
          ${x.phone ? `<a href="tel:${esc(x.phone)}">${esc(x.phone)}</a>` : ''}
          ${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ''}</p>` : ''}
        <div class="msg-reply">${contactButtons(x) || '<p class="hint">They didn’t leave a phone number or email.</p>'}</div>
      </div>

      ${carBlock ? `<div class="section-card"><h2>${isReq ? 'The car they saw' : 'The car'}</h2>${carBlock}</div>` : ''}

      <div class="section-card">
        <h2>${isReq ? 'Their notes' : 'Their message'}</h2>
        ${text ? `<p class="msg-text">${esc(text)}</p>` : '<p class="hint">No message, just the details below.</p>'}
      </div>

      ${facts ? `<div class="section-card"><h2>${isReq ? 'What they want' : 'Details'}</h2>${facts}</div>` : ''}

      <div class="section-card">
        <h2>Tidy up</h2>
        <div class="sheet-actions">
          ${isReq ? `
            <button class="sheet-action" data-rs="searching">${icon('eye')}<div><span>Mark as looking</span><small>You’re keeping an eye out</small></div></button>
            <button class="sheet-action" data-rs="matched">${icon('check')}<div><span>Found them one</span><small>Matched to a car</small></div></button>
            <button class="sheet-action" data-rs="closed">${icon('close')}<div><span>Close this off</span><small>No longer looking</small></div></button>`
          : `<button class="sheet-action" id="msgUnread">${icon('inbox')}<div><span>Mark as unread</span><small>Puts it back under New</small></div></button>`}
          <button class="sheet-action danger" id="msgArchive">${icon('trash')}<div><span>Archive</span><small>Hides it from the Inbox</small></div></button>
        </div>
      </div>`;

    const carBtn = $('#msgCar');
    if (carBtn) carBtn.onclick = () => carActions(car);
    $$('#msgBody [data-rs]').forEach(b => {
      b.onclick = () => setRequestStatus(x, b.dataset.rs,
        { searching: 'Marked as looking', matched: 'Marked as matched', closed: 'Closed' }[b.dataset.rs]);
    });
    const unread = $('#msgUnread');
    if (unread) unread.onclick = async () => {
      const { error } = await sb.from('enquiries').update({ is_read: false }).eq('id', x.id);
      if (error) return toast('Couldn’t update');
      x.is_read = false;
      renderEnquiries(); updateEnqDot();
      toast('Marked as unread', 'ok');
      goBack();
    };
    $('#msgArchive').onclick = () => confirmSheet('Archive this?', 'It comes off the Inbox. Nothing is deleted.',
      'Archive it', async () => {
        const table = isReq ? 'wanted_requests' : 'enquiries';
        const { error } = await sb.from(table).update({ archived: true }).eq('id', x.id);
        if (error) return toast('Couldn’t archive');
        if (isReq) state.requests = state.requests.filter(r => r.id !== x.id);
        else state.enquiries = state.enquiries.filter(e => e.id !== x.id);
        renderEnquiries(); updateEnqDot();
        toast('Archived', 'ok');
        goBack();
      }, true);
  }

  /** Mark everything currently on screen as seen. Handles both kinds. */
  async function markSeen(items) {
    const enqIds = items.filter(x => !x.is_read && 'kind' in x && x.kind !== 'wanted'
                                     && x.kind !== 'sold_interest').map(x => x.id);
    const reqIds = items.filter(x => !x.is_read &&
                                     (x.kind === 'wanted' || x.kind === 'sold_interest')).map(x => x.id);

    const jobs = [];
    if (enqIds.length) jobs.push(sb.from('enquiries').update({ is_read: true }).in('id', enqIds));
    if (reqIds.length) jobs.push(sb.from('wanted_requests').update({ is_read: true }).in('id', reqIds));
    if (!jobs.length) return;

    await Promise.all(jobs);
    items.forEach(x => { x.is_read = true; });
    updateEnqDot();
  }

  /* ==========================================================================
     INSIGHTS
     Which cars pull interest, which sit, and what people are asking for.
     All the counting happens in the database (see the views in
     schema-v2-additions.sql) so the phone doesn't have to do the work.
     ========================================================================== */
  let stats = null, demand = null, ageing = null;
  // Schema v6/v7. null means that upgrade hasn't been run, which is fine.
  let interest = null;        // car_interest rows: people, not page loads
  let trackStatus = null;     // tracking_status: when counting people began
  let insightActs = null;     // insight_actions: "price is right", snoozes
  let priceChecks = [];       // recent price_checks, for the market comparison
  let analysis = null;        // the insight engine's last answer

  $$('#dataTabs button').forEach(b => b.onclick = () => {
    state.dataTab = b.dataset.tab;
    $$('#dataTabs button').forEach(x => x.classList.toggle('is-on', x === b));
    renderInsights();
  });

  async function loadInsights() {
    // Show what we already have straight away and refresh underneath it;
    // skeletons only the very first time
    if (stats) renderInsights();
    else {
      $('#dataBody').innerHTML =
        `<div class="section-card"><div class="skel" style="height:130px"></div></div>`.repeat(3);
    }
    const err = await fetchInsightData();
    if (err) {
      msg('#dataMsg',
        'Couldn’t load the figures: ' + esc(err.message) +
        '<br><br>If you haven’t run <strong>schema-v2-additions.sql</strong> in Supabase yet, that’s why.',
        'err');
      $('#dataBody').innerHTML = '';
      return;
    }
    msg('#dataMsg', '');
    renderInsights();
    if (state.view === 'home') renderHome();
  }

  /* Home asks for these too, but it doesn't need them to the second. If
     they can't be loaded, Home carries on without the recommendations. */
  let insightsAt = 0, insightsBusy = null;
  function refreshHomeFigures() {
    if (insightsBusy || Date.now() - insightsAt < 120000) return;
    insightsBusy = fetchInsightData()
      .catch(err => console.warn('Insight figures unavailable', err))
      .finally(() => { insightsBusy = null; if (state.view === 'home') renderHome(); });
  }

  /**
   * Everything the Insights tab and the insight engine read, in one go.
   * @returns {Promise<Error|null>} the error if the basic views are missing
   */
  async function fetchInsightData() {
    const since = new Date(Date.now() - 90 * 86400000).toISOString();
    const [s, d, a, ci, ts, ia, pc] = await Promise.all([
      sb.from('car_stats').select('*'),
      sb.from('demand_summary').select('*'),
      sb.from('stock_ageing').select('*'),
      sb.from('car_interest').select('*'),
      sb.from('tracking_status').select('*').maybeSingle(),
      sb.from('insight_actions').select('*').gte('created_at', since)
        .order('created_at', { ascending: false }).limit(500),
      sb.from('price_checks').select('*').gte('created_at', since)
        .order('created_at', { ascending: false }).limit(500)
    ]);

    if (s.error || d.error) return s.error || d.error;
    insightsAt = Date.now();
    stats = s.data || [];
    demand = d.data || [];
    ageing = a.error ? null : (a.data || []);   // null = schema v4 not run yet
    interest = ci.error ? null : (ci.data || []);
    trackStatus = ts.error ? null : ts.data;
    insightActs = ia.error ? null : (ia.data || []);
    priceChecks = pc.error ? [] : (pc.data || []);
    return null;
  }

  /** True once the new tracking has actually counted somebody. */
  const countingPeople = () => !!(interest && trackStatus && trackStatus.v2_since);
  const interestFor = id => (interest || []).find(r => String(r.car_id) === String(id)) || null;

  function runEngine() {
    if (!window.MBU_INSIGHTS) return null;
    return window.MBU_INSIGHTS.analyse({
      now: Date.now(),
      cars: state.cars,
      interest: countingPeople() ? interest : [],
      ageing: ageing || [],
      checks: priceChecks,
      actions: insightActs || [],
      atSlotsKnown: false      // the app's "on Auto Trader" tick isn't kept up to date
    });
  }

  function renderInsights() {
    if (!stats) return;
    analysis = runEngine();
    const tab = INSIGHT_TABS.includes(state.dataTab) ? state.dataTab : 'summary';
    $('#dataBody').innerHTML =
      tab === 'money' ? soldInsights()
      : tab === 'cars' ? carsTab()
      : tab === 'web' ? webTab()
      : summaryTab();
    wireInsightActions();
    wireSiteBits($('#dataBody'));
  }

  /* ==========================================================================
     INSIGHTS, IN PLAIN WORDS (7 Oct 2026)
     --------------------------------------------------------------------------
     Four tabs: Summary (the last 7 days in sentences, the decisions, who
     tapped what, what people ask for), Cars (one sentence per car, and each
     car's own screen), Website (views by day, week or month, and where they
     came from), Money (the Sold tab as it was).

     Every number comes with a sentence, and the ⓘ beside it says what it
     means and where it comes from (EXPLAIN). Taps are "taps", never
     "contacts": a WhatsApp tap opens WhatsApp, and whether they sent anything
     the website can't know.

     The website figures come from schema-v14-site-analytics.sql (site_stats
     and contact_feed, added up in the database). Without it the tabs say so
     and fall back to the per-car page views the app always had.
     ========================================================================== */
  const INSIGHT_TABS = ['summary', 'cars', 'web', 'money'];

  /* ---- Dates, in the phone's own time (UK) ------------------------------- */
  const pad2 = n => String(n).padStart(2, '0');
  const dayKey = d => { const t = new Date(d); return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()); };
  const fromKey = k => { const [y, m, d] = String(k).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const startDay = d => { const t = new Date(d); t.setHours(0, 0, 0, 0); return t; };
  const addDays = (d, n) => { const t = new Date(d); t.setDate(t.getDate() + n); return t; };
  const weekStart = d => addDays(startDay(d), -((new Date(d).getDay() + 6) % 7));   // Monday
  const monthStart = d => { const t = new Date(d); return new Date(t.getFullYear(), t.getMonth(), 1); };
  const sumOf = (rows, k) => (rows || []).reduce((n, r) => n + (r[k] || 0), 0);
  const dayWords = d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  /* ---- Fetching, once, then from memory for two minutes -------------------
     need(key, fetch) gives back what's already here (undefined the first
     time, while it loads) and redraws the screen when the answer lands.
     A failed fetch is remembered as null for the same two minutes, so a
     missing function can't set off a loop. */
  const siteGot = new Map(), sitePending = new Map();
  function need(key, fetcher, maxAge) {
    const hit = siteGot.get(key);
    const fresh = hit && Date.now() - hit.at < (maxAge || 120000);
    if (!fresh && !sitePending.has(key)) {
      sitePending.set(key, Promise.resolve().then(fetcher)
        .then(data => { siteGot.set(key, { at: Date.now(), data }); })
        .catch(err => { console.warn('Insights: ' + key, err); siteGot.set(key, { at: Date.now(), data: null }); })
        .finally(() => { sitePending.delete(key); redrawSoon(); }));
    }
    return hit ? hit.data : undefined;
  }
  let redrawQueued = false;
  function redrawSoon() {
    if (redrawQueued) return;
    redrawQueued = true;
    setTimeout(() => {
      redrawQueued = false;
      if (state.view === 'data') renderInsights();
      else if (state.view === 'carfig') renderCarFigures();
      else if (state.view === 'carcmp') renderCompare();
      else if (state.view === 'motcal') renderMotCal();
      else if (state.view === 'home') renderHome();
    }, 30);
  }

  /** site_stats for a stretch of time (and one car's days). null = v14 not run. */
  async function siteStats(from, to, car) {
    if (state.schema.v14 === false) return null;
    const { data, error } = await sb.rpc('site_stats', {
      p_from: new Date(from).toISOString(),
      p_to: (to ? new Date(to) : new Date()).toISOString(),
      p_car: car || null
    });
    if (error) {
      if (/PGRST202|could not find the function|site_stats|schema cache/i.test((error.code || '') + ' ' + (error.message || ''))) state.schema.v14 = false;
      throw error;
    }
    state.schema.v14 = true;
    return data;
  }

  /** The latest taps (v14), newest first. */
  async function contactFeed() {
    if (state.schema.v14 === false) return null;
    const { data, error } = await sb.rpc('contact_feed', {
      p_since: addDays(startDay(new Date()), -30).toISOString(), p_limit: 120 });
    if (error) {
      if (/PGRST202|could not find the function|contact_feed|schema cache/i.test((error.code || '') + ' ' + (error.message || ''))) state.schema.v14 = false;
      throw error;
    }
    return data || [];
  }

  /** Every form and car request in the last 60 days, archived ones too:
      the Inbox only loads what isn't archived, and a week's count shouldn't
      drop because a message was dealt with. */
  async function recentMessages() {
    const since = addDays(startDay(new Date()), -60).toISOString();
    const [e, r] = await Promise.all([
      sb.from('enquiries').select('id,created_at,kind,car_id,car_title,name,part_ex,finance_interest,details,is_read,archived')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(400),
      sb.from('wanted_requests').select('id,created_at,kind,car_id,name,make,model,transmission,fuel,budget_max,is_read,archived')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(400)
    ]);
    return { enquiries: e.error ? [] : (e.data || []), requests: r.error ? [] : (r.data || []) };
  }

  /* The windows the summary compares: the last 7 days up to now, and the 7
     days before up to the same time of day, so a morning isn't set against
     a whole day. Boundaries sit on the minute so they can be remembered. */
  function weekWindows() {
    const now = Math.floor(Date.now() / 60000) * 60000;
    const from = addDays(startDay(new Date()), -6);
    return { from, prevFrom: addDays(from, -7), prevTo: new Date(now - 7 * DAY), now };
  }
  function weekFigures() {
    const w = weekWindows();
    const cur = need('w7', () => siteStats(w.from));
    const prev = need('p7', () => siteStats(w.prevFrom, w.prevTo));
    const msgs = need('msgs', recentMessages);
    return { w, cur, prev, msgs };
  }

  /* ---- Words ---------------------------------------------------------------- */
  const PAGE_NAME = {
    home: 'Homepage', stock: 'Stock list', car: 'Car pages', contact: 'Contact', sell: 'Sell your car',
    wanted: 'Car finder', 'find-us': 'Find us', privacy: 'Privacy', terms: 'Terms', '404': 'Page not found', other: 'Other pages'
  };
  const PAGE_WORDS = {
    home: 'the homepage', stock: 'the stock list', car: 'a car’s page', contact: 'the contact page',
    sell: 'the sell your car page', wanted: 'the car finder', 'find-us': 'the Find us page', privacy: 'the privacy page',
    terms: 'the terms page', '404': 'a page that doesn’t exist', other: 'another page'
  };
  const PLACE_WORDS = {
    header: 'in the top bar', menu: 'in the menu', bar: 'in the bottom bar', footer: 'at the foot of the page',
    buy: 'in the price box', hero: 'at the top of the homepage', 'sell-cta': 'under “Sell your car”',
    card: 'on the page', 'about-car': 'next to the car', 'after-form': 'after sending the form', page: 'on the page'
  };
  const KIND_WORDS = { whatsapp_click: 'WhatsApp', phone_click: 'Call', email_click: 'Email' };
  const KIND_ICON = { whatsapp_click: 'whatsapp', phone_click: 'phone', email_click: 'mail' };
  const SOURCE_WORDS = {
    direct: 'Typed in, saved, or a link in a message', search: 'Google or another search engine',
    facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', twitter: 'X (Twitter)', whatsapp: 'WhatsApp',
    autotrader: 'Autotrader', gumtree: 'Gumtree', share: 'A car someone shared from the website',
    referral: 'Another website', stock: 'Your stock list', home: 'Your homepage', internal: 'Another of your pages'
  };
  const sourceWords = s => SOURCE_WORDS[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Not known');
  const DEVICE_WORDS = { mobile: 'Phones', tablet: 'Tablets', desktop: 'Computers' };

  /** "up 18% on", "about the same as", "against 4" (small numbers get no %). */
  function trendWords(a, b) {
    if (b == null) return '';
    if (b < 10 || a < 10) return a === b ? `the same as the ${nf(b)}` : `against ${nf(b)}`;
    const change = Math.round((a - b) / b * 100);
    if (Math.abs(change) < 5) return `about the same as the ${nf(b)}`;
    return `${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% on the ${nf(b)}`;
  }
  const times = (n, one, many) => n === 1 ? '1 ' + one : nf(n) + ' ' + (many || one + 's');

  /* What each figure means, behind the ⓘ beside it */
  const EXPLAIN = {
    views: ['Page views', 'Every time a page of the website is opened. One person looking at three cars is three views, and opening the same page again counts again. Your own phones are left out once they’re marked (gear → Don’t count this phone).'],
    people: ['People', 'Each visitor counted once a day, however many pages they open. There are no cookies: a code is made from their connection and phone that changes every day, so nobody can be followed, and the same person on two different days counts twice. Bots are left out. Needs the visitor counter switched on (gear → Ready to switch on).'],
    taps: ['Taps to get in touch', 'Someone tapped WhatsApp, Call or Email on the website. A tap opens WhatsApp or the phone’s dialler: whether they then sent a message or rang, the website can’t know. Forms that did arrive are in your Inbox, and are shown alongside.'],
    photos: ['Opened the photos', 'Tapped into the big photo viewer on a car’s page. Someone who does that is looking properly, not just passing.'],
    messages: ['Messages', 'Forms sent from the website: questions about a car, part exchanges, sell your car, finance. They’re in your Inbox. Messages sent straight on WhatsApp, and phone calls, never pass through the website, so they can’t be counted here.'],
    sources: ['Where they came from', 'Worked out from the page someone was on just before (Google, Facebook, Autotrader…). WhatsApp, texts, emails and most apps don’t pass that on, so anyone who tapped a link in a message, typed the address or used a bookmark shows as “Typed in, saved, or a link in a message”. Cars shared with the Share button on the website show as “shared”. Moving between your own pages isn’t counted as coming from somewhere.'],
    busy: ['Busier than most', 'Compared with the typical car in stock over the same days: the one in the middle when they’re put in order of views. Twice the views or more is one of your busiest; half or less is quieter than most.'],
    funnel: ['From looking to buying', 'How far people got with this car. Each step is out of the views at the top. Lots of views but few photo opens usually means the first photo or the price in the list isn’t pulling people in; lots of photo opens but no taps points at the price or something in the details.'],
    places: ['Which button', 'Where the WhatsApp, Call or Email button was: the top bar and bottom bar are on every page, the price box is on each car’s page.'],
    counting: ['How the website is counted', 'No cookies and nothing stored on customers’ phones. Page views count every time a page opens. Once the visitor counter is on, people are counted once a day each and bots are left out. Your own phones are left out once marked.']
  };
  const info = key => `<button class="info" type="button" data-explain="${key}" aria-label="What this means">i</button>`;
  function explain(key) {
    const e = EXPLAIN[key];
    if (!e) return;
    sheetHtml(e[0], '', `<p class="explain">${esc(e[1])}</p>`);
  }

  /* ---- Messages for a car or a stretch of time --------------------------- */
  const messagesFor = (msgs, carId) => ((msgs && msgs.enquiries) || []).filter(e => String(e.car_id || '') === String(carId));
  const inWindow = (list, from, to) => (list || []).filter(x => { const t = new Date(x.created_at); return t >= from && (!to || t < to); });

  /* ==========================================================================
     SUMMARY: the last 7 days in sentences, then the decisions, who tapped
     what, and what people ask for that isn't in stock
     ========================================================================== */
  function summaryTab() {
    return `
      ${weekCard(false)}
      ${decisionsHtml()}
      ${feedCard()}
      ${askedForCard()}
      ${countingNote()}`;
  }

  /**
   * The last 7 days, in sentences, with one thing to do. Used on Home too
   * (compact: fewer sentences, the button goes to Insights).
   */
  function weekFacts() {
    const { w, cur, prev, msgs } = weekFigures();
    const facts = [];
    const now = new Date();

    if (cur) {
      const views = sumOf(cur.days, 'views'), carViews = sumOf(cur.days, 'car_views');
      const pagesSince = cur.pages_since ? new Date(cur.pages_since) : null;
      const fair = prev && pagesSince && pagesSince <= w.prevFrom;           // every page counted in both weeks
      const people = cur.days.every(d => d.people != null) ? sumOf(cur.days, 'people') : null;
      if (pagesSince && pagesSince <= now) {
        facts.push({ key: 'views', text: `The website had <b>${times(views, 'page view')}</b> in the last 7 days${
          people != null ? ` from about ${times(people, 'person', 'people')}` : ''}${
          fair ? `, ${trendWords(views, sumOf(prev.days, 'views'))} the week before` : ''}.` });
      }
      if (!fair || !pagesSince) {
        facts.push({ key: 'views', text: `Car pages were opened <b>${times(carViews, 'time')}</b> in the last 7 days${
          prev ? `, ${trendWords(carViews, sumOf(prev.days, 'car_views'))} the week before` : ''}.` });
      }

      const top = (cur.cars || []).map(r => ({ r, c: state.cars.find(c => String(c.id) === String(r.car_id)) }))
        .filter(x => x.c && x.r.views).sort((a, b) => b.r.views - a.r.views)[0];
      if (top) facts.push({ car: top.c.id, text: `The {car} was looked at most (${times(top.r.views, 'view')}${
        top.r.taps ? `, ${times(top.r.taps, 'tap')} to get in touch` : ''}).` });

      const taps = sumOf(cur.days, 'taps');
      const onCars = sumOf((cur.places || []).filter(p => p.with_car), 'taps');
      facts.push({ key: 'taps', text: taps
        ? `<b>${times(taps, 'tap')}</b> on WhatsApp, Call or Email${onCars && onCars < taps ? `: ${nf(onCars)} about a car, ${nf(taps - onCars)} from other pages` : onCars ? ', all about a car' : ', none about a particular car'}.`
        : `Nobody tapped WhatsApp, Call or Email on the website.` });
    }

    if (msgs) {
      const forms = inWindow(msgs.enquiries, w.from);
      const reqs = inWindow(msgs.requests, w.from);
      const aboutCar = forms.filter(e => e.car_id).length;
      facts.push({ key: 'messages', text: forms.length || reqs.length
        ? `${forms.length ? `<b>${times(forms.length, 'message')}</b> came through the website${aboutCar ? ` (${nf(aboutCar)} about a car)` : ''}` : 'No messages came through the website'}${
          reqs.length ? `${forms.length ? ', and' : ', but'} ${times(reqs.length, 'person', 'people')} asked you to find a car` : ''}.`
        : 'No messages came through the website’s forms.' });
    }

    const sold = state.cars.filter(c => c.status === 'sold' && c.sold_at && new Date(c.sold_at) >= w.from);
    if (sold.length) {
      const counted = sold.filter(c => carMargin(c) != null);
      facts.push({ text: `${times(sold.length, 'car')} sold${counted.length ? `, making <b>${signed(counted.reduce((n, c) => n + carMargin(c), 0))}</b>${counted.length < sold.length ? ' on the ones with figures in' : ''}` : ''}.` });
    }
    return { facts, loading: cur === undefined || msgs === undefined, v14: state.schema.v14 !== false };
  }

  /** The one thing worth doing first, from what's waiting. */
  function weekAction() {
    const unread = state.enquiries.filter(e => !e.is_read).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
    if (unread) {
      const about = unread.car_title ? 'the ' + unread.car_title : unread.kind === 'sell' ? 'their car' : ((unread.details && unread.details.subject) || '').toLowerCase();
      return { label: `Reply to ${unread.name || 'a message'}${about ? ' about ' + about : ''}`, run: () => openMessage('e', unread.id) };
    }
    const act = analysis && analysis.findings.find(f => f.severity === 'act');
    if (act) {
      const car = state.cars.find(c => String(c.id) === String(act.carId));
      return { label: `${CAUSE_DO[act.cause] || 'Look at'}: ${car ? carTitle(car) : act.title}`, run: () => insightSheet(analysis.findings.indexOf(act)) };
    }
    return null;
  }

  let weekActs = [];
  function weekCard(home) {
    const { facts, loading, v14 } = weekFacts();
    const act = weekAction();
    weekActs = [];
    const shown = home ? facts.slice(0, 3) : facts;
    const lines = shown.map(f => {
      if (f.car) {
        const i = weekActs.push(() => openCarFigures(f.car)) - 1;
        return `<p>${f.text.replace('{car}', `<button class="linkish" type="button" data-week="${i}">${esc(carTitle(carById(f.car)))}</button>`)}</p>`;
      }
      return `<p>${f.text}${!home && f.key ? ' ' + info(f.key) : ''}</p>`;
    }).join('');
    const go = act ? weekActs.push(act.run) - 1 : -1;
    const more = home ? weekActs.push(() => openDataTab('summary')) - 1 : -1;
    return `<div class="section-card week-card${home ? ' week-card--home' : ''}">
      <div class="card-head"><h2>Last 7 days</h2>${home ? `<button class="home-link" type="button" data-week="${more}">More</button>` : ''}</div>
      ${lines || (loading ? '<div class="skel" style="height:60px"></div>' : '<p class="note">Nothing to report yet.</p>')}
      ${loading && lines ? '<p class="note">Adding up the website…</p>' : ''}
      ${!v14 && !home ? '<p class="note">Website figures need <b>schema-v14-site-analytics.sql</b> run in Supabase (gear → Ready to switch on).</p>' : ''}
      ${act ? `<button class="btn btn--accent btn--sm btn--block week-go" type="button" data-week="${go}">${esc(act.label)} ${icon('right')}</button>` : ''}
    </div>`;
  }

  /* ---- Who tapped what ------------------------------------------------------
     Taps (from the website) and messages (forms that arrived) in one list,
     newest first. Taps from one visit, one button, one car within half an
     hour fold into one line ("3 times"). A tap about a car that a message
     about the same car followed within two days says so. */
  function feedItems() {
    const feed = need('feed', contactFeed);
    const msgs = need('msgs', recentMessages);
    const since = addDays(startDay(new Date()), -30);
    const items = [];

    const taps = (feed || []).slice().sort((a, b) => new Date(b.at) - new Date(a.at));
    for (const t of taps) {
      const last = items[items.length - 1];
      if (last && last.type === 'tap' && last.who === t.who && last.kind === t.kind && String(last.car_id) === String(t.car_id)
          && new Date(last.first) - new Date(t.at) < 30 * 60000) {
        last.n++; last.first = t.at; continue;
      }
      items.push(Object.assign({ type: 'tap', n: 1, first: t.at }, t));
    }
    const enq = inWindow(msgs && msgs.enquiries, since);
    enq.forEach(e => items.push({ type: 'form', at: e.created_at, e }));
    inWindow(msgs && msgs.requests, since).forEach(r => items.push({ type: 'request', at: r.created_at, r }));
    items.sort((a, b) => new Date(b.at) - new Date(a.at));

    // A message about the same car within two days of the tap
    items.forEach(it => {
      if (it.type !== 'tap' || !it.car_id) return;
      const t = new Date(it.at);
      it.followed = enq.find(e => String(e.car_id) === String(it.car_id) && new Date(e.created_at) >= t && new Date(e.created_at) - t < 2 * DAY) || null;
    });
    return { items, loading: feed === undefined || msgs === undefined, taps: feed };
  }

  const whenWords = d => {
    const t = new Date(d), mins = (Date.now() - t) / 60000;
    if (mins < 60) return Math.max(1, Math.round(mins)) + ' min ago';
    const time = t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (startDay(t).getTime() === startDay(new Date()).getTime()) return 'Today ' + time;
    if (startDay(t).getTime() === addDays(startDay(new Date()), -1).getTime()) return 'Yesterday ' + time;
    return t.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + time;
  };
  const carById = id => state.cars.find(c => String(c.id) === String(id)) || null;

  let feedActs = [];
  function feedLine(it) {
    let ic, text, sub = [], tail = '', run = null;
    if (it.type === 'tap') {
      const car = it.car_id && carById(it.car_id);
      ic = KIND_ICON[it.kind] || 'phone';
      const where = car
        ? (it.page === 'car' ? `on the <b>${esc(carTitle(car))}</b>’s page` : `on ${PAGE_WORDS[it.page] || 'the website'} about the <b>${esc(carTitle(car))}</b>`)
        : `on ${PAGE_WORDS[it.page] || 'the website'}`;
      text = `Someone tapped <b>${KIND_WORDS[it.kind] || 'contact'}</b>${it.n > 1 ? ` (${it.n} times)` : ''} ${where} ${PLACE_WORDS[it.place] && it.place !== 'page' && it.place !== 'card' ? PLACE_WORDS[it.place] : ''}`.trim();
      if (it.source && !['stock', 'home', 'internal'].includes(it.source)) sub.push('came from ' + sourceWords(it.source).replace(/^Typed in, saved, or a link in a message$/, 'a link, a bookmark or typed in'));
      if (it.device) sub.push(it.device === 'mobile' ? 'on a phone' : it.device === 'tablet' ? 'on a tablet' : 'on a computer');
      const looked = (it.journey || []).filter(j => !(j.car_id && String(j.car_id) === String(it.car_id)))
        .map(j => j.car_id ? (carById(j.car_id) ? carTitle(carById(j.car_id)) : 'a car that’s gone') : PAGE_NAME[j.page] && j.page !== 'car' ? (PAGE_NAME[j.page]).toLowerCase() : null)
        .filter(Boolean);
      if (looked.length) tail = `<span class="feed-more">Had looked at: ${esc([...new Set(looked)].slice(-4).join(', '))}</span>`;
      if (it.followed) tail += `<span class="feed-more feed-more--ok">${icon('check')} A message about this car came in after</span>`;
      if (car) run = () => openCarFigures(car.id);
    } else if (it.type === 'form') {
      const e = it.e;
      ic = 'inbox';
      const about = e.kind === 'sell' ? (e.car_id ? 'a part exchange against the ' + (e.car_title || 'a car') : 'selling their car')
        : e.car_title ? 'the ' + e.car_title : ((e.details && e.details.subject) || 'a general question');
      text = `<b>${esc(e.name || 'Someone')}</b> sent a message about ${esc(about)}`;
      if (e.finance_interest) sub.push('asked about finance');
      if (e.archived) sub.push('archived');
      run = () => openMessage('e', e.id);
    } else {
      const r = it.r;
      ic = 'search';
      const what = [r.make, r.model].filter(Boolean).join(' ') || 'a car';
      text = `<b>${esc(r.name || 'Someone')}</b> asked you to find ${esc(r.kind === 'sold_interest' ? 'one like a car you sold' : what)}`;
      if (r.budget_max) sub.push('up to ' + money(r.budget_max));
      if (r.transmission) sub.push(r.transmission);
      run = () => openMessage('r', r.id);
    }
    const i = run ? feedActs.push(run) - 1 : -1;
    const tag = run ? 'button' : 'div';
    return `<${tag} class="feed-row feed-row--${it.type}"${run ? ` type="button" data-feed="${i}"` : ''}>
      <span class="feed-ic">${icon(ic)}</span>
      <span class="feed-txt">
        <span class="feed-what">${text}</span>
        <small>${esc([whenWords(it.at)].concat(sub).join(' · '))}</small>
        ${tail}
      </span>
    </${tag}>`;
  }

  function feedCard() {
    feedActs = [];
    const { items, loading, taps } = feedItems();
    const SHOWN = 8;
    const rows = items.slice(0, 60).map(feedLine);
    return `<div class="section-card feed">
      <div class="card-head"><h2>Who tapped what</h2>${info('taps')}</div>
      <p class="note" style="margin:-4px 0 10px">The last 30 days. A tap opens WhatsApp or the phone; messages are forms that arrived.</p>
      ${rows.length ? rows.slice(0, SHOWN).join('') : loading ? '<div class="skel" style="height:120px"></div>' : '<p class="hint">Nothing in the last 30 days.</p>'}
      ${rows.length > SHOWN ? `<details class="more-insights"><summary>Show ${rows.length - SHOWN} more</summary>${rows.slice(SHOWN).join('')}</details>` : ''}
      ${taps === null && state.schema.v14 === false ? '<p class="note" style="margin-top:10px">Taps show here once <b>schema-v14-site-analytics.sql</b> is run. Until then, only messages.</p>' : ''}
    </div>`;
  }

  /* ---- Asked for, not in stock --------------------------------------------- */
  function askedForCard() {
    if (!demand || !demand.length) return '';
    const inStockCount = d => state.cars.filter(c => inStock(c) && keyOf(c.make) === keyOf(d.make)
      && (!d.model || d.model === 'Any' || modelKeyOf(c.model) === modelKeyOf(d.model))).length;
    const rows = demand.slice().map(d => ({ d, have: inStockCount(d) }))
      .sort((a, b) => (a.have > 0) - (b.have > 0) || b.d.requests - a.d.requests).slice(0, 6);
    return `<div class="section-card">
      <div class="card-head"><h2>What people ask you to find</h2></div>
      <p class="note" style="margin:-4px 0 10px">From the Car Finder and “want one like this” on sold cars. Worth looking out for at the next auction.</p>
      ${rows.map(({ d, have }) => `<div class="ask-row">
        <div><strong>${esc(d.make)}${d.model && d.model !== 'Any' ? ' ' + esc(d.model) : ''}</strong>
          <small>${[d.avg_budget ? 'budget about ' + money(d.avg_budget) : 'no budget given', d.still_open ? d.still_open + ' still looking' : '', have ? `you have ${have} in stock` : 'none in stock'].filter(Boolean).join(' · ')}</small></div>
        <span class="pill ${d.requests >= 3 ? 'pill--green' : 'pill--grey'}">${times(d.requests, 'person', 'people')}</span>
      </div>`).join('')}
      <button class="btn btn--outline btn--sm btn--block" id="exportDemand" type="button" style="margin-top:10px">Export requests (CSV)</button>
    </div>`;
  }

  /** How the website is being counted, and what would make it better. */
  function countingNote() {
    if (state.schema.v14 === false) {
      return `<p class="note counting">${info('counting')} Only car pages are counted so far. Run <b>schema-v14-site-analytics.sql</b> to count every page and every tap.</p>`;
    }
    const s = [...siteGot.values()].map(x => x.data).find(d => d && d.days);
    if (!s) return '';
    const bits = [];
    if (!s.v2_since) bits.push('Counting page views. Switch on the visitor counter (gear → Ready to switch on) to count people and leave bots out.');
    else bits.push(`Counting people since ${shortDay(s.v2_since)}${s.bots ? `, with ${nf(s.bots)} bot visit${s.bots === 1 ? '' : 's'} left out` : ''}.`);
    if (s.pages_since) bits.push(`Every page counted since ${shortDay(s.pages_since)}; before that, car pages only.`);
    return `<p class="note counting">${info('counting')} ${esc(bits.join(' '))}</p>`;
  }

  /* ==========================================================================
     CARS: one sentence each, then each car's own screen
     ========================================================================== */
  const CAR_PERIODS = { 7: 'Last 7 days', 30: 'Last 30 days', all: 'Since listed' };
  const CAR_SORTS = {
    views: 'Most viewed', quiet: 'Least viewed', taps: 'Most taps', oldest: 'Longest in',
    newest: 'Newest in', price_high: 'Dearest', price_low: 'Cheapest'
  };

  function periodFrom(p) {
    return p === 'all' ? addDays(startDay(new Date()), -399) : addDays(startDay(new Date()), -(+p - 1));
  }
  function carPeriodData(p) {
    const key = 'cars:' + p;
    return need(key, () => siteStats(periodFrom(p)));
  }
  const periodWords = (p, car) => p === 'all' ? (car ? 'since it went on' : 'since each went on') : `in the last ${p} days`;

  /** Views of the typical (median) live car, for "busier than most". */
  function medianViews(rows, live) {
    const v = live.map(c => ((rows || []).find(r => String(r.car_id) === String(c.id)) || {}).views || 0).sort((a, b) => a - b);
    if (v.length < 3) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  /** People are only worth quoting if the visitor counter was on for the whole stretch. */
  const peopleFrom = (data, from) => !!(data && data.v2_since && new Date(data.v2_since) <= from);

  /** One car's figures as one sentence. `people`: quote people, not just views. */
  function carSentence(c, r, p, median, msgs, people) {
    if (!r) r = {};
    const parts = [];
    const views = r.views || 0;
    parts.push(`<b>${times(views, 'view')}</b>${people && r.people ? ` (${times(r.people, 'person', 'people')})` : ''} ${periodWords(p, true)}`);
    if (views) {
      parts.push(people && r.photo_people ? `${times(r.photo_people, 'person', 'people')} opened the photos`
        : r.photos ? `the photos were opened ${r.photos === 1 ? 'once' : nf(r.photos) + ' times'}`
        : 'nobody opened the photos');
    }
    const kinds = [r.wa ? times(r.wa, 'WhatsApp', 'WhatsApp') : '', r.phone ? times(r.phone, 'call') : '', r.email ? times(r.email, 'email') : ''].filter(Boolean);
    parts.push(r.taps ? `${times(r.taps, 'tap')} to get in touch (${kinds.join(', ')})` : 'no taps to get in touch');
    const from = p === 'all' ? new Date(listedAt(c)) : periodFrom(p);
    const m = inWindow(messagesFor(msgs, c.id), from).length;
    if (m) parts.push(times(m, 'message'));
    let s = (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]) + '.';
    if (median != null && median > 0 && views >= 5 && views >= median * 2) s += ' One of your busiest.';
    else if (median != null && median >= 4 && views <= median / 2) s += ' Quieter than most of your stock.';
    return s;
  }

  function carsTab() {
    const p = CAR_PERIODS[state.carPeriod] ? state.carPeriod : '30';
    const sort = CAR_SORTS[state.carSort] ? state.carSort : 'views';
    const data = carPeriodData(p);
    const msgs = need('msgs', recentMessages);
    const live = state.cars.filter(inStock);
    const rowOf = c => data ? (data.cars || []).find(r => String(r.car_id) === String(c.id)) || {} : legacyRowOf(c);
    const loading = data === undefined;
    const median = data ? medianViews(data.cars, live) : null;
    const speed = (analysis && analysis.speed) || { watchDays: 45, actDays: 60 };

    const cmp = {
      views: (a, b) => (rowOf(b).views || 0) - (rowOf(a).views || 0) || (rowOf(b).taps || 0) - (rowOf(a).taps || 0),
      quiet: (a, b) => (rowOf(a).views || 0) - (rowOf(b).views || 0),
      taps: (a, b) => (rowOf(b).taps || 0) - (rowOf(a).taps || 0) || (rowOf(b).views || 0) - (rowOf(a).views || 0),
      oldest: (a, b) => listedAt(a) - listedAt(b),
      newest: (a, b) => listedAt(b) - listedAt(a),
      price_high: (a, b) => (b.price || 0) - (a.price || 0),
      price_low: (a, b) => (a.price || 0) - (b.price || 0)
    }[sort];

    const rows = loading ? '' : live.slice().sort(cmp).map(c => {
      const r = rowOf(c);
      const d = daysIn(c);
      const f = analysis && analysis.findings.find(x => String(x.carId) === String(c.id));
      const imgs = Array.isArray(c.images) ? c.images : [];
      const sentence = data ? carSentence(c, r, p, median, msgs, peopleFrom(data, p === 'all' ? new Date(listedAt(c)) : periodFrom(p)))
        : `<b>${times(r.views || 0, 'page view')}</b> and ${times(r.taps || 0, 'tap')} to get in touch since it went on.`;
      return `<button class="carline" type="button" data-carfig="${esc(c.id)}">
        <img src="${imgs.length ? imgUrl(imgs[0], 160) : ''}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
        <span class="carline-txt">
          <span class="carline-top"><strong>${esc(carTitle(c))}</strong>
            <span class="pill ${d >= speed.actDays ? 'pill--red' : d >= speed.watchDays ? 'pill--amber' : 'pill--grey'}" title="Days in stock">${d}d</span></span>
          <small>${[money(c.price), c.registration ? fmtReg(c.registration) : '', c.status === 'reserved' ? 'reserved' : ''].filter(Boolean).join(' · ')}</small>
          <span class="carline-say">${sentence}</span>
          ${f && CAUSE_LABEL[f.cause] ? `<span class="carline-flag carline-flag--${f.severity}">${esc(f.severity === 'good' ? 'Lots of interest: hold the price' : CAUSE_LABEL[f.cause])}</span>` : ''}
        </span>
      </button>`;
    }).join('');

    return `
      <div class="segment segment--sm" id="carPeriod" role="tablist">
        ${Object.entries(CAR_PERIODS).map(([k, label]) => `<button type="button" data-p="${k}" class="${k === p ? 'is-on' : ''}">${label}</button>`).join('')}
      </div>
      <div class="section-card">
        <div class="card-head">
          <h2>In stock · ${live.length}</h2>
          <select class="sel sel--sm" id="carSort" aria-label="Order the cars by">
            ${Object.entries(CAR_SORTS).map(([k, label]) => `<option value="${k}"${k === sort ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        ${data === undefined ? '<div class="skel" style="height:160px"></div>' : ''}
        ${data === null && state.schema.v14 === false ? '<p class="note" style="margin-bottom:10px">Showing page views since each car went on. Run <b>schema-v14-site-analytics.sql</b> for the last 7 or 30 days, and every tap.</p>' : ''}
        ${rows || (loading ? '' : '<p class="hint">No cars in stock at the moment.</p>')}
        ${median != null ? `<p class="note" style="margin-top:10px">The typical car had ${times(Math.round(median), 'view')} ${periodWords(p)}. ${info('busy')}</p>` : ''}
      </div>
      <div class="btn-pair">
        <button class="btn btn--outline btn--block" type="button" id="compareCars">${icon('gauge')} Compare cars</button>
        <button class="btn btn--outline btn--block" type="button" id="exportCars">Export (CSV)</button>
      </div>
      ${countingNote()}`;
  }

  /** Before v14: the old all-time page views and taps per car (car_stats). */
  function legacyRowOf(c) {
    const s = (stats || []).find(r => String(r.car_id) === String(c.id)) || {};
    return { views: s.views || 0, taps: (s.whatsapp_clicks || 0) + (s.phone_clicks || 0), photos: s.gallery_opens || 0,
      wa: s.whatsapp_clicks || 0, phone: s.phone_clicks || 0 };
  }

  /* ---- One car's own screen -------------------------------------------------- */
  function openCarFigures(id) {
    const car = carById(id);
    if (!car) return toast('Couldn’t find that car');
    state.carFig = String(car.id);
    go('carfig', { title: carTitle(car) });
  }

  const carSince = car => {
    const from = startDay(new Date(listedAt(car) || Date.now()));
    const floor = addDays(startDay(new Date()), -399);
    return from < floor ? floor : from;
  };
  const carUntil = car => car.status === 'sold' && car.sold_at ? addDays(startDay(new Date(car.sold_at)), 1) : null;

  function carFigData(car) {
    return need('car:' + car.id, () => siteStats(carSince(car), carUntil(car), car.id));
  }
  function priceHistory(car) {
    return need('ph:' + car.id, async () => {
      const { data, error } = await sb.from('price_history').select('*').eq('car_id', car.id).order('changed_at', { ascending: true });
      return error ? [] : (data || []);
    }, 600000);
  }

  ON_SHOW.carfig = () => renderCarFigures();

  function renderCarFigures() {
    const car = carById(state.carFig);
    const box = $('#carfigBody');
    if (!car) { box.innerHTML = '<p class="hint">That car isn’t in your list any more.</p>'; return; }
    const d = carFigData(car);
    const ph = priceHistory(car) || [];
    const msgs = need('msgs', recentMessages);
    const month = carPeriodData('30');
    const r = d ? ((d.cars || []).find(x => String(x.car_id) === String(car.id)) || {}) : legacyRowOf(car);
    const imgs = Array.isArray(car.images) ? car.images : [];
    const f = analysis && analysis.findings.find(x => String(x.carId) === String(car.id));
    const fi = f ? analysis.findings.indexOf(f) : -1;
    const sold = car.status === 'sold';
    const ci = interest && countingPeople() ? interestFor(car.id) : null;

    // Rank among live cars over the last 30 days
    let rank = '';
    if (month && !sold) {
      const live = state.cars.filter(inStock);
      const order = live.map(c => ({ c, v: ((month.cars || []).find(x => String(x.car_id) === String(c.id)) || {}).views || 0 }))
        .sort((a, b) => b.v - a.v);
      const at = order.findIndex(x => String(x.c.id) === String(car.id));
      if (at >= 0 && live.length > 2) rank = `The ${at ? ordinal(at + 1) + ' ' : ''}most looked-at of your ${live.length} cars over the last 30 days.`;
    }

    const since = new Date(listedAt(car));
    const enqs = messagesFor(msgs, car.id).concat(state.enquiries.filter(e => String(e.car_id) === String(car.id)))
      .filter((e, i, all) => all.findIndex(x => x.id === e.id) === i)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const soldSame = soldLike(car), achieved = averageAchieved(soldSame);

    box.innerHTML = `
      <div class="section-card cf-head">
        <div class="cf-top">
        ${imgs.length ? `<img src="${imgUrl(imgs[0], 240)}" alt="" onerror="this.remove()">` : ''}
        <div>
          <h2>${esc(carTitle(car))}</h2>
          <p>${sold ? `Sold ${shortDay(car.sold_at)} after ${Math.max(0, Math.round((new Date(car.sold_at) - since) / DAY))} days` : `${money(car.price)} · ${daysIn(car)} days in stock`}${car.registration ? ' · ' + esc(fmtReg(car.registration)) : ''}</p>
        </div>
        </div>
        <div class="btn-pair">
          ${!sold ? `<button class="btn btn--outline btn--sm" type="button" id="cfPrice">Change price</button>` : ''}
          <button class="btn btn--outline btn--sm" type="button" id="cfMenu">Car menu</button>
        </div>
      </div>

      <div class="section-card">
        <div class="card-head"><h2>${sold ? 'While it was for sale' : 'Since it went on'}</h2>${info('views')}</div>
        <p class="cf-say">${d === undefined ? 'Adding it up…' : carSentence(car, r, 'all', null, msgs, peopleFrom(d, carSince(car)))}</p>
        ${rank ? `<p class="note">${esc(rank)}</p>` : ''}
        ${d && d.car_days ? carDaysChart(d.car_days, ph) : ''}
        ${ph.length ? `<p class="note" style="margin-top:8px">${ph.map(x => `${shortDay(x.changed_at)}: ${money(x.old_price)} → ${money(x.new_price)}`).join(' · ')}</p>` : ''}
      </div>

      ${f ? insightCard(f, fi) : ''}

      <div class="section-card">
        <div class="card-head"><h2>From looking to buying</h2>${info('funnel')}</div>
        ${funnelHtml(car, r, enqs, peopleFrom(d, carSince(car)))}
        ${ci && ci.measured_people ? `<p class="note" style="margin-top:10px">${esc([
          ci.median_seconds != null ? `A typical visit lasts ${ci.median_seconds < 60 ? ci.median_seconds + ' seconds' : Math.round(ci.median_seconds / 60) + ' min'}` : '',
          ci.avg_photos_seen != null && imgs.length ? `people see ${Math.round(ci.avg_photos_seen)} of its ${imgs.length} photos on average` : '',
          ci.quick_exits ? `${ci.quick_exits} of ${ci.measured_people} left within 10 seconds` : ''].filter(Boolean).join(', '))}.</p>` : ''}
      </div>

      ${d && d.car_sources && d.car_sources.length ? `<div class="section-card">
        <div class="card-head"><h2>How people found it</h2>${info('sources')}</div>
        ${listBars(d.car_sources.map(s => ({ label: sourceWords(s.source), n: s.views })))}
      </div>` : ''}

      ${d && d.car_places && d.car_places.length ? `<div class="section-card">
        <div class="card-head"><h2>Which button they tapped</h2>${info('places')}</div>
        ${listBars(d.car_places.map(p => ({ label: `${KIND_WORDS[p.kind]} ${PLACE_WORDS[p.at] && p.at !== 'page' ? PLACE_WORDS[p.at] : ''}${p.page !== 'car' ? ' (' + (PAGE_NAME[p.page] || p.page).toLowerCase() + ')' : ''}`.trim(), n: p.taps })))}
      </div>` : ''}

      ${enqs.length ? `<div class="section-card">
        <div class="card-head"><h2>Messages about it · ${enqs.length}</h2>${info('messages')}</div>
        ${enqs.slice(0, 8).map(e => `<button class="feed-row" type="button" data-msg="${esc(e.id)}">
          <span class="feed-ic">${icon('inbox')}</span>
          <span class="feed-txt"><span class="feed-what"><b>${esc(e.name || 'Someone')}</b>${e.kind === 'sell' ? ' (part exchange)' : ''}</span><small>${esc(whenWords(e.created_at))}</small></span>
        </button>`).join('')}
      </div>` : ''}

      ${!sold ? `<div class="section-card">
        <h2>What you’ve sold these for</h2>
        <p class="cf-say">${achieved != null
          ? `${soldSame.length === 1 ? 'One' : soldSame.length} sold for <b>${money(achieved)}</b>${soldSame.length === 1 ? '' : ' on average'}.${car.price != null && car.price - achieved > 200 ? ` This one is ${money(car.price - achieved)} above that.` : ''}`
          : 'You haven’t sold one of these before, so there’s nothing of your own to compare with.'}</p>
      </div>` : ''}

      ${countingNote()}`;

    $('#cfMenu').onclick = () => carActions(car);
    if ($('#cfPrice')) $('#cfPrice').onclick = () => repriceCar(car.id);
    box.querySelectorAll('[data-msg]').forEach(b => b.onclick = () => openMessage('e', b.dataset.msg));
    wireInsightButtons(box);
    wireSiteBits(box);
    wireCharts(box);
  }

  /** Viewed → opened photos → tapped → message → sold, as bars out of the views. */
  function funnelHtml(car, r, enqs, people) {
    const steps = [
      ['Opened its page', (people ? r.people : r.views) || 0],
      ['Opened the photos', (people ? r.photo_people : r.photos) || 0],
      ['Tapped WhatsApp, Call or Email', (people ? r.tap_people : r.taps) || 0],
      ['Sent a message', enqs.length],
      ['Sold', car.status === 'sold' ? 1 : 0]
    ];
    const top = Math.max(1, steps[0][1]);
    return `<div class="funnel">${steps.map(([label, n], i) => `
      <div class="funnel-row">
        <span>${esc(label)}</span>
        <b>${nf(n)}</b>
        <i style="width:${Math.max(n ? 3 : 0, Math.min(100, n / top * 100))}%"></i>
      </div>`).join('')}</div>
      <p class="note" style="margin-top:6px">${people ? 'Counted in people, each once a day.' : 'Counted in page views and taps, so one person can count more than once.'}</p>`;
  }

  /** A short ranked list with a bar each, biggest first. */
  function listBars(items) {
    items = items.slice().sort((a, b) => b.n - a.n);
    const max = Math.max(1, ...items.map(x => x.n));
    return `<div class="lbars">${items.slice(0, 8).map(x => `
      <div class="lbar"><span>${esc(x.label)}</span><b>${nf(x.n)}</b><i style="width:${Math.max(2, x.n / max * 100)}%"></i></div>`).join('')}</div>`;
  }

  /** A car's views per day (per week after ten weeks), price changes marked. */
  function carDaysChart(days, ph) {
    if (!days.length) return '';
    let cols = days.map(x => ({ key: x.d, short: shortDay(fromKey(x.d)), views: x.views, photos: x.photos, taps: x.taps, label: dayWords(fromKey(x.d)) }));
    if (cols.length > 70) {
      const weeks = [];
      cols.forEach(c => {
        const k = dayKey(weekStart(fromKey(c.key)));
        let w = weeks[weeks.length - 1];
        if (!w || w.key !== k) { w = { key: k, views: 0, photos: 0, taps: 0, label: 'Week of ' + shortDay(fromKey(k)), short: shortDay(fromKey(k)) }; weeks.push(w); }
        w.views += c.views; w.photos += c.photos; w.taps += c.taps;
      });
      cols = weeks;
    }
    const changed = new Set(ph.map(x => cols.length > 70 ? dayKey(weekStart(new Date(x.changed_at))) : dayKey(new Date(x.changed_at))));
    return viewBars(cols.map(c => ({
      key: c.key, value: c.views, current: false, mark: changed.has(c.key), short: c.short,
      tip: `${c.label}: ${times(c.views, 'view')}${c.photos ? ', photos opened ' + nf(c.photos) + '×' : ''}${c.taps ? ', ' + times(c.taps, 'tap') : ''}${changed.has(c.key) ? ' · price changed' : ''}`
    })), { height: 110, labels: 'ends' });
  }

  /** Gridlines for counts (views, taps): about three, on whole numbers. */
  function countScale(max) {
    const step = Math.max(1, niceStep(Math.max(max, 3)));
    const top = Math.ceil(max / step) * step || step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { top, bottom: 0, span: top, ticks };
  }

  /**
   * Bars for a count over time: one series, the app's blue, the current
   * (unfinished) period paler. Tooltip on hover and tap; tapping can pick.
   * @param {object[]} cols  { key, value, tip, current, selected, mark, short }
   * @param {object} opts    { height, pick: true to make bars selectable, labels: 'all'|'ends' }
   */
  function viewBars(cols, opts) {
    opts = opts || {};
    const sc = countScale(Math.max(...cols.map(c => c.value), 1));
    const n = cols.length;
    const label = (c, i) => opts.labels === 'all' ? (c.short || '')
      : (i === 0 || i === n - 1 || (n > 10 && i === Math.floor(n / 2))) ? (c.short || '') : '';
    return `<div class="chart" data-chart="bars" data-action="${opts.pick ? 'pick' : 'none'}">
      <div class="chart-plot" style="height:${opts.height || 140}px">
        ${sc.ticks.map(v => `<div class="grid${v === 0 ? ' grid--zero' : ''}" style="top:${(sc.top - v) / sc.span * 100}%"><span>${nf(v)}</span></div>`).join('')}
        <div class="bar-cols${n > 40 ? ' bar-cols--tight' : ''}">${cols.map(c => `
          <button class="bar-col${c.selected ? ' is-selected' : ''}" type="button" data-key="${esc(c.key)}" data-tip="${esc(c.tip)}" aria-label="${esc(c.tip)}">
            <span class="bar${c.current ? ' bar--now' : ''}" style="bottom:0;height:${c.value / sc.top * 100}%"></span>
            ${c.mark ? '<span class="bar-mark" aria-hidden="true"></span>' : ''}
          </button>`).join('')}</div>
        <div class="chart-tip" hidden></div>
      </div>
      ${opts.labels === 'ends'
        ? `<div class="chart-x chart-x--days">${cols.map((c, i) => label(c, i) ? `<span style="left:${(i + .5) / n * 100}%">${esc(label(c, i))}</span>` : '').join('')}</div>`
        : `<div class="chart-x">${cols.map((c, i) => `<span${c.current ? ' class="is-now"' : ''}>${esc(String(label(c, i)))}</span>`).join('')}</div>`}
    </div>`;
  }

  /* ---- Compare two or three cars ------------------------------------------
     Views added up day by day from the day each went on, so a car listed a
     month ago and one listed last week start from the same place. */
  const CMP_COLOURS = ['#2A62B4', '#EB6834', '#1BAF7A'];   // validated together (dataviz), with labels and a table

  function compareCars() {
    const cars = state.cars.filter(c => inStock(c) || (c.status === 'sold' && c.sold_at && Date.now() - new Date(c.sold_at) < 120 * DAY))
      .sort((a, b) => (inStock(b) - inStock(a)) || listedAt(b) - listedAt(a));
    const picked = new Set((state.compare || []).filter(id => cars.some(c => String(c.id) === id)));
    const box = sheetHtml('Compare cars', 'Pick two or three', `
      <div class="pick-list">${cars.map(c => `<label class="tickrow">
        <input type="checkbox" value="${esc(c.id)}"${picked.has(String(c.id)) ? ' checked' : ''}>
        <span><strong>${esc(carTitle(c))}</strong><small>${c.status === 'sold' ? 'Sold ' + shortDay(c.sold_at) : money(c.price) + ' · ' + daysIn(c) + ' days'}</small></span>
      </label>`).join('')}</div>
      <button class="btn btn--accent btn--block" id="cmpGo" type="button" disabled>Pick two or three</button>`);
    const boxes = [...box.querySelectorAll('input[type=checkbox]')];
    const sync = () => {
      const on = boxes.filter(b => b.checked);
      boxes.forEach(b => { b.disabled = !b.checked && on.length >= 3; });
      $('#cmpGo').disabled = on.length < 2;
      $('#cmpGo').textContent = on.length < 2 ? 'Pick two or three' : `Compare ${on.length} cars`;
    };
    boxes.forEach(b => b.onchange = sync);
    sync();
    $('#cmpGo').onclick = () => {
      state.compare = boxes.filter(b => b.checked).map(b => b.value);
      closeSheet();
      go('carcmp', { title: 'Compare cars' });
    };
  }

  ON_SHOW.carcmp = () => renderCompare();

  function renderCompare() {
    const cars = (state.compare || []).map(carById).filter(Boolean);
    const box = $('#carcmpBody');
    if (cars.length < 2) { box.innerHTML = '<p class="hint">Pick two or three cars to compare.</p>'; return; }
    const data = cars.map(c => carFigData(c));
    const msgs = need('msgs', recentMessages);
    if (data.some(x => x === undefined)) { box.innerHTML = '<div class="section-card"><div class="skel" style="height:200px"></div></div>'; return; }
    if (data.some(x => x === null)) {
      box.innerHTML = `<div class="msg msg--warn is-shown">Comparing needs <b>schema-v14-site-analytics.sql</b> run in Supabase.</div>`;
      return;
    }

    // Running total of views by days since listed
    const series = cars.map((c, i) => {
      const days = data[i].car_days || [];
      let run = 0;
      return { c, colour: CMP_COLOURS[i], points: days.map(x => (run += x.views)), r: (data[i].cars || []).find(x => String(x.car_id) === String(c.id)) || {} };
    });
    const N = Math.max(2, ...series.map(s => s.points.length));
    const top = countScale(Math.max(1, ...series.flatMap(s => s.points)));
    const x = d => d / (N - 1) * 100;
    const y = v => (top.top - v) / top.span * 100;

    const enqCount = c => messagesFor(msgs, c.id).length;
    const rows = [
      ['Price', s => s.c.status === 'sold' ? 'Sold' : money(s.c.price)],
      ['Days on sale', s => nf(s.c.status === 'sold' && s.c.sold_at ? Math.round((new Date(s.c.sold_at) - listedAt(s.c)) / DAY) : daysIn(s.c))],
      ['Views', s => nf(s.r.views || 0)],
      ['Views a day', s => (Math.round((s.r.views || 0) / Math.max(1, s.points.length) * 10) / 10).toString()],
      ['Opened the photos', s => nf(s.r.photos || 0)],
      ['Taps to get in touch', s => nf(s.r.taps || 0)],
      ['Messages', s => nf(enqCount(s.c))]
    ];

    box.innerHTML = `
      <div class="section-card">
        <h2>Views since each went on</h2>
        <div class="legend">${series.map(s => `<span><i class="key" style="background:${s.colour}"></i><span>${esc(carTitle(s.c))} <b>${nf(s.points[s.points.length - 1] || 0)}</b></span></span>`).join('')}</div>
        <div class="chart" data-chart="cmp">
          <div class="chart-plot" style="height:170px">
            ${top.ticks.map(v => `<div class="grid${v === 0 ? ' grid--zero' : ''}" style="top:${y(v)}%"><span>${nf(v)}</span></div>`).join('')}
            <svg class="pace-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              ${series.map(s => `<polyline points="${s.points.map((v, d) => `${x(d).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}" stroke="${s.colour}"/>`).join('')}
            </svg>
            ${series.map(s => s.points.length ? `<span class="pace-dot" style="left:${x(s.points.length - 1)}%;top:${y(s.points[s.points.length - 1])}%;background:${s.colour}"></span>` : '').join('')}
            <div class="crosshair" hidden></div>
            <div class="chart-tip" hidden></div>
            <div class="pace-hit" role="img" tabindex="0" aria-label="${esc(series.map(s => `${carTitle(s.c)}: ${nf(s.points[s.points.length - 1] || 0)} views`).join('; '))}"></div>
          </div>
          <div class="chart-x chart-x--days">${[0, Math.round((N - 1) / 2), N - 1].map(d => `<span style="left:${x(d)}%">day ${d + 1}</span>`).join('')}</div>
        </div>
        <p class="note chart-note">Each line starts the day that car went on the website, so they can be compared fairly.</p>
      </div>
      <div class="section-card">
        <h2>Side by side</h2>
        <table class="cmp-table">
          <thead><tr><th></th>${series.map(s => `<th><i class="key" style="background:${s.colour}"></i>${esc([s.c.year, s.c.model].filter(Boolean).join(' '))}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(([label, fn]) => `<tr><td>${label}</td>${series.map(s => `<td>${fn(s)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      <button class="btn btn--outline btn--block" type="button" id="cmpAgain">Pick other cars</button>`;
    $('#cmpAgain').onclick = compareCars;

    // Touch or hover anywhere on the chart: each car's total by that day
    const plot = box.querySelector('[data-chart="cmp"] .chart-plot');
    const hit = plot.querySelector('.pace-hit'), cross = plot.querySelector('.crosshair'), tip = plot.querySelector('.chart-tip');
    const showDay = d => {
      cross.hidden = false; cross.style.left = x(d) + '%';
      tip.hidden = false; tip.style.left = Math.min(74, Math.max(26, x(d))) + '%';
      tip.replaceChildren();
      const head = document.createElement('div');
      head.className = 'tip-head'; head.textContent = 'By day ' + (d + 1);
      tip.append(head);
      series.forEach(s => {
        const row = document.createElement('div');
        row.className = 'tip-row';
        const key = document.createElement('i'); key.className = 'key'; key.style.background = s.colour;
        const val = document.createElement('b'); val.textContent = d < s.points.length ? nf(s.points[d]) : 'not yet';
        row.append(key, val, document.createTextNode(' ' + [s.c.year, s.c.model].filter(Boolean).join(' ')));
        tip.append(row);
      });
    };
    const fromPointer = e => {
      const r = hit.getBoundingClientRect();
      showDay(Math.min(N - 1, Math.max(0, Math.round((e.clientX - r.left) / r.width * (N - 1)))));
    };
    const hide = () => { cross.hidden = true; tip.hidden = true; };
    hit.addEventListener('pointermove', fromPointer);
    hit.addEventListener('pointerdown', fromPointer);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', () => showDay(N - 1));
    hit.addEventListener('blur', hide);
  }

  /* ==========================================================================
     WEBSITE: views by day, week or month, the one before beside it, and
     what's behind any bar you tap
     ========================================================================== */
  const WEB_SCALES = { day: 'Days', week: 'Weeks', month: 'Months' };

  function webRange(scale) {
    const today = startDay(new Date());
    if (scale === 'day') return addDays(today, -13);
    if (scale === 'week') return addDays(weekStart(today), -77);
    const m = monthStart(today);
    return new Date(m.getFullYear(), m.getMonth() - 11, 1);
  }

  /** The days grouped into the scale's periods, oldest first. */
  function webBuckets(days, scale) {
    const out = [];
    const today = dayKey(new Date());
    days.forEach(x => {
      const t = fromKey(x.d);
      const start = scale === 'day' ? t : scale === 'week' ? weekStart(t) : monthStart(t);
      const key = dayKey(start);
      let b = out[out.length - 1];
      if (!b || b.key !== key) {
        b = { key, start, days: [], views: 0, people: 0, peopleKnown: true, taps: 0, car_views: 0 };
        b.end = scale === 'day' ? addDays(start, 1) : scale === 'week' ? addDays(start, 7) : new Date(start.getFullYear(), start.getMonth() + 1, 1);
        b.short = scale === 'day' ? String(t.getDate()) : scale === 'week' ? String(start.getDate()) : start.toLocaleDateString('en-GB', { month: 'short' });
        b.label = scale === 'day' ? t.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
          : scale === 'week' ? 'Week of ' + start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
          : start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        out.push(b);
      }
      b.days.push(x);
      b.views += x.views; b.taps += x.taps; b.car_views += x.car_views;
      if (x.people == null) b.peopleKnown = false; else b.people += x.people;
      if (x.d === today) b.current = true;
    });
    if (out.length) out[out.length - 1].current = out[out.length - 1].current || scale !== 'day';
    return out;
  }

  function webTab() {
    const scale = WEB_SCALES[state.webScale] ? state.webScale : 'week';
    const data = need('web:' + scale, () => siteStats(webRange(scale)));
    const head = `<div class="segment segment--sm" id="webScale">
      ${Object.entries(WEB_SCALES).map(([k, label]) => `<button type="button" data-s="${k}" class="${k === scale ? 'is-on' : ''}">${label}</button>`).join('')}
    </div>`;
    if (data === undefined) return head + '<div class="section-card"><div class="skel" style="height:220px"></div></div>';
    if (data === null) {
      return head + `<div class="msg msg--warn is-shown">Website figures need <b>schema-v14-site-analytics.sql</b> run in Supabase (gear → Ready to switch on). It adds every page and every tap, and the totals by day, week and month.</div>`;
    }

    const buckets = webBuckets(data.days || [], scale);
    const cur = buckets[buckets.length - 1], prev = buckets[buckets.length - 2], before = buckets[buckets.length - 3];
    const pick = buckets.find(b => b.key === state.webPick) || cur;
    const unit = { day: 'day', week: 'week', month: 'month' }[scale];
    const pagesSince = data.pages_since ? new Date(data.pages_since) : null;

    /* The headline: the last whole period against the one before (fair),
       then the one under way, set against the same days of the last one.
       A period from before every page was counted (pages_since) is only
       compared on car pages, which were counted all along. */
    const full = b => !!b && !!pagesSince && b.start >= pagesSince;
    const vs = (a, b, aDays, bDays) => {
      if (!b) return '';
      const fair = full(a) && full(b);
      const av = fair ? (aDays ? sumOf(aDays, 'views') : a.views) : (aDays ? sumOf(aDays, 'car_views') : a.car_views);
      const bv = fair ? (bDays ? sumOf(bDays, 'views') : b.views) : (bDays ? sumOf(bDays, 'car_views') : b.car_views);
      return fair ? ', ' + trendWords(av, bv) : `. Car pages alone: ${times(av, 'view')}, ${trendWords(av, bv)}`;
    };
    const lines = [];
    if (scale === 'day') {
      lines.push(`Today so far: <b>${times(cur.views, 'page view')}</b>${cur.peopleKnown && cur.people ? ` from ${times(cur.people, 'person', 'people')}` : ''}.`);
      if (prev) lines.push(`Yesterday: ${times(prev.views, 'page view')}${before ? `${vs(prev, before)} the day before` : ''}.`);
    } else {
      if (prev) lines.push(`${scale === 'week' ? 'Last week' : prev.start.toLocaleDateString('en-GB', { month: 'long' })}: <b>${times(prev.views, 'page view')}</b>${
        prev.peopleKnown && prev.people ? ` from about ${times(prev.people, 'person', 'people')}` : ''}${before ? `${vs(prev, before)} the ${unit} before` : ''}.`);
      const k = cur.days.length;
      lines.push(`This ${unit} so far: ${times(cur.views, 'page view')}${prev ? `${vs(cur, prev, cur.days, prev.days.slice(0, k))} by the same day last ${unit}` : ''}.`);
    }
    if (pagesSince && buckets.length && buckets[0].start < pagesSince) {
      lines.push(`<span class="note">Before ${shortDay(pagesSince)} only car pages were counted, so earlier ${unit}s look quieter than they were, and they’re compared on car pages only.</span>`);
    }

    const detail = need(`webb:${scale}:${pick.key}`, () => siteStats(pick.start, pick.end < new Date() ? pick.end : null));

    return `${head}
      <div class="section-card">
        <div class="card-head"><h2>Page views</h2>${info('views')}</div>
        ${lines.map(l => `<p class="cf-say">${l}</p>`).join('')}
        ${viewBars(buckets.map(b => ({ key: b.key, value: b.views, current: b.current,
          selected: b.key === pick.key, short: b.short,
          tip: `${b.label}${b.current ? ' so far' : ''}: ${times(b.views, 'page view')}${b.peopleKnown && b.people ? `, ${times(b.people, 'person', 'people')}` : ''}, ${times(b.taps, 'tap')}` })),
          { height: 150, pick: true, labels: 'all' })}
        <p class="note chart-note">Tap a bar to see what’s behind it. The last bar is still going.</p>
        <details class="chart-table">
          <summary>See these as a table</summary>
          <table><thead><tr><th>${WEB_SCALES[scale].replace(/s$/, '')}</th><th>Views</th><th>Taps</th></tr></thead>
          <tbody>${buckets.slice().reverse().map(b => `<tr><td>${esc(b.label)}${b.current ? ' (so far)' : ''}</td><td>${nf(b.views)}${b.peopleKnown && b.people ? `<small>${times(b.people, 'person', 'people')}</small>` : ''}</td><td>${nf(b.taps)}</td></tr>`).join('')}</tbody></table>
        </details>
      </div>

      <h2 class="home-h">${esc(pick.label)}${pick.current && scale !== 'day' ? ' so far' : ''}</h2>
      ${detail === undefined ? '<div class="section-card"><div class="skel" style="height:160px"></div></div>' : detail ? webDetail(detail) : ''}
      ${countingNote()}`;
  }

  function webDetail(s) {
    const views = sumOf(s.days, 'views');
    if (!views && !sumOf(s.days, 'taps')) return '<div class="section-card"><p class="hint">Nobody opened the website in this stretch.</p></div>';
    const topCars = (s.cars || []).map(r => ({ r, c: carById(r.car_id) })).filter(x => x.c && x.r.views)
      .sort((a, b) => b.r.views - a.r.views).slice(0, 6);
    const tapsBy = (s.places || []).map(p => ({
      label: `${KIND_WORDS[p.kind]} ${PLACE_WORDS[p.at] && p.at !== 'page' && p.at !== 'card' ? PLACE_WORDS[p.at] : ''} on ${p.page === 'car' ? 'car pages' : PAGE_WORDS[p.page] || 'the website'}`.replace(/\s+/g, ' '),
      n: p.taps }));
    return `
      <div class="section-card">
        <div class="card-head"><h2>Pages opened</h2>${info('views')}</div>
        ${listBars((s.pages || []).filter(p => p.views).map(p => ({ label: PAGE_NAME[p.page] || p.page, n: p.views })))}
      </div>
      ${topCars.length ? `<div class="section-card">
        <h2>Cars looked at most</h2>
        ${topCars.map(({ r, c }) => `<button class="lbar lbar--btn" type="button" data-carfig="${esc(c.id)}"><span>${esc(carTitle(c))}</span><b>${nf(r.views)}</b>
          <i style="width:${Math.max(2, r.views / topCars[0].r.views * 100)}%"></i>
          <small>${[r.photos ? 'photos opened ' + nf(r.photos) + '×' : '', r.taps ? times(r.taps, 'tap') : ''].filter(Boolean).join(' · ') || '&nbsp;'}</small></button>`).join('')}
      </div>` : ''}
      ${s.sources && s.sources.length ? `<div class="section-card">
        <div class="card-head"><h2>Where they came from</h2>${info('sources')}</div>
        ${listBars(s.sources.map(x => ({ label: sourceWords(x.source), n: x.views })))}
      </div>` : ''}
      <div class="section-card">
        <div class="card-head"><h2>Taps to get in touch · ${nf(sumOf(s.days, 'taps'))}</h2>${info('taps')}</div>
        ${tapsBy.length ? listBars(tapsBy) : '<p class="hint">No taps on WhatsApp, Call or Email.</p>'}
      </div>
      ${s.devices && s.devices.length ? `<div class="section-card">
        <h2>Phones and computers</h2>
        ${listBars(s.devices.map(d => ({ label: DEVICE_WORDS[d.device] || d.device, n: d.people })))}
        <p class="note" style="margin-top:6px">People, not views.</p>
      </div>` : ''}`;
  }

  /** Buttons the new screens share: ⓘ, a car's figures, periods, sorts, compare. */
  function wireSiteBits(root) {
    if (!root) return;
    root.querySelectorAll('[data-explain]').forEach(b => b.onclick = e => { e.stopPropagation(); explain(b.dataset.explain); });
    root.querySelectorAll('[data-carfig]').forEach(b => b.onclick = () => openCarFigures(b.dataset.carfig));
    root.querySelectorAll('[data-week]').forEach(b => b.onclick = () => { const f = weekActs[+b.dataset.week]; if (f) f(); });
    root.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => { const f = feedActs[+b.dataset.feed]; if (f) f(); });
    root.querySelectorAll('#carPeriod [data-p]').forEach(b => b.onclick = () => { state.carPeriod = b.dataset.p; remember('mbu_car_period', b.dataset.p); renderInsights(); });
    root.querySelectorAll('#webScale [data-s]').forEach(b => b.onclick = () => { state.webScale = b.dataset.s; state.webPick = null; remember('mbu_web_scale', b.dataset.s); renderInsights(); });
    const cs = root.querySelector('#carSort');
    if (cs) cs.onchange = () => { state.carSort = cs.value; remember('mbu_car_sort', cs.value); renderInsights(); };
    const cc = root.querySelector('#compareCars');
    if (cc) cc.onclick = compareCars;
    root.querySelectorAll('.chart[data-action="pick"] .bar-col').forEach(b => b.addEventListener('click', () => {
      state.webPick = b.dataset.key; renderInsights();
    }));
  }

  /**
   * Sold cars of the same make and model, spelling ignored. Not part-exchange
   * sales: their sale price is a deal price, not what the car fetched.
   */
  function soldLike(car) {
    return state.cars.filter(s => s.status === 'sold' && !s.px_sale && String(s.id) !== String(car.id)
      && keyOf(s.make) === keyOf(car.make) && modelKeyOf(s.model) === modelKeyOf(car.model)
      && (s.sale_price != null || s.price != null));
  }
  const averageAchieved = list => list.length
    ? Math.round(list.reduce((n, s) => n + (s.sale_price != null ? s.sale_price : s.price), 0) / list.length) : null;

  const CAUSE_LABEL = {
    price: 'Priced above the market',
    price_unchecked: 'Probably the price, not checked yet',
    price_cat: 'Priced like a clean car',
    photos: 'Needs more photos',
    first_impression: 'People leave before the photos',
    visibility: 'Not enough people finding it',
    unclear: 'Priced right, cause not obvious',
    interest_falling: 'Interest is falling off',
    ageing: 'Price hasn’t moved'
  };

  const shortDay = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  /**
   * Change a price, with the history recorded.
   * @param {string} carId
   * @param {number} [suggested]  pre-filled, e.g. from an insight
   * @param {object} [finding]    the insight that led to it, recorded if v7 is in
   */
  async function repriceCar(carId, suggested, finding) {
    const car = state.cars.find(c => String(c.id) === String(carId));
    if (!car) return toast('Couldn’t find that car');

    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');
    const avg = averageAchieved(soldLike(car));

    const entered = prompt(
      `New price for the ${title}\n\n` +
      `Currently ${money(car.price)}.` +
      (suggested ? `\nSuggested: ${money(suggested)}.` : '') +
      (!suggested && avg ? `\nYou've averaged ${money(avg)} on these.` : '') +
      `\n\nDropping it shows a "Reduced" badge on the website for two weeks.`,
      suggested ? String(suggested) : car.price != null ? String(car.price) : '');

    if (entered === null) return;
    const price = parseInt(String(entered).replace(/[^0-9]/g, ''), 10);
    if (isNaN(price) || price <= 0) return toast('That wasn’t a valid price');
    if (price === car.price) return;
    const oldPrice = car.price;

    const { error } = await sb.from('cars').update({ price }).eq('id', car.id);
    if (error) return toast('Couldn’t update: ' + error.message);

    // Remember which insight led to it, so later you can see if acting on them works
    if (finding && insightActs !== null) {
      sb.from('insight_actions').insert({
        car_id: car.id, rule: finding.rule, cause: finding.cause, action: 'repriced',
        price_at_action: oldPrice, new_price: price
      }).then(({ error: e }) => { if (e) console.warn('insight action not saved', e); });
    }

    const wentDown = oldPrice != null && price < oldPrice;
    car.price = price;
    renderStock();
    loadInsights();
    toast(wentDown ? 'Reduced. Badge is live on the website' : 'Price updated', 'ok');
  }

  const nf = n => Number(n || 0).toLocaleString('en-GB');

  function statTile(value, label, tone) {
    return `<div class="section-card" style="text-align:center;padding:14px 8px;margin:0">
      <div style="font-size:26px;font-weight:800;letter-spacing:-.03em;color:${tone || 'var(--navy-900)'}">${value}</div>
      <div style="font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin-top:3px">${label}</div>
    </div>`;
  }

  /* ---- Margin: the number that matters, with last month beside it --------
     "This month so far" is compared with the SAME POINT last month, not the
     whole of it, because a half-finished month against a full one always
     looks like a drop. Last month's full total sits underneath.

     Worked out from the cars themselves (sale price − paid − prep), so it is
     the same figure the Sold tab and the weekly email use. A sale with a
     figure missing is left out and counted, never guessed.
     ------------------------------------------------------------------------ */
  function carMargin(c) {
    if (c.px_sale) { const now = pxMadeNow(c); return now > 0 ? now : null; }
    return c.sale_price != null && c.purchase_price != null
      ? c.sale_price - c.purchase_price - (c.prep_cost || 0) : null;
  }

  /* ---- Part exchanges ------------------------------------------------------
     A car sold with a part exchange (px_sale) doesn't carry its own profit.
     Their car goes into stock at what this one cost you minus the cash they
     paid (px_from links it back), so the profit on the whole deal shows when
     THEIR car sells. Until then the sale counts as a car sold, and in days to
     sell, but not in the money: no margin, no average per car, no haggle %.

     If the cash alone covered what this car cost you, the extra is profit
     made on the day, so that much counts now and their car goes in at £0.
     Needs schema-v8-part-exchange.sql; without it no car has px_sale, so
     everything below is simply never true. */
  const costOf = c => c.purchase_price == null ? null : c.purchase_price + (c.prep_cost || 0);

  /** What their car goes in at: this car's cost less the cash, never under £0. */
  function pxCarried(c) {
    const cost = costOf(c);
    return cost == null || c.px_cash == null ? null : Math.max(0, cost - c.px_cash);
  }

  /** Profit already made on the day: only cash beyond what this car cost you. */
  function pxMadeNow(c) {
    const cost = costOf(c);
    return cost == null || c.px_cash == null ? null : Math.max(0, c.px_cash - cost);
  }

  /** A part-exchange sale whose profit waits for their car (nothing missing). */
  const carried = c => !!c.px_sale && carMargin(c) == null;
  /** Left out of the margin because a figure really is missing. */
  const unmargined = c => carMargin(c) == null && !c.px_sale;
  /** The car taken in against this sale, and the sale a car was taken in on. */
  const pxCarOf = c => state.cars.find(x => x.px_from && String(x.px_from) === String(c.id)) || null;
  const pxSaleOf = c => (c.px_from && state.cars.find(x => String(x.id) === String(c.px_from))) || null;
  /** Whether part exchanges can be saved yet (schema v8; null = still checking, so try). */
  const pxReady = () => state.schema.v8 !== false;

  function marginFigures(now) {
    const y = now.getFullYear(), m = now.getMonth();
    const startThis = new Date(y, m, 1);
    const startPrev = new Date(y, m - 1, 1);
    const prevDays = new Date(y, m, 0).getDate();
    const samePointPrev = new Date(y, m - 1, Math.min(now.getDate(), prevDays),
      now.getHours(), now.getMinutes(), now.getSeconds());

    const soldCars = state.cars.filter(c => c.status === 'sold' && c.sold_at);
    const between = (a, b) => soldCars.filter(c => {
      const t = new Date(c.sold_at);
      return t >= a && t < b;
    });
    const sum = list => {
      const counted = list.filter(c => carMargin(c) != null);
      return {
        cars: list,
        total: counted.reduce((n, c) => n + carMargin(c), 0),
        counted: counted.length,
        missing: list.filter(unmargined).length,
        px: list.filter(carried).length          // part exchanges: profit shows on their car
      };
    };
    const name = d => d.toLocaleDateString('en-GB', { month: 'long' });

    return {
      thisName: name(startThis),
      prevName: name(startPrev),
      thisMonth: sum(between(startThis, new Date(8.64e15))),
      prevToDate: sum(between(startPrev, samePointPrev)),
      prevFull: sum(between(startPrev, startThis)),
      allTime: sum(soldCars)
    };
  }

  function marginHero() {
    const f = marginFigures(new Date());
    const t = f.thisMonth;

    if (!f.allTime.cars.length) {
      return `<div class="margin-hero">
        <div class="mh-label">Margin</div>
        <div class="mh-compare" style="margin-top:6px">Nothing sold yet. Mark a car sold with what it went for,
          and fill in what you paid and the prep, and your margin shows here.</div>
      </div>`;
    }

    let compare;
    if (!t.cars.length) {
      compare = `Nothing sold yet in ${esc(f.thisName)}.`;
    } else if (!f.prevToDate.counted) {
      compare = `Nothing counted by this point in ${esc(f.prevName)} to compare with.`;
    } else {
      const diff = t.total - f.prevToDate.total;
      compare = diff === 0
        ? `Level with this point in ${esc(f.prevName)} (${signed(f.prevToDate.total)}).`
        : `${diff > 0 ? 'Up' : 'Down'} <b class="${diff > 0 ? 'up' : 'down'}">£${Math.abs(diff).toLocaleString('en-GB')}</b>
           on this point in ${esc(f.prevName)} (${signed(f.prevToDate.total)}).`;
    }

    // Prep is optional, so a missing one doesn't stop a sale counting. But a
    // margin before prep flatters the month, so say how many are like that.
    const noPrep = t.cars.filter(c => carMargin(c) != null && c.prep_cost == null).length;

    // Break down this month's cars, or last month's if nothing has sold yet
    const showing = t.cars.length ? t : f.prevFull;
    const showingName = t.cars.length ? f.thisName : f.prevName;
    const list = showing.cars.slice().sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at));

    const carRows = list.map(c => {
      const mg = carMargin(c);
      const px = carried(c);
      const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
      const haggle = !c.px_sale && c.price != null && c.sale_price != null && c.price > c.sale_price
        ? ` (${money(c.price - c.sale_price)} off asking)` : '';
      const from = pxSaleOf(c);
      const days = c.sold_at && (c.listed_at || c.created_at)
        ? Math.max(0, Math.round((new Date(c.sold_at) - new Date(c.listed_at || c.created_at)) / 86400000)) : null;
      const bits = [
        'Sold ' + shortDay(c.sold_at),
        c.px_sale ? 'part exchange' + (c.px_cash != null ? `, ${money(c.px_cash)} cash and their car` : '') : null,
        c.sale_price != null && !c.px_sale ? 'for ' + money(c.sale_price) + haggle : null,
        c.purchase_price != null ? 'paid ' + money(c.purchase_price) + (c.prep_cost ? ' + ' + money(c.prep_cost) + ' prep' : ', no prep entered') : null,
        from ? `taken in on the ${carTitle(from)}, so this covers both` : null,
        days != null ? days + ' days' : null
      ].filter(Boolean).join(' · ');
      const missing = [c.sale_price == null ? 'what it sold for' : null, c.purchase_price == null ? 'what you paid' : null]
        .filter(Boolean).join(' and ');

      return `<div class="margin-car">
        <strong>${esc(title)}</strong>
        <span class="mc-margin ${px ? 'is-px' : mg == null ? 'is-missing' : mg < 0 ? 'is-loss' : ''}">${px ? 'Part exchange' : mg == null ? 'Not counted' : signed(mg)}</span>
        <span class="mc-meta">${esc(bits)}</span>
        <button class="mc-fix" type="button" data-figs="${esc(c.id)}">${
          px ? 'Edit the figures' : mg == null ? 'Add ' + esc(missing) : c.prep_cost == null ? 'Add the prep cost' : 'Edit the figures'}</button>
      </div>`;
    }).join('');

    return `<div class="margin-hero">
      <div class="mh-label">Margin in ${esc(f.thisName)} so far</div>
      <div class="hm-top"><div class="mh-figure ${t.total < 0 ? 'is-loss' : ''}">${t.counted ? signed(t.total) : '£0'}</div>${mashallah()}</div>
      <div class="mh-compare">${compare}</div>
      ${t.missing ? `<div class="mh-compare" style="margin-top:4px">${t.missing} of ${t.cars.length} sale${t.cars.length === 1 ? '' : 's'} this month ${t.missing === 1 ? 'has' : 'have'} a figure missing, so ${t.missing === 1 ? 'isn’t' : 'aren’t'} counted.</div>` : ''}
      ${t.px ? `<div class="mh-compare" style="margin-top:4px">${t.px === 1 ? '1 sale this month was a part exchange, so it isn’t' : `${t.px} sales this month were part exchanges, so they aren’t`} in the margin. The profit on the deal shows when their car sells.</div>` : ''}
      ${noPrep ? `<div class="mh-compare" style="margin-top:4px">${
        noPrep < t.counted ? `${noPrep} of ${t.counted} sales ${noPrep === 1 ? 'has' : 'have'} no prep cost entered, so ${noPrep === 1 ? 'that one is' : 'those are'} counted before prep.`
        : t.counted === 1 ? 'No prep cost entered on that sale, so it’s counted before prep.'
        : 'No prep costs entered on any of these, so this is before prep.'}</div>` : ''}
      <div class="mh-row">
        <span>${esc(f.prevName)} <b>${f.prevFull.counted ? signed(f.prevFull.total) : '£0'}</b> (${f.prevFull.cars.length} sold)</span>
        <span>All time <b>${signed(f.allTime.total)}</b></span>
      </div>
      ${list.length ? `
        <button class="mh-toggle" type="button" id="marginToggle" aria-expanded="${state.marginOpen}">
          ${state.marginOpen ? 'Hide' : 'See'} each car in ${esc(showingName)} ${icon('right')}
        </button>
        <div class="margin-cars" id="marginCars" ${state.marginOpen ? '' : 'hidden'}>${carRows}</div>` : ''}
    </div>`;
  }

  /* ---- Needs a decision: the insight engine ------------------------------- */
  function decisionsHtml() {
    if (!analysis) return '';
    const list = analysis.findings;
    const snoozed = analysis.snoozed
      ? `<p class="note" style="margin-top:8px">${analysis.snoozed} snoozed for now.</p>` : '';

    if (!list.length) {
      return `<div class="msg msg--ok is-shown">Nothing needs a decision right now.</div>${snoozed}`;
    }
    const needing = list.filter(f => f.severity !== 'good').length;

    // Stock often goes on in batches, so a batch ages together and can raise a
    // dozen cards on the same day. The most urgent few show; the rest fold away.
    const SHOWN = 5;
    const cards = list.map((f, n) => insightCard(f, n));
    const rest = cards.length - SHOWN;

    return `
      <div style="font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-3);margin:4px 2px 10px">
        ${needing ? `Needs a decision · ${needing}` : 'Worth knowing'}
      </div>
      ${cards.slice(0, SHOWN).join('')}
      ${rest > 0 ? `<details class="more-insights">
        <summary>Show ${rest} more</summary>
        ${cards.slice(SHOWN).join('')}
      </details>` : ''}
      ${snoozed}`;
  }

  const SOURCE_NOTE = {
    autotrader: 'Market figure from Auto Trader',
    price_book: 'Market figure from your price book',
    own_sales: 'Market figure from what you’ve sold these for'
  };

  function insightCard(f, n) {
    const car = state.cars.find(c => String(c.id) === String(f.carId));
    const canRemember = insightActs !== null;
    const buttons = [];

    for (const a of f.actions || []) {
      if (a === 'reprice') {
        buttons.push(`<button class="btn btn--primary btn--sm" data-ins="${n}" data-do="reprice">
          ${f.suggestion ? esc(f.suggestion.label) : 'Change the price'}</button>`);
      } else if (a === 'priced_ok' && canRemember) {
        buttons.push(`<button class="btn btn--outline btn--sm" data-ins="${n}" data-do="priced_ok">Price is right</button>`);
      } else if (a === 'snooze' && canRemember) {
        buttons.push(`<button class="btn btn--ghost btn--sm" data-ins="${n}" data-do="snooze">Remind me in 7 days</button>`);
      } else if (a === 'check_market') {
        buttons.push(`<button class="btn btn--primary btn--sm" data-ins="${n}" data-do="check_market">Check the market</button>`);
      } else if (a === 'add_photos') {
        buttons.push(`<button class="btn btn--primary btn--sm" data-ins="${n}" data-do="edit">Add photos</button>`);
      } else if (a === 'edit') {
        buttons.push(`<button class="btn btn--outline btn--sm" data-ins="${n}" data-do="edit">Edit the listing</button>`);
      } else if (a === 'feature' && car && !car.featured) {
        buttons.push(`<button class="btn btn--outline btn--sm" data-ins="${n}" data-do="feature">Feature it</button>`);
      } else if (a === 'autotrader' && car && !car.at_published && advertAllowance().remaining > 0 && AT && AT.isEnabled()) {
        buttons.push(`<button class="btn btn--outline btn--sm" data-ins="${n}" data-do="autotrader">Use an Auto Trader slot</button>`);
      } else if (a === 'listing_pack') {
        buttons.push(`<button class="btn btn--outline btn--sm" data-ins="${n}" data-do="listing_pack">Listing pack</button>`);
      }
    }

    return `<div class="insight insight--${f.severity}">
      <h3>${esc(f.title)}</h3>
      <div class="in-facts">${esc(f.facts)}</div>
      <div class="in-lines">${f.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>
      ${f.advice ? `<div class="in-advice">${esc(f.advice)}</div>` : ''}
      ${buttons.length ? `<div class="in-actions">${buttons.join('')}</div>` : ''}
      ${f.market && /price|interest_falling|ageing|unclear/.test(f.cause) ? `<div class="in-source">${SOURCE_NOTE[f.market.source]}</div>` : ''}
    </div>`;
  }

  /** After acting on an insight, redraw wherever it was shown. */
  const redrawInsights = () => {
    if (stats && state.view === 'data') renderInsights();
    if (state.view === 'home') renderHome();
    if (state.view === 'carfig') renderCarFigures();
  };

  async function onInsightAction(n, what) {
    const f = analysis && analysis.findings[n];
    if (!f) return;
    const car = state.cars.find(c => String(c.id) === String(f.carId));
    if (!car) return toast('Couldn’t find that car');

    if (what === 'reprice') return repriceCar(car.id, f.suggestion && f.suggestion.price, f);
    if (what === 'edit') return openForm(car);
    if (what === 'feature') { await toggleFeatured(car); return redrawInsights(); }
    if (what === 'autotrader') { await toggleAutoTrader(car); return redrawInsights(); }
    if (what === 'listing_pack') return showListingPack(car);
    if (what === 'check_market') return checkMarket(car, () => loadInsights());

    if (what === 'priced_ok' || what === 'snooze') {
      const days = what === 'snooze' ? 7 : 21;
      const row = {
        car_id: car.id, rule: f.rule, cause: f.cause,
        action: what === 'snooze' ? 'snoozed' : 'priced_ok',
        until: new Date(Date.now() + days * 86400000).toISOString(),
        price_at_action: car.price
      };
      const { data, error } = await sb.from('insight_actions').insert(row).select().single();
      if (error) return toast('Couldn’t save that: ' + error.message);
      insightActs.unshift(data);
      redrawInsights();
      toast(what === 'snooze'
        ? 'Hidden for 7 days'
        : 'Got it. It won’t mention the price again unless it changes', 'ok');
    }
  }

  /* ---- Sold: what actually got made ---------------------------------------
     The Cars tab answers "what is happening now". This answers "what did we
     make", which is the number that matters at the end of a month and the one
     that has to survive into the accounts. Filterable by month and exportable,
     because it gets typed into a spreadsheet either way.

     Margin comes from car_stats: sale_price - purchase_price - prep_cost. It
     is null until the private figures are filled in on the car, so those are
     counted and called out rather than silently averaged away.
     ------------------------------------------------------------------------ */
  /* money() renders a loss as "£-400", which reads badly for the one number
     on this screen most likely to be negative. Sign goes in front of the £. */
  const signed = n => n == null ? '—'
    : (n < 0 ? '\u2212£' : '£') + Math.abs(n).toLocaleString('en-GB');

  // Local time, not UTC: a sale at 00:30 BST on the 1st belongs to that month
  const monthKey  = d => {
    const t = new Date(d);
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0');   // YYYY-MM
  };
  const monthName = k => {
    const [y, m] = k.split('-');
    return new Date(+y, +m - 1, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  /* ==========================================================================
     MARGIN CHARTS
     Plain HTML and SVG, no library. Two views of the same numbers the margin
     figure uses (sale − paid − prep, blank prep counted as £0):

       barChart   margin month by month, one bar each, a loss hangs below
                  the line. Tap a bar on the Sold tab to see that month.
       paceChart  this month against last, added up day by day, so you can
                  see whether you're ahead of where you were at this point.

     Colours are the app's own blue for this month and orange for last, a
     pair checked for colour blindness. A loss is red with a minus sign.
     ========================================================================== */
  const CHART = { now: '#2A62B4', prev: '#EB6834' };

  /** A round step that gives about three gridlines. */
  function niceStep(span) {
    const raw = span / 3;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function scaleFor(values) {
    const hi = Math.max(0, ...values), lo = Math.min(0, ...values);
    const step = niceStep(Math.max(hi - lo, 100));
    const top = Math.ceil(hi / step) * step || step;
    const bottom = Math.floor(lo / step) * step;
    const ticks = [];
    for (let v = bottom; v <= top + step / 2; v += step) ticks.push(v);
    return { top, bottom, span: top - bottom, ticks };
  }
  /** £1.2k style, for axis labels and bar tips where space is tight. */
  const compact = n => {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a < 1000) return s + '£' + Math.round(a);
    const k = a / 1000;
    return s + '£' + (k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)) + 'k';
  };

  /** Margin per month, oldest first, for the last `count` months with sales in reach. */
  function monthlyMargins(count) {
    const sold = state.cars.filter(c => c.status === 'sold' && c.sold_at);
    if (!sold.length) return [];
    const firstSale = new Date(Math.min(...sold.map(c => new Date(c.sold_at).getTime())));
    const firstMonth = new Date(firstSale.getFullYear(), firstSale.getMonth(), 1);
    const now = new Date();
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (start < firstMonth) continue;
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const list = sold.filter(c => { const t = new Date(c.sold_at); return t >= start && t < end; });
      const counted = list.filter(c => carMargin(c) != null);
      out.push({
        key: monthKey(start), current: i === 0,
        short: start.toLocaleDateString('en-GB', { month: 'short' }),
        long: monthName(monthKey(start)),
        total: counted.reduce((n, c) => n + carMargin(c), 0),
        sold: list.length, counted: counted.length,
        noPrep: counted.filter(c => c.prep_cost == null).length,
        missing: list.filter(unmargined).length,
        px: list.filter(carried).length
      });
    }
    return out;
  }

  function monthTip(d) {
    return `${d.long}${d.current ? ' so far' : ''}: ${signed(d.total)} margin from ${plural(d.sold, 'car')} sold` +
      (d.missing ? `, ${d.missing} not counted (figure missing)` : '') +
      (d.px ? `, ${d.px} part exchange${d.px === 1 ? '' : 's'} (profit shows when their car sells)` : '') +
      (d.noPrep ? `, ${d.noPrep} with no prep entered` : '');
  }

  /**
   * @param {object[]} data     from monthlyMargins
   * @param {object} [opts]     { compact, selected: 'YYYY-MM', action: 'filter'|'open', height }
   */
  function barChart(data, opts) {
    opts = opts || {};
    if (!data.length) return '';
    const sc = scaleFor(data.map(d => d.total));
    const zero = sc.top / sc.span * 100;                  // % down from the top
    const best = data.reduce((a, d) => d.total > a.total ? d : a, data[0]);

    const cols = data.map(d => {
      const h = Math.abs(d.total) / sc.span * 100;
      const neg = d.total < 0;
      // Label sparingly: this month, and the best month if it's a different one
      const label = !opts.compact && (d.current || d === best) && d.sold
        ? `<span class="bar-val" style="${neg ? `top:calc(${zero + h}% + 3px)` : `bottom:calc(${100 - zero + h}% + 3px)`}">${compact(d.total)}</span>` : '';
      return `<button class="bar-col${d.key === opts.selected ? ' is-selected' : ''}" type="button"
          data-month="${d.key}" data-tip="${esc(monthTip(d))}" aria-label="${esc(monthTip(d))}">
        <span class="bar${neg ? ' bar--neg' : ''}${d.current ? ' bar--now' : ''}"
              style="${neg ? `top:${zero}%` : `bottom:${100 - zero}%`};height:${h}%"></span>
        ${label}
      </button>`;
    }).join('');

    return `<div class="chart" data-chart="bars" data-action="${opts.action || 'filter'}">
      <div class="chart-plot" style="height:${opts.height || 150}px">
        ${sc.ticks.map(v => `<div class="grid${v === 0 ? ' grid--zero' : ''}" style="top:${(sc.top - v) / sc.span * 100}%"><span>${compact(v)}</span></div>`).join('')}
        <div class="bar-cols">${cols}</div>
        <div class="chart-tip" hidden></div>
      </div>
      <div class="chart-x">${data.map(d => `<span${d.current ? ' class="is-now"' : ''}>${esc(d.short)}</span>`).join('')}</div>
    </div>`;
  }

  /** Margin added up day by day through one month: [end of day 1, end of day 2, ...]. */
  function runningMargin(start, upToDay) {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const byDay = {};
    state.cars.forEach(c => {
      if (c.status !== 'sold' || !c.sold_at || carMargin(c) == null) return;
      const t = new Date(c.sold_at);
      if (t >= start && t < end) byDay[t.getDate()] = (byDay[t.getDate()] || 0) + carMargin(c);
    });
    const out = [];
    let run = 0;
    for (let d = 1; d <= upToDay; d++) { run += byDay[d] || 0; out.push(run); }
    return out;
  }

  function paceChart() {
    const now = new Date();
    const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
    const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const daysThis = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPrev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const cur = runningMargin(startThis, now.getDate());
    const prev = runningMargin(startPrev, daysPrev);
    if (!cur.some(Boolean) && !prev.some(Boolean)) return '';

    const nameThis = startThis.toLocaleDateString('en-GB', { month: 'long' });
    const namePrev = startPrev.toLocaleDateString('en-GB', { month: 'long' });
    const N = Math.max(daysThis, daysPrev);
    const sc = scaleFor(cur.concat(prev));
    const x = day => (day - 1) / (N - 1) * 100;
    const y = v => (sc.top - v) / sc.span * 100;
    const line = s => s.map((v, i) => `${x(i + 1).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const dot = (s, colour) => s.length
      ? `<span class="pace-dot" style="left:${x(s.length)}%;top:${y(s[s.length - 1])}%;background:${colour}"></span>` : '';

    const today = now.getDate();
    const prevAtToday = prev[Math.min(today, prev.length) - 1] || 0;
    const ticksX = [1, 8, 15, 22, N];

    return `<div class="chart" data-chart="pace"
        data-cur="${cur.join(',')}" data-prev="${prev.join(',')}" data-n="${N}"
        data-names="${esc(nameThis)}|${esc(namePrev)}">
      <div class="legend">
        <span><i class="key" style="background:${CHART.now}"></i><span>${esc(nameThis)} so far <b>${signed(cur[cur.length - 1] || 0)}</b></span></span>
        <span><i class="key" style="background:${CHART.prev}"></i><span>${esc(namePrev)} by the ${ordinal(today)} <b>${signed(prevAtToday)}</b>, ${signed(prev[prev.length - 1] || 0)} in all</span></span>
      </div>
      <div class="chart-plot" style="height:150px">
        ${sc.ticks.map(v => `<div class="grid${v === 0 ? ' grid--zero' : ''}" style="top:${y(v)}%"><span>${compact(v)}</span></div>`).join('')}
        <svg class="pace-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${line(prev)}" stroke="${CHART.prev}"/>
          <polyline points="${line(cur)}" stroke="${CHART.now}"/>
        </svg>
        ${dot(prev, CHART.prev)}${dot(cur, CHART.now)}
        <div class="crosshair" hidden></div>
        <div class="chart-tip" hidden></div>
        <div class="pace-hit" role="img" tabindex="0"
             aria-label="${esc(`${nameThis} so far ${signed(cur[cur.length - 1] || 0)}; ${namePrev} was ${signed(prevAtToday)} by the same day`)}"></div>
      </div>
      <div class="chart-x chart-x--days">${ticksX.map(d => `<span style="left:${x(d)}%">${d === N ? 'end' : ordinal(d)}</span>`).join('')}</div>
    </div>`;
  }

  const ordinal = n => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

  /** Hover, focus and tap for every chart inside `root`. */
  function wireCharts(root) {
    root.querySelectorAll('.chart[data-chart="bars"]').forEach(chart => {
      const tip = chart.querySelector('.chart-tip');
      const plot = chart.querySelector('.chart-plot');
      const show = col => {
        tip.textContent = col.dataset.tip;
        tip.hidden = false;
        const pr = plot.getBoundingClientRect(), cr = col.getBoundingClientRect();
        const mid = (cr.left + cr.width / 2 - pr.left) / pr.width * 100;
        tip.style.left = Math.min(78, Math.max(22, mid)) + '%';
      };
      chart.querySelectorAll('.bar-col').forEach(col => {
        col.addEventListener('pointerenter', () => show(col));
        col.addEventListener('focus', () => show(col));
        col.addEventListener('pointerleave', () => { tip.hidden = true; });
        col.addEventListener('blur', () => { tip.hidden = true; });
        col.onclick = () => {
          if (chart.dataset.action === 'open') return openDataTab('money', col.dataset.month);
          if (chart.dataset.action !== 'filter') return;      // Website and car charts handle their own taps
          state.soldMonth = state.soldMonth === col.dataset.month ? 'all' : col.dataset.month;
          renderInsights();
        };
      });
    });

    root.querySelectorAll('.chart[data-chart="pace"]').forEach(chart => {
      const cur = chart.dataset.cur.split(',').map(Number);
      const prev = chart.dataset.prev.split(',').map(Number);
      const N = +chart.dataset.n;
      const [nameThis, namePrev] = chart.dataset.names.split('|');
      const hit = chart.querySelector('.pace-hit');
      const cross = chart.querySelector('.crosshair');
      const tip = chart.querySelector('.chart-tip');

      const showDay = day => {
        const left = (day - 1) / (N - 1) * 100;
        cross.hidden = false; cross.style.left = left + '%';
        tip.hidden = false; tip.style.left = Math.min(74, Math.max(26, left)) + '%';
        tip.replaceChildren();
        const head = document.createElement('div');
        head.className = 'tip-head';
        head.textContent = 'By the ' + ordinal(day);
        tip.append(head);
        [[nameThis, cur, CHART.now], [namePrev, prev, CHART.prev]].forEach(([name, s, colour]) => {
          const row = document.createElement('div');
          row.className = 'tip-row';
          const key = document.createElement('i');
          key.className = 'key'; key.style.background = colour;
          const val = document.createElement('b');
          val.textContent = day <= s.length ? signed(s[day - 1]) : 'not yet';
          row.append(key, val, document.createTextNode(' ' + name));
          tip.append(row);
        });
      };
      const fromPointer = e => {
        const r = hit.getBoundingClientRect();
        const day = Math.round((e.clientX - r.left) / r.width * (N - 1)) + 1;
        showDay(Math.min(N, Math.max(1, day)));
      };
      const hide = () => { cross.hidden = true; tip.hidden = true; };
      hit.addEventListener('pointermove', fromPointer);
      hit.addEventListener('pointerdown', fromPointer);
      hit.addEventListener('pointerleave', hide);
      hit.addEventListener('focus', () => showDay(cur.length || 1));
      hit.addEventListener('blur', hide);
      hit.addEventListener('keydown', e => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const nowDay = Math.round(parseFloat(cross.style.left || '0') / 100 * (N - 1)) + 1;
        showDay(Math.min(N, Math.max(1, nowDay + (e.key === 'ArrowRight' ? 1 : -1))));
      });
    });
  }

  /** Jump to an Insights tab, optionally with the Sold tab set to a month. */
  function openDataTab(tab, month) {
    // The old tab names, from before 7 Oct 2026
    tab = { sold: 'money', ageing: 'cars', demand: 'summary' }[tab] || tab;
    state.dataTab = tab;
    if (month) state.soldMonth = month;
    $$('#dataTabs button').forEach(x => x.classList.toggle('is-on', x.dataset.tab === tab));
    go('data');
  }

  /**
   * The car_stats rows with the money worked out from the cars themselves,
   * so a part-exchange sale has no margin of its own (the view doesn't know
   * about part exchanges). `px` marks one whose profit is on their car.
   */
  function statsWithFigures() {
    return (stats || []).map(r => {
      const car = state.cars.find(c => String(c.id) === String(r.car_id));
      return car ? Object.assign({}, r, { margin: carMargin(car), px: carried(car), px_sale: !!car.px_sale,
        px_cash: car.px_cash ?? null, px_from: car.px_from || null }) : r;
    });
  }
  const everySoldRow = () => statsWithFigures().filter(c => c.status === 'sold' && c.sold_at);

  /** Sold cars for the month currently selected, newest first. */
  function soldRows() {
    const all = everySoldRow()
      .sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at));
    return state.soldMonth === 'all'
      ? all
      : all.filter(c => monthKey(c.sold_at) === state.soldMonth);
  }

  function soldInsights() {
    const everySold = everySoldRow();

    if (!everySold.length) {
      return `<div class="empty">${icon('car')}<h3>Nothing sold yet</h3>
        <p>Mark a car as sold and it will show up here with what you made on it.</p></div>`;
    }

    // Month list, newest first, built from what has actually sold
    const months = [...new Set(everySold.map(c => monthKey(c.sold_at)))].sort().reverse();
    if (state.soldMonth !== 'all' && !months.includes(state.soldMonth)) state.soldMonth = 'all';

    const rows      = soldRows();
    const withMargin = rows.filter(c => c.margin != null);
    const missing    = rows.filter(c => c.margin == null && !c.px).length;
    const pxSales    = rows.filter(c => c.px).length;
    const totalMargin = withMargin.reduce((n, c) => n + c.margin, 0);
    const avgMargin   = withMargin.length ? Math.round(totalMargin / withMargin.length) : null;
    const withDays    = rows.filter(c => c.days_in_stock != null);
    const avgDays     = withDays.length
      ? Math.round(withDays.reduce((n, c) => n + c.days_in_stock, 0) / withDays.length) : null;

    /* Month on month: only meaningful when looking at a single month */
    let compare = '';
    if (state.soldMonth !== 'all') {
      const i = months.indexOf(state.soldMonth);
      const prevKey = months[i + 1];
      if (prevKey) {
        const prev = everySold.filter(c => monthKey(c.sold_at) === prevKey && c.margin != null);
        if (prev.length && withMargin.length) {
          const prevTotal = prev.reduce((n, c) => n + c.margin, 0);
          const diff = totalMargin - prevTotal;
          const up = diff >= 0;
          compare = `<p class="hint" style="margin:-4px 0 14px">
            ${up ? 'Up' : 'Down'} <strong style="color:${up ? 'var(--green-600)' : 'var(--red-600)'}">
            £${Math.abs(diff).toLocaleString('en-GB')}</strong> on ${esc(monthName(prevKey))}
            (${prev.length} sold, ${signed(prevTotal)}).</p>`;
        }
      }
    }

    const noPrep = rows.filter(c => c.margin != null && c.prep_cost == null).length;

    // Each sale opens its figures, so a missing prep cost is one tap to fix
    const list = rows.map(c => {
      const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
      const when  = new Date(c.sold_at).toLocaleDateString('en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' });
      const good  = c.margin != null && c.margin >= 0;
      const flag  = c.px_sale ? '<span class="pill pill--blue">Part exchange</span>'
        : c.margin == null ? '<span class="pill pill--amber">Figure missing</span>'
        : c.prep_cost == null ? '<span class="pill pill--grey">No prep entered</span>' : '';
      const taken = c.px_from ? '<span class="pill pill--blue">Part ex, covers both cars</span>' : '';

      return `<button class="card sold-row" type="button" data-figs="${esc(c.car_id)}">
        <div class="sold-top">
          <div>
            <strong>${esc(title)}</strong>
            <div class="sold-when">
              ${esc(when)}${c.days_in_stock != null ? ' · ' + c.days_in_stock + ' days in stock' : ''}
            </div>
          </div>
          <div class="sold-margin ${c.px ? 'is-px' : c.margin == null ? 'is-missing' : good ? 'is-good' : 'is-loss'}">
            ${c.px ? 'Part ex<small>profit on their car</small>' : signed(c.margin) + '<small>margin</small>'}
          </div>
        </div>
        <div class="sold-figs">
          <span>Sold for <strong>${c.sale_price != null ? money(c.sale_price) : 'not entered'}</strong></span>
          ${c.px_sale ? `<span>Cash <strong>${c.px_cash != null ? money(c.px_cash) : 'not entered'}</strong></span>` : ''}
          <span>Paid <strong>${c.purchase_price != null ? money(c.purchase_price) : 'not entered'}</strong></span>
          <span>Prep <strong>${c.prep_cost != null ? money(c.prep_cost) : 'not entered'}</strong></span>
          ${flag}${taken}
          <span class="sold-edit">${icon('edit')} Edit</span>
        </div>
      </button>`;
    }).join('');

    const byMonth = monthlyMargins(12);
    const pace = paceChart();

    return `
      ${verseCard()}
      ${marginHero()}
      ${byMonth.length ? `<div class="section-card">
        <div class="card-head"><h2>Margin by month</h2>${mashallah()}</div>
        ${barChart(byMonth, { selected: state.soldMonth })}
        <p class="note chart-note">Tap a month to see its sales below.${byMonth.some(d => d.noPrep)
          ? ' Months with sales that have no prep entered are counted before prep.' : ''}</p>
        <details class="chart-table">
          <summary>See these as a table</summary>
          <table>
            <thead><tr><th>Month</th><th>Sold</th><th>Margin</th></tr></thead>
            <tbody>${byMonth.slice().reverse().map(d => `<tr><td>${esc(d.long)}</td><td>${d.sold}</td><td>${signed(d.total)}${
              d.missing || d.noPrep || d.px ? `<small>${[d.missing ? d.missing + ' not counted' : '', d.px ? d.px + ' part exchange' + (d.px === 1 ? '' : 's') : '', d.noPrep ? d.noPrep + ' before prep' : ''].filter(Boolean).join(', ')}</small>` : ''}</td></tr>`).join('')}</tbody>
          </table>
        </details>
      </div>` : ''}

      ${pace ? `<div class="section-card">
        <h2>This month against last</h2>
        ${pace}
      </div>` : ''}

      <div class="section-card" style="padding:12px;margin-bottom:12px">
        <label for="soldMonth" style="font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3)">Month</label>
        <select class="sel" id="soldMonth" style="margin-top:6px">
          <option value="all"${state.soldMonth === 'all' ? ' selected' : ''}>All time (${everySold.length} sold)</option>
          ${months.map(k => {
            const n = everySold.filter(c => monthKey(c.sold_at) === k).length;
            return `<option value="${k}"${state.soldMonth === k ? ' selected' : ''}>${esc(monthName(k))} (${n})</option>`;
          }).join('')}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px">
        ${statTile(nf(rows.length), 'Cars sold')}
        ${statTile(withMargin.length ? signed(totalMargin) : 'Not yet', 'Total margin',
          totalMargin < 0 ? 'var(--red-600)' : 'var(--green-600)')}
        ${statTile(avgMargin != null ? signed(avgMargin) : 'Not yet', 'Avg per car', 'var(--accent-600)')}
        ${statTile(avgDays != null ? avgDays + ' days' : 'Not yet', 'Avg time to sell')}
      </div>

      ${compare}

      ${missing ? `<div class="msg msg--info is-shown" style="margin-bottom:14px">
        <strong>${missing} of these ${missing === 1 ? 'has' : 'have'} no margin figure.</strong>
        Tap the car to fill in what you paid and what it sold for, and it will be counted here.</div>` : ''}

      ${pxSales ? `<div class="msg msg--info is-shown" style="margin-bottom:14px">
        <strong>${pxSales === 1 ? '1 sale was a part exchange' : pxSales + ' sales were part exchanges'}</strong>, so
        ${pxSales === 1 ? 'it’s' : 'they’re'} counted as sold but left out of the margin and the average.
        The profit on the deal shows when their car sells.</div>` : ''}

      ${noPrep ? `<div class="msg msg--warn is-shown" style="margin-bottom:14px">
        <strong>${noPrep} ${noPrep === 1 ? 'sale has' : 'sales have'} no prep cost entered</strong>, so
        ${noPrep === 1 ? 'its margin is' : 'their margins are'} before prep and the total is higher than it
        really is. Tap each one to add it, or tap “No prep on this one” if there wasn’t any.</div>` : ''}

      <div class="section-card">
        <h2>${state.soldMonth === 'all' ? 'Everything sold' : esc(monthName(state.soldMonth))}, newest first</h2>
        ${list || '<p class="hint">Nothing sold in that month.</p>'}
      </div>

      <button class="btn btn--outline btn--block" id="exportSold" style="margin-top:14px">
        ${icon('copy')} Export ${state.soldMonth === 'all' ? 'all sales' : esc(monthName(state.soldMonth))} as a spreadsheet
      </button>`;
  }

  function wireInsightActions() {
    const ec = $('#exportCars');
    if (ec) ec.onclick = () => downloadCsv('mbu-car-figures', statsWithFigures().map(r => {
      const out = Object.assign({}, r);
      out.part_exchange = r.px_sale ? 'sold in one' : r.px_from ? 'taken in on one' : '';
      delete out.px; delete out.px_sale; delete out.px_from;
      return out;
    }));
    const ed = $('#exportDemand');
    if (ed) ed.onclick = () => downloadCsv('mbu-car-requests', demand);

    /* Sold tab: month picker re-renders, export follows whatever is on screen */
    const sm = $('#soldMonth');
    if (sm) sm.onchange = () => { state.soldMonth = sm.value; renderInsights(); };

    const es = $('#exportSold');
    if (es) es.onclick = () => {
      const rows = soldRows().map(c => ({
        sold_on:        c.sold_at ? new Date(c.sold_at).toISOString().slice(0, 10) : '',
        year:           c.year,
        make:           c.make,
        model:          c.model,
        variant:        c.variant,
        advertised_at:  c.price,
        sold_for:       c.sale_price,
        purchase_price: c.purchase_price,
        prep_cost:      c.prep_cost,
        margin:         c.margin,
        part_exchange:  c.px_sale ? 'sold in one' : c.px_from ? 'taken in on one' : '',
        px_cash:        c.px_cash,
        days_in_stock:  c.days_in_stock,
        views:          c.views,
        enquiries:      c.enquiries
      }));
      if (!rows.length) return toast('Nothing to export for that month');
      const tag = state.soldMonth === 'all' ? 'all-time' : state.soldMonth;
      downloadCsv('mbu-sales-' + tag, rows);
    };
    $$('#dataBody [data-reprice]').forEach(b => {
      b.onclick = () => repriceCar(b.dataset.reprice);
    });

    /* Cars tab: margin breakdown, missing figures, insight buttons */
    const mt = $('#marginToggle');
    if (mt) mt.onclick = () => { state.marginOpen = !state.marginOpen; renderInsights(); };
    wireFigureButtons($('#dataBody'));
    wireInsightButtons($('#dataBody'));


    wireCharts($('#dataBody'));
    wireMashallah($('#dataBody'));
  }

  /** Anything marked data-figs="<car id>" opens that car's money sheet. */
  function wireFigureButtons(root) {
    root.querySelectorAll('[data-figs]').forEach(b => {
      b.onclick = () => {
        const car = state.cars.find(c => String(c.id) === b.dataset.figs);
        if (car) figuresSheet(car);
      };
    });
  }

  function wireInsightButtons(root, before) {
    root.querySelectorAll('[data-ins]').forEach(b => {
      b.onclick = async () => {
        if (before) before();
        b.disabled = true;
        try { await onInsightAction(+b.dataset.ins, b.dataset.do); }
        finally { b.disabled = false; }
      };
    });
  }

  /* ==========================================================================
     FULL BACKUP
     Everything, as spreadsheets. Downloaded one at a time because zipping in
     the browser would mean pulling in a library for something that happens
     twice a year.
     ========================================================================== */
  $('#exportAll').onclick = async () => {
    const btn = $('#exportAll');
    const status = $('#exportStatus');
    btn.disabled = true;

    const tables = [
      ['cars',            'mbu-cars'],
      ['enquiries',       'mbu-enquiries'],
      ['wanted_requests', 'mbu-car-requests'],
      ['price_checks',    'mbu-price-book'],
      ['price_history',   'mbu-price-changes'],
      ['car_stats',       'mbu-car-performance'],
      ['invoices',        'mbu-invoices']
    ];

    let done = 0, skipped = [];
    for (const [table, filename] of tables) {
      status.textContent = `Exporting ${table.replace(/_/g, ' ')}…`;
      try {
        const { data, error } = await sb.from(table).select('*').limit(5000);
        if (error) { skipped.push(table); continue; }
        if (!data || !data.length) { skipped.push(table); continue; }
        downloadCsv(filename, data, true);
        done++;
        // Browsers throttle rapid-fire downloads; give each one room
        await new Promise(r => setTimeout(r, 700));
      } catch { skipped.push(table); }
    }

    btn.disabled = false;
    status.innerHTML = done
      ? `Downloaded ${done} file${done === 1 ? '' : 's'}.` +
        (skipped.length ? ` <span style="color:var(--ink-4)">(${skipped.length} empty or not set up yet)</span>` : '')
      : 'Nothing to export yet.';
    if (done) toast('Backup downloaded', 'ok');
  };

  /** Turn an array of records into a CSV file and hand it to the browser. */
  function downloadCsv(name, rows, quiet) {
    if (!rows || !rows.length) { if (!quiet) toast('Nothing to export yet'); return; }
    // Union of keys, not just the first row's, because Supabase omits nulls sometimes
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const cell = v => {
      if (v == null) return '';
      // Objects and arrays (images, features, details) become JSON text
      let s = typeof v === 'object' ? JSON.stringify(v) : String(v);

      // Spreadsheet formula injection. Excel and Numbers run a cell starting
      // with = + - or @ as a formula, and enquiry names and messages are typed
      // by the public, so somebody could get a formula to run on your machine
      // just by filling the form in. An apostrophe in front forces plain text.
      // Genuine negative numbers are left alone so the money columns still add up.
      if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;

      s = s.replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [cols.join(',')]
      .concat(rows.map(r => cols.map(c => cell(r[c])).join(',')))
      .join('\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    if (!quiet) toast('Exported', 'ok');
  }

  /* ==========================================================================
     LISTING PACK
     --------------------------------------------------------------------------
     One tap → ready-to-paste adverts for Facebook Marketplace, Gumtree,
     Instagram and Auto Trader. Each platform wants a different length and
     tone, so they're written separately rather than one text reused badly.

     No photo download: the photos are already in his camera roll from when he
     took them, so all he actually needs is the words.
     ========================================================================== */
  function listingPack(car) {
    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');
    const full = [title, car.variant].filter(Boolean).join(' ');
    const B = CFG.business;

    const facts = [];
    if (car.mileage != null) facts.push(nf(car.mileage) + ' miles');
    if (car.fuel) facts.push(LABEL.fuel[car.fuel] || car.fuel);
    if (car.transmission) facts.push(LABEL.transmission[car.transmission] || car.transmission);
    if (car.engine_size) facts.push(Number(car.engine_size).toFixed(1) + 'L');
    if (car.colour) facts.push(car.colour);
    if (car.previous_owners) facts.push(car.previous_owners + ' owner' + (car.previous_owners === 1 ? '' : 's'));
    if (car.service_history === 'full') facts.push('Full service history');
    if (car.mot_expiry) {
      const d = new Date(car.mot_expiry);
      if (!isNaN(d)) facts.push('MOT ' + d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }));
    }

    const feats = (car.features || []).slice(0, 8);
    const honesty = car.hpi_status && car.hpi_status !== 'clear'
      ? `\n\nIMPORTANT: this is a ${LABEL.hpi[car.hpi_status] || car.hpi_status}. ${car.condition_notes || ''}`.trim()
      : '';

    /* ---- Facebook Marketplace ---------------------------------------------
       Their vehicle listings have structured fields, so the description just
       needs to add what the fields don't cover. Keep it plain because
       Marketplace buyers scroll fast. */
    const facebook =
`${full}${car.price != null ? ' | £' + nf(car.price) : ''}

${facts.join(' • ')}

${car.description || ''}${honesty}

${feats.length ? 'Spec: ' + feats.join(', ') + '\n\n' : ''}Part exchange welcome.
Viewings by appointment 7 days a week in ${B.town}.

Message here or WhatsApp ${B.phone}.`;

    /* ---- Gumtree: allows more detail, buyers read further ---------------- */
    const gumtree =
`${full}${car.price != null ? ' | £' + nf(car.price) : ''} | ${car.mileage != null ? nf(car.mileage) + ' miles' : ''}

${car.description || ''}${honesty}

SPECIFICATION
${facts.map(f => '- ' + f).join('\n')}
${feats.length ? '\nEQUIPMENT\n' + feats.map(f => '- ' + f).join('\n') : ''}

WHY BUY FROM US
- HPI checked before it goes on sale, and we tell you up front about any history
- Serviced, MOT'd and road tested by us before you collect
- Part exchange welcome
- Family run business in ${B.town}, so you deal with the people who prepared the car

Call or WhatsApp ${B.phone} to arrange a viewing.`;

    /* ---- Instagram: short, no links work in captions --------------------- */
    const tags = ['#usedcars', '#carsforsale', '#newcastle', '#northeast',
      '#cardealer', '#carsofinstagram',
      car.make ? '#' + String(car.make).toLowerCase().replace(/[^a-z0-9]/g, '') : '',
      car.model ? '#' + String(car.model).toLowerCase().replace(/[^a-z0-9]/g, '') : '',
      car.body_type === 'suv' ? '#suv' : '', '#mbucarsales'
    ].filter(Boolean);

    const instagram =
`${full}${car.price != null ? ' | £' + nf(car.price) : ''}

${facts.slice(0, 5).join(' • ')}
${car.hpi_status && car.hpi_status !== 'clear' ? '\n' + (LABEL.hpi[car.hpi_status] || '') + '. Fully disclosed and priced accordingly\n' : ''}
${(car.description || '').split(/[.!?]/).slice(0, 2).join('. ').trim()}${car.description ? '.' : ''}

DM or WhatsApp ${B.phone} to arrange a viewing.
Newcastle upon Tyne.

${tags.join(' ')}`;

    /* ---- Auto Trader: spec-led, buyers are comparing like for like ------- */
    const autotrader =
`${car.description || ''}${honesty}

${feats.length ? 'Equipment includes: ' + feats.join(', ') + '.\n\n' : ''}Every car we sell is HPI checked, serviced and MOT'd before collection, and we are upfront about any history. Part exchange welcome.

Viewings by appointment seven days a week in ${B.town}. Call or message to arrange a time and we will have the car ready for you.`;

    return { facebook, gumtree, instagram, autotrader };
  }

  function showListingPack(car) {
    const pack = listingPack(car);
    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');

    const blocks = [
      ['Facebook Marketplace', 'facebook', pack.facebook],
      ['Gumtree', 'gumtree', pack.gumtree],
      ['Instagram', 'instagram', pack.instagram],
      ['Auto Trader', 'autotrader', pack.autotrader]
    ];

    $('#sheetTitle').textContent = 'Listing pack';
    const sub = $('#sheetSub');
    sub.style.display = '';
    sub.textContent = title + ((car.images || []).length
      ? ` · photos are already on your phone` : '');

    $('#sheetActions').innerHTML = blocks.map(([label, key, text]) => `
      <div class="card" style="padding:14px;margin:0">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px">
          <strong style="font-size:16px">${label}</strong>
          <button class="btn btn--primary btn--sm" data-copy="${key}">Copy</button>
        </div>
        <textarea class="ta" id="pack-${key}" readonly
          style="min-height:110px;font-size:14px;background:var(--bg)">${esc(text)}</textarea>
      </div>`).join('') +
      `<p class="hint" style="padding:4px 4px 0">
         Tap Copy, open the app and paste.
       </p>`;

    $$('#sheetActions [data-copy]').forEach(btn => {
      btn.onclick = async () => {
        const ta = $('#pack-' + btn.dataset.copy);
        try {
          await navigator.clipboard.writeText(ta.value);
        } catch {
          ta.removeAttribute('readonly');
          ta.select(); ta.setSelectionRange(0, 999999);
          document.execCommand('copy');
          ta.setAttribute('readonly', '');
        }
        btn.textContent = 'Copied';
        btn.classList.add('btn--green');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('btn--green'); }, 1800);
      };
    });

    $('#sheet').classList.add('is-open');
    $('#sheetBack').classList.add('is-open');
  }

  /* ==========================================================================
     AUCTION BIDDING TOOL
     --------------------------------------------------------------------------
     Type a plate, get a decision. Three things stacked together:

       1. What the car IS:       DVLA + full MOT history, clocking checks,
                                 advisories, anything that should worry you
       2. What YOU know:         every one of these you've traded before:
                                 what you paid, what you got, how long it sat
       3. What it's WORTH TO YOU: work backwards from a realistic sale price
                                 through fees, prep and margin to a max bid

     The number at the bottom is the only one that matters: walk away above it.
     ========================================================================== */

  const BID_DEFAULTS_KEY = 'mbu_bid_defaults';
  let bidDefaults = { feePct: 8, prep: 400, transport: 80, marginPct: 22 };
  try {
    const saved = JSON.parse(localStorage.getItem(BID_DEFAULTS_KEY) || 'null');
    if (saved && typeof saved === 'object') Object.assign(bidDefaults, saved);
  } catch { /* first run */ }

  let vehicle = null;    // last lookup result

  $('#vLookup').onclick = runValuation;
  if (AT && AT.isEnabled()) {
    $('#vHint').textContent = 'Asks Auto Trader: the exact car, its MOT history, what it’s worth and what similar cars are up for.';
  }
  $('#vReg').addEventListener('input', e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  });
  $('#vReg').addEventListener('keydown', e => { if (e.key === 'Enter') runValuation(); });

  async function runValuation() {
    const reg = $('#vReg').value.replace(/\s+/g, '').toUpperCase();
    if (reg.length < 4) { msg('#vMsg', 'Type the full number plate first.', 'warn'); return; }

    const btn = $('#vLookup');
    btn.disabled = true; btn.textContent = '…';
    msg('#vMsg', '');
    $('#vResult').innerHTML =
      `<div class="section-card"><div class="skel" style="height:150px"></div></div>`.repeat(2);

    try {
      // Auto Trader first when it's switched on: it knows the exact car, the
      // MOT history AND what it's worth, in one go.
      if (AT && AT.isEnabled()) {
        try {
          const r = await AT.lookup(reg, null);
          vehicle = vehicleFromAutoTrader(r);
          renderValuation();
          return;
        } catch (err) {
          // Not set up properly: quietly fall back to the DVLA/MOT lookup.
          // A real answer from Auto Trader (no such plate) is shown as it is.
          if (!['not_configured', 'not_deployed', 'auth', 'forbidden', 'network'].includes(err.code)) throw err;
          console.warn('Auto Trader lookup unavailable, falling back', err);
        }
      }

      // As in vehicleLookup: the admin's own token, never the publishable key.
      const { data: { session } } = await sb.auth.getSession();
      if (!session) throw new Error('Your session has expired. Sign in again to look up a plate.');
      const auth = 'Bearer ' + session.access_token;

      // Prefer the combined lookup; fall back to the older DVLA-only function
      // so this still works if only that one has been deployed.
      let res = await fetch(`${CFG.supabase.url}/functions/v1/vehicle-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ registrationNumber: reg })
      });

      let payload = null;
      try { payload = await res.json(); } catch { /* not JSON */ }

      // A 404 means one of two very different things: either the plate isn't
      // on record (our function replies with an `error` message), or the
      // function hasn't been deployed at all (Supabase's own 404, no `error`).
      // Only the second case should fall back to the older DVLA-only function.
      const functionMissing = res.status === 404 && !(payload && payload.error);

      if (functionMissing) {
        res = await fetch(`${CFG.supabase.url}/functions/v1/dvla-lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ registrationNumber: reg })
        });
        if (res.ok) {
          const d = await res.json();
          vehicle = {
            registration: reg, found: { dvla: true, mot: false },
            make: d.make ? canonicalMake(d.make) : null, model: null,
            year: d.yearOfManufacture, colour: d.colour ? titleCase(d.colour) : null,
            fuelType: d.fuelType, engineLitres: d.engineCapacity ? +(d.engineCapacity / 1000).toFixed(1) : null,
            motExpiryDate: d.motExpiryDate, taxStatus: d.taxStatus,
            mot: null,
            flags: [{ level: 'warn', text: 'MOT history isn’t switched on, so you’re only seeing the DVLA record. See SETUP.md to add it.' }]
          };
          renderValuation();
          return;
        }
        try { payload = await res.json(); } catch { payload = null; }
      }

      if (!res.ok) throw new Error((payload && payload.error) || 'Lookup unavailable');
      if (!payload) throw new Error('The lookup service returned something unexpected.');

      vehicle = payload;
      if (vehicle.model) vehicle.model = canonicalModel(vehicle.make, vehicle.model);
      if (vehicle.make) vehicle.make = canonicalMake(vehicle.make);
      if (vehicle.colour) vehicle.colour = titleCase(vehicle.colour);
      renderValuation();

    } catch (err) {
      console.error(err);
      $('#vResult').innerHTML = '';
      msg('#vMsg', esc(err.message || 'Lookup failed') +
        '<br><br>You can still work it out by typing the car in: tap “No plate lookup?” above.', 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'Check';
    }
  }

  /* ---- No lookup available: type the car in ------------------------------
     The bidding calculation, your own history, the price book and the Auto
     Trader search all work from make, model, year and mileage. None of them
     actually need the plate, so the Value tab still works without a lookup. */
  $('#vManualBtn').onclick = () => {
    const box = $('#vManual');
    box.hidden = !box.hidden;
    if (!box.hidden) $('#vMake').focus();
  };

  $('#vManualGo').onclick = () => {
    const make = $('#vMake').value.trim();
    const model = $('#vModel').value.trim();
    if (!make) { msg('#vMsg', 'Put in the make at least.', 'warn'); return; }
    msg('#vMsg', '');
    vehicle = {
      manual: true,
      registration: $('#vReg').value.replace(/\s+/g, '').toUpperCase() || null,
      found: { manual: true },
      make,                 // as typed: "BMW" shouldn't become "Bmw"
      model: model || null,
      year: int($('#vYear').value),
      manualMileage: int($('#vMiles').value),
      mot: null,
      flags: []
    };
    renderValuation();
  };

  /** The Auto Trader answer in the shape the Value tab already draws. */
  function vehicleFromAutoTrader(r) {
    return {
      registration: r.registration,
      found: { at: true, mot: !!r.mot },
      make: canonicalMake(r.make), model: canonicalModel(r.make, r.model), year: r.year,
      colour: r.colour, fuelType: r.fuelType, engineLitres: r.engineLitres,
      motExpiryDate: r.motExpiryDate,
      manualMileage: r.mot ? null : r.mileageUsed,
      mot: r.mot,
      flags: r.flags || [],
      at: r
    };
  }

  /* Auto Trader figures are NOT copied into the price book. Their terms limit
     the data to display inside the dealer's own software, bar sharing
     valuations and metrics with anyone, require erasing it all if the account
     ends, and their Vehicle Check terms forbid building a database from it.
     So a look-up is shown and gone, and a stock car keeps only its latest
     snapshot (cars.at_market), overwritten each check. HANDOVER 9h. */

  /**
   * "What's this car worth right now?" for a car in stock.
   * With Auto Trader: asks it, saves the figures on the car, logs a price
   * check. Without: opens the Auto Trader search for that spec and asks what
   * was on screen, which is what the insight engine then compares against.
   */
  async function checkMarket(car, after) {
    const manual = () => {
      const v = { make: car.make, model: car.model, year: car.year };
      window.open(autoTraderSearchUrl(v, car.mileage), '_blank', 'noopener');
      recordPriceCheck(v, car.mileage, { carId: car.id, after });
    };

    if (!(AT && AT.isEnabled() && car.registration)) return manual();

    toast('Asking Auto Trader…');
    try {
      const r = await AT.market(car);
      const patch = AT.carPatch(r);
      let { error } = await sb.from('cars').update(patch).eq('id', car.id);
      if (error && /at_market|at_price_indicator|column/i.test(error.message)) {
        // schema-v7 not run: keep the valuation columns that already exist
        delete patch.at_market; delete patch.at_price_indicator;
        ({ error } = await sb.from('cars').update(patch).eq('id', car.id));
      }
      if (error) throw error;
      Object.assign(car, patch);

      const rating = r.priceIndicator && r.priceIndicator.rating;
      toast(rating ? `Auto Trader rates the price ${rating}` : 'Market figures updated', 'ok');
      if (r.env === 'sandbox') setTimeout(() => toast('Sandbox data: not real prices'), 2900);
      if (after) after();
    } catch (err) {
      console.warn(err);
      if (['not_configured', 'not_deployed'].includes(err.code)) return manual();
      toast(err.message || 'Couldn’t reach Auto Trader');
    }
  }

  /* ---- your own trading history for this make/model ---------------------- */
  function ownHistory(make, model) {
    if (!make) return null;
    // Spelling ignored: "Mercedes" is "Mercedes-Benz", "A-Class" is "A Class"
    const m = keyOf(make);
    const mod = model ? modelKeyOf(model) : null;

    const exact = state.cars.filter(c =>
      keyOf(c.make) === m && (!mod || modelKeyOf(c.model) === mod));
    const sameMake = state.cars.filter(c => keyOf(c.make) === m);

    const pool = exact.length ? exact : sameMake;
    if (!pool.length) return null;

    // A part-exchange sale's price is a deal price, and the car taken in has a
    // worked-out cost and a margin that covers both cars: neither says what
    // these cars buy and sell for, so they're left out of the money
    const sold = pool.filter(c => c.status === 'sold');
    const priced = sold.filter(c => !c.px_sale && !c.px_from);
    const avg = (arr, f) => {
      const v = arr.map(f).filter(n => n != null && !isNaN(n));
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
    };

    const days = sold.map(c => {
      if (!c.sold_at) return null;
      const start = new Date(c.listed_at || c.created_at).getTime();
      const d = Math.round((new Date(c.sold_at).getTime() - start) / 86400000);
      return d >= 0 ? d : null;
    }).filter(n => n != null);

    return {
      exact: exact.length > 0,
      total: pool.length,
      soldCount: sold.length,
      avgBought: avg(pool.filter(c => !c.px_from), c => c.purchase_price),
      avgSold: avg(priced, c => c.sale_price != null ? c.sale_price : c.price),
      avgAsking: avg(pool, c => c.price),
      avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      avgMargin: avg(priced, carMargin)
    };
  }

  /* ==========================================================================
     PRICE CHECKING
     --------------------------------------------------------------------------
     The bidding tool works backwards from what you'd sell the car for, so that
     number has to be real rather than a guess.

     Auto Trader's own valuation tools come with your package, but reaching
     them from code needs API access you don't have yet. Until then this does
     the next best thing and does it in about ten seconds: opens a search for
     the exact spec you're stood in front of, sorted cheapest first, so you can
     see what similar cars are actually up for. Then you record what you saw,
     and it's waiting for you next time.
     ========================================================================== */

  /** Build an Auto Trader search URL for this exact spec. */
  function autoTraderSearchUrl(v, mileage) {
    const p = new URLSearchParams();
    p.set('postcode', (CFG.business.searchPostcode || 'NE1 1AA').replace(/\s+/g, ''));
    p.set('radius', '1500');                       // national: we want the market, not the neighbours
    if (v.make)  p.set('make', v.make);
    if (v.model) p.set('model', v.model);
    if (v.year) {
      p.set('year-from', String(v.year - 1));
      p.set('year-to', String(v.year + 1));
    }
    if (mileage) p.set('maximum-mileage', String(Math.round(mileage * 1.25 / 5000) * 5000));
    p.set('sort', 'price-asc');
    return 'https://www.autotrader.co.uk/car-search?' + p.toString();
  }

  /** What we've recorded before for this make/model. */
  async function loadPriceHistory(make, model) {
    if (!make) return [];
    let q = sb.from('price_checks').select('*')
      .ilike('make', make).order('created_at', { ascending: false }).limit(16);
    if (model) q = q.ilike('model', model);
    const { data, error } = await q;
    if (error) { console.warn('price_checks unavailable', error); return null; }
    return data || [];
  }

  /**
   * Record what was on screen. Deliberately three quick numbers, no essay.
   * @param {object} [opts]  { carId, after } when checking a car already in stock
   */
  function recordPriceCheck(v, mileage, opts) {
    opts = opts || {};
    const title = [v.make, v.model].filter(Boolean).join(' ') || 'this car';

    sheet('What were they up for?', `Similar ${title}s on Auto Trader`, []);
    $('#sheetActions').innerHTML = `
      <div class="card" style="padding:16px;margin:0">
        <div class="row-2">
          <div class="f">
            <label for="pcLow">Cheapest</label>
            <div class="money"><input class="in" id="pcLow" type="number" inputmode="numeric" placeholder="0"></div>
          </div>
          <div class="f">
            <label for="pcHigh">Dearest</label>
            <div class="money"><input class="in" id="pcHigh" type="number" inputmode="numeric" placeholder="0"></div>
          </div>
        </div>
        <div class="f" style="margin-top:16px;margin-bottom:0">
          <label for="pcTypical">What most were around <span class="req">*</span></label>
          <div class="money"><input class="in" id="pcTypical" type="number" inputmode="numeric" placeholder="0"></div>
          <span class="hint">This is the one that matters. It becomes your sell price.</span>
        </div>
        <div class="f" style="margin-top:16px;margin-bottom:0">
          <label for="pcNotes">Anything worth remembering?</label>
          <input class="in" id="pcNotes" placeholder="e.g. all had higher miles, cheapest was a Cat N">
        </div>
        <button class="btn btn--accent btn--block" id="pcSave" style="margin-top:16px">
          Save and use this price
        </button>
      </div>`;

    $('#pcSave').onclick = async () => {
      const typical = int($('#pcTypical').value);
      if (!typical) { toast('Put in the typical price at least'); return; }

      const row = {
        make: v.make || 'Unknown',
        model: v.model || null,
        year: v.year || null,
        mileage: mileage || null,
        low: int($('#pcLow').value),
        high: int($('#pcHigh').value),
        typical,
        source: 'autotrader',
        notes: $('#pcNotes').value.trim() || null,
        car_id: opts.carId || null
      };

      const { error } = await sb.from('price_checks').insert(row);
      closeSheet();

      if (error) {
        console.warn(error);
        toast('Couldn’t save it, but the price is in');
      } else {
        toast('Saved to your price book', 'ok');
        if (opts.after) opts.after();
      }

      // Feed it straight into the calculator, which is the whole point
      const sale = $('#bSale');
      if (sale) { sale.value = typical; calcBid(); sale.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      refreshPriceBlock(v, mileage);
    };
  }

  /** The price-check panel, re-rendered after a new check is saved. */
  async function refreshPriceBlock(v, mileage) {
    const box = $('#priceCheckBox');
    if (!box) return;
    const history = await loadPriceHistory(v.make, v.model);

    const url = autoTraderSearchUrl(v, mileage);
    // Auction results (schema v12) are what these fetch in the trade, a guide
    // to what you'll pay, never a sell price, so they get their own list
    const seen = (history || []).filter(h => h.typical && h.source !== 'auction');
    const hammer = (history || []).filter(h => h.typical && h.source === 'auction');
    const avgSeen = seen.length
      ? Math.round(seen.reduce((n, h) => n + h.typical, 0) / seen.length) : null;

    box.innerHTML = `
      <a class="btn btn--primary btn--block" href="${url}" target="_blank" rel="noopener">
        ${icon('search')} See what these go for on Auto Trader
      </a>
      <button class="btn btn--outline btn--block" id="pcOpen" style="margin-top:10px">
        Record what I saw
      </button>

      ${history === null ? `
        <p class="hint" style="margin-top:12px">
          Price book not set up yet. Run <strong>schema-v3-price-book.sql</strong> in Supabase
          and your checks will start being remembered.
        </p>`
      : seen.length ? `
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line-2)">
          <div style="font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px">
            What you've seen before
          </div>
          ${seen.slice(0, 4).map(h => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:14.5px">
              <span style="color:var(--ink-3)">
                ${new Date(h.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
                ${h.mileage ? ' · ' + nf(h.mileage) + ' mi' : ''}
              </span>
              <span style="font-weight:700">${money(h.typical)}</span>
            </div>`).join('')}
          <button class="btn btn--accent btn--block btn--sm" id="pcUse" style="margin-top:12px">
            Use ${money(avgSeen)} as the sell price
          </button>
        </div>`
      : `<p class="hint" style="margin-top:12px">
          Nothing recorded for these yet. Check Auto Trader, tap Record, and it'll
          be here next time.
        </p>`}
      ${hammer.length ? `
        <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line-2)">
          <div style="font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin-bottom:4px">
            Seen at auction
          </div>
          <p class="hint" style="margin:0 0 6px">What they fetched in the trade: a guide to what you’ll pay, not what it’ll sell for.</p>
          ${hammer.slice(0, 4).map(h => `
            <div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:14.5px">
              <span style="color:var(--ink-3)">
                ${new Date(h.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
                ${h.detail && h.detail.house ? ' · ' + esc(h.detail.house) : ''}${h.year ? ' · ' + h.year : ''}${h.mileage ? ' · ' + nf(h.mileage) + ' mi' : ''}
              </span>
              <span style="font-weight:700">${money(h.typical)}</span>
            </div>`).join('')}
        </div>` : ''}`;

    // Query inside `box`, not the document: by the time the await above
    // resolves the user may have tapped "Check another car", leaving this
    // block detached. Looking it up globally would return null and throw.
    const open = box.querySelector('#pcOpen');
    if (open) open.onclick = () => recordPriceCheck(v, mileage);

    const use = box.querySelector('#pcUse');
    if (use) use.onclick = () => {
      const sale = $('#bSale');
      if (sale) { sale.value = avgSeen; calcBid(); toast('Sell price set', 'ok'); }
    };
  }

  /* ---- customer requests this car would satisfy --------------------------
     Three ways a request matches:
       1. It names this make (and model, if it gives one). Spelling ignored.
       2. The notes mention this model: "also after Jazzes, Fiestas, Corsas".
       3. It names no make but asks for a gearbox, fuel or body, and this car
          is KNOWN to be that. "Any automatic" never matches a car whose
          gearbox the lookup didn't return, so it can't cry wolf. */
  function matchingRequests(v) {
    const mk = keyOf(v.make);
    const md = v.model ? modelKeyOf(v.model) : '';
    const word = String(v.model || '').toLowerCase().split(/\s+/)[0] || '';
    const mentions = word.length >= 3
      ? new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const gear = String((v.at && v.at.transmissionType) || '').toLowerCase();
    const fuel = fuelFrom((v.at && v.at.fuelType) || v.fuelType);
    const body = String((v.at && v.at.bodyType) || '').toLowerCase();

    return state.requests.filter(r => {
      if (r.status === 'closed' || r.archived) return false;
      if (mentions && mentions.test(r.notes || '')) return true;

      if (r.make) {
        if (keyOf(r.make) !== mk) return false;
        if (r.model && md) {
          const rm = modelKeyOf(r.model);
          if (!rm.includes(md) && !md.includes(rm)) return false;
        }
        return true;
      }

      let asked = 0;
      if (r.transmission) { asked++; if (gear !== r.transmission) return false; }
      if (r.fuel)         { asked++; if (!fuelMatches(fuel, r.fuel)) return false; }
      if (r.body_type)    { asked++; if (body !== r.body_type) return false; }
      return asked > 0;
    });
  }

  /* ---- mileage history chart, drawn as plain SVG ------------------------- */
  function mileageChart(readings) {
    if (!readings || readings.length < 2) return '';
    const w = 320, h = 110, pad = 6;
    const xs = readings.map(r => new Date(r.date).getTime());
    const ys = readings.map(r => r.miles);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y1 = Math.max(...ys);
    const px = t => pad + ((t - x0) / Math.max(1, x1 - x0)) * (w - pad * 2);
    const py = v => h - pad - (v / Math.max(1, y1)) * (h - pad * 2);

    const pts = readings.map(r => `${px(new Date(r.date).getTime()).toFixed(1)},${py(r.miles).toFixed(1)}`);
    const dots = readings.map((r, i) => {
      const down = i > 0 && r.miles < readings[i - 1].miles - 50;
      return `<circle cx="${px(new Date(r.date).getTime()).toFixed(1)}" cy="${py(r.miles).toFixed(1)}"
              r="${down ? 5 : 3}" fill="${down ? '#B3261E' : '#12203A'}"/>`;
    }).join('');

    return `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;overflow:visible" role="img"
           aria-label="Mileage recorded at each MOT">
        <polyline points="${pts.join(' ')}" fill="none" stroke="#2A62B4" stroke-width="2.5"
                  stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
      </svg>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--ink-3);margin-top:2px">
        <span>${new Date(readings[0].date).getFullYear()} · ${nf(readings[0].miles)} mi</span>
        <span>${new Date(readings[readings.length-1].date).getFullYear()} · ${nf(readings[readings.length-1].miles)} mi</span>
      </div>`;
  }

  /* ---- render ------------------------------------------------------------ */
  function renderValuation() {
    const v = vehicle;
    if (!v) return;
    const mot = v.mot;
    const title = [v.year, v.make, v.model].filter(Boolean).join(' ') || 'Unknown vehicle';
    const hist = ownHistory(v.make, v.model);
    const reqs = matchingRequests(v);

    const flagHtml = (v.flags || []).map(f => `
      <div class="msg msg--${f.level === 'bad' ? 'err' : f.level === 'warn' ? 'warn' : 'ok'} is-shown"
           style="margin-bottom:8px">${esc(f.text)}</div>`).join('');

    const mileage = mot && mot.latestMileage != null ? mot.latestMileage : (v.manualMileage || null);
    const spec = [
      v.engineLitres ? Number(v.engineLitres).toFixed(1) + 'L' : null,
      v.fuelType ? titleCase(v.fuelType) : null,
      v.colour,
      mileage != null ? nf(mileage) + ' mi' : null
    ].filter(Boolean).join(' · ');

    const at = v.at || null;
    const atVal = at && at.valuations;
    const atMet = at && at.metrics;
    const atComp = at && at.competitors;

    $('#vResult').innerHTML = `
      ${at && at.env === 'sandbox' ? `<div class="msg msg--warn is-shown" style="margin-bottom:14px">
        <strong>Auto Trader sandbox.</strong> These are test figures, not real prices.</div>` : ''}

      <!-- What it is -->
      <div class="section-card">
        <h2>The car</h2>
        <h3 style="font-size:21px;margin-bottom:4px">${esc(title)}</h3>
        ${at && at.derivative ? `<div style="font-size:14.5px;color:var(--ink-2);margin-bottom:2px">${esc(at.derivative)}</div>` : ''}
        <div style="font-size:14.5px;color:var(--ink-3)">${esc(spec || 'No details returned')}</div>
        ${v.manual ? `<p class="hint" style="margin-top:10px">
          Typed in by hand, so there's no MOT history here. The free government
          <a href="https://www.check-mot.service.gov.uk/" target="_blank" rel="noopener" style="text-decoration:underline">MOT history check</a>
          shows every mileage reading and advisory from the plate.
        </p>`
        : !v.found?.mot ? `<p class="hint" style="margin-top:10px">
          MOT history unavailable${v.motUnavailableReason === 'no_key'
            ? '. Add the free MOT API keys to see mileage history and advisories.' : '.'}
        </p>` : ''}
      </div>

      ${flagHtml ? `
      <!-- Warnings -->
      <div class="section-card">
        <h2>What to watch for</h2>
        ${flagHtml}
      </div>` : ''}

      ${atVal || atMet || atComp ? `
      <!-- Auto Trader's view of the market -->
      <div class="section-card">
        <h2>Auto Trader says</h2>
        ${atVal ? `
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;text-align:center">
            ${[['Retail', atVal.retail, 'var(--green-600)'], ['Trade', atVal.trade], ['Part exchange', atVal.partExchange], ['Private sale', atVal.private]]
              .filter(([, n]) => n != null).map(([label, n, tone]) => `
              <div class="card" style="padding:12px 6px;margin:0">
                <b style="font-size:19px;${tone ? 'color:' + tone : ''}">${money(n)}</b>
                <br><span style="font-size:11.5px;color:var(--ink-3);text-transform:uppercase">${label}</span></div>`).join('')}
          </div>
          <p class="hint" style="margin-top:8px">At ${nf(at.mileageUsed)} miles.</p>` : ''}
        ${atMet && (atMet.rating != null || atMet.daysToSell != null) ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;text-align:center">
            <div><b style="font-size:19px">${atMet.rating != null ? Math.round(atMet.rating) + '/100' : 'n/a'}</b>
              <br><span style="font-size:11.5px;color:var(--ink-3)">RETAIL RATING</span></div>
            <div><b style="font-size:19px">${atMet.daysToSell != null ? Math.round(atMet.daysToSell) + ' days' : 'n/a'}</b>
              <br><span style="font-size:11.5px;color:var(--ink-3)">TYPICAL TIME TO SELL</span></div>
          </div>` : ''}
        ${atComp && atComp.sampled ? `
          <p style="font-size:15px;color:var(--ink-2);margin-top:14px;line-height:1.5">
            <strong>${nf(atComp.count)} similar</strong> on Auto Trader, advertised between
            <strong>${money(atComp.low)}</strong> and <strong>${money(atComp.high)}</strong>
            (middle ${money(atComp.median)}).
          </p>` : ''}
        ${at.unavailable && at.unavailable.length ? `<p class="hint" style="margin-top:10px">
          Not included on your Auto Trader account: ${esc(at.unavailable.join(', '))}.</p>` : ''}
        ${atVal && atVal.retail != null ? `
          <button class="btn btn--accent btn--block btn--sm" id="atUseRetail" style="margin-top:12px">
            Use ${money(atVal.retail)} as the sell price
          </button>` : ''}
      </div>` : ''}

      ${mot && mot.readings.length >= 2 ? `
      <div class="section-card">
        <h2>Mileage history</h2>
        ${mileageChart(mot.readings)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;text-align:center">
          <div><b style="font-size:19px">${mot.recentMilesPerYear != null ? nf(mot.recentMilesPerYear) : 'n/a'}</b>
            <br><span style="font-size:11.5px;color:var(--ink-3)">MILES/YR RECENTLY</span></div>
          <div><b style="font-size:19px">${mot.passRate != null ? mot.passRate + '%' : 'n/a'}</b>
            <br><span style="font-size:11.5px;color:var(--ink-3)">MOT PASS RATE</span></div>
        </div>
      </div>` : ''}

      ${mot && mot.currentAdvisories.length ? `
      <div class="section-card">
        <h2>Advisories on the last MOT</h2>
        <ul style="display:grid;gap:9px">
          ${mot.currentAdvisories.slice(0, 10).map(a =>
            `<li style="font-size:14.5px;color:var(--ink-2);padding-left:16px;position:relative">
               <span style="position:absolute;left:0;top:8px;width:6px;height:6px;border-radius:50%;background:var(--amber-600)"></span>
               ${esc(a)}</li>`).join('')}
        </ul>
      </div>` : ''}

      <!-- Your own history -->
      <div class="section-card">
        <h2>Your history with ${esc(v.make || 'this make')}</h2>
        ${hist ? `
          <p class="hint" style="margin:-6px 0 14px">
            Based on ${hist.total} ${hist.exact ? esc([v.make, v.model].filter(Boolean).join(' ')) : esc(v.make)}
            ${hist.total === 1 ? '' : 's'} you've had${hist.exact ? '' : ' (no exact model match, so showing the make)'}.
          </p>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;text-align:center">
            <div class="card" style="padding:12px 6px;margin:0">
              <b style="font-size:19px">${hist.avgBought != null ? money(hist.avgBought) : 'n/a'}</b>
              <br><span style="font-size:11.5px;color:var(--ink-3)">AVG PAID</span></div>
            <div class="card" style="padding:12px 6px;margin:0">
              <b style="font-size:19px;color:var(--green-600)">${hist.avgSold != null ? money(hist.avgSold) : 'n/a'}</b>
              <br><span style="font-size:11.5px;color:var(--ink-3)">AVG SOLD</span></div>
            <div class="card" style="padding:12px 6px;margin:0">
              <b style="font-size:19px">${hist.avgDays != null ? hist.avgDays + ' days' : 'n/a'}</b>
              <br><span style="font-size:11.5px;color:var(--ink-3)">AVG TO SELL</span></div>
            <div class="card" style="padding:12px 6px;margin:0">
              <b style="font-size:19px;color:var(--accent-600)">${hist.avgMargin != null ? money(hist.avgMargin) : 'n/a'}</b>
              <br><span style="font-size:11.5px;color:var(--ink-3)">AVG MARGIN</span></div>
          </div>`
        : `<p class="hint">You haven't traded one of these before, so there's nothing to
             compare against. The figures build up as you record what you pay and what you
             sell for.</p>`}
      </div>

      ${reqs.length ? `
      <div class="section-card" style="border:2px solid var(--green-600)">
        <h2 style="color:var(--green-600)">${reqs.length} ${reqs.length === 1 ? 'person is' : 'people are'} asking for one of these</h2>
        ${reqs.slice(0, 4).map(r => `
          <div style="padding:9px 0;border-bottom:1px solid var(--line-2)">
            <strong style="font-size:15.5px">${esc(r.name || 'Someone')}</strong>
            <span style="font-size:14px;color:var(--ink-3)">
              ${r.budget_max ? ' · up to ' + money(r.budget_max) : ''}
              ${r.timescale ? ' · ' + esc(TIMESCALE[r.timescale] || r.timescale) : ''}
            </span>
          </div>`).join('')}
        <p class="hint" style="margin-top:12px">That's a buyer already waiting. Worth bidding a bit harder.</p>
      </div>` : ''}

      <!-- Where the sell price actually comes from -->
      <div class="section-card">
        <h2>What are these making?</h2>
        <p class="hint" style="margin:-6px 0 14px">
          Check the real market before you decide what it's worth to you. Takes ten seconds.
        </p>
        <div id="priceCheckBox"></div>
      </div>

      <!-- The number that matters -->
      <div class="section-card">
        <h2>Work out your maximum bid</h2>
        <div class="f">
          <label for="bSale">What you'd realistically sell it for</label>
          <div class="money"><input class="in" id="bSale" type="number" inputmode="numeric"
            value="${atVal && atVal.retail != null ? atVal.retail : hist && hist.avgSold != null ? hist.avgSold : ''}" placeholder="0"></div>
          ${atVal && atVal.retail != null
            ? `<span class="hint">Filled in from Auto Trader's retail valuation. Knock off what you usually lose to haggling.</span>`
            : hist && hist.avgSold != null
            ? `<span class="hint">Filled in from what you've actually achieved on these. Check Auto Trader above if you want to double-check it.</span>`
            : `<span class="hint">Use the Auto Trader check above rather than guessing. The whole calculation rests on this number.</span>`}
        </div>
        <div class="row-2">
          <div class="f">
            <label for="bFee">Auction fee %</label>
            <input class="in" id="bFee" type="number" inputmode="decimal" step="0.5" value="${bidDefaults.feePct}">
          </div>
          <div class="f">
            <label for="bTransport">Transport £</label>
            <input class="in" id="bTransport" type="number" inputmode="numeric" value="${bidDefaults.transport}">
          </div>
        </div>
        <div class="row-2" style="margin-top:16px">
          <div class="f">
            <label for="bPrep">Prep budget £</label>
            <input class="in" id="bPrep" type="number" inputmode="numeric" value="${bidDefaults.prep}">
          </div>
          <div class="f">
            <label for="bMargin">Margin you want %</label>
            <input class="in" id="bMargin" type="number" inputmode="numeric" value="${bidDefaults.marginPct}">
          </div>
        </div>

        <div id="bidResult" style="margin-top:18px"></div>

        <button class="btn btn--outline btn--block btn--sm" id="bSaveDefaults" style="margin-top:12px">
          Remember these settings
        </button>
      </div>

      <button class="btn btn--accent btn--block" id="vAddCar" style="margin-bottom:10px">
        I bought it, add to stock
      </button>
      <button class="btn btn--outline btn--block" id="vClear">Check another car</button>
      <div style="height:10px"></div>`;

    wireBidCalc();
    refreshPriceBlock(v, mileage);
    const useRetail = $('#atUseRetail');
    if (useRetail) useRetail.onclick = () => {
      const sale = $('#bSale');
      sale.value = atVal.retail; calcBid();
      sale.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Sell price set', 'ok');
    };
    $('#vAddCar').onclick = createFromLookup;
    $('#vClear').onclick = () => {
      vehicle = null; $('#vResult').innerHTML = '';
      $('#vReg').value = ''; msg('#vMsg', ''); $('#vReg').focus();
    };
  }

  function wireBidCalc() {
    const ids = ['#bSale', '#bFee', '#bTransport', '#bPrep', '#bMargin'];
    ids.forEach(id => $(id).addEventListener('input', calcBid));

    $('#bSaveDefaults').onclick = () => {
      bidDefaults = {
        feePct: num($('#bFee').value) ?? 8,
        prep: int($('#bPrep').value) ?? 400,
        transport: int($('#bTransport').value) ?? 80,
        marginPct: num($('#bMargin').value) ?? 22
      };
      try { localStorage.setItem(BID_DEFAULTS_KEY, JSON.stringify(bidDefaults)); } catch {}
      toast('Saved. These will be filled in next time', 'ok');
    };
    calcBid();
  }

  function calcBid() {
    const sale = int($('#bSale').value);
    const box = $('#bidResult');

    if (!sale) {
      box.innerHTML = `<div class="msg msg--info is-shown">
        Put in what you'd sell it for and we'll work backwards to your maximum bid.
      </div>`;
      return;
    }

    const feePct = num($('#bFee').value) ?? 0;
    const prep = int($('#bPrep').value) ?? 0;
    const transport = int($('#bTransport').value) ?? 0;
    const marginPct = num($('#bMargin').value) ?? 0;

    // Work backwards: sale price, less the margin you want, less prep and
    // transport, gives the total you can afford to pay at the auction.
    // The hammer price plus fee has to fit inside that.
    const wantedMargin = Math.round(sale * (marginPct / 100));
    const affordableAllIn = sale - wantedMargin - prep - transport;
    const maxBid = Math.floor(affordableAllIn / (1 + feePct / 100));

    if (maxBid <= 0) {
      box.innerHTML = `<div class="msg msg--err is-shown">
        <strong>There's no money in this one.</strong><br>
        At ${money(sale)} you can't cover ${money(prep + transport)} of prep and transport
        and still make ${marginPct}%. Either it sells for more than you think, or walk away.
      </div>`;
      return;
    }

    const fee = Math.round(maxBid * (feePct / 100));

    box.innerHTML = `
      <div style="background:linear-gradient(150deg,var(--navy-800),var(--navy-900));
                  border-radius:var(--r-lg);padding:22px 18px;text-align:center;color:#fff">
        <div style="font-size:12px;font-weight:800;letter-spacing:.1em;color:#A8B6CC">MAXIMUM BID</div>
        <div style="font-size:44px;font-weight:800;letter-spacing:-.04em;color:var(--accent-300);line-height:1.05;margin:4px 0">
          ${money(maxBid)}
        </div>
        <div style="font-size:13.5px;color:#B6C4D8">Stop bidding above this</div>
      </div>

      <div style="margin-top:14px;font-size:14.5px">
        ${[
          ['Hammer price', money(maxBid)],
          [`Auction fee (${feePct}%)`, money(fee)],
          ['Transport', money(transport)],
          ['Prep budget', money(prep)],
          ['<strong>Total into the car</strong>', '<strong>' + money(maxBid + fee + transport + prep) + '</strong>'],
          ['Sell at', money(sale)],
          ['<strong style="color:var(--green-600)">Your margin</strong>',
           '<strong style="color:var(--green-600)">' + money(sale - (maxBid + fee + transport + prep)) + '</strong>']
        ].map(([k, val]) => `
          <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line-2)">
            <span style="color:var(--ink-2)">${k}</span><span>${val}</span>
          </div>`).join('')}
      </div>`;
  }

  /** Bought it, so start a draft with everything already filled in. */
  function createFromLookup() {
    const v = vehicle;
    if (!v) return;

    const bid = prompt('What did you pay for it?\n\nHammer price including fees. Private, never shown on the website.', '');
    if (bid === null) return;
    const paidNum = parseInt(String(bid).replace(/[^0-9]/g, ''), 10);

    openForm(null);
    $('#fReg').value = fmtReg(v.registration);
    if (v.make) { setPicker('#fMake', '#fMakeOther', v.make); refreshFormModels(); }
    if (v.model) setPicker('#fModel', '#fModelOther', v.model);
    if (v.year) $('#fYear').value = v.year;
    if (v.colour) setPicker('#fColour', '#fColourOther', v.colour);
    if (v.engineLitres) $('#fEngine').value = v.engineLitres;
    if (v.motExpiryDate) $('#fMot').value = String(v.motExpiryDate).slice(0, 10);
    if (v.mot && v.mot.latestMileage != null) $('#fMileage').value = v.mot.latestMileage;
    else if (v.manualMileage) $('#fMileage').value = v.manualMileage;
    if (!isNaN(paidNum)) { $('#fPurchase').value = paidNum; renderCostSummary(); }

    // Auto Trader knows the trim, gearbox and body, which the DVLA never did
    if (v.at) {
      if (v.at.trim) $('#fVariant').value = v.at.trim;
      if (v.at.doors) $('#fDoors').value = v.at.doors;
      const gear = String(v.at.transmissionType || '').toLowerCase();
      if (gear === 'manual' || gear === 'automatic') setChip('#fTrans', gear);
      const body = String(v.at.bodyType || '').toLowerCase();
      if (BODIES.some(([k]) => k === body)) setChip('#fBody', body);
    }

    const f = fuelFrom(v.fuelType);
    if (f) setChip('#fFuel', f);

    if (v.mot && v.mot.currentAdvisories.length) {
      $('#fPrivateNotes').value =
        'Advisories at purchase:\n' + v.mot.currentAdvisories.map(a => '· ' + a).join('\n');
    }

    state.dirty = true;
    toast('Started from the plate. Add photos and a price', 'ok');
  }

  /* ========================================================= INVOICES
     Make an invoice in a minute instead of asking ChatGPT for one (3 Oct
     2026). Pick a kind, the car fills itself in, type the customer, check
     the figures and the terms, then Check and send: the finished PDF goes
     out through the phone's share sheet (Gmail, Mail, WhatsApp, Print).

     What goes on an invoice, and every term's wording, is worked out in
     invoice-doc.js. This is just the screens. Saved invoices live in the
     `invoices` table (schema-v10); without it everything still works except
     the history, and the app says so. */
  const INV = window.MBU_INVOICE || null;
  const JSPDF = {
    src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js',
    sri: 'sha512-plOdviVmws4Y3JAvbnpfKb2hVxKM1lCwsi3vmElYRj+tiDLffZ4FVUj5a8vyKJ9pIgl8JCAHEJ4D1iUKBecswg=='
  };
  const PAY_METHODS = ['Bank transfer', 'Cash', 'Card', 'Finance company', 'Cheque', 'Other'];
  const SELLER_KEY = 'mbu_inv_seller';
  const IV = { list: [], loaded: false, tab: 'all', q: '', settings: null, cur: null, pdf: null, pdfFor: null, assets: null };

  /* Gmail on an iPhone ignores the subject the share sheet hands it and
     makes one from the first line of the message instead (that's how an
     invoice went out headed "Hi John,"). So on an iPhone or iPad the
     subject also goes in as the message's first line. Android's Gmail and
     Apple Mail take the subject properly, and get the message as written. */
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const shareText = e => IOS && (e.subject || '').trim() ? `${e.subject.trim()}\n\n${e.body || ''}` : (e.body || '');

  const ukPhone = p => String(p || '').replace(/^\+44\s?/, '0').replace(/^0(\d{4})(\d{6})$/, '0$1 $2');
  const invTitle = i => (i.customer && i.customer.name) || 'No name yet';
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---- Settings: who sells, the business details, VAT ------------------- */
  function settingsDefaults() {
    const b = CFG.business || {};
    const site = String((CFG.options && CFG.options.siteUrl) || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    return {
      address: [b.addressLine, b.town, b.postcode].filter(Boolean).join(', ') || INV.DEFAULT_SETTINGS.address,
      email: b.email || INV.DEFAULT_SETTINGS.email,
      website: site || INV.DEFAULT_SETTINGS.website,
      // Both numbers in use: the website's, and the one on Autotrader. Names
      // go in under Settings → Invoice details.
      sellers: [{ name: '', phone: ukPhone(b.phone) || '07438 510044' }, { name: '', phone: '07537 123723' }]
    };
  }

  async function invoiceSettings() {
    if (IV.settings) return IV.settings;
    let saved = null;
    if (state.schema.v10 !== false) {
      try {
        const { data, error } = await sb.from('app_settings').select('value').eq('key', 'invoice').maybeSingle();
        if (!error && data) saved = data.value;
      } catch { /* not there yet */ }
    }
    if (!saved) { try { saved = JSON.parse(localStorage.getItem('mbu_invoice_settings') || 'null'); } catch { /* none */ } }
    IV.settings = Object.assign({}, INV.DEFAULT_SETTINGS, settingsDefaults(), saved || {});
    return IV.settings;
  }

  async function saveInvoiceSettings(next) {
    IV.settings = Object.assign({}, IV.settings, next);
    try { localStorage.setItem('mbu_invoice_settings', JSON.stringify(IV.settings)); } catch { /* fine */ }
    if (state.schema.v10) {
      const { error } = await sb.from('app_settings').upsert({ key: 'invoice', value: IV.settings, updated_at: new Date().toISOString() });
      if (error) return toast('Saved on this phone only: ' + error.message);
      return toast('Saved for both phones', 'ok');
    }
    toast('Saved on this phone. Run schema v10 to share it with the other phone.', 'ok');
  }

  async function invoiceSettingsSheet() {
    const s = await invoiceSettings();
    const sellerRow = (x, i) => `
      <div class="inv-seller" data-i="${i}">
        <input class="in" data-s="name" value="${esc(x.name)}" placeholder="Name (e.g. Usman)" autocapitalize="words">
        <input class="in" data-s="phone" value="${esc(x.phone)}" placeholder="Phone" inputmode="tel">
        <button class="inv-x" type="button" data-del aria-label="Remove">${icon('close')}</button>
      </div>`;
    const box = sheetHtml('Invoice details', 'Printed on every invoice. Shared by both phones once schema v10 is run.', `
      <div class="section-card">
        <h2>Who sells</h2>
        <p class="hint" style="margin:-6px 0 12px">Each invoice says who dealt with it and their number. Pick one when you make it.</p>
        <div id="isSellers">${s.sellers.map(sellerRow).join('')}</div>
        <button class="btn btn--ghost" type="button" id="isAddSeller">${icon('plus')} Add someone</button>
      </div>
      <div class="section-card">
        <h2>The business</h2>
        <div class="f"><label>Trading address</label><input class="in" id="isAddress" value="${esc(s.address)}"></div>
        <div class="row-2">
          <div class="f"><label>Email</label><input class="in" id="isEmail" value="${esc(s.email)}" inputmode="email"></div>
          <div class="f"><label>Website</label><input class="in" id="isWebsite" value="${esc(s.website)}"></div>
        </div>
      </div>
      <div class="section-card">
        <h2>Company details</h2>
        <p class="hint" style="margin:-6px 0 12px">A limited company has to show its number and registered office on its invoices. From Companies House.</p>
        <div class="row-2">
          <div class="f"><label>Company number</label><input class="in" id="isCoNo" value="${esc(s.company_number)}" inputmode="numeric"></div>
          <div class="f"><label>Registered name</label><input class="in" id="isLegal" value="${esc(s.legal_name)}"></div>
        </div>
        <div class="f"><label>Registered office</label><input class="in" id="isOffice" value="${esc(s.registered_office)}"></div>
        <label class="tickrow"><input type="checkbox" id="isCoDefault"${s.company_default ? ' checked' : ''}>
          <div><strong>Tick it on every new invoice</strong><small>You can still untick it on any one.</small></div></label>
      </div>
      <div class="section-card">
        <h2>Pay monthly</h2>
        <div class="f"><label for="isLateFee">Fee for each missed or returned payment</label>
          <div class="money"><input class="in" id="isLateFee" inputmode="decimal" value="${esc(s.late_fee || '')}" placeholder="None"></div></div>
        <p class="hint" style="margin:-4px 0 0">Added to what they owe and written into every pay monthly agreement. Keep it to what chasing a payment really costs you: £12 is the level the Office of Fair Trading set for card late fees. Leave it blank for none. There’s no daily charge on purpose: it counts as interest, which takes the plan outside the FCA exemption.</p>
      </div>
      <div class="section-card">
        <h2>VAT</h2>
        <label class="tickrow"><input type="checkbox" id="isVat"${s.vat_registered ? ' checked' : ''}>
          <div><strong>MBU Sales Limited is VAT registered</strong><small>Adds the VAT number and the margin scheme wording. Leave off if not.</small></div></label>
        <div class="f" style="margin-top:12px"><label>VAT number</label><input class="in" id="isVatNo" value="${esc(s.vat_number)}" placeholder="GB 123 4567 89"></div>
      </div>
      <div class="section-card">
        <h2>Bank details</h2>
        <p class="hint" style="margin:-6px 0 12px">Printed on every invoice (under the money when something's owed), with the invoice number as the reference, and in the email. Kept in your database, not in the website's code.</p>
        <div class="f"><label for="isBankName">Account name</label><input class="in" id="isBankName" value="${esc(s.bank_name)}" autocapitalize="words"></div>
        <div class="row-2">
          <div class="f"><label for="isBankSort">Sort code</label><input class="in" id="isBankSort" value="${esc(s.bank_sort)}" inputmode="numeric" placeholder="00-00-00"></div>
          <div class="f"><label for="isBankAcc">Account number</label><input class="in" id="isBankAcc" value="${esc(s.bank_account)}" inputmode="numeric" placeholder="8 digits"></div>
        </div>
        <div class="f" style="margin:16px 0 0"><label for="isPay">Anything else about paying <span class="opt">(optional)</span></label>
          <textarea class="ta" id="isPay" rows="2" placeholder="e.g. Cash on collection is fine too">${esc(s.pay_details)}</textarea></div>
      </div>
      <button class="btn btn--accent btn--block" type="button" id="isSave">Save</button>`);
    const sellers = () => $$('#isSellers .inv-seller').map(r => ({ name: r.querySelector('[data-s=name]').value.trim(), phone: r.querySelector('[data-s=phone]').value.trim() }))
      .filter(x => x.name || x.phone);
    const wireDel = () => box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => b.closest('.inv-seller').remove());
    wireDel();
    $('#isAddSeller').onclick = () => { $('#isSellers').insertAdjacentHTML('beforeend', sellerRow({ name: '', phone: '' }, 99)); wireDel(); };
    $('#isSave').onclick = async () => {
      closeSheet();
      await saveInvoiceSettings({
        sellers: sellers(), address: $('#isAddress').value.trim(), email: $('#isEmail').value.trim(), website: $('#isWebsite').value.trim(),
        company_number: $('#isCoNo').value.trim(), legal_name: $('#isLegal').value.trim() || 'MBU Sales Limited',
        registered_office: $('#isOffice').value.trim(), company_default: $('#isCoDefault').checked,
        vat_registered: $('#isVat').checked, vat_number: $('#isVatNo').value.trim(), pay_details: $('#isPay').value.trim(),
        bank_name: $('#isBankName').value.trim(), bank_sort: sortCode($('#isBankSort').value), bank_account: $('#isBankAcc').value.replace(/\D/g, ''),
        late_fee: num($('#isLateFee').value) || 0
      });
      if (state.view === 'invoice') renderInvoiceForm();
      if (state.view === 'invprev') renderPreview();
    };
  }
  $('#invoiceSettingsBtn').onclick = () => invoiceSettingsSheet();
  // "305466" or "30 54 66" → "30-54-66"
  const sortCode = v => { const d = String(v || '').replace(/\D/g, ''); return d.length === 6 ? d.replace(/(\d\d)(\d\d)(\d\d)/, '$1-$2-$3') : String(v || '').trim(); };

  /* ---- A new invoice ---------------------------------------------------- */
  function sellerLabel(x) { return [x.name, x.phone].filter(Boolean).join(' · ') || 'No name'; }

  async function blankInvoice(kind) {
    const s = await invoiceSettings();
    const pick = remembered(SELLER_KEY, '');
    const seller = s.sellers.find(x => sellerLabel(x) === pick) || s.sellers[0] || { name: '', phone: '' };
    return {
      kind: kind || 'paid', issue_date: INV.today(), sale_date: INV.today(), status: 'draft', terms_v: INV.TERMS_V, disclosed: '',
      vehicle: {}, customer: {}, seller: { name: seller.name, phone: seller.phone },
      price: null, extras: [], px: { on: false }, delivery: { on: false }, payments: [], deposit_nonrefundable: true,
      balance_due_date: '', plan: { count: '', amount: '', first: '', frequency: 'monthly' },
      terms: {}, extra_terms: [], custom_terms: [], notes: '',
      options: { company: !!s.company_default }, signatures: {}, sent: []
    };
  }

  /* What the buyer has to be told about a car before buying, from its
     record: the Cat status and the damage note. Printed as the "Disclosed
     before sale" term, it can't later be a reason to reject the car. */
  const CAT_WORDS = { cat_s: 'Category S (structural damage)', cat_n: 'Category N (non-structural damage)',
    cat_c: 'Category C (an older category: damage costing more than its value to repair)', cat_d: 'Category D (an older category: repairable damage)' };
  function disclosedFromCar(car) {
    return [car.hpi_status && car.hpi_status !== 'clear' ? `It is recorded as an insurance write-off, ${CAT_WORDS[car.hpi_status] || LABEL.hpi[car.hpi_status] || car.hpi_status}` : '',
      String(car.condition_notes || '').trim()].filter(Boolean).join('\n');
  }

  function vehicleFromCar(car) {
    return { registration: car.registration || '', make: car.make ? (MK.makeName(car.make) || car.make) : '', model: car.model || '',
      variant: car.variant || '', year: car.year || '', mileage: car.mileage || '', colour: car.colour || '' };
  }

  /** An invoice for one of your cars, filled in from what the app knows. */
  async function invoiceForCar(car, kind) {
    kind = kind || (car.status === 'reserved' ? 'deposit' : 'paid');
    const inv = await blankInvoice(kind);
    inv.car_id = car.id;
    inv.vehicle = vehicleFromCar(car);
    inv.disclosed = disclosedFromCar(car);
    inv.price = car.status === 'sold' && car.sale_price != null ? car.sale_price : car.price;
    if (car.sold_at) inv.sale_date = INV.isoDate(new Date(car.sold_at));
    if (car.px_sale && car.px_cash != null && car.sale_price != null) {
      const theirs = pxCarOf(car);
      inv.px = { on: true, allowance: Math.max(0, car.sale_price - car.px_cash),
        registration: theirs ? theirs.registration : '', make: theirs ? [MK.makeName(theirs.make) || theirs.make, theirs.model].filter(Boolean).join(' ') : '' };
    }
    seedPayments(inv);
    openInvoice(inv);
  }

  // The usual starting payments for a kind: all of it for paid in full, a
  // deposit row for a deposit, what they put down for pay monthly. Marked
  // `auto` until someone types in them, so changing the kind swaps them for
  // the new kind's rather than leaving "paid £7,000" on a pay monthly plan.
  function seedPayments(inv) {
    inv.payments = (inv.payments || []).filter(p => !p.auto);
    // Paid in full: one row for whatever the other payments (a deposit taken
    // earlier) leave, kept in step by syncAutoPaid as the figures change
    if (inv.kind === 'paid') {
      const left = INV.totals(inv).balance;
      inv.payments.push({ date: inv.sale_date || INV.today(), amount: left > 0.004 ? left : '', method: 'Bank transfer', auto: true });
      return;
    }
    if (inv.payments.length) return;
    if (inv.kind === 'deposit') inv.payments = [{ date: INV.today(), amount: '', method: 'Bank transfer', deposit: true, auto: true }];
    if (inv.kind === 'instalments') {
      inv.payments = [{ date: inv.sale_date || INV.today(), amount: '', method: 'Cash', auto: true }];
      if (!inv.plan.first) { const d = new Date(); d.setMonth(d.getMonth() + 1); inv.plan.first = INV.isoDate(d); }
    }
  }

  /* The starting "paid in full" row follows the figures until someone types
     in it: the price (or delivery, extras, part exchange) less every other
     payment. Add a £250 deposit row and it drops by £250, so the invoice
     never says more was paid than the car cost. `box` updates the field on
     screen without redrawing the form (which would lose the cursor). */
  function syncAutoPaid(inv, box) {
    if (inv.kind !== 'paid') return;
    const auto = (inv.payments || []).find(p => p.auto);
    if (!auto) return;
    const left = INV.totals(Object.assign({}, inv, { payments: inv.payments.filter(p => !p.auto) })).balance;
    auto.amount = left > 0.004 ? left : '';
    if (inv.sale_date) auto.date = inv.sale_date;
    if (!box) return;
    const i = inv.payments.indexOf(auto);
    const f = box.querySelector(`[data-k="payments.${i}.amount"]`), dt = box.querySelector(`[data-k="payments.${i}.date"]`);
    if (f && document.activeElement !== f) f.value = auto.amount;
    if (dt && document.activeElement !== dt) dt.value = auto.date || '';
  }

  /* After a payment or a delivery, the invoice becomes whatever's true now,
     keeping its number (one invoice per sale): a deposit receipt or a
     balance to pay that's all paid becomes Paid in full; a deposit receipt
     whose car has been delivered, money still owed, becomes Balance to pay
     (the car's sold, not reserved). Returns the new kind, or false. */
  function settleKind(inv) {
    const from = inv.kind, d = INV.deliveryOf(inv);
    if (['deposit', 'balance'].includes(from) && INV.totals(inv).balance <= 0.004) inv.kind = 'paid';
    else if (from === 'deposit' && d && d.done) inv.kind = 'balance';
    if (inv.kind === from) return false;
    (inv.payments || []).forEach(p => delete p.auto);
    return inv.kind;
  }
  const settledWords = { paid: 'now a Paid in full invoice, same number.', balance: 'now a Balance to pay invoice, same number.' };

  function newInvoice() {
    pickCar({
      title: 'New invoice', sub: 'Which car is it for?',
      filter: c => c.status !== 'draft',
      extra: [
        { label: 'A car that isn’t in your stock', sub: 'Type its details in', icon: 'car', run: async () => openInvoice(await blankInvoice('paid')) },
        { label: 'No car: anything else', sub: 'Delivery, an MOT, repairs, a part', icon: 'receipt', run: async () => openInvoice(await blankInvoice('general')) }
      ],
      run: car => invoiceForCar(car)
    });
  }
  $('#invNew').onclick = () => newInvoice();

  function openInvoice(inv) {
    IV.cur = inv;
    IV.pdf = null;
    state.dirty = false;
    go('invoice', { title: inv.number ? INV.numberLabel(inv.number) : 'New invoice' });
    renderInvoiceForm();
  }

  /* ---- Reading and writing the form ------------------------------------- */
  function setPath(obj, path, value) {
    const parts = path.split('.');
    let o = obj;
    parts.slice(0, -1).forEach((p, i) => {
      if (o[p] == null || typeof o[p] !== 'object') o[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      o = o[p];
    });
    o[parts[parts.length - 1]] = value;
  }
  function getPath(obj, path) {
    return path.split('.').reduce((o, p) => (o == null ? undefined : o[p]), obj);
  }
  function readField(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.num != null) { const n = num(el.value); return n == null ? '' : n; }
    return el.value;
  }

  const fid = k => 'if-' + k.replace(/\./g, '-');
  const F = {
    text: (label, k, o = {}) => `<div class="f${o.cls ? ' ' + o.cls : ''}"><label for="${fid(k)}">${esc(label)}${o.opt ? ' <span class="opt">(optional)</span>' : ''}</label>
      <input class="in" id="${fid(k)}" data-k="${k}" value="${esc(getPath(IV.cur, k) ?? '')}" type="${o.type || 'text'}"${o.mode ? ` inputmode="${o.mode}"` : ''}${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.cap ? ` autocapitalize="${o.cap}"` : ''}${o.auto ? ` autocomplete="${o.auto}"` : ''}></div>`,
    money: (label, k, o = {}) => `<div class="f${o.cls ? ' ' + o.cls : ''}"><label for="${fid(k)}">${esc(label)}</label>
      <div class="money"><input class="in" id="${fid(k)}" data-k="${k}" data-num value="${esc(getPath(IV.cur, k) ?? '')}" inputmode="decimal" placeholder="${esc(o.ph || '0')}"></div></div>`,
    date: (label, k, o = {}) => `<div class="f${o.cls ? ' ' + o.cls : ''}"><label for="${fid(k)}">${esc(label)}</label>
      <input class="in" type="date" id="${fid(k)}" data-k="${k}" value="${esc(getPath(IV.cur, k) || '')}"></div>`
  };

  /* ---- The builder ------------------------------------------------------ */
  function renderInvoiceForm() {
    const inv = IV.cur, s = IV.settings || INV.DEFAULT_SETTINGS;
    if (!inv) return;
    const k = INV.KINDS[inv.kind];
    const purchase = inv.kind === 'purchase', general = inv.kind === 'general';
    const v = inv.vehicle || {};
    const carLine = [v.year, v.make, v.model].filter(Boolean).join(' ');
    const enquirers = inv.car_id ? state.enquiries.filter(e => String(e.car_id) === String(inv.car_id) && (e.name || e.phone || e.email)) : [];
    const sellers = s.sellers || [];
    const sellerIdx = sellers.findIndex(x => x.name === (inv.seller || {}).name && x.phone === (inv.seller || {}).phone);

    $('#invForm').innerHTML = `
      ${state.schema.v10 === false ? `<div class="msg msg--warn is-shown">Invoices aren’t being kept yet. You can make, send and print this one, but it won’t be in the list afterwards until <strong>schema-v10-invoices.sql</strong> is run (Settings → Ready to switch on).</div>` : ''}
      <div class="section-card">
        <h2>What’s it for?</h2>
        <div class="chips" id="invKinds">${INV.KIND_ORDER.map(key => `<button class="chip${inv.kind === key ? ' is-on' : ''}" type="button" data-kind="${key}">${esc(INV.KINDS[key].label)}</button>`).join('')}</div>
        <p class="hint" style="margin-top:10px">${esc(k.help)}</p>
        <details class="inv-more"${inv.title || inv.subtitle ? ' open' : ''}>
          <summary>Change the heading</summary>
          <div class="f" style="margin-top:12px"><label for="if-title">Heading</label><input class="in" id="if-title" data-k="title" value="${esc(inv.title || '')}" placeholder="${esc(k.title)}"></div>
          <div class="f" style="margin-bottom:0"><label for="if-subtitle">Line under it</label><input class="in" id="if-subtitle" data-k="subtitle" value="${esc(inv.subtitle || '')}" placeholder="${esc(k.subtitle || 'Nothing')}"></div>
        </details>
      </div>

      <div class="section-card">
        <h2>${general ? 'The car <span class="opt">(if there is one)</span>' : 'The car'}</h2>
        ${carLine || v.registration ? `<div class="inv-car">
            <div><strong>${esc(carLine || 'Car')}</strong><small>${esc(v.registration ? fmtReg(v.registration) : 'No plate')}</small></div>
            <button class="btn btn--sm btn--outline" type="button" id="invPickCar">Change</button>
          </div>` : `<button class="btn btn--outline btn--block" type="button" id="invPickCar">${icon('car')} Pick one of your cars</button>`}
        <details class="inv-more"${!carLine && !v.registration ? ' open' : ''}>
          <summary>${carLine || v.registration ? 'Edit the details' : 'Or type them in'}</summary>
          <div class="row-2" style="margin-top:12px">
            ${F.text('Registration', 'vehicle.registration', { cap: 'characters', ph: 'AB12 CDE' })}
            ${F.text('Year', 'vehicle.year', { mode: 'numeric' })}
          </div>
          <div class="row-2">${F.text('Make', 'vehicle.make', { cap: 'words' })}${F.text('Model', 'vehicle.model', { cap: 'words' })}</div>
          <div class="row-2">${F.text('Trim', 'vehicle.variant', { opt: true })}${F.text('Mileage', 'vehicle.mileage', { mode: 'numeric', opt: true })}</div>
          <div class="row-2">${F.text('Colour', 'vehicle.colour', { opt: true, cap: 'words' })}${F.text('VIN', 'vehicle.vin', { opt: true, cap: 'characters' })}</div>
        </details>
        ${general || purchase ? '' : `<div class="f" style="margin:16px 0 0"><label for="if-disclosed">Told them before buying <span class="opt">(optional)</span></label>
          <textarea class="ta inv-ta" id="if-disclosed" data-k="disclosed" rows="2" placeholder="e.g. Cat N, repaired. Small dent on the rear door.">${esc(inv.disclosed || '')}</textarea>
          <p class="hint" style="margin-top:6px">Its Cat status, damage and any faults you pointed out. It prints as a term, so none of it can be a reason to reject the car later.</p></div>`}
      </div>

      <div class="section-card">
        <h2>${purchase ? 'Who you bought it from' : general ? 'The customer' : 'The buyer'}</h2>
        ${enquirers.length ? `<div class="chips" style="margin-bottom:14px">${enquirers.slice(0, 4).map((e, i) => `<button class="chip" type="button" data-enq="${i}">Use ${esc(e.name || e.phone || e.email)}’s details</button>`).join('')}</div>` : ''}
        ${F.text('Name', 'customer.name', { cap: 'words', auto: 'off' })}
        <div class="row-2">${F.text('Phone', 'customer.phone', { type: 'tel', mode: 'tel', auto: 'off' })}${F.text('Email', 'customer.email', { type: 'email', mode: 'email', auto: 'off', cap: 'off' })}</div>
        <div class="f" style="margin:16px 0 0"><label for="if-customer-address">Address</label>
          <textarea class="ta inv-ta" id="if-customer-address" data-k="customer.address" rows="2" placeholder="House, street, town, postcode">${esc(inv.customer.address || '')}</textarea></div>
      </div>

      ${general || purchase ? '' : deliveryCard(inv)}

      <div class="section-card money-card">
        <h2>The money</h2>
        ${general ? '' : F.money(purchase ? 'What you’re paying them' : 'Agreed price', 'price')}
        <div class="lbl inv-lbl">${general ? 'What it’s for' : 'Extras and discounts'}</div>
        <div id="invLines">${(inv.extras || []).map((x, i) => `
          <div class="inv-line" data-i="${i}">
            <input class="in" data-k="extras.${i}.label" aria-label="What it’s for" value="${esc(x.label || '')}" placeholder="${general ? 'e.g. MOT' : 'e.g. Warranty'}" autocapitalize="sentences">
            <button class="inv-sign${x.minus ? ' is-minus' : ''}" type="button" data-sign-line="${i}" aria-label="${x.minus ? 'Takes off the total. Tap to add instead' : 'Adds to the total. Tap to take off instead'}">${x.minus ? '−' : '+'}</button>
            <div class="money${x.minus ? ' money--minus' : ''}"><input class="in" data-k="extras.${i}.amount" aria-label="Amount" data-num value="${esc(x.amount ?? '')}" inputmode="decimal" placeholder="0"></div>
            <button class="inv-x" type="button" data-del-line="${i}" aria-label="Remove">${icon('close')}</button>
          </div>`).join('')}</div>
        <div class="chips inv-addrow">
          <button class="chip chip--add" type="button" data-add-line="">+ Add a line</button>
          ${general ? '' : ['Warranty', 'Discount'].map(x => `<button class="chip chip--add" type="button" data-add-line="${x}">+ ${x}</button>`).join('')}
        </div>
        <p class="hint">${general ? 'Each line prints on the invoice. Tap + on a line to make it take off instead (a discount).' : 'Tap + on a line to make it take off instead (a discount): it turns to −.'}</p>

        ${general || purchase ? '' : `
        <label class="tickrow" style="margin-top:16px"><input type="checkbox" data-k="px.on" data-redraw${inv.px && inv.px.on ? ' checked' : ''}>
          <div><strong>Part exchange</strong><small>Their car comes off the price.</small></div></label>
        ${inv.px && inv.px.on ? `<div class="inv-px">
          <div class="row-2">${F.text('Their plate', 'px.registration', { cap: 'characters' })}${F.text('Make and model', 'px.make', { cap: 'words' })}</div>
          ${F.money('Allowed for it', 'px.allowance', { cls: 'f--tight' })}
        </div>` : ''}`}

        <div class="lbl inv-lbl" style="margin-top:18px">${purchase ? 'Paid to them' : 'Paid so far'}</div>
        <div id="invPays">${(inv.payments || []).map((p, i) => `
          <div class="inv-pay" data-i="${i}">
            <div class="money"><input class="in" data-k="payments.${i}.amount" aria-label="Amount paid" data-num value="${esc(p.amount ?? '')}" inputmode="decimal" placeholder="0"></div>
            <select class="sel" data-k="payments.${i}.method" aria-label="How it was paid">${PAY_METHODS.map(m => `<option${p.method === m ? ' selected' : ''}>${m}</option>`).join('')}</select>
            <input class="in" type="date" data-k="payments.${i}.date" value="${esc(p.date || '')}" aria-label="Date paid">
            <label class="inv-dep"><input type="checkbox" data-k="payments.${i}.deposit" data-redraw${p.deposit ? ' checked' : ''}> Deposit</label>
            ${p.instalment ? '<span class="pill pill--blue">Instalment</span>' : ''}
            <button class="inv-x" type="button" data-del-pay="${i}" aria-label="Remove">${icon('close')}</button>
          </div>`).join('')}</div>
        <div class="chips inv-addrow">
          <button class="chip chip--add" type="button" id="invAddPay">+ Add a payment</button>
          <button class="chip chip--add" type="button" id="invPayRest">+ The rest, paid now</button>
        </div>
        ${INV.totals(inv).deposit > 0 ? `<div class="f" style="margin-top:14px"><label>The deposit</label>
          <select class="sel" data-k="deposit_nonrefundable" data-bool data-redraw>
            <option value="1"${inv.deposit_nonrefundable !== false ? ' selected' : ''}>Non-refundable (unless the law says otherwise)</option>
            <option value="0"${inv.deposit_nonrefundable === false ? ' selected' : ''}>Refundable if they don’t go ahead</option>
          </select></div>` : ''}
        ${['deposit', 'balance', 'trade', 'purchase', 'general'].includes(inv.kind) ? `<div class="f" style="margin-top:14px"><label>Anything left to pay is due</label>
          <div class="row-2"><select class="sel" id="invDueWhen">
            <option value="collect"${!inv.balance_due_date ? ' selected' : ''}>${purchase ? 'When we collect it' : INV.deliveryOf(inv) ? 'On delivery' : 'On collection'}</option>
            <option value="date"${inv.balance_due_date ? ' selected' : ''}>By a date</option></select>
            <input class="in" type="date" data-k="balance_due_date" value="${esc(inv.balance_due_date || '')}"${inv.balance_due_date ? '' : ' hidden'} id="invDueDate"></div></div>` : ''}
        <div class="moneyline" id="invTotals"></div>
      </div>

      ${inv.kind === 'instalments' ? `<div class="section-card" id="invPlanCard">
        <h2>The instalments</h2>
        <div class="row-2">
          <div class="f"><label for="ipCount">How many payments</label><input class="in" id="ipCount" inputmode="numeric" value="${esc(inv.plan.count || '')}" placeholder="4"></div>
          <div class="f"><label for="ipAmount">Each payment</label><div class="money"><input class="in" id="ipAmount" inputmode="decimal" value="${esc(inv.plan.amount || '')}" placeholder="500"></div></div>
        </div>
        <div class="row-2">
          ${F.date('First payment', 'plan.first')}
          <div class="f"><label for="if-plan-frequency">How often</label><select class="sel" id="if-plan-frequency" data-k="plan.frequency">
            ${[['monthly', 'Monthly'], ['fortnightly', 'Fortnightly'], ['weekly', 'Weekly']].map(([val, l]) => `<option value="${val}"${(inv.plan.frequency || 'monthly') === val ? ' selected' : ''}>${l}</option>`).join('')}
          </select></div>
        </div>
        <p class="hint">Type how many payments or how much each, and the other works itself out.</p>
        <div id="invPlan"></div>
      </div>` : ''}

      <div class="section-card">
        <h2>Terms <span class="opt">· tap one to change its wording</span></h2>
        <div id="invTerms"></div>
        <div class="chips inv-addrow" style="margin-top:12px">
          <button class="chip chip--add" type="button" id="invAddTerm">+ Write your own</button>
          <button class="chip chip--add" type="button" id="invStdTerm">+ Add a standard one</button>
        </div>
      </div>

      <div class="section-card">
        <h2>Anything else to put on it</h2>
        <textarea class="ta" data-k="notes" rows="3" aria-label="Anything else to put on it" placeholder="e.g. Two keys handed over. V5C to follow by post.">${esc(inv.notes || '')}</textarea>
        <p class="hint" style="margin-top:6px">Prints under Additional notes. Leave it blank and it doesn’t appear.</p>
      </div>

      <div class="section-card">
        <h2>Dates and who sold it</h2>
        <div class="row-2">${F.date('Date on the invoice', 'issue_date')}${F.date(purchase ? 'Date bought' : general ? 'Date of the work' : 'Date of sale', 'sale_date')}</div>
        <div class="f" style="margin-top:16px"><label for="invSeller">${purchase ? 'Who bought it' : 'Who sold it'}</label>
          <select class="sel" id="invSeller">
            ${sellers.map((x, i) => `<option value="${i}"${i === sellerIdx ? ' selected' : ''}>${esc(sellerLabel(x))}</option>`).join('')}
            <option value="other"${sellerIdx < 0 ? ' selected' : ''}>Someone else</option>
          </select>
        </div>
        ${sellerIdx < 0 ? `<div class="row-2">${F.text('Name', 'seller.name', { cap: 'words' })}${F.text('Phone', 'seller.phone', { type: 'tel', mode: 'tel' })}</div>` : ''}
        ${sellers.some(x => !x.name) ? `<p class="hint">Put names to the numbers in <button class="linkish" type="button" id="invNames">Invoice details</button>.</p>` : ''}
        <label class="tickrow" style="margin-top:14px"><input type="checkbox" data-k="options.company" data-redraw${inv.options && inv.options.company ? ' checked' : ''}>
          <div><strong>Print the company number and registered office</strong>
          <small>A limited company is meant to show these on its invoices${s.company_number ? ` (no. ${esc(s.company_number)})` : ''}. Change them in Invoice details.</small></div></label>
      </div>

      <div class="section-card">
        <h2>Signatures <span class="opt">(optional)</span></h2>
        <p class="hint" style="margin:-6px 0 12px">Sign on the screen with a finger. Skip it and the PDF has lines to sign on paper.</p>
        <div class="inv-sigbtns">${['buyer', 'seller'].map(who => {
          const sg = (inv.signatures || {})[who];
          const label = who === 'buyer' ? (purchase ? 'Seller (them)' : general ? 'Customer' : 'Buyer') : (purchase ? 'MBU' : 'Seller (MBU)');
          return sg && sg.png
            ? `<div class="inv-signed"><img src="${esc(sg.png)}" alt="Signature"><span>${esc(label)} · signed ${esc(INV.ukDate(sg.date))}</span><button class="btn btn--sm btn--ghost" type="button" data-unsign="${who}">Clear</button></div>`
            : `<button class="btn btn--outline" type="button" data-sign="${who}">${icon('sign')} ${esc(label)} signs</button>`;
        }).join('')}</div>
      </div>

      ${inv.id ? `<button class="btn btn--ghost btn--block" type="button" id="invMoreActs" style="margin-top:14px">More: copy, void${inv.status === 'draft' ? ', delete' : ''}</button>` : ''}`;

    refreshInvoiceLive();
    wireInvoiceForm(enquirers);
  }

  /* Delivery: where, when, what it costs (blank = free). The charge is part
     of the total like any line, so the payments and the balance include it.
     Once it's there, Mark as delivered records it and sends them the
     updated invoice. */
  function deliveryCard(inv) {
    const d = inv.delivery || {};
    const theirs = String((inv.customer && inv.customer.address) || '').replace(/\s*\n\s*/g, ', ');
    const doneWhen = [INV.ukDate(d.done_date || d.date), d.done_time].filter(Boolean).join(', ');
    return `<div class="section-card" id="invDelivery">
      <h2>Delivery</h2>
      <label class="tickrow"><input type="checkbox" data-k="delivery.on" data-redraw${d.on ? ' checked' : ''}>
        <div><strong>We’re delivering it</strong><small>Where and when go on the invoice. Once it’s there, Mark as delivered sends them an updated one saying so.</small></div></label>
      ${d.on ? `<div class="inv-px inv-deliv">
        ${d.done ? `<div class="inv-delivered">${icon('checkCirc')}
            <div><strong>Delivered ${esc(doneWhen)}</strong><small>${d.received_by ? 'Received by ' + esc(d.received_by) : 'The invoice says delivery completed'}</small></div>
            <button class="btn btn--sm btn--outline" type="button" id="invRedeliver">Change</button>
          </div>` : ''}
        <div class="row-2">${F.date(d.done ? 'It was booked for' : 'Delivery date', 'delivery.date')}${F.text('Time', 'delivery.time', { opt: true, ph: 'e.g. Morning' })}</div>
        ${F.money('Delivery charge', 'delivery.charge', { ph: 'Free' })}
        <div class="f"><label for="if-delivery-address">Deliver to</label>
          <textarea class="ta inv-ta" id="if-delivery-address" data-k="delivery.address" rows="2" placeholder="${esc(theirs ? 'Their address: ' + theirs : 'House, street, town, postcode')}">${esc(d.address || '')}</textarea></div>
        <p class="hint" style="margin:-4px 0 14px">Leave the address blank to use theirs, and the charge blank for free delivery.</p>
        ${inv.kind === 'trade' ? '' : `<label class="tickrow" style="margin-bottom:14px"><input type="checkbox" data-k="delivery.distance" data-redraw${d.distance ? ' checked' : ''}>
          <div><strong>They bought it without coming to see it</strong><small>By phone, WhatsApp or online. The law gives them 14 days from delivery to cancel. This puts the rules on the invoice, so they pay to send it back and it can’t stretch to a year.</small></div></label>`}
        ${d.done ? `<button class="btn btn--ghost btn--block" type="button" id="invUndeliver" style="margin-bottom:14px">It hasn’t been delivered yet</button>`
          : `<button class="btn btn--outline btn--block" type="button" id="invDeliver" style="margin-bottom:14px">${icon('check')} Mark as delivered</button>`}
      </div>` : ''}
    </div>`;
  }

  // The parts that follow the figures: totals, the schedule, the terms
  function refreshInvoiceLive(skipPlan) {
    const inv = IV.cur, t = INV.totals(inv);
    const purchase = inv.kind === 'purchase';
    const line = (label, value, cls) => `<div class="ml ${cls || ''}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
    const box = $('#invTotals');
    if (box) box.innerHTML =
      (t.delivery ? line('Delivery', INV.gbp(t.delivery)) : '') +
      (t.extras.length || t.px || t.delivery ? line('Total', INV.gbp(t.goods)) : '') +
      (t.px ? line('Part exchange', INV.gbp(-t.px)) : '') +
      line(purchase ? 'To pay them' : 'To pay', INV.gbp(t.due)) +
      line(purchase ? 'Paid to them' : 'Paid', INV.gbp(t.paid)) +
      line(t.balance < -0.004 ? 'Paid too much' : 'Left to pay', t.balance > 0.004 ? INV.gbp(t.balance) : t.balance < -0.004 ? INV.gbp(-t.balance) : 'Nothing, paid in full',
        'ml--total ' + (t.balance < -0.004 ? 'ml--bad' : t.balance > 0.004 ? '' : 'ml--good'));

    if (!skipPlan && $('#invPlan')) renderPlan();
    renderTerms();
  }

  function renderPlan() {
    const inv = IV.cur;
    const rows = INV.planRows(inv);
    const warn = INV.warnings(inv, IV.settings).filter(w => w.field === 'plan');
    // Show the other half of count / amount as it works out
    const cnt = $('#ipCount'), amt = $('#ipAmount');
    if (cnt && document.activeElement !== cnt && rows.length && !inv.plan.count) cnt.placeholder = String(rows.length);
    if (amt && document.activeElement !== amt && rows.length && !inv.plan.amount) amt.placeholder = String(rows[0].amount);
    const edited = !!inv.plan.edited;
    $('#invPlan').innerHTML = `
      <div id="invPlanWarn">${planWarnings(warn)}</div>
      ${rows.length ? `<table class="inv-sched"><thead><tr><th>#</th><th>Due</th><th>Amount</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr${r.paid_on ? ' class="is-paid"' : ''}><td>${i + 1}</td>
          <td>${edited ? `<input class="in in--sm" type="date" data-row="${i}" data-f="due" value="${esc(r.due)}">` : esc(INV.ukDate(r.due))}</td>
          <td>${edited ? `<input class="in in--sm" data-row="${i}" data-f="amount" inputmode="decimal" value="${esc(r.amount)}">` : esc(INV.gbp(r.amount))}${r.paid_on ? ` <span class="pill pill--green">Paid</span>` : ''}</td></tr>`).join('')}
        </tbody></table>
        <button class="btn btn--ghost btn--sm" type="button" id="ipEdit">${edited ? 'Work them out again' : 'Change a date or amount'}</button>` : ''}`;
    $$('#invPlan [data-row]').forEach(el => el.oninput = () => {
      const r = inv.plan.rows[+el.dataset.row];
      r[el.dataset.f] = el.dataset.f === 'amount' ? (num(el.value) || 0) : el.value;
      state.dirty = true;
      refreshInvoiceLive(true);
      // The rows being typed in stay put; only the warnings above them redraw
      $('#invPlanWarn').innerHTML = planWarnings(INV.warnings(inv, IV.settings).filter(w => w.field === 'plan'));
    });
    const ed = $('#ipEdit');
    if (ed) ed.onclick = () => {
      if (inv.plan.edited) { inv.plan.edited = false; delete inv.plan.rows; }
      else { inv.plan.rows = INV.planRows(inv).map(r => ({ due: r.due, amount: r.amount })); inv.plan.edited = true; }
      state.dirty = true;
      renderPlan(); renderTerms();
    };
  }

  const planWarnings = warn => warn.map(w => `<div class="msg msg--${w.level === 'red' ? 'err' : 'warn'} is-shown" style="margin-top:12px">${w.fca ? '<strong>Check this one.</strong> ' : ''}${esc(w.text)}</div>`).join('');

  function renderTerms() {
    const box = $('#invTerms');
    if (!box) return;
    const list = INV.termList(IV.cur, IV.settings).filter(x => x.shown);
    box.innerHTML = list.map(x => `
      <div class="inv-term${x.on ? '' : ' is-off'}">
        <input type="checkbox" data-term-on="${esc(x.key)}"${x.on ? ' checked' : ''} aria-label="Include ${esc(x.label)}">
        <button class="inv-term-body" type="button" data-term-edit="${esc(x.key)}">
          <strong>${esc(x.head)}</strong> ${esc(x.text)}
          ${x.edited && !x.custom ? '<em class="pill pill--amber">Reworded</em>' : ''}${x.custom ? '<em class="pill pill--blue">Your own</em>' : ''}
        </button>
      </div>`).join('') || '<p class="hint">No terms. Add one below if you want any.</p>';
    box.querySelectorAll('[data-term-on]').forEach(el => el.onchange = () => {
      const key = el.dataset.termOn, inv = IV.cur;
      if (key.startsWith('custom:')) inv.custom_terms[+key.split(':')[1]].off = !el.checked;
      else { inv.terms[key] = Object.assign({}, inv.terms[key], { off: !el.checked }); if (el.checked) delete inv.terms[key].off; }
      state.dirty = true; renderTerms();
    });
    box.querySelectorAll('[data-term-edit]').forEach(el => el.onclick = () => editTerm(el.dataset.termEdit));
  }

  function editTerm(key) {
    const inv = IV.cur;
    const x = INV.termList(inv, IV.settings).find(t => t.key === key) || { head: '', text: '', custom: true };
    const isNew = key === 'new';
    const box = sheetHtml(isNew ? 'Your own term' : x.custom ? 'Your term' : 'Change this term', isNew || x.custom ? 'Prints with the others, numbered in order.'
      : 'The standard wording fills in the figures for you. Once you change it, it stays as you wrote it.', `
      <div class="f"><label>Heading</label><input class="in" id="tmHead" value="${esc(x.head)}" placeholder="e.g. Delivery."></div>
      <div class="f"><label>Wording</label><textarea class="ta" id="tmText" rows="6">${esc(x.text)}</textarea></div>
      <button class="btn btn--accent btn--block" type="button" id="tmSave">Save</button>
      ${!isNew && !x.custom && x.edited ? '<button class="btn btn--ghost btn--block" type="button" id="tmReset">Back to the standard wording</button>' : ''}
      ${!isNew && x.custom ? '<button class="btn btn--ghost btn--block" type="button" id="tmDel" style="color:var(--red-600)">Remove this term</button>' : ''}`);
    box.querySelector('#tmSave').onclick = () => {
      const head = $('#tmHead').value.trim(), text = $('#tmText').value.trim();
      if (isNew) { if (head || text) inv.custom_terms.push({ head, text }); }
      else if (x.custom) Object.assign(inv.custom_terms[+key.split(':')[1]], { head, text });
      else if (head !== x.std.head || text !== x.std.text) inv.terms[key] = Object.assign({}, inv.terms[key], { head, text });
      else { const off = inv.terms[key] && inv.terms[key].off; inv.terms[key] = off ? { off } : {}; }
      state.dirty = true; closeSheet(); renderTerms();
    };
    const rs = box.querySelector('#tmReset');
    if (rs) rs.onclick = () => { const off = inv.terms[key] && inv.terms[key].off; inv.terms[key] = off ? { off } : {}; state.dirty = true; closeSheet(); renderTerms(); };
    const dl = box.querySelector('#tmDel');
    if (dl) dl.onclick = () => { inv.custom_terms.splice(+key.split(':')[1], 1); state.dirty = true; closeSheet(); renderTerms(); };
  }

  function wireInvoiceForm(enquirers) {
    const inv = IV.cur, box = $('#invForm');
    // A payment row someone has typed in is theirs, not a starting guess
    const untouched = k => {
      const m = /^payments\.(\d+)\./.exec(k);
      if (m && inv.payments[+m[1]]) delete inv.payments[+m[1]].auto;
      // ...and a starting "paid in full" row keeps up with the figures
      if (/^(price|extras|px|delivery|payments|sale_date)/.test(k)) syncAutoPaid(inv, box);
    };
    box.oninput = e => {
      const el = e.target.closest('[data-k]');
      if (!el || el.type === 'checkbox' || el.tagName === 'SELECT') return;
      setPath(inv, el.dataset.k, readField(el));
      // The amount boxes keep the number only; a minus typed on a keyboard
      // turns the line into one that takes off, as the − switch does
      const line = /^extras\.(\d+)\.amount$/.exec(el.dataset.k);
      if (line && /[-−–]/.test(el.value) && !inv.extras[+line[1]].minus) {
        inv.extras[+line[1]].minus = true;
        const row = el.closest('.inv-line');
        row.querySelector('.money').classList.add('money--minus');
        const sw = row.querySelector('.inv-sign'); sw.classList.add('is-minus'); sw.textContent = '−';
      }
      untouched(el.dataset.k);
      state.dirty = true;
      refreshInvoiceLive(!!el.closest('#invPlan'));
    };
    box.onchange = e => {
      const el = e.target.closest('[data-k]');
      if (!el || !(el.type === 'checkbox' || el.tagName === 'SELECT')) return;
      setPath(inv, el.dataset.k, el.dataset.bool != null ? el.value === '1' : readField(el));
      untouched(el.dataset.k);
      state.dirty = true;
      if (el.dataset.redraw != null) renderInvoiceForm(); else refreshInvoiceLive();
    };
    box.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
      inv.kind = b.dataset.kind;
      seedPayments(inv);
      state.dirty = true;
      renderInvoiceForm();
    });
    $('#invPickCar').onclick = () => pickCar({ title: 'Which car?', filter: c => c.status !== 'draft',
      extra: inv.vehicle && (inv.vehicle.registration || inv.vehicle.make) ? [{ label: 'No car on this one', icon: 'close', run: () => { inv.vehicle = {}; inv.car_id = null; renderInvoiceForm(); } }] : [],
      run: car => {
        inv.car_id = car.id; inv.vehicle = vehicleFromCar(car);
        if (!inv.disclosed) inv.disclosed = disclosedFromCar(car);
        if (!inv.price) inv.price = car.status === 'sold' && car.sale_price != null ? car.sale_price : car.price;
        state.dirty = true; renderInvoiceForm();
      } });
    box.querySelectorAll('[data-enq]').forEach(b => b.onclick = () => {
      const e = enquirers[+b.dataset.enq];
      inv.customer = Object.assign({}, inv.customer, { name: e.name || inv.customer.name, phone: e.phone || inv.customer.phone, email: e.email || inv.customer.email });
      state.dirty = true; renderInvoiceForm();
    });
    box.querySelectorAll('[data-add-line]').forEach(b => b.onclick = () => {
      const label = b.dataset.addLine;
      inv.extras.push(label === 'Discount' ? { label, amount: '', minus: true } : { label, amount: '' });
      state.dirty = true; renderInvoiceForm();
      const ins = $$('#invLines .inv-line'); const last = ins[ins.length - 1];
      if (last) last.querySelector(label ? '.money input' : 'input').focus();
    });
    box.querySelectorAll('[data-del-line]').forEach(b => b.onclick = () => { inv.extras.splice(+b.dataset.delLine, 1); untouched('extras'); state.dirty = true; renderInvoiceForm(); });
    box.querySelectorAll('[data-sign-line]').forEach(b => b.onclick = () => {
      const x = inv.extras[+b.dataset.signLine];
      x.minus = !x.minus;
      untouched('extras'); state.dirty = true; renderInvoiceForm();
    });
    box.querySelectorAll('[data-del-pay]').forEach(b => b.onclick = () => { inv.payments.splice(+b.dataset.delPay, 1); syncAutoPaid(inv); state.dirty = true; renderInvoiceForm(); });
    $('#invAddPay').onclick = () => { inv.payments.push({ date: INV.today(), amount: '', method: 'Bank transfer' }); state.dirty = true; renderInvoiceForm(); };
    $('#invPayRest').onclick = () => {
      const left = INV.totals(inv).balance;
      if (!(left > 0)) return toast('Nothing left to pay');
      inv.payments.push({ date: INV.today(), amount: left, method: 'Bank transfer' }); state.dirty = true; renderInvoiceForm();
    };
    const dueWhen = $('#invDueWhen');
    if (dueWhen) dueWhen.onchange = () => {
      const d = $('#invDueDate');
      d.hidden = dueWhen.value !== 'date';
      if (dueWhen.value !== 'date') inv.balance_due_date = ''; else d.focus();
      state.dirty = true; refreshInvoiceLive();
    };
    const cnt = $('#ipCount'), amt = $('#ipAmount');
    if (cnt) cnt.oninput = e => { e.stopPropagation(); inv.plan.count = int(cnt.value) || ''; inv.plan.amount = ''; amt.value = ''; inv.plan.edited = false; state.dirty = true; refreshInvoiceLive(); };
    if (amt) amt.oninput = e => { e.stopPropagation(); inv.plan.amount = num(amt.value) || ''; inv.plan.count = ''; cnt.value = ''; inv.plan.edited = false; state.dirty = true; refreshInvoiceLive(); };
    $('#invAddTerm').onclick = () => editTerm('new');
    $('#invStdTerm').onclick = () => {
      const others = INV.otherTerms(inv);
      sheet('Add a standard term', 'From the other kinds of invoice. Its wording fills in your figures.', others.map(o => ({
        label: o.label, icon: 'plus', run: () => { inv.extra_terms.push(o.key); state.dirty = true; renderTerms();
          if (!INV.termList(inv, IV.settings).find(t => t.key === o.key).shown) toast('Added. It shows once it applies (e.g. once there’s a deposit).'); }
      })));
    };
    $('#invSeller').onchange = () => {
      const val = $('#invSeller').value, list = (IV.settings && IV.settings.sellers) || [];
      if (val === 'other') inv.seller = { name: '', phone: '' };
      else { inv.seller = { name: list[+val].name, phone: list[+val].phone }; remember(SELLER_KEY, sellerLabel(list[+val])); }
      state.dirty = true; renderInvoiceForm();
    };
    const nm = $('#invNames');
    if (nm) nm.onclick = () => invoiceSettingsSheet();
    box.querySelectorAll('[data-sign]').forEach(b => b.onclick = () => signaturePad(b.dataset.sign));
    box.querySelectorAll('[data-unsign]').forEach(b => b.onclick = () => { delete inv.signatures[b.dataset.unsign]; state.dirty = true; renderInvoiceForm(); });
    const more = $('#invMoreActs');
    if (more) more.onclick = () => invoiceActions(inv, true);
    const dv = $('#invDeliver'), rd = $('#invRedeliver'), ud = $('#invUndeliver');
    if (dv) dv.onclick = () => markDelivered(inv, true);
    if (rd) rd.onclick = () => markDelivered(inv, true);
    if (ud) ud.onclick = () => {
      ['done', 'done_date', 'done_time', 'received_by'].forEach(k => delete inv.delivery[k]);
      state.dirty = true; renderInvoiceForm();
    };
  }

  /* ---- Signing with a finger ------------------------------------------- */
  function signaturePad(who) {
    const inv = IV.cur;
    const name = who === 'buyer' ? (inv.customer.name || (inv.kind === 'purchase' ? 'the seller' : 'the buyer')) : (inv.seller.name || 'MBU');
    const box = sheetHtml(`${name} signs here`, 'With a finger, inside the box.', `
      <div class="sigpad"><canvas id="sigCanvas"></canvas><span class="sigpad-line"></span></div>
      <div class="row-2" style="margin-top:12px">
        <button class="btn btn--outline" type="button" id="sigClear">Clear</button>
        <button class="btn btn--accent" type="button" id="sigDone">Done</button>
      </div>`);
    const cv = box.querySelector('#sigCanvas');
    const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * ratio; cv.height = h * ratio;
    const ctx = cv.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0A1830';
    let drawing = false, any = false, last = null;
    const at = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.onpointerdown = e => { drawing = true; any = true; last = at(e); try { cv.setPointerCapture(e.pointerId); } catch { /* fine without */ } ctx.beginPath(); ctx.arc(last.x, last.y, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#0A1830'; ctx.fill(); e.preventDefault(); };
    cv.onpointermove = e => {
      if (!drawing) return;
      const p = at(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y);
      ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2);
      ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p; e.preventDefault();
    };
    cv.onpointerup = cv.onpointercancel = () => { drawing = false; };
    box.querySelector('#sigClear').onclick = () => { ctx.clearRect(0, 0, w, h); any = false; };
    box.querySelector('#sigDone').onclick = () => {
      if (!any) return toast('Nothing signed yet');
      inv.signatures = inv.signatures || {};
      inv.signatures[who] = { png: trimmedSignature(cv), date: INV.today() };
      state.dirty = true; closeSheet(); renderInvoiceForm();
    };
  }

  // Cut the empty space from round a signature so it sits on the line
  function trimmedSignature(cv) {
    const ctx = cv.getContext('2d');
    const { width: w, height: h } = cv;
    const px = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const pad = 8;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
    // A fixed shape (the space the PDF gives it), the signature centred in it
    const out = document.createElement('canvas');
    out.width = 960; out.height = 200;
    const cw = x1 - x0, ch = y1 - y0, scale = Math.min(out.width / cw, out.height / ch);
    out.getContext('2d').drawImage(cv, x0, y0, cw, ch, (out.width - cw * scale) / 2, (out.height - ch * scale) / 2, cw * scale, ch * scale);
    return out.toDataURL('image/png');
  }

  /* ---- Saving ------------------------------------------------------------ */
  function invoiceRow(inv) {
    const t = INV.totals(inv);
    const data = clone(inv);
    ['id', 'number', 'status', 'created_at'].forEach(k => delete data[k]);
    return {
      kind: inv.kind, status: inv.status || 'draft', issue_date: inv.issue_date || INV.today(),
      car_id: inv.car_id || null, registration: (inv.vehicle && inv.vehicle.registration ? String(inv.vehicle.registration).toUpperCase().replace(/\s+/g, '') : null),
      customer_name: (inv.customer && inv.customer.name) || null,
      total: t.due, paid: t.paid, balance: t.balance, data,
      sent_at: inv.sent && inv.sent.length ? inv.sent[inv.sent.length - 1].at : null,
      updated_at: new Date().toISOString()
    };
  }

  // One save at a time. A second tap on Save (or Check and send) while the
  // first is still on its way waits for it, instead of inserting the same
  // invoice twice under two numbers on a slow signal.
  function saveInvoice(quiet) {
    IV.saving = (IV.saving || Promise.resolve()).then(() => saveInvoiceNow(quiet), () => saveInvoiceNow(quiet));
    return IV.saving;
  }

  async function saveInvoiceNow(quiet) {
    const inv = IV.cur;
    if (state.schema.v10 === null) await checkInvoicesTable();
    if (!state.schema.v10) {
      if (!quiet) toast('Can’t keep invoices until schema v10 is run. You can still send this one.');
      return false;
    }
    const row = invoiceRow(inv);
    let res;
    if (inv.id) res = await sb.from('invoices').update(row).eq('id', inv.id).select().single();
    else res = await sb.from('invoices').insert(row).select().single();
    if (res.error) { toast('Couldn’t save: ' + res.error.message); return false; }
    const saved = res.data || {};
    const wasNew = !inv.id;
    if (wasNew) { inv.id = saved.id; inv.number = saved.number; inv.created_at = saved.created_at; }
    const listed = IV.list.findIndex(x => x.id === inv.id);
    const item = Object.assign({}, saved, row, { id: inv.id, number: inv.number });
    if (listed >= 0) IV.list[listed] = item; else IV.list.unshift(item);
    state.dirty = false;
    if (state.view === 'invoice' || state.view === 'invprev') $('#topTitle').textContent = INV.numberLabel(inv.number) || 'Invoice';
    // Now it has a number it can be copied, voided or deleted from here too
    if (wasNew && state.view === 'invoice' && IV.cur === inv) renderInvoiceForm();
    if (!quiet) { toast('Saved as ' + INV.numberLabel(inv.number), 'ok'); setTimeout(() => offerCarStatus(inv), 700); }
    return true;
  }

  /* ---- An invoice that sells a car offers to mark it sold (7 Oct 2026) ------
     The sale typed once, on the invoice. Once an invoice that sells one of
     your cars is saved or sent, and the car isn't marked sold, this offers to:
     the usual Mark as sold sheet, filled in from the invoice (the car's price,
     the sale date, the cash on top of a part exchange), so what you paid and
     the prep are checked on the way. A deposit receipt offers Reserved
     instead. Asked once per invoice and kind, on this phone. */
  const SELLS_A_CAR = ['paid', 'balance', 'instalments', 'trade'];
  function offerCarStatus(inv) {
    if (!inv || !inv.car_id || inv.status === 'void' || !INV) return;
    const car = carById(inv.car_id);
    if (!car || car.status === 'sold' || car.status === 'draft') return;
    const asked = IV.askedCar || (IV.askedCar = new Set());
    const key = (inv.id || inv.number || 'new') + ':' + inv.kind;
    if (asked.has(key)) return;

    if (SELLS_A_CAR.includes(inv.kind)) {
      asked.add(key);
      const price = Number(inv.price) > 0 ? Number(inv.price) : null;
      const pxOn = inv.px && inv.px.on && Number(inv.px.allowance) > 0;
      const pxCash = pxOn && price != null ? Math.max(0, price - Number(inv.px.allowance)) : null;
      sheet(`Mark the ${carTitle(car)} sold?`,
        `This invoice sells it${price ? ' for ' + money(price) : ''}${inv.sale_date ? ' on ' + longDate(fromKey(inv.sale_date)) : ''}${pxOn ? ', with a part exchange' : ''}. It’s still ${car.status === 'reserved' ? 'reserved' : 'for sale'} on the website.`, [
          { label: 'Yes, mark it sold', icon: 'sold', sub: 'Check what you paid and the prep on the way',
            run: () => figuresSheet(car, { markSold: true, sale: price, soldAt: inv.sale_date, pxCash, after: () => {} }) },
          { label: 'Not yet', icon: 'clock', sub: 'Mark it sold from the car later', run: () => {} }
        ]);
    } else if (inv.kind === 'deposit' && car.status === 'available') {
      asked.add(key);
      sheet(`Mark the ${carTitle(car)} reserved?`, 'A deposit’s been taken. A reserved car stays on the website with a Reserved badge, so nobody else turns up for it.', [
        { label: 'Yes, mark it reserved', icon: 'pause', run: () => setStatus(car, 'reserved') },
        { label: 'Not yet', icon: 'clock', run: () => {} }
      ]);
    }
  }

  $('#invSaveBtn').onclick = () => saveInvoice();
  $('#invPreviewBtn').onclick = () => openPreview();

  /* ---- Check and send ------------------------------------------------------ */
  async function openPreview() {
    const inv = IV.cur;
    if (!INV) return;
    // Saving first gives it its number, which goes on the PDF
    if (state.schema.v10 && (state.dirty || !inv.id)) await saveInvoice(true);
    const e = INV.emailText(inv, IV.settings);
    if (!inv.email || !inv.email.edited) inv.email = { to: (inv.customer && inv.customer.email) || '', subject: e.subject, body: e.body };
    else if (!inv.email.to) inv.email.to = (inv.customer && inv.customer.email) || '';
    IV.pdf = null;
    go('invprev', { title: INV.numberLabel(inv.number) || 'Check and send' });
    renderPreview();
    makePdf();
  }

  function renderPreview() {
    const inv = IV.cur;
    const doc = INV.buildDoc(inv, IV.settings);
    const warns = INV.warnings(inv, IV.settings);
    const canShare = !!(navigator.canShare && window.File);
    $('#invPrev').innerHTML = `
      ${warns.length ? `<div class="section-card inv-warns">
        <h2>Worth a look first</h2>
        ${warns.map(w => `<div class="inv-warn inv-warn--${w.level}">${icon('alert')}<span>${esc(w.text)}</span></div>`).join('')}
        <p class="hint" style="margin-top:8px">It’ll still send if you’re happy with it. Back to change anything.</p>
      </div>` : ''}
      <div class="inv-paper" id="invPaper" role="button" tabindex="0" aria-label="Tap to zoom in or out">${INV.toHtml(doc, '../assets/img/logo.png')}</div>
      <p class="hint" style="text-align:center;margin-top:8px">Tap the page to read it full size.</p>
      <div class="section-card" style="margin-top:14px">
        <h2>The email</h2>
        <div class="f"><label for="emTo">To</label>
          <div class="em-to"><input class="in" id="emTo" type="email" inputmode="email" autocapitalize="off" value="${esc(inv.email.to)}" placeholder="Their email address">
          <button class="btn btn--outline btn--sm" type="button" id="emCopy">Copy</button></div></div>
        <div class="f"><label for="emSubject">Subject</label><input class="in" id="emSubject" value="${esc(inv.email.subject)}"></div>
        <div class="f" style="margin-bottom:0"><label for="emBody">Message</label><textarea class="ta" id="emBody" rows="10">${esc(inv.email.body)}</textarea></div>
        <p class="hint" style="margin-top:10px">${canShare
          ? `<strong>Email it</strong> opens your phone’s share sheet with the PDF attached and this message written. Pick Gmail or Mail, then paste their address into To (it’s copied for you).${IOS ? ' Gmail on iPhone takes its subject from the first line, so the subject goes in as the first line too.' : ''}`
          : '<strong>Email it</strong> downloads the PDF and opens your email with the address and message filled in. Attach the PDF from Downloads.'}</p>
        <button class="btn btn--ghost btn--sm" type="button" id="emReset">Put the standard message back</button>
      </div>
      ${inv.sent && inv.sent.length ? `<p class="hint" style="margin:12px 4px 0">${inv.sent.slice(-3).map(x => `${x.via === 'print' ? 'Printed or saved' : 'Shared'} ${esc(ago(x.at))}${x.to ? ' · ' + esc(x.to) : ''}`).join('<br>')}</p>` : ''}`;
    fitPaper();
    $('#invPaper').onclick = () => { $('#invPaper').classList.toggle('is-zoomed'); fitPaper(); };
    ['emTo', 'emSubject', 'emBody'].forEach(id => $('#' + id).oninput = () => {
      inv.email = { to: $('#emTo').value.trim(), subject: $('#emSubject').value, body: $('#emBody').value, edited: true };
      state.dirty = true;
    });
    // Belt and braces: Email it copies the address too, but if the phone
    // doesn't allow that alongside the share sheet, this always works
    $('#emCopy').onclick = () => {
      const to = $('#emTo').value.trim();
      if (!to) return toast('No email address to copy');
      if (!navigator.clipboard) return toast('Copying isn’t allowed here: type it into To');
      navigator.clipboard.writeText(to).then(() => toast('Copied: paste it into To', 'ok'), () => toast('Couldn’t copy it: type it into To'));
    };
    $('#emReset').onclick = () => { const e = INV.emailText(inv, IV.settings); inv.email = { to: $('#emTo').value.trim(), subject: e.subject, body: e.body }; renderPreview(); };
    $('#prevSendBtn').disabled = $('#prevPrintBtn').disabled = !IV.pdf;
  }

  // The page is drawn at A4's real width and zoomed to fit the screen
  function fitPaper() {
    const box = $('#invPaper'), page = box && box.querySelector('.inv-page');
    if (!page) return;
    page.style.zoom = box.classList.contains('is-zoomed') ? '1' : String(Math.min(1, box.clientWidth / 794));
  }
  window.addEventListener('resize', () => { if (state.view === 'invprev') fitPaper(); });

  function loadScript(src, integrity) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
      s.onload = resolve; s.onerror = () => reject(new Error('Couldn’t load ' + src));
      document.head.appendChild(s);
    });
  }

  function pdfAssets() {
    if (!IV.assetsLoading) IV.assetsLoading = loadPdfAssets().catch(err => { IV.assetsLoading = null; throw err; });
    return IV.assetsLoading;
  }
  async function loadPdfAssets() {
    if (IV.assets) return IV.assets;
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript(JSPDF.src, JSPDF.sri);
    let logo = null, logoRatio = 698 / 230;
    try {
      const blob = await (await fetch('../assets/img/logo.png')).blob();
      logo = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      const img = new Image(); img.src = logo; await img.decode(); logoRatio = img.naturalWidth / img.naturalHeight;
    } catch { /* no logo: the PDF just starts with the title */ }
    IV.assets = { logo, logoRatio };
    return IV.assets;
  }

  // Made as soon as the preview opens, so tapping Email it can open the share
  // sheet at once: iPhones only allow that straight after a tap
  async function makePdf() {
    const inv = IV.cur;
    try {
      const assets = await pdfAssets();
      const pdf = INV.toPdf(INV.buildDoc(inv, IV.settings), window.jspdf.jsPDF, assets);
      IV.pdf = new File([pdf.output('blob')], INV.fileName(inv), { type: 'application/pdf' });
    } catch (err) {
      console.error(err);
      IV.pdf = null;
      toast('Couldn’t make the PDF. Check the signal and try again.');
    }
    if (state.view === 'invprev') $('#prevSendBtn').disabled = $('#prevPrintBtn').disabled = !IV.pdf;
  }

  async function recordSent(via, to) {
    const inv = IV.cur;
    inv.sent = (inv.sent || []).concat({ at: new Date().toISOString(), via, to: to || '' });
    if (inv.status === 'draft') inv.status = 'issued';
    await saveInvoice(true);
    renderPreview();
    setTimeout(() => offerCarStatus(inv), 900);
  }

  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  $('#prevSendBtn').onclick = async () => {
    const inv = IV.cur, file = IV.pdf;
    if (!file) return;
    const e = inv.email || {};
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      if (e.to && navigator.clipboard) navigator.clipboard.writeText(e.to).then(() => toast('Their address is copied: paste it into To'), () => {});
      try {
        await navigator.share({ files: [file], title: e.subject, text: shareText(e) });
        recordSent('email', e.to);
      } catch (err) {
        if (err && err.name !== 'AbortError') toast('Couldn’t open the share sheet: ' + err.message);
      }
      return;
    }
    // A laptop without sharing: the PDF to Downloads, and the email app opened
    download(file);
    const q = new URLSearchParams({ subject: e.subject || '', body: e.body || '' }).toString().replace(/\+/g, '%20');
    const a = document.createElement('a');
    a.href = `mailto:${encodeURIComponent(e.to || '')}?${q}`;
    document.body.appendChild(a); a.click(); a.remove();
    toast('PDF downloaded. Attach it to the email.', 'ok');
    recordSent('email', e.to);
  };

  $('#prevPrintBtn').onclick = async () => {
    const file = IV.pdf;
    if (!file) return;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); recordSent('print'); }
      catch (err) { if (err && err.name !== 'AbortError') toast('Couldn’t open the share sheet: ' + err.message); }
      return;
    }
    const url = URL.createObjectURL(file);
    const w = window.open(url, '_blank');
    if (!w) download(file);
    recordSent('print');
  };

  /* ---- The list ------------------------------------------------------------ */
  async function loadInvoices() {
    if (state.schema.v10 === null) await checkInvoicesTable();
    if (!state.schema.v10) { IV.loaded = true; IV.list = []; return; }
    const { data, error } = await sb.from('invoices').select('*').order('created_at', { ascending: false }).limit(1000);
    if (error) { msg('#invoicesMsg', 'Couldn’t load your invoices: ' + esc(error.message), 'err'); return; }
    IV.list = data || [];
    IV.loaded = true;
  }
  async function checkInvoicesTable() {
    try {
      const { error } = await sb.from('invoices').select('id').limit(1);
      state.schema.v10 = !(error && /does not exist|schema cache|not find the table/i.test(error.message));
    } catch { state.schema.v10 = false; }
  }

  const fromRow = r => Object.assign({}, r.data || {}, { id: r.id, number: r.number, status: r.status, created_at: r.created_at, kind: r.kind,
    car_id: r.car_id || (r.data || {}).car_id || null });
  // A delivery that's booked (or to be arranged) and not marked delivered
  const toDeliver = r => { const d = r.status !== 'void' && INV.deliveryOf(fromRow(r)); return d && !d.done ? d : null; };

  function nextDue(r) {
    if (r.kind !== 'instalments' || !(Number(r.balance) > 0)) return null;
    const left = INV.planRows(fromRow(r)).filter(x => !x.paid_on);
    return left[0] || null;
  }

  ON_SHOW.invoices = async () => {
    await invoiceSettings();
    if (!IV.loaded) { $('#invList').innerHTML = `<div class="card"><div class="skel" style="height:72px"></div></div>`.repeat(3); await loadInvoices(); }
    renderInvoices();
  };

  function renderInvoices() {
    if (!state.schema.v10) {
      msg('#invoicesMsg', `<strong>Invoices aren’t kept yet.</strong> You can make and send them now; to keep a list of every one, run
        <strong>schema-v10-invoices.sql</strong> in Supabase → SQL Editor (Settings → Ready to switch on).`, 'warn');
    } else msg('#invoicesMsg', '');
    const q = IV.q.trim().toLowerCase().replace(/\s+/g, ' ');
    const today = INV.today();
    const owed = r => r.status !== 'void' && r.kind !== 'purchase' && Number(r.balance) > 0.004;
    const owing = r => r.status !== 'void' && r.kind === 'purchase' && Number(r.balance) > 0.004;
    const draft = r => r.status === 'draft';
    const deliver = r => !!toDeliver(r);
    $('#nInvOwed').textContent = IV.list.filter(owed).length || '';
    $('#nInvDraft').textContent = IV.list.filter(draft).length || '';
    $('#nInvDeliver').textContent = IV.list.filter(deliver).length || '';
    $('#invTabDeliver').hidden = !IV.list.some(deliver) && IV.tab !== 'deliver';
    $$('#invTabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === IV.tab));
    const rows = IV.list.filter(r => IV.tab === 'owed' ? owed(r) : IV.tab === 'draft' ? draft(r) : IV.tab === 'deliver' ? deliver(r) : true).filter(r => {
      if (!q) return true;
      const d = r.data || {}, v = d.vehicle || {};
      const hay = [INV.numberLabel(r.number), r.number, r.customer_name, r.registration, v.make, v.model, (d.customer || {}).phone, (d.customer || {}).email]
        .filter(Boolean).join(' ').toLowerCase();
      return q.split(' ').every(w => hay.includes(w) || String(r.registration || '').toLowerCase().includes(w.replace(/\s/g, '')));
    });
    $('#invList').innerHTML = rows.length ? `<div class="card">${rows.map(r => {
      const d = r.data || {}, v = d.vehicle || {};
      const due = nextDue(r);
      const late = due && due.due < today;
      const dl = r.status !== 'void' && INV.deliveryOf(fromRow(r));
      const dlPill = dl && !dl.done ? `<span class="pill pill--${dl.date && dl.date < today ? 'red' : 'blue'}">${dl.date ? (dl.date < today ? 'Delivery was ' : dl.date === today ? 'Delivery today, ' : 'Delivery ') + INV.ukDate(dl.date) : 'Delivery to arrange'}</span>` : '';
      const status = r.status === 'void' ? '<span class="pill pill--grey">Void</span>'
        : owed(r) ? `<span class="pill pill--${late ? 'red' : 'amber'}">${late ? `${INV.gbp(due.amount)} overdue since ${INV.ukDate(due.due)}` : INV.gbp(r.balance) + ' to come'}</span>`
        : owing(r) ? `<span class="pill pill--blue">${INV.gbp(r.balance)} still to pay them</span>`
        : '<span class="pill pill--green">Paid</span>';
      return `<button class="inv-row${r.status === 'void' ? ' is-void' : ''}" type="button" data-id="${esc(r.id)}">
        <span class="inv-row-ic">${icon('receipt')}</span>
        <span class="inv-row-txt">
          <strong>${esc(INV.numberLabel(r.number))} · ${esc(r.customer_name || 'No name')}</strong>
          <small>${esc([[v.year, v.make, v.model].filter(Boolean).join(' '), r.registration ? fmtReg(r.registration) : ''].filter(Boolean).join(' · ') || ((d.extras || [])[0] || {}).label || '')}</small>
          <small>${esc((INV.KINDS[r.kind] || {}).short || '')} · ${esc(INV.ukDate(r.issue_date))}${draft(r) ? ' · not sent yet' : r.sent_at ? ' · sent ' + esc(ago(r.sent_at)) : ''}${due && !late ? ' · next ' + esc(INV.ukDate(due.due)) : ''}${dl && dl.done ? ' · delivered ' + esc(INV.ukDate(dl.done_date || dl.date)) : ''}</small>
          <span class="inv-row-pill">${status}${dlPill}</span>
        </span>
        <span class="inv-row-end"><b>${esc(INV.gbp(r.total))}</b></span>
      </button>`;
    }).join('')}</div>`
      : `<div class="empty">${icon('receipt')}<h3>${IV.list.length ? 'None match' : 'No invoices yet'}</h3><p>${IV.list.length ? 'Try a name, a plate or a number.' : 'Tap New invoice, or Make an invoice on any car.'}</p></div>`;
    $$('#invList .inv-row').forEach(b => b.onclick = () => {
      const r = IV.list.find(x => x.id === b.dataset.id);
      if (r) invoiceActions(fromRow(r));
    });
  }
  $$('#invTabs button').forEach(b => b.onclick = () => { IV.tab = b.dataset.tab; renderInvoices(); });
  $('#invSearch').oninput = () => { IV.q = $('#invSearch').value; renderInvoices(); };

  function invoiceActions(inv, fromForm) {
    const t = INV.totals(inv);
    const acts = [];
    if (!fromForm) {
      acts.push({ label: 'Open it', icon: 'eye', sub: 'Check it, email it or print it', run: async () => { await invoiceSettings(); IV.cur = clone(inv); state.dirty = false; openPreview(); } });
      acts.push({ label: 'Change it', icon: 'edit', run: async () => { await invoiceSettings(); openInvoice(clone(inv)); } });
    }
    const dl = INV.deliveryOf(inv);
    if (dl && !dl.done && inv.status !== 'void' && !fromForm) acts.push({ label: 'Mark as delivered', icon: 'check',
      sub: (dl.date ? `Booked for ${INV.ukDate(dl.date)}. ` : '') + 'Then send them the updated invoice', run: () => markDelivered(clone(inv)) });
    if (inv.status !== 'void' && t.balance > 0.004) acts.push({ label: 'Record a payment', icon: 'pound',
      sub: inv.kind === 'purchase' ? `${INV.gbp(t.balance)} still to pay them` : `${INV.gbp(t.balance)} still to come`, run: () => recordPayment(clone(inv)) });
    acts.push({ label: 'Make a copy', icon: 'copy', sub: 'Same terms and wording, for a new customer', run: async () => {
      const c = clone(inv);
      ['id', 'number', 'created_at'].forEach(k => delete c[k]);
      Object.assign(c, { status: 'draft', customer: {}, signatures: {}, sent: [], email: null, issue_date: INV.today(), sale_date: INV.today() });
      c.payments = (c.payments || []).filter(p => !p.instalment);
      delete c.updated_on;
      c.terms_v = INV.TERMS_V;   // a new agreement gets today's standard terms
      // Delivering this one too, for the same charge; where, when and "delivered" are theirs to fill
      c.delivery = c.delivery && c.delivery.on ? { on: true, charge: c.delivery.charge } : { on: false };
      await invoiceSettings(); openInvoice(c);
    } });
    if (inv.car_id) {
      const car = state.cars.find(c => String(c.id) === String(inv.car_id));
      if (car) acts.push({ label: 'The car: ' + carTitle(car), icon: 'car', run: () => carActions(car) });
    }
    const sentEver = inv.sent && inv.sent.length;
    if (inv.status === 'draft' && !sentEver) acts.push({ label: 'Delete it', icon: 'trash', danger: true, sub: 'Never sent, so nothing is lost',
      run: () => confirmSheet('Delete this invoice?', INV.numberLabel(inv.number) + ' was never sent.', 'Yes, delete it', () => deleteInvoice(inv), true) });
    else if (inv.status !== 'void') acts.push({ label: 'Void it', icon: 'close', danger: true, sub: 'Made in error. It stays in the list marked VOID, so the numbers stay unbroken',
      run: () => confirmSheet('Void this invoice?', 'It stays in the list, marked VOID. You can make a corrected one with Make a copy.', 'Void it', () => setInvoiceStatus(inv, 'void'), true) });
    else acts.push({ label: 'Un-void it', icon: 'check', run: () => setInvoiceStatus(inv, 'issued') });
    sheet(`${INV.numberLabel(inv.number)} · ${invTitle(inv)}`, `${(INV.KINDS[inv.kind] || {}).label || ''} · ${INV.gbp(t.due)}`, acts);
  }

  async function setInvoiceStatus(inv, status) {
    const { error } = await sb.from('invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', inv.id);
    if (error) return toast('Couldn’t change it: ' + error.message);
    const r = IV.list.find(x => x.id === inv.id); if (r) r.status = status;
    if (IV.cur && IV.cur.id === inv.id) IV.cur.status = status;
    toast(status === 'void' ? 'Voided' : 'Back in use', 'ok');
    if (state.view === 'invoices') renderInvoices(); else goBack();
  }

  async function deleteInvoice(inv) {
    const { error } = await sb.from('invoices').delete().eq('id', inv.id);
    if (error) return toast('Couldn’t delete it: ' + error.message);
    IV.list = IV.list.filter(x => x.id !== inv.id);
    toast('Deleted', 'ok');
    if (state.view === 'invoices') return renderInvoices();
    state.trail = state.trail.filter(v => v !== 'invoices');
    go('invoices', { back: true });
  }

  function recordPayment(inv) {
    const t = INV.totals(inv);
    const plan = inv.kind === 'instalments' ? INV.planRows(inv) : [];
    const nextAt = plan.findIndex(r => !r.paid_on), next = nextAt >= 0 ? plan[nextAt] : null;
    const box = sheetHtml(inv.kind === 'purchase' ? 'Record what you paid them' : 'Record a payment',
      `${INV.numberLabel(inv.number) || 'Not saved yet'} · ${invTitle(inv)} · ${INV.gbp(t.balance)} ${inv.kind === 'purchase' ? 'still to pay them' : 'still to come'}`, `
      <div class="section-card">
        <div class="f"><label>How much</label><div class="money"><input class="in" id="rpAmount" inputmode="decimal" value="${esc(next ? next.amount : t.balance)}"></div></div>
        <div class="row-2">
          <div class="f"><label>When</label><input class="in" type="date" id="rpDate" value="${INV.today()}"></div>
          <div class="f"><label>How</label><select class="sel" id="rpMethod">${PAY_METHODS.map(m => `<option>${m}</option>`).join('')}</select></div>
        </div>
        ${next ? `<p class="hint" style="margin-top:12px">Instalment ${nextAt + 1} of ${plan.length} ${next.due < INV.today() ? 'was' : 'is'} due ${esc(INV.ukDate(next.due))}. Paying it ticks it off the schedule.</p>` : ''}
      </div>
      <button class="btn btn--accent btn--block" type="button" id="rpSave">Save the payment</button>`);
    box.querySelector('#rpSave').onclick = async () => {
      const amount = num($('#rpAmount').value);
      if (!(amount > 0)) return toast('Put in how much they paid');
      if (amount > t.balance + 0.004) return toast(`That’s more than the ${INV.gbp(t.balance)} left to pay`);
      inv.payments = (inv.payments || []).concat({ date: $('#rpDate').value || INV.today(), amount, method: $('#rpMethod').value, instalment: inv.kind === 'instalments' || undefined });
      inv.updated_on = INV.today();
      const switched = settleKind(inv);
      closeSheet();
      IV.cur = inv;
      await invoiceSettings();
      if (!(await saveInvoice(true))) return;
      const left = INV.totals(inv).balance;
      toast(left > 0.004 ? `Saved. ${INV.gbp(left)} still to come.` : switched ? 'Saved. All paid: ' + settledWords[switched] : 'Saved. All paid.', 'ok');
      if (state.view === 'invoices') renderInvoices();
      sheet('Send them a receipt?', 'The same invoice, updated with this payment' + (inv.kind === 'instalments' ? ' and the schedule ticked off.' : '.'), [
        { label: 'Check and send it', icon: 'mail', run: () => { inv.email = null; openPreview(); } }
      ]);
    };
  }

  /* ---- Delivered ------------------------------------------------------------
     When the car's been dropped off: the date (and time, and who took it)
     go on the invoice as DELIVERY COMPLETED. If the rest was due on
     delivery, the payment goes in at the same time, and a deposit receipt
     that's now all paid becomes the paid in full invoice. From the list it
     saves and goes straight to Check and send with the "delivered" email. */
  function markDelivered(inv, fromForm) {
    const d = inv.delivery || {};
    const t = INV.totals(inv);
    const owed = t.balance > 0.004 && inv.kind !== 'instalments';
    const box = sheetHtml('Mark as delivered', `${INV.numberLabel(inv.number) || 'This invoice'} · ${invTitle(inv)}`, `
      <div class="section-card">
        <div class="row-2">
          <div class="f"><label for="mdDate">Delivered on</label><input class="in" type="date" id="mdDate" value="${esc(d.done_date || INV.today())}"></div>
          <div class="f"><label for="mdTime">Time <span class="opt">(optional)</span></label><input class="in" id="mdTime" value="${esc(d.done_time || '')}" placeholder="e.g. 2:15pm"></div>
        </div>
        <div class="f"${owed ? '' : ' style="margin-bottom:0"'}><label for="mdWho">Who took it <span class="opt">(optional)</span></label>
          <input class="in" id="mdWho" value="${esc(d.received_by || (inv.customer && inv.customer.name) || '')}" autocapitalize="words"></div>
        ${owed ? `<label class="tickrow"><input type="checkbox" id="mdPaid"${inv.balance_due_date ? '' : ' checked'}>
          <div><strong>They paid the ${esc(INV.gbp(t.balance))} left</strong><small>Records the payment, so the invoice shows it all paid. Untick if they haven’t.</small></div></label>
          <div class="f" id="mdHowF" style="margin:12px 0 0"><label for="mdHow">How they paid</label>
            <select class="sel" id="mdHow">${PAY_METHODS.map(m => `<option>${m}</option>`).join('')}</select></div>` : ''}
      </div>
      <button class="btn btn--accent btn--block" type="button" id="mdSave">${fromForm ? 'Done' : 'Save, then check and send it'}</button>`);
    const tick = box.querySelector('#mdPaid');
    if (tick) tick.onchange = () => { box.querySelector('#mdHowF').hidden = !tick.checked; };
    if (tick && !tick.checked) box.querySelector('#mdHowF').hidden = true;
    box.querySelector('#mdSave').onclick = async () => {
      const date = $('#mdDate').value || INV.today();
      inv.delivery = Object.assign({}, d, { on: true, done: true, done_date: date, done_time: $('#mdTime').value.trim(), received_by: $('#mdWho').value.trim() });
      if (tick && tick.checked) inv.payments = (inv.payments || []).concat({ date, amount: t.balance, method: $('#mdHow').value });
      inv.updated_on = INV.today();
      const switched = settleKind(inv);
      inv.email = null;   // the "it's been delivered" email, not one typed before
      closeSheet();
      const said = switched === 'paid' ? 'Delivered and all paid: ' + settledWords.paid : switched ? 'Delivered: ' + settledWords[switched] : 'Marked as delivered.';
      if (fromForm) {
        state.dirty = true; renderInvoiceForm();
        return toast(said, 'ok');
      }
      IV.cur = inv;
      await invoiceSettings();
      if (!(await saveInvoice(true))) return;
      toast(said, 'ok');
      if (state.view === 'invoices') renderInvoices();
      openPreview();
    };
  }

  /* ---- From a car, Home and Mark as sold ------------------------------------ */
  function invoicesForCar(car) {
    return IV.list.filter(r => String(r.car_id) === String(car.id) && r.status !== 'void');
  }

  function offerInvoice(car) {
    sheet('Make the invoice now?', `${carTitle(car)} is marked as sold.`, [
      { label: 'Invoice: paid in full', icon: 'receipt', sub: 'Or a deposit that was paid before', run: () => invoiceForCar(car, 'paid') },
      { label: 'Pay monthly agreement', icon: 'calendar', sub: 'They pay the rest in instalments', run: () => invoiceForCar(car, 'instalments') },
      { label: 'Balance to pay', icon: 'pound', sub: 'Part paid, the rest on collection', run: () => invoiceForCar(car, 'balance') }
    ]);
  }

  /* ====================================================== MOTs (7 Oct 2026)
     One place to see, fill in and act on MOT dates, joined up with the rest
     of the app: every MOT pill, Home alert and car menu line opens the same
     sheet (motSheet), and that sheet leads here.

       Calendar  a real month grid with a dot on each day an MOT runs out
                 (red / amber / green as everywhere), swipe or arrows for
                 the month, tap a day for its cars. Under it: run out,
                 the next 90 days, and the ones with no date.
       Dates     every car you still own on one screen, a date box each,
                 saved as you go, the ones with no date first, a GOV.UK
                 button per plate to read the date off.

     Passed its MOT: a car tested up to a month (less a day) before its MOT
     runs out keeps the same date a year on; tested any earlier, or after it
     ran out, it runs out a year less a day from the test (GOV.UK's rule).
     Sold cars aren't listed: their MOT is the buyer's (3 Oct, Talha). */
  ON_SHOW.motcal = () => renderMotCal();
  const heldCars = () => state.cars.filter(c => ['available', 'reserved', 'draft'].includes(c.status));
  const motDate = c => c.mot_expiry ? new Date(String(c.mot_expiry).slice(0, 10) + 'T00:00:00') : null;
  const longDate = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const motDot = c => motDays(c) == null ? 'grey' : motLevel(c) || 'green';

  /**
   * When the MOT runs out after a pass on `tested`.
   * @param {string} tested     the test date, YYYY-MM-DD
   * @param {string|null} oldExpiry  the date it was due to run out, if known
   * @returns {string} YYYY-MM-DD
   */
  function motAfterPass(tested, oldExpiry) {
    const t = fromKey(tested);
    // The same day in another month, or that month's last day if it's shorter (31 Mar → 28 Feb)
    const sameDay = (y, m, d) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
    if (oldExpiry) {
      const old = fromKey(oldExpiry);
      const monthBefore = sameDay(old.getFullYear(), old.getMonth() - 1, old.getDate());
      const earliest = addDays(monthBefore, 1);                         // a month less a day before: 15 May → 16 Apr
      if (t >= earliest && t <= old) return dayKey(sameDay(old.getFullYear() + 1, old.getMonth(), old.getDate()));
    }
    return dayKey(new Date(t.getFullYear() + 1, t.getMonth(), t.getDate() - 1));
  }

  /** Save a car's MOT date (or clear it), and redraw whatever shows it. */
  async function saveMot(car, ymd) {
    const value = ymd || null;
    const { error } = await sb.from('cars').update({ mot_expiry: value, updated_at: new Date().toISOString() }).eq('id', car.id);
    if (error) { toast('Couldn’t save: ' + error.message); return false; }
    car.mot_expiry = value;
    renderStock();
    if (state.view === 'motcal') renderMotCal();
    if (state.view === 'motcheck') renderMotCheck();
    return true;
  }

  /** Everything about one car's MOT: change the date, passed, GOV.UK, the calendar. */
  function motSheet(car) {
    const when = car.mot_expiry ? longDate(motDate(car)) : '';
    const box = sheetHtml(carTitle(car), [car.registration ? fmtReg(car.registration) : '', car.mot_expiry ? motWords(car) : 'No MOT date yet'].filter(Boolean).join(' · '), `
      <div class="mot-sheet">
        <label class="lbl" for="msDate">${car.mot_expiry ? 'MOT runs out' : 'When does the MOT run out?'}</label>
        <div class="mot-sheet-row">
          <input class="in" id="msDate" type="date" value="${esc(car.mot_expiry ? String(car.mot_expiry).slice(0, 10) : '')}">
          <button class="btn btn--primary" type="button" id="msSave">Save</button>
        </div>
        ${car.registration ? `<button class="sheet-action" type="button" id="msGov">${icon('open')}<div><span>Look it up on GOV.UK</span><small>Its MOT history shows the date it runs out</small></div></button>` : ''}
        <button class="sheet-action" type="button" id="msPass">${icon('checkCirc')}<div><span>It’s passed its MOT</span><small>${when ? `Works out the new date from the test (now ${esc(when)})` : 'Works out the new date from the test'}</small></div></button>
        <button class="sheet-action" type="button" id="msCal">${icon('calendar')}<div><span>See every MOT</span><small>The calendar, and every car’s date on one screen</small></div></button>
        <button class="sheet-action" type="button" id="msCar">${icon('car')}<div><span>The rest of this car</span></div></button>
      </div>`);
    box.querySelector('#msSave').onclick = async () => {
      const v = box.querySelector('#msDate').value;
      if (await saveMot(car, v)) { closeSheet(); toast(v ? 'MOT date saved' : 'MOT date cleared', 'ok'); }
    };
    const gov = box.querySelector('#msGov');
    if (gov) gov.onclick = () => window.open(govMot(cleanPlate(car.registration)), '_blank', 'noopener');
    box.querySelector('#msPass').onclick = () => { closeSheet(); setTimeout(() => passedSheet(car), 180); };
    box.querySelector('#msCal').onclick = () => { closeSheet(); state.motMonth = car.mot_expiry ? String(car.mot_expiry).slice(0, 7) : null; setTimeout(() => go('motcal'), 180); };
    box.querySelector('#msCar').onclick = () => { closeSheet(); setTimeout(() => carActions(car), 180); };
  }

  /** "It's passed": the test date in, the new run-out date worked out and shown before saving. */
  function passedSheet(car) {
    const today = dayKey(new Date());
    const old = car.mot_expiry ? String(car.mot_expiry).slice(0, 10) : null;
    const box = sheetHtml('Passed its MOT', carTitle(car) + (car.registration ? ' · ' + fmtReg(car.registration) : ''), `
      <div class="mot-sheet">
        <label class="lbl" for="psTest">Tested on</label>
        <input class="in" id="psTest" type="date" value="${today}" max="${today}">
        <p class="mot-new" id="psNew"></p>
        <button class="btn btn--accent btn--block" type="button" id="psSave">Save the new date</button>
        <p class="note">Tested up to a month before it ran out, it keeps the same date a year on. Any earlier, or after it ran out, it runs out a year (less a day) from the test. Check it against the certificate or GOV.UK.</p>
      </div>`);
    const input = box.querySelector('#psTest');
    const show = () => {
      if (!input.value) { box.querySelector('#psNew').textContent = 'Pick the day it was tested.'; return null; }
      const next = motAfterPass(input.value, old);
      const kept = old && next.slice(5) === old.slice(5);
      box.querySelector('#psNew').innerHTML = `New MOT runs out <b>${esc(longDate(fromKey(next)))}</b>${kept ? '<small>Same date as before, a year on</small>' : ''}`;
      return next;
    };
    input.oninput = show;
    show();
    box.querySelector('#psSave').onclick = async () => {
      const next = show();
      if (!next) return;
      if (await saveMot(car, next)) { closeSheet(); toast('New MOT date saved: ' + longDate(fromKey(next)), 'ok'); }
    };
  }

  /* ---- The MOTs screen ------------------------------------------------------ */
  const MOT_TABS = { cal: 'Calendar', dates: 'All dates' };

  function renderMotCal() {
    const tab = MOT_TABS[state.motTab] ? state.motTab : 'cal';
    const held = heldCars();
    const none = held.filter(c => !c.mot_expiry).length;
    $('#motcalBody').innerHTML = `
      <div class="segment segment--sm" id="motTabs">
        ${Object.entries(MOT_TABS).map(([k, l]) => `<button type="button" data-k="${k}" class="${k === tab ? 'is-on' : ''}">${l}${k === 'dates' && none ? ` <span class="seg-n">${none} to fill in</span>` : ''}</button>`).join('')}
      </div>
      ${!held.length ? `<div class="empty">${icon('calendar')}<h3>No cars in stock</h3><p>Their MOT dates show here once they’re in.</p></div>`
        : tab === 'dates' ? motDatesHtml(held) : motCalHtml(held)}
      ${tab === 'cal' ? motFeedCard() : ''}
      <button class="btn btn--ghost btn--block" type="button" id="mcChecker" style="margin-top:12px">Check any plate on GOV.UK ${icon('right')}</button>
      <p class="note" style="margin:10px 4px 0">Red: under ${MOT_RED_DAYS} days or run out. Amber: under ${MOT_AMBER_DAYS} days. Sold cars aren’t listed: their MOT is the buyer’s.</p>`;
    wireMotCal();
  }

  function motCalHtml(held) {
    const now = new Date();
    const key = /^\d{4}-\d{2}$/.test(state.motMonth || '') ? state.motMonth : dayKey(now).slice(0, 7);
    const [y, m] = key.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const lead = (first.getDay() + 6) % 7;                         // Monday first
    const daysInMonth = new Date(y, m, 0).getDate();
    const byDay = {};
    held.filter(c => c.mot_expiry && String(c.mot_expiry).slice(0, 7) === key)
      .forEach(c => { const d = +String(c.mot_expiry).slice(8, 10); (byDay[d] = byDay[d] || []).push(c); });
    const todayKey = dayKey(now);
    const pick = state.motDay && state.motDay.slice(0, 7) === key ? state.motDay : null;

    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="mc-cell mc-cell--blank"></span>');
    for (let d = 1; d <= daysInMonth; d++) {
      const k = key + '-' + pad2(d);
      const cars = byDay[d] || [];
      cells.push(`<button type="button" class="mc-cell${k === todayKey ? ' is-today' : ''}${k === pick ? ' is-picked' : ''}${cars.length ? ' has-mot' : ''}" data-day="${k}"
          aria-label="${esc(longDate(fromKey(k)) + (cars.length ? ': ' + cars.map(carTitle).join(', ') : ''))}">
        <span>${d}</span>${cars.length ? `<i class="mc-dots">${cars.slice(0, 3).map(c => `<b class="dot dot--${motDot(c)}"></b>`).join('')}</i>` : ''}
        ${cars.length > 1 ? `<small>${cars.length}</small>` : ''}
      </button>`);
    }

    const row = c => {
      const d = motDays(c);
      return `<button class="mot-row" type="button" data-mot="${esc(c.id)}">
        <i class="dot dot--${motDot(c)}"></i>
        <span class="mot-row-txt"><strong>${esc(carTitle(c))}</strong>
          <small>${esc([c.registration ? fmtReg(c.registration) : '', c.status === 'draft' ? 'Draft' : c.status === 'reserved' ? 'Reserved' : ''].filter(Boolean).join(' · '))}</small></span>
        <span class="mot-row-end"><b>${d == null ? '' : esc(motDate(c).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))}</b>
          <small>${esc(d == null ? 'Add the date' : d < 0 ? `${plural(-d, 'day')} ago` : d === 0 ? 'Today' : `in ${plural(d, 'day')}`)}</small></span>
      </button>`;
    };
    const dated = held.filter(c => motDays(c) != null).sort((a, b) => motDays(a) - motDays(b));
    const out = dated.filter(c => motDays(c) < 0);
    const soon = dated.filter(c => motDays(c) >= 0 && motDays(c) <= 90);
    const thisMonth = dated.filter(c => String(c.mot_expiry).slice(0, 7) === key);
    const none = held.filter(c => !c.mot_expiry);
    const dayCars = pick ? (byDay[+pick.slice(8, 10)] || []) : null;
    const monthName = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const list = (title, cars, empty) => cars.length || empty
      ? `<h2 class="home-h">${esc(title)}${cars.length ? ` <span class="home-n">${cars.length}</span>` : ''}</h2>
         ${cars.length ? `<div class="card">${cars.map(row).join('')}</div>` : `<p class="hint" style="margin:0 4px">${esc(empty)}</p>`}` : '';

    return `
      <div class="section-card mc">
        <div class="mc-head">
          <button type="button" class="topbar-btn mc-nav" id="mcPrev" aria-label="Month before">${icon('left')}</button>
          <h2>${esc(monthName)}</h2>
          <button type="button" class="topbar-btn mc-nav" id="mcNext" aria-label="Month after">${icon('right')}</button>
        </div>
        <div class="mc-grid mc-grid--head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div>
        <div class="mc-grid" id="mcGrid">${cells.join('')}</div>
        ${key !== todayKey.slice(0, 7) ? '<button type="button" class="linkish mc-today" id="mcToday">Back to this month</button>' : ''}
      </div>
      ${dayCars ? list(longDate(fromKey(pick)), dayCars, 'No MOTs run out that day.') : ''}
      ${!dayCars ? list('Run out', out) : ''}
      ${!dayCars ? list('Next 90 days', soon.filter(c => !out.includes(c)), out.length ? '' : 'Nothing runs out in the next 90 days.') : ''}
      ${!dayCars && key !== todayKey.slice(0, 7) ? list('In ' + first.toLocaleDateString('en-GB', { month: 'long' }), thisMonth, 'Nothing runs out this month.') : ''}
      ${!dayCars && none.length ? `<h2 class="home-h">No MOT date <span class="home-n">${none.length}</span></h2>
        <button class="card mc-fill" type="button" id="mcFill">${icon('edit')}<span><strong>Fill them in on one screen</strong><small>${esc(none.slice(0, 3).map(carTitle).join(', '))}${none.length > 3 ? ' and ' + (none.length - 3) + ' more' : ''}</small></span>${icon('right')}</button>` : ''}`;
  }

  /** Every car you own, a date box each, saved as you go. */
  function motDatesHtml(held) {
    const cars = held.slice().sort((a, b) => (!!a.mot_expiry - !!b.mot_expiry) || ((motDays(a) ?? 0) - (motDays(b) ?? 0)));
    return `<p class="note" style="margin:0 4px 12px">Change a date and it saves. Not sure of one? GOV.UK shows it from the plate.</p>
      <div class="card">${cars.map(c => `
        <div class="md-row" data-id="${esc(c.id)}">
          <i class="dot dot--${motDot(c)}"></i>
          <div class="md-txt"><strong>${esc(carTitle(c))}</strong><small>${esc([c.registration ? fmtReg(c.registration) : 'No plate', c.status === 'draft' ? 'Draft' : ''].filter(Boolean).join(' · '))}</small></div>
          <input class="in md-date" type="date" value="${esc(c.mot_expiry ? String(c.mot_expiry).slice(0, 10) : '')}" aria-label="MOT runs out, ${esc(carTitle(c))}">
          <div class="md-btns">
            ${c.registration ? `<button class="btn btn--ghost btn--sm" type="button" data-gov="${esc(c.registration)}">GOV.UK</button>` : ''}
            <button class="btn btn--ghost btn--sm" type="button" data-pass="${esc(c.id)}">Passed</button>
          </div>
          <span class="md-state" aria-live="polite"></span>
        </div>`).join('')}</div>`;
  }

  function wireMotCal() {
    const body = $('#motcalBody');
    body.querySelectorAll('#motTabs [data-k]').forEach(b => b.onclick = () => { state.motTab = b.dataset.k; renderMotCal(); });
    body.querySelectorAll('[data-mot]').forEach(b => b.onclick = () => { const c = carById(b.dataset.mot); if (c) motSheet(c); });
    const shift = n => {
      const key = /^\d{4}-\d{2}$/.test(state.motMonth || '') ? state.motMonth : dayKey(new Date()).slice(0, 7);
      const [y, m] = key.split('-').map(Number);
      const t = new Date(y, m - 1 + n, 1);
      state.motMonth = t.getFullYear() + '-' + pad2(t.getMonth() + 1);
      state.motDay = null;
      renderMotCal();
    };
    const prev = $('#mcPrev'), next = $('#mcNext');
    if (prev) prev.onclick = () => shift(-1);
    if (next) next.onclick = () => shift(1);
    const today = $('#mcToday');
    if (today) today.onclick = () => { state.motMonth = null; state.motDay = null; renderMotCal(); };
    body.querySelectorAll('[data-day]').forEach(b => b.onclick = () => {
      state.motDay = state.motDay === b.dataset.day ? null : b.dataset.day;
      renderMotCal();
    });
    // Swipe the month across
    const grid = $('#mcGrid');
    if (grid) {
      let x0 = null, y0 = null;
      grid.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      grid.addEventListener('touchend', e => {
        if (x0 == null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shift(dx < 0 ? 1 : -1);
      });
    }
    const fill = $('#mcFill');
    if (fill) fill.onclick = () => { state.motTab = 'dates'; renderMotCal(); };
    $('#mcChecker').onclick = () => go('motcheck');

    // All dates: save each one as it changes
    body.querySelectorAll('.md-row').forEach(r => {
      const car = carById(r.dataset.id);
      const input = r.querySelector('.md-date'), note = r.querySelector('.md-state');
      input.onchange = async () => {
        note.textContent = 'Saving…';
        const ok = await saveMotQuiet(car, input.value);
        note.textContent = ok ? 'Saved' : 'Not saved';
        r.querySelector('.dot').className = 'dot dot--' + motDot(car);
        setTimeout(() => { if (note.textContent === 'Saved') note.textContent = ''; }, 2500);
      };
    });
    body.querySelectorAll('[data-gov]').forEach(b => b.onclick = () => window.open(govMot(cleanPlate(b.dataset.gov)), '_blank', 'noopener'));
    body.querySelectorAll('[data-pass]').forEach(b => b.onclick = () => { const c = carById(b.dataset.pass); if (c) passedSheet(c); });
    wireMotFeed();
  }

  /** Save without redrawing the screen you're typing on. */
  async function saveMotQuiet(car, ymd) {
    const value = ymd || null;
    const { error } = await sb.from('cars').update({ mot_expiry: value, updated_at: new Date().toISOString() }).eq('id', car.id);
    if (error) { toast('Couldn’t save: ' + error.message); return false; }
    car.mot_expiry = value;
    renderStock();
    return true;
  }

  /* ---- The live calendar link -------------------------------------------------
     The phone's calendar subscribes once to a link served by the mot-calendar
     Edge Function, and fetches it again by itself every few hours, so new
     dates, passes and sales show without doing anything. The link carries a
     long random code kept in app_settings (key 'mot_feed'); without the code
     the function says nothing. "Make a new link" changes the code, so an old
     link someone else has stops working. Needs schema v10 (app_settings) and
     the function deployed (HANDOVER §9s). Until then: the download, as before. */
  const FEED_FN = () => CFG.supabase.url.replace(/\/$/, '') + '/functions/v1/mot-calendar';
  const feedUrl = token => FEED_FN() + '?t=' + encodeURIComponent(token);

  async function motFeed() {
    const out = { token: null, live: null };
    if (state.schema.v10 !== false) {
      try {
        const { data, error } = await sb.from('app_settings').select('value').eq('key', 'mot_feed').maybeSingle();
        if (!error && data && data.value) out.token = data.value.token || null;
      } catch { /* not there yet */ }
    }
    // Is the function there? It answers 401 without the code, 404 if it isn't deployed
    try {
      const r = await fetch(FEED_FN(), { method: 'GET', cache: 'no-store' });
      out.live = r.status !== 404;
    } catch { out.live = null; }
    return out;
  }

  function motFeedCard() {
    const f = need('motfeed', motFeed, 600000);
    if (f === undefined) return '<div class="section-card"><div class="skel" style="height:70px"></div></div>';
    const dated = heldCars().filter(c => c.mot_expiry);
    const ready = f && f.live && state.schema.v10 !== false;
    if (ready && f.token) {
      const url = feedUrl(f.token);
      return `<div class="section-card mot-feed">
        <div class="card-head"><h2>On your phone’s calendar</h2></div>
        <p class="cf-say">Add it once and it keeps itself up to date: new dates, passes and sold cars show by themselves, each with a reminder two weeks before.</p>
        <a class="btn btn--accent btn--block" href="${esc(url.replace(/^https:/, 'webcal:'))}" id="mfAdd">${icon('calendar')} Add to my calendar (iPhone)</a>
        <button class="btn btn--outline btn--block" type="button" id="mfCopy" style="margin-top:10px">${icon('copy')} Copy the link (Google Calendar, Outlook)</button>
        <details class="chart-table" style="margin-top:10px"><summary>How, and if it doesn’t work</summary>
          <p class="note" style="margin-top:8px"><b>iPhone:</b> tap Add, then Subscribe. If the reminders don’t show, Settings → Calendar → Accounts → Subscribed Calendars → this one → turn off “Remove Alerts”.<br><br>
          <b>Android / Google:</b> copy the link, then on a computer open calendar.google.com → Other calendars → + → From URL → paste. It appears on the phone too.<br><br>
          Calendars fetch it again every few hours, so a change can take that long to show. Anyone with the link can see the cars and dates, so only add it to your own phones.</p>
          <button class="btn btn--ghost btn--sm" type="button" id="mfNew" style="margin-top:8px">Make a new link (the old one stops working)</button>
        </details>
      </div>`;
    }
    if (ready) {
      return `<div class="section-card mot-feed">
        <div class="card-head"><h2>On your phone’s calendar</h2></div>
        <p class="cf-say">A link your phone’s calendar keeps up to date by itself: every MOT, with a reminder two weeks before.</p>
        <button class="btn btn--accent btn--block" type="button" id="mfMake">${icon('calendar')} Set up the calendar link</button>
      </div>`;
    }
    return `<div class="section-card mot-feed">
      <div class="card-head"><h2>On your phone’s calendar</h2></div>
      <p class="note" style="margin-bottom:10px">${state.schema.v10 === false
        ? 'The live calendar link needs schema-v10-invoices.sql run, and the mot-calendar function set up (gear → Ready to switch on).'
        : 'The live calendar link needs the mot-calendar function set up in Supabase (gear → Ready to switch on). Until then, download the dates: they won’t update by themselves.'}</p>
      ${dated.length ? `<button class="btn btn--outline btn--block" type="button" id="mcIcs">${icon('calendar')} Download the dates for my calendar</button>` : ''}
    </div>`;
  }

  function wireMotFeed() {
    const ics = $('#mcIcs');
    if (ics) ics.onclick = () => {
      const file = new File([motIcs(heldCars().filter(c => c.mot_expiry))], 'mbu-mot-dates.ics', { type: 'text/calendar' });
      download(file);
      toast('Open the file to add them to your calendar', 'ok');
    };
    const make = async () => {
      const a = new Uint8Array(24);
      crypto.getRandomValues(a);
      const token = Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
      const { error } = await sb.from('app_settings').upsert({ key: 'mot_feed', value: { token, made: new Date().toISOString() }, updated_at: new Date().toISOString() });
      if (error) return toast('Couldn’t set it up: ' + error.message);
      siteGot.delete('motfeed');
      renderMotCal();
      toast('Calendar link ready', 'ok');
    };
    const mk = $('#mfMake');
    if (mk) mk.onclick = make;
    const nw = $('#mfNew');
    if (nw) nw.onclick = () => confirmSheet('Make a new link?', 'Any calendar using the old link stops getting the dates. Add the new one to each phone again.', 'Make a new link', make, true);
    const cp = $('#mfCopy');
    if (cp) cp.onclick = async () => {
      const f = siteGot.get('motfeed');
      const url = f && f.data && f.data.token ? feedUrl(f.data.token) : '';
      try { await navigator.clipboard.writeText(url); toast('Link copied', 'ok'); }
      catch { prompt('Copy this link:', url); }
    };
  }

  // One all-day event per car, a reminder 14 days before. The same UID each
  // time, so adding them again updates the dates rather than doubling up.
  function motIcs(cars) {
    const esc_ = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    // Lines over 75 characters carry on on the next line after a space
    const fold = l => { let out = ''; while (l.length > 74) { out += l.slice(0, 74) + '\r\n '; l = l.slice(74); } return out + l; };
    const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MBU Car Sales//MOT dates//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:MBU MOT dates'];
    cars.forEach(c => {
      const day = new Date(String(c.mot_expiry).slice(0, 10) + 'T00:00:00');
      const next = new Date(day); next.setDate(next.getDate() + 1);
      out.push('BEGIN:VEVENT', `UID:mot-${c.id}@mbucarsales.co.uk`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
        `SUMMARY:${esc_('MOT runs out: ' + carTitle(c) + (c.registration ? ' (' + fmtReg(c.registration) + ')' : ''))}`,
        'BEGIN:VALARM', 'TRIGGER:-P14D', 'ACTION:DISPLAY', `DESCRIPTION:${esc_('MOT runs out in two weeks: ' + carTitle(c))}`, 'END:VALARM',
        'END:VEVENT');
    });
    out.push('END:VCALENDAR');
    return out.map(fold).join('\r\n') + '\r\n';
  }

  /* ======================================================= MOT CHECKER
     Any plate's full MOT history, on GOV.UK's own service: free, official,
     and needs no keys (the DVLA/MOT lookups behind the bid tool aren't
     switched on). Your own cars one tap each; the last few plates kept. */
  const MC_KEY = 'mbu_mot_checked';
  const govMot = p => 'https://www.check-mot.service.gov.uk/results?registration=' + encodeURIComponent(p) + '&checkRecalls=true';
  const cleanPlate = p => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  ON_SHOW.motcheck = () => renderMotCheck();

  function checkedPlates() { try { return JSON.parse(localStorage.getItem(MC_KEY) || '[]'); } catch { return []; } }

  function motCheck(plate) {
    const p = cleanPlate(plate);
    if (p.length < 2) { toast('Type the number plate first'); return; }
    try { localStorage.setItem(MC_KEY, JSON.stringify([p].concat(checkedPlates().filter(x => x !== p)).slice(0, 8))); } catch { /* fine */ }
    window.open(govMot(p), '_blank', 'noopener');
    renderMotCheck();
  }
  $('#mcGo').onclick = () => motCheck($('#mcReg').value);
  $('#mcReg').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); motCheck($('#mcReg').value); } };

  function renderMotCheck() {
    const recent = checkedPlates();
    const mine = state.cars.filter(c => ['available', 'reserved', 'draft'].includes(c.status) && c.registration);
    $('#mcBody').innerHTML = `
      ${recent.length ? `<div class="section-card"><h2>Checked lately</h2><div class="chips">
        ${recent.map(p => `<button class="chip" type="button" data-plate="${esc(p)}">${esc(fmtReg(p))}</button>`).join('')}</div></div>` : ''}
      ${mine.length ? `<h2 class="home-h">Your stock</h2><div class="card">${mine.map(c => `
        <div class="mot-row mot-row--split">
          <button type="button" class="mot-row-main" data-plate="${esc(c.registration)}">
            <i class="dot dot--${motDot(c)}"></i>
            <span class="mot-row-txt"><strong>${esc(carTitle(c))}</strong><small>${esc(fmtReg(c.registration))} · ${esc(motWords(c))}</small></span>
            ${icon('open')}
          </button>
          <button type="button" class="btn btn--ghost btn--sm" data-motset="${esc(c.id)}">Use the date</button>
        </div>`).join('')}</div>
      <p class="note" style="margin:8px 4px 0">Read the date off GOV.UK, then <b>Use the date</b> to put it on the car.</p>` : ''}
      <button class="btn btn--ghost btn--block" type="button" id="mcBid" style="margin-top:14px">Buying it? The full check before you bid ${icon('right')}</button>`;
    $$('#mcBody [data-plate]').forEach(b => b.onclick = () => motCheck(b.dataset.plate));
    $$('#mcBody [data-motset]').forEach(b => b.onclick = () => { const c = carById(b.dataset.motset); if (c) motSheet(c); });
    $('#mcBid').onclick = () => {
      const p = cleanPlate($('#mcReg').value);
      go('value');
      if (p && $('#vReg')) { $('#vReg').value = p; runValuation(); }
    };
  }

  /* ========================================================= PRICE BOOK
     What cars actually went for, in one place:
       · auction results you've seen (BCA and the like): trade prices
       · your own sales, straight from the cars (part exchanges left out,
         their price is a deal price)
       · what similar cars were advertised at (the bid tool's price checks)
     Auction results are typed in here and never count as an advertised
     price anywhere else (schema-v12). */
  const PB = { rows: null, tab: 'all', q: '' };
  const HOUSES = ['BCA', 'Manheim', 'Aston Barclay', 'Motorway', 'Other'];

  ON_SHOW.pricebook = async () => {
    if (PB.rows == null) {
      $('#pbList').innerHTML = `<div class="card"><div class="skel" style="height:70px"></div></div>`.repeat(3);
      const { data, error } = await sb.from('price_checks').select('*').order('created_at', { ascending: false }).limit(2000);
      PB.rows = data || [];
      PB.error = error && /does not exist|schema cache|not find the table/i.test(error.message) ? 'v3' : null;
    }
    renderPriceBook();
  };

  function priceBookEntries() {
    const out = [];
    PB.rows.forEach(r => {
      if (!r.typical) return;
      const auction = r.source === 'auction';
      const d = r.detail || {};
      out.push({ kind: auction ? 'auction' : 'advert', make: r.make, model: r.model, year: r.year, mileage: r.mileage,
        price: r.typical, low: auction ? null : r.low, high: auction ? null : r.high, when: r.created_at, row: r,
        note: auction ? [d.house, d.hpi && d.hpi !== 'clear' ? LABEL.hpi[d.hpi] : null, d.grade ? 'Grade ' + d.grade : null].filter(Boolean).join(' · ')
                      : r.source === 'own_judgement' ? 'Your own judgement' : 'Advertised' + (r.sample_size ? `, ${r.sample_size} cars` : '') });
    });
    state.cars.filter(c => c.status === 'sold' && c.sale_price != null && !c.px_sale).forEach(c => {
      out.push({ kind: 'ours', make: c.make, model: c.model, year: c.year, mileage: c.mileage, price: c.sale_price, when: c.sold_at || c.updated_at, car: c,
        note: [c.price && c.price !== c.sale_price ? `Advertised at ${money(c.price)}` : '', c.hpi_status && c.hpi_status !== 'clear' ? LABEL.hpi[c.hpi_status] : ''].filter(Boolean).join(' · ') });
    });
    return out.sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0));
  }

  function renderPriceBook() {
    if (PB.error === 'v3') { msg('#pbMsg', 'The price book isn’t set up yet: run <strong>schema-v3-price-book.sql</strong> in Supabase.', 'warn'); }
    const fold = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = fold(PB.q.trim());
    const all = priceBookEntries();
    const match = e => !q || q.split(/\s+/).every(w => fold([e.make, MK.makeName(e.make), e.model, e.year].join(' ')).includes(w)
      || (MK.knownMake(w) && keyOf(w) === keyOf(e.make)));
    const found = all.filter(match);
    const shown = found.filter(e => PB.tab === 'all' || e.kind === PB.tab);
    $$('#pbTabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === PB.tab));

    const KIND = { auction: ['Auction', 'amber'], ours: ['Our sale', 'green'], advert: ['Advertised', 'blue'] };
    const avg = xs => xs.length ? Math.round(xs.reduce((n, x) => n + x, 0) / xs.length) : null;
    const sumLine = kind => {
      const xs = found.filter(e => e.kind === kind).map(e => e.price);
      if (!xs.length) return '';
      return `<div class="pb-sum"><span class="pill pill--${KIND[kind][1]}">${KIND[kind][0]}</span>
        <b>${money(avg(xs))}</b><small>average of ${xs.length}${xs.length > 1 ? ` · ${money(Math.min(...xs))} to ${money(Math.max(...xs))}` : ''}</small></div>`;
    };
    $('#pbSummary').innerHTML = q && found.length ? `<div class="section-card pb-sums">${['auction', 'ours', 'advert'].map(sumLine).join('')}
      <p class="hint" style="margin-top:8px">Auction prices are trade prices: what you’d pay. Our sales and adverts are what they sell for.</p></div>` : '';

    $('#pbList').innerHTML = shown.length ? `<div class="card">${shown.slice(0, 200).map((e, i) => `
      <button class="pb-row" type="button" data-i="${all.indexOf(e)}">
        <span class="pb-row-txt"><strong>${esc([e.year, MK.makeName(e.make) || e.make, e.model].filter(Boolean).join(' '))}</strong>
          <small>${esc([e.mileage ? nf(e.mileage) + ' mi' : '', e.note, e.when ? new Date(e.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : ''].filter(Boolean).join(' · '))}</small></span>
        <span class="pb-row-end"><b>${e.low && e.high && e.low !== e.high ? `${money(e.low)}–${money(e.high).replace('£', '')}` : money(e.price)}</b>
          <span class="pill pill--${KIND[e.kind][1]}">${KIND[e.kind][0]}</span></span>
      </button>`).join('')}</div>`
      : `<div class="empty">${icon('book')}<h3>${all.length ? 'Nothing matches' : 'Nothing in it yet'}</h3>
          <p>${all.length ? 'Try just the make, or just the model.' : 'Add what you see cars go for at auction, and your own sales appear here by themselves.'}</p></div>`;
    $$('#pbList .pb-row').forEach(b => b.onclick = () => {
      const e = all[+b.dataset.i];
      if (e.kind === 'ours') return carActions(e.car);
      sheet([e.year, e.make, e.model].filter(Boolean).join(' '), `${money(e.price)} · ${e.note}`, [
        ...(e.kind === 'auction' ? [{ label: 'Add another like this', icon: 'plus', run: () => auctionSheet(e.row) }] : []),
        { label: 'Delete this entry', icon: 'trash', danger: true, run: () => confirmSheet('Delete this entry?', 'It comes out of the price book for good.', 'Delete it', async () => {
          const { error } = await sb.from('price_checks').delete().eq('id', e.row.id);
          if (error) return toast('Couldn’t delete it: ' + error.message);
          PB.rows = PB.rows.filter(r => r.id !== e.row.id); renderPriceBook(); toast('Deleted', 'ok');
        }, true) }
      ]);
    });
  }
  $$('#pbTabs button').forEach(b => b.onclick = () => { PB.tab = b.dataset.tab; renderPriceBook(); });
  $('#pbSearch').oninput = () => { PB.q = $('#pbSearch').value; renderPriceBook(); };
  $('#pbAdd').onclick = () => auctionSheet();

  function auctionSheet(like) {
    like = like || {};
    const d = like.detail || {};
    const box = sheetHtml('Add an auction result', 'What it went for, so the price book knows next time.', `
      <div class="section-card">
        <div class="row-2">
          <div class="f"><label for="auMake">Make</label><input class="in" id="auMake" list="auMakes" value="${esc(like.make || '')}" autocapitalize="words" placeholder="Ford"></div>
          <div class="f"><label for="auModel">Model</label><input class="in" id="auModel" list="auModels" value="${esc(like.model || '')}" autocapitalize="words" placeholder="Fiesta"></div>
        </div>
        <datalist id="auMakes">${knownMakes().map(m => `<option value="${esc(m)}">`).join('')}</datalist>
        <datalist id="auModels"></datalist>
        <div class="row-2" style="margin-top:16px">
          <div class="f"><label for="auYear">Year</label><input class="in" id="auYear" inputmode="numeric" value="${esc(like.year || '')}" placeholder="2016"></div>
          <div class="f"><label for="auMiles">Mileage</label><input class="in" id="auMiles" inputmode="numeric" placeholder="72000"></div>
        </div>
        <div class="row-2" style="margin-top:16px">
          <div class="f"><label for="auPrice">Hammer price</label><div class="money"><input class="in" id="auPrice" inputmode="decimal" placeholder="0"></div></div>
          <div class="f"><label for="auDate">Sale date</label><input class="in" type="date" id="auDate" value="${INV ? INV.today() : ''}"></div>
        </div>
        <div class="f" style="margin-top:16px"><div class="lbl">Where</div><div class="chips" id="auHouse">${HOUSES.map(h => `<button class="chip${(d.house || 'BCA') === h ? ' is-on' : ''}" type="button" data-v="${h}">${h}</button>`).join('')}</div></div>
        <div class="f"><div class="lbl">History</div><div class="chips" id="auHpi">${[['clear', 'Clear'], ['cat_n', 'Cat N'], ['cat_s', 'Cat S']].map(([v, l]) => `<button class="chip${(d.hpi || 'clear') === v ? ' is-on' : ''}" type="button" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="f" style="margin-bottom:0"><label for="auNotes">Notes <span class="opt">(optional)</span></label><input class="in" id="auNotes" placeholder="Grade 3, two keys, no service history"></div>
      </div>
      <button class="btn btn--accent btn--block" type="button" id="auSave">Save it</button>`);
    const one = sel => box.querySelectorAll(sel + ' .chip').forEach(c => c.onclick = () => { box.querySelectorAll(sel + ' .chip').forEach(x => x.classList.remove('is-on')); c.classList.add('is-on'); });
    one('#auHouse'); one('#auHpi');
    const models = () => { $('#auModels').innerHTML = knownModels($('#auMake').value).map(m => `<option value="${esc(m)}">`).join(''); };
    $('#auMake').oninput = models; models();
    $('#auSave').onclick = async () => {
      const make = canonicalMake($('#auMake').value.trim()), price = num($('#auPrice').value);
      if (!make || !(price > 0)) return toast('Put in at least the make and the hammer price');
      const model = $('#auModel').value.trim() ? canonicalModel(make, $('#auModel').value.trim()) : null;
      const date = $('#auDate').value;
      const row = { make, model, year: int($('#auYear').value), mileage: int($('#auMiles').value), typical: Math.round(price), source: 'auction',
        notes: $('#auNotes').value.trim() || null,
        detail: { house: (box.querySelector('#auHouse .is-on') || {}).dataset ? box.querySelector('#auHouse .is-on').dataset.v : null,
                  hpi: box.querySelector('#auHpi .is-on') ? box.querySelector('#auHpi .is-on').dataset.v : 'clear' },
        created_at: date ? new Date(date + 'T12:00:00').toISOString() : new Date().toISOString() };
      const { data, error } = await sb.from('price_checks').insert(row).select().single();
      if (error) {
        if (/price_checks_source_check|detail/i.test(error.message)) return toast('Auction results need schema-v12-auction-prices.sql run in Supabase → SQL Editor first');
        return toast('Couldn’t save: ' + error.message);
      }
      closeSheet();
      if (PB.rows) PB.rows.unshift(data || row);
      renderPriceBook();
      toast('Added to the price book', 'ok');
    };
  }

  /* ======================================================== PHOTO GUIDE
     Every car photographed the same way: the same shots in the same order,
     each with an outline on the camera to line the car up against, like We
     Buy Any Car's app (3 Oct 2026). The photos upload as you go and are
     saved onto the car in that order, the first one as the main photo.

     The camera is the browser's own (getUserMedia), cropped to 4:3
     landscape, which is the shape the website shows cars in. If the camera
     can't be opened (permission refused, an old phone), each shot falls
     back to the phone's normal camera, with the outline shown first.

     Shots taken are kept on this phone (localStorage) until saved to the
     car, so closing the app halfway loses nothing that had uploaded. */
  const PG_KEY = 'mbu_photo_guide';

  // The outlines, drawn on a 400 × 300 frame (4:3). A side view and a
  // three-quarter view are each drawn once and mirrored for the other side.
  const G = {
    ground: '<line x1="10" y1="246" x2="390" y2="246" stroke-dasharray="6 7"/>',
    side: `<path d="M38 216 L38 186 Q40 171 68 166 L148 158 Q170 121 202 111 L286 111 Q316 119 341 156 L362 162 Q371 170 369 190 L369 216 L336 216 A33 33 0 0 0 266 216 L141 216 A33 33 0 0 0 71 216 Z"/>
      <path d="M160 157 L203 119 L282 119 L330 155 Z"/><line x1="242" y1="119" x2="242" y2="157"/>
      <circle cx="106" cy="218" r="27"/><circle cx="301" cy="218" r="27"/>`,
    front: `<path d="M78 232 L78 172 Q83 151 108 146 L134 96 Q140 85 156 85 L244 85 Q260 85 266 96 L292 146 Q317 151 322 172 L322 232 Z"/>
      <path d="M140 141 L157 99 L243 99 L260 141 Z"/><rect x="92" y="160" width="46" height="15" rx="6"/><rect x="262" y="160" width="46" height="15" rx="6"/>
      <rect x="164" y="170" width="72" height="24" rx="5"/><rect x="84" y="232" width="34" height="16" rx="4"/><rect x="282" y="232" width="34" height="16" rx="4"/>`,
    rear: `<path d="M78 232 L78 170 Q83 150 108 146 L136 100 Q142 88 158 88 L242 88 Q258 88 264 100 L292 146 Q317 150 322 170 L322 232 Z"/>
      <path d="M146 140 L160 103 L240 103 L254 140 Z"/><rect x="88" y="158" width="52" height="18" rx="5"/><rect x="260" y="158" width="52" height="18" rx="5"/>
      <rect x="168" y="182" width="64" height="16" rx="3"/><rect x="84" y="232" width="34" height="16" rx="4"/><rect x="282" y="232" width="34" height="16" rx="4"/>`,
    corner: `<path d="M46 224 L46 180 Q50 164 78 159 L134 152 L178 112 Q186 104 200 103 L300 103 Q318 104 330 118 L352 150 Q366 156 368 172 L368 214 L342 216 A27 27 0 0 0 288 216 L160 220 A30 30 0 0 0 100 222 Z"/>
      <path d="M140 150 L180 114 L214 113 L190 150 Z"/><path d="M198 149 L222 113 L298 113 L330 149 Z"/>
      <ellipse cx="130" cy="223" rx="25" ry="28"/><ellipse cx="315" cy="217" rx="21" ry="25"/>`,
    cornerFront: '<path d="M56 170 L92 166 L96 177 L58 181 Z"/><rect x="100" y="172" width="34" height="14" rx="3"/>',
    cornerRear: '<path d="M54 166 L94 162 L96 178 L56 181 Z"/><rect x="104" y="186" width="30" height="10" rx="2"/>',
    wheel: '<circle cx="200" cy="150" r="108"/><circle cx="200" cy="150" r="74"/><circle cx="200" cy="150" r="16"/>' +
      [0, 72, 144, 216, 288].map(a => `<line x1="200" y1="150" x2="${(200 + 70 * Math.cos(a * Math.PI / 180)).toFixed(1)}" y2="${(150 + 70 * Math.sin(a * Math.PI / 180)).toFixed(1)}"/>`).join(''),
    dash: '<path d="M14 150 Q200 96 386 150"/><circle cx="128" cy="196" r="62"/><circle cx="128" cy="196" r="16"/><rect x="176" y="116" width="54" height="38" rx="5"/><path d="M14 150 L14 280 M386 150 L386 280"/><line x1="40" y1="30" x2="360" y2="30" stroke-dasharray="5 6"/>',
    seats: '<path d="M70 270 L76 120 Q78 92 106 90 L160 90 Q186 92 188 120 L184 270"/><rect x="104" y="54" width="54" height="30" rx="12"/>' +
           '<path d="M216 270 L212 120 Q214 92 240 90 L294 90 Q322 92 324 120 L330 270"/><rect x="242" y="54" width="54" height="30" rx="12"/>',
    rearSeats: '<path d="M40 250 L44 120 Q46 96 76 94 L324 94 Q354 96 356 120 L360 250 Z"/><line x1="148" y1="96" x2="146" y2="250"/><line x1="252" y1="96" x2="254" y2="250"/>' +
               '<rect x="72" y="62" width="50" height="26" rx="10"/><rect x="175" y="62" width="50" height="26" rx="10"/><rect x="278" y="62" width="50" height="26" rx="10"/>',
    boot: '<path d="M60 80 L340 80 L372 258 L28 258 Z"/><path d="M96 112 L304 112 L326 232 L74 232 Z"/>',
    cluster: '<rect x="40" y="70" width="320" height="160" rx="70"/><circle cx="130" cy="150" r="52"/><circle cx="270" cy="150" r="52"/><rect x="172" y="186" width="56" height="24" rx="4"/>',
    screen: '<rect x="70" y="60" width="260" height="170" rx="14"/><rect x="88" y="78" width="224" height="134" rx="6"/>',
    engine: '<path d="M30 70 L370 70 L340 262 L60 262 Z"/><rect x="120" y="110" width="160" height="96" rx="8"/><circle cx="90" cy="120" r="16"/><rect x="292" y="104" width="44" height="34" rx="4"/>',
    keys: '<rect x="60" y="80" width="160" height="200" rx="8"/><line x1="80" y1="120" x2="200" y2="120"/><line x1="80" y1="148" x2="200" y2="148"/>' +
          '<rect x="262" y="96" width="70" height="110" rx="26"/><path d="M297 206 L297 270 M297 236 L315 236 M297 254 L311 254"/>'
  };
  const mirror = g => `<g transform="translate(400 0) scale(-1 1)">${g}</g>`;
  const SHOTS = [
    { key: 'front-driver', group: 'Outside', title: 'Front corner, driver’s side', tip: 'The main photo. Stand off the front right corner, about four big steps away, phone at headlight height. Wheels turned slightly out looks best.', svg: () => G.ground + mirror(G.corner + G.cornerFront) },
    { key: 'front', group: 'Outside', title: 'Straight on, front', tip: 'In line with the middle of the car, at headlight height. Whole car in the outline, a little space round it.', svg: () => G.ground + G.front },
    { key: 'front-passenger', group: 'Outside', title: 'Front corner, passenger side', tip: 'Off the front left corner, same distance and height as the first one.', svg: () => G.ground + G.corner + G.cornerFront },
    { key: 'side-passenger', group: 'Outside', title: 'Passenger side', tip: 'Square on to the middle of the car, both wheels in the circles.', svg: () => G.ground + G.side },
    { key: 'rear-passenger', group: 'Outside', title: 'Rear corner, passenger side', tip: 'Off the back left corner, at light height.', svg: () => G.ground + mirror(G.corner + G.cornerRear) },
    { key: 'rear', group: 'Outside', title: 'Straight on, back', tip: 'In line with the middle, number plate level in the frame.', svg: () => G.ground + G.rear },
    { key: 'rear-driver', group: 'Outside', title: 'Rear corner, driver’s side', tip: 'Off the back right corner.', svg: () => G.ground + G.corner + G.cornerRear },
    { key: 'side-driver', group: 'Outside', title: 'Driver’s side', tip: 'Square on to the middle of the car.', svg: () => G.ground + mirror(G.side) },
    { key: 'wheel', group: 'Outside', title: 'A wheel', tip: 'The best-looking alloy, filling the circles, crouched level with the hub.', svg: () => G.wheel },
    { key: 'dash', group: 'Inside', title: 'Dashboard', tip: 'From the middle of the back seat, so the whole dash and both front seats are in.', svg: () => G.dash },
    { key: 'front-seats', group: 'Inside', title: 'Front seats', tip: 'From the open driver’s door, seat and steering wheel in.', svg: () => G.seats },
    { key: 'rear-seats', group: 'Inside', title: 'Back seats', tip: 'From an open back door, the whole bench in.', svg: () => G.rearSeats },
    { key: 'boot', group: 'Inside', title: 'Boot', tip: 'Boot open, from behind, floor and sides in.', svg: () => G.boot },
    { key: 'mileage', group: 'Inside', title: 'Mileage', tip: 'Ignition on, no warning lights, the mileage readable.', svg: () => G.cluster },
    { key: 'screen', group: 'Inside', title: 'Screen', tip: 'Sat nav or the main menu showing. Skip it if there’s no screen.', optional: true, svg: () => G.screen },
    { key: 'engine', group: 'Inside', title: 'Engine bay', tip: 'Bonnet up, from the front, the whole bay in.', svg: () => G.engine },
    { key: 'keys', group: 'Inside', title: 'Keys and book', tip: 'Both keys and the service book on the seat. Skip if not.', optional: true, svg: () => G.keys }
  ];
  const guideSvg = (shot, cls) => `<svg class="${cls || 'pg-guide'}" viewBox="0 0 400 300" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shot.svg()}</svg>`;

  const PGS = { car: null, shots: {}, at: 0, stream: null, busy: 0 };

  function pgLoad(carId) {
    try { const all = JSON.parse(localStorage.getItem(PG_KEY) || '{}'); return (all[carId] || {}).shots || {}; } catch { return {}; }
  }
  function pgSave() {
    if (!PGS.car) return;
    try {
      const all = JSON.parse(localStorage.getItem(PG_KEY) || '{}');
      const keep = {};
      Object.entries(PGS.shots).forEach(([k, s]) => { if (s.photo) keep[k] = { photo: s.photo }; });
      all[PGS.car.id] = { at: Date.now(), shots: keep };
      localStorage.setItem(PG_KEY, JSON.stringify(all));
    } catch { /* no storage: still works, just not across a restart */ }
  }
  function pgForget(carId) {
    try { const all = JSON.parse(localStorage.getItem(PG_KEY) || '{}'); delete all[carId]; localStorage.setItem(PG_KEY, JSON.stringify(all)); } catch { /* fine */ }
  }

  ON_SHOW.photos = () => renderPhotoGuide();

  function pgPickCar() {
    pickCar({ title: 'Which car are you photographing?', filter: c => c.status !== 'sold',
      run: car => { PGS.car = car; PGS.shots = pgLoad(car.id); PGS.at = 0; renderPhotoGuide(); } });
  }

  function renderPhotoGuide() {
    const car = PGS.car;
    if (!car) {
      $('#pgBody').innerHTML = `
        <div class="section-card">
          <h2>Same angles, every car</h2>
          <p style="font-size:15.5px;line-height:1.55;color:var(--ink-2)">${SHOTS.length} shots in the same order every time, with an outline on the camera
          for each one to line the car up against. They upload as you go and save onto the car in order, the first one as its main photo.</p>
          <button class="btn btn--accent btn--block" type="button" id="pgPick" style="margin-top:16px">${icon('car')} Pick the car</button>
          <p class="hint" style="margin-top:12px">Add it with Quick add first if it isn’t in yet. Hold the phone sideways for every shot.</p>
        </div>
        <div class="pg-grid pg-grid--preview">${SHOTS.map(s => `<div class="pg-tile">${guideSvg(s)}<span>${esc(s.title)}</span></div>`).join('')}</div>`;
      $('#pgPick').onclick = pgPickCar;
      return;
    }
    const done = SHOTS.filter(s => PGS.shots[s.key] && PGS.shots[s.key].photo).length;
    const busy = SHOTS.filter(s => PGS.shots[s.key] && PGS.shots[s.key].uploading).length;
    const failed = SHOTS.filter(s => PGS.shots[s.key] && PGS.shots[s.key].error).length;
    const next = SHOTS.findIndex(s => !(PGS.shots[s.key] && (PGS.shots[s.key].photo || PGS.shots[s.key].uploading || PGS.shots[s.key].skipped)));
    $('#pgBody').innerHTML = `
      <div class="section-card">
        <div class="inv-car">
          <div><strong>${esc(carTitle(car))}</strong><small>${esc([car.registration ? fmtReg(car.registration) : '', (car.images || []).length ? `${car.images.length} photos on it now` : 'No photos yet'].filter(Boolean).join(' · '))}</small></div>
          <button class="btn btn--sm btn--outline" type="button" id="pgChange">Change</button>
        </div>
        <button class="btn btn--accent btn--block" type="button" id="pgStart" style="margin-top:16px">${icon('camera')} ${done ? (next < 0 ? 'Retake any of them' : `Carry on: ${SHOTS[next].title}`) : 'Start the camera'}</button>
        <p class="hint" style="margin-top:10px">${done} of ${SHOTS.length} taken${busy ? ` · ${busy} uploading` : ''}${failed ? ` · ${failed} didn’t upload, tap to retry` : ''}. Tap any shot to take or retake it.</p>
      </div>
      ${['Outside', 'Inside'].map(group => `<h2 class="home-h">${group}</h2>
        <div class="pg-grid">${SHOTS.map((s, i) => s.group !== group ? '' : (() => {
          const st = PGS.shots[s.key] || {};
          const pic = st.local || (st.photo ? imgUrl(st.photo, 300) : '');
          return `<button class="pg-tile${pic ? ' has-photo' : ''}${st.skipped ? ' is-skipped' : ''}" type="button" data-i="${i}">
            ${pic ? `<img src="${esc(pic)}" alt="">` : guideSvg(s)}
            <span>${esc(s.title)}</span>
            ${st.uploading ? '<em class="pg-state">Uploading</em>' : st.error ? '<em class="pg-state pg-state--err">Retry</em>' : st.photo ? `<em class="pg-state pg-state--ok">${icon('check')}</em>` : st.skipped ? '<em class="pg-state">Skipped</em>' : ''}
          </button>`;
        })()).join('')}</div>`).join('')}
      ${done || busy ? `<div class="pg-save">
        <button class="btn btn--green btn--block" type="button" id="pgSaveBtn"${done && !busy ? '' : ' disabled'}>${icon('check')} Save ${done || ''} photo${done === 1 ? '' : 's'} to the car</button>
        ${busy ? '<p class="hint" style="text-align:center;margin-top:8px">Waiting for the uploads to finish…</p>' : ''}
      </div>` : ''}`;
    $('#pgChange').onclick = pgPickCar;
    $('#pgStart').onclick = () => openCamera(next < 0 ? 0 : next);
    $$('#pgBody .pg-tile[data-i]').forEach(b => b.onclick = () => {
      const s = SHOTS[+b.dataset.i], st = PGS.shots[s.key] || {};
      if (st.error && st.blob) return uploadShot(s, st.blob, st.local);
      openCamera(+b.dataset.i);
    });
    if ($('#pgSaveBtn')) $('#pgSaveBtn').onclick = savePhotoGuide;
  }

  /* ---- The camera ------------------------------------------------------- */
  async function openCamera(i) {
    PGS.at = i;
    let cam = $('#pgCam');
    if (!cam) {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="pg-cam" id="pgCam" role="dialog" aria-label="Camera">
          <div class="pg-stage" id="pgStage">
            <video id="pgVideo" playsinline muted autoplay></video>
            <div class="pg-overlay" id="pgOverlay"></div>
            <div class="pg-flash" id="pgFlash"></div>
          </div>
          <div class="pg-top">
            <button class="pg-btn" type="button" id="pgClose" aria-label="Done">${icon('close')}</button>
            <div class="pg-title"><small id="pgCount"></small><strong id="pgShot"></strong></div>
          </div>
          <p class="pg-tip" id="pgTip"></p>
          <div class="pg-controls">
            <button class="pg-btn pg-btn--text" type="button" id="pgPrev">${icon('left')}</button>
            <button class="pg-shutter" type="button" id="pgSnap" aria-label="Take the photo"></button>
            <button class="pg-btn pg-btn--text" type="button" id="pgSkip">Skip</button>
          </div>
          <button class="pg-native" type="button" id="pgNative">Use the phone’s camera</button>
          <input type="file" accept="image/*" capture="environment" id="pgFile" hidden>
          <div class="pg-rotate" id="pgRotate">${icon('camera')}<strong>Turn your phone sideways</strong><span>Every shot is landscape, the shape the website shows them in.</span>
            <button class="btn btn--outline btn--sm" type="button" id="pgRotNative" style="margin-top:14px;background:transparent;color:#fff;border-color:rgba(255,255,255,.35)">Screen won’t turn? Use the phone’s camera</button></div>
        </div>`);
      cam = $('#pgCam');
      $('#pgClose').onclick = closeCamera;
      $('#pgSnap').onclick = snap;
      $('#pgSkip').onclick = () => { const s = SHOTS[PGS.at]; PGS.shots[s.key] = Object.assign({}, PGS.shots[s.key], { skipped: true }); nextShot(); };
      $('#pgPrev').onclick = () => { if (PGS.at > 0) { PGS.at--; drawShot(); } };
      $('#pgNative').onclick = () => $('#pgFile').click();
      $('#pgRotNative').onclick = () => $('#pgFile').click();
      $('#pgFile').onchange = async () => {
        const f = $('#pgFile').files[0]; $('#pgFile').value = '';
        if (!f) return;
        try {
          const { blob } = await compress(f, 1800, 0.85);
          takeShot(blob);
        } catch (e) { toast(e.message); }
      };
    }
    cam.classList.add('is-open');
    document.documentElement.classList.add('pg-locked');
    drawShot();
    if (!PGS.stream) {
      try {
        PGS.stream = await navigator.mediaDevices.getUserMedia({ audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3264 }, height: { ideal: 2448 }, aspectRatio: { ideal: 4 / 3 } } });
        const v = $('#pgVideo');
        v.srcObject = PGS.stream;
        await v.play().catch(() => {});
        cam.classList.remove('is-native');
      } catch (err) {
        console.warn('Camera unavailable', err);
        cam.classList.add('is-native');
        toast('The camera didn’t open here, so each shot uses the phone’s own camera');
      }
    }
  }

  function drawShot() {
    const s = SHOTS[PGS.at];
    $('#pgOverlay').innerHTML = guideSvg(s, 'pg-outline');
    $('#pgCount').textContent = `${s.group} · ${PGS.at + 1} of ${SHOTS.length}${s.optional ? ' · optional' : ''}`;
    $('#pgShot').textContent = s.title;
    $('#pgTip').textContent = s.tip;
    $('#pgPrev').disabled = PGS.at === 0;
  }

  function nextShot() {
    pgSave();
    const after = SHOTS.findIndex((s, i) => i > PGS.at && !(PGS.shots[s.key] && (PGS.shots[s.key].photo || PGS.shots[s.key].uploading)));
    if (after < 0) { closeCamera(); toast('That’s every shot. Check them, then Save', 'ok'); return; }
    PGS.at = after;
    drawShot();
  }

  // The 4:3 middle of what the camera sees (which is exactly the box shown
  // on screen), at most 1800 wide, as a JPEG
  function snap() {
    const cam = $('#pgCam');
    if (cam.classList.contains('is-native')) return $('#pgFile').click();
    // A double tap would otherwise file the same picture under the next angle too
    if (PGS.snapping) return;
    PGS.snapping = true;
    setTimeout(() => { PGS.snapping = false; }, 700);
    const v = $('#pgVideo');
    const vw = v.videoWidth, vh = v.videoHeight;
    if (!vw || !vh) return toast('The camera isn’t ready yet');
    let cw = vw, ch = vh;
    if (vw / vh > 4 / 3) cw = Math.round(vh * 4 / 3); else ch = Math.round(vw * 3 / 4);
    const sx = (vw - cw) / 2, sy = (vh - ch) / 2;
    const scale = Math.min(1, 1800 / cw);
    const c = document.createElement('canvas');
    c.width = Math.round(cw * scale); c.height = Math.round(ch * scale);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(v, sx, sy, cw, ch, 0, 0, c.width, c.height);
    const flash = $('#pgFlash');
    flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on');
    c.toBlob(b => b ? takeShot(b) : toast('Couldn’t take that one, try again'), 'image/jpeg', 0.86);
  }

  function takeShot(blob) {
    const s = SHOTS[PGS.at];
    const old = PGS.shots[s.key];
    if (old && old.local) URL.revokeObjectURL(old.local);
    const local = URL.createObjectURL(blob);
    uploadShot(s, blob, local);
    nextShot();
  }

  // Each upload carries a token. If the shot has been retaken (or another car
  // picked) by the time it finishes, it's out of date and is dropped, so an
  // older photo can never land on top of a newer one, or on the wrong car.
  async function uploadShot(s, blob, local) {
    const token = PGS.seq = (PGS.seq || 0) + 1;
    PGS.shots[s.key] = { uploading: true, local, blob, token };
    PGS.busy++;
    if (state.view === 'photos') renderPhotoGuide();
    const current = () => PGS.shots[s.key] && PGS.shots[s.key].token === token;
    try {
      const photo = await uploadToCloudinary(blob);
      if (current()) PGS.shots[s.key] = { photo, local };
    } catch (err) {
      if (current()) {
        PGS.shots[s.key] = { error: err.message, local, blob, token };
        toast(`${s.title} didn’t upload: ${err.message}`);
      }
    }
    PGS.busy--;
    pgSave();
    if (state.view === 'photos') renderPhotoGuide();
  }

  function closeCamera() {
    const cam = $('#pgCam');
    if (cam) cam.classList.remove('is-open');
    document.documentElement.classList.remove('pg-locked');
    if (PGS.stream) { PGS.stream.getTracks().forEach(t => t.stop()); PGS.stream = null; }
    pgSave();
    renderPhotoGuide();
  }

  /* ---- Onto the car -------------------------------------------------------- */
  function savePhotoGuide() {
    const car = PGS.car;
    const taken = SHOTS.map(s => PGS.shots[s.key] && PGS.shots[s.key].photo).filter(Boolean);
    if (!taken.length) return;
    const existing = car.images || [];
    const write = async images => {
      const { error } = await sb.from('cars').update({ images, updated_at: new Date().toISOString() }).eq('id', car.id);
      if (error) return toast('Couldn’t save: ' + error.message);
      car.images = images;
      pgForget(car.id);
      Object.values(PGS.shots).forEach(st => { if (st.local) URL.revokeObjectURL(st.local); });
      PGS.shots = {};
      renderStock();
      toast(`${taken.length} photos saved to the ${carTitle(car)}`, 'ok');
      renderPhotoGuide();
    };
    if (!existing.length) return write(taken);
    sheet('It has photos already', `${existing.length} on the ${carTitle(car)} now.`, [
      { label: 'Replace them with these', icon: 'camera', sub: `Just the ${taken.length} new ones, in the guide’s order`, run: () => write(taken) },
      { label: 'Put these first, keep the old ones after', icon: 'copy', sub: `${taken.length + existing.length} photos`, run: () => write(taken.concat(existing)) }
    ]);
  }

  /* ============================================================ TOOLS
     Every tool in the app on one screen (3 Oct 2026). Some are new screens,
     some are the tools that already lived on a car's menu, reached here by
     picking the car first. */
  function toolList() {
    const inStockCar = c => c.status === 'available' || c.status === 'reserved';
    return [
      { key: 'invoice', icon: 'receipt', title: 'Invoices', sub: 'Make, send and print', primary: true,
        run: () => go('invoices') },
      { key: 'bid', icon: 'gauge', title: 'Before you bid', sub: 'History and a max bid',
        run: () => go('value') },
      { key: 'price', icon: 'search', title: 'Price check', sub: AT && AT.isEnabled() ? 'Auto Trader on a stock car' : 'What similar cars are up for',
        run: () => pickCar({ title: 'Check the market price', sub: 'Which car?', filter: inStockCar, run: car => checkMarket(car) }) },
      { key: 'pricebook', icon: 'book', title: 'Price book', sub: 'Auction and sold prices',
        run: () => go('pricebook') },
      { key: 'motcheck', icon: 'checkCirc', title: 'MOT checker', sub: 'Any plate’s MOT history',
        run: () => go('motcheck') },
      { key: 'motcal', icon: 'calendar', title: 'MOTs', sub: 'Calendar, and every car’s date',
        run: () => go('motcal') },
      { key: 'photos', icon: 'camera', title: 'Photo guide', sub: 'Same angles, every car',
        run: () => go('photos') },
      { key: 'pack', icon: 'copy', title: 'Listing pack', sub: 'Adverts to paste anywhere',
        run: () => pickCar({ title: 'Listing pack', sub: 'Which car?', filter: inStockCar, run: car => showListingPack(car) }) }
    ].filter(t => !TOOL_OFF.has(t.key));
  }
  // Tools whose screens aren't built yet stay off the list, rather than
  // showing a tile that goes nowhere
  const TOOL_OFF = new Set([]);

  function renderTools() {
    const tools = toolList();
    $('#toolGrid').innerHTML = tools.map((t, i) => `
      <button class="tool${t.primary ? ' tool--primary' : ''}" type="button" data-t="${i}">
        ${icon(t.icon)}<strong>${esc(t.title)}</strong><small>${esc(t.sub)}</small>
      </button>`).join('');
    $$('#toolGrid .tool').forEach(b => b.onclick = () => tools[+b.dataset.t].run());
  }

  /* =============================================== LEAVE-PAGE WARNING */
  window.addEventListener('beforeunload', e => {
    if ((state.view === 'form' || state.view === 'invoice' || state.view === 'invprev') && state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ===================================================== SERVICE WORKER */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  boot();
})();
