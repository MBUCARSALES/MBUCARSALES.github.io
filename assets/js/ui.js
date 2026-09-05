/* ============================================================================
   MBU CAR SALES / SHARED UI
   Header, footer, mobile nav, car cards, scroll reveal.
   Every page includes this so the navigation only ever needs editing once.
   ========================================================================== */
(function () {
  'use strict';

  const CFG = window.MBU_CONFIG;
  const B = CFG.business;
  const MBU = window.MBU;
  const icon = MBU.icon;
  const esc = MBU.esc;

  const NAV = [
    { href: 'index.html',   label: 'Home' },
    { href: 'stock.html',   label: 'Our Stock' },
    { href: 'wanted.html',  label: 'Car Finder' },
    { href: 'sell.html',    label: 'Sell Your Car' },
    { href: 'contact.html', label: 'Contact' }
  ];

  /* Every internal link below goes through MBU.link(). On the pre-rendered
     share pages at /c/<id>/ that prefixes them with '/', without which they
     resolve inside that folder and 404. The header nav was already doing this;
     the mobile menu and the footer list were not, so on a car link forwarded
     over WhatsApp and opened on a phone (where the hamburger IS the whole
     navigation) every menu item was dead. */
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const isActive = href => href === page || (page === '' && href === 'index.html');

  /* -------------------------------------------------------------- BRANDING */
  /**
   * The brand lock-up used in the header and the footer.
   *
   * If a logo file is set in config it is used, and the old "MBU" tile plus
   * the name is kept in the markup as a fallback. If the image ever fails to
   * load, `onerror` swaps the text version back in rather than leaving a gap.
   * With no logo configured at all you just get the text version, exactly as
   * the site looked before.
   *
   * @param {'header'|'footer'} where
   */
  function brand(where) {
    const src = where === 'footer' ? (B.logoDark || B.logo) : B.logo;
    const textMark = `
      <span class="brand-mark">MBU</span>
      <span class="brand-text">
        <span class="brand-name">${esc(B.name)}</span>
        <span class="brand-sub">${esc(B.town)}</span>
      </span>`;

    if (!src) return textMark;

    // The footer is dark navy and the logo is navy artwork, so unless a light
    // version has been supplied it sits on a white chip to stay readable.
    const onDark = where === 'footer' && !B.logoDark ? ' brand-logo--onDark' : '';

    return `
      <img class="brand-logo${onDark}" src="${esc(MBU.link(src))}" alt="${esc(B.name)}"
           onerror="this.onerror=null;this.remove();
                    this.closest('.brand').classList.remove('brand--logo')">
      <span class="brand-fallback">${textMark}</span>`;
  }

  const brandClass = B.logo ? 'brand brand--logo' : 'brand';

  /* Social and marketplace links. Each one only appears if it is filled in
     in config.js, so leaving one blank hides its button everywhere. */
  const igLink = (B.instagram || '').trim();
  const atLink = (B.autotrader || '').trim();

  /* ------------------------------------------------------------------ HEADER */
  function header() {
    return `
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header" id="siteHeader">
      <div class="container header-inner">
        <a class="${brandClass}" href="${MBU.link('index.html')}" aria-label="${esc(B.name)} home">
          ${brand('header')}
        </a>

        <nav class="nav" aria-label="Main">
          ${NAV.map(n => `<a href="${MBU.link(n.href)}"${isActive(n.href) ? ' class="is-active" aria-current="page"' : ''}>${n.label}</a>`).join('')}
        </nav>

        <div class="header-cta">
          <a class="btn btn--outline btn--sm" href="${MBU.telLink()}">
            ${icon('phone')}<span>${esc(B.phone)}</span>
          </a>
          ${atLink ? `<a class="btn btn--at btn--sm" href="${esc(atLink)}"
             target="_blank" rel="noopener" aria-label="Our cars on Auto Trader">
            ${icon('car')}<span class="hide-sm">Auto Trader</span>
          </a>` : ''}
          <a class="btn btn--wa btn--sm" href="${MBU.waLink('Hi MBU Car Sales, I have a question about a car.')}"
             target="_blank" rel="noopener">
            ${icon('whatsapp')}<span class="hide-sm">WhatsApp</span>
          </a>
          ${igLink ? `<a class="btn btn--ig btn--sm" href="${esc(igLink)}"
             target="_blank" rel="noopener" aria-label="MBU Car Sales on Instagram">
            ${icon('instagram')}<span class="hide-sm">Instagram</span>
          </a>` : ''}
        </div>

        <button class="nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">
          ${icon('menu')}
        </button>
      </div>
    </header>

    <div class="mobile-nav" id="mobileNav" hidden>
      <div class="mobile-nav-panel" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="mobile-nav-head">
          <span class="brand-name">Menu</span>
          <button class="nav-toggle" id="navClose" aria-label="Close menu">${icon('close')}</button>
        </div>
        ${NAV.map(n => `<a class="m-link" href="${MBU.link(n.href)}">${n.label}</a>`).join('')}
        <div class="mobile-nav-foot">
          <a class="btn btn--wa btn--block" target="_blank" rel="noopener"
             href="${MBU.waLink('Hi MBU Car Sales, I have a question about a car.')}">
            ${icon('whatsapp')} Message on WhatsApp
          </a>
          <a class="btn btn--outline btn--block" href="${MBU.telLink()}">
            ${icon('phone')} ${esc(B.phone)}
          </a>
          ${atLink ? `<a class="btn btn--at btn--block" href="${esc(atLink)}"
             target="_blank" rel="noopener">
            ${icon('car')} See our cars on Auto Trader
          </a>` : ''}
          ${igLink ? `<a class="btn btn--ig btn--block" href="${esc(igLink)}"
             target="_blank" rel="noopener">
            ${icon('instagram')} Follow us on Instagram
          </a>` : ''}
        </div>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------------ FOOTER */
  function footer() {
    const socials = [
      B.instagram && { href: B.instagram, icon: 'instagram', label: 'Instagram' },
      B.facebook && { href: B.facebook, icon: 'facebook', label: 'Facebook' },
      B.autotrader && { href: B.autotrader, icon: 'car', label: 'Our cars on Auto Trader' }
    ].filter(Boolean);

    const location_ = [B.addressLine, B.town, B.postcode, B.region]
      .filter(Boolean).map(l => `<span>${esc(l)}</span>`).join('<br>');

    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div class="footer-brand">
            <a class="${brandClass}" href="${MBU.link('index.html')}">
              ${brand('footer')}
            </a>
            <p class="footer-blurb">${esc(B.strapline)}</p>
            ${socials.length ? `<div class="social-row">
              ${socials.map(s => `<a href="${s.href}" target="_blank" rel="noopener" aria-label="${s.label}">${icon(s.icon)}</a>`).join('')}
            </div>` : ''}
          </div>

          <div>
            <h4>Browse</h4>
            <ul class="footer-links">
              ${NAV.map(n => `<li><a href="${MBU.link(n.href)}">${n.label}</a></li>`).join('')}
            </ul>
          </div>

          <div>
            <h4>Get in touch</h4>
            <ul class="footer-links">
              <li><a href="${MBU.telLink()}">${esc(B.phone)}</a></li>
              <li><a href="mailto:${esc(B.email)}">${esc(B.email)}</a></li>
              <li><a href="${MBU.waLink('Hi MBU Car Sales,')}" target="_blank" rel="noopener">WhatsApp us</a></li>
              <li style="margin-top:8px;line-height:1.7">${location_}</li>
            </ul>
          </div>

          <div>
            <h4>Opening hours</h4>
            <ul class="footer-hours">
              ${B.openingHours.map(h => `<li><span>${h.day}</span><span>${h.hours}</span></li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="footer-bar">
          <span>© ${new Date().getFullYear()} ${esc(B.name)}. All rights reserved.</span>
          <div class="footer-bar-links">
            <a href="${MBU.link('privacy.html')}">Privacy</a>
            <a href="${MBU.link('terms.html')}">Terms</a>
            <a href="${MBU.link('contact.html')}">Contact</a>
          </div>
        </div>
      </div>
    </footer>

    <div class="mobile-bar mobile-bar--${2 + (igLink ? 1 : 0) + (atLink ? 1 : 0)}">
      <a class="btn btn--wa" href="${MBU.waLink('Hi MBU Car Sales,')}" target="_blank" rel="noopener">
        ${icon('whatsapp')} WhatsApp
      </a>
      <a class="btn btn--primary" href="${MBU.telLink()}">${icon('phone')} Call us</a>
      ${igLink ? `<a class="btn btn--ig mobile-bar-icon" href="${esc(igLink)}"
         target="_blank" rel="noopener" aria-label="MBU Car Sales on Instagram">
        ${icon('instagram')}
      </a>` : ''}
      ${atLink ? `<a class="btn btn--at mobile-bar-icon" href="${esc(atLink)}"
         target="_blank" rel="noopener" aria-label="Our cars on Auto Trader">
        ${icon('car')}
      </a>` : ''}
    </div>`;
  }

  /* -------------------------------------------------------------- CAR CARD */
  /**
   * @param {object} car
   * @param {object} opts  { sold:boolean }
   */
  MBU.carCard = function (car, opts) {
    opts = opts || {};
    const sold = opts.sold || car.status === 'sold';
    const reserved = car.status === 'reserved';
    const title = MBU.fmt.title(car);
    const sub = MBU.fmt.subtitle(car);
    const photos = (car.images || []).length;

    const reduced = !sold && car.previous_price && car.price != null
                    && car.previous_price > car.price;

    const flags = [];
    if (sold) flags.push('<span class="badge badge--solid">SOLD</span>');
    else if (reserved) flags.push('<span class="badge badge--amber badge--dot">Reserved</span>');
    if (reduced) flags.push('<span class="badge badge--red">Reduced</span>');
    if (car.featured && !sold && !reduced) flags.push('<span class="badge badge--accent">Pick of the stock</span>');
    if (car.hpi_status && car.hpi_status !== 'clear' && !sold) {
      flags.push(`<span class="badge badge--blue">${esc(MBU.label('hpi', car.hpi_status).split(' (')[0])}</span>`);
    }

    const specs = [
      car.year && { i: 'calendar', t: car.year },
      car.mileage != null && { i: 'gauge', t: MBU.fmt.milesShort(car.mileage) + ' mi' },
      car.fuel && { i: 'fuel', t: MBU.label('fuel', car.fuel) },
      car.transmission && { i: 'gearbox', t: MBU.label('transmission', car.transmission) }
    ].filter(Boolean);

    // Sold cars sit in the same grid as available stock, so the sold state has
    // to be unmissable: greyed photo, a SOLD flash across the image, and
    // "Register interest" exactly where the price would otherwise be. Nobody
    // should be able to mistake one for something they can buy.
    const priceBlock = sold
      ? `<div class="car-price car-price--sold">Now sold${car.sold_at ? `<small>${esc(MBU.fmt.ago(car.sold_at))}</small>` : ''}</div>`
      : `<div class="car-price">${MBU.fmt.price(car.price)}${
          reduced ? `<small class="was-price">was ${MBU.fmt.price(car.previous_price)}</small>` : ''
        }</div>`;

    const href = MBU.link(`car.html?id=${encodeURIComponent(car.id)}`);

    return `
    <a class="car-card${sold ? ' car-card--sold' : ''}" href="${href}"
       data-car-id="${esc(car.id)}">
      <div class="car-card-media">
        ${MBU.imgTag(car.images && car.images[0], 'card', title)}
        ${sold ? '<span class="sold-flash">SOLD</span>' : ''}
        ${flags.length ? `<div class="car-card-flags">${flags.join('')}</div>` : ''}
        ${MBU.hasVideo(car) ? '<span class="car-card-video">▶ Video</span>' : ''}
        ${photos > 1 ? `<span class="car-card-count">${icon('camera')} ${photos}</span>` : ''}
      </div>
      <div class="car-card-body">
        <div>
          <div class="car-card-title">${esc(title)}</div>
          ${sub ? `<div class="car-card-variant">${esc(sub)}</div>` : ''}
        </div>
        <ul class="car-card-specs">
          ${specs.map(s => `<li>${icon(s.i)}${esc(s.t)}</li>`).join('')}
        </ul>
        <div class="car-card-foot">
          ${priceBlock}
          <span class="car-card-cta${sold ? ' car-card-cta--interest' : ''}">
            ${sold ? 'Want one like this?' : 'View details'}${icon('chevronR')}
          </span>
        </div>
      </div>
    </a>`;
  };

  /**
   * Count a click through from any listing grid. One listener for the whole
   * grid rather than one per card.
   */
  MBU.trackGrid = function (root) {
    (root || document).addEventListener('click', e => {
      const card = e.target.closest('.car-card[data-car-id]');
      if (card) MBU.track('card_click', card.dataset.carId);
    }, { capture: true });
  };

  MBU.skeletonCards = function (n) {
    return Array.from({ length: n || 6 }, () => `
      <div class="skel-card">
        <div class="skeleton" style="aspect-ratio:4/3"></div>
        <div style="padding:16px;display:grid;gap:10px">
          <div class="skeleton" style="height:20px;width:70%"></div>
          <div class="skeleton" style="height:14px;width:45%"></div>
          <div class="skeleton" style="height:14px;width:90%"></div>
          <div class="skeleton" style="height:28px;width:40%;margin-top:6px"></div>
        </div>
      </div>`).join('');
  };

  MBU.emptyState = function (title, text, ctaHtml) {
    return `<div class="empty-state">
      ${icon('car')}
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${ctaHtml || ''}
    </div>`;
  };

  /**
   * Shown when the database can't be reached. Never pretends there is no
   * stock. It tells the customer the website is at fault and gives them
   * a way to reach us anyway, which is the only thing that matters here.
   */
  MBU.loadErrorState = function () {
    return `<div class="empty-state">
      ${icon('phone')}
      <h3>We can’t load our stock list right now</h3>
      <p>Something on our end isn’t responding, sorry about that. We do have cars
         available, so please give us a ring or send a message and we’ll tell you
         exactly what’s on the forecourt today.</p>
      <div class="cluster" style="justify-content:center">
        <a class="btn btn--wa" target="_blank" rel="noopener"
           href="${MBU.waLink('Hi MBU Car Sales, your website isn’t showing your stock. What have you got available?')}">
          ${icon('whatsapp')} Message us on WhatsApp</a>
        <a class="btn btn--outline" href="${MBU.telLink()}">${icon('phone')} ${esc(B.phone)}</a>
      </div>
    </div>`;
  };

  /* ------------------------------------------------------------ BEHAVIOURS */
  function wireNav() {
    const nav = document.getElementById('mobileNav');
    const openBtn = document.getElementById('navToggle');
    const closeBtn = document.getElementById('navClose');
    if (!nav || !openBtn) return;

    const open = () => {
      nav.hidden = false;
      requestAnimationFrame(() => nav.classList.add('is-open'));
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      nav.classList.remove('is-open');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(() => { nav.hidden = true; }, 280);
    };
    openBtn.addEventListener('click', open);
    closeBtn && closeBtn.addEventListener('click', close);
    nav.addEventListener('click', e => { if (e.target === nav) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) close(); });
  }

  function wireStickyHeader() {
    const h = document.getElementById('siteHeader');
    if (!h) return;
    const onScroll = () => h.classList.toggle('is-stuck', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  MBU.reveal = function (root) {
    const els = MBU.qsa('.reveal', root || document).filter(e => !e.classList.contains('is-in'));
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        setTimeout(() => el.classList.add('is-in'), Math.min(i * 60, 300));
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    els.forEach(e => io.observe(e));
  };

  /* ------------------------------------------------------------------ BOOT */
  function boot() {
    const h = document.getElementById('site-header-slot');
    const f = document.getElementById('site-footer-slot');
    if (h) h.outerHTML = header();
    if (f) f.outerHTML = footer();

    document.title = document.title.replace('%SITE%', B.name);
    wireNav();
    wireStickyHeader();
    MBU.reveal();

    // Friendly warning in the console while the backend isn't wired up yet
    if (!MBU.hasBackend) {
      console.info('%c[MBU] Demo mode. Showing example cars. Add your Supabase details in assets/js/config.js to go live.',
        'background:#12203A;color:#8FB4EA;padding:4px 8px;border-radius:4px');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
