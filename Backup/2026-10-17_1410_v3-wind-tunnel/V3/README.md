# V3 — Wind Tunnel edition

The third website for The Undercut Project, built from scratch as a futuristic,
electric-era motorsport design. Nothing from V1 or V2 is reused except the
content and the booking engine. Open `V3/index.html`.

## Design

- **Palette**: ice white and graphite with electric blue, ion cyan and volt lime.
  Light sections alternate with dark bands.
- **Type**: Michroma (display), Rajdhani (text), Share Tech Mono (data) and a
  single handwritten signature in Caveat.
- **Shapes**: chamfered cards, skewed "holo" photo frames with a cyan ghost,
  a blueprint grid, chevron flow bands between every section.

## Interaction

- **Wind-tunnel canvas** in the Home section: airflow lines stream across the
  page, bend around the cursor (or a finger on touch screens) and accelerate
  when you scroll fast.
- **Wireframe car** that draws itself on load, with a light sweep and a slight
  parallax to the mouse.
- **Pinned hero**: on desktop the rest of the page slides over the Home section
  like a blade; the footer is revealed from beneath at the end.
- **Side rail** navigation with numbered sectors (bottom dock on mobile).
- **Motorsport track**: the career as a horizontal, draggable, snapping track
  with a track-map of nodes, arrows and keyboard support.
- **Speaking topics** as selectable tabs; **offers** as selectable modules;
  magnetic buttons; counters that tick; reveal-on-scroll.
- **Booking**: the same calendar engine as V1/V2 (`data/availability.json`),
  or a payment/Teams scheduling link per offer from `data/booking.json`.
- **Contact** form delivered to contact@alexiallobera.com via FormSubmit (first
  submission needs the activation email), with a mailto fallback.

## Files

- `index.html`, `assets/css/style.css`, `assets/js/main.js`
- `assets/img/` — Alexia's own photographs only (no third-party pictures)
- `data/availability.json`, `data/booking.json` — same format as V1/V2 (the V1
  admin editor at `/admin/` can still produce them)
- The texts come from `V2/content/site-content.md`.

V1 stays at the repository root, V2 in `V2/`.
