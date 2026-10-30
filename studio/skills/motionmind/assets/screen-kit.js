// MotionMind screen kit: camera, cursor and highlight helpers for videos built from real product screenshots.
// Copy into src/assets/js/ and load it in the root <head> after GSAP. Every helper only adds tweens to a timeline at
// absolute times, so each frame stays a pure function of time.
//
// Coordinates are in "page" pixels: the CSS size of the screenshot (a 3200×1800 capture taken at DPR 2 → 1600×900).
//
//   MMK.configure({ page: { w: 1600, h: 900 }, view: { w: 1520, h: 855 }, base: 0.95 });
//   const cam = MMK.camera(tl, "#s1-cam", "#s1-cursor .cz");   // .cam = layer holding the screenshots
//   cam.to(2.0, { x: 300, y: 240, w: 700, h: 240 }, 1.6);       // zoom 1.6× on that rect, 0.8 s
//   const cur = MMK.cursor(tl, "#s1-cursor", 900, 700, 1.0);    // appear at t=1.0
//   cur.move(2.4, 520, 300); cur.click(3.1);
//   MMK.show(tl, "#s1-shot2", 3.2);                              // crossfade to the next screenshot
//   MMK.ring(tl, "#s1-ring", 3.3, 4.5);                          // highlight a rect, hide at 4.5
//
// Cursor markup, inside the .cam layer so it follows the camera; .cz is counter-scaled so the pointer keeps its size:
//   <div class="cursor" id="s1-cursor"><div class="cz"><div class="ripple"></div><svg>…arrow…</svg></div></div>
(() => {
  const cfg = { page: { w: 1600, h: 900 }, view: { w: 1520, h: 855 }, base: 0.95 };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function configure(next) {
    Object.assign(cfg, next);
  }

  /** Camera on a layer: to(t, rect|null, zoom, duration). rect = {x,y,w,h} in page px; null = whole page. */
  function camera(tl, sel, counterSel) {
    const props = (rect, zoom) => {
      if (!rect) return { x: 0, y: 0, scale: cfg.base };
      const s = cfg.base * zoom;
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      return {
        x: clamp(cfg.view.w / 2 - cx * s, cfg.view.w - cfg.page.w * s, 0),
        y: clamp(cfg.view.h / 2 - cy * s, cfg.view.h - cfg.page.h * s, 0),
        scale: s,
      };
    };
    let prev = props(null, 1);
    gsap.set(sel, { transformOrigin: "0 0" });
    if (counterSel) gsap.set(counterSel, { transformOrigin: "0 0" });
    tl.fromTo(sel, prev, { ...prev, duration: 0.01 }, 0);
    if (counterSel) tl.fromTo(counterSel, { scale: 1 }, { scale: 1, duration: 0.01 }, 0);
    return {
      to(t, rect, zoom = 1, d = 0.8) {
        const next = props(rect, zoom);
        tl.fromTo(sel, prev, { ...next, duration: d, ease: "power2.inOut", immediateRender: false }, t);
        if (counterSel) {
          tl.fromTo(counterSel, { scale: cfg.base / prev.scale }, { scale: cfg.base / next.scale, duration: d, ease: "power2.inOut", immediateRender: false }, t);
        }
        prev = next;
      },
    };
  }

  /** Pointer that glides between page points; click(t) presses it and fires the ripple. */
  function cursor(tl, sel, x0, y0, appear = 0.1) {
    let px = x0;
    let py = y0;
    tl.fromTo(sel, { x: x0, y: y0, opacity: 0 }, { x: x0, y: y0, opacity: 1, duration: 0.25 }, appear);
    return {
      move(t, x, y, d = 0.6) {
        tl.fromTo(sel, { x: px, y: py }, { x, y, duration: d, ease: "power2.inOut", immediateRender: false }, t);
        px = x;
        py = y;
      },
      click(t) {
        tl.fromTo(`${sel} svg`, { scale: 1 }, { keyframes: { scale: [0.78, 1] }, duration: 0.2, ease: "sine.inOut", immediateRender: false }, t);
        tl.fromTo(`${sel} .ripple`, { scale: 0.2, opacity: 0.95 }, { scale: 1, opacity: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, t);
      },
      hide(t) {
        tl.to(sel, { opacity: 0, duration: 0.2 }, t);
      },
    };
  }

  /** Crossfade a layer in. */
  function show(tl, sel, t, d = 0.3) {
    tl.fromTo(sel, { opacity: 0 }, { opacity: 1, duration: d, ease: "power1.inOut", immediateRender: false }, t);
  }

  /** Focus ring over a page rect: pop in at t, fade out at t1. */
  function ring(tl, sel, t, t1) {
    tl.fromTo(sel, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(1.7)" }, t);
    if (t1 != null) tl.to(sel, { opacity: 0, duration: 0.25 }, t1);
  }

  /** Lines that appear one after another. items = [[selector, time], …] */
  function lines(tl, items) {
    for (const [sel, t] of items) tl.fromTo(sel, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" }, t);
  }

  window.MMK = { configure, camera, cursor, show, ring, lines };
})();
