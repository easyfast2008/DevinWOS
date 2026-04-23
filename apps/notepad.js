/* Notepad */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "notepad",
    title: "Notepad",
    icon: ICONS.notepad,
    defaultSize: { w: 620, h: 460 },
    mount(win, args = {}) {
      const root = win.bodyRoot;
      root.classList.add("notepad-body");

      let currentPath = args.path || null;
      let dirty = false;

      const ta = el("textarea", {
        placeholder: "Start typing…",
        spellcheck: "false",
        value: args.content || (currentPath ? (DO.FS.readFile(currentPath) || "") : ""),
        oninput: () => { dirty = true; updateTitle(); },
      });

      const toolbar = el("div", { class: "toolbar" },
        el("button", { onclick: () => newFile() }, "New"),
        el("button", { onclick: () => openFile() }, "Open"),
        el("button", { onclick: () => saveFile() }, "Save"),
        el("button", { onclick: () => saveFile(true) }, "Save As"),
        el("span", { class: "sep" }),
        el("button", { onclick: () => ta.focus() }, "Focus"),
        el("span", { class: "sep" }),
        el("select", {
          onchange: e => ta.style.fontFamily = e.target.value
        },
          el("option", { value: '"Cascadia Code", Consolas, monospace' }, "Cascadia Code"),
          el("option", { value: 'system-ui' }, "Segoe UI"),
          el("option", { value: 'Georgia, serif' }, "Georgia"),
        ),
        el("input", { type: "number", min: 10, max: 36, value: 14, style: { width: "56px" },
          oninput: e => ta.style.fontSize = e.target.value + "px"
        }),
        el("span", { class: "spacer" }),
        el("span", { id: "wc", style: { color: "var(--text-dim)", fontSize: "12px" } }, "0 words"),
      );
      root.appendChild(toolbar);
      root.appendChild(ta);
      const status = el("div", { class: "statusbar" }, el("span", { id: "npStatus" }, "Ready"));
      root.appendChild(status);

      function updateTitle() {
        const name = currentPath ? currentPath.split("/").pop() : "Untitled";
        win.setTitle((dirty ? "• " : "") + name + " — Notepad");
        toolbar.querySelector("#wc").textContent =
          `${ta.value.length} chars · ${(ta.value.trim().match(/\S+/g) || []).length} words`;
      }
      ta.addEventListener("input", updateTitle);

      function newFile() {
        if (dirty && !confirm("Discard unsaved changes?")) return;
        currentPath = null; ta.value = ""; dirty = false; updateTitle();
      }

      function openFile() {
        const path = prompt("Open path (example: /Users/Devin/Documents/welcome.txt):", "/Users/Devin/Documents/welcome.txt");
        if (!path) return;
        const c = DO.FS.readFile(path);
        if (c == null) { DO.toast("Notepad", "Not found: " + path); return; }
        currentPath = path; ta.value = c; dirty = false; updateTitle();
      }

      function saveFile(as = false) {
        let path = currentPath;
        if (!path || as) {
          path = prompt("Save as (example: /Users/Devin/Documents/myfile.txt):", "/Users/Devin/Documents/note.txt");
          if (!path) return;
        }
        const ok = DO.FS.writeFile(path, ta.value);
        if (!ok) { DO.toast("Notepad", "Could not save to " + path); return; }
        currentPath = path; dirty = false; updateTitle();
        DO.toast("Notepad", "Saved " + path);
      }

      // Rewind support
      win.rewind = {
        snapshot: () => ({ v: ta.value, s: ta.selectionStart, e: ta.selectionEnd }),
        restore: (st) => { ta.value = st.v; try { ta.setSelectionRange(st.s, st.e); } catch {} dirty = true; updateTitle(); },
      };

      updateTitle();
      setTimeout(() => ta.focus(), 40);
    }
  });
})();
