# The Undercut Project — alexiallobera.com

> **Status (17 Oct 2026):** V1 is finished and saved (tag `v1-three-editions`, branch `saved/v1-three-editions`, folder `Backup/`). A new website is being built from scratch in `V2/`; its content lives in `V2/content/`.

Personal website of **Alexia Llobera**: trackside motorsport engineer, high-performance coach, strategic consultant and speaker.

A static site (HTML, CSS, vanilla JavaScript) with no build step, designed to be hosted on GitHub Pages.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | The site: Home, About me, Motorsport, Speaker, Mentoring, Contact |
| `assets/css/style.css` | Styles (carbon black / ivory / champagne gold brand) |
| `assets/js/main.js` | Navigation, career data, booking calendar, forms |
| `assets/img/` | Photos (see below) |
| `data/availability.json` | Your mentoring availability (days, windows, blocked dates, bookings) |
| `admin/index.html` | Private visual editor that generates `availability.json` |
| `data/booking.json` | Scheduling-service links per offer (payment + Teams) |
| `Backup/` | Timestamped copies of the site, one per change |
| `scripts/backup.sh` | Creates those copies (runs automatically before each commit) |

## Two colour editions

The site ships with two palettes on the same content:

| Edition | How to open it | Palette |
| --- | --- | --- |
| Wine (default) | `index.html` | Wine red, black, cream |
| Warm Autumn (experiment) | `index-autumn.html`, or `index.html?theme=autumn` | Brick red, terracotta, paprika, gold, camel, chocolate, olive, petrol, from the colorimetry mood board |
| Motion (experiment) | `index-motion.html`, or `index.html?theme=motion` | Wine, beige and brown built on the long-exposure mood board: the board's photographs are the backdrops (`assets/img/motion/`), with drifting backgrounds, sweeping light streaks, blur-to-sharp reveals and a HUD layer (mono labels, bracket frames, grid, pulsing lights). Animations stop under the system's reduce-motion setting. |

All pages link to each other in the footer. To make another edition the default, add `data-theme="autumn"` or `data-theme="motion"` to the `<html>` tag of `index.html`. The palettes live in `assets/css/theme-autumn.css` and `assets/css/theme-motion.css`; `scripts/build-editions.sh` regenerates the edition pages from `index.html` after content changes.

## Brand

Racing edition: Wine Red with black and cream, after the "Pantone Tension" reference. Serif display type with black handwritten accents, blurred red auras, a racing line that draws itself on scroll, a chequered-flag band, Pantone-style chips for the championship titles, a torn-paper call to action and a "save the date" booking calendar with a hand-drawn circle around the chosen day.

| Token | Hex | Use |
| --- | --- | --- |
| Wine Red | `#4c0f12` | Home, statement banner, torn-paper band, footer, primary buttons, racing line |
| Black | `#121212` | Text, handwriting, circles, chequerboard |
| Cream | `#efe8db` | Page background, text on red, chequerboard |
| Beige | `#e6ddcc` | Career and Mentoring sections |
| Paper | `#f8f4ec` | Cards |

All colours are CSS variables at the top of `assets/css/style.css`. Fonts: Cormorant Garamond (display), Manrope (text), Caveat (handwriting), Oswald (torn-paper statement).

## 1. Publish on GitHub Pages

1. In the repository go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. The site is published at `https://<user>.github.io/TheUndercutProject/` within a couple of minutes.
4. Optional custom domain (for example `alexiallobera.com`): add it in the same Pages screen and point the domain's DNS to GitHub Pages as instructed there.

