/* Photos — browse Pictures folder in FS (including Camera snapshots saved as data URLs) */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "photos",
    title: "Photos",
    icon: ICONS.photos,
    defaultSize: { w: 720, h: 520 },
    mount(win, args = {}) {
      const root = win.bodyRoot;
      root.classList.add("photos-body");

      const bar = el("div", { class: "toolbar" },
        el("button", { onclick: () => fileInput.click() }, "Import"),
        el("span", { class: "sep" }),
        el("span", {}, "Pictures folder"),
      );
      const grid = el("div", { class: "photos-grid" });
      root.append(bar, grid);

      const fileInput = el("input", { type: "file", multiple: true, accept: "image/*", style: { display: "none" },
        onchange: async e => {
          for (const f of Array.from(e.target.files)) {
            const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
            DO.FS.writeFile("/Users/Devin/Pictures/" + f.name, url);
          }
          render();
        } });
      root.appendChild(fileInput);

      function render() {
        grid.innerHTML = "";
        const pics = DO.FS.list("/Users/Devin/Pictures").filter(n => n.type === "file");
        if (!pics.length) {
          grid.appendChild(el("div", { style: { color: "var(--text-dim)", gridColumn: "1/-1", padding: "40px", textAlign: "center" } },
            "No photos yet. Use Camera to capture, or click Import."
          ));
          return;
        }
        pics.forEach(p => {
          const img = el("img", { src: p.content, alt: p.name });
          img.addEventListener("click", () => openLarge(p.content));
          grid.appendChild(img);
        });
      }

      function openLarge(src) {
        const modal = el("div", { class: "photos-modal",
          onclick: () => modal.remove(),
        }, el("img", { src }));
        document.body.appendChild(modal);
      }

      if (args.path) {
        const c = DO.FS.readFile(args.path);
        if (c) openLarge(c);
      }
      render();
    }
  });
})();
