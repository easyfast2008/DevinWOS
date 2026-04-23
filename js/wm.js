/* Window manager: create, focus, drag, resize, min/max/close, snap. */
(function () {
  "use strict";
  const { el, svg, clamp, uid, ICONS } = window.DevinOS;

  const windows = []; // active window objects
  let zTop = 100;
  const host = () => document.getElementById("windows");
  const TBAR_H = 48;

  class WinHandle {
    constructor(opts) {
      this.id = opts.id || uid();
      this.appId = opts.appId;
      this.title = opts.title;
      this.icon = opts.icon || ICONS.file;
      this.w = opts.w || 720;
      this.h = opts.h || 480;
      this.x = opts.x;
      this.y = opts.y;
      this.minW = opts.minW || 320;
      this.minH = opts.minH || 220;
      this.resizable = opts.resizable !== false;
      this.maximized = false;
      this.minimized = false;
      this.prev = null;
      this.onClose = opts.onClose || (() => {});
      this.onResize = opts.onResize || (() => {});
      this.onFocus = opts.onFocus || (() => {});
      this.onBlur = opts.onBlur || (() => {});
      this._buildDom();
      this.bodyRoot = this._body;
    }

    _buildDom() {
      const titleEl = el("div", { class: "w-title" },
        (() => { const s = svg(this.icon.replace(/<svg[^>]*>|<\/svg>/g, ""), {}); s.setAttribute("class", "w-icon"); return s; })(),
        el("span", {}, this.title)
      );
      const controls = el("div", { class: "window-controls" },
        el("button", { class: "w-min", title: "Minimize", onclick: () => this.minimize() }, svg(`<path d="M4 12h16" stroke="currentColor" stroke-width="1.6" fill="none"/>`, { width: 14, height: 14 })),
        el("button", { class: "w-max", title: "Maximize", onclick: () => this.toggleMax() }, svg(`<rect x="4.5" y="4.5" width="15" height="15" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6"/>`, { width: 14, height: 14 })),
        el("button", { class: "w-close", title: "Close", onclick: () => this.close() }, svg(`<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="1.6" fill="none"/>`, { width: 14, height: 14 })),
      );
      const header = el("div", { class: "window-header" }, titleEl, controls);
      const body = el("div", { class: "window-body" });
      this._body = body;

      const root = el("div", {
        class: "window",
        id: this.id,
        style: { width: this.w + "px", height: this.h + "px" },
      }, header, body);

      // Resize handles
      if (this.resizable) {
        ["n","s","w","e","nw","ne","sw","se"].forEach(dir => {
          const h = el("div", { class: "resize r-" + dir, dataset: { dir } });
          root.appendChild(h);
        });
      }

      this.root = root;
      this.header = header;

      // Position
      const maxX = window.innerWidth - this.w - 20;
      const maxY = window.innerHeight - this.h - TBAR_H - 20;
      this.x = clamp(this.x ?? (60 + (windows.length * 24) % 200), 0, Math.max(0, maxX));
      this.y = clamp(this.y ?? (40 + (windows.length * 24) % 160), 0, Math.max(0, maxY));
      this._applyGeom();

      // Events
      header.addEventListener("pointerdown", (e) => this._startDrag(e));
      header.addEventListener("dblclick", () => this.toggleMax());
      root.addEventListener("pointerdown", () => this.focus(), true);

      root.querySelectorAll(".resize").forEach(h => {
        h.addEventListener("pointerdown", (e) => this._startResize(e, h.dataset.dir));
      });

      host().appendChild(root);
    }

    _applyGeom() {
      const s = this.root.style;
      if (this.maximized) {
        s.left = "0px"; s.top = "0px";
        s.width = window.innerWidth + "px";
        s.height = (window.innerHeight - TBAR_H) + "px";
      } else {
        s.left = this.x + "px"; s.top = this.y + "px";
        s.width = this.w + "px"; s.height = this.h + "px";
      }
    }

    focus() {
      if (this.minimized) this.restore();
      zTop++;
      this.root.style.zIndex = zTop;
      windows.forEach(w => w.root.classList.toggle("focused", w === this));
      updateTaskbar();
      try { this.onFocus(); } catch {}
    }

    close() {
      const idx = windows.indexOf(this);
      if (idx >= 0) windows.splice(idx, 1);
      try { this.onClose(); } catch {}
      this.root.remove();
      updateTaskbar();
    }

    minimize() {
      this.minimized = true;
      this.root.classList.add("minimized");
      updateTaskbar();
    }

    restore() {
      this.minimized = false;
      this.root.classList.remove("minimized");
      this.focus();
    }

    toggleMax() {
      if (this.maximized) {
        this.maximized = false;
        this.root.classList.remove("maximized");
        if (this.prev) { Object.assign(this, this.prev); this.prev = null; }
        this._applyGeom();
      } else {
        this.prev = { x: this.x, y: this.y, w: this.w, h: this.h };
        this.maximized = true;
        this.root.classList.add("maximized");
        this._applyGeom();
      }
      try { this.onResize(this.bodyRoot.getBoundingClientRect()); } catch {}
    }

    setTitle(t) {
      this.title = t;
      const sp = this.header.querySelector(".w-title span");
      if (sp) sp.textContent = t;
      updateTaskbar();
    }

    setSize(w, h) {
      this.w = w; this.h = h;
      if (!this.maximized) this._applyGeom();
      try { this.onResize(this.bodyRoot.getBoundingClientRect()); } catch {}
    }

    _startDrag(e) {
      if (e.target.closest(".window-controls")) return;
      if (e.button !== 0) return;
      this.focus();
      const startX = e.clientX, startY = e.clientY;
      const origX = this.x, origY = this.y;
      const wasMax = this.maximized;
      const onMove = (ev) => {
        if (wasMax && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 8) {
          // Un-maximize first, re-anchor under cursor
          this.maximized = false;
          this.root.classList.remove("maximized");
          if (this.prev) { this.w = this.prev.w; this.h = this.prev.h; this.prev = null; }
          this.x = ev.clientX - this.w / 2;
          this.y = clamp(ev.clientY - 18, 0, window.innerHeight - TBAR_H - this.minH);
          this._applyGeom();
          return;
        }
        this.x = clamp(origX + (ev.clientX - startX), -this.w + 80, window.innerWidth - 80);
        this.y = clamp(origY + (ev.clientY - startY), 0, window.innerHeight - TBAR_H - 30);
        this._applyGeom();

        // snap preview
        showSnapPreview(ev.clientX, ev.clientY);
      };
      const onUp = (ev) => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        const snap = hitSnap(ev.clientX, ev.clientY);
        hideSnapPreview();
        if (snap) this.applySnap(snap);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }

    applySnap(region) {
      this.maximized = false;
      this.root.classList.remove("maximized");
      const W = window.innerWidth, H = window.innerHeight - TBAR_H;
      switch (region) {
        case "left":  this.x = 0;   this.y = 0; this.w = Math.floor(W/2); this.h = H; break;
        case "right": this.x = Math.floor(W/2); this.y = 0; this.w = Math.ceil(W/2); this.h = H; break;
        case "top":   this.maximized = true; this.root.classList.add("maximized"); break;
      }
      this._applyGeom();
      try { this.onResize(this.bodyRoot.getBoundingClientRect()); } catch {}
    }

    _startResize(e, dir) {
      if (this.maximized) return;
      e.preventDefault(); e.stopPropagation();
      this.focus();
      const sX = e.clientX, sY = e.clientY;
      const oX = this.x, oY = this.y, oW = this.w, oH = this.h;
      const onMove = (ev) => {
        let dx = ev.clientX - sX, dy = ev.clientY - sY;
        let nx = oX, ny = oY, nw = oW, nh = oH;
        if (dir.includes("e")) nw = Math.max(this.minW, oW + dx);
        if (dir.includes("s")) nh = Math.max(this.minH, oH + dy);
        if (dir.includes("w")) { nw = Math.max(this.minW, oW - dx); nx = oX + (oW - nw); }
        if (dir.includes("n")) { nh = Math.max(this.minH, oH - dy); ny = oY + (oH - nh); }
        this.x = nx; this.y = ny; this.w = nw; this.h = nh;
        this._applyGeom();
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        try { this.onResize(this.bodyRoot.getBoundingClientRect()); } catch {}
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    }
  }

  // Snap zones
  let snapEl = null;
  function showSnapPreview(x, y) {
    const region = hitSnap(x, y);
    if (!region) { hideSnapPreview(); return; }
    if (!snapEl) {
      snapEl = el("div", { class: "snap-preview" });
      document.body.appendChild(snapEl);
    }
    const W = window.innerWidth, H = window.innerHeight - TBAR_H;
    let r;
    if (region === "left")  r = { left: 0, top: 0, width: W/2, height: H };
    if (region === "right") r = { left: W/2, top: 0, width: W/2, height: H };
    if (region === "top")   r = { left: 0, top: 0, width: W,   height: H };
    Object.assign(snapEl.style, { left: r.left+"px", top: r.top+"px", width: r.width+"px", height: r.height+"px" });
  }
  function hideSnapPreview() { if (snapEl) { snapEl.remove(); snapEl = null; } }
  function hitSnap(x, y) {
    const edge = 10;
    if (y < edge) return "top";
    if (x < edge) return "left";
    if (x > window.innerWidth - edge) return "right";
    return null;
  }

  // Taskbar refresh — delegated to shell.js via a callback
  function updateTaskbar() {
    if (window.DevinOS.refreshTaskbar) window.DevinOS.refreshTaskbar();
  }

  // ---------- public ----------
  window.DevinOS.WM = {
    open(appId, args = {}) {
      const def = window.DevinOS.apps.get(appId);
      if (!def) { window.DevinOS.toast("Error", "App not found: " + appId); return null; }

      if (def.single) {
        const existing = windows.find(w => w.appId === appId);
        if (existing) {
          existing.focus();
          if (def.onReopen) def.onReopen(existing, args);
          return existing;
        }
      }

      const win = new WinHandle({
        appId,
        title: def.title,
        icon: def.icon,
        w: (args.w || def.defaultSize?.w) || 720,
        h: (args.h || def.defaultSize?.h) || 480,
        x: args.x, y: args.y,
        minW: def.minSize?.w,
        minH: def.minSize?.h,
        resizable: def.resizable !== false,
      });
      windows.push(win);
      try { def.mount(win, args); } catch (err) { console.error(err); window.DevinOS.toast("App crashed", String(err)); }
      win.focus();
      return win;
    },
    focus(id) { const w = windows.find(w => w.id === id); if (w) w.focus(); },
    windows: () => windows.slice(),
    byApp: (appId) => windows.filter(w => w.appId === appId),
    closeAll() { windows.slice().forEach(w => w.close()); },
  };

  window.addEventListener("resize", () => {
    windows.forEach(w => {
      if (w.maximized) w._applyGeom();
      try { w.onResize(w.bodyRoot.getBoundingClientRect()); } catch {}
    });
  });
})();
