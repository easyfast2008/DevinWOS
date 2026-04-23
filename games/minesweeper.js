/* Minesweeper */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  const DIFFS = {
    easy:   { w: 9,  h: 9,  m: 10 },
    medium: { w: 16, h: 16, m: 40 },
    hard:   { w: 30, h: 16, m: 99 },
  };

  DO.registerApp({
    id: "minesweeper",
    title: "Minesweeper",
    icon: ICONS.mines,
    defaultSize: { w: 560, h: 540 },
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("mines-body");

      let diff = "easy";
      let W, H, M, grid, flags, opened, dead, won, startT, timerIv;

      const hud = el("div", { class: "mines-hud" });
      const mineN = el("div", { class: "score" }, "010");
      const face = el("button", { style: { fontSize: "22px", background: "var(--bg-1)", border: "1px solid var(--stroke)", borderRadius: "4px", width: "36px", height: "36px" },
        onclick: () => reset() }, "🙂");
      const timeN = el("div", { class: "score" }, "000");
      hud.append(mineN, face, timeN);

      const diffBar = el("div", { class: "toolbar" },
        el("button", { onclick: () => { diff = "easy"; reset(); } }, "Easy"),
        el("button", { onclick: () => { diff = "medium"; reset(); } }, "Medium"),
        el("button", { onclick: () => { diff = "hard"; reset(); } }, "Hard"),
        el("span", { class: "spacer" }),
        el("span", { style: { color: "var(--text-dim)", fontSize: "12px" } }, "Left-click to reveal · Right-click to flag"),
      );

      const wrap = el("div", { class: "mines-grid-wrap" });
      const gridEl = el("div", { class: "mines-grid" });
      wrap.appendChild(gridEl);
      root.append(diffBar, hud, wrap);

      function reset() {
        const d = DIFFS[diff];
        W = d.w; H = d.h; M = d.m;
        grid = Array.from({ length: H }, () => Array(W).fill(0));
        flags = Array.from({ length: H }, () => Array(W).fill(false));
        opened = Array.from({ length: H }, () => Array(W).fill(false));
        dead = false; won = false; startT = 0;
        if (timerIv) { clearInterval(timerIv); timerIv = null; }
        timeN.textContent = "000";
        face.textContent = "🙂";
        placeMines();
        countNeighbors();
        render();
        updateMineCount();
      }

      function placeMines() {
        let placed = 0;
        while (placed < M) {
          const x = Math.floor(Math.random() * W);
          const y = Math.floor(Math.random() * H);
          if (grid[y][x] === -1) continue;
          grid[y][x] = -1;
          placed++;
        }
      }
      function countNeighbors() {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (grid[y][x] === -1) continue;
          let c = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x+dx, ny = y+dy;
            if (nx<0||ny<0||nx>=W||ny>=H) continue;
            if (grid[ny][nx] === -1) c++;
          }
          grid[y][x] = c;
        }
      }

      function startTimerIfNeeded() {
        if (startT) return;
        startT = Date.now();
        timerIv = setInterval(() => {
          const s = Math.min(999, Math.floor((Date.now()-startT)/1000));
          timeN.textContent = String(s).padStart(3, "0");
        }, 300);
      }

      function updateMineCount() {
        let fl = 0;
        for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (flags[y][x]) fl++;
        mineN.textContent = String(Math.max(0, M - fl)).padStart(3, "0");
      }

      function reveal(x, y) {
        if (dead || won || opened[y][x] || flags[y][x]) return;
        opened[y][x] = true;
        if (grid[y][x] === -1) { lose(x, y); return; }
        if (grid[y][x] === 0) {
          for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) {
            const nx=x+dx, ny=y+dy;
            if (nx<0||ny<0||nx>=W||ny>=H) continue;
            reveal(nx, ny);
          }
        }
      }

      function lose(x, y) {
        dead = true;
        face.textContent = "😵";
        for (let yy=0;yy<H;yy++) for (let xx=0;xx<W;xx++) if (grid[yy][xx] === -1) opened[yy][xx] = true;
        if (timerIv) clearInterval(timerIv);
      }
      function checkWin() {
        for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
          if (grid[y][x] !== -1 && !opened[y][x]) return;
        }
        won = true;
        face.textContent = "😎";
        if (timerIv) clearInterval(timerIv);
        DO.toast("Minesweeper", "You win! Time: " + timeN.textContent + "s");
      }

      function render() {
        gridEl.style.gridTemplateColumns = `repeat(${W}, 28px)`;
        gridEl.style.gridTemplateRows = `repeat(${H}, 28px)`;
        gridEl.innerHTML = "";
        for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
          const c = el("div", { class: "mines-cell" });
          if (!opened[y][x]) {
            c.classList.add("covered");
            if (flags[y][x]) c.classList.add("flag");
          } else {
            if (grid[y][x] === -1) { c.classList.add("mine"); c.textContent = "💣"; }
            else if (grid[y][x] > 0) { c.dataset.n = String(grid[y][x]); c.textContent = grid[y][x]; }
          }
          c.addEventListener("click", () => {
            if (dead || won || flags[y][x]) return;
            startTimerIfNeeded();
            reveal(x, y);
            render();
            if (!dead) checkWin();
          });
          c.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            if (dead || won || opened[y][x]) return;
            flags[y][x] = !flags[y][x];
            updateMineCount();
            render();
          });
          gridEl.appendChild(c);
        }
      }

      reset();
      win.onClose = () => { if (timerIv) clearInterval(timerIv); };
    }
  });
})();
