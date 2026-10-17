/* =============================================================
   THE UNDERCUT PROJECT — site scripts
   Sections: config · navigation · reveal · career data ·
             mentoring (pricing, availability, calendar, booking) ·
             contact form · helpers
   ============================================================= */
(function () {
  'use strict';

  /* ---------- phone: country code dropdown with flags ---------- */
  const flagEmoji = (iso) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
  const flagImg = (iso) => `<img class="phone__flag" data-iso="${iso}" src="https://flagcdn.com/w40/${iso.toLowerCase()}.png" srcset="https://flagcdn.com/w80/${iso.toLowerCase()}.png 2x" width="20" height="15" alt="" loading="lazy">`;
  const flagFallback = (e) => { const img = e.target; if (img && img.tagName === 'IMG' && img.dataset.iso) { const sp = document.createElement('span'); sp.className = 'phone__flag phone__flag--emoji'; sp.textContent = flagEmoji(img.dataset.iso); img.replaceWith(sp); } };
  function phoneValue(sel) { const input = $(sel); if (!input) return ''; const n = input.value.trim(); return n ? `${input.dataset.dial || ''} ${n}`.trim() : ''; }
  function initPhone(input) {
    const codes = window.DIAL_CODES || []; if (!codes.length) return;
    const region = ((navigator.language || '').split('-')[1] || '').toUpperCase();
    let current = codes.find((c) => c[0] === region) || codes.find((c) => c[0] === 'ES');
    const wrap = document.createElement('div'); wrap.className = 'phone'; input.parentNode.insertBefore(wrap, input);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'phone__code'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div'); menu.className = 'phone__menu'; menu.hidden = true;
    menu.innerHTML = '<input type="search" class="phone__search" placeholder="Search country or code" aria-label="Search country" autocomplete="off"><ul class="phone__list" role="listbox"></ul>';
    wrap.append(btn, menu, input);
    wrap.addEventListener('error', flagFallback, true);
    const search = $('.phone__search', menu), list = $('.phone__list', menu);
    const paint = () => { btn.innerHTML = `${flagImg(current[0])}<span class="phone__dial">${current[2]}</span><span class="phone__caret" aria-hidden="true"></span>`; btn.setAttribute('aria-label', `Country code: ${current[1]} ${current[2]}`); input.dataset.dial = current[2]; };
    const render = (q) => {
      const t = (q || '').trim().toLowerCase();
      const rows = codes.filter((c) => !t || c[1].toLowerCase().includes(t) || c[2].includes(t) || c[0].toLowerCase() === t);
      list.innerHTML = rows.map((c) => `<li role="option" data-iso="${c[0]}" aria-selected="${c === current}">${flagImg(c[0])}<span class="phone__name">${esc(c[1])}</span><span class="phone__num">${c[2]}</span></li>`).join('') || '<li class="phone__empty">No match</li>';
    };
    const open = () => { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); search.value = ''; render(''); const sel = $('[aria-selected="true"]', list); if (sel) sel.scrollIntoView({ block: 'center' }); search.focus(); };
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => (menu.hidden ? open() : close()));
    search.addEventListener('input', () => render(search.value));
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const first = $('li[data-iso]', list); if (first) first.click(); } if (e.key === 'Escape') { close(); btn.focus(); } });
    list.addEventListener('click', (e) => { const li = e.target.closest('li[data-iso]'); if (!li) return; current = codes.find((c) => c[0] === li.dataset.iso); paint(); close(); input.focus(); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
    paint();
  }

  /* Outlook "add to calendar" link for a booked slot (opens a prefilled event in Alexia's Outlook) */
  const OUTLOOK_TAG = 'The undercut project';
  const BOOKING_INBOX = 'alexia@zenithstrategy.io';
  function outlookUrl(session, slot, day, tz, who) {
    const start = slot.instant || slot.inst || zonedToDate(day, slot.start, tz), end = new Date(start.getTime() + session.minutes * 60000);
    const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const body = `${OUTLOOK_TAG} · ${session.name} (${session.minutes} min, ${CONFIG.currency}${session.price})\nClient: ${who.name} · ${who.email}${who.phone ? ' · ' + who.phone : ''}\n${who.notes ? 'Notes: ' + who.notes + '\n' : ''}Slot: ${day} ${slot.start}–${slot.end} ${tz}\nCategory: ${OUTLOOK_TAG}`;
    const q = new URLSearchParams({ rru: 'addevent', subject: `${OUTLOOK_TAG} · ${session.name} · ${who.name}`, startdt: iso(start), enddt: iso(end), body, location: 'Microsoft Teams', online: '1' });
    return 'https://outlook.office.com/calendar/0/action/compose?' + q.toString();
  }


  /* ---------- CONFIG (edit here) ---------- */
  const CONFIG = {
    // Where form submissions are sent. FormSubmit forwards them to this inbox.
    // The first submission triggers a one-time activation email to that address.
    contactEmail: 'contact@alexiallobera.com',
    formEndpoint: 'https://formsubmit.co/ajax/contact@alexiallobera.com',
    availabilityUrl: 'data/availability.json',
    bookingUrl: 'data/booking.json',
    currency: '€'
  };

  const SESSIONS = [
    {
      id: 'career',
      name: 'Trackside Career Session',
      minutes: 90,
      price: 250,
      meta: '90 min + follow-up call · one-to-one',
      tag: 'Career session',
      desc: 'A 90-minute deep dive into where you are and where you want to go in motorsport, followed by a short call a few weeks later to check progress and adjust the plan.'
    },
    {
      id: 'student',
      name: 'Student rate',
      minutes: 90,
      price: 150,
      meta: '90 min + follow-up call · students',
      badge: '2 places a month',
      tag: 'Student rate',
      desc: 'The same Trackside Career Session at a reduced rate for students. Two places are available each month; the first come first served.'
    },
    {
      id: 'sprint',
      name: 'Eight-week sprint',
      minutes: 60,
      price: 700,
      meta: '4 sessions · 8 weeks · message reviews',
      tag: 'Sprint',
      desc: 'Four one-to-one sessions over eight weeks, plus written feedback on your messages in between: applications, emails to teams, interview prep. Book the first session here; the rest are scheduled together.'
    }
  ];

  const CAREER = [
    {
      period: '2025 — 2026',
      image: 'assets/img/career/cadillac-f1.jpg',
      discipline: 'Formula 1',
      role: 'Trackside Electronics Support Engineer',
      org: 'Cadillac Formula 1 Team',
      where: 'United Kingdom · USA',
      desc: 'Part of the founding trackside group that built the team from the ground up ahead of its first Grand Prix: garage and trackside systems, electronics and processes, car build and pre-season running.',
      tags: ['Team start-up', 'Trackside systems', 'Power unit & electronics']
    },
    {
      period: '2023 — 2025',
      image: 'assets/img/career/formula-e.jpg',
      discipline: 'Formula E',
      role: 'Manufacturer Systems & Power Unit Support Engineer',
      org: 'Alpine Racing · NEOM McLaren Formula E Team',
      where: 'International',
      desc: 'Trackside support of the powertrain and control systems in the all-electric world championship: systems preparation, live monitoring and performance support across the season.',
      tags: ['Powertrain', 'Control systems', 'Trackside support']
    },
    {
      period: '2022 — 2023',
      image: 'assets/img/career/rallycross-tcr.jpg',
      discipline: 'Rallycross · TCR',
      role: 'Trackside Race Engineer',
      org: 'RX2 Rallycross · TCR touring cars',
      where: 'Europe',
      desc: 'Race engineering and systems support across sprint-format disciplines: set-up, data analysis and driver support where every session counts.',
      tags: ['Race engineering', 'Data analysis', 'Driver support']
    },
    {
      period: '2019 — 2022',
      image: 'assets/img/career/hyundai-wrc.jpg',
      discipline: 'World Rally Championship',
      role: 'Systems Engineer',
      org: 'Hyundai Motorsport',
      where: 'Alzenau, Germany · WRC worldwide',
      desc: 'Trackside systems engineer in the factory WRC team through two FIA World Rally Championship Manufacturers’ titles (2019 and 2020), and part of the development of the all-new Rally1 hybrid car from concept to its first rallies (2021).',
      tags: ['2× WRC Manufacturers’ champion', 'Rally1 hybrid development', 'Systems & electronics'],
      gold: [0]
    },
    {
      period: '2016 — 2019',
      image: 'assets/img/career/x-raid-dakar.jpg',
      discipline: 'Dakar Rally · Cross-Country',
      role: 'Electronics & Systems Engineer',
      org: 'X-raid',
      where: 'Trebur, Germany · Dakar Rally',
      desc: 'From junior engineer to electronics design responsible and sole systems engineer across the team’s seven cars. Development of the MINI John Cooper Works Buggy from concept to racing (2018) and the FIA World Cup for Cross-Country Rallies Team Championship (2018).',
      tags: ['FIA World Cup champion 2018', 'MINI JCW Buggy', 'Telemetry & electronics'],
      gold: [0]
    },
    {
      period: '2023 — Present',
      image: 'assets/img/career/coaching.jpg',
      discipline: 'Beyond the car',
      role: 'High-Performance Teams & Executive Coach · Strategic Consultant',
      org: 'The Undercut Project',
      where: 'Andorra · Worldwide',
      desc: 'Partnering with motorsport-driven teams, CEOs, CTOs and team leaders to strengthen business strategy, leadership, team performance and company culture in high-stakes environments.',
      tags: ['Executive coaching', 'Team performance', 'Strategy']
    }
  ];

  const EDUCATION = [
    {
      title: 'MSc Motorsport Engineering',
      sub: 'Oxford Brookes University',
      desc: 'Thesis in collaboration with Hyundai Motorsport (WRC): the controller area network of a World Rally Car.'
    },
    {
      title: 'BEng Engineering',
      sub: 'Bachelor’s thesis in collaboration with X-raid (Dakar Rally team)',
      desc: '“The electric & electronic system of a buggy for the Dakar Rally” — final mark 10/10 with distinction.'
    }
  ];

  const EXTRAS = [
    {
      title: 'Panda Raid — volunteer driver',
      sub: 'Humanitarian rally across Morocco · Asociación Camino al Sur',
      desc: 'Driving a classic Panda through the desert to deliver school material and aid to remote communities.'
    },
    {
      title: 'Born in Andorra, at home in the paddock',
      sub: 'Andorra · Germany · United Kingdom',
      desc: 'A career built across borders — 180+ events on five continents.'
    }
  ];

  /* ---------- Helpers ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => CONFIG.currency + n;
  const dateKey = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const fromMin = (min) => pad(Math.floor(min / 60)) + ':' + pad(min % 60);
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function tzOffsetMinutes(tz, date) {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {};
    dtf.formatToParts(date).forEach((part) => { if (part.type !== 'literal') p[part.type] = parseInt(part.value, 10); });
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
    return (asUTC - date.getTime()) / 60000;
  }
  // Wall-clock time in `tz` → real Date instant.
  function zonedToDate(ymd, hhmm, tz) {
    const [y, m, d] = ymd.split('-').map(Number);
    const [hh, mm] = hhmm.split(':').map(Number);
    const guess = Date.UTC(y, m - 1, d, hh, mm);
    let off = tzOffsetMinutes(tz, new Date(guess));
    let result = guess - off * 60000;
    off = tzOffsetMinutes(tz, new Date(result));
    return new Date(guess - off * 60000);
  }
  function fmtLocal(date) {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  }
  const visitorTz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'local';

  /* ---------- Theme (?theme=autumn switches to the warm-autumn palette) ---------- */
  try {
    const t = new URLSearchParams(location.search).get('theme');
    if (t) document.documentElement.dataset.theme = t;
    const cur = document.documentElement.dataset.theme;
    if (cur) {
      const link = document.querySelector(`[data-theme-link="${cur}"]`);
      if (link) { link.textContent = 'Wine (default)'; link.href = 'index.html'; }
    }
  } catch (_) {}

  /* ---------- Navigation ---------- */
  const nav = $('#nav');
  const navLinks = $('#navLinks');
  const navToggle = $('#navToggle');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('a', navLinks).forEach((a) => a.addEventListener('click', () => {
    navLinks.classList.remove('is-open');
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }));

  // Active link highlighting
  const sections = $$('main section[id]');
  const linkFor = {};
  $$('.nav__link').forEach((a) => { linkFor[a.getAttribute('href').slice(1)] = a; });
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        $$('.nav__link').forEach((a) => a.classList.remove('is-active'));
        if (linkFor[e.target.id]) linkFor[e.target.id].classList.add('is-active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => spy.observe(s));

  // Pre-fill contact subject from CTA buttons
  $$('[data-subject]').forEach((a) => a.addEventListener('click', () => {
    const sel = $('#cSubject');
    if (sel) sel.value = a.dataset.subject;
  }));

  /* ---------- Reveal on scroll ---------- */
  const revealer = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); revealer.unobserve(e.target); } });
  }, { threshold: 0.08 });
  $$('.reveal, .track').forEach((el) => revealer.observe(el));

  /* ---------- Career ---------- */
  function renderCareer() {
    const tl = $('#timeline');
    tl.innerHTML = CAREER.map((c) => `
      <article class="tl reveal">
        <div class="tl__period">${esc(c.period)}<small>${esc(c.discipline)}</small></div>
        <div class="tl__body">
          <h3 class="tl__role">${esc(c.role)}</h3>
          <p class="tl__org">${esc(c.org)} <span>· ${esc(c.where)}</span></p>
          <p class="tl__desc">${esc(c.desc)}</p>
          <div class="tl__tags">${c.tags.map((t, i) => `<span class="${(c.gold || []).includes(i) ? 'gold' : ''}">${esc(t)}</span>`).join('')}</div>
        </div>
        <figure class="tl__media">
          <img src="${esc(c.image)}" alt="${esc(c.org)} — ${esc(c.discipline)}" loading="lazy" onerror="this.onerror=null;this.src='assets/img/career/placeholder.svg';this.closest('.tl__media').classList.add('is-placeholder');">
          <figcaption class="tl__media-cap"><span>${esc(c.discipline)}</span><span class="tl__media-hint">${esc(c.image)}</span></figcaption>
        </figure>
      </article>`).join('');
    const li = (x) => `<li><strong>${esc(x.title)}</strong><em>${esc(x.sub)}</em><p>${esc(x.desc)}</p></li>`;
    $('#educationList').innerHTML = EDUCATION.map(li).join('');
    $('#extrasList').innerHTML = EXTRAS.map(li).join('');
    $$('.tl.reveal').forEach((el) => revealer.observe(el));
  }
  renderCareer();

  /* ---------- Mentoring: pricing ---------- */
  const state = { session: null, availability: null, month: null, day: null, slot: null, booking: { links: {}, note: '' } };
  const pricing = $('#pricing');
  const clock = (min) => Math.floor(min / 60) + ':' + pad(min % 60);
  pricing.innerHTML = SESSIONS.map((s) => `
    <button type="button" class="price" role="listitem" data-id="${s.id}" aria-pressed="false">
      ${s.badge ? `<span class="price__badge">${esc(s.badge)}</span>` : ''}
      <span class="price__meta">${esc(s.meta)}</span>
      <span class="price__name">${esc(s.name)}</span>
      <span class="price__amount">${money(s.price)}<small>${s.id === 'sprint' ? 'for the full sprint' : 'per session'}</small></span>
      <p class="price__desc">${esc(s.desc)}</p>
      <span class="duration" aria-label="Session length ${clock(s.minutes)}"><span>0:00</span><span class="duration__bar"><i style="left:${s.minutes >= 90 ? 62 : 38}%"></i></span><span>${clock(s.minutes)}</span></span>
      <span class="price__select">Select</span>
    </button>`).join('');

  $$('.price', pricing).forEach((btn) => btn.addEventListener('click', () => {
    state.session = SESSIONS.find((s) => s.id === btn.dataset.id);
    $$('.price', pricing).forEach((b) => { b.classList.toggle('is-selected', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
    state.day = null; state.slot = null;
    setStep(2);
    const link = (state.booking.links || {})[state.session.id];
    if (link) { showProvider(link); } else { hideProvider(); renderCalendar(); renderSlots(); hideBookingForm(); }
    const cal = $('#booking');
    if (cal) cal.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  /* ---------- Mentoring: external scheduling provider (payments + Teams link) ---------- */
  function providerEmbedUrl(link) {
    try {
      const u = new URL(link);
      if (u.hostname.includes('calendly.com')) {
        u.searchParams.set('hide_gdpr_banner', '1');
        u.searchParams.set('background_color', 'f8f4ec');
        u.searchParams.set('text_color', '121212');
        u.searchParams.set('primary_color', '4c0f12');
      }
      return u.toString();
    } catch (_) { return link; }
  }
  function showProvider(link) {
    const box = $('#providerBox');
    const grid = $('.booking__grid');
    grid.hidden = true;
    box.hidden = false;
    const s = state.session;
    box.innerHTML = `
      <div class="provider__head">
        <div>
          <strong>${esc(s.name)}</strong>
          <span>${s.minutes} min · ${money(s.price)}${state.booking.note ? ' · ' + esc(state.booking.note) : ''}</span>
        </div>
        <a class="btn btn--ghost btn--small" href="${esc(link)}" target="_blank" rel="noopener">Open in a new tab</a>
      </div>
      <iframe class="provider__frame" src="${esc(providerEmbedUrl(link))}" title="Book ${esc(s.name)}" loading="lazy" allow="payment"></iframe>`;
    $$('.booking__how p').forEach((el, i) => {
      if (i === 1 && state.booking.note) el.textContent = state.booking.note;
    });
  }
  function hideProvider() {
    const box = $('#providerBox');
    if (box) { box.hidden = true; box.innerHTML = ''; }
    const grid = $('.booking__grid');
    if (grid) grid.hidden = false;
  }
  async function loadBooking() {
    try {
      const res = await fetch(CONFIG.bookingUrl, { cache: 'no-store' });
      if (res.ok) state.booking = Object.assign({ links: {}, note: '' }, await res.json());
    } catch (err) { console.warn('Booking links could not be loaded:', err); }
  }

  function setStep(n) {
    $$('.step').forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('is-active', s === n);
      el.classList.toggle('is-done', s < n);
    });
  }

  /* ---------- Mentoring: availability ---------- */
  const DEFAULT_AVAILABILITY = { timezone: 'Europe/Madrid', bookingWindowDays: 60, minNoticeHours: 24, slotStepMinutes: 30, weekly: {}, dates: {}, blocked: [], booked: [] };

  function parseWindow(w) {
    const [a, b] = w.split('-').map((s) => s.trim());
    return [toMin(a), toMin(b)];
  }
  function parseBooked(entry) {
    // "YYYY-MM-DD HH:MM-HH:MM"
    const [ymd, win] = entry.trim().split(/\s+/);
    if (!ymd || !win) return null;
    const [s, e] = parseWindow(win);
    return { ymd, s, e };
  }

  function slotsFor(ymd, minutes) {
    const av = state.availability;
    if (!av) return [];
    if ((av.blocked || []).includes(ymd)) return [];
    const d = new Date(ymd + 'T00:00:00');
    const windows = (av.dates && av.dates[ymd] !== undefined) ? av.dates[ymd] : ((av.weekly || {})[DOW[d.getDay()]] || []);
    if (!windows.length) return [];
    const step = av.slotStepMinutes || 30;
    const booked = (av.booked || []).map(parseBooked).filter((b) => b && b.ymd === ymd);
    const notBefore = Date.now() + (av.minNoticeHours || 0) * 3600000;
    const out = [];
    windows.forEach((w) => {
      const [ws, we] = parseWindow(w);
      for (let start = ws; start + minutes <= we; start += step) {
        const end = start + minutes;
        const clash = booked.some((b) => start < b.e && end > b.s);
        if (clash) continue;
        const instant = zonedToDate(ymd, fromMin(start), av.timezone);
        if (instant.getTime() < notBefore) continue;
        out.push({ start: fromMin(start), end: fromMin(end), instant });
      }
    });
    return out;
  }

  function dayAvailable(ymd, minutes) {
    const av = state.availability;
    if (!av) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(ymd + 'T00:00:00');
    const diffDays = Math.round((d - today) / 86400000);
    if (diffDays < 0 || diffDays > (av.bookingWindowDays || 60)) return false;
    return slotsFor(ymd, minutes).length > 0;
  }

  async function loadAvailability() {
    try {
      const res = await fetch(CONFIG.availabilityUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.availability = Object.assign({}, DEFAULT_AVAILABILITY, await res.json());
    } catch (err) {
      console.warn('Availability could not be loaded:', err);
      state.availability = DEFAULT_AVAILABILITY;
      $('#calNote').innerHTML = 'Live availability could not be loaded. Please <a href="#contact">contact me</a> to arrange a time.';
    }
    $('#calTz').textContent = state.availability.timezone + (visitorTz !== state.availability.timezone ? ' (your local time is shown under each slot)' : '');
    const now = new Date();
    state.month = new Date(now.getFullYear(), now.getMonth(), 1);
    renderCalendar();
  }

  /* ---------- Mentoring: calendar ---------- */
  function renderCalendar() {
    const grid = $('#calGrid');
    const m = state.month || new Date();
    $('#calMonth').textContent = MONTHS[m.getMonth()] + ' ' + m.getFullYear();
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // Monday-first
    const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const todayKey = dateKey(new Date());
    const minutes = state.session ? state.session.minutes : SESSIONS[0].minutes;
    let html = '';
    for (let i = 0; i < lead; i++) html += '<span class="cal__day is-empty"></span>';
    for (let d = 1; d <= days; d++) {
      const ymd = dateKey(new Date(m.getFullYear(), m.getMonth(), d));
      const avail = state.session ? dayAvailable(ymd, minutes) : false;
      const cls = ['cal__day', avail ? 'is-available' : '', ymd === todayKey ? 'is-today' : '', ymd === state.day ? 'is-selected' : ''].join(' ');
      const circle = ymd === state.day ? `<svg class="cal__circle" viewBox="0 0 100 100" aria-hidden="true"><path pathLength="1" d="M52 10 C 76 8, 94 26, 93 50 C 92 76, 72 93, 48 92 C 24 91, 7 72, 8 48 C 9 24, 28 9, 54 11 C 72 12, 88 24, 90 42"/></svg>` : '';
      html += avail
        ? `<button type="button" class="${cls}" data-ymd="${ymd}" role="gridcell" aria-label="${ymd}">${d}${circle}</button>`
        : `<span class="${cls}" role="gridcell" aria-disabled="true">${d}</span>`;
    }
    grid.innerHTML = html;
    $$('.cal__day.is-available', grid).forEach((b) => b.addEventListener('click', () => {
      state.day = b.dataset.ymd; state.slot = null;
      renderCalendar(); renderSlots(); hideBookingForm();
    }));
    // Limit navigation to the booking window
    const now = new Date();
    const maxMonth = new Date(now.getFullYear(), now.getMonth() + Math.ceil((state.availability ? state.availability.bookingWindowDays : 60) / 28), 1);
    $('#calPrev').disabled = m <= new Date(now.getFullYear(), now.getMonth(), 1);
    $('#calNext').disabled = m >= maxMonth;
  }
  $('#calPrev').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); });
  $('#calNext').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); });

  function renderSlots() {
    const box = $('#slots');
    if (!state.session) { box.innerHTML = '<p class="slots__hint">Select a session type above, then pick a highlighted day.</p>'; return; }
    if (!state.day) { box.innerHTML = `<p class="slots__hint"><strong>${esc(state.session.name)}</strong> · ${state.session.minutes} min · ${money(state.session.price)}<br>Pick a highlighted day on the calendar.</p>`; return; }
    const slots = slotsFor(state.day, state.session.minutes);
    const d = new Date(state.day + 'T00:00:00');
    const pretty = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const tz = state.availability.timezone;
    box.innerHTML = `
      <h4 class="slots__title">${esc(pretty)}</h4>
      <p class="slots__sub">${esc(state.session.name)} · ${state.session.minutes} min · ${money(state.session.price)}</p>
      ${slots.length ? `<div class="slots__list">${slots.map((s) => `
        <button type="button" class="slot ${state.slot && state.slot.start === s.start ? 'is-selected' : ''}" data-start="${s.start}">
          ${s.start}–${s.end}
          ${visitorTz !== tz ? `<small>${fmtLocal(s.instant)} your time</small>` : `<small>${esc(tz.split('/')[1] || tz)}</small>`}
        </button>`).join('')}</div>` : '<p class="slots__empty">No times left on this day.</p>'}`;
    $$('.slot', box).forEach((b) => b.addEventListener('click', () => {
      state.slot = slots.find((s) => s.start === b.dataset.start);
      $$('.slot', box).forEach((x) => x.classList.toggle('is-selected', x === b));
      showBookingForm();
    }));
  }

  /* ---------- Mentoring: booking form ---------- */
  const bookingForm = $('#bookingForm');
  function showBookingForm() {
    setStep(3);
    const s = state.session, sl = state.slot;
    const d = new Date(state.day + 'T00:00:00');
    $('#bookingSummary').innerHTML = `
      <strong>${esc(s.name)}</strong>
      <span>${esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${sl.start}–${sl.end} (${esc(state.availability.timezone)})</span>
      <span class="price-tag">${money(s.price)} · ${s.minutes} MIN · ${esc(s.tag).toUpperCase()}</span>`;
    bookingForm.hidden = false;
    bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function hideBookingForm() {
    bookingForm.hidden = true;
    $('#slots').hidden = false;
    $('#bookingStatus').textContent = '';
    $('#bookingStatus').className = 'form__status';
  }
  $('#bookingBack').addEventListener('click', () => { state.slot = null; setStep(2); hideBookingForm(); renderSlots(); });

  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(bookingForm)) return;
    const s = state.session, sl = state.slot;
    const payload = {
      _subject: `Mentoring booking request — ${s.name} — ${state.day} ${sl.start}`,
      _template: 'table',
      _captcha: 'false',
      _cc: BOOKING_INBOX,
      _replyto: $('#bEmail').value.trim(),
      _autoresponse: `Thank you — your request for the ${s.name} on ${state.day} at ${sl.start} (${state.availability.timezone}) has been received. Alexia will confirm the slot and send the payment details and the Microsoft Teams link within 24 hours.`,
      calendar: OUTLOOK_TAG,
      add_to_outlook: outlookUrl(s, sl, state.day, state.availability.timezone, { name: $('#bName').value.trim(), email: $('#bEmail').value.trim(), phone: phoneValue('#bPhone'), notes: $('#bNotes').value.trim() }),
      type: 'Mentoring booking request',
      session: `${s.name} (${s.minutes} min) — ${money(s.price)}`,
      date: state.day,
      time: `${sl.start}–${sl.end} ${state.availability.timezone}`,
      name: $('#bName').value.trim(),
      email: $('#bEmail').value.trim(),
      phone: phoneValue('#bPhone'),
      notes: $('#bNotes').value.trim(),
      visitor_timezone: visitorTz,
      _honey: bookingForm.querySelector('[name=_honey]').value
    };
    await send(payload, bookingForm, $('#bookingStatus'),
      'Request received. You will get a confirmation and payment details by email within 24 hours.',
      () => { bookingForm.reset(); });
  });

  /* ---------- Contact form ---------- */
  const contactForm = $('#contactForm');
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(contactForm)) return;
    const payload = {
      _subject: `Website contact — ${$('#cSubject').value} — ${$('#cName').value.trim()}`,
      _template: 'table',
      _captcha: 'false',
      type: 'Contact form',
      subject: $('#cSubject').value,
      name: $('#cName').value.trim(),
      email: $('#cEmail').value.trim(),
      phone: phoneValue('#cPhone'),
      message: $('#cMessage').value.trim(),
      _honey: contactForm.querySelector('[name=_honey]').value
    };
    await send(payload, contactForm, $('#contactStatus'), 'Thank you — your message has been sent. I will get back to you shortly.', () => contactForm.reset());
  });

  /* ---------- Shared form helpers ---------- */
  function validate(form) {
    let ok = true;
    $$('[required]', form).forEach((el) => {
      const valid = el.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()) : el.value.trim().length > 1;
      el.classList.toggle('is-invalid', !valid);
      if (!valid) ok = false;
    });
    if (!ok) {
      const status = $('.form__status', form);
      status.textContent = 'Please check the highlighted fields.';
      status.className = 'form__status is-error';
    }
    return ok;
  }

  async function send(payload, form, status, okMessage, onOk) {
    if (payload._honey) { status.textContent = okMessage; status.className = 'form__status is-ok'; return; }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    status.textContent = 'Sending…';
    status.className = 'form__status';
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === 'false' || data.success === false) throw new Error(data.message || 'Request failed');
      status.textContent = okMessage;
      status.className = 'form__status is-ok';
      if (onOk) onOk();
    } catch (err) {
      console.error(err);
      const body = Object.entries(payload).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join('\n');
      const mailto = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(payload._subject)}&body=${encodeURIComponent(body)}`;
      status.innerHTML = `Something went wrong sending the form. You can <a href="${mailto}">send it by email instead</a>.`;
      status.className = 'form__status is-error';
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Misc ---------- */
  $('#year').textContent = new Date().getFullYear();
  loadBooking();
  loadAvailability();
  /* phone country-code dropdowns (after the helpers exist) */
  $$('input[data-phone]').forEach(initPhone);
})();
