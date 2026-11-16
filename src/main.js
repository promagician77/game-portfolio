import './style.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { RoughEase } from 'gsap/EasePack';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, RoughEase);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ------------------------------------------------------------------ */
/* Cinematic FX layer (lazy-loaded so the loader paints immediately)   */
/* ------------------------------------------------------------------ */
let sceneApi = null;
const sceneReady = import('./scene.js')
  .then(({ createScene }) => {
    sceneApi = createScene($('#webgl'), { reducedMotion, onFlash: () => onFlash() });
    document.documentElement.classList.add('webgl-on');
    $('#preloader')?.classList.add('is-scene');
  })
  .catch((err) => {
    console.warn('WebGL unavailable, using fallback background.', err);
    document.documentElement.classList.add('no-webgl');
  });

/* ------------------------------------------------------------------ */
/* Smooth scrolling                                                    */
/* ------------------------------------------------------------------ */
const lenis = new Lenis({ duration: 1.15, smoothWheel: !reducedMotion, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = a.getAttribute('href');
    if (target.length < 2) return;
    e.preventDefault();
    closeMenu();
    lenis.scrollTo(target, { offset: 0, duration: 1.6 });
  });
});

/* ------------------------------------------------------------------ */
/* Headline split + gradient fix                                       */
/* ------------------------------------------------------------------ */
const heroSplit = new SplitText('#hero-title', { type: 'chars', charsClass: 'char' });

/* Split pieces are transformed individually, which breaks background-clip:text on
   the parent. Give every piece the same gradient, offset so it reads as one sweep. */
function gradientFix() {
  $$('.gradient-text').forEach((g) => {
    const pieces = $$('.char', g).length ? $$('.char', g) : $$('.word', g);
    if (!pieces.length) return;
    const gr = g.getBoundingClientRect();
    pieces.forEach((c) => {
      const cr = c.getBoundingClientRect();
      c.classList.add('gradient-piece');
      // horizontal only: pieces may be mid-reveal (translated on Y) when measured
      c.style.backgroundSize = `${gr.width}px 100%`;
      c.style.backgroundPosition = `${gr.left - cr.left}px 0`;
    });
  });
}
window.addEventListener('resize', () => requestAnimationFrame(gradientFix));

/* ------------------------------------------------------------------ */
/* Loader: game-client deploy screen                                   */
/* ------------------------------------------------------------------ */
const STAGES = [
  [0, 'Establishing uplink'],
  [16, 'Authenticating operator'],
  [34, 'Equipping loadout'],
  [52, 'Streaming map: Sector 7'],
  [70, 'Syncing server tick'],
  [86, 'Assembling squad'],
  [100, 'Deployment ready'],
];
const TIPS = [
  'Never trust the client.',
  'Lag compensation rewinds time — fairly.',
  'Fixed tick + deterministic sim = fair fights.',
  'Idempotent rewards mean no duplicated loot.',
  'Watch p99 tick time, not the average.',
  'Predict locally, reconcile with the server.',
];

