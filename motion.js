const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = reducedMotionQuery.matches;
// The layout and the chapter stops depend on this setting, so a change while the page is open starts it fresh.
reducedMotionQuery.addEventListener?.('change', () => window.location.reload());
const revealItems = document.querySelectorAll('.reveal-on-scroll');

if ('IntersectionObserver' in window && !reducedMotion) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
  revealItems.forEach(item => observer.observe(item));
} else {
  revealItems.forEach(item => item.classList.add('is-visible'));
}

const sectionNav = document.querySelector('.section-nav');
const upButton = sectionNav.querySelector('.section-nav-up');
const downButton = sectionNav.querySelector('.section-nav-down');
const sectionName = sectionNav.querySelector('.section-nav-name');
const sectionNumber = sectionNav.querySelector('.section-nav-number');
const chapterNames = ['Intro', 'Imagine', 'Create', 'Work', 'About'];
const experienceSection = document.querySelector('.experience');
let selectedChapter = null;
let shownChapter = '';

function documentTop(element) {
  return window.scrollY + element.getBoundingClientRect().top;
}

function chapterStops() {
  const start = documentTop(experienceSection);
  const distance = Math.max(0, experienceSection.offsetHeight - window.innerHeight);
  // On tall screens the page cannot scroll all the way to #about's top; the bottom of the page is About.
  const end = document.documentElement.scrollHeight - window.innerHeight;
  return [
    start,
    reducedMotion ? documentTop(document.querySelector('.scene--middle')) : start + distance * .5,
    reducedMotion ? documentTop(document.querySelector('.scene--final')) : start + distance * .94,
    documentTop(document.querySelector('#work')),
    Math.min(documentTop(document.querySelector('#about')), end)
  ];
}

function currentChapter(stops) {
  const position = window.scrollY;
  if (position >= stops[4] - 4) return 4;
  if (position >= stops[3] - 4) return 3;
  if (reducedMotion) {
    if (position >= stops[2] - 4) return 2;
    if (position >= stops[1] - 4) return 1;
    return 0;
  }
  const travel = Math.max(1, experienceSection.offsetHeight - window.innerHeight);
  if (position >= stops[0] + travel * .69) return 2;
  if (position >= stops[0] + travel * .31) return 1;
  return 0;
}

function updateSectionNav() {
  const stops = chapterStops();
  if (selectedChapter !== null && Math.abs(window.scrollY - stops[selectedChapter]) < 5) selectedChapter = null;
  const index = selectedChapter ?? currentChapter(stops);
  const atTop = index === 0 && window.scrollY < 20;
  if (shownChapter === `${index}${atTop}`) return;
  shownChapter = `${index}${atTop}`;
  sectionName.textContent = chapterNames[index];
  sectionNumber.textContent = String(index + 1).padStart(2, '0');
  // aria-disabled rather than disabled, so a focused button keeps focus at either end; moveChapter() ignores the press.
  upButton.setAttribute('aria-disabled', atTop);
  downButton.setAttribute('aria-disabled', index === chapterNames.length - 1);
  upButton.setAttribute('aria-label', index === 0 ? 'Back to introduction' : `Go up to ${chapterNames[index - 1]}`);
  downButton.setAttribute('aria-label', index === chapterNames.length - 1 ? 'End of page' : `Go down to ${chapterNames[index + 1]}`);
}

function moveChapter(direction) {
  if ((direction < 0 ? upButton : downButton).getAttribute('aria-disabled') === 'true') return;
  const stops = chapterStops();
  const index = selectedChapter ?? currentChapter(stops);
  const next = Math.max(0, Math.min(chapterNames.length - 1, index + direction));
  if (next === index && Math.abs(window.scrollY - stops[next]) < 5) return;
  selectedChapter = next;
  window.scrollTo({ top: stops[next], behavior: reducedMotion ? 'auto' : 'smooth' });
  updateSectionNav();
}

// The visitor's own scrolling always wins: it stops a smooth scroll the page started (a nav button or an
// in-page link such as "Explore my work") and the pill shows where they really are.
let anchorFlight = false;
document.addEventListener('click', event => { if (event.target.closest('a[href^="#"]')) anchorFlight = true; });
window.addEventListener('scrollend', () => { anchorFlight = false; });
function releaseChapter() {
  if (selectedChapter === null && !anchorFlight) return;
  selectedChapter = null;
  anchorFlight = false;
  updateSectionNav();
  try { window.scrollTo({ top: window.scrollY, behavior: 'instant' }); } catch (error) { /* older engines lack 'instant' and stop on their own */ }
}
// Presses that start on the pill itself keep chaining chapters, so two quick taps on Next go two chapters.
const outsideNav = event => !sectionNav.contains(event.target);
const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];

