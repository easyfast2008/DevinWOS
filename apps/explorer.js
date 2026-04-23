/* File Explorer — virtual file system */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  function guessIcon(item) {
    if (item.type === "dir") return ICONS.folder;
    const n = item.name.toLowerCase();
    if (/\.(png|jpg|jpeg|gif|bmp|webp)$/.test(n)) return ICONS.img;
    return ICONS.file;
  }

  DO.registerApp({
    id: "explorer",
    title: "Files",
    icon: ICONS.files,
    defaultSize: { w: 820, h: 520 },
    mount(win, args = {}) {
      DO.FS.load();
      const root = win.bodyRoot;
      root.classList.add("explorer-body");

      let cwd = args.path || "/Users/Devin/Documents";

      const side = el("div", { class: "explorer-side" });
      const main = el("div", { class: "explorer-main" });
      const addr = el("div", { class: "explorer-addr" });
      const grid = el("div", { class: "explorer-grid" });

      const back = el("button", { onclick: () => go(parentPath(cwd)) }, "◀");
      const home = el("button", { onclick: () => go("/Users/Devin") }, "⌂");
      const upB = el("button", { onclick: () => go(parentPath(cwd)) }, "▲");
      const addrInput = el("input", { type: "text", value: cwd,
        onkeydown: e => { if (e.key === "Enter") go(e.target.value); } });
      addr.append(back, home, upB, addrInput);
      const mkdirB = el("button", { onclick: () => {
        const name = prompt("New folder name:");
        if (!name) return;
        if (!DO.FS.mkdir(cwd + "/" + name)) DO.toast("Files", "Could not create folder");
        render();
      } }, "New folder");
      const newTxt = el("button", { onclick: () => {
        const name = prompt("New file name:", "untitled.txt");
        if (!name) return;
        DO.FS.writeFile(cwd + "/" + name, "");
        render();
      } }, "New file");
      addr.append(mkdirB, newTxt);

      main.appendChild(addr);
      main.appendChild(grid);
      root.appendChild(side);
      root.appendChild(main);

      function parentPath(p) {
        const parts = p.split("/").filter(Boolean);
        parts.pop();
        return "/" + parts.join("/");
      }

      function go(path) {
        if (!path.startsWith("/")) path = "/" + path;
        const node = DO.FS.resolve(path);
        if (!node) { DO.toast("Files", "Not found: " + path); return; }
        if (node.type !== "dir") { openFile(path, node); return; }
        cwd = path.replace(/\/+$/, "") || "/";
        render();
      }

      function openFile(path, node) {
        const n = (node.name || "").toLowerCase();
        if (n.endsWith(".txt") || n.endsWith(".md") || n.endsWith(".json") || n.endsWith(".sys")) {
          DO.WM.open("notepad", { path });
        } else if (/\.(png|jpe?g|gif|bmp|webp)$/.test(n)) {
          DO.WM.open("photos", { path });
        } else {
          DO.toast("Files", "No handler for " + node.name);
        }
      }

      function render() {
        win.setTitle(cwd + " — Files");
        addrInput.value = cwd;

        // sidebar
        side.innerHTML = "";
        side.appendChild(el("div", { class: "sgroup" }, "Quick access"));
        const shortcuts = [
          { label: "Home",      path: "/Users/Devin" },
          { label: "Documents", path: "/Users/Devin/Documents" },
          { label: "Pictures",  path: "/Users/Devin/Pictures" },
          { label: "Music",     path: "/Users/Devin/Music" },
          { label: "Videos",    path: "/Users/Devin/Videos" },
        ];
        shortcuts.forEach(s => {
          const b = el("button", {
            class: s.path === cwd ? "active" : "",
            onclick: () => go(s.path),
          },
          (() => { const sv = DO.svg(ICONS.folder.replace(/<svg[^>]*>|<\/svg>/g,"")); sv.setAttribute("width", 16); sv.setAttribute("height", 16); return sv; })(),
          s.label);
          side.appendChild(b);
        });
        side.appendChild(el("div", { class: "sgroup" }, "This PC"));
        side.appendChild(el("button", { onclick: () => go("/") },
          (() => { const sv = DO.svg(`<circle cx="12" cy="12" r="9" fill="#2aa8ef"/>`); sv.setAttribute("width", 16); sv.setAttribute("height", 16); return sv; })(),
          "Root (/)"));

        // grid
        grid.innerHTML = "";
        const items = DO.FS.list(cwd);
        if (!items.length) {
          grid.appendChild(el("div", { style: { color: "var(--text-dim)", padding: "20px", gridColumn: "1/-1" } }, "This folder is empty."));
        }
        items.forEach(it => {
          const ic = DO.svg(guessIcon(it).replace(/<svg[^>]*>|<\/svg>/g,""));
          ic.setAttribute("width", 48); ic.setAttribute("height", 48);
          const itEl = el("div", {
            class: "explorer-item",
            tabIndex: 0,
            ondblclick: () => go(cwd === "/" ? "/" + it.name : cwd + "/" + it.name),
            onclick: () => {
              grid.querySelectorAll(".explorer-item").forEach(n => n.classList.remove("selected"));
              itEl.classList.add("selected");
            },
            oncontextmenu: (e) => DO.ctx(e, [
              { label: "Open", onClick: () => go(cwd === "/" ? "/" + it.name : cwd + "/" + it.name) },
              { label: "Rename", onClick: () => {
                const nm = prompt("Rename to:", it.name);
                if (!nm) return;
                DO.FS.rename(cwd + "/" + it.name, nm);
                render();
              }},
              { label: "Delete", onClick: () => {
                if (!confirm("Delete " + it.name + "?")) return;
                DO.FS.remove(cwd + "/" + it.name);
                render();
              }},
            ]),
          }, ic, el("div", {}, it.name));
          grid.appendChild(itEl);
        });
      }

      render();
    }
  });
})();
