/* About DevinWOS */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "about",
    title: "About DevinWOS",
    icon: ICONS.about,
    defaultSize: { w: 520, h: 520 },
    single: true,
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("about-body");

      root.append(
        el("div", { class: "about-badge" }, "DevinWOS · build 1.0"),
        el("h2", { class: "about-title", style: { marginTop: "12px" } }, "A small web desktop"),
        el("p", { style: { color: "var(--text-dim)" } },
          "DevinWOS is a Windows 11-inspired web desktop built entirely in HTML, CSS, and JavaScript — no frameworks, no build step. ",
          "It ships with a real window manager, a virtual file system, ten apps, three games (including a playable top-down GTA-style city), and a unique ability called Chronoshift."),
        el("h3", {}, "Apps"),
        el("ul", {},
          el("li", {}, "Notepad · Calculator · Paint · Files · Browser · Terminal"),
          el("li", {}, "Clock/Timer/Stopwatch/Alarms · Camera · Media Player · Photos · Settings"),
        ),
        el("h3", {}, "Games"),
        el("ul", {},
          el("li", {}, "Minesweeper — full implementation with mine-counter and timer"),
          el("li", {}, "Solitaire — Klondike draw-1 with foundations and auto-complete"),
          el("li", {}, "Grand Theft Web — top-down open city, drive/steal vehicles, wanted level, cops, pedestrians, shooting, and missions"),
        ),
        el("h3", {}, "Special ability: Chronoshift"),
        el("p", { style: { color: "var(--text-dim)" } },
          "Press ", el("b", {}, "Ctrl+Alt+R"), " anywhere. Chronoshift captures the state of supported apps (Notepad, Paint, GTA) every 250ms for up to 30 seconds and lets you scrub backward in time with a slider. Release Enter/Escape to commit the new timeline. You can actually ",
          el("i", {}, "un-die"), " in the GTA clone."),
        el("h3", {}, "Tips"),
        el("ul", {},
          el("li", {}, "Right-click the desktop for wallpapers, settings, and Chronoshift."),
          el("li", {}, "Drag windows to screen edges to snap."),
          el("li", {}, "All settings and the virtual file system persist in localStorage."),
          el("li", {}, "The Browser is a real sandboxed iframe — some big sites block embedding (not our fault)."),
        ),
        el("p", { style: { marginTop: "16px", color: "var(--text-dim)", fontSize: "12px" } },
          "© ", new Date().getFullYear(), " DevinWOS. Icons are hand-drawn SVGs. Not affiliated with Microsoft or any other OS."),
      );
    }
  });
})();
