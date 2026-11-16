# Marcus McNeal — Senior Game Engineer Portfolio

A single-page portfolio presented as a AAA military-shooter title screen: war photography behind the whole page, a live combat FX layer (smoke, embers, tracer fire, explosions), a game-client loader and HUD-style UI throughout.

**Stack:** Vite · Three.js (custom GLSL FX layer) · GSAP (ScrollTrigger, SplitText, ScrambleText, EasePack) · Lenis

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/ — deploy to Vercel, Netlify, GitHub Pages, S3…
npm run preview  # serve the production build locally
```

## What's on the page

| Part | What it does |
|---|---|
| Loader | Game-client deploy screen over full-screen war key art (cycling squad / tank fire / silhouettes): CSS-3D gyroscope with the MM crest, hazard-striped progress bar with sparks, deployment checklist, live FPS/ping, intel tips, "Any key — Deploy", blast doors opening onto the hero |
| Combat FX layer | Transparent WebGL over the photo: battle smoke lit from below, two depth layers of embers, tracer bursts and anti-air streams; explosion cues every few seconds trigger a distant flash, an edge-burn surge and camera shake (bigger blasts add a white-hot flash) |
| Hero (title screen) | Full-bleed night squad with flares, mouse parallax; name as the game logo; tagline, description and stats; in-game kill feed of engineering wins; compass HUD |
| Theaters of war | Character-select panels: **Infantry** (gunplay & hit registration), **Armor** (vehicles & destruction), **Command** (128-player battles & servers); engine-experience plates |
| Briefing | Pinned: the multiplayer match route draws itself; objectives light up |
| Loadout | Skill cards with rarity colours and mastery bars, 3D tilt + cursor spotlight |
| Skill board | Game stat sheet: OVR player card, animated hexagon radar, tabbed skills (Engines, Languages, Gameplay, Online, Backend, Tools) with S/A/B ranks, 10-segment level bars and years |
| Missions | Pinned horizontal gallery: Ironfront (combined arms), Black Ridge (extraction), Steel Rain (tanks), Pulse (matchmaking), Recon (telemetry) |
| Service record | Timeline with rank chevrons |
| Global | Crosshair cursor with recoil, magnetic buttons, HUD corner brackets, edge burn, auto-hiding game-client nav with player card, film grain |

Phones get a vertical layout and lighter FX; `prefers-reduced-motion` slows the FX and disables decorative loops, flashes and shake. Without WebGL the photo backdrop still shows.

## Make it yours

Everything personal lives in `index.html` and `src/main.js`. Placeholders:

- `hello@yourdomain.com` — the copy-email button (`data-email` and label)
- `Studio Name` — service record
- Social links — `https://github.com/`, `https://linkedin.com/`, `https://itch.io/`
- Stats, mastery values, mission names, KPIs, theater bullets and engine levels are **sample content** — replace them with your real work.

Other knobs:

- **Kill feed lines:** `FEED` in `src/main.js` (`[actor, icon, victim, 'hs me']`).
- **Skill board:** `ATTRS` (radar values) and `SKILLS` (`[skill, grade, years, level/10, detail]` per tab) in `src/main.js`; OVR number via `data-count` in `index.html`.
- **Combat intensity:** burst / flash timings, tracer and ember counts in `src/scene.js`; explosion look in `onFlash()` in `src/main.js`.
- **Colours:** CSS tokens at the top of `src/style.css` (`--accent`, `--accent-2`, `--hot`).
- **Loader text:** `STAGES` and `TIPS` in `src/main.js`.
- **Logo options:** `public/brand/options.html` (four MM monograms; the Vanguard Crest is applied).

## Images

War photos are from [Pexels](https://www.pexels.com) (free to use under the Pexels License) and stored in `public/img/`. The profile photo is hot-linked from [Unsplash](https://unsplash.com). Swap in your own game screenshots or key art whenever you can — real work beats stock.
