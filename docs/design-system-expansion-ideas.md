# Design System Expansion — Candidate Styles

Context: the current trio (`design-system-integrated.jsx`) covers three distinct registers —

- **Sketch** — Linear + hand-drawn / editorial soft (IBM Plex Sans + Caveat, muted purple, 1px borders, zero shadow)
- **Prism** — Liquid glass + bento / ambient atmospheric (backdrop-blur, translucent layers, teal accent, light orbs)
- **Revolt** — Neobrutalist + Y2K / harsh defiant (Space Mono, 4px offset shadows, 2px #111 borders, lime + pink, zero radius)

Together they span "soft humane," "ambient atmospheric," and "harsh defiant." The strongest additions fill actual gaps next to those three — they don't recolor the same territory.

---

## Modern / emerging candidates

### Terminal / CLI revival
Monospace everywhere, ASCII box-drawings, cmd-K as the primary verb, amber or phosphor-green accents, information density treated as a feature instead of a problem. Warp, Linear's command culture, Tailscale admin.

**Why it's the strongest candidate:** none of the three current systems handles dense tabular/data-first surfaces well. If a dashboard ever ships, this is the missing system.

### Soft 3D / Claymorphism
Puffy opaque pastel surfaces, inset shadows, chunky rounded blobs. Where Prism is translucent and moody, this is opaque and tactile — "friendly depth." Figma Config-era brand, much of current Dribbble.

**Why it matters:** fills the "warm physical" slot Prism deliberately avoids.

### Editorial / long-form magazine
Display serifs, column-aware layouts, drop caps, pull-quotes, confident line-heights. The Browser Company's Dia, Are.na, the new NYT-ish crop.

**Distinct from Sketch because:** it's *confident* rather than casual — Hoefler, not Caveat.

### Spatial / Vision Pro–inspired
Committed 3D layers (not faked with blur), 24–32px corner radii, parallax-on-hover, "materials" as a named primitive.

**Distinct from Prism because:** it commits to depth rather than flattening into glass.

### Playful / character-driven
Duolingo's confrontationally joyful register: chunky primaries, mascots, reward micro-interactions, exaggerated bounce easing.

**Distinct from Revolt because:** Revolt is defiant; this is earnest. Consumer / learning / onboarding territory.

### Risograph / print-handmade
Duotone halftone, intentional misregistration, grain overlays, two-spot-color palettes. Dense Discovery, Readymag-template energy.

**Why it matters:** a texture vocabulary none of the three currently owns.

### Swiss / Rams-heritage functional
Grotesk-only, 8px grid enforced like a religion, one saturated accent, whitespace as the feature. Linear / Vercel DNA.

**Distinct from Sketch because:** Sketch has humanity, Swiss has none — and that's sometimes the point.

---

## Early-internet candidates

### Web 1.0 table-era (1995–98)
Times New Roman defaults, blue-underlined + purple-visited links, #C0C0C0 gray, `<hr>` dividers, no CSS to speak of. Craigslist / HN never actually left.

**Why it's interesting:** surprisingly shippable because it's fast and text-first. The only option in either list that doesn't assume typography, color, or composition is the main event — it assumes *content* is.

### Frutiger Aero (2005–12)
Glossy skeuomorphic buttons, bubble/bokeh/sky imagery, rounded-rect everything.

**Why now:** currently in a massive pop-culture revival, still mostly unclaimed in actual product UI — so it would read as new rather than nostalgic.

### Windows 95 / Chicago
Beveled 3D buttons with light/dark edges, pinstripe titlebars, dithered fills, MS Sans Serif.

**Distinct from Revolt because:** Win95 is *ergonomic* brutalism, not expressive brutalism. Completely different grammar.

### Classic Mac OS / System 7
Platinum grays, pixel-crisp icons, Chicago typeface, rainbow Apple.

**Distinct from Win95:** gentler and more design-led despite the same era.

### Skeuomorphic iOS 6 / Forstall-era
Leather stitching, felt, torn paper, wood grain, real-world metaphors (Notes as legal pad, Calendar with date tears).

**Distinct from Frutiger Aero because:** it's *material*, not *glossy*.

### BBS / ANSI / demoscene
CP437 block characters, scanline overlays, phosphor glow, starfields.

**Relationship to Terminal revival:** a more performative cousin — the terminal style productized, this one more experiential.

---

## Pairings to consider (rather than adding solo)

**Terminal revival + Swiss functional → one fourth system.**
Candidate names: *Relay*, *Plex*, *Console*. Data-dense, keyboard-first, no-nonsense sibling to the existing three. Probably more useful than shipping both separately.

**Frutiger Aero vs. Claymorphism → pick one, not both.**
They compete for the same "friendly opaque depth" slot and will fight each other for meaning in the system.

---

## Ranked shortlist

If forced to ship one at a time, rough priority:

1. **Terminal / Swiss hybrid** — biggest functional gap; covers data-dense surfaces the trio can't.
2. **Editorial magazine** — covers long-form content surfaces; contrasts cleanly with Sketch's informality.
3. **Web 1.0 table-era** — sharpest philosophical contrast to everything currently in the system; cheap to build; unique foil.
4. **Soft 3D / Claymorphism** — natural complement to Prism's atmospheric depth.
5. **Frutiger Aero** — highest cultural tailwind right now; commits you to a specific zeitgeist moment.

The rest (Spatial, Playful, Riso, Win95, Mac OS 7, iOS 6 skeuo, BBS) are more situational — ship them when a specific surface or product line calls for them, not as flagship systems.
