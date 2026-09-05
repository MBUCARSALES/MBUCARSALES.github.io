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

  /* ============================================================ ICONS */
  const P = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const ICONS = {
    check:    `<polyline ${P} points="4 12.5 9.5 18 20 6.5"/>`,
    close:    `<line ${P} x1="6" y1="6" x2="18" y2="18"/><line ${P} x1="18" y1="6" x2="6" y2="18"/>`,
    star:     `<path ${P} d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>`,
    left:     `<polyline ${P} points="15 18 9 12 15 6"/>`,
    right:    `<polyline ${P} points="9 18 15 12 9 6"/>`,
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
    inbox:    `<path ${P} d="M3 13h5l1.5 3h5L16 13h5"/><path ${P} d="M4.6 5.5 3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5l-1.6-7.5A2 2 0 0 0 17.4 4H6.6a2 2 0 0 0-2 1.5Z"/>`
  };
  const icon = n => ICONS[n] ? `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>` : '';

  /* ======================================================== CONSTANTS */
  const FUELS = [['petrol','Petrol'],['diesel','Diesel'],['hybrid','Hybrid'],
                 ['phev','Plug-in hybrid'],['electric','Electric']];
  const TRANS = [['manual','Manual'],['automatic','Automatic']];
  const BODIES = [['hatchback','Hatchback'],['saloon','Saloon'],['estate','Estate'],['suv','SUV'],
                  ['coupe','Coupe'],['convertible','Convertible'],['mpv','MPV'],['van','Van'],['pickup','Pickup']];
  /* --------------------------------------------------------------------------
     MAKES AND MODELS

     Just a starting list so the dropdowns are useful on day one. Anything you
     type yourself, and anything the plate lookup returns, gets added to the
     list automatically, and every make and model already in your own stock is
     merged in on top. So it learns what you actually sell.

     Add to it freely. Order does not matter, it is sorted before it is shown.
     -------------------------------------------------------------------------- */
  const MODELS = {
    'Abarth':        ['500','595','695','124 Spider'],
    'Alfa Romeo':    ['Giulia','Giulietta','Mito','Stelvio','Tonale'],
    'Audi':          ['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','TT','R8','e-tron','S3','RS3'],
    'BMW':           ['1 Series','2 Series','3 Series','4 Series','5 Series','6 Series','7 Series','8 Series',
                      'X1','X2','X3','X4','X5','X6','X7','Z4','i3','i4','iX','M2','M3','M4'],
    'Citroën':       ['C1','C3','C3 Aircross','C4','C4 Cactus','C5 Aircross','Berlingo','DS3'],
    'Cupra':         ['Ateca','Born','Formentor','Leon'],
    'Dacia':         ['Sandero','Duster','Jogger','Logan'],
    'Fiat':          ['500','500L','500X','Panda','Punto','Tipo','Doblo'],
    'Ford':          ['Fiesta','Focus','Puma','Kuga','EcoSport','Mondeo','C-Max','S-Max','Galaxy','Ka',
                      'B-Max','Mustang','Ranger','Transit','Transit Custom','Transit Connect','Tourneo'],
    'Honda':         ['Jazz','Civic','CR-V','HR-V','Accord','e'],
    'Hyundai':       ['i10','i20','i30','i40','Tucson','Santa Fe','Kona','Ioniq','Ioniq 5','Bayon'],
    'Jaguar':        ['XE','XF','XJ','E-Pace','F-Pace','I-Pace','F-Type'],
    'Jeep':          ['Renegade','Compass','Cherokee','Wrangler','Avenger'],
    'Kia':           ['Picanto','Rio','Ceed','Proceed','Stonic','Sportage','Sorento','Niro','EV6','Soul','XCeed'],
    'Land Rover':    ['Defender','Discovery','Discovery Sport','Freelander','Range Rover',
                      'Range Rover Sport','Range Rover Evoque','Range Rover Velar'],
    'Lexus':         ['CT','IS','ES','NX','RX','UX'],
    'Mazda':         ['2','3','6','CX-3','CX-30','CX-5','MX-5'],
    'Mercedes-Benz': ['A Class','B Class','C Class','E Class','S Class','CLA','CLS','GLA','GLB','GLC','GLE',
                      'V Class','Vito','Sprinter','SLK'],
    'MG':            ['MG3','MG4','MG5','ZS','HS','MG ZS EV'],
    'Mini':          ['Hatch','Clubman','Countryman','Convertible','Paceman'],
    'Mitsubishi':    ['Mirage','ASX','Outlander','Shogun','L200','Eclipse Cross'],
    'Nissan':        ['Micra','Note','Juke','Qashqai','X-Trail','Leaf','Ariya','Navara','Pulsar'],
    'Peugeot':       ['108','208','2008','308','3008','5008','508','Partner','Rifter','Expert','Boxer'],
    'Porsche':       ['Macan','Cayenne','Panamera','911','Boxster','Cayman','Taycan'],
    'Renault':       ['Clio','Captur','Megane','Kadjar','Scenic','Zoe','Arkana','Trafic','Master','Kangoo'],
    'Seat':          ['Ibiza','Leon','Arona','Ateca','Tarraco','Alhambra','Mii'],
    'Škoda':         ['Citigo','Fabia','Scala','Octavia','Superb','Kamiq','Karoq','Kodiaq','Enyaq','Yeti','Rapid'],
    'Smart':         ['ForTwo','ForFour'],
    'Subaru':        ['Impreza','Forester','Outback','XV'],
    'Suzuki':        ['Swift','Vitara','S-Cross','Ignis','Jimny','Celerio'],
    'Tesla':         ['Model 3','Model Y','Model S','Model X'],
    'Toyota':        ['Aygo','Yaris','Corolla','Auris','C-HR','RAV4','Prius','Hilux','Proace','Land Cruiser'],
    'Vauxhall':      ['Corsa','Astra','Insignia','Adam','Viva','Crossland','Grandland','Mokka','Zafira',
                      'Meriva','Antara','Vivaro','Combo','Movano'],
    'Volkswagen':    ['up!','Polo','Golf','Golf SV','Passat','Arteon','T-Cross','T-Roc','Tiguan','Touareg',
                      'Touran','Sharan','Scirocco','Beetle','Caddy','Transporter','ID.3','ID.4'],
    'Volvo':         ['V40','V60','V90','S60','S90','XC40','XC60','XC90','C40'],
    'Chevrolet':     ['Aveo','Cruze','Spark'],
    'Chrysler':      ['Ypsilon','300C'],
    'DS':            ['DS 3','DS 4','DS 7'],
    'Isuzu':         ['D-Max'],
    'SsangYong':     ['Tivoli','Korando','Musso','Rexton'],
    'Polestar':      ['2','3'],
    'Genesis':       ['G70','GV70','GV80'],
    'Infiniti':      ['Q30','Q50','QX30'],
    'BYD':           ['Atto 3','Dolphin','Seal']
  };

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
    enqTab: 'new',
    dataTab: 'cars',
    view: 'stock',
    editing: null,       // car being edited (null = new)
    photos: [],          // [{public_id,url,width,height,uploading,progress,localUrl}]
    video: null,         // {public_id,duration,width,height} or null
    features: new Set(),
    dirty: false
  };

  /* =========================================================== HELPERS */
  const money = n => n == null || n === '' ? 'No price' : '£' + Number(n).toLocaleString('en-GB');
  const num = v => { const n = parseFloat(String(v).replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; };
  const int = v => { const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10); return isNaN(n) ? null : n; };

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

    buildFormControls();
    await Promise.all([loadCars(), loadEnquiries()]);
    checkSchema();
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

    if (!missing.length) return;

    msg('#stockMsg',
      `<strong>Setup isn’t finished.</strong><br>
       ${missing.length === 1 ? 'This file hasn’t' : 'These files haven’t'} been run in Supabase yet:
       <br><br>${missing.map(f => '• <strong>' + f + '</strong>').join('<br>')}<br><br>
       Open Supabase → SQL Editor → New query, paste the file in, press Run.
       Do them in the order listed. Until then some things won’t save.`,
      'err');
  }

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

  /** Everything we know about, ours and the built-in list, sorted. */
  function knownMakes() {
    const set = new Set(Object.keys(MODELS));
    state.cars.forEach(c => { if (c.make) set.add(c.make); });
    return [...set].sort((a, b) => a.localeCompare(b, 'en-GB'));
  }

  function knownModels(make) {
    const set = new Set(MODELS[make] || []);
    state.cars.forEach(c => { if (c.model && (!make || c.make === make)) set.add(c.model); });
    return [...set].sort((a, b) => a.localeCompare(b, 'en-GB', { numeric: true }));
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

  /* ============================================================= NAV */
  function go(view) {
    state.view = view;
    ['stock','quick','form','value','enq','data','more'].forEach(v =>
      $('#' + v + 'View').classList.toggle('is-hidden', v !== view));

    const isForm  = view === 'form';
    const isQuick = view === 'quick';
    const isEdit  = isForm || isQuick;
    $('#tabbar').style.display = isEdit ? 'none' : '';
    $('#addFab').style.display = view === 'stock' ? '' : 'none';
    $('#saveBar').hidden  = !isForm;
    $('#quickBar').hidden = !isQuick;
    $('#backBtn').hidden = !isEdit;
    $('#topbarSpacer').style.display = isEdit ? 'none' : '';

    $('#topTitle').textContent =
      isForm ? (state.editing ? 'Edit car' : 'Add a car')
      : isQuick ? 'Quick add'
      : view === 'enq' ? 'Enquiries'
      : view === 'value' ? 'Before you bid'
      : view === 'data' ? 'Insights'
      : view === 'more' ? 'More' : 'Your stock';

    // Figures are loaded on demand, and refreshed each time you open the tab
    if (view === 'data') loadInsights();

    $$('#tabbar button').forEach(b => b.classList.toggle('is-on', b.dataset.view === view));
    window.scrollTo(0, 0);
  }

  $$('#tabbar button').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#backBtn').onclick = () => {
    if (!state.dirty) return go('stock');
    confirmSheet('Leave without saving?', 'Anything you’ve typed will be lost.',
      'Discard changes', () => { state.dirty = false; go('stock'); }, true);
  };

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
    renderStock();
  }

  $$('#stockTabs button').forEach(b => b.onclick = () => {
    state.tab = b.dataset.tab;
    $$('#stockTabs button').forEach(x => x.classList.toggle('is-on', x === b));
    renderStock();
  });

  function renderStock() {
    const list = $('#stockList');
    const cars = state.cars.filter(c =>
      state.tab === 'available' ? (c.status === 'available' || c.status === 'reserved')
      : state.tab === 'sold' ? c.status === 'sold'
      : c.status === 'draft');

    if (!cars.length) {
      const copy = {
        available: ['Nothing in stock yet', 'Tap “Add a car” to put your first one on the website.'],
        sold: ['No sold cars yet', 'When you mark a car sold it’ll appear here.'],
        draft: ['No drafts', 'Drafts are cars you’ve started but not published. They’re not on the website.']
      }[state.tab];
      list.innerHTML = `<div class="empty">${icon('car')}<h3>${copy[0]}</h3><p>${copy[1]}</p></div>`;
      return;
    }

    list.innerHTML = cars.map(c => {
      const imgs = Array.isArray(c.images) ? c.images : [];
      const title = [c.year, c.make, c.model].filter(Boolean).join(' ')
                    || (c.registration ? fmtReg(c.registration) : 'Untitled car');
      const meta = [
        c.mileage != null ? Number(c.mileage).toLocaleString('en-GB') + ' mi' : null,
        c.fuel && LABEL.fuel[c.fuel],
        c.transmission && LABEL.transmission[c.transmission],
        imgs.length ? imgs.length + ' photo' + (imgs.length === 1 ? '' : 's') : 'No photos'
      ].filter(Boolean).join(' · ');

      const pill =
        c.status === 'reserved' ? '<span class="pill pill--amber">Reserved</span>' :
        c.status === 'sold' ? '<span class="pill pill--navy">Sold</span>' :
        c.status === 'draft' ? '<span class="pill pill--grey">Draft</span>' :
        !imgs.length ? '<span class="pill pill--red">Needs photos</span>' :
        c.featured ? '<span class="pill pill--blue">Featured</span>' : '';

      const atPill = (c.at_published && c.status !== 'sold')
        ? '<span class="pill pill--accent" style="background:var(--accent-100);color:var(--accent-600)">AT</span>' : '';

      return `
      <div class="card"><div class="stock-row" data-id="${esc(c.id)}">
        <img class="stock-thumb" src="${imgs.length ? imgUrl(imgs[0], 240) : ''}" alt=""
             onerror="this.style.background='#EFF2F6';this.removeAttribute('src')">
        <div class="stock-info">
          <h3>${esc(title)}</h3>
          <div class="stock-meta">${esc(meta)}</div>
          <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">
            <span class="stock-price">${c.status === 'sold' ? 'Sold' : money(c.price)}</span>
            ${pill}${atPill}
          </div>
        </div>
        <span class="stock-chev">${icon('right')}</span>
      </div></div>`;
    }).join('');

    $$('#stockList .stock-row').forEach(row => {
      row.onclick = () => carActions(state.cars.find(c => String(c.id) === row.dataset.id));
    });
  }

  function carActions(car) {
    if (!car) return;
    const title = [car.year, car.make, car.model].filter(Boolean).join(' ') || 'This car';
    const acts = [
      { label: 'Edit details', icon: 'edit', run: () => openForm(car) }
    ];

    if (car.status !== 'draft') {
      acts.push({ label: 'Listing pack', icon: 'copy',
        sub: 'Ready-to-paste adverts for Facebook, Gumtree, Instagram',
        run: () => showListingPack(car) });
    }

    if (car.status === 'available' || car.status === 'reserved') {
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
        run: () => window.open(`../car.html?id=${encodeURIComponent(car.id)}`, '_blank') });
    }
    acts.push({ label: 'Delete this car', icon: 'trash', danger: true,
      sub: 'Permanent. No undo.',
      run: () => confirmSheet('Delete this car?',
        `${title} will be removed from the website and your list for good.`,
        'Yes, delete it', () => removeCar(car), true) });

    sheet(title, car.registration ? fmtReg(car.registration) : '', acts);
  }

  async function setStatus(car, status) {
    const patch = { status, updated_at: new Date().toISOString() };

    if (status === 'sold') {
      patch.sold_at = new Date().toISOString();
      // Optional, but it's the one number that makes the margin figures real,
      // and now is the only moment you'll reliably remember it.
      const asked = prompt(
        'What did it actually sell for?\n\n' +
        'Just for your own figures. Never shown on the website.\n' +
        'Leave blank to skip.',
        car.price != null ? String(car.price) : '');
      if (asked !== null) {
        const n = parseInt(String(asked).replace(/[^0-9]/g, ''), 10);
        if (!isNaN(n)) patch.sale_price = n;
      }
    }
    if (status === 'available' && car.status === 'sold') patch.sold_at = null;

    const { error } = await sb.from('cars').update(patch).eq('id', car.id);
    if (error) return toast('Couldn’t update: ' + error.message);
    Object.assign(car, patch);
    renderStock();
    toast(status === 'sold' ? 'Marked as sold' : status === 'reserved' ? 'Marked as reserved'
          : status === 'available' ? 'Now live on the website' : 'Updated', 'ok');
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

    // Once the API is connected this is where the advert actually goes live.
    const AT = window.MBU_AUTOTRADER;
    if (AT && AT.isEnabled()) {
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
    ['#fPurchase', '#fPrep', '#fPrice'].forEach(sel =>
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
    const inCar = paid + prep;

    if (!inCar) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;

    const margin = ask ? ask - inCar : null;
    box.innerHTML =
      `<div class="ml ml--total"><span>Total in the car</span><b>${money(inCar)}</b></div>` +
      (margin === null
        ? '<div class="ml-note">Put an asking price in and this will show what is left in it.</div>'
        : `<div class="ml ${margin >= 0 ? 'ml--good' : 'ml--bad'}">
             <span>${margin >= 0 ? 'Margin at asking price' : 'Short by'}</span>
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
      if (make) { setPicker('#qMake', '#qMakeOther', titleCase(make)); refreshQuickModels(); }
      if (d.model) setPicker('#qModel', '#qModelOther', titleCase(d.model));
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
      make: make || null,
      model: model || null,
      year: int($('#qYear').value),
      purchase_price: int($('#qPaid').value),
      prep_cost: int($('#qPrep').value),
      // What you reckon it sells for becomes the starting asking price. It is
      // a draft, so nobody sees it until somebody publishes it.
      price: target,
      private_notes: $('#qNotes').value.trim() || null,
      updated_at: new Date().toISOString()
    };

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
      renderStock();
      if (thenEdit) {
        openForm(data);
        toast('Saved. Now add the photos and the words', 'ok');
      } else {
        go('stock');
        toast('Saved as a draft. It is in the Drafts tab', 'ok');
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

  function openForm(car) {
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
    setPicker('#fMake', '#fMakeOther', (car && car.make) || '');
    fillPicker('#fModel', '#fModelOther', knownModels(car && car.make), 'Choose…');
    setPicker('#fModel', '#fModelOther', (car && car.model) || '');
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
    const { data: { session } } = await sb.auth.getSession();
    const auth = 'Bearer ' + (session ? session.access_token : SB_KEY);
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
        setPicker('#fMake', '#fMakeOther', titleCase(make));
        refreshFormModels();
      }
      if (model)  setPicker('#fModel', '#fModelOther', titleCase(model));
      if (year)   force('#fYear', year);
      if (d.colour) setPicker('#fColour', '#fColourOther', titleCase(d.colour));
      if (litres) force('#fEngine', Number(litres).toFixed(1));
      if (d.motExpiryDate) set('#fMot', String(d.motExpiryDate).slice(0, 10));
      if (miles != null) set('#fMileage', miles);

      const fuelMap = { PETROL:'petrol', DIESEL:'diesel', HYBRID:'hybrid',
                        'HYBRID ELECTRIC':'hybrid', ELECTRICITY:'electric', ELECTRIC:'electric' };
      const f = fuelMap[String(d.fuelType || '').toUpperCase()];
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
    if (fuel === 'electric') bits.push('Fully electric, so nothing to pay in road tax and very cheap to run.');

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
      make: make || null,
      model: model || null,
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
      renderStock();
      go('stock');
      toast(status === 'draft' ? 'Saved as a draft' : 'Live on the website', 'ok');
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

    return `<div class="card"><div class="enq">
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
          ${r.phone ? `<a class="btn btn--green btn--sm" href="https://wa.me/${ukNumber(r.phone)}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>` : ''}
          ${r.phone ? `<a class="btn btn--outline btn--sm" href="tel:${esc(r.phone)}">${icon('phone')} Call</a>` : ''}
          ${r.email ? `<a class="btn btn--outline btn--sm" href="mailto:${esc(r.email)}">${icon('mail')}</a>` : ''}
          <button class="btn btn--ghost btn--sm" data-req="${esc(r.id)}">More</button>
        </div>
      </div>
    </div></div>`;
  }

  function requestActions(r) {
    if (!r) return;
    const setStatusTo = async (status, label) => {
      const { error } = await sb.from('wanted_requests')
        .update({ status, is_read: true }).eq('id', r.id);
      if (error) return toast('Couldn’t update');
      r.status = status; r.is_read = true;
      renderEnquiries(); updateEnqDot();
      toast(label, 'ok');
    };

    sheet(r.name || 'Car request',
      [r.phone, r.email].filter(Boolean).join('  ·  '),
      [
        { label: 'Mark as looking', icon: 'eye',   sub: 'You’re keeping an eye out',
          run: () => setStatusTo('searching', 'Marked as looking') },
        { label: 'Found them one',  icon: 'check', sub: 'Matched to a car',
          run: () => setStatusTo('matched', 'Marked as matched') },
        { label: 'Close this off',  icon: 'close', sub: 'No longer looking',
          run: () => setStatusTo('closed', 'Closed') },
        { label: 'Archive', icon: 'trash', danger: true, sub: 'Hides it from this list',
          run: async () => {
            const { error } = await sb.from('wanted_requests').update({ archived: true }).eq('id', r.id);
            if (error) return toast('Couldn’t archive');
            state.requests = state.requests.filter(x => x.id !== r.id);
            renderEnquiries(); updateEnqDot(); toast('Archived', 'ok');
          } }
      ]);
  }

  $$('#enqTabs button').forEach(b => b.onclick = () => {
    state.enqTab = b.dataset.tab;
    $$('#enqTabs button').forEach(x => x.classList.toggle('is-on', x === b));
    renderEnquiries();
  });

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
      list.querySelectorAll('[data-req]').forEach(btn => {
        btn.onclick = () => requestActions(state.requests.find(r => String(r.id) === btn.dataset.req));
      });
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

    return `<div class="card"><div class="enq">
      <span class="enq-dot ${e.is_read ? 'is-read' : ''}"></span>
      <div class="enq-body">
        <h3>${esc(e.name || 'No name given')}</h3>
        <div class="enq-meta">${esc(kind)} · ${when.toLocaleDateString('en-GB',{day:'numeric',month:'short'})} at ${when.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
        ${extra ? `<div class="enq-meta" style="margin-top:4px;color:var(--navy-700);font-weight:600">${esc(extra)}</div>` : ''}
        ${e.message ? `<div class="enq-msg">${esc(e.message)}</div>` : ''}
        <div class="enq-actions">
          ${e.phone ? `<a class="btn btn--green btn--sm" href="https://wa.me/${ukNumber(e.phone)}" target="_blank" rel="noopener">${icon('whatsapp')} WhatsApp</a>` : ''}
          ${e.phone ? `<a class="btn btn--outline btn--sm" href="tel:${esc(e.phone)}">${icon('phone')} Call</a>` : ''}
          ${e.email ? `<a class="btn btn--outline btn--sm" href="mailto:${esc(e.email)}">${icon('mail')}</a>` : ''}
          <button class="btn btn--ghost btn--sm" data-more="${esc(e.id)}">More</button>
        </div>
      </div>
    </div></div>`;
  }

  function wireEnquiryButtons(list) {
    list.querySelectorAll('[data-more]').forEach(btn => {
      btn.onclick = () => enquiryActions(state.enquiries.find(e => String(e.id) === btn.dataset.more));
    });
    list.querySelectorAll('[data-req]').forEach(btn => {
      btn.onclick = () => requestActions(state.requests.find(r => String(r.id) === btn.dataset.req));
    });
  }

  function ukNumber(phone) {
    let n = String(phone).replace(/[^0-9+]/g, '');
    if (n.startsWith('+')) return n.slice(1);
    if (n.startsWith('0')) return '44' + n.slice(1);
    return n;
  }

  function enquiryActions(e) {
    if (!e) return;
    const d = e.details || {};
    const detail = Object.entries(d).filter(([, v]) => v)
      .map(([k, v]) => `${k.replace(/_/g,' ')}: ${v}`).join('\n');

    sheet(e.name || 'Enquiry',
      [e.phone, e.email].filter(Boolean).join('  ·  '),
      [
        { label: e.is_read ? 'Mark as unread' : 'Mark as read', icon: 'check',
          run: () => toggleRead(e) },
        ...(detail ? [{ label: 'See all details', icon: 'copy',
          run: () => alert(detail + (e.message ? '\n\nmessage: ' + e.message : '')) }] : []),
        { label: 'Archive', icon: 'trash', danger: true,
          sub: 'Hides it from this list',
          run: () => archive(e) }
      ]);
  }

  async function toggleRead(e) {
    const { error } = await sb.from('enquiries').update({ is_read: !e.is_read }).eq('id', e.id);
    if (error) return toast('Couldn’t update');
    e.is_read = !e.is_read;
    renderEnquiries(); updateEnqDot();
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

  async function archive(e) {
    const { error } = await sb.from('enquiries').update({ archived: true }).eq('id', e.id);
    if (error) return toast('Couldn’t archive');
    state.enquiries = state.enquiries.filter(x => x.id !== e.id);
    renderEnquiries(); updateEnqDot();
    toast('Archived', 'ok');
  }

  /* ==========================================================================
     INSIGHTS
     Which cars pull interest, which sit, and what people are asking for.
     All the counting happens in the database (see the views in
     schema-v2-additions.sql) so the phone doesn't have to do the work.
     ========================================================================== */
  let stats = null, demand = null, ageing = null;

  $$('#dataTabs button').forEach(b => b.onclick = () => {
    state.dataTab = b.dataset.tab;
    $$('#dataTabs button').forEach(x => x.classList.toggle('is-on', x === b));
    renderInsights();
  });
  state.dataTab = 'cars';

  async function loadInsights() {
    $('#dataBody').innerHTML =
      `<div class="section-card"><div class="skel" style="height:130px"></div></div>`.repeat(3);

    const [s, d, a] = await Promise.all([
      sb.from('car_stats').select('*'),
      sb.from('demand_summary').select('*'),
      sb.from('stock_ageing').select('*')
    ]);

    if (s.error || d.error) {
      msg('#dataMsg',
        'Couldn’t load the figures: ' + esc((s.error || d.error).message) +
        '<br><br>If you haven’t run <strong>schema-v2-additions.sql</strong> in Supabase yet, that’s why.',
        'err');
      $('#dataBody').innerHTML = '';
      return;
    }
    msg('#dataMsg', '');
    stats = s.data || [];
    demand = d.data || [];
    ageing = a.error ? null : (a.data || []);   // null = schema v4 not run yet
    renderInsights();
  }

  function renderInsights() {
    if (!stats) return;
    $('#dataBody').innerHTML =
      state.dataTab === 'ageing' ? ageingInsights()
      : state.dataTab === 'demand' ? demandInsights()
      : carInsights();
    wireInsightActions();
  }

  /* ---- Ageing: the price review worklist ---------------------------------
     The app already flagged cars that were sitting. This turns that into
     something you can act on: how long, what it's cost you in looks, what
     you actually got for the last one, and a button to change the price. */
  function ageingInsights() {
    if (ageing === null) {
      return `<div class="msg msg--warn is-shown">
        Run <strong>schema-v4-pricing-video.sql</strong> in Supabase to switch this on.
      </div>`;
    }
    if (!ageing.length) {
      return `<div class="empty">${icon('checkCirc')}<h3>Nothing hanging about</h3>
        <p>No cars in stock, or none of them old enough to worry about yet.</p></div>`;
    }

    const bands = [
      ['critical', 'Over 90 days and losing you money', 'var(--red-600)'],
      ['overdue',  '60 to 90 days, worth a price review', 'var(--amber-600)'],
      ['watch',    '45 to 60 days, keep an eye on it', 'var(--ink-2)'],
      ['fine',     'Fresh stock', 'var(--green-600)']
    ];

    const counts = bands.map(([k]) => ageing.filter(c => c.ageing === k).length);
    const needsAction = counts[0] + counts[1];

    const row = c => {
      const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
      const lastChange = c.last_price_change
        ? Math.round((Date.now() - new Date(c.last_price_change)) / 86400000) : null;
      const gapToAvg = (c.avg_achieved != null && c.price != null)
        ? c.price - c.avg_achieved : null;

      return `<div class="card" style="margin-bottom:10px"><div style="padding:14px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0;flex:1">
            <h3 style="font-size:16px;font-weight:700">${esc(title)}</h3>
            <div style="font-size:13.5px;color:var(--ink-3);margin-top:2px">
              ${money(c.price)} · ${nf(c.days_in_stock)} days
              ${c.previous_price ? ' · already reduced from ' + money(c.previous_price) : ''}
            </div>
          </div>
          <span class="pill ${c.ageing === 'critical' ? 'pill--red'
                            : c.ageing === 'overdue' ? 'pill--amber' : 'pill--grey'}">
            ${c.days_in_stock}d
          </span>
        </div>

        <div style="font-size:14px;color:var(--ink-2);margin-top:10px;line-height:1.6">
          ${c.avg_achieved != null
            ? `You've averaged <strong>${money(c.avg_achieved)}</strong> on these${
                c.avg_days_to_sell != null ? `, sold in about ${c.avg_days_to_sell} days` : ''}.
               ${gapToAvg > 200 ? `This one is <strong style="color:var(--amber-600)">${money(gapToAvg)} above</strong> that.` : ''}`
            : `No history on this model to compare against.`}
          <br>
          ${nf(c.views)} views, ${nf(c.contacts)} got in touch.
          ${c.views >= 25 && c.contacts === 0 ? '<strong style="color:var(--red-600)">Plenty of interest but nobody ringing. That\'s a price problem.</strong>' : ''}
          ${lastChange != null ? `<br>Price last changed ${lastChange} days ago.` : '<br>Price never changed.'}
        </div>

        <button class="btn btn--outline btn--sm btn--block" data-reprice="${esc(c.id)}" style="margin-top:12px">
          Change the price
        </button>
      </div></div>`;
    };

    const sections = bands.map(([key, label, colour], i) => {
      const list = ageing.filter(c => c.ageing === key);
      if (!list.length || key === 'fine') return '';
      return `<div class="section-card">
        <h2 style="color:${colour}">${label} · ${list.length}</h2>
        ${list.map(row).join('')}
      </div>`;
    }).join('');

    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        ${statTile(counts[0], 'Over 90 days', counts[0] ? 'var(--red-600)' : null)}
        ${statTile(counts[1], '60 to 90 days', counts[1] ? 'var(--amber-600)' : null)}
        ${statTile(counts[3], 'Fresh', 'var(--green-600)')}
      </div>

      ${needsAction
        ? `<div class="msg msg--warn is-shown" style="margin-bottom:14px">
             <strong>${needsAction} car${needsAction === 1 ? '' : 's'} need${needsAction === 1 ? 's' : ''} a decision.</strong>
             Every week a car sits is money tied up that could be in the next one.
           </div>`
        : `<div class="msg msg--ok is-shown" style="margin-bottom:14px">
             Nothing sitting too long. Stock is moving.
           </div>`}

      ${sections || `<div class="empty">${icon('checkCirc')}<h3>All fresh</h3>
        <p>Nothing has been here long enough to worry about.</p></div>`}`;
  }

  /** Change a price from the ageing list, with the history recorded. */
  async function repriceCar(carId) {
    const car = state.cars.find(c => String(c.id) === String(carId));
    const info = (ageing || []).find(c => String(c.id) === String(carId));
    if (!car) return toast('Couldn’t find that car');

    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');
    const suggestion = info && info.avg_achieved != null ? info.avg_achieved : null;

    const entered = prompt(
      `New price for the ${title}\n\n` +
      `Currently ${money(car.price)}.` +
      (suggestion ? `\nYou've averaged ${money(suggestion)} on these.` : '') +
      `\n\nDropping it shows a "Reduced" badge on the website for two weeks.`,
      car.price != null ? String(car.price) : '');

    if (entered === null) return;
    const price = parseInt(String(entered).replace(/[^0-9]/g, ''), 10);
    if (isNaN(price) || price <= 0) return toast('That wasn’t a valid price');
    if (price === car.price) return;

    const { error } = await sb.from('cars').update({ price }).eq('id', car.id);
    if (error) return toast('Couldn’t update: ' + error.message);

    const wentDown = car.price != null && price < car.price;
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

  function carInsights() {
    const live = stats.filter(c => c.status === 'available' || c.status === 'reserved');
    const sold = stats.filter(c => c.status === 'sold');

    const totalViews = stats.reduce((n, c) => n + (c.views || 0), 0);
    const totalContacts = stats.reduce((n, c) =>
      n + (c.whatsapp_clicks || 0) + (c.phone_clicks || 0) + (c.enquiries || 0), 0);

    const soldWithDays = sold.filter(c => c.days_in_stock != null);
    const avgDays = soldWithDays.length
      ? Math.round(soldWithDays.reduce((n, c) => n + c.days_in_stock, 0) / soldWithDays.length)
      : null;

    const withMargin = sold.filter(c => c.margin != null);
    const totalMargin = withMargin.reduce((n, c) => n + c.margin, 0);

    if (!totalViews && !stats.length) {
      return `<div class="empty">${icon('car')}<h3>Nothing to show yet</h3>
        <p>Once the website has had a few visitors you'll see which cars people
        are actually looking at.</p></div>`;
    }

    /* Ranked list of live stock by interest */
    const ranked = live.slice().sort((a, b) =>
      (b.views || 0) - (a.views || 0) || (b.enquiries || 0) - (a.enquiries || 0));

    const rows = ranked.map(c => {
      const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
      const contacts = (c.whatsapp_clicks || 0) + (c.phone_clicks || 0) + (c.enquiries || 0);
      const stale = c.days_in_stock >= 60;
      const noInterest = c.views >= 25 && contacts === 0;

      return `<div class="card" style="margin-bottom:10px"><div style="padding:14px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0;flex:1">
            <h3 style="font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</h3>
            <div style="font-size:13px;color:var(--ink-3);margin-top:2px">
              ${money(c.price)} · ${nf(c.days_in_stock)} days in stock
            </div>
          </div>
          ${stale ? '<span class="pill pill--amber">Sitting</span>'
            : noInterest ? '<span class="pill pill--red">No contact</span>'
            : contacts >= 3 ? '<span class="pill pill--green">Hot</span>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px;text-align:center">
          <div><b style="font-size:17px">${nf(c.views)}</b><br><span style="font-size:11px;color:var(--ink-3)">views</span></div>
          <div><b style="font-size:17px">${nf(c.gallery_opens)}</b><br><span style="font-size:11px;color:var(--ink-3)">photos</span></div>
          <div><b style="font-size:17px">${nf(contacts)}</b><br><span style="font-size:11px;color:var(--ink-3)">contacts</span></div>
          <div><b style="font-size:17px">${c.contact_rate_pct != null ? c.contact_rate_pct + '%' : 'n/a'}</b><br><span style="font-size:11px;color:var(--ink-3)">rate</span></div>
        </div>
      </div></div>`;
    }).join('');

    const advice = [];
    const sitting = live.filter(c => c.days_in_stock >= 60);
    const ignored = live.filter(c => (c.views || 0) >= 25 &&
      ((c.whatsapp_clicks||0)+(c.phone_clicks||0)+(c.enquiries||0)) === 0);

    if (sitting.length) {
      advice.push(`<strong>${sitting.length} car${sitting.length === 1 ? ' has' : 's have'} been here over 60 days.</strong>
        Worth a price review. The longer they sit the more they cost you.`);
    }
    if (ignored.length) {
      advice.push(`<strong>${ignored.length} car${ignored.length === 1 ? ' is' : 's are'} getting looked at but nobody's making contact.</strong>
        Usually means the price is out of line, or the photos aren't selling it.`);
    }

    return `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:14px">
        ${statTile(nf(totalViews), 'Car views')}
        ${statTile(nf(totalContacts), 'People made contact', 'var(--green-600)')}
        ${statTile(avgDays != null ? avgDays + ' days' : 'Not yet', 'Avg time to sell')}
        ${statTile(withMargin.length ? money(totalMargin) : 'Not yet', 'Total margin', 'var(--accent-600)')}
      </div>

      ${withMargin.length === 0 ? `
        <div class="msg msg--info is-shown" style="margin-bottom:14px">
          Add what you paid and your prep costs when you enter a car, and this
          will show you real margin per car.
        </div>` : ''}

      ${advice.map(a => `<div class="msg msg--warn is-shown" style="margin-bottom:10px">${a}</div>`).join('')}

      <div class="section-card">
        <h2>In stock, most interest first</h2>
        ${rows || '<p class="hint">No cars in stock at the moment.</p>'}
      </div>

      <button class="btn btn--outline btn--block" id="exportCars" style="margin-top:14px">
        Export all car figures (CSV)
      </button>`;
  }

  function demandInsights() {
    if (!demand.length) {
      return `<div class="empty">${icon('inbox')}<h3>No requests yet</h3>
        <p>When someone uses the Car Finder, or registers interest in a car that's
        sold, what they're after shows up here. Over time this tells you what to
        be buying.</p></div>`;
    }

    const total = demand.reduce((n, d) => n + d.requests, 0);
    const fromSold = demand.reduce((n, d) => n + (d.from_sold_cars || 0), 0);
    const open = demand.reduce((n, d) => n + (d.still_open || 0), 0);

    const rows = demand.map(d => `
      <div class="card" style="margin-bottom:10px"><div style="padding:14px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <div style="min-width:0">
            <h3 style="font-size:16.5px;font-weight:700">${esc(d.make)}${d.model && d.model !== 'Any' ? ' ' + esc(d.model) : ''}</h3>
            <div style="font-size:13px;color:var(--ink-3);margin-top:2px">
              ${d.avg_budget ? 'Average budget ' + money(d.avg_budget) : 'No budget given'}
              ${d.from_sold_cars ? ' · ' + d.from_sold_cars + ' from sold cars' : ''}
            </div>
          </div>
          <span class="pill ${d.requests >= 3 ? 'pill--green' : 'pill--grey'}"
                style="font-size:15px;padding:6px 13px">${d.requests}</span>
        </div>
      </div></div>`).join('');

    const top = demand[0];

    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        ${statTile(nf(total), 'Requests')}
        ${statTile(nf(open), 'Still open', 'var(--amber-600)')}
        ${statTile(nf(fromSold), 'From sold cars')}
      </div>

      ${top && top.requests >= 2 ? `
        <div class="msg msg--info is-shown" style="margin-bottom:14px">
          <strong>${esc(top.make)}${top.model && top.model !== 'Any' ? ' ' + esc(top.model) : ''}
          is your most requested car</strong>. ${top.requests} people asked${top.avg_budget ? `, averaging ${money(top.avg_budget)}` : ''}.
          Worth looking out for at the next auction.
        </div>` : ''}

      <div class="section-card">
        <h2>What people are asking for</h2>
        ${rows}
      </div>

      <button class="btn btn--outline btn--block" id="exportDemand" style="margin-top:14px">
        Export requests (CSV)
      </button>`;
  }

  function wireInsightActions() {
    const ec = $('#exportCars');
    if (ec) ec.onclick = () => downloadCsv('mbu-car-figures', stats);
    const ed = $('#exportDemand');
    if (ed) ed.onclick = () => downloadCsv('mbu-car-requests', demand);
    $$('#dataBody [data-reprice]').forEach(b => {
      b.onclick = () => repriceCar(b.dataset.reprice);
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
      ['car_stats',       'mbu-car-performance']
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
      const s = (typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/"/g, '""');
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

${feats.length ? 'Spec: ' + feats.join(', ') + '\n\n' : ''}Part exchange welcome and no admin fees. The price is the price.
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
- Part exchange welcome, no admin fees
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

${feats.length ? 'Equipment includes: ' + feats.join(', ') + '.\n\n' : ''}Every car we sell is HPI checked, serviced and MOT'd before collection, and we are upfront about any history. Part exchange welcome and there are no admin fees. The advertised price is what you pay.

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
      const { data: { session } } = await sb.auth.getSession();
      const auth = 'Bearer ' + (session ? session.access_token : SB_KEY);

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
            make: d.make ? titleCase(d.make) : null, model: null,
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
      if (vehicle.make) vehicle.make = titleCase(vehicle.make);
      if (vehicle.colour) vehicle.colour = titleCase(vehicle.colour);
      renderValuation();

    } catch (err) {
      console.error(err);
      $('#vResult').innerHTML = '';
      msg('#vMsg', esc(err.message || 'Lookup failed') +
        '<br><br>You can still add the car by hand from the Stock tab.', 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'Check';
    }
  }

  /* ---- your own trading history for this make/model ---------------------- */
  function ownHistory(make, model) {
    if (!make) return null;
    const m = String(make).toLowerCase();
    const mod = model ? String(model).toLowerCase() : null;

    const exact = state.cars.filter(c =>
      String(c.make || '').toLowerCase() === m &&
      (!mod || String(c.model || '').toLowerCase() === mod));
    const sameMake = state.cars.filter(c => String(c.make || '').toLowerCase() === m);

    const pool = exact.length ? exact : sameMake;
    if (!pool.length) return null;

    const sold = pool.filter(c => c.status === 'sold');
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
      avgBought: avg(pool, c => c.purchase_price),
      avgSold: avg(sold, c => c.sale_price != null ? c.sale_price : c.price),
      avgAsking: avg(pool, c => c.price),
      avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
      avgMargin: avg(sold, c => (c.sale_price != null && c.purchase_price != null)
        ? c.sale_price - c.purchase_price - (c.prep_cost || 0) : null)
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
      .ilike('make', make).order('created_at', { ascending: false }).limit(6);
    if (model) q = q.ilike('model', model);
    const { data, error } = await q;
    if (error) { console.warn('price_checks unavailable', error); return null; }
    return data || [];
  }

  /** Record what was on screen. Deliberately three quick numbers, no essay. */
  function recordPriceCheck(v, mileage) {
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
        notes: $('#pcNotes').value.trim() || null
      };

      const { error } = await sb.from('price_checks').insert(row);
      closeSheet();

      if (error) {
        console.warn(error);
        toast('Couldn’t save it, but the price is in');
      } else {
        toast('Saved to your price book', 'ok');
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
    const seen = (history || []).filter(h => h.typical);
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
        </p>`}`;

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

  /* ---- customer requests this car would satisfy -------------------------- */
  function matchingRequests(make, model) {
    const m = String(make || '').toLowerCase();
    const mod = String(model || '').toLowerCase();
    return state.requests.filter(r => {
      if (r.status === 'closed' || r.archived) return false;
      const rm = String(r.make || '').toLowerCase();
      if (!rm) return false;
      if (rm !== m) return false;
      if (r.model && mod && !mod.includes(String(r.model).toLowerCase())
          && !String(r.model).toLowerCase().includes(mod)) return false;
      return true;
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
    const reqs = matchingRequests(v.make, v.model);

    const flagHtml = (v.flags || []).map(f => `
      <div class="msg msg--${f.level === 'bad' ? 'err' : f.level === 'warn' ? 'warn' : 'ok'} is-shown"
           style="margin-bottom:8px">${esc(f.text)}</div>`).join('');

    const spec = [
      v.engineLitres ? v.engineLitres.toFixed(1) + 'L' : null,
      v.fuelType ? titleCase(v.fuelType) : null,
      v.colour,
      mot && mot.latestMileage != null ? nf(mot.latestMileage) + ' mi' : null
    ].filter(Boolean).join(' · ');

    $('#vResult').innerHTML = `
      <!-- What it is -->
      <div class="section-card">
        <h2>The car</h2>
        <h3 style="font-size:21px;margin-bottom:4px">${esc(title)}</h3>
        <div style="font-size:14.5px;color:var(--ink-3)">${esc(spec || 'No details returned')}</div>
        ${!v.found?.mot ? `<p class="hint" style="margin-top:10px">
          MOT history unavailable${v.motUnavailableReason === 'no_key'
            ? '. Add the free MOT API keys to see mileage history and advisories.' : '.'}
        </p>` : ''}
      </div>

      <!-- Warnings -->
      <div class="section-card">
        <h2>What to watch for</h2>
        ${flagHtml}
      </div>

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
            value="${hist && hist.avgSold != null ? hist.avgSold : ''}" placeholder="0"></div>
          ${hist && hist.avgSold != null
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
    refreshPriceBlock(v, mot && mot.latestMileage != null ? mot.latestMileage : null);
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
    if (!isNaN(paidNum)) { $('#fPurchase').value = paidNum; renderCostSummary(); }

    const fuelMap = { PETROL:'petrol', DIESEL:'diesel', HYBRID:'hybrid',
                      'HYBRID ELECTRIC':'hybrid', ELECTRICITY:'electric', ELECTRIC:'electric' };
    const f = fuelMap[String(v.fuelType || '').toUpperCase()];
    if (f) setChip('#fFuel', f);

    if (v.mot && v.mot.currentAdvisories.length) {
      $('#fPrivateNotes').value =
        'Advisories at purchase:\n' + v.mot.currentAdvisories.map(a => '· ' + a).join('\n');
    }

    state.dirty = true;
    toast('Started from the plate. Add photos and a price', 'ok');
  }

  /* =============================================== LEAVE-PAGE WARNING */
  window.addEventListener('beforeunload', e => {
    if (state.view === 'form' && state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ===================================================== SERVICE WORKER */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  boot();
})();
