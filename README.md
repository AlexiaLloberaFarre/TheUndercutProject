# The Undercut Project — alexiallobera.com

Personal website of **Alexia Llobera**: trackside motorsport engineer, high-performance coach, strategic consultant and speaker.

A static site (HTML, CSS, vanilla JavaScript) with no build step, designed to be hosted on GitHub Pages.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | The site: Home, About me, Career, Speaker, Mentoring, Contact |
| `assets/css/style.css` | Styles (carbon black / ivory / champagne gold brand) |
| `assets/js/main.js` | Navigation, career data, booking calendar, forms |
| `assets/img/` | Photos (see below) |
| `data/availability.json` | Your mentoring availability (days, windows, blocked dates, bookings) |
| `admin/index.html` | Private visual editor that generates `availability.json` |

## Brand

Racing edition: Wine Red (#4c0f12) with beige. Serif display type with handwritten accents, blurred red auras, a racing line that draws itself on scroll, a torn-paper call to action and a "save the date" booking calendar with a hand-drawn circle around the chosen day.

| Token | Hex | Use |
| --- | --- | --- |
| Wine Red | `#4c0f12` | Home, statement banner, torn-paper band, footer, primary buttons |
| Racing red | `#a4161a` | Handwriting, circles, underlines, racing line |
| Cream | `#f3ece1` | Page background, text on red |
| Beige | `#e9dfcf` | Career and Mentoring sections |
| Paper | `#fbf7f1` | Cards |
| Ink | `#1c0c0c` | Text |

All colours are CSS variables at the top of `assets/css/style.css`. Fonts: Cormorant Garamond (display), Manrope (text), Caveat (handwriting), Oswald (torn-paper statement).

## 1. Publish on GitHub Pages

1. In the repository go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. The site is published at `https://<user>.github.io/TheUndercutProject/` within a couple of minutes.
4. Optional custom domain (for example `alexiallobera.com`): add it in the same Pages screen and point the domain's DNS to GitHub Pages as instructed there.

## 2. Add your photos

Drop these files into `assets/img/` (JPG, ideally 1200 px wide or more). Until they exist, an elegant placeholder is shown automatically.

| File | Used in | Suggested crop |
| --- | --- | --- |
| `alexia-hero.jpg` | Home | Portrait, 4:5 |
| `alexia-about.jpg` | About me | Square, 1:1 |
| `alexia-speaker.jpg` | Speaker | Portrait, 3:4 |

## 3. Receiving contact and booking requests by email

Both the contact form and the mentoring booking form are sent through [FormSubmit](https://formsubmit.co) to **contact@alexiallobera.com**. No account is needed.

- The **first** submission triggers a one-time activation email to that inbox. Click the link in it once; every submission after that is delivered as an email.
- Booking requests arrive as a table with: session type, date, time, name, email, phone and notes.
- To use another address or provider, change `contactEmail` and `formEndpoint` at the top of `assets/js/main.js`.
- If sending ever fails, visitors are offered a direct email link as a fallback.

## 4. Managing your mentoring availability

Visitors see a calendar with your free days and the start times that fit the session they chose (90 min initial, 60 min follow-up). Everything is driven by `data/availability.json`:

```json
{
  "timezone": "Europe/Madrid",
  "bookingWindowDays": 60,
  "minNoticeHours": 24,
  "slotStepMinutes": 30,
  "weekly": { "mon": ["09:00-13:00", "15:00-18:00"], "tue": [], "...": [] },
  "dates":   { "2026-11-03": ["10:00-12:00"], "2026-11-04": [] },
  "blocked": ["2026-12-24", "2026-12-25"],
  "booked":  ["2026-11-03 10:00-11:30"]
}
```

- `weekly` — your usual free windows for each weekday.
- `dates` — overrides for specific days (an empty list means a day off).
- `blocked` — days that are never bookable (travel, race weeks, holidays).
- `booked` — confirmed sessions; those times disappear from the calendar.
- `minNoticeHours` hides slots that start too soon; `bookingWindowDays` limits how far ahead people can book.

### The easy way: the visual editor

Open `admin/index.html` on the published site (for example `https://<user>.github.io/TheUndercutProject/admin/`). It loads the current file, lets you click through weekdays, windows, blocked dates and bookings, previews the next 14 days, and gives you the updated JSON.

Then, in GitHub: open `data/availability.json` → pencil icon → paste → **Commit changes**. The live calendar updates within a minute or two.

> The editor page is not linked from the site and is marked `noindex`, but it is public like any file on GitHub Pages. It only generates text; nothing can be changed without committing to the repository.

## 5. Prices and session types

Edit the `SESSIONS` array at the top of `assets/js/main.js`:

| Session | Length | Price |
| --- | --- | --- |
| Initial session | 1 h 30 min | €200 |
| Follow-up session | 1 h | €180 |
| Pack of 5 sessions | 5 × 1 h | €750 |

## 6. Career, education and texts

The timeline is generated from the `CAREER`, `EDUCATION` and `EXTRAS` arrays in `assets/js/main.js`. All other texts live directly in `index.html`.

## Local preview

Any static server works, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
