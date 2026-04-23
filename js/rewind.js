/* Time Rewind (Chronoshift)
 * Apps opt in by attaching a "rewind" API to their window handle:
 *   win.rewind = { snapshot(): state, restore(state): void, label?: string }
 * The rewind engine samples snapshots every 250ms for up to settings.rewindMaxSec.
 * Activate with Ctrl+Alt+R (toggle) or from Quick Panel. Scrub with the slider or Arrow keys.
 */
(function () {
  "use strict";
  const DO = window.DevinOS;

  const SAMPLE_MS = 250;
  const MAX_SAMPLES = () => Math.max(20, (DO.Settings.get().rewindMaxSec || 30) * (1000 / SAMPLE_MS));

  const buffers = new WeakMap(); // win -> array of { t, state }
  let tickHandle = null;
  let active = false;
  let target = null;
  let tempState = null;

  function sampleAll() {
    const wins = DO.WM.windows();
    for (const w of wins) {
      if (!w.rewind || typeof w.rewind.snapshot !== "function") continue;
      let state;
      try { state = w.rewind.snapshot(); } catch { continue; }
      if (state == null) continue;
      let buf = buffers.get(w);
      if (!buf) { buf = []; buffers.set(w, buf); }
      buf.push({ t: Date.now(), state });
      const max = MAX_SAMPLES();
      if (buf.length > max) buf.splice(0, buf.length - max);
    }
  }

  function start() {
    if (tickHandle) return;
    tickHandle = setInterval(sampleAll, SAMPLE_MS);
  }

  function pickTargetWindow() {
    // Focused window if rewindable; otherwise first rewindable window.
    const wins = DO.WM.windows().slice().reverse();
    for (const w of wins) {
      const zIdx = parseInt(w.root.style.zIndex || "0", 10);
      if (!isNaN(zIdx)) w._z = zIdx;
    }
    wins.sort((a, b) => (b._z || 0) - (a._z || 0));
    for (const w of wins) if (w.rewind) return w;
    return null;
  }

  function activate() {
    if (active) { deactivate(); return; }
    target = pickTargetWindow();
    if (!target) {
      DO.toast("Chronoshift", "No rewindable app in focus. Try Notepad, Paint, or GTA.");
      return;
    }
    const buf = buffers.get(target) || [];
    if (buf.length < 2) {
      DO.toast("Chronoshift", "Not enough history yet — try again in a few seconds.");
      return;
    }
    active = true;
    const overlay = document.getElementById("rewindOverlay");
    overlay.classList.remove("hidden");
    const bar = document.getElementById("rewindBar");
    bar.min = 0; bar.max = buf.length - 1; bar.value = buf.length - 1;
    document.getElementById("rewindSub").textContent =
      `Rewinding: ${target.title} · ${buf.length} frames · drag slider or ←/→`;
    bar.focus();
    DO.blip(880, 0.12, 0.03);
  }

  function applyIndex(idx) {
    const buf = buffers.get(target) || [];
    const snap = buf[clamp(idx, 0, buf.length - 1)];
    if (!snap) return;
    try { target.rewind.restore(snap.state); } catch (e) { console.error(e); }
    tempState = snap.state;
  }

  function commit() {
    // Keep the state that is currently displayed. Truncate the buffer to that index.
    if (!target) return;
    const buf = buffers.get(target) || [];
    const idx = parseInt(document.getElementById("rewindBar").value, 10);
    if (idx >= 0 && idx < buf.length - 1) {
      buf.splice(idx + 1); // erase future
    }
    DO.toast("Chronoshift", "Reality rewritten.");
  }

  function deactivate() {
    const overlay = document.getElementById("rewindOverlay");
    overlay.classList.add("hidden");
    commit();
    active = false; target = null; tempState = null;
    DO.blip(440, 0.1, 0.03);
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  document.addEventListener("input", (e) => {
    if (!active) return;
    if (e.target && e.target.id === "rewindBar") {
      applyIndex(parseInt(e.target.value, 10));
    }
  });

  document.addEventListener("keydown", (e) => {
    // Activate anywhere
    if (e.ctrlKey && e.altKey && (e.key === "r" || e.key === "R")) {
      e.preventDefault();
      activate();
      return;
    }
    if (!active) return;
    const bar = document.getElementById("rewindBar");
    if (e.key === "ArrowLeft")  { bar.value = Math.max(0, parseInt(bar.value,10) - 1); bar.dispatchEvent(new Event("input")); e.preventDefault(); }
    if (e.key === "ArrowRight") { bar.value = Math.min(+bar.max, parseInt(bar.value,10) + 1); bar.dispatchEvent(new Event("input")); e.preventDefault(); }
    if (e.key === "Enter" || e.key === "Escape") { deactivate(); e.preventDefault(); }
  });

  DO.Rewind = {
    start, activate, deactivate,
    get active() { return active; },
    install(win) {
      buffers.set(win, []);
    },
    clear(win) {
      buffers.delete(win);
    }
  };

  // Auto-start the sampling loop after DOM is ready.
  document.addEventListener("DOMContentLoaded", start);
})();