function runPreloader() {
  const pre = $('#preloader');
  const fill = $('#ld-fill');
  const edge = $('#ld-edge');
  const sparks = $('#ld-sparks');
  const countEl = $('#preloader-count');
  const stageEl = $('#ld-stage');
  const tipEl = $('#ld-tip');
  const items = $$('#ld-list li');

  // fake-but-honest client telemetry: FPS is measured, ping jitters
  let frames = 0, last = performance.now();
  const fpsEl = $('#ld-fps'), pingEl = $('#ld-ping');
  const meter = () => {
    frames++;
    const now = performance.now();
    if (now - last > 500) {
      fpsEl.textContent = Math.round((frames * 1000) / (now - last));
      pingEl.textContent = 24 + ((Math.random() * 9) | 0);
      frames = 0; last = now;
    }
  };
  gsap.ticker.add(meter);

  // full-screen key art: War → Horror → Fighting while assets stream
  const arts = $$('.loader__art-img');
  let artIndex = 0;
  const artTimer = setInterval(() => {
    arts[artIndex].classList.remove('is-active');
    artIndex = (artIndex + 1) % arts.length;
    arts[artIndex].classList.add('is-active');
  }, 1300);

  let tipIndex = 0;
  const tipTimer = setInterval(() => {
    tipIndex = (tipIndex + 1) % TIPS.length;
    gsap.to(tipEl, { duration: 0.6, scrambleText: { text: TIPS[tipIndex], chars: '01#/\\_', speed: 0.8 } });
  }, 1800);

  const counter = { v: 0 };
  let lastSpark = 0;
  const spark = (pct) => {
    const now = performance.now();
    if (now - lastSpark < 45 || reducedMotion) return;
    lastSpark = now;
    for (let i = 0; i < 2; i++) {
      const s = document.createElement('i');
      s.style.left = pct + '%';
      sparks.appendChild(s);
      gsap.fromTo(s, { x: 0, y: 0, opacity: 1 }, {
        x: -10 - Math.random() * 50, y: (Math.random() - 0.5) * 50, opacity: 0, duration: 0.45 + Math.random() * 0.3, ease: 'power2.out',
        onComplete: () => s.remove(),
      });
    }
  };
  const render = () => {
    const v = counter.v;
    fill.style.width = v + '%';
    edge.style.left = v + '%';
    countEl.textContent = String(Math.round(v)).padStart(3, '0');
    let label = STAGES[0][1];
    for (const [at, text] of STAGES) if (v >= at) label = text;
    if (stageEl.textContent !== label) stageEl.textContent = label;
    items.forEach((li, i) => {
      const at = +li.dataset.at;
      const next = items[i + 1] ? +items[i + 1].dataset.at : 100;
      li.classList.toggle('is-done', v >= next);
      li.classList.toggle('is-active', v >= at && v < next);
    });
    spark(v);
  };

  const pageLoaded = new Promise((r) => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
  const minTime = new Promise((r) => setTimeout(r, reducedMotion ? 200 : 2200));
  // asset-streaming feel: fast bursts, short stalls
  const countTween = gsap.to(counter, { v: 86, duration: 2.6, ease: 'rough({ strength: 1.2, points: 14, template: power1.out, taper: none, randomize: true, clamp: true })', onUpdate: render });

  Promise.all([pageLoaded, minTime, sceneReady]).then(() => {
    countTween.kill();
    gsap.to(counter, {
      v: 100, duration: 0.5, ease: 'power2.out', onUpdate: render,
      onComplete: () => {
        clearInterval(tipTimer);
        clearInterval(artTimer);
        arts.forEach((a, i) => a.classList.toggle('is-active', i === 0));
        readyToDeploy(pre, meter);
      },
    });
  });
}

function readyToDeploy(pre, meter) {
  pre.classList.add('is-ready');
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', go);
    pre.removeEventListener('pointerdown', go);
    gsap.ticker.remove(meter);
    deploy(pre);
  };
  window.addEventListener('keydown', go);
  pre.addEventListener('pointerdown', go);
  setTimeout(go, reducedMotion ? 100 : 1300); // auto-continue: never block the visitor
}

