/* Clock — world clock, timer, stopwatch, alarm */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS, fmt } = DO;

  DO.registerApp({
    id: "clock",
    title: "Clock",
    icon: ICONS.clock,
    defaultSize: { w: 520, h: 440 },
    single: true,
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("clock-body");

      let tab = "world";
      const tabs = el("div", { class: "clock-tabs" });
      const section = el("div", { class: "clock-section" });

      ["world","timer","stopwatch","alarm"].forEach(id => {
        tabs.appendChild(el("button", {
          class: id === tab ? "active" : "",
          onclick: () => { tab = id; render(); }
        }, id.charAt(0).toUpperCase() + id.slice(1)));
      });

      root.append(tabs, section);

      // Timer state
      let timerEnd = 0;
      let timerMs = 300000;
      let timerTicker = null;
      // Stopwatch state
      let swStart = 0;
      let swPaused = true;
      let swElapsed = 0;
      let swLaps = [];
      let swTicker = null;
      // Alarms
      const alarms = DO.Store.get("alarms", []);
      let alarmTicker = null;

      function render() {
        tabs.querySelectorAll("button").forEach((b, i) => {
          b.classList.toggle("active", b.textContent.toLowerCase().startsWith(tab));
        });
        section.innerHTML = "";
        if (tab === "world") renderWorld();
        if (tab === "timer") renderTimer();
        if (tab === "stopwatch") renderStopwatch();
        if (tab === "alarm") renderAlarm();
      }

      function renderWorld() {
        const wrap = el("div");
        const face = el("div", { class: "clock-face" });
        const sub = el("div", { class: "clock-sub" });
        wrap.append(face, sub);
        section.appendChild(wrap);
        function tick() {
          const d = new Date();
          face.textContent = `${fmt((d.getHours()%12)||12)}:${fmt(d.getMinutes())}:${fmt(d.getSeconds())} ${d.getHours()<12?"AM":"PM"}`;
          sub.innerHTML = d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) +
            "<br/>Other: London " +
            new Date(d.toLocaleString("en-US", {timeZone: "Europe/London"})).toLocaleTimeString() + " · Tokyo " +
            new Date(d.toLocaleString("en-US", {timeZone: "Asia/Tokyo"})).toLocaleTimeString();
        }
        tick();
        if (worldTicker) clearInterval(worldTicker);
        worldTicker = setInterval(tick, 1000);
      }

      let worldTicker = null;

      function fmtDur(ms) {
        const s = Math.max(0, Math.floor(ms/1000));
        const m = Math.floor(s/60), se = s%60;
        const h = Math.floor(m/60), mi = m%60;
        return `${fmt(h)}:${fmt(mi)}:${fmt(se)}`;
      }

      function renderTimer() {
        const face = el("div", { class: "clock-face", style: { fontFamily: "Cascadia Code, Consolas, monospace" } });
        const controls = el("div", { class: "clock-controls" });
        const inputs = el("div", { class: "clock-input" });
        const hh = el("input", { type: "number", min: 0, value: Math.floor(timerMs/3600000) });
        const mm = el("input", { type: "number", min: 0, value: Math.floor(timerMs/60000)%60 });
        const ss = el("input", { type: "number", min: 0, value: Math.floor(timerMs/1000)%60 });
        inputs.append(hh, el("span",{},":"), mm, el("span",{},":"), ss);
        const setBtn = el("button", { onclick: () => {
          timerMs = (+hh.value)*3600000 + (+mm.value)*60000 + (+ss.value)*1000;
          face.textContent = fmtDur(timerMs);
        } }, "Set");
        const startBtn = el("button", { class: "primary", onclick: () => {
          if (timerTicker) return;
          timerEnd = Date.now() + timerMs;
          timerTicker = setInterval(() => {
            const left = timerEnd - Date.now();
            face.textContent = fmtDur(left);
            if (left <= 0) { clearInterval(timerTicker); timerTicker = null; DO.toast("Timer", "Time's up!"); DO.blip(880, 1, 0.08); }
          }, 100);
        } }, "Start");
        const pauseBtn = el("button", { onclick: () => {
          if (!timerTicker) return;
          timerMs = timerEnd - Date.now();
          clearInterval(timerTicker); timerTicker = null;
        } }, "Pause");
        const resetBtn = el("button", { onclick: () => {
          if (timerTicker) { clearInterval(timerTicker); timerTicker = null; }
          face.textContent = fmtDur(timerMs);
        } }, "Reset");

        controls.append(setBtn, startBtn, pauseBtn, resetBtn);
        section.append(el("div",{}, face, el("div",{class:"clock-sub"},"Set a countdown"), inputs, controls));
        face.textContent = fmtDur(timerMs);
      }

      function renderStopwatch() {
        const face = el("div", { class: "clock-face", style: { fontFamily: "Cascadia Code, Consolas, monospace" } });
        const controls = el("div", { class: "clock-controls" });
        const laps = el("div", { class: "clock-laps" });
        function tick() {
          const t = swPaused ? swElapsed : (swElapsed + (Date.now() - swStart));
          const s = Math.floor(t/1000), ms = t%1000;
          face.textContent = fmtDur(s*1000) + "." + fmt(Math.floor(ms/10));
        }
        tick();
        if (swTicker) clearInterval(swTicker);
        swTicker = setInterval(tick, 50);

        const startBtn = el("button", { class: "primary", onclick: () => {
          if (swPaused) { swStart = Date.now(); swPaused = false; startBtn.textContent = "Pause"; }
          else { swElapsed += Date.now() - swStart; swPaused = true; startBtn.textContent = "Start"; }
        } }, swPaused ? "Start" : "Pause");
        const lapBtn = el("button", { onclick: () => {
          const t = swElapsed + (swPaused ? 0 : (Date.now() - swStart));
          swLaps.push(t);
          laps.innerHTML = swLaps.map((t,i)=>`Lap ${i+1}: ${fmtDur(t)}`).reverse().join("<br/>");
        } }, "Lap");
        const resetBtn = el("button", { onclick: () => {
          swElapsed = 0; swPaused = true; swStart = 0; swLaps = [];
          laps.innerHTML = ""; startBtn.textContent = "Start"; tick();
        } }, "Reset");

        controls.append(startBtn, lapBtn, resetBtn);
        section.append(el("div",{}, face, controls, laps));
      }

      function renderAlarm() {
        const list = el("div", { style: { marginTop: "16px" } });
        const newInput = el("input", { type: "time" });
        const addBtn = el("button", { class: "primary", onclick: () => {
          if (!newInput.value) return;
          alarms.push({ time: newInput.value, on: true });
          DO.Store.set("alarms", alarms); renderList();
        } }, "Add alarm");
        function renderList() {
          list.innerHTML = "";
          alarms.forEach((a, i) => {
            const row = el("div", { style: { display: "flex", justifyContent: "space-between", padding: "8px", borderBottom: "1px solid var(--stroke)" } },
              el("span", {}, a.time),
              el("div", {},
                el("input", { type: "checkbox", checked: a.on, onchange: e => { alarms[i].on = e.target.checked; DO.Store.set("alarms", alarms); } }),
                el("button", { onclick: () => { alarms.splice(i,1); DO.Store.set("alarms", alarms); renderList(); }, style: { marginLeft: "8px" } }, "×"),
              ),
            );
            list.appendChild(row);
          });
          if (!alarms.length) list.appendChild(el("div", { style: { color: "var(--text-dim)" } }, "No alarms yet."));
        }
        renderList();
        if (alarmTicker) clearInterval(alarmTicker);
        alarmTicker = setInterval(() => {
          const now = new Date();
          const hhmm = `${DO.fmt(now.getHours())}:${DO.fmt(now.getMinutes())}`;
          alarms.forEach((a, i) => {
            if (a.on && a.time === hhmm && !a.fired) {
              a.fired = true;
              DO.toast("Alarm", "It's " + a.time);
              DO.blip(880, 0.6, 0.06);
              setTimeout(() => { a.fired = false; }, 60000);
            }
          });
        }, 2000);

        section.append(el("div", { style: { width: "100%", padding: "0 20px" } },
          el("div", { class: "clock-input", style: { justifyContent: "center" } }, newInput, addBtn),
          list
        ));
      }

      win.onClose = () => {
        if (worldTicker) clearInterval(worldTicker);
        if (timerTicker) clearInterval(timerTicker);
        if (swTicker) clearInterval(swTicker);
        if (alarmTicker) clearInterval(alarmTicker);
      };

      render();
    }
  });
})();
