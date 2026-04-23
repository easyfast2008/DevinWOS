/* Solitaire — Klondike, draw-one */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  const SUITS = ["♠","♥","♦","♣"];
  const REDS = new Set(["♥","♦"]);
  const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ s, r, up: false, id: s + r });
    // shuffle
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  DO.registerApp({
    id: "solitaire",
    title: "Solitaire",
    icon: ICONS.solitaire,
    defaultSize: { w: 820, h: 620 },
    mount(win) {
      const root = win.bodyRoot;
      root.style.background = "#144f2b";

      let stock = [], waste = [], tableau = [[],[],[],[],[],[],[]], foundations = [[],[],[],[]];
      let score = 0, moves = 0, startT = Date.now(), timerEl, scoreEl, movesEl;

      const hud = el("div", { class: "sol-hud" });
      const newBtn = el("button", { onclick: () => newGame() }, "New Game");
      const undoBtn = el("button", { onclick: () => undo() }, "Undo");
      scoreEl = el("span", {}, "Score: 0");
      movesEl = el("span", {}, "Moves: 0");
      timerEl = el("span", {}, "Time: 0:00");
      hud.append(newBtn, undoBtn, scoreEl, movesEl, timerEl);

      const body = el("div", { class: "sol-body" });
      const top = el("div", { class: "sol-top" });
      const tab = el("div", { class: "sol-tableau" });
      body.append(top, tab);
      root.append(hud, body);

      const undoStack = [];

      function newGame() {
        const d = makeDeck();
        stock = d; waste = [];
        tableau = [[],[],[],[],[],[],[]];
        foundations = [[],[],[],[]];
        for (let i = 0; i < 7; i++) {
          for (let j = i; j < 7; j++) {
            const c = stock.pop();
            c.up = (i === j);
            tableau[j].push(c);
          }
        }
        score = 0; moves = 0; startT = Date.now();
        undoStack.length = 0;
        render();
      }

      function push() {
        undoStack.push(JSON.stringify({ stock, waste, tableau, foundations, score, moves }));
        if (undoStack.length > 50) undoStack.shift();
      }
      function undo() {
        if (!undoStack.length) return;
        const prev = JSON.parse(undoStack.pop());
        stock = prev.stock; waste = prev.waste; tableau = prev.tableau; foundations = prev.foundations;
        score = prev.score; moves = prev.moves;
        render();
      }

      function drawStock() {
        push();
        if (stock.length) {
          const c = stock.pop();
          c.up = true;
          waste.push(c);
        } else {
          while (waste.length) { const c = waste.pop(); c.up = false; stock.push(c); }
          score = Math.max(0, score - 20);
        }
        moves++;
        render();
      }

      function canStack(onto, card) {
        if (!onto) return card.r === 13; // only K on empty tableau
        if (!onto.up) return false;
        return (REDS.has(onto.s) !== REDS.has(card.s)) && (onto.r === card.r + 1);
      }
      function canFound(pile, card) {
        if (!pile.length) return card.r === 1;
        const top = pile[pile.length-1];
        return top.s === card.s && top.r === card.r - 1;
      }

      function autoMove(card, src, idx) {
        // try foundation first
        for (let i = 0; i < 4; i++) {
          if (canFound(foundations[i], card) && idx === (src?.length - 1)) {
            push();
            foundations[i].push(src.pop());
            score += 10;
            moves++;
            flipAfterRemove(src);
            render(); checkWin(); return true;
          }
        }
        // try tableau
        for (let j = 0; j < 7; j++) {
          const top = tableau[j][tableau[j].length - 1];
          if (canStack(top, card)) {
            push();
            const moved = src.splice(idx);
            tableau[j].push(...moved);
            score += 5;
            moves++;
            flipAfterRemove(src);
            render(); return true;
          }
        }
        return false;
      }
      function flipAfterRemove(pile) {
        if (pile && pile.length && !pile[pile.length-1].up) {
          pile[pile.length-1].up = true;
          score += 5;
        }
      }

      function checkWin() {
        if (foundations.every(p => p.length === 13)) {
          DO.toast("Solitaire", "You win!");
        }
      }

      function render() {
        scoreEl.textContent = "Score: " + score;
        movesEl.textContent = "Moves: " + moves;
        const t = Math.floor((Date.now() - startT) / 1000);
        timerEl.textContent = `Time: ${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`;

        top.innerHTML = "";
        // Stock
        const stockSlot = el("div", { class: "sol-slot", onclick: drawStock });
        if (stock.length) {
          const c = el("div", { class: "sol-card back" });
          c.textContent = stock.length;
          stockSlot.appendChild(c);
        } else {
          stockSlot.textContent = "↻";
        }
        top.appendChild(stockSlot);

        // Waste
        const wasteSlot = el("div", { class: "sol-slot" });
        if (waste.length) {
          const c = waste[waste.length - 1];
          wasteSlot.appendChild(cardEl(c, () => autoMove(c, waste, waste.length - 1)));
        }
        top.appendChild(wasteSlot);

        // Spacer
        top.appendChild(el("div", { style: { width: "40px" } }));

        // Foundations
        foundations.forEach((f, i) => {
          const slot = el("div", { class: "sol-slot" });
          slot.textContent = SUITS[i];
          if (f.length) {
            const c = f[f.length - 1];
            slot.appendChild(cardEl(c, () => autoMove(c, f, f.length - 1)));
          }
          slot.addEventListener("dragover", e => { e.preventDefault(); });
          slot.addEventListener("drop", e => {
            e.preventDefault();
            const d = JSON.parse(e.dataTransfer.getData("text/plain"));
            handleDrop(d, { type: "f", i });
          });
          top.appendChild(slot);
        });

        // Tableau
        tab.innerHTML = "";
        tableau.forEach((col, ci) => {
          const colEl = el("div", { class: "sol-col" });
          if (col.length === 0) {
            const slot = el("div", { class: "sol-slot", style: { position: "absolute", top: 0, left: 0 } });
            slot.addEventListener("dragover", e => { e.preventDefault(); });
            slot.addEventListener("drop", e => {
              e.preventDefault();
              const d = JSON.parse(e.dataTransfer.getData("text/plain"));
              handleDrop(d, { type: "t", i: ci });
            });
            colEl.appendChild(slot);
          }
          col.forEach((c, i) => {
            const ce = cardEl(c, () => autoMove(c, col, i));
            ce.style.top = (i * 24) + "px";
            ce.draggable = c.up;
            ce.addEventListener("dragstart", (e) => {
              e.dataTransfer.setData("text/plain", JSON.stringify({ type: "t", col: ci, idx: i }));
              ce.classList.add("dragging");
            });
            ce.addEventListener("dragend", () => ce.classList.remove("dragging"));
            ce.addEventListener("dragover", e => { if (c.up) e.preventDefault(); });
            ce.addEventListener("drop", e => {
              e.preventDefault();
              const d = JSON.parse(e.dataTransfer.getData("text/plain"));
              handleDrop(d, { type: "t", i: ci });
            });
            colEl.appendChild(ce);
          });
          tab.appendChild(colEl);
        });
      }

      function handleDrop(from, to) {
        let srcPile, srcIdx, srcCards;
        if (from.type === "t") { srcPile = tableau[from.col]; srcIdx = from.idx; srcCards = srcPile.slice(srcIdx); }
        else if (from.type === "w") { srcPile = waste; srcIdx = waste.length - 1; srcCards = [waste[waste.length-1]]; }
        else return;
        const topMoving = srcCards[0];
        if (to.type === "t") {
          const destTop = tableau[to.i][tableau[to.i].length - 1];
          if (canStack(destTop, topMoving)) {
            push();
            const moved = srcPile.splice(srcIdx);
            tableau[to.i].push(...moved);
            score += 5; moves++;
            flipAfterRemove(srcPile); render();
          }
        } else if (to.type === "f") {
          if (srcCards.length === 1 && canFound(foundations[to.i], topMoving)) {
            push();
            foundations[to.i].push(srcPile.pop());
            score += 10; moves++;
            flipAfterRemove(srcPile); render(); checkWin();
          }
        }
      }

      function cardEl(c, onDbl) {
        const d = el("div", { class: "sol-card" + (c.up ? (REDS.has(c.s) ? " red" : "") : " back") });
        if (c.up) {
          d.innerHTML = `<div class="sc-top"><span>${RANKS[c.r-1]}</span><span>${c.s}</span></div><div class="sc-mid">${c.s}</div><div class="sc-bot"><span>${RANKS[c.r-1]}</span><span>${c.s}</span></div>`;
        }
        if (onDbl) d.addEventListener("dblclick", onDbl);
        return d;
      }

      let timerIv = setInterval(() => {
        const t = Math.floor((Date.now() - startT) / 1000);
        timerEl.textContent = `Time: ${Math.floor(t/60)}:${String(t%60).padStart(2,"0")}`;
      }, 1000);
      win.onClose = () => clearInterval(timerIv);

      newGame();
    }
  });
})();
