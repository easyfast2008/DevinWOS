/* Grand Theft Web — top-down open-city sandbox.
 * Fully functional: drive cars, steal cars, pedestrians, cops, wanted level,
 * shooting, pickups, mission markers, HUD, minimap, and Chronoshift rewind.
 */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  const WORLD_W = 2400, WORLD_H = 2400;
  const BLOCK = 300;    // city block size
  const ROAD = 90;      // road width
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  DO.registerApp({
    id: "gta",
    title: "Grand Theft Web",
    icon: ICONS.gta,
    defaultSize: { w: 980, h: 620 },
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("gta-body");

      const canvas = el("canvas", { class: "gta-canvas" });
      const ctx = canvas.getContext("2d");
      const mini = el("canvas");
      const miniWrap = el("div", { class: "gta-mini" }, mini);
      const hud = el("div", { class: "gta-hud" },
        el("div", { class: "box hp", id: "hp" }, "HP 100"),
        el("div", { class: "box $", id: "mn" }, "$0"),
        el("div", { class: "box stars", id: "st" }, "☆☆☆☆☆"),
        el("div", { class: "box veh", id: "vh" }, "ON FOOT"),
        el("div", { class: "box amm", id: "am" }, "FIST"),
      );
      const msg = el("div", { class: "gta-msg" });
      const help = el("div", { class: "gta-help" },
        "Move ", el("kbd",{},"WASD"), " · Enter/Exit ", el("kbd",{},"E"),
        " · Shoot ", el("kbd",{},"F"), " / ", el("kbd",{},"LMB"),
        " · Brake ", el("kbd",{},"Space"), " · Aim ", el("kbd",{},"Mouse"),
        " · Rewind ", el("kbd",{},"Ctrl+Alt+R"),
      );
      const overlay = el("div", { class: "gta-over", style: { display: "none" } });
      root.append(canvas, miniWrap, hud, msg, help, overlay);

      let W = 0, H = 0;
      let running = true;

      function fit() {
        const r = root.getBoundingClientRect();
        W = Math.max(400, Math.floor(r.width));
        H = Math.max(300, Math.floor(r.height));
        canvas.width = W; canvas.height = H;
        mini.width = 180; mini.height = 180;
      }
      win.onResize = fit;
      fit();

      // ---------- world ----------
      // Roads: horizontal & vertical strips at BLOCK intervals
      // Everything not on a road is a "block" that we fill with buildings.
      function isRoad(x, y) {
        const mx = x % BLOCK, my = y % BLOCK;
        return mx < ROAD || my < ROAD;
      }

      // Generate buildings per block
      const buildings = [];
      const palettes = ["#6a6d78","#7a6f5e","#534c69","#4e6a58","#8a6b5a","#4b5670","#6d574e","#555a68"];
      for (let by = 0; by < WORLD_H / BLOCK; by++) {
        for (let bx = 0; bx < WORLD_W / BLOCK; bx++) {
          const x0 = bx * BLOCK + ROAD + 10;
          const y0 = by * BLOCK + ROAD + 10;
          const x1 = (bx + 1) * BLOCK - 10;
          const y1 = (by + 1) * BLOCK - 10;
          // subdivide the block into 2x2 lots randomly
          let rows = Math.random() < 0.5 ? 1 : 2;
          let cols = Math.random() < 0.5 ? 1 : 2;
          const rh = (y1 - y0) / rows, cw = (x1 - x0) / cols;
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const pad = 6 + Math.random() * 14;
            const bX = x0 + c * cw + pad;
            const bY = y0 + r * rh + pad;
            const bW = cw - pad * 2;
            const bH = rh - pad * 2;
            buildings.push({ x: bX, y: bY, w: bW, h: bH, color: palettes[Math.floor(Math.random()*palettes.length)] });
          }
        }
      }

      // ---------- entities ----------
      const carColors = ["#e4453d","#f0c419","#2aa8ef","#16a34a","#a855f7","#1f2937","#e85aad","#f97316","#0ea5e9"];

      function randRoadPos() {
        for (let i = 0; i < 60; i++) {
          const x = Math.random() * WORLD_W;
          const y = Math.random() * WORLD_H;
          if (isRoad(x, y)) return { x, y };
        }
        return { x: ROAD/2, y: ROAD/2 };
      }
      function randSidewalkPos() {
        for (let i = 0; i < 60; i++) {
          const x = Math.random() * WORLD_W;
          const y = Math.random() * WORLD_H;
          if (isRoad(x, y)) {
            // nudge to edge of road
            return { x, y };
          }
        }
        return randRoadPos();
      }

      const player = {
        x: WORLD_W / 2, y: WORLD_H / 2,
        angle: 0,
        speed: 0,
        hp: 100, maxHp: 100,
        money: 0,
        weapon: "fist",
        ammo: 0,
        fireCd: 0,
        car: null,
      };
      let wanted = 0;
      let wantedDecayT = 0;

      const vehicles = [];
      for (let i = 0; i < 24; i++) {
        const p = randRoadPos();
        vehicles.push({
          x: p.x, y: p.y, angle: Math.random()*TAU,
          speed: 0, maxSpeed: 4 + Math.random()*2.5,
          w: 40, h: 22,
          color: carColors[Math.floor(Math.random()*carColors.length)],
          hp: 100,
          driver: null, // "player" or peds reference
          isCop: false,
        });
      }

      const peds = [];
      for (let i = 0; i < 70; i++) {
        const p = randRoadPos();
        peds.push({
          x: p.x, y: p.y, angle: Math.random() * TAU,
          speed: 0.6 + Math.random() * 0.4,
          hp: 40,
          color: `hsl(${Math.floor(Math.random()*360)},60%,60%)`,
          panic: 0,
          alive: true,
        });
      }

      const cops = [];
      const bullets = [];
      const pickups = [];
      for (let i = 0; i < 30; i++) {
        const p = randRoadPos();
        pickups.push({ x: p.x, y: p.y, kind: Math.random() < 0.5 ? "cash" : "ammo" });
      }
      pickups.push({ x: player.x + 50, y: player.y + 50, kind: "pistol" });

      let mission = null;
      let msgT = null;
      function newMission() {
        const p = randRoadPos();
        mission = { x: p.x, y: p.y, type: "arrive", reward: 300 + Math.floor(Math.random() * 600) };
        showMsg(`NEW JOB: Reach the marker. Reward $${mission.reward}`);
      }
      newMission();

      // ---------- input ----------
      const keys = new Set();
      const onKey = (down) => (e) => {
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (down) keys.add(key); else keys.delete(key);
        // One-shot actions
        if (down) {
          if (key === "e") tryEnterExit();
          if (key === "f") tryShoot();
          if (key === "r") { if (player.hp <= 0) respawn(); }
        }
        if (["w","a","s","d","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"," "].includes(e.key) || e.key.length === 1) e.preventDefault();
      };
      const kd = onKey(true), ku = onKey(false);
      canvas.tabIndex = 0;
      canvas.addEventListener("keydown", kd);
      canvas.addEventListener("keyup", ku);
      root.addEventListener("click", () => canvas.focus());

      let mouseX = W/2, mouseY = H/2;
      canvas.addEventListener("mousemove", (e) => {
        const r = canvas.getBoundingClientRect();
        mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
      });
      canvas.addEventListener("mousedown", (e) => { if (e.button === 0) tryShoot(); });

      // ---------- actions ----------
      function tryEnterExit() {
        if (player.car) {
          // exit
          const c = player.car;
          player.x = c.x + Math.cos(c.angle + Math.PI/2) * 28;
          player.y = c.y + Math.sin(c.angle + Math.PI/2) * 28;
          player.angle = c.angle;
          c.driver = null;
          player.car = null;
          showMsg("Exited vehicle");
          return;
        }
        // enter nearest within 40
        let best = null, bd = 44;
        for (const v of vehicles) {
          const d = dist(player, v);
          if (d < bd) { bd = d; best = v; }
        }
        if (best) {
          if (best.driver && best.driver !== player && best.driver.alive !== false) {
            // Kick driver out: steal!
            best.driver.alive = true;
            best.driver.x = best.x + Math.cos(best.angle + Math.PI/2) * 28;
            best.driver.y = best.y + Math.sin(best.angle + Math.PI/2) * 28;
            best.driver.panic = 220;
            best.driver = null;
            raiseWanted(1);
            showMsg("Vehicle jacked! (+1 ★)");
          }
          player.car = best;
          best.driver = player;
        }
      }

      function tryShoot() {
        if (player.fireCd > 0) return;
        const px = player.car ? player.car.x : player.x;
        const py = player.car ? player.car.y : player.y;
        // direction: from world position to mouse-world
        const cam = getCamera();
        const wx = mouseX + cam.x, wy = mouseY + cam.y;
        let ang = Math.atan2(wy - py, wx - px);
        if (player.car) ang = player.car.angle; // drive-by in car direction

        if (player.weapon === "pistol" && player.ammo > 0) {
          bullets.push({ x: px, y: py, vx: Math.cos(ang)*10, vy: Math.sin(ang)*10, life: 60, owner: "player" });
          player.ammo--;
          player.fireCd = 14;
          DO.blip(220, 0.04, 0.03);
        } else {
          // punch: short range damage
          player.fireCd = 22;
          const range = 34;
          for (const p of peds) if (p.alive && dist(p, {x:px,y:py}) < range) { hitPed(p, 35); break; }
          DO.blip(140, 0.05, 0.03);
        }
      }

      function hitPed(p, dmg) {
        p.hp -= dmg;
        p.panic = Math.max(p.panic, 180);
        if (p.hp <= 0 && p.alive) {
          p.alive = false;
          raiseWanted(1);
          player.money += 10;
          showMsg("-1 civilian · +$10 · +1 ★");
        }
      }

      function raiseWanted(amount) {
        wanted = clamp(wanted + amount, 0, 5);
        wantedDecayT = 0;
      }

      function respawn() {
        player.hp = player.maxHp;
        player.car = null;
        wanted = 0;
        showMsg("Respawned at hospital");
        const p = randRoadPos();
        player.x = p.x; player.y = p.y; player.speed = 0;
      }

      // ---------- step ----------
      let tickCount = 0;
      function step() {
        tickCount++;

        // player movement (on foot)
        if (!player.car) {
          let vx = 0, vy = 0;
          if (keys.has("w") || keys.has("ArrowUp")) vy -= 1;
          if (keys.has("s") || keys.has("ArrowDown")) vy += 1;
          if (keys.has("a") || keys.has("ArrowLeft")) vx -= 1;
          if (keys.has("d") || keys.has("ArrowRight")) vx += 1;
          const speed = 2.6;
          if (vx || vy) {
            const L = Math.hypot(vx, vy) || 1;
            vx /= L; vy /= L;
            const nx = player.x + vx * speed, ny = player.y + vy * speed;
            if (!buildingBlocks(nx, ny, 8)) { player.x = nx; player.y = ny; }
            player.angle = Math.atan2(vy, vx);
          }
        } else {
          // driving
          const c = player.car;
          let accel = 0, steer = 0;
          if (keys.has("w") || keys.has("ArrowUp")) accel += 0.15;
          if (keys.has("s") || keys.has("ArrowDown")) accel -= 0.2;
          if (keys.has("a") || keys.has("ArrowLeft")) steer -= 1;
          if (keys.has("d") || keys.has("ArrowRight")) steer += 1;
          if (keys.has(" ")) c.speed *= 0.88;

          c.speed += accel;
          c.speed *= 0.99;
          c.speed = clamp(c.speed, -c.maxSpeed * 0.5, c.maxSpeed);
          c.angle += steer * 0.045 * Math.min(1, Math.abs(c.speed) / 2);

          const nx = c.x + Math.cos(c.angle) * c.speed;
          const ny = c.y + Math.sin(c.angle) * c.speed;
          if (buildingBlocks(nx, ny, 18)) {
            c.hp -= Math.abs(c.speed) * 2;
            c.speed *= -0.3;
          } else {
            c.x = nx; c.y = ny;
          }
          // run over peds
          for (const p of peds) {
            if (!p.alive) continue;
            if (dist(p, c) < 20 && Math.abs(c.speed) > 1.2) {
              p.hp = 0; p.alive = false;
              raiseWanted(1); player.money += 15;
              showMsg("Roadkill! +$15");
            }
          }
          player.x = c.x; player.y = c.y; player.angle = c.angle;
          player.fireCd = Math.max(0, player.fireCd - 1);
        }

        if (player.fireCd > 0) player.fireCd--;

        // pickups
        for (let i = pickups.length - 1; i >= 0; i--) {
          const p = pickups[i];
          if (dist(p, player) < 22) {
            if (p.kind === "cash") { player.money += 50 + Math.floor(Math.random()*60); showMsg(`+$${50}`); }
            if (p.kind === "ammo") { player.ammo += 30; showMsg("+30 ammo"); }
            if (p.kind === "pistol") { player.weapon = "pistol"; player.ammo = Math.max(player.ammo, 30); showMsg("Picked up pistol"); }
            pickups.splice(i, 1);
          }
        }

        // mission marker
        if (mission && dist(player, mission) < 34) {
          if (mission.type === "arrive") {
            if (player.car) {
              player.money += mission.reward;
              showMsg(`Mission complete! +$${mission.reward}`);
              newMission();
            } else {
              // need a vehicle
              showMsg("Mission needs you in a vehicle!");
            }
          }
        }

        // peds
        for (const p of peds) {
          if (!p.alive) continue;
          // panic flee from player if nearby with weapon or from cops
          if (p.panic > 0) {
            const dx = p.x - player.x, dy = p.y - player.y;
            const L = Math.hypot(dx, dy) || 1;
            p.angle = Math.atan2(dy, dx);
            const spd = 1.8;
            const nx = p.x + dx / L * spd, ny = p.y + dy / L * spd;
            if (!buildingBlocks(nx, ny, 6)) { p.x = nx; p.y = ny; } else { p.angle += 0.5; }
            p.panic--;
          } else {
            // wander
            if (Math.random() < 0.02) p.angle = Math.atan2(Math.sin(p.angle) + (Math.random()-0.5), Math.cos(p.angle) + (Math.random()-0.5));
            const nx = p.x + Math.cos(p.angle) * p.speed;
            const ny = p.y + Math.sin(p.angle) * p.speed;
            if (buildingBlocks(nx, ny, 6) || !isRoad(nx, ny)) p.angle += 0.6;
            else { p.x = nx; p.y = ny; }
          }
          // panic if player is shooting nearby
          if (player.weapon === "pistol" && player.fireCd > 10 && dist(p, player) < 180) p.panic = Math.max(p.panic, 180);
        }

        // spawn cops based on wanted level
        const desiredCops = wanted * 2;
        while (cops.length < desiredCops) {
          const sp = randRoadPos();
          cops.push({ x: sp.x, y: sp.y, angle: 0, speed: 0, hp: 80, color: "#1e3a8a", fireCd: 0, alive: true });
        }
        while (cops.length > desiredCops && cops.length > 0) cops.pop();

        for (const cop of cops) {
          if (!cop.alive) continue;
          const dx = player.x - cop.x, dy = player.y - cop.y;
          const d = Math.hypot(dx, dy) || 1;
          cop.angle = Math.atan2(dy, dx);
          const spd = 1.7;
          const nx = cop.x + dx / d * spd, ny = cop.y + dy / d * spd;
          if (!buildingBlocks(nx, ny, 8)) { cop.x = nx; cop.y = ny; }
          if (cop.fireCd > 0) cop.fireCd--;
          if (d < 240 && cop.fireCd === 0) {
            bullets.push({ x: cop.x, y: cop.y, vx: dx/d*8, vy: dy/d*8, life: 60, owner: "cop" });
            cop.fireCd = 50;
            DO.blip(200, 0.04, 0.02);
          }
          if (d < 18) {
            player.hp -= 0.3; // melee
          }
        }

        // bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.x += b.vx; b.y += b.vy; b.life--;
          if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H) {
            bullets.splice(i, 1); continue;
          }
          // hit buildings
          if (buildingBlocks(b.x, b.y, 1)) { bullets.splice(i, 1); continue; }
          // hit player
          if (b.owner === "cop" && dist(b, player) < 10) {
            player.hp -= 6; bullets.splice(i, 1); continue;
          }
          // hit peds / cops
          if (b.owner === "player") {
            let hit = false;
            for (const p of peds) {
              if (!p.alive) continue;
              if (dist(b, p) < 10) { hitPed(p, 50); hit = true; break; }
            }
            if (hit) { bullets.splice(i, 1); continue; }
            for (const c of cops) {
              if (!c.alive) continue;
              if (dist(b, c) < 12) {
                c.hp -= 50;
                if (c.hp <= 0) {
                  c.alive = false;
                  raiseWanted(2);
                  player.money += 30;
                  showMsg("Cop down. +$30 +2 ★");
                }
                hit = true; break;
              }
            }
            if (hit) bullets.splice(i, 1);
          }
        }

        // dead cops removed
        for (let i = cops.length - 1; i >= 0; i--) if (!cops[i].alive) cops.splice(i, 1);

        // wanted decay
        wantedDecayT++;
        if (wanted > 0 && wantedDecayT > 60 * 12) { wanted--; wantedDecayT = 0; if (wanted === 0) showMsg("Wanted level clear!"); }

        // player death
        if (player.hp <= 0) {
          overlay.style.display = "grid";
          overlay.innerHTML = `
            <div>
              <h1>WASTED</h1>
              <p style="opacity:.8">Rewind time or respawn</p>
              <button id="respawnBtn">Respawn ($100 fine)</button>
            </div>
          `;
          overlay.querySelector("#respawnBtn").onclick = () => { overlay.style.display = "none"; player.money = Math.max(0, player.money - 100); respawn(); };
        } else {
          overlay.style.display = "none";
        }
      }

      function buildingBlocks(x, y, r) {
        // approximate: if point lands outside road and inside a building rect
        if (x < 0 || y < 0 || x > WORLD_W || y > WORLD_H) return true;
        if (isRoad(x, y)) return false;
        for (const b of buildings) {
          if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
        }
        return false;
      }

      function getCamera() {
        const cx = clamp(player.x - W / 2, 0, WORLD_W - W);
        const cy = clamp(player.y - H / 2, 0, WORLD_H - H);
        return { x: cx, y: cy };
      }

      // ---------- render ----------
      function render() {
        const cam = getCamera();
        // ground
        ctx.fillStyle = "#262834"; // road color base
        ctx.fillRect(0, 0, W, H);
        // blocks: draw sidewalks & grass
        const startX = Math.floor(cam.x / BLOCK) * BLOCK;
        const startY = Math.floor(cam.y / BLOCK) * BLOCK;
        for (let x = startX; x < cam.x + W; x += BLOCK) {
          for (let y = startY; y < cam.y + H; y += BLOCK) {
            // grass square at interior
            ctx.fillStyle = "#324032";
            ctx.fillRect(x + ROAD - cam.x, y + ROAD - cam.y, BLOCK - ROAD, BLOCK - ROAD);
          }
        }
        // road markings
        ctx.strokeStyle = "#ffdf6a"; ctx.lineWidth = 2;
        ctx.setLineDash([12, 16]);
        for (let y = startY; y < cam.y + H + BLOCK; y += BLOCK) {
          ctx.beginPath();
          ctx.moveTo(0, y + ROAD / 2 - cam.y);
          ctx.lineTo(W, y + ROAD / 2 - cam.y);
          ctx.stroke();
        }
        for (let x = startX; x < cam.x + W + BLOCK; x += BLOCK) {
          ctx.beginPath();
          ctx.moveTo(x + ROAD / 2 - cam.x, 0);
          ctx.lineTo(x + ROAD / 2 - cam.x, H);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // buildings
        for (const b of buildings) {
          if (b.x + b.w < cam.x || b.x > cam.x + W || b.y + b.h < cam.y || b.y > cam.y + H) continue;
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(b.x - cam.x + 3, b.y - cam.y + 3, b.w - 6, 3);
          // window dots
          ctx.fillStyle = "rgba(255,255,180,0.2)";
          for (let wy = 10; wy < b.h - 10; wy += 20) {
            for (let wx = 10; wx < b.w - 10; wx += 24) {
              if (((wx+wy)|0) % 2 === 0) ctx.fillRect(b.x - cam.x + wx, b.y - cam.y + wy, 8, 6);
            }
          }
        }

        // pickups
        for (const p of pickups) {
          const sx = p.x - cam.x, sy = p.y - cam.y;
          if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(tickCount * 0.04);
          if (p.kind === "cash") { ctx.fillStyle = "#5aff88"; ctx.fillRect(-8, -4, 16, 8); ctx.fillStyle = "#fff"; ctx.font = "9px monospace"; ctx.fillText("$", -3, 3); }
          if (p.kind === "ammo") { ctx.fillStyle = "#facc15"; ctx.fillRect(-8, -6, 16, 12); }
          if (p.kind === "pistol") { ctx.fillStyle = "#bbb"; ctx.fillRect(-8, -4, 16, 6); ctx.fillRect(0, 0, 4, 8); }
          ctx.restore();
        }

        // mission marker
        if (mission) {
          const sx = mission.x - cam.x, sy = mission.y - cam.y;
          ctx.save();
          ctx.strokeStyle = "#ffcb2e";
          ctx.fillStyle = "rgba(255,203,46,0.2)";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, 20 + Math.sin(tickCount*0.1)*4, 0, TAU);
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }

        // vehicles
        for (const v of vehicles) {
          const sx = v.x - cam.x, sy = v.y - cam.y;
          if (sx < -50 || sy < -50 || sx > W + 50 || sy > H + 50) continue;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(v.angle);
          ctx.fillStyle = v.color;
          ctx.fillRect(-v.w/2, -v.h/2, v.w, v.h);
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.fillRect(-4, -v.h/2, 16, v.h);
          // headlights
          ctx.fillStyle = "#fff7a8";
          ctx.fillRect(v.w/2-2, -v.h/2+2, 2, 3);
          ctx.fillRect(v.w/2-2, v.h/2-5, 2, 3);
          ctx.restore();
        }

        // peds
        for (const p of peds) {
          const sx = p.x - cam.x, sy = p.y - cam.y;
          if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
          if (!p.alive) {
            ctx.fillStyle = "rgba(120,0,0,0.7)";
            ctx.beginPath(); ctx.ellipse(sx, sy, 8, 5, 0, 0, TAU); ctx.fill();
            continue;
          }
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
          ctx.fillStyle = "#000"; ctx.fillRect(4, -1, 4, 2);
          ctx.restore();
        }

        // cops
        for (const c of cops) {
          const sx = c.x - cam.x, sy = c.y - cam.y;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(c.angle);
          ctx.fillStyle = c.color;
          ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillRect(-4, -7, 8, 2); // cap
          ctx.fillStyle = "#ff5a5a";
          ctx.fillRect(4, -1, 5, 2); // gun
          ctx.restore();
          // flasher
          if (tickCount % 20 < 10) ctx.fillStyle = "rgba(0,120,255,0.8)"; else ctx.fillStyle = "rgba(255,0,0,0.8)";
          ctx.beginPath(); ctx.arc(sx, sy - 10, 3, 0, TAU); ctx.fill();
        }

        // player
        {
          const sx = player.x - cam.x, sy = player.y - cam.y;
          if (!player.car) {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(player.angle);
            ctx.fillStyle = "#9ee6ff";
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
            ctx.fillStyle = "#000"; ctx.fillRect(5, -1.5, 4, 3);
            if (player.weapon === "pistol") { ctx.fillStyle = "#222"; ctx.fillRect(6, -1, 6, 2); }
            ctx.restore();
          }
        }

        // bullets
        for (const b of bullets) {
          const sx = b.x - cam.x, sy = b.y - cam.y;
          ctx.fillStyle = b.owner === "cop" ? "#ffb2b2" : "#ffe36e";
          ctx.fillRect(sx-1, sy-1, 3, 3);
        }

        // crosshair
        ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mouseX - 6, mouseY); ctx.lineTo(mouseX + 6, mouseY);
        ctx.moveTo(mouseX, mouseY - 6); ctx.lineTo(mouseX, mouseY + 6);
        ctx.stroke();

        // minimap
        renderMinimap();
        // hud
        renderHUD();
      }

      function renderMinimap() {
        const m = mini.getContext("2d");
        m.fillStyle = "#1a1a1a";
        m.fillRect(0, 0, 180, 180);
        // roads
        m.fillStyle = "#444";
        const sx = player.x, sy = player.y;
        for (let y = 0; y < WORLD_H; y += BLOCK) {
          const py = ((y - sy + 90) / 4) + 90;
          if (py > -2 && py < 180) m.fillRect(0, py - 2, 180, 4);
        }
        for (let x = 0; x < WORLD_W; x += BLOCK) {
          const px = ((x - sx + 90) / 4) + 90;
          if (px > -2 && px < 180) m.fillRect(px - 2, 0, 4, 180);
        }
        // mission
        if (mission) {
          const mx = ((mission.x - sx) / 4) + 90, my = ((mission.y - sy) / 4) + 90;
          m.fillStyle = "#ffcb2e";
          if (mx > -10 && mx < 190 && my > -10 && my < 190) m.fillRect(mx-3, my-3, 6, 6);
          else {
            // edge arrow
            const ang = Math.atan2(mission.y - sy, mission.x - sx);
            const ex = clamp(90 + Math.cos(ang) * 80, 8, 172);
            const ey = clamp(90 + Math.sin(ang) * 80, 8, 172);
            m.fillStyle = "#ffcb2e";
            m.beginPath(); m.arc(ex, ey, 3, 0, TAU); m.fill();
          }
        }
        for (const p of peds) if (p.alive) {
          const dx = (p.x - sx) / 4 + 90, dy = (p.y - sy) / 4 + 90;
          if (dx < 2 || dy < 2 || dx > 178 || dy > 178) continue;
          m.fillStyle = "#9cc"; m.fillRect(dx, dy, 2, 2);
        }
        for (const c of cops) {
          const dx = (c.x - sx) / 4 + 90, dy = (c.y - sy) / 4 + 90;
          if (dx < 2 || dy < 2 || dx > 178 || dy > 178) continue;
          m.fillStyle = "#ff5a5a"; m.fillRect(dx-1, dy-1, 4, 4);
        }
        for (const v of vehicles) {
          const dx = (v.x - sx) / 4 + 90, dy = (v.y - sy) / 4 + 90;
          if (dx < 2 || dy < 2 || dx > 178 || dy > 178) continue;
          m.fillStyle = v.color; m.fillRect(dx, dy, 2, 2);
        }
        // player
        m.fillStyle = "#9ee6ff";
        m.beginPath(); m.arc(90, 90, 3, 0, TAU); m.fill();
        // border
        m.strokeStyle = "#fff"; m.lineWidth = 2;
        m.beginPath(); m.arc(90, 90, 88, 0, TAU); m.stroke();
      }

      function renderHUD() {
        document.getElementById("hp") && (document.getElementById("hp").textContent = "HP " + Math.max(0, Math.floor(player.hp)));
        document.getElementById("mn") && (document.getElementById("mn").textContent = "$" + player.money);
        document.getElementById("st") && (document.getElementById("st").textContent = "★".repeat(wanted) + "☆".repeat(5-wanted));
        document.getElementById("vh") && (document.getElementById("vh").textContent = player.car ? `SPEED ${(player.car.speed * 20 | 0)}` : "ON FOOT");
        document.getElementById("am") && (document.getElementById("am").textContent = player.weapon.toUpperCase() + (player.weapon === "pistol" ? " " + player.ammo : ""));
      }

      function showMsg(text) {
        msg.textContent = text;
        msg.classList.add("show");
        if (msgT) clearTimeout(msgT);
        msgT = setTimeout(() => msg.classList.remove("show"), 2200);
      }

      // ---------- loop ----------
      let frame = 0;
      function loop() {
        if (!running) return;
        frame++;
        step();
        render();
        requestAnimationFrame(loop);
      }

      // ---------- rewind ----------
      win.rewind = {
        snapshot: () => ({
          px: player.x, py: player.y, pa: player.angle, phP: player.hp, pM: player.money, pW: player.weapon, pA: player.ammo,
          inCar: !!player.car, carIdx: player.car ? vehicles.indexOf(player.car) : -1,
          wanted,
          vehicles: vehicles.map(v => ({ x: v.x, y: v.y, a: v.angle, s: v.speed, hp: v.hp, driver: v.driver === player ? "p" : null })),
          peds: peds.map(p => ({ x: p.x, y: p.y, a: p.angle, hp: p.hp, alive: p.alive, panic: p.panic })),
          cops: cops.map(c => ({ x: c.x, y: c.y, a: c.angle, hp: c.hp, alive: c.alive })),
          pickups: pickups.map(p => ({ x: p.x, y: p.y, kind: p.kind })),
        }),
        restore: (st) => {
          player.x = st.px; player.y = st.py; player.angle = st.pa;
          player.hp = st.phP; player.money = st.pM; player.weapon = st.pW; player.ammo = st.pA;
          wanted = st.wanted;
          player.car = st.inCar && vehicles[st.carIdx] ? vehicles[st.carIdx] : null;
          st.vehicles.forEach((d, i) => { if (vehicles[i]) { Object.assign(vehicles[i], { x: d.x, y: d.y, angle: d.a, speed: d.s, hp: d.hp }); } });
          st.peds.forEach((d, i) => { if (peds[i]) Object.assign(peds[i], { x: d.x, y: d.y, angle: d.a, hp: d.hp, alive: d.alive, panic: d.panic }); });
          // cops: resize
          cops.length = st.cops.length;
          st.cops.forEach((d, i) => { cops[i] = Object.assign(cops[i] || { color: "#1e3a8a", fireCd: 0, speed: 0 }, { x: d.x, y: d.y, angle: d.a, hp: d.hp, alive: d.alive }); });
          // pickups
          pickups.length = 0;
          st.pickups.forEach(p => pickups.push({ ...p }));
        },
      };

      win.onClose = () => { running = false; };

      showMsg("Welcome to Grand Theft Web! Find a car (E) and reach the yellow marker.");
      loop();
    }
  });
})();
