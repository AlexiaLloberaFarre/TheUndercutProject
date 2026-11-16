# V2 — Race Weekend edition

The second website for The Undercut Project, built from scratch on the racing
reference pictures (start lights, light trails, tachometer, kerbs, pit lane).
Open `V2/index.html`; nothing from the V1 design is reused, only the content.

## What is in the page

- **Start-lights loader** — the five F1 lights come on one by one, then go out
  and the page starts.
- **HUD** — a lap clock, the current sector (section) and a thin red progress
  bar across the top; a red light-dot cursor on desktop.
- **Home** — tachometer backdrop with light-trail streaks, the name rising in,
  the pit-wall photo in a viewfinder frame with 3D tilt, the handwritten red
  signature, telemetry counters and a disciplines ticker.
- **About me** — the verbatim text, the garage photo, and the honours as podium
  cards (three FIA titles, three first times).
- **Statement** — full-bleed light trails: "Strategy is the undercut."
- **Motorsport** — the career as a glowing red timeline ("laps"), education and
  beyond-the-paddock entries.
- **Speaker** — stage photo, formats, languages and a tap-to-expand topics list.
- **Mentoring** — the three offers (€250 / €150 student / €700 sprint), the
  booking calendar driven by `data/availability.json`, or a payment/Teams
  scheduling link per offer from `data/booking.json`.
- **Contact** — form delivered to contact@alexiallobera.com via FormSubmit
  (first submission needs the activation email), with a mailto fallback.
- Red/bone kerb bands between every section.

## Files

- `index.html`, `assets/css/style.css`, `assets/js/main.js`
- `assets/img/` — Alexia's photographs; `assets/img/bg/` — atmosphere pictures
  made from the reference images (**third-party, replace before going live**)
- `data/availability.json`, `data/booking.json` — same format as V1 (the V1
  admin editor at `/admin/` can still be used to produce them)
- `content/site-content.md` — the design-independent source of all texts

The V1 website (Wine, Warm Autumn and Motion editions) stays at the repository
root, in `Backup/`, on the git tag `v1-three-editions` and on the branch
`saved/v1-three-editions`.
