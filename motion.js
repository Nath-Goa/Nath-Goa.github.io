const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

if (!reducedMotion) {
  const experience = document.querySelector('.experience');
  const canvas = document.querySelector('#motion-canvas');
  const context = canvas.getContext('2d');
  const scenes = [...document.querySelectorAll('.scene')];
  const progressFill = document.querySelector('.chapter-fill');
  const chapterNumber = document.querySelector('.chapter-number');
  const mobile = () => window.innerWidth < 650;
  const clamp = value => Math.min(1, Math.max(0, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };

  // The same seed gives the scroll animation a stable shape on every visit.
  let seed = 24081997;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let width = 0;
  let height = 0;
  let ratio = 1;
  let particles = [];
  let target = 0;
  let progress = 0;
  let pointerX = 0;
  let pointerY = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    seed = 24081997;
    particles = Array.from({ length: mobile() ? 125 : 280 }, () => ({
      angle: random() * Math.PI * 2,
      distance: .65 + random() * 1.45,
      phase: random() * Math.PI * 2,
      u: random(),
      v: random(),
      size: .6 + random() * 2.1,
      color: random() > .78 ? '255,255,232' : '216,251,117'
    }));
    measureScroll();
  }

  function measureScroll() {
    const length = Math.max(1, experience.offsetHeight - window.innerHeight);
    target = clamp(-experience.getBoundingClientRect().top / length);
  }

  function updateScenes(value) {
    const opacity = [
      1 - smooth(.20, .42, value),
      smooth(.21, .42, value) * (1 - smooth(.59, .81, value)),
      smooth(.59, .81, value)
    ];
    scenes.forEach((scene, index) => {
      scene.style.opacity = opacity[index].toFixed(3);
      scene.style.transform = `translate3d(0, ${Math.round((index === 0 ? -65 * value : index === 1 ? 70 * (.48 - value) : 70 * (.82 - value)))}px, 0)`;
      const hidden = opacity[index] < .35;
      scene.inert = hidden;
      scene.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    });
    progressFill.style.width = `${(value * 100).toFixed(1)}%`;
    chapterNumber.textContent = value < .34 ? '01' : value < .69 ? '02' : '03';
  }

  function draw(time, value) {
    const ctx = context;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'screen';

    const firstShift = smooth(.12, .58, value);
    const lastShift = smooth(.57, .91, value);
    const baseX = width * (mobile() ? .7 : .73) + pointerX * 15;
    const baseY = height * (mobile() ? .8 : .52) + pointerY * 15;
    const orbX = mix(baseX, width * .56, firstShift);
    const orbY = mix(baseY, height * .5, firstShift);
    const radius = Math.min(width * (mobile() ? .31 : .17), mobile() ? 150 : 220);
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

    particles.forEach((particle, index) => {
      const angle = particle.angle + time * (.00008 + particle.distance * .00004);
      const ringX = orbX + Math.cos(angle) * radius * particle.distance * 1.25;
      const ringY = orbY + Math.sin(angle) * radius * particle.distance * .95;
      const flowX = particle.u * width * 1.2 - width * .1 + Math.sin(time * .0004 + particle.phase) * 25;
      const flowY = height * .5 + Math.sin(particle.u * 9 + time * .00048 + particle.phase) * height * .23 + (particle.v - .5) * height * .32;
      const endX = width * (.69 + (particle.u - .5) * (mobile() ? .82 : .65));
      const endY = height * (.52 + (particle.v - .5) * .8);
      const x = mix(mix(ringX, flowX, firstShift), endX, lastShift);
      const y = mix(mix(ringY, flowY, firstShift), endY, lastShift);
      const alpha = (.2 + .55 * (1 - particle.distance / 3)) * (1 - lastShift * .2);
      const streak = firstShift * (1 - lastShift) * (4 + particle.size * 6);

      ctx.strokeStyle = `rgba(${particle.color},${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(.6, particle.size * .7);
      ctx.beginPath();
      ctx.moveTo(x - streak, y);
      ctx.lineTo(x + particle.size, y);
      ctx.stroke();

      if (index % 7 === 0) {
        ctx.fillStyle = `rgba(${particle.color},${Math.min(.7, alpha + .16).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, particle.size * 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(time) {
    progress += (target - progress) * .085;
    if (Math.abs(target - progress) < .0001) progress = target;
    updateScenes(progress);
    if (!document.hidden && window.scrollY < experience.offsetHeight + window.innerHeight) draw(time, progress);
    window.requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', measureScroll, { passive: true });
  experience.addEventListener('pointermove', event => {
    pointerX = event.clientX / width - .5;
    pointerY = event.clientY / height - .5;
  }, { passive: true });
  resize();
  updateScenes(0);
  window.requestAnimationFrame(frame);
}
