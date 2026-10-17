# Alexia Llobera — signature

Hand-drawn autograph for The Undercut Project, modelled on the pace of Susie
Wolff's signature: a big looping capital, a fast connected scrawl, and a long
sweep back underneath.

## Files

- `alexia-llobera-signature.svg` — the chosen base ("Trackside"). Fills with
  `currentColor`, so it takes the colour of the surrounding text (`color: …`).
- `alexia-llobera-signature-black.svg`, `-white.svg` — fixed-colour versions
  for documents and email signatures.
- `alexia-llobera-signature-black.png`, `-white.png` — transparent PNG, 2×.
- `alexia-llobera-signature-animated.svg` — the same signature drawn by the
  pen over 2.6 s when the file loads (SMIL animation, works inline or as `<img>`).
- `options/` — 20 variations (`01-…` to `20-…`), each as a static and an
  animated SVG, plus `sheet-a.png` / `sheet-b.png` contact sheets and
  `index.html`, a picker page with white, dark and cream backgrounds.

## Use on the websites

```html
<p class="sign" style="color:#a3261e"><img src="assets/img/signature.svg" alt="Alexia Llobera" width="300"></p>
```

or inline the SVG so it inherits `color` and can be animated on scroll.
