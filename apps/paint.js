/* Paint — canvas drawing with brushes, shapes, undo/redo, and Rewind. */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "paint",
    title: "Paint",
    icon: ICONS.paint,
    defaultSize: { w: 820, h: 600 },
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("paint-body");

      const W = 800, H = 500;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      canvas.className = "paint-canvas";
      const ctx = canvas.getContext("2d");

      // background white
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

      // State
      let tool = "pen";
      let color = "#111";
      let size = 4;
      let drawing = false;
      let last = null;
      let start = null;
      let preTool = null;

      const undoStack = []; const redoStack = [];
      const pushUndo = () => {
        undoStack.push(canvas.toDataURL());
        if (undoStack.length > 40) undoStack.shift();
        redoStack.length = 0;
      };

      const tb = el("div", { class: "toolbar" });
      function toolBtn(id, label) {
        const b = el("button", {
          onclick: () => { tool = id; updateToolButtons(); },
          dataset: { tool: id }
        }, label);
        return b;
      }
      const penBtn = toolBtn("pen", "✎ Pen");
      const eraseBtn = toolBtn("erase", "⌫ Erase");
      const fillBtn = toolBtn("fill", "⬛ Fill");
      const rectBtn = toolBtn("rect", "▭ Rect");
      const circBtn = toolBtn("circle", "◯ Circle");
      const lineBtn = toolBtn("line", "╱ Line");
      const textBtn = toolBtn("text", "T Text");
      const picker = toolBtn("picker", "⊙ Pick");

      tb.append(penBtn, eraseBtn, fillBtn, rectBtn, circBtn, lineBtn, textBtn, picker);
      tb.appendChild(el("span", { class: "sep" }));
      tb.appendChild(el("input", { type: "color", value: color,
        oninput: e => { color = e.target.value; } }));
      tb.appendChild(el("input", { type: "range", min: 1, max: 60, value: size,
        oninput: e => { size = +e.target.value; } }));
      tb.appendChild(el("span", { class: "sep" }));
      tb.appendChild(el("button", { onclick: () => doUndo() }, "Undo"));
      tb.appendChild(el("button", { onclick: () => doRedo() }, "Redo"));
      tb.appendChild(el("button", { onclick: () => {
        if (!confirm("Clear canvas?")) return;
        pushUndo(); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      } }, "Clear"));
      tb.appendChild(el("span", { class: "spacer" }));
      tb.appendChild(el("button", { onclick: () => {
        const a = document.createElement("a");
        a.download = "drawing.png"; a.href = canvas.toDataURL("image/png"); a.click();
      } }, "Download"));

      function updateToolButtons() {
        tb.querySelectorAll("button[data-tool]").forEach(b => {
          b.style.background = b.dataset.tool === tool ? "var(--accent)" : "";
          b.style.color = b.dataset.tool === tool ? "#fff" : "";
        });
      }
      updateToolButtons();

      const wrap = el("div", { class: "paint-canvas-wrap" }, canvas);
      root.appendChild(tb);
      root.appendChild(wrap);

      function doUndo() {
        if (!undoStack.length) return;
        redoStack.push(canvas.toDataURL());
        const data = undoStack.pop();
        const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = data;
      }
      function doRedo() {
        if (!redoStack.length) return;
        undoStack.push(canvas.toDataURL());
        const data = redoStack.pop();
        const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = data;
      }

      // helpers
      function posFromEvent(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
      }

      function floodFill(x, y, fillHex) {
        x = Math.floor(x); y = Math.floor(y);
        const img = ctx.getImageData(0, 0, W, H);
        const d = img.data;
        const idx = (x, y) => (y * W + x) * 4;
        const target = d.slice(idx(x,y), idx(x,y)+4);
        const fill = hexToRgb(fillHex);
        if (colorsEqual(target, fill)) return;
        const stack = [[x,y]];
        while (stack.length) {
          const [cx, cy] = stack.pop();
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          const p = idx(cx, cy);
          if (!colorsEqual(d.slice(p,p+4), target)) continue;
          d[p] = fill[0]; d[p+1] = fill[1]; d[p+2] = fill[2]; d[p+3] = 255;
          stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
        }
        ctx.putImageData(img, 0, 0);
      }
      function hexToRgb(h) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
        return m ? [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)] : [0,0,0];
      }
      function colorsEqual(a, b) { return a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]&&a[3]===b[3]; }

      // drawing
      canvas.addEventListener("pointerdown", (e) => {
        const p = posFromEvent(e);
        pushUndo();
        if (tool === "fill") {
          const rgb = hexToRgb(color);
          floodFill(p.x, p.y, color);
          return;
        }
        if (tool === "picker") {
          const id = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
          color = "#" + [id[0],id[1],id[2]].map(v => v.toString(16).padStart(2,"0")).join("");
          tb.querySelector('input[type="color"]').value = color;
          return;
        }
        if (tool === "text") {
          const t = prompt("Text:");
          if (!t) return;
          ctx.font = (size * 4) + "px system-ui";
          ctx.fillStyle = color;
          ctx.fillText(t, p.x, p.y);
          return;
        }
        drawing = true;
        last = p; start = p;
        preTool = canvas.toDataURL();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!drawing) return;
        const p = posFromEvent(e);
        if (tool === "pen" || tool === "erase") {
          ctx.strokeStyle = tool === "erase" ? "#fff" : color;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          last = p;
        } else if (tool === "rect" || tool === "circle" || tool === "line") {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0);
            ctx.strokeStyle = color; ctx.lineWidth = size;
            ctx.beginPath();
            if (tool === "rect") ctx.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y);
            if (tool === "circle") {
              const rr = Math.hypot(p.x - start.x, p.y - start.y);
              ctx.arc(start.x, start.y, rr, 0, Math.PI * 2); ctx.stroke();
            }
            if (tool === "line") {
              ctx.moveTo(start.x, start.y); ctx.lineTo(p.x, p.y); ctx.stroke();
            }
          };
          img.src = preTool;
        }
      });
      canvas.addEventListener("pointerup", () => { drawing = false; });
      canvas.addEventListener("pointerleave", () => { drawing = false; });

      // keyboard
      win.bodyRoot.tabIndex = 0;
      win.bodyRoot.addEventListener("keydown", (e) => {
        if (e.ctrlKey && e.key === "z") { e.preventDefault(); doUndo(); }
        if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) { e.preventDefault(); doRedo(); }
      });

      // Rewind: save as dataURL (relatively small for small canvases)
      win.rewind = {
        snapshot: () => canvas.toDataURL(),
        restore: (state) => {
          const img = new Image(); img.onload = () => {
            ctx.fillStyle = "#fff"; ctx.fillRect(0,0,W,H);
            ctx.drawImage(img, 0, 0);
          };
          img.src = state;
        },
      };
    }
  });
})();
