/* The Undercut Project — site behaviour
   - sticky header state, mobile nav, active-section highlighting
   - reveal-on-scroll
   - mentoring booking flow (session → date & time → details → email request)
   - contact form (email request)
   No backend is required: both forms open the visitor's email app with a
   pre-filled message to contact@alexiallobera.com. */
(() => {
  'use strict';

  const CONTACT_EMAIL = 'contact@alexiallobera.com';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ------------------------------------------------------------------ nav */
  const header = $('.site-header');
  const toggle = $('.nav-toggle');
  const nav = $('.site-nav');

  const setScrolled = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });

  if (toggle && nav) {
    nav.id = nav.id || 'primary-nav';
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('a', nav).forEach(a => a.addEventListener('click', () => {
      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    }));
  }

  const navLinks = $$('.site-nav a[href^="#"]:not(.btn)');
  const sections = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);

  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id));
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    sections.forEach(s => sectionObserver.observe(s));

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    $$('.reveal').forEach(el => revealObserver.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  /* ------------------------------------------------------------- helpers */
  const pad = n => String(n).padStart(2, '0');
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);
  const sameMonth = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const longDate = d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const monthLabel = d => d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const openMail = (subject, body) => {
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const validate = form => {
    let ok = true;
    $$('[required]', form).forEach(field => {
      const valid = field.checkValidity();
      field.classList.toggle('is-invalid', !valid);
      if (!valid && ok) { field.focus(); ok = false; }
    });
    return ok;
  };

  /* ------------------------------------------------------------- booking */
  const SESSIONS = {
    career:  { name: 'Trackside Career Session', meta: '90 min + follow-up call · one-to-one', price: '€250 per session', minutes: 90 },
    student: { name: 'Student rate',              meta: '90 min + follow-up call · students',   price: '€150 per session', minutes: 90 },
    sprint:  { name: 'Eight-week sprint',         meta: '4 sessions · 8 weeks · message reviews', price: '€700 for the full sprint', minutes: 60 },
  };
  const SLOTS = ['09:00', '11:00', '14:00', '16:00', '18:00'];
  const MONTHS_AHEAD = 3;          // how far ahead the calendar opens
  const AVAILABLE_WEEKDAYS = [1, 2, 3, 4, 5]; // Mon–Fri

  const booking = $('#booking');
  if (booking) {
    const today = startOfDay(new Date());
    const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = addMonths(firstMonth, MONTHS_AHEAD);

    const state = { session: null, date: null, time: null, month: firstMonth };

    const el = {
      cards: $$('.session-card'),
      selects: $$('.session-select'),
      steps: $$('.steps li'),
      monthLabel: $('#cal-month'),
      days: $('#cal-days'),
      prev: $('#cal-prev'),
      next: $('#cal-next'),
      hint: $('#panel-hint'),
      summary: $('#panel-summary'),
      sumSession: $('#sum-session'),
      sumDate: $('#sum-date'),
      sumTime: $('#sum-time'),
      sumPrice: $('#sum-price'),
      times: $('#panel-times'),
      slots: $('#time-slots'),
      form: $('#booking-form'),
      done: $('#panel-done'),
    };

    const isAvailable = d => d > today && AVAILABLE_WEEKDAYS.includes(d.getDay());

    const renderCalendar = () => {
      const m = state.month;
      el.monthLabel.textContent = monthLabel(m);
      el.prev.disabled = sameMonth(m, firstMonth);
      el.next.disabled = sameMonth(m, lastMonth);

      const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const leading = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7; // Monday first
      const frag = document.createDocumentFragment();

      for (let i = 0; i < leading; i++) {
        const blank = document.createElement('span');
        blank.className = 'cal-day is-empty';
        blank.setAttribute('aria-hidden', 'true');
        frag.appendChild(blank);
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(m.getFullYear(), m.getMonth(), day);
        const key = dateKey(d);
        const available = state.session && isAvailable(d);
        const node = document.createElement(available ? 'button' : 'span');
        node.className = 'cal-day';
        node.textContent = String(day);
        node.dataset.date = key;
        if (available) {
          node.type = 'button';
          node.classList.add('is-available');
          node.setAttribute('aria-label', longDate(d));
          node.addEventListener('click', () => selectDate(d));
        } else if (d < today) {
          node.classList.add('is-past');
        } else if (!state.session && isAvailable(d)) {
          node.classList.add('is-locked');
          node.title = 'Select a session type first';
          node.addEventListener('click', nudgeSessions);
        }
        if (key === dateKey(today)) node.classList.add('is-today');
        if (state.date && key === dateKey(state.date)) {
          node.classList.add('is-selected');
          node.setAttribute('aria-pressed', 'true');
        }
        frag.appendChild(node);
      }
      el.days.replaceChildren(frag);
    };

    const renderSteps = () => {
      const current = !state.session ? 1 : (!state.date || !state.time) ? 2 : 3;
      el.steps.forEach(li => {
        const n = Number(li.dataset.step);
        li.classList.toggle('is-done', n < current);
        li.classList.toggle('is-current', n === current);
        if (n === current) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
    };

    const renderPanel = () => {
      const s = state.session ? SESSIONS[state.session] : null;
      el.done.hidden = true;

      if (!s) {
        el.hint.textContent = 'Select a session type above, then pick a highlighted day.';
        el.summary.hidden = true; el.times.hidden = true; el.form.hidden = true;
        return;
      }

      el.summary.hidden = false;
      el.sumSession.textContent = `${s.name} · ${s.meta}`;
      el.sumPrice.textContent = s.price;
      el.sumDate.textContent = state.date ? longDate(state.date) : '—';
      el.sumTime.textContent = state.time ? `${state.time} (Europe/Madrid) · ${s.minutes} min` : '—';

      if (!state.date) {
        el.hint.textContent = 'Now pick a highlighted day on the calendar.';
        el.times.hidden = true; el.form.hidden = true;
        return;
      }

      el.times.hidden = false;
      el.slots.replaceChildren(...SLOTS.map(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'time-slot' + (state.time === t ? ' is-selected' : '');
        b.textContent = t;
        b.setAttribute('aria-pressed', String(state.time === t));
        b.addEventListener('click', () => { state.time = t; render(); el.form.querySelector('input')?.focus(); });
        return b;
      }));

      if (!state.time) {
        el.hint.textContent = `${longDate(state.date)} — choose a time.`;
        el.form.hidden = true;
        return;
      }

      el.hint.textContent = 'Almost there. Leave your details and the request is on its way.';
      el.form.hidden = false;
    };

    const render = () => { renderCalendar(); renderSteps(); renderPanel(); };

    function nudgeSessions() {
      el.cards.forEach(c => { c.classList.remove('is-nudge'); void c.offsetWidth; c.classList.add('is-nudge'); });
      el.hint.textContent = 'Choose a session type first — then the available days light up.';
      $('#sessions')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const selectSession = key => {
      state.session = key;
      state.date = null; state.time = null;
      el.cards.forEach(c => c.classList.toggle('is-selected', c.dataset.session === key));
      el.selects.forEach(b => { b.textContent = b.dataset.session === key ? 'Selected' : 'Select'; b.setAttribute('aria-pressed', String(b.dataset.session === key)); });
      render();
      booking.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const selectDate = d => {
      state.date = d; state.time = null;
      render();
    };

    el.selects.forEach(b => b.addEventListener('click', () => selectSession(b.dataset.session)));
    el.prev.addEventListener('click', () => { state.month = addMonths(state.month, -1); renderCalendar(); });
    el.next.addEventListener('click', () => { state.month = addMonths(state.month, 1); renderCalendar(); });

    el.form.addEventListener('submit', e => {
      e.preventDefault();
      if (!validate(el.form)) return;
      const s = SESSIONS[state.session];
      const data = new FormData(el.form);
      const subject = `Booking request: ${s.name} — ${longDate(state.date)} ${state.time}`;
      const body = [
        `Hi Alexia,`,
        ``,
        `I'd like to book a mentoring session.`,
        ``,
        `Session: ${s.name} (${s.meta})`,
        `Date: ${longDate(state.date)}`,
        `Time: ${state.time} Europe/Madrid (${s.minutes} min)`,
        `Price: ${s.price}`,
        ``,
        `Name: ${data.get('name')}`,
        `Email: ${data.get('email')}`,
        data.get('note') ? `Notes: ${data.get('note')}` : null,
        ``,
        `Thank you!`,
      ].filter(line => line !== null).join('\n');
      openMail(subject, body);
      el.done.hidden = false;
    });

    render();
  }

  /* --------------------------------------------------------- contact form */
  const contactForm = $('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!validate(contactForm)) return;
      const data = new FormData(contactForm);
      const interest = data.get('interest') || 'General enquiry';
      const subject = `${interest} — ${data.get('name')}`;
      const body = [
        `Hi Alexia,`,
        ``,
        `Interested in: ${interest}`,
        `Name: ${data.get('name')}`,
        `Email: ${data.get('email')}`,
        data.get('phone') ? `Phone: ${data.get('phone')}` : null,
        ``,
        data.get('message') || '',
      ].filter(line => line !== null).join('\n');
      openMail(subject, body);
      const note = $('#contact-note');
      if (note) note.textContent = 'Your email app should now be open with the message. If not, write to ' + CONTACT_EMAIL + '.';
    });
  }

  /* ------------------------------------------------------------- footer */
  const year = $('#year');
  if (year) year.textContent = String(Math.max(2026, new Date().getFullYear()));
})();