> The Motion backdrops are cropped from the reference pictures you supplied (other studios' posters and stock-style photographs). They are fine for comparing directions, but replace them with licensed or your own photography before the site goes public.

## 2. Add your photos

Drop these files into `assets/img/` (JPG, ideally 1200 px wide or more). Until they exist, an elegant placeholder is shown automatically.

| File | Used in | Suggested crop |
| --- | --- | --- |
| `alexia-hero.jpg` | Home | Portrait, 4:5 |
| `alexia-about.jpg` | About me | Square, 1:1 |
| `alexia-speaker.jpg` | Speaker | Portrait, 3:4 |
| `mentoring.jpg` | Mentoring, next to the calendar | Landscape, 16:9 |

### Career photos

Each entry of the Career timeline shows a photo on the right. Drop one picture per chapter into `assets/img/career/` (landscape, 4:3, about 1200 px wide). Until a file exists, a placeholder is shown with the expected file name under it.

| File | Chapter |
| --- | --- |
| `cadillac-f1.jpg` | Cadillac Formula 1 Team |
| `formula-e.jpg` | Formula E |
| `rallycross-tcr.jpg` | Rallycross and TCR |
| `hyundai-wrc.jpg` | Hyundai Motorsport, WRC |
| `x-raid-dakar.jpg` | X-raid, Dakar Rally |
| `coaching.jpg` | Coaching and consulting |

The file names are set in the `CAREER` array in `assets/js/main.js`.

## 3. Receiving contact and booking requests by email

Both the contact form and the mentoring booking form are sent through [FormSubmit](https://formsubmit.co) to **contact@alexiallobera.com**. No account is needed.

- The **first** submission triggers a one-time activation email to that inbox. Click the link in it once; every submission after that is delivered as an email.
- Booking requests arrive as a table with: session type, date, time, name, email, phone and notes.
- To use another address or provider, change `contactEmail` and `formEndpoint` at the top of `assets/js/main.js`.
- If sending ever fails, visitors are offered a direct email link as a fallback.

## 4. Bookings: availability, payment and Teams links

There are two ways to run the Mentoring calendar. You can use both at once: an offer with a scheduling link uses option A, the others use option B.

### A. Scheduling service (recommended: payment at booking + automatic Microsoft Teams link)

A static website cannot charge cards or create Teams meetings on its own, so this is handled by a scheduling service. Create one event per offer there, then paste the three links into `data/booking.json`:

```json
{
  "links": {
    "career":  "https://calendly.com/you/trackside-career-session",
    "student": "https://calendly.com/you/student-rate",
    "sprint":  "https://calendly.com/you/eight-week-sprint"
  },
  "note": "Pay securely when you book. Your confirmation email includes the Microsoft Teams link."
}
```

When a visitor picks that offer, the provider's booking page opens inside the site (with an "Open in a new tab" fallback). The provider then takes care of availability, payment, confirmation emails and the Teams link.

Services that cover all three needs:

| Service | Availability from Outlook | Payment at booking | Teams link created automatically | Notes |
| --- | --- | --- | --- | --- |
| Calendly (Standard plan) | Yes | Stripe or PayPal | Yes | Most common choice, polished embed |
| Zoho Bookings | Yes | Stripe, PayPal, others | Yes | Cheaper, slightly busier interface |
| Cal.com | Yes | Stripe (paid plan) | Yes | Open source, can be self-hosted |
| Microsoft Bookings (included with Microsoft 365 Business) | Yes | No native payments | Yes | Free if you already have Microsoft 365; shows prices but does not collect them |

Sign up with the Microsoft account you want the meetings created on (for example `alexia@zenithstrategy.io`), connect that Outlook calendar, set your working hours, create the three event types with their durations and prices, enable "Microsoft Teams" as the location and the payment integration, then copy each event's link into `data/booking.json`.

Calendly embeds pick up the site colours automatically; other providers show their own styling.

### B. Built-in calendar (no payments: you confirm by email)

Without a link, visitors see the built-in calendar with your free days and the start times that fit the session they chose (90 min career session, 60 min sprint session). Booking requests arrive by email and you reply with payment details and the meeting link yourself. Everything is driven by `data/availability.json`:

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

- `weekly` sets your usual free windows per weekday; `dates` overrides specific days (an empty list means a day off); `blocked` days are never bookable; `booked` sessions disappear from the calendar.
- `minNoticeHours` hides slots that start too soon; `bookingWindowDays` limits how far ahead people can book.

The easy way: open `admin/index.html` on the published site (for example `https://<user>.github.io/TheUndercutProject/admin/`). It loads the current file, lets you click through weekdays, windows, blocked dates and bookings, previews the next 14 days, and gives you the updated JSON. Then, in GitHub: open `data/availability.json`, click the pencil, paste, and commit. The live calendar updates within a minute or two.

> The editor page is not linked from the site and is marked `noindex`, but it is public like any file on GitHub Pages. It only generates text; nothing changes without a commit.

## 5. Prices and session types

Edit the `SESSIONS` array at the top of `assets/js/main.js`:

| Offer | What it includes | Price |
| --- | --- | --- |
| Trackside Career Session | 90 minutes plus a follow-up call | €250 |
| Student rate | Same session, two places a month | €150 |
| Eight-week sprint | Four sessions and message reviews | €700 |

## 6. Career, education and texts

The timeline is generated from the `CAREER`, `EDUCATION` and `EXTRAS` arrays in `assets/js/main.js`. All other texts live directly in `index.html`.

## Backups

Every change leaves a full copy of the site in `Backup/<date>_<time>_<label>/`, created automatically before each commit by `scripts/backup.sh`. To restore a version, copy that folder's contents over the repository root and commit. See `Backup/README.md`.

## Local preview

Any static server works, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Calendar, emails and Outlook

- **Availability**: Monday to Friday, 15:30–19:30 (Europe/Madrid). Everything
  else is blocked. Edit `data/availability.json` (or use `/admin/`) to change
  days, hours, holidays or already-booked slots. A 90-minute session can start
  from 15:30 to 18:00; a 60-minute one from 15:30 to 18:30.
- **Every booking request** sends one email to contact@alexiallobera.com with a
  copy to alexia@zenithstrategy.io, reply-to set to the client, and includes an
  **"add_to_outlook" link**: one click opens the slot prefilled in Alexia's
  Outlook calendar (title "The undercut project · session · client", Teams as
  location, client details in the body). The client gets an automatic
  acknowledgement by email.
- **Outlook category** "The undercut project" (dark red) exists in the
  alexia@zenithstrategy.io mailbox; apply it to the event when saving it.

### Fully automatic (recommended): Microsoft Bookings

A static website cannot write into an Outlook calendar by itself. Microsoft
Bookings (included in Microsoft 365 Business) does exactly that:

1. In Microsoft 365, open **Bookings** and create a booking page named
   **The Undercut Project** (staff: Alexia, alexia@zenithstrategy.io).
2. Add three services: *Trackside Career Session* (90 min, €250), *Student
   rate* (90 min, €150), *Eight-week sprint — first session* (60 min, €700).
   Turn on **Add online meeting** (Teams) for each.
3. Set the business hours to Mon–Fri 15:30–19:30 and the buffer / lead time
   you want. Bookings reads your Outlook free/busy automatically.
4. Enable email confirmations and reminders to customer and staff.
5. Copy each service's booking page link into `data/booking.json` under
   `links` (`career`, `student`, `sprint`). From then on the website opens the
   Bookings page for that offer: the event lands in your Outlook calendar, both
   of you receive the email, and the Teams link is created automatically.

Payment at booking time is not part of Bookings; keep sending payment details
by email, or use Calendly (also syncs with Outlook and Teams) with Stripe or
PayPal if you want to charge before confirming.