function deploy(pre) {
  const finish = () => { pre.remove(); lenis.start(); };
  if (reducedMotion) {
    const intro = heroIntro();
    document.documentElement.classList.remove('is-loading');
    gsap.timeline().to(pre, { opacity: 0, duration: 0.4 }).add(intro, 0).add(finish);
    return;
  }
  const intro = heroIntro(); // sets the hero's hidden start state immediately…
  document.documentElement.classList.remove('is-loading'); // …so it's safe to unhide the page
  gsap.timeline()
    // UI glitches out
    .to('.loader__ui', { x: 6, duration: 0.05, repeat: 5, yoyo: true, ease: 'steps(1)' })
    .to('.loader__ui', { autoAlpha: 0, filter: 'blur(6px)', duration: 0.25 }, '-=0.1')
    .to('.loader__flash', { opacity: 0.8, duration: 0.06 }, '<')
    .to('.loader__flash', { opacity: 0, duration: 0.5 })
    .to('.loader__seam', { opacity: 0, duration: 0.2 }, '<')
    // blast doors open; the hero intro plays through the opening
    .addLabel('open', '<')
    .to('.loader__art', { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, 'open')
    .to('.loader__door--l', { xPercent: -62, duration: 1.2, ease: 'expo.inOut' }, 'open')
    .to('.loader__door--r', { xPercent: 62, duration: 1.2, ease: 'expo.inOut' }, 'open')
    .add(intro, 'open+=0.45')
    .add(finish, 'open+=1.2'); // unlock scrolling as soon as the doors clear
}

function heroIntro() {
  const tl = gsap.timeline();
  tl.from(heroSplit.chars, { yPercent: 120, opacity: 0, duration: 1, stagger: 0.035, ease: 'expo.out' })
    .from('[data-hero]', { y: 30, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, '-=0.8')
    .from(['.nav', '.compass', '.hud-frame'], { opacity: 0, duration: 0.8, ease: 'power3.out' }, '<')
    .from('.player__xp i', { scaleX: 0, duration: 1.4, ease: 'power3.out' }, '<')
    .add(() => resetKillfeed(), '-=0.4');
  tl.fromTo('.backdrop__imgs', { scale: 1.18 }, { scale: 1, duration: 2.8, ease: 'expo.out' }, 0);
  if (sceneApi) tl.from(sceneApi.state, { intensity: 0, duration: 2.4, ease: 'power2.out' }, 0);
  return tl;
}

/* ------------------------------------------------------------------ */
/* Kill feed: engineering wins, shown like an in-game feed             */
/* ------------------------------------------------------------------ */
const FEED = [
  ['McNeal', 'rifle', 'Lag Spike', 'hs me'],
  ['Rollback', 'rewind', 'Desync', ''],
  ['Anti-Cheat', 'shield', 'Speed Hack 0x3F', 'hs'],
  ['McNeal', 'grenade', 'Packet Loss', 'me'],
  ['Autoscaler', 'server', 'Queue Time', ''],
  ['Lag Comp', 'crosshair', 'Ghost Hit', 'hs'],
  ['McNeal', 'knife', 'Memory Leak', 'me'],
  ['Relevancy', 'eye', 'Bandwidth Spike', ''],
  ['McNeal', 'rifle', 'Rubber-banding', 'hs me'],
];

const ICONS = {
  rifle: '<path fill="currentColor" d="M1 11h13l2-2h6v3h-4l-2 2H9l-1.2 4H5l1-4H1z"/>',
  rewind: '<path fill="currentColor" d="M11 5 3 12l8 7zM21 5l-8 7 8 7z"/>',
  shield: '<path fill="currentColor" d="M12 2 20 5v6c0 5.5-3.6 9-8 11-4.4-2-8-5.5-8-11V5z"/>',
  grenade: '<path fill="currentColor" d="M10 2h5v3h-5zM14.5 4.5l3-2 1 1.2-3 2zM12.5 7a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z"/>',
  server: '<path fill="currentColor" d="M3 3h18v7H3zm0 11h18v7H3z"/><path fill="#000" d="M6 6h3v1.5H6zm0 11h3v1.5H6z"/>',
  crosshair: '<g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 1v6M12 17v6M1 12h6M17 12h6"/></g>',
  knife: '<path fill="currentColor" d="M2 14 16 6l6 1-3 4L4 17zM1.5 14.5l2.5 2.5-2 2-1.5-3z"/>',
  eye: '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/></g><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
  hs: '<g fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="8"/></g><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
};
const iconSVG = (name, cls) => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

let kfTimer = null;
let kfIndex = 0;
function pushKill() {
  const list = $('#feed');
  const [a, icon, v, flags] = FEED[kfIndex++ % FEED.length];
  const li = document.createElement('li');
  li.className = 'kf' + (flags.includes('me') ? ' kf--me' : '');
  li.innerHTML = `<span class="kf__a">${a}</span>${iconSVG(icon, 'kf__icon')}${flags.includes('hs') ? iconSVG('hs', 'kf__hs') : ''}<span class="kf__v">${v}</span>`;
  list.prepend(li);
  gsap.fromTo(li, { x: 70, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'power3.out' });
  gsap.fromTo(li, { filter: 'brightness(2.4)' }, { filter: 'brightness(1)', duration: 0.7 });
  gsap.to(li, { opacity: 0, x: 24, duration: 0.6, delay: 8, onComplete: () => li.remove() });
  while (list.children.length > 6) list.lastElementChild.remove();
}
function resetKillfeed() {
  const list = $('#feed');
  if (!list) return;
  clearInterval(kfTimer);
  list.innerHTML = '';
  kfIndex = 0;
  for (let k = 0; k < 4; k++) setTimeout(pushKill, 120 + k * 200);
  kfTimer = setInterval(pushKill, 1800);
}

/* ------------------------------------------------------------------ */
/* Theaters of war: character-select panels                            */
/* ------------------------------------------------------------------ */
function theaters() {
  const panels = $$('.genre');
  const open = (g) => panels.forEach((x) => x.classList.toggle('is-open', x === g));
  panels.forEach((g) => {
    g.addEventListener('mouseenter', () => { if (finePointer) open(g); });
    g.addEventListener('click', () => open(g));
  });
}

/* ------------------------------------------------------------------ */
/* Explosions: distant flash, edge burn surge, camera shake            */
/* ------------------------------------------------------------------ */
function shake(power = 6) {
  gsap.fromTo(['.backdrop__imgs', '#webgl'], { x: 0, y: 0 }, {
    keyframes: [{ x: power, y: -power * 0.6 }, { x: -power * 0.8, y: power * 0.5 }, { x: power * 0.5, y: power * 0.3 }, { x: 0, y: 0 }],
    duration: 0.34, ease: 'none', overwrite: 'auto',
  });
}
function onFlash() {
  if (reducedMotion) return;
  const flash = $('.backdrop__flash');
  const x = 15 + Math.random() * 70;
  const big = Math.random() < 0.35;
  flash.style.background = `radial-gradient(${big ? 80 : 60}vmax ${big ? 45 : 32}vmax at ${x}% 100%, rgba(255, 120, 30, ${big ? 0.7 : 0.5}), transparent 65%)`;
  gsap.timeline().to(flash, { opacity: 1, duration: 0.07 }).to(flash, { opacity: 0, duration: big ? 1.8 : 1.3, ease: 'power2.out' });
  gsap.timeline().to('.screen-fx__burn', { filter: `brightness(${big ? 2.8 : 2})`, duration: 0.1 }).to('.screen-fx__burn', { filter: 'brightness(1)', duration: 1.3 });
  if (big) gsap.timeline().set('.screen-fx__blink', { background: '#ffd2a0' }).to('.screen-fx__blink', { opacity: 0.12, duration: 0.05 }).to('.screen-fx__blink', { opacity: 0, duration: 0.4 });
  shake(big ? 9 : 4);
}

/* ------------------------------------------------------------------ */
/* Backdrop: dims while reading, parallax with the mouse               */
/* ------------------------------------------------------------------ */
function backdropScroll() {
  gsap.to('.backdrop__dim', { opacity: 0.55, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('.backdrop__dim', { opacity: 0.25, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'top top', scrub: true } });
  if (sceneApi) {
    gsap.to(sceneApi.state, { intensity: 0.85, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => { sceneApi.state.scroll = self.progress; } });
  }
  if (finePointer && !reducedMotion) {
    const x = gsap.quickTo('.backdrop__imgs', 'x', { duration: 1.4, ease: 'power3.out' });
    const y = gsap.quickTo('.backdrop__imgs', 'y', { duration: 1.4, ease: 'power3.out' });
    window.addEventListener('pointermove', (e) => { x((e.clientX / window.innerWidth - 0.5) * -26); y((e.clientY / window.innerHeight - 0.5) * -16); }, { passive: true });
  }
}

function compass() {
  const strip = $('#compass');
  const degEl = $('#compass-deg');
  if (!strip) return;
  const PX = 6; // px per degree
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  let html = '';
  for (let d = 0; d < 1080; d += 5) {
    const n = d % 360;
    const label = n % 15 === 0 ? (names[n] ?? n) : '';
    html += `<span class="${n % 15 === 0 ? 'major' : ''} ${names[n] !== undefined ? 'cardinal' : ''}">${label !== '' ? `<em>${label}</em>` : ''}</span>`;
  }
  strip.innerHTML = html;
  const win = strip.parentElement;
  const heading = { v: 180, target: 180 };
  window.addEventListener('pointermove', (e) => { heading.target = 180 + ((e.clientX / window.innerWidth) * 2 - 1) * 55; }, { passive: true });
  gsap.ticker.add(() => {
    heading.v += (heading.target - heading.v) * 0.06;
    const deg = ((heading.v % 360) + 360) % 360;
    strip.style.transform = `translateX(${win.clientWidth / 2 - (deg + 360) * PX}px)`;
    degEl.textContent = String(Math.round(deg)).padStart(3, '0');
  });
}


/* ------------------------------------------------------------------ */
/* Skill board: radar + tabbed stat sheet                              */
/* ------------------------------------------------------------------ */
const ATTRS = [
  ['GPL', 'Gameplay', 92],
  ['NET', 'Netcode', 98],
  ['BCK', 'Backend', 93],
  ['ENG', 'Engines', 95],
  ['GFX', 'Graphics', 80],
  ['TLS', 'Tools', 88],
];
// [skill, grade, years, level /10, detail]
const SKILLS = {
  Engines: [
    ['Unreal Engine 5', 'S', 8, 10, 'C++, Gameplay Ability System, replication, Niagara, World Partition'],
    ['Unity', 'S', 8, 9.5, 'C#, DOTS / ECS, Netcode for GameObjects, HDRP & URP'],
    ['Custom C++ engines', 'A', 6, 9, 'ECS architecture, deterministic simulation, job systems'],
    ['Console platforms', 'A', 5, 8.5, 'PlayStation 5, Xbox Series, Switch — cert, memory & perf budgets'],
    ['In-house engine work', 'A', 4, 8.5, 'Porting gameplay frameworks and netcode between proprietary engines'],
    ['Godot', 'B', 3, 7, 'GDScript, C#, high-level multiplayer API'],
  ],
  Languages: [
    ['C++', 'S', 10, 10, 'Modern C++17/20, memory & cache-aware code, templates'],
    ['C#', 'S', 8, 9.5, 'Unity gameplay, tools, async & jobs'],
    ['Go', 'A', 5, 9, 'Matchmaking, game services, gRPC'],
    ['Rust', 'A', 3, 8, 'Telemetry pipelines, high-throughput services'],
    ['Python', 'A', 7, 8.5, 'Build tooling, automation, data analysis'],
    ['HLSL / GLSL', 'B', 5, 7.5, 'Gameplay VFX, post-process, compute'],
  ],
  Gameplay: [
    ['Combat & ability systems', 'S', 7, 9.5, 'Hit detection, damage pipelines, GAS-style abilities'],
    ['Input buffering & frame data', 'S', 5, 9.5, 'Motion parsing, cancels, hitstop, frame-accurate timing'],
    ['Game AI', 'S', 6, 9, 'Behavior trees, utility AI, AI directors, nav mesh'],
    ['Character movement & physics', 'A', 7, 9, 'Networked movement, vehicles, ragdolls'],
    ['Cameras & game feel', 'A', 6, 8.5, 'Screen shake, aim assist, camera rigs'],
    ['Animation systems', 'A', 5, 8, 'Montages, IK, root motion, blend spaces'],
  ],
  Online: [
    ['Rollback netcode', 'S', 5, 10, 'Deterministic sim, prediction windows, desync detection'],
    ['Prediction & reconciliation', 'S', 7, 10, 'Client-side prediction, server correction, smoothing'],
    ['Lag compensation', 'S', 6, 9.5, 'Server-side rewind, hit validation, favor-the-shooter tuning'],
    ['Replication & relevancy', 'S', 7, 9.5, 'Delta snapshots, interest management, bandwidth budgets'],
    ['Matchmaking & MMR', 'A', 5, 9, 'Glicko/TrueSkill-style ratings, parties, backfill'],
    ['Anti-cheat & authority', 'A', 5, 9, 'Server authority, input validation, telemetry signals'],
  ],
  Backend: [
    ['Dedicated server fleets', 'S', 6, 9.5, 'Agones, GameLift, warm pools, regional autoscaling'],
    ['Kubernetes & Docker', 'A', 6, 9, 'Headless server images, rollouts between matches'],
    ['Live ops & economy', 'A', 5, 9, 'Inventories, stores, battle passes, idempotent rewards'],
    ['PostgreSQL & Redis', 'A', 7, 9, 'Player data, leaderboards, sessions, caching'],
    ['Kafka & event pipelines', 'A', 4, 8.5, 'Match events, analytics, exactly-once processing'],
    ['UDP / gRPC / WebSockets', 'A', 7, 9, 'Custom transports, service APIs, realtime presence'],
  ],
  Tools: [
    ['Profiling & optimisation', 'S', 8, 9.5, 'Unreal Insights, PIX, RenderDoc, Tracy, tick budgets'],
    ['Perforce & Git', 'S', 9, 9, 'Large-repo workflows, branching for live games'],
    ['CI/CD & build farms', 'A', 6, 9, 'Automated builds, cook pipelines, test gates'],
    ['Editor tooling', 'A', 6, 9, 'Hitbox editors, designer tools, data validation'],
    ['Telemetry & dashboards', 'A', 4, 8.5, 'ClickHouse, Grafana, balance & crash analytics'],
    ['Automated testing & bots', 'A', 4, 8, 'Soak tests, headless bot matches, regression suites'],
  ],
};

function buildRadar() {
  const svg = $('#radar');
  if (!svg) return;
  const cx = 150, cy = 150, R = 104, n = ATTRS.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = (r) => ATTRS.map((_, i) => pt(i, typeof r === 'function' ? r(i) : r).map((v) => v.toFixed(1)).join(',')).join(' ');
  let html = '';
  [0.25, 0.5, 0.75, 1].forEach((f) => (html += `<polygon class="radar__ring${f === 1 ? ' radar__ring--outer' : ''}" points="${poly(R * f)}"/>`));
  ATTRS.forEach((_, i) => { const [x, y] = pt(i, R); html += `<line class="radar__axis" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
  html += `<polygon class="radar__shape" points="${poly((i) => (R * ATTRS[i][2]) / 100)}"/>`;
  ATTRS.forEach((a, i) => {
    const [x, y] = pt(i, (R * a[2]) / 100);
    html += `<circle class="radar__dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`;
    const [lx, ly] = pt(i, R + 26);
    html += `<text class="radar__label" x="${lx.toFixed(1)}" y="${(ly - 6).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${a[0]}</text>`;
    html += `<text class="radar__val" x="${lx.toFixed(1)}" y="${(ly + 8).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${a[2]}</text>`;
  });
  svg.innerHTML = html;
  gsap.from(svg.querySelectorAll('.radar__shape, .radar__dot'), {
    scale: 0, svgOrigin: `${cx} ${cy}`, duration: 1.4, ease: 'expo.out', stagger: 0.05,
    scrollTrigger: { trigger: svg, start: 'top 85%', once: true },
  });
  $('#board-attrs').innerHTML = ATTRS.map(([k, name, v]) =>
    `<li><em>${k}</em><span>${name}</span><b>${v}</b><span class="mastery__bar"><i data-bar="${v}"></i></span></li>`).join('');
}

function buildBoard() {
  const tabs = $('#board-tabs');
  const list = $('#board-list');
  if (!tabs || !list) return;
  const names = Object.keys(SKILLS);
  tabs.innerHTML = names.map((n, i) =>
    `<button class="board__tab${i === 0 ? ' is-active' : ''}" role="tab" aria-selected="${i === 0}" data-tab="${n}" data-cursor>${n}<i>${SKILLS[n].length}</i></button>`).join('');
  const segs = (lvl) => Array.from({ length: 10 }, (_, i) => `<i class="${lvl >= i + 1 ? 'on' : lvl > i ? 'half' : ''}"></i>`).join('');
  const render = (name, animate = true) => {
    list.innerHTML = SKILLS[name].map(([skill, grade, yrs, lvl, detail]) => `
      <div class="skill">
        <span class="grade grade--${grade.toLowerCase()}">${grade}</span>
        <div class="skill__main"><b>${skill}</b><span>${detail}</span></div>
        <div class="skill__bar" aria-label="Level ${lvl} of 10">${segs(lvl)}</div>
        <span class="skill__lvl">${lvl}<small>/10</small></span>
        <span class="skill__yrs">${yrs} yrs</span>
      </div>`).join('');
    if (!animate || reducedMotion) return;
    gsap.from(list.children, { x: 24, opacity: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' });
    gsap.from(list.querySelectorAll('.skill__bar i.on, .skill__bar i.half'), { scaleY: 0, opacity: 0, duration: 0.3, stagger: 0.006, ease: 'power2.out', delay: 0.1 });
  };
  render(names[0], false);
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.board__tab');
    if (!b || b.classList.contains('is-active')) return;
    $$('.board__tab', tabs).forEach((t) => { t.classList.toggle('is-active', t === b); t.setAttribute('aria-selected', String(t === b)); });
    render(b.dataset.tab);
  });
  // first reveal: animate the opening tab when it scrolls into view
  ScrollTrigger.create({ trigger: list, start: 'top 85%', once: true, onEnter: () => render(names[0]) });
}

/* ------------------------------------------------------------------ */
/* Generic reveals                                                     */
/* ------------------------------------------------------------------ */
function reveals() {
  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      linesClass: 'line',
      wordsClass: 'word',
      autoSplit: true,
      onSplit(self) {
        requestAnimationFrame(gradientFix);
        return gsap.from(self.words, {
          yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.04, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        });
      },
    });
  });

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out', overwrite: true }),
  });

  $$('[data-count]').forEach((el) => {
    const obj = { v: 0 };
    gsap.to(obj, {
      v: +el.dataset.count, duration: 2, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      onUpdate: () => (el.textContent = Math.round(obj.v)),
    });
  });

  // loadout mastery bars
  $$('[data-bar]').forEach((bar) => {
    gsap.to(bar, {
      width: bar.dataset.bar + '%', duration: 1.4, ease: 'power3.out',
      scrollTrigger: { trigger: bar, start: 'top 92%', once: true },
    });
  });

  gsap.fromTo('#about-image', { clipPath: 'polygon(0 0, 0 0, 0 0, 0 100%, 0 100%, 0 100%)' }, {
    clipPath: 'polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px))',
    duration: 1.3, ease: 'expo.inOut',
    scrollTrigger: { trigger: '#about-image', start: 'top 80%', once: true },
  });
  gsap.fromTo('#about-image img', { scale: 1.35, yPercent: -8 }, {
    scale: 1.05, yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: '.about', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.from('.about__badge', { x: 40, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.about__badge', start: 'top 90%', once: true } });
  gsap.fromTo('.contact__bg img', { scale: 1.3 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
}

/* ------------------------------------------------------------------ */
/* Briefing: pinned, scroll-scrubbed route                             */
/* ------------------------------------------------------------------ */
function pipeline() {
  const path = $('#pipe-path');
  const len = path.getTotalLength();
  const nodes = $$('.pnode');
  const steps = $$('.step');
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });

  const box = $('#packets');
  const svg = $('.pipeline__svg');
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('span');
    p.className = 'packet';
    box.appendChild(p);
  }
  const placePackets = () => {
    const r = svg.getBoundingClientRect();
    const sx = r.width / 1200, sy = r.height / 300;
    $$('.packet', box).forEach((p, i) => {
      gsap.killTweensOf(p);
      const prog = { v: 0 };
      gsap.to(prog, {
        v: 1, duration: 2.6, repeat: -1, ease: 'none', delay: i * 0.43,
        onUpdate: () => {
          const a = path.getPointAtLength(prog.v * len);
          const b = path.getPointAtLength(Math.min(prog.v * len + 2, len));
          const angle = (Math.atan2((b.y - a.y) * sy, (b.x - a.x) * sx) * 180) / Math.PI;
          gsap.set(p, { x: a.x * sx, y: a.y * sy, rotation: angle, opacity: prog.v < 0.04 || prog.v > 0.96 ? 0 : 1 });
        },
      });
    });
  };
  placePackets();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(placePackets, 200); });

  const build = (scrollTrigger) => {
    const tl = gsap.timeline({ scrollTrigger });
    tl.to(path, { strokeDashoffset: 0, ease: 'none', duration: 6 }, 0);
    steps.forEach((s, i) => tl.fromTo(s, { opacity: 0.25, y: 20 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.6 + i * 1.1));
    tl.to(box, { opacity: 1, duration: 0.6 }, 5.4);
    tl.eventCallback('onUpdate', () => {
      const p = tl.progress();
      nodes.forEach((n, i) => n.classList.toggle('is-active', p >= (i / (nodes.length - 1)) * 0.98));
      steps.forEach((s, i) => s.classList.toggle('is-active', p >= (0.6 + i * 1.1) / 6.6));
    });
    return tl;
  };
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    build({ trigger: '.process', start: 'top top', end: '+=160%', scrub: 0.8, pin: '.process__pin', anticipatePin: 1 });
  });
  mm.add('(max-width: 899px)', () => {
    build({ trigger: '.pipeline', start: 'top 80%', end: 'bottom 30%', scrub: 0.8 });
  });
}

