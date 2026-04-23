# DevinWOS

A Windows 11-inspired web desktop, built entirely with pure **HTML, CSS, and JavaScript** — no frameworks, no build step, no dependencies.

Open `index.html` in any modern browser and sign in (any PIN, or just press Enter).

## What's inside

### Desktop shell
- Boot animation → lock screen → login → desktop
- Centered taskbar (optionally left-aligned) with Start, Search, Task View, and a live clock
- Full-featured Start menu with search
- System tray / quick settings panel (Wi-Fi, Bluetooth, Focus, Theme toggle, Chronoshift, brightness & volume)
- Notification toasts + persistent notification center
- Right-click context menus on the desktop and files
- Drag windows to screen edges to **snap** halves/full
- Drag/resize/min/max/close on every window
- 10 desktop icons, wallpaper, rubber-band selection

### Apps
1. **Notepad** – autosave hooks, font picker, word count, Chronoshift-aware
2. **Calculator** – standard / scientific / programmer modes
3. **Paint** – brushes, shapes, fill, picker, undo/redo, download PNG, Chronoshift-aware
4. **Files** – virtual file system persisted in localStorage (create/rename/delete)
5. **Browser** – real sandboxed iframe with tabs, URL bar, bookmarks, back/forward
6. **Terminal** – `help`, `ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `open`, `neofetch`, `cowsay`, `matrix`, `fortune`, tab-completion, history
7. **Clock** – world clock, countdown timer, stopwatch, alarms
8. **Camera** – real `getUserMedia` capture, save snapshots to /Pictures
9. **Media Player** – plays any local audio/video you drag in
10. **Photos** – browse /Pictures, import images, click to zoom
11. **Settings** – theme, accent, wallpaper, taskbar alignment, animations, sound, 24h clock, focus mode, font size, brightness, transparency, rewind length, and more
12. **About** – credits

### Games
- **Minesweeper** – Easy / Medium / Hard
- **Solitaire** – Klondike draw-one with undo and score/time
- **Grand Theft Web** – a top-down 2D open-city sandbox:
  - Drive any of ~24 vehicles, hijack them by kicking out the driver with `E`
  - 70+ wandering pedestrians who panic and flee
  - 5-star wanted system with escalating police response
  - Cops that chase and shoot
  - Shootouts with a pistol (`F` / click) + melee punches
  - Cash and ammo pickups
  - Mission markers that spawn and pay out when reached in a vehicle
  - HUD with HP/cash/stars/speed, plus a live radar minimap

### Special ability: **Chronoshift** (Ctrl+Alt+R)
Records the state of every rewind-aware app every 250ms for up to 30 seconds. Opens a glitch-styled overlay and lets you **scrub time backward** with a slider. Release with Enter/Escape to rewrite reality.

Wired into:
- Notepad (undo beyond your own edits)
- Paint (every stroke of your canvas)
- Grand Theft Web (yes, you can **un-die** after a shootout)

Everything is persisted in `localStorage`: settings, virtual file system, notifications, alarms.

## Development

Just open `index.html`. No build system.

To run a local dev server:

```bash
python3 -m http.server 8000
# http://localhost:8000/
```
