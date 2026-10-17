# The Undercut Project — Alexia Llobera

Personal site for Alexia Llobera: trackside motorsport engineer, high-performance coach and speaker.

Static site, no build step and no dependencies. Open `index.html` in a browser or serve the folder with any static host (GitHub Pages works as is).

## Files

| File | What it is |
| --- | --- |
| `index.html` | The site, Wine edition (default). |
| `index-autumn.html` | The same site in the Warm Autumn edition. Generated from `index.html` by `build.sh`. |
| `styles.css` | All styling. Edition colours are the tokens at the top of the file. |
| `script.js` | Navigation, reveal-on-scroll, the booking flow and the contact form. |
| `assets/` | Images. Put the hero portrait at `assets/portrait.jpg`. |

## Editing

- Change text in `index.html`, then run `./build.sh` so the Autumn edition picks it up.
- Colours and fonts live in the `:root` and `[data-edition="autumn"]` blocks at the top of `styles.css`.
- Mentoring availability (weekdays, time slots, months ahead) is set at the top of the booking section in `script.js`.

## Forms

Both the booking request and the contact form open the visitor's email app with a pre-filled message to contact@alexiallobera.com. To receive submissions without relying on the visitor's email app, point the forms at a form service such as Formspree or Netlify Forms.