upButton.addEventListener('click', () => moveChapter(-1));
downButton.addEventListener('click', () => moveChapter(1));
window.addEventListener('scroll', updateSectionNav, { passive: true });
window.addEventListener('resize', updateSectionNav, { passive: true });
window.addEventListener('wheel', releaseChapter, { passive: true });
window.addEventListener('touchmove', event => { if (outsideNav(event)) releaseChapter(); }, { passive: true });
window.addEventListener('mousedown', event => { if (outsideNav(event)) releaseChapter(); });
window.addEventListener('keydown', event => { if (scrollKeys.includes(event.key) && outsideNav(event)) releaseChapter(); });
// On <body>, a touchstart listener is also what lets iOS Safari show :active press states.
document.body.addEventListener('touchstart', event => { if (outsideNav(event)) releaseChapter(); }, { passive: true });
updateSectionNav();

{
  const experience = document.querySelector('.experience');
  const canvas = document.querySelector('#motion-canvas');
  const context = canvas.getContext('2d');
  const scenes = [...document.querySelectorAll('.scene')];
  const shown = scenes.map(() => ({ opacity: '', y: null, hidden: null }));
  const clamp = value => Math.min(1, Math.max(0, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };
  // From here on every term that depends on time has faded out, so the picture stands still.
  const STILL = .92;

  // The same seed gives the scroll animation a stable shape on every visit.
  let seed = 24081997;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let width = 0;
  let height = 0;
  let ratio = 0;
  let mobile = false;
  let particles = [];
  let dots = [];
  let target = 0;
  let progress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let experienceTop = 0;
  let scrollLength = 1;
  let stageVisible = true;
  let stillDrawn = false;
  let running = false;
  let lastTime = 0;

  function resize() {
    experienceTop = window.scrollY + experience.getBoundingClientRect().top;
    scrollLength = Math.max(1, experience.offsetHeight - window.innerHeight);
    sizeCanvas();
    measureScroll();
    start();
  }

  function sizeCanvas() {
    // Size the drawing surface to the canvas box itself (100svh tall, scrollbar excluded), so a phone's
    // toolbar sliding away or a desktop scrollbar never stretches the picture or forces a rebuild.
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (nextWidth !== width || nextHeight !== height || nextRatio !== ratio) {
      width = nextWidth;
      height = nextHeight;
      ratio = nextRatio;
      mobile = window.innerWidth < 650;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed = 24081997;
      // Everything about a particle that does not change with time is worked out once, here.
      particles = Array.from({ length: mobile ? 125 : 280 }, (_, index) => {
        const angle = random() * Math.PI * 2;
        const distance = .65 + random() * 1.45;
        const phase = random() * Math.PI * 2;
        const u = random();
        const v = random();
        const size = .6 + random() * 2.1;
        const light = random() > .78;
        return {
          angle, distance, phase, u, v, size, light, dot: index % 7 === 0,
          speed: .00008 + distance * .00004,
          alpha: .2 + .55 * (1 - distance / 3),
          line: Math.max(.6, size * .7),
          streak: 4 + size * 6,
          dotRadius: size * 1.35,
          flowX: u * width * 1.2 - width * .1,
          flowWave: u * 9,
          flowY: (v - .5) * height * .32,
          endX: width * (.69 + (u - .5) * (mobile ? .82 : .65)),
          endY: height * (.52 + (v - .5) * .8),
          x: 0, y: 0, a: 0
        };
      });
      // Draw the two colours as two groups; 'screen' blending gives the same picture in any order.
      particles.sort((a, b) => a.light - b.light);
      dots = particles.filter(particle => particle.dot);
      stillDrawn = false;
    }
  }

  function measureScroll() {
    const next = clamp((window.scrollY - experienceTop) / scrollLength);
    if (next !== target) {
      target = next;
      start();
    }
  }

  function updateScenes(value) {
    const opacity = [
      1 - smooth(.20, .42, value),
      smooth(.21, .42, value) * (1 - smooth(.59, .81, value)),
      smooth(.59, .81, value)
    ];
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      const last = shown[index];
      const nextOpacity = opacity[index].toFixed(3);
      const y = Math.round(index === 0 ? -65 * value : index === 1 ? 70 * (.48 - value) : 70 * (.82 - value));
      const hidden = opacity[index] < .35;
      // Only write what changed: identical writes still cost a style pass every frame.
      if (nextOpacity !== last.opacity) scene.style.opacity = last.opacity = nextOpacity;
      if (y !== last.y) scene.style.transform = `translate3d(0, ${last.y = y}px, 0)`;
      if (hidden !== last.hidden) {
        last.hidden = hidden;
        scene.inert = hidden;
        scene.setAttribute('aria-hidden', hidden ? 'true' : 'false');
      }
    }
  }

  function draw(time, value) {
    const ctx = context;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'screen';

    const firstShift = smooth(.12, .58, value);
    const lastShift = smooth(.57, .91, value);
    const baseX = width * (mobile ? .7 : .73) + pointerX * 15;
    const baseY = height * (mobile ? .8 : .52) + pointerY * 15;
    const orbX = mix(baseX, width * .56, firstShift);
    const orbY = mix(baseY, height * .5, firstShift);
    const radius = Math.min(width * (mobile ? .31 : .17), mobile ? 150 : 220);
    const orbFade = 1 - smooth(.2, .62, value);

    if (orbFade > .01) {
      const glow = ctx.createRadialGradient(orbX - radius * .32, orbY - radius * .3, 0, orbX, orbY, radius * 2.3);
      glow.addColorStop(0, `rgba(225,255,164,${.52 * orbFade})`);
      glow.addColorStop(.32, `rgba(106,176,103,${.3 * orbFade})`);
      glow.addColorStop(1, 'rgba(17,70,40,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(orbX, orbY, radius * 2.3, 0, Math.PI * 2);
      ctx.fill();

      const core = ctx.createRadialGradient(orbX - radius * .35, orbY - radius * .38, radius * .04, orbX, orbY, radius);
      core.addColorStop(0, `rgba(236,255,181,${.98 * orbFade})`);
      core.addColorStop(.37, `rgba(166,214,117,${.85 * orbFade})`);
      core.addColorStop(1, `rgba(28,78,54,${.18 * orbFade})`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(orbX, orbY, radius * (.88 + firstShift * .7), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(212,252,174,${.24 * orbFade})`;
      ctx.lineWidth = 1;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(orbX, orbY, radius * (1.2 + ring * .28), radius * (.95 + ring * .25), time * .00008 + ring * .4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const waveStrength = smooth(.25, .4, value) * (1 - smooth(.65, .88, value));
    if (waveStrength > .01) {
      for (let band = 0; band < 4; band++) {
        ctx.beginPath();
        for (let x = -20; x <= width + 20; x += 14) {
          const y = height * (.34 + band * .11) + Math.sin(x * .006 + time * .00065 + band * .82) * height * .09;
          if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(175,237,141,${(.1 - band * .014) * waveStrength})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }

    // One solid colour per group and a numeric globalAlpha per particle, instead of building and
    // parsing a new rgba() string for every particle (same pixels, about half the cost).
    const fade = 1 - lastShift * .2;
    const stretch = firstShift * (1 - lastShift);
    let light = null;
    for (const particle of particles) {
      const angle = particle.angle + time * particle.speed;
      const ringX = orbX + Math.cos(angle) * radius * particle.distance * 1.25;
      const ringY = orbY + Math.sin(angle) * radius * particle.distance * .95;
      const flowX = particle.flowX + Math.sin(time * .0004 + particle.phase) * 25;
      const flowY = height * .5 + Math.sin(particle.flowWave + time * .00048 + particle.phase) * height * .23 + particle.flowY;
      const x = particle.x = mix(mix(ringX, flowX, firstShift), particle.endX, lastShift);
      const y = particle.y = mix(mix(ringY, flowY, firstShift), particle.endY, lastShift);
      const alpha = particle.a = particle.alpha * fade;
      const streak = stretch * particle.streak;
      if (particle.light !== light) {
        light = particle.light;
        ctx.strokeStyle = light ? 'rgb(255,255,232)' : 'rgb(216,251,117)';
      }
      ctx.globalAlpha = alpha;
      ctx.lineWidth = particle.line;
      ctx.beginPath();
      ctx.moveTo(x - streak, y);
      ctx.lineTo(x + particle.size, y);
      ctx.stroke();
    }
    light = null;
    for (const particle of dots) {
      if (particle.light !== light) {
        light = particle.light;
        ctx.fillStyle = light ? 'rgb(255,255,232)' : 'rgb(216,251,117)';
      }
      ctx.globalAlpha = Math.min(.7, particle.a + .16);
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(time) {
    // Ease toward the scroll position by elapsed time, not per frame, so the chapters follow the scroll as
    // closely on a 60 Hz phone as on the 165 Hz screen this was tuned on (90% of the way in about 155 ms).
    const elapsed = lastTime ? Math.min(time - lastTime, 64) : 16.667;
    lastTime = time;
    progress += (target - progress) * (1 - Math.exp(-.0147 * elapsed));
    if (Math.abs(target - progress) < .0001) progress = target;
    const settled = progress === target;
    const still = progress >= STILL;
    // The scenes are only written when a value changes; the canvas is only drawn while it is on screen
    // and moving, plus once more when it comes to rest so it is up to date when it scrolls back in.
    updateScenes(progress);
    if ((stageVisible || settled) && !(still && stillDrawn)) {
      draw(time, progress);
      stillDrawn = still;
    }
    running = !settled || (stageVisible && !still);
    if (running) window.requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = 0;
    window.requestAnimationFrame(frame);
  }

  if (reducedMotion) {
    // Reduce Motion keeps the orb as a still picture: one frame, no loop. The stylesheet only shows it on wider screens.
    const still = () => {
      if (getComputedStyle(canvas).display === 'none') return;
      sizeCanvas();
      draw(0, 0);
    };
    window.addEventListener('resize', still, { passive: true });
    still();
  } else {
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('scroll', measureScroll, { passive: true });
    experience.addEventListener('pointermove', event => {
      pointerX = event.clientX / width - .5;
      pointerY = event.clientY / height - .5;
    }, { passive: true });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        // Several entries can queue up between callbacks; the last one is the current state.
        stageVisible = entries[entries.length - 1].isIntersecting;
        if (stageVisible) start();
      }, { rootMargin: '10% 0px' }).observe(experience);
    }
    resize();
    updateScenes(0);
  }
}
