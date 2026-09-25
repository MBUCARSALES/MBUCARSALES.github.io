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
    stockSort: remembered('mbu_stock_sort', 'newest'),
    stockQuery: '',
    interestSort: remembered('mbu_interest_sort', 'interest'),
    enqTab: 'new',
    dataTab: 'cars',
    soldMonth: 'all',        // 'all' or 'YYYY-MM', for the Sold tab
    marginOpen: false,       // per-car breakdown under the margin figure
    schema: { v6: null, v7: null },   // optional upgrades: true, false, or null = not checked yet

    view: 'home',
    returnTo: 'home',    // where Back goes from a car, a message or the bid tool
    message: null,       // { kind: 'e' | 'r', id } open in the message view
    homeOpen: new Set(), // Home "Needs you" sections dropped down, by key
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
    buildStockTools();
    go('home');
    await Promise.all([loadCars(), loadEnquiries()]);
    checkSchema();
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
    // they're offered on the More tab rather than shouted about on Stock.
    const has = async run => {
      try {
        const { error } = await run();
        return !(error && /does not exist|schema cache|not find the table/i.test(error.message));
      } catch { return false; }
    };
    const [v6, v7] = await Promise.all([
      has(() => sb.from('tracking_status').select('v2_since').limit(1)),
      has(() => sb.from('insight_actions').select('id').limit(1))
    ]);
    state.schema = { v6, v7 };
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
   * More → "Ready to switch on". Lists the upgrades that are written but not
   * yet turned on, in the order they have to happen, and says what each gets
   * you. Hidden once there's nothing left to do.
   */
  function renderUpgrades() {
    const items = [];
    const via = (CFG.tracking && CFG.tracking.via) || 'rest';

    if (state.schema.v6 === false) {
      items.push(['Count people, not page loads',
        'Run <strong>schema-v6-tracking.sql</strong> in Supabase → SQL Editor. Then deploy the <strong>track</strong> function. HANDOVER 9f has the steps.']);
    } else if (state.schema.v6 && via !== 'function') {
      items.push(['Switch the website to the new tracking',
        'The database is ready. Deploy the <strong>track</strong> function with JWT verification off, then set <strong>tracking: { via: \'function\' }</strong> in config.js.']);
    }
    if (state.schema.v7 === false) {
      items.push(['"Price is right" and "Remind me" on insights',
        'Run <strong>schema-v7-insights.sql</strong> in Supabase → SQL Editor, after v6.']);
    }

    $('#upgradesCard').hidden = !items.length;
    $('#upgradesBody').innerHTML = items.map(([title, how]) => `
      <div style="padding:10px 0;border-bottom:1px solid var(--line-2)">
        <strong style="display:block;font-size:15.5px">${esc(title)}</strong>
        <span class="hint" style="display:block;margin-top:3px;font-size:14px;line-height:1.5">${how}</span>
      </div>`).join('');
  }

  /* ---- More → Auto Trader --------------------------------------------- */
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

  /* ============================================================= NAV
     Five tabs, and four screens you reach from them: the car form, quick
     add, one message in full, and the bid tool (which used to be a tab and
     now lives on Home). Back from any of those goes to the tab you came
     from, so fixing a car from a Home alert lands you back on Home. */
  const TABS = ['home', 'stock', 'enq', 'data', 'more'];
  const LIT_TAB = { value: 'home', msg: 'enq' };   // which tab stays lit on a sub-screen

  function go(view) {
    if (!TABS.includes(view) && TABS.includes(state.view)) state.returnTo = state.view;
    state.view = view;
    ['home','stock','quick','form','value','enq','msg','data','more'].forEach(v =>
      $('#' + v + 'View').classList.toggle('is-hidden', v !== view));

    const isForm  = view === 'form';
    const isQuick = view === 'quick';
    const isEdit  = isForm || isQuick;
    const isSub   = !TABS.includes(view);
    $('#tabbar').style.display = isEdit ? 'none' : '';
    $('#addFab').style.display = view === 'stock' ? '' : 'none';
    $('#saveBar').hidden  = !isForm;
    $('#quickBar').hidden = !isQuick;
    $('#backBtn').hidden = !isSub;
    $('#topbarSpacer').style.display = isSub ? 'none' : '';

    $('#topTitle').textContent =
      isForm ? (state.editing ? 'Edit car' : 'Add a car')
      : isQuick ? 'Quick add'
      : view === 'home' ? 'Home'
      : view === 'enq' ? 'Inbox'
      : view === 'msg' ? 'Message'
      : view === 'value' ? 'Before you bid'
      : view === 'data' ? 'Insights'
      : view === 'more' ? 'More' : 'Your stock';

    // Figures are loaded on demand, and refreshed each time you open the tab
    if (view === 'home') { renderHome(); refreshHomeFigures(); }
    if (view === 'data') loadInsights();
    if (view === 'more') atIntro();

    const lit = LIT_TAB[view] || view;
    $$('#tabbar button').forEach(b => b.classList.toggle('is-on', b.dataset.view === lit));
    window.scrollTo(0, 0);
  }

  const goBack = () => go(TABS.includes(state.returnTo) ? state.returnTo : 'home');

  $$('#tabbar button').forEach(b => b.onclick = () => go(b.dataset.view));
  $('#backBtn').onclick = () => {
    if (!state.dirty || !['form', 'quick'].includes(state.view)) { state.dirty = false; return goBack(); }
    confirmSheet('Leave without saving?', 'Anything you’ve typed will be lost.',
      'Discard changes', () => { state.dirty = false; goBack(); }, true);
  };
  $('#moreValue').onclick = () => go('value');

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

  function renderHome() {
    const body = $('#homeBody');
    if (!state.carsLoaded) {
      body.innerHTML = `<div class="section-card"><div class="skel" style="height:120px"></div></div>`.repeat(3);
      return;
    }
    homeActs = [];
    if (insightsAt) analysis = runEngine();

    const now = new Date();
    const sections = homeSections();
    const SHOWN = 7;
    const act = run => homeActs.push(run) - 1;

    /* One kind of thing per row. Tap it and the cars (or messages) it covers
       drop down underneath, each one tapping through to its fix. A section
       with only one thing in it skips the drop-down and goes straight there. */
    const section = s => {
      if (s.items.length === 1) {
        const it = s.items[0];
        const [title, sub] = s.single === 'item' ? [it.title, it.sub] : [s.title, it.title];
        return `<button class="alert alert--${s.level}" type="button" data-home="${act(it.run)}">
          <span class="alert-ic">${icon(s.icon)}</span>
          <span class="alert-txt"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span>
          ${icon('right')}
        </button>`;
      }
      return `<details class="alert-group" data-key="${s.key}"${state.homeOpen.has(s.key) ? ' open' : ''}>
        <summary class="alert alert--${s.level}">
          <span class="alert-ic">${icon(s.icon)}</span>
          <span class="alert-txt"><strong>${esc(s.title)}</strong><small>${esc(s.sub)}</small></span>
          <span class="alert-count">${s.items.length}</span>${icon('down')}
        </summary>
        <div class="alert-items">${s.items.map(it => `
          <button class="alert-item" type="button" data-home="${act(it.run)}">
            <i class="dot dot--${it.level || s.level}"></i>
            <span class="alert-txt"><strong>${esc(it.title)}</strong><small>${esc(it.sub)}</small></span>
            ${icon('right')}
          </button>`).join('')}
        </div>
      </details>`;
    };

    body.innerHTML = `
      <p class="home-date">${esc(now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>

      <div class="home-actions">
        <button class="home-action home-action--primary" type="button" id="hAdd">
          ${icon('car')}<span><strong>Add a car</strong><small>Plate and what you paid</small></span>
        </button>
        <button class="home-action" type="button" id="hBid">
          ${icon('gauge')}<span><strong>Before you bid</strong><small>History and a max bid</small></span>
        </button>
      </div>

      <h2 class="home-h">Needs you${sections.length ? ` <span class="home-n">${sections.length}</span>` : ''}</h2>
      ${sections.length ? `<div class="card alerts">
          ${sections.slice(0, SHOWN).map(section).join('')}
          ${sections.length > SHOWN ? `<details class="alerts-more">
            <summary>Show ${sections.length - SHOWN} more</summary>
            ${sections.slice(SHOWN).map(section).join('')}
          </details>` : ''}
        </div>`
      : `<div class="card alert-none alert-none--ok">${icon('checkCirc')}<span>Nothing needs you right now.</span></div>`}
      ${!insightsAt && insightsBusy ? '<p class="note home-note">Checking prices and interest…</p>' : ''}

      ${homeMoney()}
      ${homeStock()}
      ${homeMessages()}
      ${homeOldest()}`;

    $('#hAdd').onclick = () => openQuick();
    $('#hBid').onclick = () => go('value');
    $$('#homeBody [data-home]').forEach(b => { b.onclick = () => homeActs[+b.dataset.home](); });
    // Remember which sections are open, so a redraw (a message read, a price
    // changed) doesn't snap them shut
    $$('#homeBody details.alert-group').forEach(d => {
      d.addEventListener('toggle', () => { d.open ? state.homeOpen.add(d.dataset.key) : state.homeOpen.delete(d.dataset.key); });
    });
    $$('#homeBody [data-go]').forEach(b => {
      b.onclick = () => {
        const [view, tab] = b.dataset.go.split(':');
        if (view === 'stock') { setStockTab(tab || 'available'); go('stock'); }
        else if (view === 'data') openDataTab(tab || 'cars');
        else if (view === 'enq') { setEnqTab(tab || 'new'); go('enq'); }
      };
    });
    wireFigureButtons(body);
    wireCharts(body);
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
    const held = cars.filter(c => inStock(c) || c.status === 'draft');   // cars you still own
    const live = cars.filter(inStock);
    const sold = cars.filter(c => c.status === 'sold');
    const worst = items => ['red', 'amber', 'blue', 'green', 'grey'].find(l => items.some(it => it.level === l)) || 'grey';
    const carSub = c => [carTitle(c), c.registration ? fmtReg(c.registration) : null,
      c.status === 'draft' ? 'draft' : null].filter(Boolean).join(' · ');
    const counted = (n, one, many) => n === 1 ? '1 ' + one : n + ' ' + (many || one + 's');

    /* MOTs: run out, running out, and cars with no date, in one place */
    const mots = held.filter(c => motLevel(c) || !c.mot_expiry)
      .sort((a, b) => (motDays(a) ?? Infinity) - (motDays(b) ?? Infinity))
      .map(c => {
        const lvl = motLevel(c) || 'grey';
        return { level: lvl, days: motDays(c), title: c.mot_expiry ? motWords(c) : 'No MOT date', sub: carSub(c),
          run: () => c.mot_expiry
            ? sheet(motWords(c), carTitle(c) + ' · ' + new Date(c.mot_expiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), [
                { label: 'Put in the new MOT date', icon: 'calendar', sub: 'Once it’s been tested', run: () => openForm(c, '#fMot') },
                { label: 'See the car', icon: 'car', run: () => carActions(c) }])
            : openForm(c, '#fMot') };
      });
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
    const gap = (list, o) => {
      if (!list.length) return;
      out.push(Object.assign({ level: 'grey', rank: 8, single: 'section' }, o, {
        title: list.length === 1 ? o.one : `${list.length} ${o.many}`,
        items: list.map(c => ({ title: carTitle(c),
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
    gap(sold.filter(c => carMargin(c) == null), {
      key: 'unmargined', level: 'amber', rank: 7, icon: 'pound', one: '1 sale isn’t in your margin', many: 'sales aren’t in your margin',
      sub: 'What you paid or what it sold for is missing', fix: c => figuresSheet(c),
      itemSub: c => `Sold ${c.sold_at ? shortDay(c.sold_at) : ''} · ${[c.sale_price == null ? 'no sale price' : '', c.purchase_price == null ? 'no purchase price' : ''].filter(Boolean).join(', ')}` });
    gap(sold.filter(c => carMargin(c) != null && c.prep_cost == null), {
      key: 'noprep', icon: 'pound', one: '1 sale has no prep cost', many: 'sales have no prep cost',
      sub: 'Counted as £0 prep, so the margin reads high', fix: c => figuresSheet(c),
      itemSub: c => `Sold ${c.sold_at ? shortDay(c.sold_at) : ''} · margin ${signed(carMargin(c))} before prep` });
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

    const LEVEL = { red: 0, blue: 1, amber: 2, green: 3, grey: 4 };
    return out.sort((a, b) => a.rank - b.rank || LEVEL[a.level] - LEVEL[b.level]);
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
    const missing = t.cars.filter(c => carMargin(c) == null);
    const months = monthlyMargins(6);

    return `
      <h2 class="home-h">Money</h2>
      <div class="section-card home-money">
        <div class="hm-label">Margin in ${esc(f.thisName)} so far</div>
        <div class="hm-figure ${t.total < 0 ? 'is-loss' : ''}">${t.counted ? signed(t.total) : '£0'}</div>
        <div class="hm-compare">${compare} ${t.cars.length ? `${plural(t.cars.length, 'car')} sold.` : ''}</div>
        ${missing.length || noPrep.length ? `<div class="hm-flags">
          ${missing.length ? `<span class="pill pill--amber">${missing.length} not counted, figure missing</span>` : ''}
          ${noPrep.length ? `<span class="pill pill--grey">${noPrep.length} before prep</span>` : ''}
        </div>` : ''}
        ${months.length > 1 ? `<div class="hm-chart">${barChart(months, { compact: true, action: 'open', height: 76 })}</div>` : ''}
        <button class="btn btn--outline btn--sm btn--block" type="button" data-go="data:sold">See every sale and the charts</button>
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
      <h2 class="home-h">Stock</h2>
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
  }

  /** Everything you might type to find a car: make, model, trim, plate, year, colour. */
  function matchesQuery(c, q) {
    if (!q) return true;
    const hay = [c.make, c.model, c.variant, c.year, c.colour, c.registration,
      LABEL.fuel[c.fuel], LABEL.transmission[c.transmission]]
      .filter(Boolean).join(' ').toLowerCase();
    const plate = String(c.registration || '').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(w =>
      hay.includes(w) || plate.includes(w.replace(/\s+/g, '')));
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
    const cars = all.filter(c => matchesQuery(c, q)).sort(SORTS[state.stockSort][1]);

    // One line saying what you're looking at, and on In stock what it's worth
    const priced = cars.filter(c => c.price != null);
    const worth = state.tab === 'available' && priced.length
      ? ` · ${money(priced.reduce((n, c) => n + c.price, 0))} at asking` : '';
    $('#stockSummary').textContent = !all.length ? ''
      : q ? `${cars.length} of ${all.length} match “${q}”${worth}`
      : `${plural(all.length, state.tab === 'sold' ? 'car sold' : state.tab === 'draft' ? 'draft' : 'car', state.tab === 'sold' ? 'cars sold' : undefined)}${worth}`;

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
      const motPill = mot ? `<span class="pill pill--${mot}">${icon('calendar')}${
        motDays(c) < 0 ? 'MOT ran out' : 'MOT ' + shortDay(c.mot_expiry)}</span>` : '';

      // On a sold car the useful number is what you made, and whether it's complete
      const mg = sold ? carMargin(c) : null;
      const price = sold
        ? (mg != null ? `<span class="stock-price ${mg < 0 ? 'is-loss' : ''}">${signed(mg)}</span><span class="stock-price-note">margin</span>`
                      : '<span class="stock-price is-missing">Figures missing</span>')
        : `<span class="stock-price">${money(c.price)}</span>`;
      const soldPill = sold && mg != null && c.prep_cost == null ? '<span class="pill pill--grey">No prep entered</span>' : '';

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
            ${pill}${motPill}${soldPill}${atPill}
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
    const acts = [];

    // On a sold car the money is the thing you come back to fix, so it goes first
    if (car.status === 'sold') {
      const mg = carMargin(car);
      acts.push({ label: 'Edit the figures', icon: 'pound',
        sub: mg == null ? 'A figure is missing, so it isn’t in your margin'
           : car.prep_cost == null ? `Margin ${signed(mg)}, but no prep cost entered yet`
           : `Margin ${signed(mg)}. Paid, prep and what it sold for`,
        run: () => figuresSheet(car) });
    }
    acts.push({ label: 'Edit details', icon: 'edit', run: () => openForm(car) });
    if (car.status !== 'sold') {
      acts.push({ label: 'What it cost you', icon: 'pound',
        sub: car.purchase_price == null ? 'Nothing entered yet' : `Paid ${money(car.purchase_price)}${car.prep_cost != null ? ' + ' + money(car.prep_cost) + ' prep' : ', no prep entered'}`,
        run: () => figuresSheet(car) });
    }

    if (car.status !== 'draft') {
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
        run: () => window.open(`../car?id=${encodeURIComponent(car.id)}`, '_blank') });
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
    if (status === 'sold') patch.sold_at = new Date().toISOString();
    if (status === 'available' && car.status === 'sold') patch.sold_at = null;

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

    sheet(markSold ? 'Mark as sold' : 'Your figures', title + ' · never shown on the website', []);
    const saleStart = car.sale_price != null ? car.sale_price : markSold && car.price != null ? car.price : '';
    $('#sheetActions').innerHTML = `
      <div class="card figs">
        ${sold ? `
        <div class="f">
          <label for="fgSale">What it sold for</label>
          <div class="money"><input class="in" id="fgSale" type="number" inputmode="numeric" placeholder="0" value="${esc(saleStart)}"></div>
          ${markSold && car.price != null ? `<span class="hint">Starts at the advertised price (${money(car.price)}). If it went for less, or more, change it.</span>` : ''}
        </div>` : ''}
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
    const summary = () => {
      const paid = val('#fgPaid'), prep = val('#fgPrep');
      const against = sold ? val('#fgSale') : car.price;
      $('#fgNoPrep').classList.toggle('is-on', prep === 0);
      if (paid == null) {
        $('#fgSummary').innerHTML = `<div class="ml-note">Put in what you paid and the margin works itself out.</div>`;
        return;
      }
      const inCar = paid + (prep || 0);
      const mg = against != null ? against - inCar : null;
      $('#fgSummary').innerHTML =
        `<div class="ml ml--total"><span>Total in the car</span><b>${money(inCar)}</b></div>` +
        (mg == null ? '' : `<div class="ml ${mg >= 0 ? 'ml--good' : 'ml--bad'}">
          <span>${sold ? (mg >= 0 ? 'Margin on the sale' : 'Lost on the sale') : (mg >= 0 ? 'Margin at asking price' : 'Short by')}</span>
          <b>${signed(mg)}</b></div>`) +
        (prep == null ? `<div class="ml-note">No prep entered, so this is before prep. Tap “No prep on this one” if there wasn’t any.</div>` : '');
    };
    ['#fgSale', '#fgPaid', '#fgPrep'].forEach(s => { const el = $(s); if (el) el.addEventListener('input', summary); });
    $('#fgNoPrep').onclick = () => { $('#fgPrep').value = '0'; summary(); };
    summary();

    $('#fgSave').onclick = async () => {
      const patch = { purchase_price: val('#fgPaid'), prep_cost: val('#fgPrep') };
      if (sold) patch.sale_price = val('#fgSale');
      const btn = $('#fgSave');
      btn.disabled = true;

      if (markSold) {
        closeSheet();
        await setStatus(car, 'sold', patch);
        if (opts.after) opts.after();
        return;
      }
      const { error } = await sb.from('cars').update(patch).eq('id', car.id);
      btn.disabled = false;
      if (error) return toast('Couldn’t save: ' + error.message);
      closeSheet();
      Object.assign(car, patch);
      syncStats(car);
      renderStock();
      if (state.view === 'data' && stats) renderInsights();
      toast('Figures saved', 'ok');
      if (opts.after) opts.after();
    };
  }

  /** Keep the Insights copy of a car's figures in step without a reload. */
  function syncStats(car) {
    const row = (stats || []).find(s => String(s.car_id) === String(car.id));
    if (!row) return;
    ['status', 'price', 'sold_at', 'purchase_price', 'prep_cost', 'sale_price'].forEach(k => { row[k] = car[k]; });
    row.margin = carMargin(car);
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

  /* ---- Make and model spelling -----------------------------------------
     Plate lookups return capitals ("BMW", "MAZDA CX-3") and title-casing them
     blindly gave "Bmw" and "Cx-3", which then sat in the dropdowns next to the
     proper spelling and stopped your own history and the price book matching.
     Anything we recognise gets its proper spelling; anything we don't is
     title-cased but keeps short and digit-bearing parts in capitals. */
  const keyOf = window.MBU_INSIGHTS ? window.MBU_INSIGHTS.makeKey : s => String(s || '').toLowerCase();
  const modelKeyOf = window.MBU_INSIGHTS ? window.MBU_INSIGHTS.modelKey : s => String(s || '').toLowerCase();

  function smartCase(s) {
    return String(s || '').trim().split(/(\s+|-)/).map(part =>
      /\d/.test(part) || (/^[a-z]{2}$/i.test(part) && part === part.toUpperCase())
        ? part.toUpperCase() : titleCase(part)).join('');
  }

  function canonicalMake(s) {
    if (!s) return s;
    const k = keyOf(s);
    return Object.keys(MODELS).find(m => keyOf(m) === k) || smartCase(s);
  }

  function canonicalModel(make, s) {
    if (!s) return s;
    const k = modelKeyOf(s);
    const known = MODELS[canonicalMake(make)] || [];
    return known.find(m => modelKeyOf(m) === k) || smartCase(s);
  }

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
  state.dataTab = 'cars';

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
    $('#dataBody').innerHTML =
      state.dataTab === 'sold'   ? soldInsights()
      : state.dataTab === 'ageing' ? ageingInsights()
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

    /* The bands follow how fast YOUR cars sell once there's enough history
       (the insight engine works it out, counting unsold cars too). Until
       then, the original 45 / 60 / 90 days. */
    const speed = (analysis && analysis.speed) || { own: false, watchDays: 45, actDays: 60 };
    const watchD = speed.watchDays, actD = speed.actDays, critD = Math.round(actD * 1.5);
    const bandOf = c => c.days_in_stock >= critD ? 'critical'
      : c.days_in_stock >= actD ? 'overdue'
      : c.days_in_stock >= watchD ? 'watch' : 'fine';

    const bands = [
      ['critical', `Over ${critD} days and losing you money`, 'var(--red-600)'],
      ['overdue',  `${actD} to ${critD} days, worth a price review`, 'var(--amber-600)'],
      ['watch',    `${watchD} to ${actD} days, keep an eye on it`, 'var(--ink-2)'],
      ['fine',     'Fresh stock', 'var(--green-600)']
    ];

    const counts = bands.map(([k]) => ageing.filter(c => bandOf(c) === k).length);
    const needsAction = counts[0] + counts[1];
    const haggle = analysis && analysis.haggle;

    const row = c => {
      const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
      const lastChange = c.last_price_change
        ? Math.round((Date.now() - new Date(c.last_price_change)) / 86400000) : null;
      // What you've sold these for, spelling ignored, from the cars themselves
      const soldSame = state.cars.filter(s => s.status === 'sold' && String(s.id) !== String(c.id)
        && keyOf(s.make) === keyOf(c.make) && modelKeyOf(s.model) === modelKeyOf(c.model)
        && (s.sale_price != null || s.price != null));
      const achieved = soldSame.length
        ? Math.round(soldSame.reduce((n, s) => n + (s.sale_price != null ? s.sale_price : s.price), 0) / soldSame.length) : null;
      // Sale prices have the haggle taken off; compare like with like
      const askingEquivalent = achieved != null && haggle && haggle.pct
        ? Math.round(achieved / (1 - haggle.pct / 100) / 10) * 10 : achieved;
      const gapToAvg = (askingEquivalent != null && c.price != null) ? c.price - askingEquivalent : null;

      return `<div class="card" style="margin-bottom:10px"><div style="padding:14px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div style="min-width:0;flex:1">
            <h3 style="font-size:16px;font-weight:700">${esc(title)}</h3>
            <div style="font-size:13.5px;color:var(--ink-3);margin-top:2px">
              ${money(c.price)} · ${nf(c.days_in_stock)} days
              ${c.previous_price ? ' · already reduced from ' + money(c.previous_price) : ''}
            </div>
          </div>
          <span class="pill ${bandOf(c) === 'critical' ? 'pill--red'
                            : bandOf(c) === 'overdue' ? 'pill--amber' : 'pill--grey'}">
            ${c.days_in_stock}d
          </span>
        </div>

        <div style="font-size:14px;color:var(--ink-2);margin-top:10px;line-height:1.6">
          ${achieved != null
            ? `You've sold ${soldSame.length === 1 ? 'one of these' : soldSame.length + ' of these'} for <strong>${money(achieved)}</strong>${soldSame.length === 1 ? '' : ' on average'}${
                haggle && haggle.pct && askingEquivalent !== achieved ? `, about ${money(askingEquivalent)} before your usual ${haggle.pct}% haggle` : ''}.
               ${gapToAvg > 200 ? `This one is <strong style="color:var(--amber-600)">${money(gapToAvg)} above</strong> that.` : ''}`
            : `No history on this model to compare against.`}
          <br>
          ${ageingInterestLine(c)}
          ${lastChange != null ? `<br>Price last changed ${lastChange} days ago.` : '<br>Price never changed.'}
        </div>

        <button class="btn btn--outline btn--sm btn--block" data-reprice="${esc(c.id)}" style="margin-top:12px">
          Change the price
        </button>
      </div></div>`;
    };

    const sections = bands.map(([key, label, colour], i) => {
      const list = ageing.filter(c => bandOf(c) === key);
      if (!list.length || key === 'fine') return '';
      return `<div class="section-card">
        <h2 style="color:${colour}">${label} · ${list.length}</h2>
        ${list.map(row).join('')}
      </div>`;
    }).join('');

    return `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
        ${statTile(counts[0], `Over ${critD} days`, counts[0] ? 'var(--red-600)' : null)}
        ${statTile(counts[1], `${actD} to ${critD} days`, counts[1] ? 'var(--amber-600)' : null)}
        ${statTile(counts[3], 'Fresh', 'var(--green-600)')}
      </div>

      <p class="note" style="margin:0 0 12px">
        ${speed.own
          ? `Three in four of your cars sell within ${watchD} days, so that's where "keep an eye on it" starts.`
          : `Using 45, 60 and 90 days until there's enough selling history to use your own${
              speed.soFar ? ` (so far, ${speed.soFar.soldPct}% of cars sell within ${speed.soFar.days} days)` : ''}.`}
      </p>

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

  /**
   * Interest on an ageing car. People and contacts from the new tracking when
   * it's live, the old page-view counts otherwise. The cause, if any, comes
   * from the insight engine rather than a blanket "that's a price problem".
   */
  function ageingInterestLine(c) {
    const f = analysis && analysis.findings.find(x => String(x.carId) === String(c.id));
    const cause = f && CAUSE_LABEL[f.cause]
      ? ` <strong style="color:${f.severity === 'act' ? 'var(--red-600)' : 'var(--amber-600)'}">${CAUSE_LABEL[f.cause]}.</strong> See the Cars tab.`
      : '';

    if (countingPeople()) {
      const i = interestFor(c.id);
      if (i) {
        const got = Math.max(i.contacted || 0, i.enquiries_since_tracking || 0);
        return `${nf(i.visitors)} ${i.visitors === 1 ? 'person' : 'people'} looked, ${nf(got)} got in touch since ${shortDay(trackStatus.v2_since)}.${cause}`;
      }
    }
    return `${nf(c.views)} page views, ${nf(c.contacts)} taps to get in touch.${cause}`;
  }

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
    const info = (ageing || []).find(c => String(c.id) === String(carId));
    if (!car) return toast('Couldn’t find that car');

    const title = [car.year, car.make, car.model].filter(Boolean).join(' ');
    const avg = info && info.avg_achieved != null ? info.avg_achieved : null;

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

  const INTEREST_SORTS = {
    interest: 'Most interest first', least: 'Least interest first', contact: 'Most contact first',
    oldest: 'Longest in stock', newest: 'Newest in', price_high: 'Price, high to low', price_low: 'Price, low to high'
  };

  function carInsights() {
    const live = stats.filter(c => c.status === 'available' || c.status === 'reserved');
    const sold = stats.filter(c => c.status === 'sold');
    const people = countingPeople();

    const soldWithDays = sold.filter(c => c.days_in_stock != null);
    const avgDays = soldWithDays.length
      ? Math.round(soldWithDays.reduce((n, c) => n + c.days_in_stock, 0) / soldWithDays.length)
      : null;

    if (!stats.length) {
      return `<div class="empty">${icon('car')}<h3>Nothing to show yet</h3>
        <p>Once the website has had a few visitors you'll see which cars people
        are actually looking at.</p></div>`;
    }

    /* Tiles: this week in people once that's being counted, else the old totals */
    let tiles;
    if (people) {
      const liveIds = new Set(live.map(c => String(c.car_id)));
      const liveInterest = interest.filter(r => liveIds.has(String(r.car_id)));
      const week = liveInterest.reduce((n, r) => n + (r.visitors_7d || 0), 0);
      const got = liveInterest.reduce((n, r) => n + (r.contacted_7d || 0), 0);
      tiles = `
        ${statTile(nf(week), 'People this week')}
        ${statTile(nf(got), 'Got in touch', 'var(--green-600)')}
        ${statTile(avgDays != null ? avgDays + 'd' : 'Not yet', 'Avg to sell')}`;
    } else {
      const totalViews = stats.reduce((n, c) => n + (c.views || 0), 0);
      const totalContacts = stats.reduce((n, c) =>
        n + (c.whatsapp_clicks || 0) + (c.phone_clicks || 0) + (c.enquiries || 0), 0);
      tiles = `
        ${statTile(nf(totalViews), 'Page views')}
        ${statTile(nf(totalContacts), 'Taps to contact', 'var(--green-600)')}
        ${statTile(avgDays != null ? avgDays + 'd' : 'Not yet', 'Avg to sell')}`;
    }

    /* Live stock, most interest first unless you've picked another order */
    const legacyById = Object.fromEntries(stats.map(c => [String(c.car_id), c]));
    const looked = x => people ? ((x.i && x.i.visitors) || 0) : (x.c.views || 0);
    const touched = x => people ? ((x.i && Math.max(x.i.contacted || 0, x.i.enquiries_since_tracking || 0)) || 0)
      : (x.c.whatsapp_clicks || 0) + (x.c.phone_clicks || 0) + (x.c.enquiries || 0);
    const order = INTEREST_SORTS[state.interestSort] ? state.interestSort : 'interest';
    const cmp = {
      interest: (a, b) => looked(b) - looked(a) || touched(b) - touched(a),
      least:    (a, b) => looked(a) - looked(b) || touched(a) - touched(b),
      contact:  (a, b) => touched(b) - touched(a) || looked(b) - looked(a),
      oldest:   (a, b) => (b.c.days_in_stock || 0) - (a.c.days_in_stock || 0),
      newest:   (a, b) => (a.c.days_in_stock || 0) - (b.c.days_in_stock || 0),
      price_high: (a, b) => (b.c.price || 0) - (a.c.price || 0),
      price_low:  (a, b) => (a.c.price || 0) - (b.c.price || 0)
    }[order];
    const rows = live.map(c => ({ c, i: people ? interestFor(c.car_id) : null })).sort(cmp)
      .map(({ c, i }) => people && i ? interestRow(c, i, legacyById) : legacyRow(c)).join('');

    return `
      ${marginHero()}

      ${trackingNote()}

      ${decisionsHtml()}

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0">
        ${tiles}
      </div>

      <div class="section-card">
        <div class="card-head">
          <h2>In stock</h2>
          <select class="sel sel--sm" id="interestSort" aria-label="Order the cars by">
            ${Object.entries(INTEREST_SORTS).map(([k, label]) =>
              `<option value="${k}"${k === order ? ' selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        ${rows || '<p class="hint">No cars in stock at the moment.</p>'}
      </div>

      <button class="btn btn--outline btn--block" id="exportCars" style="margin-top:14px">
        Export all car figures (CSV)
      </button>`;
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
    return c.sale_price != null && c.purchase_price != null
      ? c.sale_price - c.purchase_price - (c.prep_cost || 0) : null;
  }

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
        missing: list.length - counted.length
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
      const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
      const haggle = c.price != null && c.sale_price != null && c.price > c.sale_price
        ? ` (${money(c.price - c.sale_price)} off asking)` : '';
      const days = c.sold_at && (c.listed_at || c.created_at)
        ? Math.max(0, Math.round((new Date(c.sold_at) - new Date(c.listed_at || c.created_at)) / 86400000)) : null;
      const bits = [
        'Sold ' + shortDay(c.sold_at),
        c.sale_price != null ? 'for ' + money(c.sale_price) + haggle : null,
        c.purchase_price != null ? 'paid ' + money(c.purchase_price) + (c.prep_cost ? ' + ' + money(c.prep_cost) + ' prep' : ', no prep entered') : null,
        days != null ? days + ' days' : null
      ].filter(Boolean).join(' · ');
      const missing = [c.sale_price == null ? 'what it sold for' : null, c.purchase_price == null ? 'what you paid' : null]
        .filter(Boolean).join(' and ');

      return `<div class="margin-car">
        <strong>${esc(title)}</strong>
        <span class="mc-margin ${mg == null ? 'is-missing' : mg < 0 ? 'is-loss' : ''}">${mg == null ? 'Not counted' : signed(mg)}</span>
        <span class="mc-meta">${esc(bits)}</span>
        <button class="mc-fix" type="button" data-figs="${esc(c.id)}">${
          mg == null ? 'Add ' + esc(missing) : c.prep_cost == null ? 'Add the prep cost' : 'Edit the figures'}</button>
      </div>`;
    }).join('');

    return `<div class="margin-hero">
      <div class="mh-label">Margin in ${esc(f.thisName)} so far</div>
      <div class="mh-figure ${t.total < 0 ? 'is-loss' : ''}">${t.counted ? signed(t.total) : '£0'}</div>
      <div class="mh-compare">${compare}</div>
      ${t.missing ? `<div class="mh-compare" style="margin-top:4px">${t.missing} of ${t.cars.length} sale${t.cars.length === 1 ? '' : 's'} this month ${t.missing === 1 ? 'has' : 'have'} a figure missing, so ${t.missing === 1 ? 'isn’t' : 'aren’t'} counted.</div>` : ''}
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

  /* ---- Is the new tracking actually counting? ----------------------------- */
  function trackingNote() {
    if (countingPeople()) {
      const bots = trackStatus.v2_bot_events || 0;
      return `<p class="note" style="margin:0 0 12px">
        Counting people since ${esc(shortDay(trackStatus.v2_since))}${bots ? `, with ${nf(bots)} bot visit${bots === 1 ? '' : 's'} left out` : ''}.
      </p>`;
    }
    if (interest !== null) {
      return `<p class="note" style="margin:0 0 12px">
        The new tracking is installed but hasn’t counted anyone yet. Until it does, figures below are page views.
      </p>`;
    }
    return '';
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
  const redrawInsights = () => { if (stats) renderInsights(); if (state.view === 'home') renderHome(); };

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

  /* ---- One car's interest, counted in people ------------------------------ */
  function interestRow(c, i, legacyById) {
    const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
    const got = Math.max(i.contacted || 0, i.enquiries_since_tracking || 0);
    const car = state.cars.find(x => String(x.id) === String(c.car_id));
    const photoCount = car && Array.isArray(car.images) ? car.images.length : null;
    const f = analysis && analysis.findings.find(x => String(x.carId) === String(c.car_id));

    const pill = f && f.severity === 'good' ? '<span class="pill pill--green">Hot</span>'
      : f && f.rule === 'no_contact' ? '<span class="pill pill--red">No contact</span>'
      : c.days_in_stock >= 60 ? '<span class="pill pill--amber">Sitting</span>' : '';

    const time = i.median_seconds == null ? 'n/a'
      : i.median_seconds < 60 ? i.median_seconds + 's' : Math.round(i.median_seconds / 60) + 'm';
    const rate = i.visitors ? Math.round(100 * Math.min(got, i.visitors) / i.visitors) + '%' : 'n/a';

    const extra = [
      i.avg_photos_seen != null && photoCount ? `Saw ${Math.round(i.avg_photos_seen)} of ${photoCount} photos on average` : null,
      i.enquiries_total ? `${i.enquiries_total} enquir${i.enquiries_total === 1 ? 'y' : 'ies'} received` : null,
      i.played_video ? `${i.played_video} watched the video` : null
    ].filter(Boolean).join(' · ');
    const legacy = legacyById[String(c.car_id)];
    const before = legacy && legacy.views ? ` (${nf(legacy.views)} page views before ${shortDay(i.tracking_since)})` : '';

    return `<div class="card" style="margin-bottom:10px"><div style="padding:14px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="min-width:0;flex:1">
          <h3 style="font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</h3>
          <div style="font-size:13px;color:var(--ink-3);margin-top:2px">
            ${money(c.price)} · ${nf(c.days_in_stock)} days in stock
          </div>
        </div>
        ${pill}
      </div>
      <div class="interest-grid">
        <div><b>${nf(i.visitors)}</b><span>people</span></div>
        <div><b>${nf(got)}</b><span>got in touch</span></div>
        <div><b>${rate}</b><span>rate</span></div>
        <div><b>${time}</b><span>typical visit</span></div>
      </div>
      ${extra || before ? `<div class="interest-extra">${esc(extra)}${esc(before)}</div>` : ''}
    </div></div>`;
  }

  /* ---- Before the tracking upgrade: page views, as it always was ---------- */
  function legacyRow(c) {
    const title = [c.year, c.make, c.model].filter(Boolean).join(' ') || 'Untitled';
    const contacts = (c.whatsapp_clicks || 0) + (c.phone_clicks || 0) + (c.enquiries || 0);
    const stale = c.days_in_stock >= 60;

    return `<div class="card" style="margin-bottom:10px"><div style="padding:14px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div style="min-width:0;flex:1">
          <h3 style="font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</h3>
          <div style="font-size:13px;color:var(--ink-3);margin-top:2px">
            ${money(c.price)} · ${nf(c.days_in_stock)} days in stock
          </div>
        </div>
        ${stale ? '<span class="pill pill--amber">Sitting</span>'
          : contacts >= 3 ? '<span class="pill pill--green">Hot</span>' : ''}
      </div>
      <div class="interest-grid">
        <div><b>${nf(c.views)}</b><span>page views</span></div>
        <div><b>${nf(c.gallery_opens)}</b><span>photo opens</span></div>
        <div><b>${nf(contacts)}</b><span>taps</span></div>
        <div><b>${c.contact_rate_pct != null ? c.contact_rate_pct + '%' : 'n/a'}</b><span>rate</span></div>
      </div>
    </div></div>`;
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
        missing: list.length - counted.length
      });
    }
    return out;
  }

  function monthTip(d) {
    return `${d.long}${d.current ? ' so far' : ''}: ${signed(d.total)} margin from ${plural(d.sold, 'car')} sold` +
      (d.missing ? `, ${d.missing} not counted (figure missing)` : '') +
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
          if (chart.dataset.action === 'open') return openDataTab('sold', col.dataset.month);
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
    state.dataTab = tab;
    if (month) state.soldMonth = month;
    $$('#dataTabs button').forEach(x => x.classList.toggle('is-on', x.dataset.tab === tab));
    go('data');
  }

  /** Sold cars for the month currently selected, newest first. */
  function soldRows() {
    const all = (stats || [])
      .filter(c => c.status === 'sold' && c.sold_at)
      .sort((a, b) => new Date(b.sold_at) - new Date(a.sold_at));
    return state.soldMonth === 'all'
      ? all
      : all.filter(c => monthKey(c.sold_at) === state.soldMonth);
  }

  function soldInsights() {
    const everySold = (stats || []).filter(c => c.status === 'sold' && c.sold_at);

    if (!everySold.length) {
      return `<div class="empty">${icon('car')}<h3>Nothing sold yet</h3>
        <p>Mark a car as sold and it will show up here with what you made on it.</p></div>`;
    }

    // Month list, newest first, built from what has actually sold
    const months = [...new Set(everySold.map(c => monthKey(c.sold_at)))].sort().reverse();
    if (state.soldMonth !== 'all' && !months.includes(state.soldMonth)) state.soldMonth = 'all';

    const rows      = soldRows();
    const withMargin = rows.filter(c => c.margin != null);
    const missing    = rows.length - withMargin.length;
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
      const flag  = c.margin == null ? '<span class="pill pill--amber">Figure missing</span>'
        : c.prep_cost == null ? '<span class="pill pill--grey">No prep entered</span>' : '';

      return `<button class="card sold-row" type="button" data-figs="${esc(c.car_id)}">
        <div class="sold-top">
          <div>
            <strong>${esc(title)}</strong>
            <div class="sold-when">
              ${esc(when)}${c.days_in_stock != null ? ' · ' + c.days_in_stock + ' days in stock' : ''}
            </div>
          </div>
          <div class="sold-margin ${c.margin == null ? 'is-missing' : good ? 'is-good' : 'is-loss'}">
            ${signed(c.margin)}<small>margin</small>
          </div>
        </div>
        <div class="sold-figs">
          <span>Sold for <strong>${c.sale_price != null ? money(c.sale_price) : 'not entered'}</strong></span>
          <span>Paid <strong>${c.purchase_price != null ? money(c.purchase_price) : 'not entered'}</strong></span>
          <span>Prep <strong>${c.prep_cost != null ? money(c.prep_cost) : 'not entered'}</strong></span>
          ${flag}
          <span class="sold-edit">${icon('edit')} Edit</span>
        </div>
      </button>`;
    }).join('');

    const byMonth = monthlyMargins(12);
    const pace = paceChart();

    return `
      ${byMonth.length ? `<div class="section-card">
        <h2>Margin by month</h2>
        ${barChart(byMonth, { selected: state.soldMonth })}
        <p class="note chart-note">Tap a month to see its sales below.${byMonth.some(d => d.noPrep)
          ? ' Months with sales that have no prep entered are counted before prep.' : ''}</p>
        <details class="chart-table">
          <summary>See these as a table</summary>
          <table>
            <thead><tr><th>Month</th><th>Sold</th><th>Margin</th></tr></thead>
            <tbody>${byMonth.slice().reverse().map(d => `<tr><td>${esc(d.long)}</td><td>${d.sold}</td><td>${signed(d.total)}${
              d.missing || d.noPrep ? `<small>${[d.missing ? d.missing + ' not counted' : '', d.noPrep ? d.noPrep + ' before prep' : ''].filter(Boolean).join(', ')}</small>` : ''}</td></tr>`).join('')}</tbody>
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

    const is = $('#interestSort');
    if (is) is.onchange = () => { state.interestSort = is.value; remember('mbu_interest_sort', is.value); renderInsights(); };

    wireCharts($('#dataBody'));
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
