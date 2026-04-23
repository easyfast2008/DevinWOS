/* DevinWOS extras: Widgets flyout (Win+W), Run dialog (Win+R),
 * Task View overlay (Win+Tab), and global keyboard shortcuts.
 *
 * All features here are additive — they do not replace the core shell.
 */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, $, $$ } = DO;

  // ---------- Widgets flyout ----------
  const WIDGET_CITIES = [
    { name: "San Francisco", lat: 37.7, lon: -122.4, baseC: 16, range: 6 },
    { name: "New York",      lat: 40.7, lon:  -74.0, baseC: 12, range: 11 },
    { name: "London",        lat: 51.5, lon:   -0.1, baseC: 11, range: 7 },
    { name: "Tokyo",         lat: 35.7, lon:  139.7, baseC: 18, range: 10 },
    { name: "Sydney",        lat: -33.9,lon:  151.2, baseC: 20, range: 8 },
  ];
  const CONDITIONS = [
    { t: "Sunny",         icon: "☀️", tempBoost: 3 },
    { t: "Partly cloudy", icon: "⛅", tempBoost: 0 },
    { t: "Cloudy",        icon: "☁️", tempBoost: -1 },
    { t: "Light rain",    icon: "🌧️", tempBoost: -3 },
    { t: "Thunderstorm",  icon: "⛈️", tempBoost: -4 },
    { t: "Snow",          icon: "❄️", tempBoost: -10 },
    { t: "Windy",         icon: "💨", tempBoost: -1 },
  ];
  const QUOTES = [
    { q: "Simplicity is the ultimate sophistication.", by: "Leonardo da Vinci" },
    { q: "Programs must be written for people to read, and only incidentally for machines to execute.", by: "Harold Abelson" },
    { q: "Controlling complexity is the essence of computer programming.", by: "Brian Kernighan" },
    { q: "The best way to predict the future is to invent it.", by: "Alan Kay" },
    { q: "Talk is cheap. Show me the code.", by: "Linus Torvalds" },
    { q: "Any sufficiently advanced technology is indistinguishable from magic.", by: "Arthur C. Clarke" },
    { q: "Make it work, make it right, make it fast.", by: "Kent Beck" },
    { q: "The function of good software is to make the complex appear to be simple.", by: "Grady Booch" },
  ];

  // Deterministic pseudo-random per day seed (so widget data is stable for a day).
  function seededNoise(seed) {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }
  function todaySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
  }

  function buildFlyout() {
    let flyout = $("#widgetsFlyout");
    if (flyout) return flyout;
    flyout = el("div", { id: "widgetsFlyout", class: "widgets-flyout hidden" });
    document.getElementById("desktop").appendChild(flyout);
    return flyout;
  }

  function renderWidgets() {
    const f = buildFlyout();
    f.innerHTML = "";
    const seed = todaySeed();

    f.appendChild(el("div", { class: "w-title" }, "Widgets"));

    // Weather card (synthetic)
    const city = WIDGET_CITIES[Math.floor(seededNoise(seed) * WIDGET_CITIES.length)];
    const cond = CONDITIONS[Math.floor(seededNoise(seed + 1) * CONDITIONS.length)];
    const temp = Math.round(city.baseC + cond.tempBoost + (seededNoise(seed + 2) - 0.5) * city.range);
    const wind = Math.round(2 + seededNoise(seed + 3) * 18);
    const humidity = Math.round(40 + seededNoise(seed + 4) * 50);
    f.appendChild(el("div", { class: "widget-card widget-weather" },
      el("h3", {}, el("span", { style: { fontSize: "20px" } }, cond.icon), city.name),
      el("div", { class: "temp" }, temp + "°C"),
      el("div", { class: "w-sub" }, cond.t),
      el("div", { class: "meta" },
        el("span", {}, "Wind " + wind + " km/h"),
        el("span", {}, "Humidity " + humidity + "%"),
        el("span", {}, "Feels " + (temp - Math.floor(wind/5)) + "°"),
      ),
    ));

    // Calendar card (current month)
    const d = new Date();
    const year = d.getFullYear(), month = d.getMonth();
    const first = new Date(year, month, 1).getDay();
    const dim = new Date(year, month + 1, 0).getDate();
    const grid = el("div", { class: "grid" });
    ["S","M","T","W","T","F","S"].forEach(h => grid.appendChild(el("div", { class: "h" }, h)));
    for (let i = 0; i < first; i++) grid.appendChild(el("div", {}, ""));
    for (let i = 1; i <= dim; i++) {
      const cell = el("div", {}, String(i));
      if (i === d.getDate()) cell.classList.add("today");
      grid.appendChild(cell);
    }
    const monthName = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    f.appendChild(el("div", { class: "widget-card widget-cal" },
      el("h3", {}, "📅 Calendar"),
      el("div", { class: "month" }, monthName),
      grid
    ));

    // System card (RAM, cores, battery if available)
    const ramTotal = navigator.deviceMemory || 8;
    const ramUsed = Math.round((1.8 + seededNoise(seed + 5) * (ramTotal - 2)) * 10) / 10;
    const ramPct = Math.min(100, Math.round(ramUsed / ramTotal * 100));
    const cpuPct = Math.round(10 + seededNoise(Date.now() / 30000) * 60);
    const sys = el("div", { class: "widget-card widget-sys" },
      el("h3", {}, "⚙️ System"),
      el("div", { class: "w-sub" }, "CPU " + cpuPct + "%"),
      el("div", { class: "bar" }, el("div", { style: { width: cpuPct + "%" } })),
      el("div", { class: "w-sub" }, "Memory " + ramUsed + " / " + ramTotal + " GB (" + ramPct + "%)"),
      el("div", { class: "bar" }, el("div", { style: { width: ramPct + "%" } })),
      el("div", { class: "w-sub" }, "Cores " + (navigator.hardwareConcurrency || "?") + " · Engine " + navigator.platform),
    );
    f.appendChild(sys);
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        const pct = Math.round(b.level * 100);
        sys.appendChild(el("div", { class: "w-sub", style: { marginTop: "6px" } },
          "🔋 Battery " + pct + "% · " + (b.charging ? "charging" : "on battery")
        ));
      }).catch(() => {});
    }

    // Quote of the day
    const qIdx = Math.floor(seededNoise(seed + 9) * QUOTES.length);
    const q = QUOTES[qIdx];
    f.appendChild(el("div", { class: "widget-card widget-quote" },
      el("h3", {}, "💭 Quote of the day"),
      el("p", {}, "“" + q.q + "”"),
      el("div", { class: "by" }, "— " + q.by),
    ));

    // Shortcuts to Chronoshift
    f.appendChild(el("div", { class: "widget-card" },
      el("h3", {}, "⏪ Chronoshift"),
      el("div", { class: "w-sub", style: { marginBottom: "8px" } },
        "Rewind your last actions in Notepad, Paint, or GTA. Press Ctrl+Alt+R anywhere."),
      el("button", {
        class: "qt",
        style: { width: "100%", padding: "8px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: "6px" },
        onclick: () => { toggleWidgets(false); DO.Rewind.activate(); }
      }, "Activate now")
    ));
  }

  function toggleWidgets(force) {
    const f = buildFlyout();
    const open = force === undefined ? f.classList.contains("hidden") : !!force;
    if (open) { renderWidgets(); f.classList.remove("hidden"); }
    else { f.classList.add("hidden"); }
  }

  // Close widgets on outside click
  document.addEventListener("mousedown", (e) => {
    const f = $("#widgetsFlyout");
    if (!f || f.classList.contains("hidden")) return;
    if (!e.target.closest("#widgetsFlyout")) toggleWidgets(false);
  }, true);

  // ---------- Run dialog ----------
  const RUN_MAP = {
    "notepad": "notepad", "calc": "calculator", "calculator": "calculator",
    "paint": "paint", "mspaint": "paint",
    "explorer": "explorer", "files": "explorer", "file explorer": "explorer",
    "browser": "browser", "edge": "browser", "chrome": "browser", "firefox": "browser",
    "cmd": "terminal", "terminal": "terminal", "powershell": "terminal", "bash": "terminal",
    "clock": "clock", "camera": "camera", "media": "mediaplayer", "mediaplayer": "mediaplayer",
    "wmplayer": "mediaplayer", "photos": "photos",
    "settings": "settings", "control": "settings", "setup": "settings",
    "about": "about", "winver": "about",
    "minesweeper": "minesweeper", "mines": "minesweeper",
    "solitaire": "solitaire", "cards": "solitaire",
    "gta": "gta", "grand theft web": "gta", "gtw": "gta",
    "snake": "snake",
  };

  function openRun() {
    if ($("#runDialog")) return;
    const input = el("input", { type: "text", placeholder: "notepad, calc, explorer, gta…",
      onkeydown: e => {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
        if (e.key === "Escape") closeRun();
      }
    });
    const dialog = el("div", { id: "runDialog", class: "run-dialog" },
      el("h3", {}, "Run"),
      el("p", {}, "Type the name of a program or app and DevinWOS will open it for you."),
      el("div", { class: "row" }, el("label", {}, "Open:"), input),
      el("div", { class: "hints" },
        "Try: ", el("code", {}, "notepad"), " · ", el("code", {}, "calc"),
        " · ", el("code", {}, "gta"), " · ", el("code", {}, "settings"),
        " · ", el("code", {}, "snake"),
      ),
      el("div", { class: "btns" },
        el("button", { onclick: () => closeRun() }, "Cancel"),
        el("button", { class: "primary", onclick: () => submit() }, "OK"),
      ),
    );
    document.body.appendChild(dialog);
    setTimeout(() => input.focus(), 30);

    function submit() {
      const raw = input.value.trim().toLowerCase();
      if (!raw) { closeRun(); return; }
      let appId = RUN_MAP[raw];
      if (!appId && DO.apps.has(raw)) appId = raw;
      if (!appId) {
        // Fuzzy match by title
        for (const [id, def] of DO.apps) {
          if (def.title.toLowerCase().replace(/\s/g, "").includes(raw.replace(/\s/g, ""))) { appId = id; break; }
        }
      }
      if (appId) { DO.WM.open(appId); closeRun(); }
      else { DO.toast("Run", "Unknown command: " + raw); input.focus(); input.select(); }
    }
  }
  function closeRun() { const d = $("#runDialog"); if (d) d.remove(); }

  // ---------- Task view overlay ----------
  function openTaskView() {
    if ($("#taskViewOverlay")) return;
    const overlay = el("div", { id: "taskViewOverlay", class: "tv-overlay" });
    const heading = el("div", { class: "tv-heading" }, "Task view — click a window to focus, or press Esc");
    const grid = el("div", { class: "tv-grid" });
    const wins = DO.WM.windows();
    if (wins.length === 0) {
      grid.appendChild(el("div", { class: "tv-empty" },
        "No windows open.", el("br"), el("br"),
        "Open the Start menu to launch an app."));
    }
    wins.forEach(w => {
      const def = DO.apps.get(w.appId) || {};
      const iconSpan = el("span", {});
      iconSpan.innerHTML = def.icon || "";
      const firstSvg = iconSpan.querySelector("svg");
      if (firstSvg) { firstSvg.setAttribute("width", 16); firstSvg.setAttribute("height", 16); }
      const card = el("div", { class: "tv-card", onclick: () => {
        closeTaskView();
        if (w.minimized) w.restore(); else w.focus();
      }},
        el("div", { class: "tv-head" }, iconSpan, el("span", {}, w.title)),
        el("div", { class: "tv-body" }, el("span", {}, def.title ? def.title[0] : "·")),
      );
      grid.appendChild(card);
    });
    overlay.append(heading, grid);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target === heading) closeTaskView();
    });
    document.body.appendChild(overlay);
  }
  function closeTaskView() { const o = $("#taskViewOverlay"); if (o) o.remove(); }

  // ---------- Global keyboard shortcuts ----------
  // Note: real Windows uses the Super / "Windows" key. In browsers this is
  // `e.metaKey` on macOS and unavailable on many Linux setups, so we also
  // accept Alt as a fallback modifier. Escape closes any open overlay.
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    // Escape closes our overlays
    if (e.key === "Escape") {
      if ($("#runDialog")) { closeRun(); return; }
      if ($("#taskViewOverlay")) { closeTaskView(); return; }
      if (!$("#widgetsFlyout")?.classList.contains("hidden")) { toggleWidgets(false); return; }
    }

    // Only on desktop (after login)
    if ($("#desktop").classList.contains("hidden")) return;
    // Don't hijack when typing in inputs/textareas (unless combo includes ctrl+alt)
    const inField = e.target instanceof HTMLElement &&
      ["INPUT", "TEXTAREA"].includes(e.target.tagName);

    const mod = (e.metaKey || e.altKey);

    // Ctrl+Shift+Esc -> open Task Manager (we use Task View)
    if (e.ctrlKey && e.shiftKey && e.key === "Escape") {
      e.preventDefault(); openTaskView(); return;
    }

    // Meta / Win combos
    if (mod && !inField) {
      if (k === "e") { e.preventDefault(); DO.WM.open("explorer"); return; }
      if (k === "r") { e.preventDefault(); openRun(); return; }
      if (k === "w") { e.preventDefault(); toggleWidgets(); return; }
      if (k === "d") {
        e.preventDefault();
        const wins = DO.WM.windows();
        const anyOpen = wins.some(w => !w.minimized);
        if (anyOpen) wins.forEach(w => !w.minimized && w.minimize());
        else wins.forEach(w => w.restore && w.restore());
        return;
      }
      if (k === "l") { e.preventDefault(); DO.showLock(); return; }
      if (k === "tab") { e.preventDefault(); openTaskView(); return; }
    }
  });

  // Expose so other modules can use these programmatically
  DO.Widgets = { toggle: toggleWidgets };
  DO.Run = { open: openRun, close: closeRun };
  DO.TaskView = { open: openTaskView, close: closeTaskView };

  // ---------- Taskbar widgets pill ----------
  function mountWidgetsPill() {
    const host = $("#tbLeft");
    if (!host || $("#tbWidgets")) return;
    const seed = todaySeed();
    const city = WIDGET_CITIES[Math.floor(seededNoise(seed) * WIDGET_CITIES.length)];
    const cond = CONDITIONS[Math.floor(seededNoise(seed + 1) * CONDITIONS.length)];
    const temp = Math.round(city.baseC + cond.tempBoost + (seededNoise(seed + 2) - 0.5) * city.range);
    const btn = el("button", {
      id: "tbWidgets", class: "tb-btn tb-widgets",
      title: "Widgets — Win+W",
      style: { width: "auto", padding: "0 10px", gap: "6px", display: "flex", alignItems: "center", fontSize: "13px" },
      onclick: () => toggleWidgets(),
    },
      el("span", { style: { fontSize: "18px" } }, cond.icon),
      el("span", { style: { fontSize: "13px" } }, temp + "°"),
    );
    host.appendChild(btn);
  }

  // Wait until shell is up
  const waitShell = setInterval(() => {
    if (!document.getElementById("desktop").classList.contains("hidden")) {
      mountWidgetsPill();
      clearInterval(waitShell);
    }
  }, 500);
})();
