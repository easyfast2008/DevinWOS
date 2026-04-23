/* Snake — classic grid snake with growing tail, wrap-around option,
 * persistent high score, and keyboard control.
 */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "snake",
    title: "Snake",
    icon: ICONS.snake || `<svg viewBox="0 0 32 32"><rect x="3" y="5" width="26" height="22" rx="3" fill="#0b3b1a"/><g fill="#6aff9f"><rect x="7" y="9" width="4" height="4"/><rect x="11" y="9" width="4" height="4"/><rect x="15" y="9" width="4" height="4"/><rect x="15" y="13" width="4" height="4"/><rect x="15" y="17" width="4" height="4"/><rect x="19" y="17" width="4" height="4"/></g><rect x="23" y="9" width="4" height="4" fill="#ff5a5a"/></svg>`,
    defaultSize: { w: 560, h: 600 },
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("snake-body");

      const COLS = 24, ROWS = 20, SIZE = 22;

      const hud = el("div", { class: "snake-hud" });
      const scoreEl = el("div", { class: "score" }, "Score: 0");
      const bestEl = el("div", { class: "score best" }, "Best: " + (DO.Store.get("snake.best", 0)));
      const speedSel = el("select", {
        onchange: e => { tickMs = +e.target.value; restartLoop(); }
      },
        el("option", { value: 140 }, "Chill"),
        el("option", { value: 90, selected: true }, "Classic"),
        el("option", { value: 55 }, "Fast"),
        el("option", { value: 35 }, "Insane"),
      );
      const wrapCb = el("label", { class: "snake-toggle" },
        el("input", { type: "checkbox", checked: true,
          onchange: e => { wrap = e.target.checked; } }),
        " Wrap edges",
      );
      const newBtn = el("button", { class: "primary", onclick: () => reset() }, "New Game");
      hud.append(scoreEl, bestEl, speedSel, wrapCb, newBtn);

      const canvas = el("canvas", { class: "snake-canvas" });
      canvas.width = COLS * SIZE; canvas.height = ROWS * SIZE;
      const ctx = canvas.getContext("2d");

      const help = el("div", { class: "snake-help" },
        "Arrows/WASD to steer · Space to pause · R to restart"
      );

      root.append(hud, canvas, help);

      let snake, dir, pendDir, food, score, over, paused, tickMs = 90, loopId = null, wrap = true;

      function reset() {
        snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
        dir = { x: 1, y: 0 }; pendDir = dir;
        spawnFood();
        score = 0; over = false; paused = false;
        scoreEl.textContent = "Score: 0";
        restartLoop();
        draw();
      }

      function restartLoop() {
        if (loopId) clearInterval(loopId);
        loopId = setInterval(step, tickMs);
      }

      function spawnFood() {
        for (let i = 0; i < 200; i++) {
          const x = Math.floor(Math.random() * COLS);
          const y = Math.floor(Math.random() * ROWS);
          if (!snake.some(s => s.x === x && s.y === y)) { food = { x, y }; return; }
        }
      }

      function step() {
        if (paused || over) return;
        // commit dir
        if ((pendDir.x !== -dir.x || pendDir.y !== -dir.y)) dir = pendDir;
        let nx = snake[0].x + dir.x;
        let ny = snake[0].y + dir.y;
        if (wrap) {
          nx = (nx + COLS) % COLS; ny = (ny + ROWS) % ROWS;
        } else if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
          return gameOver();
        }
        if (snake.some(s => s.x === nx && s.y === ny)) return gameOver();
        snake.unshift({ x: nx, y: ny });
        if (nx === food.x && ny === food.y) {
          score++;
          scoreEl.textContent = "Score: " + score;
          DO.blip(660 + score * 12, 0.06, 0.04);
          spawnFood();
        } else {
          snake.pop();
        }
        draw();
      }

      function gameOver() {
        over = true; clearInterval(loopId); loopId = null;
        const best = DO.Store.get("snake.best", 0);
        if (score > best) {
          DO.Store.set("snake.best", score);
          bestEl.textContent = "Best: " + score;
          DO.toast("Snake", "New high score: " + score + "!");
        } else {
          DO.toast("Snake", "Game over — score " + score);
        }
        DO.blip(140, 0.3, 0.05);
        draw();
      }

      function draw() {
        // background
        ctx.fillStyle = "#0b1725";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // grid
        ctx.strokeStyle = "rgba(255,255,255,0.03)";
        for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i*SIZE, 0); ctx.lineTo(i*SIZE, canvas.height); ctx.stroke(); }
        for (let i = 0; i <= ROWS; i++) { ctx.beginPath(); ctx.moveTo(0, i*SIZE); ctx.lineTo(canvas.width, i*SIZE); ctx.stroke(); }
        // food
        ctx.fillStyle = "#ff5a5a";
        drawRounded(food.x * SIZE + 3, food.y * SIZE + 3, SIZE - 6, SIZE - 6, 6);
        ctx.fill();
        // snake
        snake.forEach((s, i) => {
          const t = 1 - i / Math.max(snake.length, 1);
          ctx.fillStyle = i === 0 ? "#6aff9f" : `hsl(${140 + t*40}, 70%, ${35 + t*20}%)`;
          drawRounded(s.x * SIZE + 2, s.y * SIZE + 2, SIZE - 4, SIZE - 4, 5);
          ctx.fill();
        });
        // head eye
        const head = snake[0];
        ctx.fillStyle = "#071";
        ctx.fillRect(head.x*SIZE + SIZE/2 + dir.x*4 - 2, head.y*SIZE + SIZE/2 + dir.y*4 - 2, 4, 4);
        // overlay text
        if (over) {
          ctx.fillStyle = "rgba(0,0,0,0.5)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 32px Segoe UI, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Game Over", canvas.width/2, canvas.height/2 - 10);
          ctx.font = "16px Segoe UI, system-ui, sans-serif";
          ctx.fillText("Press R to restart", canvas.width/2, canvas.height/2 + 24);
        }
        if (paused && !over) {
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 32px Segoe UI, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Paused", canvas.width/2, canvas.height/2);
        }
      }

      function drawRounded(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      function onKey(e) {
        const k = e.key.toLowerCase();
        if (k === "arrowup" || k === "w")    pendDir = { x: 0, y: -1 };
        else if (k === "arrowdown" || k === "s")  pendDir = { x: 0, y: 1 };
        else if (k === "arrowleft" || k === "a")  pendDir = { x: -1, y: 0 };
        else if (k === "arrowright" || k === "d") pendDir = { x: 1, y: 0 };
        else if (k === " ") { paused = !paused; draw(); }
        else if (k === "r") reset();
        else return;
        e.preventDefault();
      }
      canvas.tabIndex = 0;
      canvas.addEventListener("keydown", onKey);
      root.addEventListener("click", () => canvas.focus());

      win.onClose = () => { if (loopId) clearInterval(loopId); };

      reset();
      setTimeout(() => canvas.focus(), 50);
    }
  });
})();
