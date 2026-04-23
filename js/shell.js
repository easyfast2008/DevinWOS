/* Shell: boot, lock/login, taskbar, start menu, quick panel, desktop icons. */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { $, $$, el, svg, ICONS } = DO;

  // ---------- boot -> login -> desktop ----------
  function boot() {
    const boot = $("#boot");
    const skip = DO.Settings.get().bootSkip;
    setTimeout(() => {
      boot.classList.add("hidden");
      showLogin();
    }, skip ? 400 : 1500);
  }

  function updateLockClock() {
    const d = new Date();
    const s = DO.Settings.get();
    const h = s.use24h ? d.getHours() : ((d.getHours() % 12) || 12);
    $("#lockTime").textContent = `${DO.fmt(h)}:${DO.fmt(d.getMinutes())}${s.use24h ? "" : (d.getHours() < 12 ? " AM" : " PM")}`;
    $("#lockDate").textContent = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function showLock() {
    updateLockClock();
    $("#desktop").classList.add("hidden");
    $("#login").classList.add("hidden");
    $("#lock").classList.remove("hidden");
  }

  function showLogin() {
    updateLockClock();
    $("#lock").classList.add("hidden");
    $("#login").classList.remove("hidden");
    setTimeout(() => $("#loginPin").focus(), 100);
  }

  function showDesktop() {
    $("#lock").classList.add("hidden");
    $("#login").classList.add("hidden");
    $("#desktop").classList.remove("hidden");
    refreshDesktopIcons();
    refreshTaskbar();
    refreshStartMenu();
    refreshNotifications();
    DO.toast("Welcome back", "Chronoshift is online. Try Ctrl+Alt+R.", { ms: 4200 });
  }

  document.addEventListener("click", (e) => {
    const lock = $("#lock");
    if (!lock.classList.contains("hidden")) {
      showLogin();
    }
  });
  document.addEventListener("keydown", (e) => {
    const lock = $("#lock");
    if (!lock.classList.contains("hidden") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      showLogin();
    }
  });

  // ---------- taskbar ----------
  function refreshTaskbar() {
    const host = $("#tbApps");
    if (!host) return;
    host.innerHTML = "";

    // Build list: one button per unique app among open windows.
    const wins = DO.WM.windows();
    const byApp = new Map();
    for (const w of wins) {
      if (!byApp.has(w.appId)) byApp.set(w.appId, []);
      byApp.get(w.appId).push(w);
    }

    const focused = wins.reduce((top, w) => {
      const z = parseInt(w.root.style.zIndex || "0", 10);
      return (!top || z > top._z) ? Object.assign(w, { _z: z }) : top;
    }, null);

    byApp.forEach((ws, appId) => {
      const def = DO.apps.get(appId);
      if (!def) return;
      const btn = el("button", {
        class: "tb-btn active" + (focused && focused.appId === appId ? " focused" : ""),
        title: def.title,
        onclick: () => {
          const list = DO.WM.byApp(appId);
          if (list.length === 1) {
            const w = list[0];
            if (w.minimized) w.restore();
            else if (focused && focused.appId === appId && !w.minimized) w.minimize();
            else w.focus();
          } else {
            // cycle
            const unminimized = list.filter(w => !w.minimized);
            if (unminimized.length) unminimized[0].minimize();
            else list[0].restore();
          }
        },
        oncontextmenu: (e) => {
          DO.ctx(e, [
            { label: "Close all", onClick: () => ws.slice().forEach(w => w.close()) },
            { label: "Minimize all", onClick: () => ws.forEach(w => !w.minimized && w.minimize()) },
            { label: "Open new", onClick: () => DO.WM.open(appId) },
          ]);
        }
      }, (() => { const s = DO.svg(def.icon.replace(/<svg[^>]*>|<\/svg>/g, "")); s.setAttribute("width", 22); s.setAttribute("height", 22); return s; })());
      host.appendChild(btn);
    });
  }
  DO.refreshTaskbar = refreshTaskbar;

  // ---------- clock ----------
  function tickClock() {
    const d = new Date();
    const s = DO.Settings.get();
    const h = s.use24h ? d.getHours() : ((d.getHours() % 12) || 12);
    const time = s.use24h
      ? `${DO.fmt(h)}:${DO.fmt(d.getMinutes())}`
      : `${h}:${DO.fmt(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
    const tb = $("#tbTime"); if (tb) tb.textContent = time;
    const tbd = $("#tbDate"); if (tbd) tbd.textContent = d.toLocaleDateString();

    if (!$("#lock").classList.contains("hidden")) updateLockClock();
  }

  // ---------- start menu ----------
  function pinnedOrder() {
    return ["notepad","calculator","paint","explorer","browser","terminal","clock","camera","mediaplayer","photos","settings","minesweeper","solitaire","gta","about"];
  }
  function refreshStartMenu(filter = "") {
    const pinned = $("#startPinned");
    const all = $("#startAll");
    if (!pinned || !all) return;
    pinned.innerHTML = ""; all.innerHTML = "";

    const items = pinnedOrder()
      .map(id => DO.apps.get(id))
      .filter(Boolean);

    items.slice(0, 12).forEach(def => pinned.appendChild(itemEl(def)));
    items
      .filter(def => !filter || def.title.toLowerCase().includes(filter.toLowerCase()))
      .forEach(def => all.appendChild(itemEl(def)));

    function itemEl(def) {
      return el("button", {
        class: "start-item",
        onclick: () => { closeStart(); DO.WM.open(def.id); }
      },
      (() => { const s = DO.svg(def.icon.replace(/<svg[^>]*>|<\/svg>/g, "")); s.setAttribute("width", 34); s.setAttribute("height", 34); return s; })(),
      def.title);
    }
  }
  function openStart() { $("#startMenu").classList.remove("hidden"); setTimeout(() => $("#startSearch").focus(), 40); }
  function closeStart() { $("#startMenu").classList.add("hidden"); }
  function toggleStart() { $("#startMenu").classList.toggle("hidden"); if (!$("#startMenu").classList.contains("hidden")) setTimeout(() => $("#startSearch").focus(), 40); }

  // ---------- quick panel ----------
  function refreshQuickPanel() {
    const s = DO.Settings.get();
    document.querySelectorAll(".qt").forEach(b => {
      const id = b.dataset.qt;
      let on = false;
      if (id === "wifi") on = true;
      if (id === "bluetooth") on = false;
      if (id === "focus") on = s.focus;
      if (id === "mute") on = s.sound;
      if (id === "theme") on = s.theme === "dark";
      if (id === "rewind") on = DO.Rewind && DO.Rewind.active;
      b.classList.toggle("on", !!on);
    });
    $("#qBrightness").value = s.brightness;
    $("#qVolume").value = s.volume;
  }

  function refreshNotifications() {
    const host = $("#qNotifs"); if (!host) return;
    host.innerHTML = "";
    const list = DO.notifications;
    if (list.length === 0) {
      host.appendChild(el("div", { class: "quick-foot" }, "No new notifications"));
      return;
    }
    list.slice(0, 8).forEach(n => {
      host.appendChild(el("div", { class: "qn" },
        el("div", { class: "qn-title" }, n.title),
        el("div", { class: "qn-body" }, n.body)
      ));
    });
    const foot = $("#qFoot");
    if (foot) {
      foot.innerHTML = "";
      foot.appendChild(el("button", {
        class: "qt", style: { margin: "6px auto 0", display: "block" },
        onclick: () => DO.clearNotifications()
      }, "Clear all"));
    }
  }
  DO.refreshNotifications = refreshNotifications;

  function toggleQuick() {
    const q = $("#quickPanel");
    q.classList.toggle("hidden");
    if (!q.classList.contains("hidden")) refreshQuickPanel();
  }
  function closeQuick() { $("#quickPanel").classList.add("hidden"); }

  // ---------- desktop icons ----------
  function desktopIconList() {
    return [
      { id: "explorer",    title: "Files",      icon: ICONS.files },
      { id: "browser",     title: "Browser",    icon: ICONS.browser },
      { id: "notepad",     title: "Notepad",    icon: ICONS.notepad },
      { id: "paint",       title: "Paint",      icon: ICONS.paint },
      { id: "gta",         title: "Grand Theft Web", icon: ICONS.gta },
      { id: "minesweeper", title: "Minesweeper",icon: ICONS.mines },
      { id: "solitaire",   title: "Solitaire",  icon: ICONS.solitaire },
      { id: "terminal",    title: "Terminal",   icon: ICONS.terminal },
      { id: "settings",    title: "Settings",   icon: ICONS.settings },
      { id: "about",       title: "About",      icon: ICONS.about },
    ];
  }

  function refreshDesktopIcons() {
    const host = $("#desktopIcons");
    if (!host) return;
    host.innerHTML = "";
    desktopIconList().forEach(it => {
      const s = DO.svg(it.icon.replace(/<svg[^>]*>|<\/svg>/g, ""));
      s.setAttribute("width", 40); s.setAttribute("height", 40);
      const icWrap = el("div", { class: "di-ic" }, s);
      const btn = el("div", {
        class: "di", tabIndex: 0,
        ondblclick: () => DO.WM.open(it.id),
        onclick: (e) => {
          $$(".di").forEach(x => x.classList.remove("selected"));
          btn.classList.add("selected");
        },
        oncontextmenu: (e) => DO.ctx(e, [
          { label: "Open", onClick: () => DO.WM.open(it.id) },
          "---",
          { label: "Properties", onClick: () => DO.toast(it.title, "No properties for virtual icons.") },
        ]),
      },
      icWrap,
      el("div", { class: "di-lb" }, it.title));
      host.appendChild(btn);
    });
  }

  // Desktop right-click
  document.getElementById("desktop").addEventListener("contextmenu", (e) => {
    if (e.target.closest(".window") || e.target.closest(".taskbar") || e.target.closest(".di") || e.target.closest(".start-menu") || e.target.closest(".quick-panel") || e.target.closest(".ctx-menu")) return;
    DO.ctx(e, [
      { label: "View — Large icons", onClick: () => DO.toast("View", "Already the only view.") },
      { label: "Refresh", onClick: () => refreshDesktopIcons() },
      "---",
      { label: "Change wallpaper…", onClick: () => DO.WM.open("settings", { tab: "personal" }) },
      { label: "Display settings", onClick: () => DO.WM.open("settings", { tab: "display" }) },
      "---",
      { label: "Activate Chronoshift", onClick: () => DO.Rewind && DO.Rewind.activate() },
    ]);
  });

  // Desktop selection rubberband
  (function selection() {
    let start = null;
    const box = $("#selectionBox");
    document.getElementById("desktop").addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".window") || e.target.closest(".taskbar") || e.target.closest(".di") || e.target.closest(".start-menu") || e.target.closest(".quick-panel") || e.target.closest(".ctx-menu")) return;
      start = { x: e.clientX, y: e.clientY };
      box.classList.remove("hidden");
      box.style.left = start.x + "px"; box.style.top = start.y + "px"; box.style.width = "0px"; box.style.height = "0px";
      const onMove = (ev) => {
        const x = Math.min(start.x, ev.clientX), y = Math.min(start.y, ev.clientY);
        const w = Math.abs(ev.clientX - start.x), h = Math.abs(ev.clientY - start.y);
        box.style.left = x + "px"; box.style.top = y + "px"; box.style.width = w + "px"; box.style.height = h + "px";
      };
      const onUp = () => {
        box.classList.add("hidden");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  })();

  // ---------- wire up shell buttons ----------
  function wireShell() {
    $("#tbStart").addEventListener("click", (e) => { e.stopPropagation(); toggleStart(); });
    $("#tbSearch").addEventListener("click", () => { openStart(); $("#startSearch").focus(); });
    $("#tbTaskView").addEventListener("click", () => {
      const wins = DO.WM.windows();
      if (!wins.length) { DO.toast("Task view", "No windows open."); return; }
      const allMin = wins.every(w => w.minimized);
      wins.forEach(w => allMin ? w.restore() : w.minimize());
    });
    $("#tbClock").addEventListener("click", () => { closeStart(); toggleQuick(); });
    $("#tbTray").addEventListener("click", () => { closeStart(); toggleQuick(); });

    $("#btnLock").addEventListener("click", () => showLock());
    $("#btnPower").addEventListener("click", () => {
      document.body.style.transition = "opacity 0.5s";
      document.body.style.opacity = "0";
      setTimeout(() => { location.reload(); }, 500);
    });

    $("#startSearch").addEventListener("input", (e) => refreshStartMenu(e.target.value));
    $("#startSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = $("#startAll .start-item");
        if (first) first.click();
      }
      if (e.key === "Escape") closeStart();
    });

    // Quick panel tile clicks
    $$(".qt").forEach(b => {
      b.addEventListener("click", () => {
        const id = b.dataset.qt;
        const s = DO.Settings.get();
        if (id === "focus")    DO.Settings.set({ focus: !s.focus });
        else if (id === "mute")DO.Settings.set({ sound: !s.sound });
        else if (id === "theme") DO.Settings.set({ theme: s.theme === "dark" ? "light" : "dark" });
        else if (id === "rewind") { closeQuick(); DO.Rewind.activate(); }
        else if (id === "wifi") DO.toast("Wi-Fi", "Online: DevinWOS-Net");
        else if (id === "bluetooth") DO.toast("Bluetooth", "No nearby devices.");
        refreshQuickPanel();
      });
    });
    $("#qBrightness").addEventListener("input", (e) => DO.Settings.set({ brightness: +e.target.value }));
    $("#qVolume").addEventListener("input", (e) => DO.Settings.set({ volume: +e.target.value }));

    // Login
    $("#loginForm").addEventListener("submit", (e) => { e.preventDefault(); showDesktop(); });
    $("#loginPower").addEventListener("click", () => location.reload());

    // Global: click outside to close menus
    document.addEventListener("mousedown", (e) => {
      const sm = $("#startMenu");
      if (!sm.classList.contains("hidden") && !e.target.closest("#startMenu") && !e.target.closest("#tbStart") && !e.target.closest("#tbSearch")) {
        closeStart();
      }
      const qp = $("#quickPanel");
      if (!qp.classList.contains("hidden") && !e.target.closest("#quickPanel") && !e.target.closest("#tbClock") && !e.target.closest("#tbTray")) {
        closeQuick();
      }
    }, true);

    // Global keys
    document.addEventListener("keydown", (e) => {
      if (e.key === "Meta" || (e.ctrlKey && e.key === "Escape")) {
        e.preventDefault();
        toggleStart();
      }
      if (e.key === "Escape") {
        closeStart(); closeQuick();
      }
    });
  }

  DO.refreshDesktopIcons = refreshDesktopIcons;
  DO.refreshStartMenu = refreshStartMenu;
  DO.closeStart = closeStart;
  DO.boot = boot;
  DO.showLock = showLock;
  DO.showLogin = showLogin;
  DO.showDesktop = showDesktop;

  document.addEventListener("DOMContentLoaded", () => {
    wireShell();
    setInterval(tickClock, 1000);
    tickClock();
    boot();
  });
})();
