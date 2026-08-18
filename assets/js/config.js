/* ============================================================================
   MBU CAR SALES — SITE CONFIGURATION
   ----------------------------------------------------------------------------
   This is the ONLY file you need to edit to change business details or to
   connect the website to its backend. Everything else reads from here.

   Setup instructions are in SETUP.md.
   ========================================================================== */

window.MBU_CONFIG = {

  /* ---------------------------------------------------------------------
     1. BUSINESS DETAILS
     Change these and they update everywhere on the site automatically.
     ------------------------------------------------------------------- */
  business: {
    name:        'MBU Car Sales',
    tagline:     'Quality used cars, honestly priced',
    strapline:   'A local business in Newcastle upon Tyne. Hand-picked stock, straight answers, no pressure.',

    // Logo image, relative to the site root. Drop the file in assets/img/ and
    // put its filename here. Leave it as an empty string and the site falls
    // back to the plain "MBU" tile — so a missing file never breaks anything.
    //   logoDark  — optional lighter version for the dark navy footer. If you
    //               leave it blank the footer just reuses the main logo.
    logo:         'assets/img/logo.png',
    logoDark:     '',

    phone:        '+44 7438 510044',   // shown on the site
    phoneDial:    '+447438510044',     // used for tel: links (no spaces)
    whatsapp:     '447438510044',      // international format, NO plus sign
    email:        'mbusales39@gmail.com',

    town:         'Newcastle upon Tyne',
    region:       'Tyne and Wear',
    country:      'United Kingdom',
    // Leave addressLine blank if you would rather not publish the exact lot
    // address. The site will just show the town.
    addressLine:  '',
    postcode:     '',

    // Used as the centre point when the bidding tool searches Auto Trader for
    // comparable cars. Doesn't need to be your exact address.
    searchPostcode: 'NE1 1AA',

    // Optional — leave as empty string to hide the link entirely
    instagram:    'https://www.instagram.com/mbusalesltd/',
    facebook:     '',
    autotrader:   '',

    // Shown on the contact page and in the footer
    openingHours: [
      { day: 'Monday',    hours: '9:00am – 10:00pm' },
      { day: 'Tuesday',   hours: '9:00am – 10:00pm' },
      { day: 'Wednesday', hours: '9:00am – 10:00pm' },
      { day: 'Thursday',  hours: '9:00am – 10:00pm' },
      { day: 'Friday',    hours: '9:00am – 10:00pm' },
      { day: 'Saturday',  hours: '9:00am – 6:00pm'  },
      { day: 'Sunday',    hours: '9:00am – 12:00pm' }
    ],
    // Note shown under the opening hours
    hoursNote: 'Viewings by appointment — please call or message ahead so we can have the car ready for you.',

    // Trust points shown on the homepage. Edit the wording freely.
    // Only claim things that are true.
    promises: [
      { icon: 'shield',  title: 'HPI checked',        text: 'Every car is HPI checked before it goes on sale, and we tell you up front if it has been repaired.' },
      { icon: 'spanner', title: 'Prepared properly',  text: 'Serviced, MOT’d and road-tested by us before it is handed over. We fix things before you see them, not after.' },
      { icon: 'tag',     title: 'Priced to be fair',  text: 'We buy well and pass the saving on. What you see is what you pay — no admin fees, no surprises.' },
      { icon: 'people',  title: 'You deal with us',   text: 'Father and son, no sales team, no commission chasing. The person you speak to is the person who prepared the car.' }
    ],

    // Set to your real trading start year, or leave null to hide
    tradingSince: null
  },

  /* ---------------------------------------------------------------------
     2. SUPABASE (the car database)
     From Supabase → Settings → General (for the Project ID) and
     Settings → API Keys (for the publishable key).

     The publishable key is SAFE to publish — Supabase's own dashboard says
     so. The database rules control what it can do: read published cars and
     accept enquiries. Nothing else.

     ⚠️ NEVER put the "Secret key" (sb_secret_...) in this file.
     ------------------------------------------------------------------- */
  supabase: {
    // Project Settings → General → Project ID, wrapped like this:
    //   https://<project-id>.supabase.co
    // (Also shown in full under Data API in the sidebar.)
    url: 'https://ubdjhuaewyfezprlxbcl.supabase.co',

    // Project Settings → API Keys → "Publishable key"
    // Starts with  sb_publishable_...
    // This one is MEANT to be public — the database rules control what it can do.
    publishableKey: 'sb_publishable_gPsg7GxMb-CxayQpqAIg1g_OZFTBWdT',

    // Only if your project is old enough to still use the legacy key
    // (the long one starting eyJ...). Leave blank otherwise.
    // Supabase are retiring these at the end of 2026.
    anonKey: ''
  },

  /* ---------------------------------------------------------------------
     3. CLOUDINARY (the photo storage)
     From Cloudinary → Settings. The upload preset must be "unsigned".
     ------------------------------------------------------------------- */
  cloudinary: {
    cloudName:    'dwikz6ft',            // e.g. 'mbucarsales'
    uploadPreset: 'mbu_cars',    // create this in Cloudinary, set mode: unsigned
    folder:       'mbu-cars'
  },

  /* ---------------------------------------------------------------------
     4. ENQUIRY EMAIL NOTIFICATIONS (optional but recommended)
     Get a free access key from https://web3forms.com — just enter your
     email address, no account needed. Enquiries are saved in the admin app
     either way; this simply also pings your inbox.
     ------------------------------------------------------------------- */
  web3formsKey: '852cee44-007a-4df6-be6a-0a997bab0de6',

  /* ---------------------------------------------------------------------
     4a. WARRANTY  —  OFF until you tell me what you actually offer
     ---------------------------------------------------------------------
     Deliberately switched off. Publishing a guarantee you haven't actually
     agreed to is a promise you'd be legally held to, so this is left blank
     rather than filled with something plausible.

     To switch on: set enabled to true and describe exactly what you give.
     Only claim what you will genuinely honour.
     ------------------------------------------------------------------- */
  warranty: {
    enabled: false,
    label:   '',   // e.g. '3 month engine & gearbox warranty'
    detail:  '',   // e.g. 'Covers major mechanical failure of the engine and
                   //       gearbox for 3 months from collection. Ask us for
                   //       the full terms before you buy.'
    // Optional: only show the warranty on cars above this price
    minPrice: 0
  },

  /* ---------------------------------------------------------------------
     4b. FINANCE  —  OFF, and read this before switching it on
     ---------------------------------------------------------------------
     ⚠️  Arranging, brokering or introducing customers to vehicle finance is
     a REGULATED ACTIVITY in the UK. Doing it without FCA authorisation (or
     without being an appointed representative of an authorised firm) is a
     criminal offence, not a paperwork slip.

     With this switched on, the website does ONE thing: records that a
     customer said they'd be interested. It gives no quotes, makes no
     introductions and mentions no lenders. That is information gathering,
     so you can judge whether the demand justifies getting authorised or
     partnering with a broker who already is.

     Take proper advice before you act on any of these enquiries.
     ------------------------------------------------------------------- */
  finance: {
    enabled: false
  },

  /* ---------------------------------------------------------------------
     4c. AUTO TRADER CONNECT  (not switched on yet)
     Leave this alone until your Account Manager has enabled direct API
     access and you've been through their "Go Live checks".
     See ROADMAP.md section 4 for exactly what to ask them.
     ------------------------------------------------------------------- */
  autotrader: {
    enabled:      false,
    advertiserId: '',      // your Auto Trader advertiser ID
    maxAdverts:   8        // your current package allowance
  },

  /* ---------------------------------------------------------------------
     5. SITE BEHAVIOUR
     ------------------------------------------------------------------- */
  options: {
    // Sold cars stay visible in the stock list for this many days, mixed in
    // with available stock but clearly marked as sold. The database also
    // enforces a 45-day cut-off, so raising this above 45 has no effect —
    // change the `cars_public` view in supabase/schema-v4-pricing-video.sql too.
    soldVisibleDays: 45,

    // Sold prices are hidden by the DATABASE, not by this setting — the
    // `cars_public` view returns null for them, so the figure never reaches
    // the browser at all. Left here as a reminder of the intent.
    hideSoldPrices: true,
    // Cars shown on the homepage
    featuredCount: 6,
    // Show a "Reserved" badge instead of hiding reserved cars
    showReserved: true,
    // Canonical site address, used for sharing links. Update if you buy a domain.
    siteUrl: 'https://mbucarsales.github.io',

    // Share car links as /c/<id>/ — pre-rendered pages that show the actual
    // car when forwarded on WhatsApp or Facebook. Requires the
    // "Build shareable car pages" GitHub Action to be running.
    // Set to false to fall back to car.html?id=... links.
    sharePages: true
  }
};
