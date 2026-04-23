/* Settings app */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS, WALLPAPERS } = DO;

  const TABS = [
    { id: "personal", label: "Personalization" },
    { id: "display",  label: "Display" },
    { id: "sound",    label: "Sound" },
    { id: "time",     label: "Time & language" },
    { id: "system",   label: "System" },
    { id: "accounts", label: "Accounts" },
    { id: "ability",  label: "Chronoshift" },
    { id: "about",    label: "About" },
  ];

  function row(label, right, sub) {
    return el("div", { class: "settings-row" },
      el("div", { class: "l" }, label, sub ? el("small", {}, sub) : null),
      right
    );
  }

  function sw(value, onChange) {
    const s = el("div", { class: "switch" + (value ? " on" : ""), tabIndex: 0 });
    s.addEventListener("click", () => { onChange(!s.classList.contains("on")); });
    s.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onChange(!s.classList.contains("on")); } });
    return s;
  }

  function render(win, tab) {
    const s = DO.Settings.get();
    const body = win.bodyRoot;
    body.classList.add("settings-body");
    body.innerHTML = "";

    const side = el("div", { class: "settings-side" });
    TABS.forEach(t => {
      side.appendChild(el("button", {
        class: t.id === tab ? "active" : "",
        onclick: () => render(win, t.id),
      }, t.label));
    });

    const main = el("div", { class: "settings-main" });
    main.appendChild(el("h2", { class: "settings-h" }, TABS.find(t => t.id === tab).label));

    switch (tab) {
      case "personal": renderPersonal(main, s); break;
      case "display":  renderDisplay(main, s); break;
      case "sound":    renderSound(main, s); break;
      case "time":     renderTime(main, s); break;
      case "system":   renderSystem(main, s); break;
      case "accounts": renderAccounts(main, s); break;
      case "ability":  renderAbility(main, s); break;
      case "about":    renderAbout(main, s); break;
    }

    body.appendChild(side);
    body.appendChild(main);
  }

  function renderPersonal(host, s) {
    host.appendChild(el("div", { class: "settings-h2" }, "Wallpaper"));
    const grid = el("div", { class: "wp-grid" });
    WALLPAPERS.forEach(w => {
      const b = el("button", {
        class: w.id === s.wallpaper ? "active" : "",
        style: { background: w.css, color: "#fff" },
        title: w.name,
        onclick: () => { DO.Settings.set({ wallpaper: w.id }); refreshActive(grid, "wp-grid", w.id, "active"); }
      }, w.name);
      grid.appendChild(b);
    });
    host.appendChild(grid);

    host.appendChild(el("div", { class: "settings-h2" }, "Accent color"));
    const ac = el("div", { class: "accent-swatches" });
    ["blue","purple","green","pink","orange","red"].forEach(a => {
      const c = getComputedStyle(document.body).getPropertyValue("--accent-" + a) || "#888";
      const b = el("button", {
        class: a === s.accent ? "active" : "",
        style: { background: c.trim() },
        onclick: () => { DO.Settings.set({ accent: a }); $$setActive(ac, b); }
      });
      ac.appendChild(b);
    });
    host.appendChild(ac);

    host.appendChild(el("div", { class: "settings-h2" }, "Theme"));
    host.appendChild(row("Dark mode",
      sw(s.theme === "dark", v => DO.Settings.set({ theme: v ? "dark" : "light" })),
      "Switch between light and dark modes"
    ));
    host.appendChild(row("Transparency effects",
      sw(s.transparency, v => DO.Settings.set({ transparency: v }))
    ));

    host.appendChild(el("div", { class: "settings-h2" }, "Taskbar"));
    host.appendChild(row("Taskbar alignment",
      (() => {
        const sel = el("select", {
          onchange: e => DO.Settings.set({ taskbarAlign: e.target.value })
        },
          el("option", { value: "center", selected: s.taskbarAlign === "center" }, "Center"),
          el("option", { value: "left", selected: s.taskbarAlign === "left" }, "Left"),
        );
        return sel;
      })()
    ));
    host.appendChild(row("Animations",
      sw(s.animations, v => DO.Settings.set({ animations: v }))
    ));
    host.appendChild(row("Focus (hide tray + notifications)",
      sw(s.focus, v => DO.Settings.set({ focus: v }))
    ));
  }

  function renderDisplay(host, s) {
    host.appendChild(row("Brightness",
      el("input", { type: "range", min: 40, max: 100, value: s.brightness,
        oninput: e => DO.Settings.set({ brightness: +e.target.value }) })
    ));
    host.appendChild(row("Font size",
      (() => {
        const sel = el("select", {
          onchange: e => DO.Settings.set({ fontsize: e.target.value })
        },
          el("option", { value: "md", selected: s.fontsize === "md" }, "Default"),
          el("option", { value: "lg", selected: s.fontsize === "lg" }, "Large"),
          el("option", { value: "xl", selected: s.fontsize === "xl" }, "Extra large"),
        );
        return sel;
      })()
    ));
    host.appendChild(row("Reset window layout",
      el("button", { onclick: () => { DO.WM.closeAll(); DO.toast("Display", "All windows closed."); } }, "Close all windows")
    ));
  }

  function renderSound(host, s) {
    host.appendChild(row("Sound effects",
      sw(s.sound, v => DO.Settings.set({ sound: v }))
    ));
    host.appendChild(row("Volume",
      el("input", { type: "range", min: 0, max: 100, value: s.volume,
        oninput: e => DO.Settings.set({ volume: +e.target.value }) })
    ));
    host.appendChild(row("Test tone",
      el("button", { onclick: () => DO.blip(660, 0.25, 0.05) }, "Play")
    ));
  }

  function renderTime(host, s) {
    host.appendChild(row("Use 24-hour clock",
      sw(s.use24h, v => DO.Settings.set({ use24h: v }))
    ));
    host.appendChild(row("Timezone",
      el("input", { type: "text", value: Intl.DateTimeFormat().resolvedOptions().timeZone, disabled: true })
    ));
  }

  function renderSystem(host, s) {
    host.appendChild(row("Skip boot animation",
      sw(s.bootSkip, v => DO.Settings.set({ bootSkip: v }))
    ));
    host.appendChild(row("Reset file system (virtual)",
      el("button", { onclick: () => { DO.FS.reset(); DO.toast("File system", "Reset to defaults."); } }, "Reset")
    ));
    host.appendChild(row("Reset all settings",
      el("button", {
        onclick: () => {
          if (!confirm("Reset all DevinWOS settings?")) return;
          localStorage.removeItem("devinwos.v1");
          location.reload();
        }
      }, "Reset")
    ));
  }

  function renderAccounts(host, s) {
    host.appendChild(row("Account name", el("input", { type: "text", value: "Devin", disabled: true })));
    host.appendChild(row("PIN", el("input", { type: "password", value: "", placeholder: "No PIN" })));
    host.appendChild(row("Sign out", el("button", { onclick: () => DO.showLogin() }, "Sign out")));
  }

  function renderAbility(host, s) {
    host.appendChild(el("div", { class: "about-badge" }, "Signature ability · Chronoshift"));
    host.appendChild(el("p", { style: { color: "var(--text-dim)", fontSize: "13px", lineHeight: "1.6" } },
      "Chronoshift is DevinWOS' signature superpower. Every rewind-aware app (Notepad, Paint, Grand Theft Web) takes a tiny state snapshot four times a second. Activate with ",
      el("kbd", {}, "Ctrl+Alt+R"),
      " or the Rewind tile in the quick panel, and the whole system freezes behind a glitch overlay with a scrubber. Drag backwards to see your typing, drawings, or GTA run unwind frame-by-frame. Release with ",
      el("kbd", {}, "Enter"),
      " to commit the rewind, or ",
      el("kbd", {}, "Esc"),
      " to cancel. Great for recovering from crashes, bad brush strokes, or a particularly rough shootout."
    ));
    host.appendChild(row("Maximum rewind time",
      (() => {
        const sel = el("select", {
          onchange: e => DO.Settings.set({ rewindMaxSec: +e.target.value })
        },
          el("option", { value: 10, selected: s.rewindMaxSec === 10 }, "10 seconds"),
          el("option", { value: 30, selected: s.rewindMaxSec === 30 }, "30 seconds"),
          el("option", { value: 60, selected: s.rewindMaxSec === 60 }, "60 seconds"),
          el("option", { value: 120, selected: s.rewindMaxSec === 120 }, "2 minutes"),
        );
        return sel;
      })()
    ));
    host.appendChild(row("Activate now", el("button", { onclick: () => DO.Rewind.activate() }, "Activate")));
  }

  function renderAbout(host, s) {
    host.appendChild(el("div", { class: "about-badge" }, "DevinWOS · build 1.0"));
    host.appendChild(el("div", { class: "about-row" }, el("div", { class: "k" }, "Edition"), el("div", {}, "DevinWOS Home")));
    host.appendChild(el("div", { class: "about-row" }, el("div", { class: "k" }, "Processor"), el("div", {}, "Your browser")));
    host.appendChild(el("div", { class: "about-row" }, el("div", { class: "k" }, "Installed RAM"), el("div", {}, (navigator.deviceMemory || "?") + " GB")));
    host.appendChild(el("div", { class: "about-row" }, el("div", { class: "k" }, "Cores"), el("div", {}, String(navigator.hardwareConcurrency || "?"))));
    host.appendChild(el("div", { class: "about-row" }, el("div", { class: "k" }, "Device name"), el("div", {}, "DEVIN-PC")));
    host.appendChild(el("div", { class: "about-row" }, el("div", { class: "k" }, "Engine"), el("div", {}, navigator.userAgent.split(" ").slice(-2).join(" "))));
  }

  function $$setActive(host, target) {
    Array.from(host.children).forEach(c => c.classList.remove("active"));
    target.classList.add("active");
  }
  function refreshActive(host, cls, id, activeCls) {
    Array.from(host.children).forEach(c => c.classList.remove(activeCls));
    Array.from(host.children).forEach(c => {
      if (c.title && WALLPAPERS.find(w => w.id === id && w.name === c.title)) c.classList.add(activeCls);
    });
  }

  DO.registerApp({
    id: "settings",
    title: "Settings",
    icon: ICONS.settings,
    defaultSize: { w: 820, h: 560 },
    minSize: { w: 620, h: 420 },
    single: true,
    mount(win, args = {}) { render(win, args.tab || "personal"); win.setTitle("Settings"); },
    onReopen(win, args = {}) { render(win, args.tab || "personal"); },
  });
})();
