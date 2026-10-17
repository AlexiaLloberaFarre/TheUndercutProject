/* THE UNDERCUT PROJECT — V5 scripts · Lights Out
   start lights opening · light-streak canvas · parallax cars · top bar + menu · reveals · counters ·
   marquee · lights-row dividers · the grid (career) with hover peek · topics · offers · booking · forms */
(function () {
  'use strict';
  const CONFIG = {
    contactEmail: 'contact@alexiallobera.com',
    formEndpoint: 'https://formsubmit.co/ajax/contact@alexiallobera.com',
    availabilityUrl: 'data/availability.json',
    bookingUrl: 'data/booking.json',
    currency: '€'
  };
  const SESSIONS = [
    { id: 'career', name: 'Trackside Career Session', minutes: 90, price: 250, meta: '90 min + follow-up call', fill: 62, tag: 'Career session', desc: 'A 90-minute deep dive into where you are and where you want to go in motorsport, followed by a short call a few weeks later to check progress and adjust the plan.' },
    { id: 'student', name: 'Student rate', minutes: 90, price: 150, meta: '90 min + follow-up call · students', fill: 62, badge: '2 places a month', tag: 'Student rate', desc: 'The same Trackside Career Session at a reduced rate for students. Two places each month, first come first served.' },
    { id: 'sprint', name: 'Eight-week sprint', minutes: 60, price: 700, meta: '4 sessions · 8 weeks · message reviews', fill: 38, tag: 'Sprint', full: true, desc: 'Four one-to-one sessions over eight weeks, plus written feedback on your messages in between: applications, emails to teams, interview prep. Book the first session here; the rest are scheduled together.' }
  ];
  const LAPS = [
    { period: '2025 — 2026', disc: 'Formula 1', role: 'Trackside Electronics Support Engineer', org: 'Cadillac Formula 1 Team', where: 'United Kingdom · USA', desc: 'Part of the founding trackside group that built the team from the ground up ahead of its first Grand Prix: garage and trackside systems, electronics and processes, car build and pre-season running.', tags: ['Team start-up', 'Trackside systems', 'Power unit & electronics'], hot: [0], img: 'assets/img/career/cadillac-f1.jpg' },
    { period: '2023 — 2025', disc: 'Formula E', role: 'Manufacturer Systems & Power Unit Support Engineer', org: 'Alpine Racing · NEOM McLaren Formula E Team', where: 'International', desc: 'Trackside support of the powertrain and control systems in the all-electric world championship: systems preparation, live monitoring and performance support across the season.', tags: ['Powertrain', 'Control systems', 'Trackside support'], hot: [], img: 'assets/img/career/formula-e.jpg' },
    { period: '2022 — 2023', disc: 'Rallycross · TCR', role: 'Trackside Race Engineer', org: 'RX2 Rallycross · TCR touring cars', where: 'Europe', desc: 'Race engineering and systems support across sprint-format disciplines: set-up, data analysis and driver support where every session counts.', tags: ['Race engineering', 'Data analysis', 'Driver support'], hot: [], img: 'assets/img/career/rallycross-tcr.jpg' },
    { period: '2019 — 2022', disc: 'World Rally Championship', role: 'Systems Engineer', org: 'Hyundai Motorsport', where: 'Alzenau, Germany · WRC worldwide', desc: 'Trackside systems engineer in the factory WRC team through two FIA World Rally Championship Manufacturers’ titles (2019 and 2020), and part of the development of the all-new Rally1 hybrid car from concept to its first rallies (2021).', tags: ['2× WRC Manufacturers’ champion', 'Rally1 hybrid development', 'Systems & electronics'], hot: [0], img: 'assets/img/career/hyundai-wrc.jpg' },
    { period: '2016 — 2019', disc: 'Dakar Rally · Cross-Country', role: 'Electronics & Systems Engineer', org: 'X-raid', where: 'Trebur, Germany · Dakar Rally', desc: 'From junior engineer to electronics design responsible and sole systems engineer across the team’s seven cars. Development of the MINI John Cooper Works Buggy from concept to racing (2018) and the FIA World Cup for Cross-Country Rallies Team Championship (2018).', tags: ['FIA World Cup champion 2018', 'MINI JCW Buggy', 'Telemetry & electronics'], hot: [0], img: 'assets/img/career/x-raid-dakar.jpg' },
    { period: '2023 — Present', disc: 'Beyond the car', role: 'High-Performance Teams & Executive Coach · Strategic Consultant', org: 'The Undercut Project', where: 'Andorra · Worldwide', desc: 'Partnering with motorsport-driven teams, CEOs, CTOs and team leaders to strengthen business strategy, leadership, team performance and company culture in high-stakes environments.', tags: ['Executive coaching', 'Team performance', 'Strategy'], hot: [], img: 'assets/img/career/coaching.jpg' }
  ];
  const EDUCATION = [
    { t: 'MSc Motorsport Engineering', s: 'Oxford Brookes University', d: 'Thesis in collaboration with Hyundai Motorsport (WRC): the controller area network of a World Rally Car.' },
    { t: 'BEng Engineering', s: 'Bachelor’s thesis in collaboration with X-raid (Dakar Rally team)', d: '“The electric & electronic system of a buggy for the Dakar Rally”, final mark 10/10 with distinction.' }
  ];
  const EXTRAS = [
    { t: 'Panda Raid — volunteer driver', s: 'Humanitarian rally across Morocco · Asociación Camino al Sur', d: 'Driving a classic Panda through the desert to deliver school material and aid to remote communities.' },
    { t: 'Born in Andorra, at home in the paddock', s: 'Andorra · Germany · United Kingdom', d: 'A career built across borders: 180+ events on five continents.' }
  ];
  const TOPICS = [
    ['The Undercut: strategy under pressure', 'How race teams make decisive calls with incomplete data and a running clock, and what that teaches leaders about timing, risk and conviction.'],
    ['Engineering reliability', 'Reliability is not luck. Building systems, processes and habits that hold when it matters most, from the Dakar to a Grand Prix weekend.'],
    ['From individual excellence to collective performance', 'What championship-winning teams do differently: roles, trust, communication and the culture that turns talent into titles.'],
    ['Building a team from zero', 'Lessons from the start-up phase of a Formula 1 team: structure, priorities and people when nothing exists yet and the deadline is fixed.'],
    ['Women at the sharp end of motorsport', 'A decade trackside as a woman in engineering, and why diversity is a performance lever, not a box to tick.'],
    ['Sustaining performance on the road', '180 events, seven disciplines, constant travel: energy, focus and resilience when the season never stops.']
  ];
  const DISCIPLINES = ['Formula 1', 'Formula E', 'World Rally Championship', 'Rallycross', 'TCR', 'Dakar Rally', 'E1 Series'];


  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => CONFIG.currency + n;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- lights out opening ---------- */
  (function lights() {
    const box = $('#lights'); if (!box) return;
    const go = () => { box.classList.add('is-done'); document.body.classList.add('go'); };
    if (reduced) { go(); return; }
    const bulbs = $$('.lights__row i', box), text = $('#lightsText');
    bulbs.forEach((b, i) => setTimeout(() => { b.classList.add('on'); if (i === 4) text.textContent = 'hold…'; }, 500 + i * 320));
    const out = 500 + 5 * 320 + 700 + Math.random() * 600;
    setTimeout(() => { bulbs.forEach((b) => b.classList.remove('on')); text.textContent = 'lights out.'; }, out);
    setTimeout(go, out + 420);
  })();

  /* ---------- light streaks (cars racing past) ---------- */
  (function streaks() {
    const cv = $('#streaks'), hero = $('#home'); if (!cv || reduced) return;
    const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = 1, parts = [], raf = 0, visible = true, boost = 1, lastY = scrollY;
    const N = () => Math.round(Math.min(90, Math.max(36, W / 18)));
    const spawn = (p, fresh) => { p.x = fresh ? Math.random() * W : W + Math.random() * 300; p.y = H * (.42 + Math.random() * .55); p.v = 3 + Math.random() * 9; p.len = 60 + Math.random() * 260; p.w = Math.random() < .12 ? 3 : Math.random() < .5 ? 1.5 : 1; p.a = .15 + Math.random() * .55; p.warm = Math.random() < .55; return p; };
    const resize = () => { dpr = Math.min(devicePixelRatio || 1, 2); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const n = N(); while (parts.length < n) parts.push(spawn({}, true)); parts.length = n; };
    const frame = () => {
      raf = 0; if (!visible) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        const g = ctx.createLinearGradient(p.x, p.y, p.x + p.len, p.y);
        const c = p.warm ? '255,205,140' : '255,245,230';
        g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(.7, `rgba(${c},${p.a})`); g.addColorStop(1, `rgba(${c},${Math.min(1, p.a * 1.6)})`);
        ctx.strokeStyle = g; ctx.lineWidth = p.w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.len * (0.6 + boost * .4), p.y); ctx.stroke();
        p.x -= p.v * boost;
        if (p.x + p.len * 2 < 0) spawn(p, false);
      }
      boost += (1 - boost) * .04;
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
    resize(); addEventListener('resize', resize); kick();
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; kick(); }, { threshold: 0 }).observe(hero);
    document.addEventListener('visibilitychange', () => { visible = !document.hidden && visible; kick(); });
    addEventListener('scroll', () => { const d = Math.abs(scrollY - lastY); lastY = scrollY; boost = Math.min(4, boost + d / 80); kick(); }, { passive: true });
  })();

  /* ---------- parallax backgrounds ---------- */
  const px = $$('.parallax');
  const parallax = () => { if (reduced) return; px.forEach((el) => { const r = el.parentElement.getBoundingClientRect(); const mid = r.top + r.height / 2 - innerHeight / 2; el.style.transform = `translate3d(0, ${(-mid * parseFloat(el.dataset.speed || .15)).toFixed(1)}px, 0)`; }); };

  /* ---------- top bar + menu ---------- */
  const top = $('#top'), menu = $('#menu'), menuBtn = $('#menuBtn');
  const onScroll = () => { top.classList.toggle('is-scrolled', scrollY > 40); parallax(); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const setMenu = (open) => { menu.hidden = !open; top.classList.toggle('is-open', open); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); document.body.style.overflow = open ? 'hidden' : ''; };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
  const navLinks = $$('#topNav a'); const linkFor = {}; navLinks.forEach((a) => { linkFor[a.getAttribute('href').slice(1)] = a; });
  const secIO = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; navLinks.forEach((a) => a.classList.remove('is-active')); const a = linkFor[e.target.id]; if (a) a.classList.add('is-active'); }), { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => secIO.observe(s));
  $$('[data-subject]').forEach((a) => a.addEventListener('click', () => { const s = $('#cSubject'); if (s) s.value = a.dataset.subject; }));

  /* ---------- reveals, counters, marquee, lights rows ---------- */
  function observeReveals() {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    $$('.rv:not(.in)').forEach((el) => io.observe(el));
  }
  observeReveals();
  const cIO = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; const el = e.target, end = Number(el.dataset.count), t0 = performance.now(), dur = 1800; cIO.unobserve(el); if (reduced) { el.textContent = end; return; } (function step(t) { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0); }), { threshold: .5 });
  $$('[data-count]').forEach((el) => cIO.observe(el));
  (function marquee() { const el = $('#marquee'); if (el) el.innerHTML = DISCIPLINES.concat(DISCIPLINES).map((d) => `<span>${esc(d)}</span>`).join(''); })();
  const lrIO = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; const el = e.target; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }), { threshold: .9 });
  $$('.lr').forEach((el) => lrIO.observe(el));

  /* ---------- the grid · career rows with hover peek ---------- */
  (function grid() {
    const list = $('#grid'), peek = $('#peek'); if (!list) return;
    list.innerHTML = LAPS.map((l, i) => `
      <li class="row" data-i="${i}">
        <span class="row__pos"><small>P</small>${i + 1}</span>
        <button type="button" class="row__role" aria-expanded="false">${esc(l.role)}</button>
        <span class="row__org"><b>${esc(l.disc)}</b>${esc(l.org)} · ${esc(l.where)}</span>
        <span class="row__period tw"><b>${esc(l.period)}</b>${esc(l.tags[0])}</span>
        <img class="row__img" src="${l.img}" alt="${esc(l.role)} — ${esc(l.org)}" loading="lazy">
        <div class="row__more"><p>${esc(l.desc)}</p><div class="row__tags">${l.tags.map((t, j) => `<span class="${l.hot.includes(j) ? 'hot' : ''}">${esc(t)}</span>`).join('')}</div></div>
      </li>`).join('');
    const rows = $$('.row', list);
    rows.forEach((r) => r.addEventListener('click', (e) => { if (e.target.closest('a')) return; const open = r.classList.toggle('is-open'); $('.row__role', r).setAttribute('aria-expanded', String(open)); }));
    if (!fine || reduced) return;
    const img = $('img', peek), cap = $('span', peek); let tx = 0, ty = 0, x = 0, y = 0, raf = 0, on = false;
    const loop = () => { x += (tx - x) * .14; y += (ty - y) * .14; peek.style.left = x + 'px'; peek.style.top = y + 'px'; raf = on || Math.abs(tx - x) > .5 ? requestAnimationFrame(loop) : 0; };
    rows.forEach((r) => {
      r.addEventListener('mouseenter', () => { const l = LAPS[Number(r.dataset.i)]; img.src = l.img; cap.textContent = l.disc + ' · ' + l.period; on = true; peek.classList.add('on'); if (!raf) raf = requestAnimationFrame(loop); });
      r.addEventListener('mouseleave', () => { on = false; peek.classList.remove('on'); });
    });
    list.addEventListener('mousemove', (e) => { tx = e.clientX + 40; ty = e.clientY; if (!raf) raf = requestAnimationFrame(loop); }, { passive: true });
  })();
  const specItem = (x) => `<li><b>${esc(x.t)}</b><small>${esc(x.s)}</small><p>${esc(x.d)}</p></li>`;
  $('#education').innerHTML = EDUCATION.map(specItem).join('');
  $('#extras').innerHTML = EXTRAS.map(specItem).join('');

  /* ---------- speaker · topics ---------- */
  $('#topics').innerHTML = TOPICS.map((t, i) => `
    <div class="topic">
      <button type="button" class="topic__btn" aria-expanded="false"><b>${pad(i + 1)}</b><span>${esc(t[0])}</span><i>+</i></button>
      <div class="topic__body"><p>${esc(t[1])}</p></div>
    </div>`).join('');
  $$('.topic__btn').forEach((b) => b.addEventListener('click', () => { const t = b.parentElement; const open = t.classList.toggle('is-open'); b.setAttribute('aria-expanded', String(open)); }));

  /* ---------- offers ---------- */
  const state = { session: null, availability: null, month: null, day: null, slot: null, booking: { links: {}, note: '' } };
  const clock2 = (m) => Math.floor(m / 60) + ':' + pad(m % 60);
  $('#offers').innerHTML = SESSIONS.map((s, i) => `
    <button type="button" class="offer rv" style="transition-delay:${i * .1}s" data-id="${s.id}" aria-pressed="false">
      ${s.badge ? `<span class="offer__badge">${esc(s.badge)}</span>` : ''}
      <span class="offer__meta">${esc(s.meta)}</span>
      <span class="offer__name">${esc(s.name)}</span>
      <span class="offer__price">${money(s.price)}<small>${s.full ? 'full sprint' : 'per session'}</small></span>
      <span class="offer__desc">${esc(s.desc)}</span>
      <span class="gauge"><span>0:00</span><i style="--fill:${s.fill}%"></i><span>${clock2(s.minutes)}</span></span>
      <span class="offer__select">Select →</span>
    </button>`).join('');
  observeReveals();
  $$('.offer').forEach((b) => b.addEventListener('click', () => {
    state.session = SESSIONS.find((s) => s.id === b.dataset.id);
    $$('.offer').forEach((o) => { o.classList.toggle('is-selected', o === b); o.setAttribute('aria-pressed', String(o === b)); });
    state.day = null; state.slot = null; setStep(2);
    const link = (state.booking.links || {})[state.session.id];
    if (link) showProvider(link); else { hideProvider(); renderCal(); renderSlots(); hideForm(); }
    $('#booking').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }));
  function setStep(n) { $$('.steps li').forEach((el) => { const s = Number(el.dataset.step); el.classList.toggle('is-active', s === n); el.classList.toggle('is-done', s < n); }); }

  /* ---------- provider (Calendly etc.) ---------- */
  function showProvider(link) {
    const box = $('#providerBox'); $('.booking__grid').hidden = true; box.hidden = false;
    let url = link; try { const u = new URL(link); if (u.hostname.includes('calendly.com')) { u.searchParams.set('hide_gdpr_banner', '1'); u.searchParams.set('background_color', 'f8f0e3'); u.searchParams.set('text_color', '1b0f09'); u.searchParams.set('primary_color', 'c84f1c'); } url = u.toString(); } catch (_) {}
    const s = state.session;
    box.innerHTML = `<div class="provider__head"><div><strong>${esc(s.name)}</strong><span>${s.minutes} min · ${money(s.price)}${state.booking.note ? ' · ' + esc(state.booking.note) : ''}</span></div><a class="btn btn--line btn--sm" href="${esc(link)}" target="_blank" rel="noopener">Open in a new tab</a></div><iframe class="provider__frame" src="${esc(url)}" title="Book ${esc(s.name)}" loading="lazy" allow="payment"></iframe>`;
  }
  function hideProvider() { const box = $('#providerBox'); box.hidden = true; box.innerHTML = ''; $('.booking__grid').hidden = false; }
  async function loadBooking() { try { const r = await fetch(CONFIG.bookingUrl, { cache: 'no-store' }); if (r.ok) state.booking = Object.assign({ links: {}, note: '' }, await r.json()); } catch (e) { console.warn(e); } }

  /* ---------- availability + calendar ---------- */
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m) => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const key = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const DEFAULT_AV = { timezone: 'Europe/Madrid', bookingWindowDays: 60, minNoticeHours: 24, slotStepMinutes: 30, weekly: {}, dates: {}, blocked: [], booked: [] };
  function tzOffset(tz, date) { const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); const p = {}; f.formatToParts(date).forEach((x) => { if (x.type !== 'literal') p[x.type] = parseInt(x.value, 10); }); return (Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - date.getTime()) / 60000; }
  function zoned(ymd, hhmm, tz) { const [y, m, d] = ymd.split('-').map(Number); const [h, mi] = hhmm.split(':').map(Number); const g = Date.UTC(y, m - 1, d, h, mi); let o = tzOffset(tz, new Date(g)); let r = g - o * 60000; o = tzOffset(tz, new Date(r)); return new Date(g - o * 60000); }
  const visitorTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
  const fmtLocal = (d) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  function slotsFor(ymd, minutes) {
    const av = state.availability; if (!av || (av.blocked || []).includes(ymd)) return [];
    const d = new Date(ymd + 'T00:00:00'); const windows = av.dates && av.dates[ymd] !== undefined ? av.dates[ymd] : ((av.weekly || {})[DOW[d.getDay()]] || []);
    const step = av.slotStepMinutes || 30, booked = (av.booked || []).map((e) => { const [dd, w] = e.trim().split(/\s+/); if (dd !== ymd || !w) return null; const [a, b] = w.split('-'); return { s: toMin(a), e: toMin(b) }; }).filter(Boolean);
    const notBefore = Date.now() + (av.minNoticeHours || 0) * 3600000; const out = [];
    windows.forEach((w) => { const [a, b] = w.split('-').map((x) => toMin(x.trim())); for (let s = a; s + minutes <= b; s += step) { const e = s + minutes; if (booked.some((k) => s < k.e && e > k.s)) continue; const inst = zoned(ymd, fromMin(s), av.timezone); if (inst.getTime() < notBefore) continue; out.push({ start: fromMin(s), end: fromMin(e), inst }); } });
    return out;
  }
  function dayOk(ymd, minutes) { const av = state.availability; if (!av) return false; const t = new Date(); t.setHours(0, 0, 0, 0); const diff = Math.round((new Date(ymd + 'T00:00:00') - t) / 86400000); if (diff < 0 || diff > (av.bookingWindowDays || 60)) return false; return slotsFor(ymd, minutes).length > 0; }
  async function loadAvailability() {
    try { const r = await fetch(CONFIG.availabilityUrl, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); state.availability = Object.assign({}, DEFAULT_AV, await r.json()); }
    catch (e) { state.availability = DEFAULT_AV; $('#calNote').innerHTML = 'Live availability could not be loaded. <a href="#contact">Contact me</a> to arrange a time.'; }
    $('#calTz').textContent = state.availability.timezone + (visitorTz !== state.availability.timezone ? ' (your local time shown on each slot)' : '');
    const n = new Date(); state.month = new Date(n.getFullYear(), n.getMonth(), 1); renderCal();
  }
  function renderCal() {
    const g = $('#calGrid'), m = state.month || new Date(); $('#calMonth').textContent = MONTHS[m.getMonth()] + ' ' + m.getFullYear();
    const lead = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7, days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), today = key(new Date()), minutes = state.session ? state.session.minutes : 90;
    let h = ''; for (let i = 0; i < lead; i++) h += '<span class="day empty"></span>';
    for (let d = 1; d <= days; d++) { const ymd = key(new Date(m.getFullYear(), m.getMonth(), d)); const ok = state.session ? dayOk(ymd, minutes) : false; const cls = ['day', ok ? 'ok' : '', ymd === today ? 'today' : '', ymd === state.day ? 'sel' : ''].join(' '); h += ok ? `<button type="button" class="${cls}" data-ymd="${ymd}">${d}</button>` : `<span class="${cls}">${d}</span>`; }
    g.innerHTML = h;
    $$('.day.ok', g).forEach((b) => b.addEventListener('click', () => { state.day = b.dataset.ymd; state.slot = null; renderCal(); renderSlots(); hideForm(); }));
    const now = new Date(); $('#calPrev').disabled = m <= new Date(now.getFullYear(), now.getMonth(), 1); $('#calNext').disabled = m >= new Date(now.getFullYear(), now.getMonth() + Math.ceil((state.availability ? state.availability.bookingWindowDays : 60) / 28), 1);
  }
  $('#calPrev').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCal(); });
  $('#calNext').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCal(); });
  function renderSlots() {
    const box = $('#slots'); if (!state.session) { box.innerHTML = '<p class="hint">Pick an offer above, then a highlighted day.</p>'; return; }
    if (!state.day) { box.innerHTML = `<p class="hint"><strong>${esc(state.session.name)}</strong> · ${state.session.minutes} min · ${money(state.session.price)}<br>Pick a highlighted day on the calendar.</p>`; return; }
    const slots = slotsFor(state.day, state.session.minutes), d = new Date(state.day + 'T00:00:00'), tz = state.availability.timezone;
    box.innerHTML = `<h4 class="slots__title">${esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}</h4><p class="slots__sub tw">${esc(state.session.name)} · ${state.session.minutes} min · ${money(state.session.price)}</p>${slots.length ? `<div class="slots__list">${slots.map((s) => `<button type="button" class="slot ${state.slot && state.slot.start === s.start ? 'sel' : ''}" data-start="${s.start}">${s.start}–${s.end}<small>${visitorTz !== tz ? fmtLocal(s.inst) + ' your time' : esc(tz.split('/')[1] || tz)}</small></button>`).join('')}</div>` : '<p class="hint">No times left on this day.</p>'}`;
    $$('.slot', box).forEach((b) => b.addEventListener('click', () => { state.slot = slots.find((s) => s.start === b.dataset.start); $$('.slot', box).forEach((x) => x.classList.toggle('sel', x === b)); showForm(); }));
  }
  const bookingForm = $('#bookingForm');
  function showForm() { setStep(3); const s = state.session, sl = state.slot, d = new Date(state.day + 'T00:00:00'); $('#bookingSummary').innerHTML = `<strong>${esc(s.name)}</strong><span>${esc(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${sl.start}–${sl.end} (${esc(state.availability.timezone)})</span><span class="tag">${money(s.price)} · ${s.minutes} MIN · ${esc(s.tag).toUpperCase()}</span>`; bookingForm.hidden = false; $('#slots').hidden = true; bookingForm.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' }); }
  function hideForm() { bookingForm.hidden = true; $('#slots').hidden = false; const st = $('#bookingStatus'); st.textContent = ''; st.className = 'status tw'; }
  $('#bookingBack').addEventListener('click', () => { state.slot = null; setStep(2); hideForm(); renderSlots(); });
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!validate(bookingForm)) return; const s = state.session, sl = state.slot;
    await send({ _subject: `Mentoring booking request — ${s.name} — ${state.day} ${sl.start}`, _template: 'table', _captcha: 'false', type: 'Mentoring booking request', session: `${s.name} (${s.minutes} min) — ${money(s.price)}`, date: state.day, time: `${sl.start}–${sl.end} ${state.availability.timezone}`, name: $('#bName').value.trim(), email: $('#bEmail').value.trim(), phone: $('#bPhone').value.trim(), notes: $('#bNotes').value.trim(), visitor_timezone: visitorTz, _honey: bookingForm.querySelector('[name=_honey]').value }, bookingForm, $('#bookingStatus'), 'Request received. You will get a confirmation and payment details by email within 24 hours.', () => bookingForm.reset());
  });

  /* ---------- contact ---------- */
  const contactForm = $('#contactForm');
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!validate(contactForm)) return;
    await send({ _subject: `Website contact — ${$('#cSubject').value} — ${$('#cName').value.trim()}`, _template: 'table', _captcha: 'false', type: 'Contact form', subject: $('#cSubject').value, name: $('#cName').value.trim(), email: $('#cEmail').value.trim(), phone: $('#cPhone').value.trim(), message: $('#cMessage').value.trim(), _honey: contactForm.querySelector('[name=_honey]').value }, contactForm, $('#contactStatus'), 'Thank you. Your message has been sent and I will get back to you shortly.', () => contactForm.reset());
  });
  function validate(form) { let ok = true; $$('[required]', form).forEach((el) => { const v = el.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value.trim()) : el.value.trim().length > 1; el.classList.toggle('is-invalid', !v); if (!v) ok = false; }); if (!ok) { const st = $('.status', form); st.textContent = 'Please check the highlighted fields.'; st.className = 'status tw err'; } return ok; }
  async function send(payload, form, status, okMsg, onOk) {
    if (payload._honey) { status.textContent = okMsg; status.className = 'status tw ok'; return; }
    const btn = $('button[type=submit]', form); btn.disabled = true; status.textContent = 'Sending…'; status.className = 'status tw';
    try { const r = await fetch(CONFIG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) }); const d = await r.json().catch(() => ({})); if (!r.ok || d.success === 'false' || d.success === false) throw new Error(d.message || 'Request failed'); status.textContent = okMsg; status.className = 'status tw ok'; if (onOk) onOk(); }
    catch (err) { const body = Object.entries(payload).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}: ${v}`).join('\n'); status.innerHTML = `Something went wrong. You can <a href="mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(payload._subject)}&body=${encodeURIComponent(body)}">send it by email instead</a>.`; status.className = 'status tw err'; }
    finally { btn.disabled = false; }
  }

  $('#year').textContent = new Date().getFullYear();
  loadBooking(); loadAvailability();
})();
