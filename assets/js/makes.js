/* ============================================================================
   MBU CAR SALES / MAKES AND MODELS
   One list of makes and models, and one idea of how each is spelt, shared by
   the website and the admin app. Loaded by both, before data.js / app.js.

   Makes and models are typed by hand and come back from plate lookups in
   capitals, so the database holds "BMW" and "Bmw", "Mercedes" and
   "Mercedes-Benz", "Cx-3" and "CX-3". Here they are all the same car:
     · the website shows one spelling (so the search drop-downs list BMW once)
     · the admin app saves the proper spelling, and offers to tidy old records
   Matching ignores spelling throughout; the insight engine has its own copy
   of makeKey/modelKey (it also runs in Node) and the two must agree.
   ========================================================================== */
(function (root) {
  'use strict';

  /* --------------------------------------------------------------------------
     Just a starting list so the admin drop-downs are useful on day one.
     Anything typed in the app, and anything the plate lookup returns, is added
     to the drop-downs automatically, so it learns what you actually sell.
     Add to it freely. Order does not matter, it is sorted before it is shown.

     Spelling here is what gets shown and saved. Citroen and Skoda are written
     without accents, as Auto Trader and the DVLA write them.
     -------------------------------------------------------------------------- */
  const MODELS = {
    'Abarth':        ['500','595','695','124 Spider'],
    'Alfa Romeo':    ['Giulia','Giulietta','Mito','Stelvio','Tonale'],
    'Audi':          ['A1','A3','A4','A5','A6','A7','A8','Q2','Q3','Q5','Q7','Q8','TT','R8','e-tron','S3','RS3'],
    'BMW':           ['1 Series','2 Series','3 Series','4 Series','5 Series','6 Series','7 Series','8 Series',
                      'X1','X2','X3','X4','X5','X6','X7','Z4','i3','i4','iX','M2','M3','M4'],
    'Citroen':       ['C1','C3','C3 Aircross','C4','C4 Cactus','C5 Aircross','Berlingo','DS3'],
    'Cupra':         ['Ateca','Born','Formentor','Leon'],
    'Dacia':         ['Sandero','Duster','Jogger','Logan'],
    'Fiat':          ['500','500L','500X','Panda','Punto','Tipo','Doblo'],
    'Ford':          ['Fiesta','Focus','Puma','Kuga','EcoSport','Mondeo','C-Max','S-Max','Galaxy','Ka',
                      'B-Max','Mustang','Ranger','Transit','Transit Custom','Transit Connect','Tourneo'],
    'Honda':         ['Jazz','Civic','CR-V','HR-V','Accord','e'],
    'Hyundai':       ['i10','i20','i30','i40','ix20','ix35','Tucson','Santa Fe','Kona','Ioniq','Ioniq 5','Bayon'],
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
    'Skoda':         ['Citigo','Fabia','Scala','Octavia','Superb','Kamiq','Karoq','Kodiaq','Enyaq','Yeti','Rapid'],
    'Smart':         ['ForTwo','ForFour'],
    'Subaru':        ['Impreza','Forester','Outback','XV'],
    'Suzuki':        ['Swift','Vitara','S-Cross','Ignis','Jimny','Celerio'],
    'Tesla':         ['Model 3','Model Y','Model S','Model X'],
    'Toyota':        ['Aygo','Yaris','Corolla','Auris','C-HR','RAV4','Prius','Hilux','Proace','Land Cruiser'],
    'Vauxhall':      ['Corsa','Astra','Insignia','Adam','Viva','Crossland','Crossland X','Grandland','Grandland X',
                      'Mokka','Mokka X','Zafira','Meriva','Antara','Vivaro','Combo','Movano'],
    'Volkswagen':    ['up!','Polo','Golf','Golf SV','Passat','CC','Arteon','T-Cross','T-Roc','Tiguan','Touareg',
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

  /* ---- Keys: what two spellings must share to be the same thing ----------
     Same as insights-engine.js. Accents, case, spaces and dashes ignored, and
     the nicknames people actually type. */
  const MAKE_ALIASES = { mercedes: 'mercedesbenz', merc: 'mercedesbenz', mb: 'mercedesbenz',
                         vw: 'volkswagen', landrover: 'landrover', rangerover: 'landrover' };
  const squash = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  const makeKey = s => { const k = squash(s); return MAKE_ALIASES[k] || k; };
  const modelKey = s => squash(s).replace(/class$/, '');   // "A Class" = "A-Class" = "A"

  const MAKE_BY_KEY = {};
  Object.keys(MODELS).forEach(m => { MAKE_BY_KEY[makeKey(m)] = m; });

  /** The proper spelling of a make we know, or null. "Bmw" → "BMW", "merc" → "Mercedes-Benz". */
  function knownMake(s) {
    return s ? MAKE_BY_KEY[makeKey(s)] || null : null;
  }

  /** The proper spelling of a model we know for that make, or null. "Cx-3" → "CX-3". */
  function knownModel(make, s) {
    if (!s) return null;
    const k = modelKey(s);
    return (MODELS[knownMake(make)] || []).find(m => modelKey(m) === k) || null;
  }

  /** Title case that leaves short codes and anything with a digit in capitals: "MAZDA CX-3" → "Mazda CX-3". */
  function smartCase(s) {
    return String(s || '').trim().split(/(\s+|-)/).map(part =>
      /\d/.test(part) || (/^[a-z]{2}$/i.test(part) && part === part.toUpperCase())
        ? part.toUpperCase()
        : part.replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase())).join('');
  }

  /** For saving: the proper spelling if we know it, otherwise tidied up. */
  const canonicalMake = s => !s ? s : knownMake(s) || smartCase(s);
  const canonicalModel = (make, s) => !s ? s : knownModel(make, s) || smartCase(s);

  /** For showing: the proper spelling if we know it, otherwise exactly as typed. */
  const makeName = s => !s ? s : knownMake(s) || String(s).trim();
  const modelName = (make, s) => !s ? s : knownModel(make, s) || String(s).trim();

  /* ---- Trims in capitals --------------------------------------------------
     Plate lookups give "1.0 VVT-I X-CITE 2 X-SHIFT AUTOMATIC". The website
     shows "X-Cite 2 X-Shift Automatic". Only words written entirely in
     capitals change; short codes (TDI, AMG, SE, DSG), anything with a digit,
     and the longer codes below stay as they are. Display only. */
  const TRIM_CODES = new Set(['VTEC', 'TDCI', 'CRDI', 'TFSI', 'CDTI', 'JTDM', 'MHEV', 'PHEV', 'ULEZ',
                              'DOHC', 'SOHC', 'VVTI', 'TSFI', 'HDIF']);
  const TRIM_WORDS = { BLUEHDI: 'BlueHDi', ECOBOOST: 'EcoBoost', BLUEMOTION: 'BlueMotion', XDRIVE: 'xDrive',
                       SDRIVE: 'sDrive', ECOTEC: 'ecoTEC', SKYACTIV: 'Skyactiv', CARPLAY: 'CarPlay' };
  function tidyTrim(s) {
    if (!s) return s;
    return String(s).replace(/[A-Za-z0-9]+/g, w => {
      if (/[a-z\d]/.test(w) || w.length <= 3) return w;
      if (TRIM_WORDS[w]) return TRIM_WORDS[w];
      if (TRIM_CODES.has(w)) return w;
      return w[0] + w.slice(1).toLowerCase();
    });
  }

  /* ---- Tidying old records (admin: Home → spellings to tidy) -------------- */

  /** Edit distance, stopping early once it's clearly more than `max`. */
  function distance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  /** The one known name a letter away from this one ("Hazz" → "Jazz"), or null. Short names are too easy to get wrong. */
  function nearest(s, names, keyOf) {
    const k = keyOf(s);
    if (k.length < 4) return null;
    const hits = names.filter(n => { const nk = keyOf(n); return nk.length >= 4 && distance(k, nk, 1) === 1; });
    return hits.length === 1 ? hits[0] : null;
  }

  /**
   * A model with the trim stuck on the end: "1 Series 116i" → "1 Series" + "116i",
   * "A220" → "A Class" + "A220", "320d" → "3 Series" + "320d".
   */
  function splitModel(make, model, known) {
    const text = String(model).trim();
    if (make === 'Mercedes-Benz') {
      const m = text.match(/^([A-Z])\s*-?\s*\d{3}[a-z]*$/i);
      const cls = m && known.find(k => k === m[1].toUpperCase() + ' Class');
      if (cls) return { model: cls, extra: text.replace(/\s|-/g, '').toUpperCase().replace(/([A-Z])$/, c => c.toLowerCase()) };
    }
    if (make === 'BMW') {
      const m = text.match(/^(\d)\d{2}[a-z]{1,2}$/i);
      const series = m && known.find(k => k === m[1] + ' Series');
      if (series) return { model: series, extra: text.toLowerCase() };
    }
    const words = text.split(/\s+/);
    for (let n = words.length - 1; n >= 1; n--) {
      const head = modelKey(words.slice(0, n).join(' '));
      const hit = known.find(k => modelKey(k) === head);
      if (hit) return { model: hit, extra: words.slice(n).join(' ') };
    }
    return null;
  }

  /**
   * What would tidy a car's make and model, or null if they're fine.
   * @returns {{make, model, variant, changes: string[], guess: boolean}|null}
   *   guess is true when it's a likely typo rather than a certain respelling
   */
  function spellingFix(car) {
    if (!car || !car.make) return null;
    const changes = [];
    let guess = false;

    let make = knownMake(car.make);
    if (!make) {
      make = nearest(car.make, Object.keys(MODELS), makeKey);
      if (make) guess = true;
    }
    if (!make) return null;          // a make we don't know: nothing to compare it with
    if (make !== car.make) changes.push(`${String(car.make).trim()} → ${make}`);

    const known = MODELS[make] || [];
    let model = car.model, variant = car.variant || null;
    if (model) {
      const exact = known.find(k => modelKey(k) === modelKey(model));
      const split = !exact && splitModel(make, model, known);
      const near = !exact && !split && nearest(model, known, modelKey);
      if (exact && exact !== model) {
        changes.push(`${model} → ${exact}`);
        model = exact;
      } else if (split) {
        changes.push(`${model} → ${split.model}, with ${split.extra} in the trim`);
        if (!squash(variant).startsWith(squash(split.extra))) variant = [split.extra, variant].filter(Boolean).join(' ');
        model = split.model;
      } else if (near) {
        changes.push(`${model} → ${near}`);
        model = near;
        guess = true;
      }
    }
    return changes.length ? { make, model, variant, changes, guess } : null;
  }

  const api = { MODELS, makeKey, modelKey, squash, knownMake, knownModel, smartCase,
                canonicalMake, canonicalModel, makeName, modelName, tidyTrim, spellingFix };
  root.MBU_MAKES = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