/* ------------------------------------------------------------------ */
/* Missions: horizontal pinned gallery                                 */
/* ------------------------------------------------------------------ */
function work() {
  const track = $('#work-track');
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    const distance = () => track.scrollWidth - window.innerWidth;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: { trigger: '.work', start: 'top top', end: () => '+=' + distance(), pin: '.work__pin', scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
    });
    $$('.project', track).forEach((card) => {
      // img is 124% wide with -12% margin, so ±8% of its width stays inside the frame
      gsap.fromTo(card.querySelector('img'), { xPercent: -8 }, {
        xPercent: 8, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
      gsap.from(card, {
        rotate: 4, y: 70, opacity: 0.2, ease: 'power2.out',
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 100%', end: 'left 60%', scrub: true },
      });
    });
  });
  mm.add('(max-width: 899px)', () => {
    $$('.project', track).forEach((card) => {
      gsap.from(card, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 88%', once: true } });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Service record timeline                                             */
/* ------------------------------------------------------------------ */
function timeline() {
  gsap.fromTo('#timeline-progress', { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    scrollTrigger: { trigger: '#timeline', start: 'top 70%', end: 'bottom 60%', scrub: true },
  });
  $$('.tl-item').forEach((item) => {
    ScrollTrigger.create({ trigger: item, start: 'top 65%', onEnter: () => item.classList.add('is-active'), onLeaveBack: () => item.classList.remove('is-active') });
  });
}

/* ------------------------------------------------------------------ */
/* Micro-interactions: tilt cards, magnetic buttons, crosshair         */
/* ------------------------------------------------------------------ */
function tiltCards() {
  if (!finePointer) return;
  $$('.tilt, .project').forEach((card) => {
    const rx = gsap.quickTo(card, 'rotateX', { duration: 0.6, ease: 'power3.out' });
    const ry = gsap.quickTo(card, 'rotateY', { duration: 0.6, ease: 'power3.out' });
    const strength = card.classList.contains('project') ? 6 : 10;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      rx((0.5 - py) * strength);
      ry((px - 0.5) * strength);
    });
    card.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}

function magnetic() {
  if (!finePointer) return;
  $$('.magnetic').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.3);
      y((e.clientY - (r.top + r.height / 2)) * 0.3);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}

function cursor() {
  if (!finePointer || reducedMotion) return;
  document.documentElement.classList.add('has-cursor');
  const dot = $('.cursor__dot');
  const ring = $('.cursor__ring');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor], a, button');
    document.body.classList.toggle('cursor-hover', !!t);
    document.body.classList.toggle('cursor-view', !!t && t.dataset.cursor === 'view');
  });
  // recoil kick on click
  window.addEventListener('pointerdown', () => gsap.fromTo(ring, { scale: 1.35 }, { scale: 1, duration: 0.35, ease: 'power3.out' }));
  document.addEventListener('pointerleave', () => gsap.to('.cursor', { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => gsap.to('.cursor', { opacity: 1, duration: 0.2 }));
}

/* ------------------------------------------------------------------ */
/* Nav, progress, mobile menu, footer bits                             */
/* ------------------------------------------------------------------ */
const burger = $('#burger');
const menu = $('#mobile-menu');
function closeMenu() {
  menu.classList.remove('is-open');
  burger.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
}
burger.addEventListener('click', () => {
  const open = !menu.classList.contains('is-open');
  menu.classList.toggle('is-open', open);
  burger.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', String(open));
  if (open) gsap.from('#mobile-menu a', { x: -40, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' });
});

function navAndProgress() {
  const nav = $('#nav');
  const bar = $('#scroll-progress');
  let last = 0;
  lenis.on('scroll', ({ scroll, limit }) => {
    bar.style.transform = `scaleX(${limit ? scroll / limit : 0})`;
    nav.classList.toggle('is-scrolled', scroll > 40);
    nav.classList.toggle('is-hidden', scroll > last && scroll > 400 && !menu.classList.contains('is-open'));
    last = scroll;
  });
  $$('.nav__links a').forEach((a) => {
    ScrollTrigger.create({
      trigger: a.getAttribute('href'), start: 'top 50%', end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });
  const marquee = $('#marquee');
  const skew = gsap.quickTo(marquee, 'skewX', { duration: 0.4, ease: 'power3.out' });
  lenis.on('scroll', ({ velocity }) => skew(gsap.utils.clamp(-12, 12, velocity * -0.4)));
}

function footer() {
  $('#year').textContent = new Date().getFullYear();
  const clock = $('#clock');
  const tick = () => (clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  tick();
  setInterval(tick, 30000);

  const btn = $('#copy-email');
  const toast = $('#toast');
  btn.addEventListener('click', async () => {
    const email = btn.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
      gsap.timeline()
        .to(toast, { y: 0, opacity: 1, duration: 0.4, ease: 'back.out(2)' })
        .to(toast, { y: 20, opacity: 0, duration: 0.4, delay: 1.8 });
    } catch {
      window.location.href = `mailto:${email}`;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
gsap.set('[data-reveal]', { opacity: 0, y: 40 });
// pinned sections first so every later trigger accounts for their pin spacing
pipeline();
work();
buildRadar();
buildBoard();
reveals();
timeline();
gradientFix();
tiltCards();
magnetic();
cursor();
navAndProgress();
footer();
compass();
theaters();
sceneReady.then(() => {
  backdropScroll();
  ScrollTrigger.refresh();
});
runPreloader();

// recalc once web fonts settle (they change line breaks)
document.fonts?.ready.then(() => { gradientFix(); ScrollTrigger.refresh(); });
