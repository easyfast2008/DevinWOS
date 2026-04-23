/* DevinWOS core: utilities, storage, app registry, FS, icons, toasts, context menus. */
(function () {
  "use strict";

  const STORE_KEY = "devinwos.v1";
  const FS_KEY = "devinwos.fs.v1";

  // ---------- tiny helpers ----------
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const el = (tag, props = {}, ...children) => {
    const e = document.createElement(tag);
    for (const k in props) {
      const v = props[k];
      if (k === "class") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k === "dataset") Object.assign(e.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else if (k in e) { try { e[k] = v; } catch { e.setAttribute(k, v); } }
      else e.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return e;
  };
  const svg = (inner, props = {}) => {
    const wrap = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    wrap.setAttribute("viewBox", props.viewBox || "0 0 24 24");
    wrap.setAttribute("width", props.width || 24);
    wrap.setAttribute("height", props.height || 24);
    wrap.innerHTML = inner;
    return wrap;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = () => "w" + Math.random().toString(36).slice(2, 9);
  const fmt = (n, w = 2) => String(n).padStart(w, "0");
  const esc = (s) => String(s).replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));

  // ---------- storage ----------
  const Store = {
    load() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
      catch { return {}; }
    },
    save(s) { localStorage.setItem(STORE_KEY, JSON.stringify(s)); },
    get(k, d) { const s = this.load(); return k in s ? s[k] : d; },
    set(k, v) { const s = this.load(); s[k] = v; this.save(s); },
  };

  // ---------- wallpapers (CSS gradients as strings) ----------
  const WALLPAPERS = [
    { id: "bloom",   name: "Bloom",     css: "radial-gradient(circle at 30% 40%, #7a42ff, #2b2478 40%, #0b1027 80%)" },
    { id: "sunset",  name: "Sunset",    css: "linear-gradient(135deg, #ff6a00, #ee0979 50%, #3a2a76)" },
    { id: "forest",  name: "Forest",    css: "linear-gradient(145deg, #0b4727, #137a46 40%, #41dfa2 100%)" },
    { id: "ocean",   name: "Ocean",     css: "linear-gradient(160deg, #021729, #053b66 40%, #0ea5e9 100%)" },
    { id: "nebula",  name: "Nebula",    css: "radial-gradient(ellipse at top, #6f27b8, #11082a 60%), radial-gradient(ellipse at 70% 80%, #ff3c83, transparent 60%)" },
    { id: "aurora",  name: "Aurora",    css: "linear-gradient(160deg, #0f172a 20%, #1e3a8a 55%, #059669 85%, #fbbf24)" },
    { id: "candy",   name: "Candy",     css: "linear-gradient(135deg, #f093fb, #f5576c 50%, #4facfe)" },
    { id: "midnight",name: "Midnight",  css: "linear-gradient(180deg, #000428, #004e92)" },
  ];

  // ---------- settings ----------
  const defaultSettings = {
    theme: "dark",
    accent: "blue",
    wallpaper: "bloom",
    lockWallpaper: "sunset",
    taskbarAlign: "center",
    animations: true,
    sound: true,
    use24h: false,
    focus: false,
    fontsize: "md",
    brightness: 100,
    volume: 60,
    transparency: true,
    bootSkip: false,
    autoLockMin: 0, // 0 = never
    rewindMaxSec: 30,
  };

  const Settings = {
    _listeners: new Set(),
    get() { return Object.assign({}, defaultSettings, Store.get("settings", {})); },
    set(patch) {
      const next = Object.assign(this.get(), patch);
      Store.set("settings", next);
      this._listeners.forEach(fn => { try { fn(next); } catch {} });
      applySettings(next);
    },
    subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
    reset() { Store.set("settings", {}); this.set({}); },
  };

  function applySettings(s) {
    document.body.dataset.theme = s.theme;
    document.body.dataset.accent = s.accent;
    document.body.dataset.anim = s.animations ? "on" : "off";
    document.body.dataset.focus = s.focus ? "true" : "false";
    document.body.dataset.fontsize = s.fontsize;
    document.body.dataset.transparency = s.transparency ? "on" : "off";
    document.body.style.setProperty("--brightness", (s.brightness / 100).toFixed(2));
    document.body.dataset.brightness = "on";

    const wp = WALLPAPERS.find(w => w.id === s.wallpaper) || WALLPAPERS[0];
    document.documentElement.style.setProperty("--wp", wp.css);
    const lwp = WALLPAPERS.find(w => w.id === s.lockWallpaper) || WALLPAPERS[1];
    document.documentElement.style.setProperty("--lockBg", lwp.css);

    const tb = document.getElementById("taskbar");
    if (tb) tb.dataset.align = s.taskbarAlign;

    if (!s.transparency) {
      document.body.classList.add("opaque-mode");
    } else {
      document.body.classList.remove("opaque-mode");
    }
  }

  // ---------- virtual filesystem (very small) ----------
  // Files are { type: "file"|"dir", name, content?, children? }
  function seedFS() {
    return {
      type: "dir", name: "/", children: {
        "Users": { type: "dir", name: "Users", children: {
          "Devin": { type: "dir", name: "Devin", children: {
            "Documents": { type: "dir", name: "Documents", children: {
              "welcome.txt": { type: "file", name: "welcome.txt", content:
                "Welcome to DevinWOS!\n\nThis is a small web desktop inspired by Windows 11.\n" +
                "Try the apps in the Start menu. Don't miss:\n" +
                "  • GTA Clone (Start > Games > Grand Theft Web)\n" +
                "  • Chronoshift — press Ctrl+Alt+R anywhere for Time Rewind.\n" +
                "  • Settings — nearly everything is persistent.\n" },
              "notes.txt": { type: "file", name: "notes.txt", content: "Ideas:\n- Build something amazing\n- Eat pizza\n- Rewind time if needed" },
            }},
            "Pictures": { type: "dir", name: "Pictures", children: {} },
            "Music": { type: "dir", name: "Music", children: {} },
            "Videos": { type: "dir", name: "Videos", children: {} },
          }}
        }},
        "Windows": { type: "dir", name: "Windows", children: {
          "System": { type: "dir", name: "System", children: {
            "kernel.sys": { type: "file", name: "kernel.sys", content: "// Not a real kernel. Move along." },
            "readme.md":  { type: "file", name: "readme.md",  content: "DevinWOS, built from scratch. Have fun." },
          }}
        }},
      }
    };
  }

  const FS = {
    _root: null,
    load() {
      try {
        const raw = localStorage.getItem(FS_KEY);
        this._root = raw ? JSON.parse(raw) : seedFS();
      } catch { this._root = seedFS(); }
      return this._root;
    },
    save() { localStorage.setItem(FS_KEY, JSON.stringify(this._root)); },
    reset() { this._root = seedFS(); this.save(); },
    _parts(p) {
      return p.split("/").filter(Boolean);
    },
    resolve(path) {
      const parts = this._parts(path);
      let node = this._root;
      for (const p of parts) {
        if (node.type !== "dir") return null;
        node = node.children[p];
        if (!node) return null;
      }
      return node;
    },
    parent(path) {
      const parts = this._parts(path);
      parts.pop();
      return this.resolve("/" + parts.join("/"));
    },
    mkdir(path) {
      const parts = this._parts(path);
      const name = parts.pop();
      const parent = this.resolve("/" + parts.join("/"));
      if (!parent || parent.type !== "dir") return false;
      if (parent.children[name]) return false;
      parent.children[name] = { type: "dir", name, children: {} };
      this.save(); return true;
    },
    writeFile(path, content) {
      const parts = this._parts(path);
      const name = parts.pop();
      const parent = this.resolve("/" + parts.join("/"));
      if (!parent || parent.type !== "dir") return false;
      parent.children[name] = { type: "file", name, content };
      this.save(); return true;
    },
    readFile(path) {
      const n = this.resolve(path);
      return n && n.type === "file" ? n.content : null;
    },
    remove(path) {
      const parts = this._parts(path);
      const name = parts.pop();
      const parent = this.resolve("/" + parts.join("/"));
      if (!parent || !parent.children[name]) return false;
      delete parent.children[name];
      this.save(); return true;
    },
    rename(path, newName) {
      const parts = this._parts(path);
      const oldName = parts.pop();
      const parent = this.resolve("/" + parts.join("/"));
      if (!parent || !parent.children[oldName]) return false;
      const node = parent.children[oldName];
      node.name = newName;
      delete parent.children[oldName];
      parent.children[newName] = node;
      this.save(); return true;
    },
    list(path) {
      const n = this.resolve(path);
      if (!n || n.type !== "dir") return [];
      return Object.values(n.children);
    },
  };

  // ---------- icon library ----------
  const ICONS = {
    notepad: `<svg viewBox="0 0 32 32"><rect x="5" y="3" width="22" height="26" rx="3" fill="#fff" stroke="#999"/><rect x="5" y="3" width="22" height="5" fill="#3a7bd5"/><g stroke="#3a7bd5" stroke-width="1.5"><path d="M9 13h14M9 17h14M9 21h10"/></g></svg>`,
    calc: `<svg viewBox="0 0 32 32"><rect x="5" y="3" width="22" height="26" rx="3" fill="#2a3c5a"/><rect x="8" y="6" width="16" height="6" rx="1" fill="#c8e6ff"/><g fill="#3a7bd5"><rect x="8" y="14" width="4" height="4" rx="1"/><rect x="14" y="14" width="4" height="4" rx="1"/><rect x="20" y="14" width="4" height="4" rx="1"/><rect x="8" y="20" width="4" height="4" rx="1"/><rect x="14" y="20" width="4" height="4" rx="1"/><rect x="20" y="20" width="4" height="4" rx="1" fill="#ea7234"/></g></svg>`,
    paint: `<svg viewBox="0 0 32 32"><path d="M6 22c2-6 8-14 16-14 4 0 4 5 0 5-3 0-5 3-5 6s-3 5-6 5c-3 0-5-2-5-2z" fill="#f59e0b"/><circle cx="12" cy="10" r="2" fill="#ef4444"/><circle cx="18" cy="6" r="2" fill="#22c55e"/><circle cx="24" cy="10" r="2" fill="#3b82f6"/><circle cx="10" cy="16" r="2" fill="#a855f7"/></svg>`,
    files: `<svg viewBox="0 0 32 32"><path d="M3 7c0-2 2-3 3-3h6l3 3h11c2 0 3 1 3 3v15c0 2-1 3-3 3H6c-1 0-3-1-3-3V7z" fill="#ffd66b" stroke="#c9a13c"/><path d="M3 11h26v14c0 2-1 3-3 3H6c-1 0-3-1-3-3z" fill="#ffe28a"/></svg>`,
    browser: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#2aa8ef"/><path d="M3 16h26M16 3c5 4 5 22 0 26M16 3c-5 4-5 22 0 26" stroke="#fff" stroke-width="1.2" fill="none"/></svg>`,
    terminal: `<svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="22" rx="3" fill="#111"/><g fill="#6aff9f" font-family="monospace"><text x="7" y="17" font-size="9">&gt;_</text></g></svg>`,
    settings: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="5" fill="#3a7bd5"/><g fill="#3a7bd5"><rect x="15" y="2" width="2" height="6" rx="1"/><rect x="15" y="24" width="2" height="6" rx="1"/><rect x="2" y="15" width="6" height="2" rx="1"/><rect x="24" y="15" width="6" height="2" rx="1"/><rect x="6" y="6" width="6" height="2" rx="1" transform="rotate(45 9 7)"/><rect x="20" y="24" width="6" height="2" rx="1" transform="rotate(45 23 25)"/><rect x="6" y="24" width="6" height="2" rx="1" transform="rotate(-45 9 25)"/><rect x="20" y="6" width="6" height="2" rx="1" transform="rotate(-45 23 7)"/></g></svg>`,
    clock: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#fff" stroke="#3a7bd5" stroke-width="2"/><path d="M16 8v8l6 3" stroke="#3a7bd5" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
    camera: `<svg viewBox="0 0 32 32"><path d="M6 9h4l2-3h8l2 3h4v16H6z" fill="#444" stroke="#111"/><circle cx="16" cy="17" r="5" fill="#2aa8ef"/><circle cx="24" cy="12" r="1" fill="#ffd"/></svg>`,
    media: `<svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="22" rx="3" fill="#1e1e26"/><path d="M13 10l10 6-10 6z" fill="#ea7234"/></svg>`,
    photos: `<svg viewBox="0 0 32 32"><rect x="3" y="7" width="26" height="20" rx="2" fill="#fef3c7"/><path d="M6 22l5-6 4 4 6-8 5 10" fill="none" stroke="#3a7bd5" stroke-width="2" stroke-linejoin="round"/><circle cx="10" cy="12" r="2" fill="#f59e0b"/></svg>`,
    mines: `<svg viewBox="0 0 32 32"><circle cx="16" cy="18" r="10" fill="#111"/><rect x="15" y="5" width="2" height="5" fill="#111"/><circle cx="19" cy="15" r="2" fill="#fff"/></svg>`,
    solitaire: `<svg viewBox="0 0 32 32"><rect x="4" y="6" width="16" height="22" rx="2" fill="#fff" stroke="#c33"/><rect x="10" y="3" width="16" height="22" rx="2" fill="#fff" stroke="#333"/><text x="16" y="19" font-size="12" text-anchor="middle" fill="#000">♠</text></svg>`,
    gta: `<svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" rx="3" fill="#222"/><rect x="8" y="10" width="16" height="4" rx="1" fill="#e4453d"/><text x="16" y="22" text-anchor="middle" fill="#ffd066" font-size="7" font-weight="700">GTW</text></svg>`,
    about: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#3a7bd5"/><text x="16" y="22" text-anchor="middle" fill="#fff" font-size="18" font-weight="700">i</text></svg>`,
    rewind: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#7a42ff"/><path d="M18 10l-8 6 8 6z" fill="#fff"/><rect x="8" y="10" width="2" height="12" fill="#fff"/></svg>`,
    folder: `<svg viewBox="0 0 32 32"><path d="M3 9c0-2 2-3 3-3h6l3 3h11c2 0 3 1 3 3v13c0 2-1 3-3 3H6c-1 0-3-1-3-3z" fill="#ffcc66" stroke="#cc9a3c"/></svg>`,
    file: `<svg viewBox="0 0 32 32"><path d="M8 3h12l6 6v18c0 2-1 3-3 3H8c-2 0-3-1-3-3V6c0-2 1-3 3-3z" fill="#fff" stroke="#aaa"/><path d="M20 3v6h6" fill="#ddd" stroke="#aaa"/></svg>`,
    img: `<svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" rx="2" fill="#fef3c7" stroke="#aaa"/><circle cx="11" cy="13" r="2" fill="#f59e0b"/><path d="M6 22l5-6 4 4 6-8 5 10" fill="none" stroke="#3a7bd5" stroke-width="2" stroke-linejoin="round"/></svg>`,
    recycle: `<svg viewBox="0 0 32 32"><path d="M8 10h16l-2 17a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="#6fb1ff" stroke="#2563eb"/><rect x="11" y="4" width="10" height="4" rx="1" fill="#2563eb"/><path d="M13 15v9M16 15v9M19 15v9" stroke="#fff" stroke-width="1.5"/></svg>`,
  };

  // ---------- toasts ----------
  function toast(title, body, opts = {}) {
    const host = document.getElementById("toasts");
    if (!host) return;
    const n = el("div", { class: "toast" },
      el("div", { class: "t-title" }, title),
      body ? el("div", { class: "t-body" }, body) : null
    );
    host.appendChild(n);
    const ms = opts.ms || 3600;
    setTimeout(() => { n.style.opacity = "0"; n.style.transform = "translateX(20px)"; setTimeout(() => n.remove(), 200); }, ms);
    if (opts.notify !== false) DevinOS.addNotification({ title, body: body || "", ts: Date.now() });
  }

  // ---------- context menu ----------
  function ctx(event, items) {
    event.preventDefault();
    event.stopPropagation();
    const menu = document.getElementById("ctxMenu");
    menu.innerHTML = "";
    items.forEach(it => {
      if (it === "---") { menu.appendChild(el("div", { class: "ctx-sep" })); return; }
      const row = el("div", {
        class: "ctx-item" + (it.disabled ? " disabled" : ""),
        onclick: (e) => {
          if (it.disabled) return;
          menu.classList.add("hidden");
          try { it.onClick && it.onClick(e); } catch (err) { console.error(err); }
        }
      }, it.label);
      if (it.right) {
        row.appendChild(el("span", { style: { marginLeft: "auto", color: "var(--text-dim)", fontSize: "11px" } }, it.right));
      }
      menu.appendChild(row);
    });
    const x = clamp(event.clientX, 4, window.innerWidth - 240);
    const y = clamp(event.clientY, 4, window.innerHeight - (items.length * 30 + 20));
    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.classList.remove("hidden");
    const close = () => {
      menu.classList.add("hidden");
      document.removeEventListener("mousedown", close, true);
      document.removeEventListener("keydown", onEsc, true);
    };
    const onEsc = (e) => { if (e.key === "Escape") close(); };
    setTimeout(() => {
      document.addEventListener("mousedown", close, true);
      document.addEventListener("keydown", onEsc, true);
    }, 0);
  }

  // ---------- sound: tiny synth for UI click ----------
  let audioCtx = null;
  function blip(freq = 440, dur = 0.06, gain = 0.02) {
    try {
      const s = Settings.get();
      if (!s.sound) return;
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = "triangle";
      g.gain.value = gain * (s.volume / 100);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start();
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
      osc.stop(audioCtx.currentTime + dur);
    } catch {}
  }

  // ---------- app registry ----------
  const Apps = new Map();
  function registerApp(def) {
    Apps.set(def.id, def);
  }

  // ---------- notifications store ----------
  const Notifications = {
    list: [],
    add(n) {
      this.list.unshift(n);
      if (this.list.length > 50) this.list.length = 50;
      if (window.DevinOS && DevinOS.refreshNotifications) DevinOS.refreshNotifications();
    },
    clear() { this.list = []; if (window.DevinOS && DevinOS.refreshNotifications) DevinOS.refreshNotifications(); }
  };

  // ---------- public API ----------
  const DevinOS = {
    $, $$, el, svg, clamp, uid, fmt, esc,
    Store, Settings, applySettings, FS, WALLPAPERS,
    ICONS,
    toast, ctx, blip,
    apps: Apps,
    registerApp,
    addNotification: n => Notifications.add(n),
    get notifications() { return Notifications.list; },
    clearNotifications: () => Notifications.clear(),
  };

  window.DevinOS = DevinOS;

  // ---------- apply saved settings early ----------
  applySettings(Settings.get());
  FS.load();
})();
