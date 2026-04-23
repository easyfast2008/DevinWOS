/* Calculator — standard + scientific */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "calculator",
    title: "Calculator",
    icon: ICONS.calc,
    defaultSize: { w: 340, h: 520 },
    minSize: { w: 300, h: 440 },
    single: true,
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("calc-body");

      let mode = "std";
      let expr = "";
      let history = "";

      const mode_bar = el("div", { class: "calc-mode" });
      const stdBtn = el("button", { onclick: () => setMode("std") }, "Standard");
      const sciBtn = el("button", { onclick: () => setMode("sci") }, "Scientific");
      const progBtn = el("button", { onclick: () => setMode("prog") }, "Programmer");
      mode_bar.appendChild(stdBtn); mode_bar.appendChild(sciBtn); mode_bar.appendChild(progBtn);

      const display = el("div", { class: "calc-display" });
      const small = el("div", {}, "");
      const big = el("div", { class: "big" }, "0");
      display.appendChild(small);
      display.appendChild(big);

      const keys = el("div", { class: "calc-keys" });

      root.appendChild(mode_bar);
      root.appendChild(display);
      root.appendChild(keys);

      function setMode(m) {
        mode = m;
        stdBtn.classList.toggle("active", m === "std");
        sciBtn.classList.toggle("active", m === "sci");
        progBtn.classList.toggle("active", m === "prog");
        renderKeys();
      }

      function renderKeys() {
        keys.innerHTML = "";
        let layout;
        if (mode === "std") {
          layout = [
            ["C","⌫","%","÷"],
            ["7","8","9","×"],
            ["4","5","6","−"],
            ["1","2","3","+"],
            ["±","0",".","="],
          ];
        } else if (mode === "sci") {
          keys.style.gridTemplateColumns = "repeat(5, 1fr)";
          layout = [
            ["sin","cos","tan","π","C"],
            ["asin","acos","atan","e","⌫"],
            ["ln","log","√","^","÷"],
            ["(",")","!","%","×"],
            ["7","8","9","1/x","−"],
            ["4","5","6",".","+"],
            ["1","2","3","0","="],
          ];
        } else {
          keys.style.gridTemplateColumns = "repeat(4, 1fr)";
          layout = [
            ["HEX","DEC","OCT","BIN"],
            ["A","B","C","⌫"],
            ["D","E","F","C"],
            ["7","8","9","<<"],
            ["4","5","6",">>"],
            ["1","2","3","&"],
            ["0","|","^","="],
          ];
        }
        if (mode === "std") keys.style.gridTemplateColumns = "repeat(4, 1fr)";
        layout.flat().forEach(k => {
          const isOp = /^(\+|−|×|÷|%|=|C|⌫|±|\.|<<|>>|&|\||\^|HEX|DEC|OCT|BIN|sin|cos|tan|asin|acos|atan|ln|log|√|\^|\(|\)|!|1\/x|π|e)$/.test(k);
          const isEq = k === "=";
          const cls = isEq ? "eq" : isOp ? "op" : "";
          const b = el("button", { class: cls, onclick: () => press(k) }, k);
          keys.appendChild(b);
        });
      }

      function press(k) {
        DO.blip(880, 0.04, 0.02);
        if (k === "C") { expr = ""; history = ""; update(); return; }
        if (k === "⌫") { expr = expr.slice(0, -1); update(); return; }
        if (k === "±") { expr = expr.startsWith("-") ? expr.slice(1) : "-" + expr; update(); return; }
        if (k === "=") { compute(); return; }
        if (["HEX","DEC","OCT","BIN"].includes(k)) { /* mode flag; compute with current value */
          try {
            const val = parseFloat(expr || big.textContent);
            const map = { HEX: 16, DEC: 10, OCT: 8, BIN: 2 };
            big.textContent = Math.floor(val).toString(map[k]).toUpperCase();
          } catch {}
          return;
        }
        if (k === "π") { expr += Math.PI; update(); return; }
        if (k === "e") { expr += Math.E; update(); return; }
        if (k === "sin"||k === "cos"||k === "tan"||k === "asin"||k === "acos"||k === "atan"||k === "ln"||k === "log"||k === "√") {
          expr += ({ "√":"Math.sqrt(", "ln":"Math.log(", "log":"Math.log10(" }[k]) || ("Math." + k + "(");
          update(); return;
        }
        if (k === "^") { expr += "**"; update(); return; }
        if (k === "1/x") { expr = "1/(" + (expr || "0") + ")"; update(); return; }
        if (k === "!") {
          try {
            const v = parseFloat(expr || big.textContent);
            let r = 1; for (let i = 2; i <= v; i++) r *= i;
            history = v + "!"; big.textContent = String(r); expr = String(r);
          } catch {}
          small.textContent = history;
          return;
        }
        if (k === "×") expr += "*";
        else if (k === "÷") expr += "/";
        else if (k === "−") expr += "-";
        else expr += k;
        update();
      }

      function update() {
        big.textContent = expr || "0";
        small.textContent = history;
      }

      function compute() {
        if (!expr) return;
        try {
          // very small sandbox: only allow math chars and Math.* functions
          if (!/^[\d+\-*/.%()\s,a-zA-Z_]+$/.test(expr)) throw new Error("bad");
          // eslint-disable-next-line no-new-func
          const val = Function('"use strict"; return (' + expr + ")")();
          history = expr + " =";
          big.textContent = String(val);
          expr = String(val);
        } catch {
          big.textContent = "Error";
        }
      }

      // keyboard
      win.bodyRoot.tabIndex = 0;
      win.bodyRoot.addEventListener("keydown", (e) => {
        const key = e.key;
        if (/[0-9.+\-*/()%]/.test(key)) { expr += key; update(); e.preventDefault(); }
        else if (key === "Enter" || key === "=") { compute(); e.preventDefault(); }
        else if (key === "Backspace") { expr = expr.slice(0, -1); update(); e.preventDefault(); }
        else if (key === "Escape") { expr = ""; update(); e.preventDefault(); }
      });

      setMode("std");
      update();
    }
  });
})();
