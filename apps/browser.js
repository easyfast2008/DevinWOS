/* Browser — sandboxed iframe with tabs, URL bar, bookmarks, history */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "browser",
    title: "Browser",
    icon: ICONS.browser,
    defaultSize: { w: 900, h: 600 },
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("browser-body");

      const tabs = [];
      let activeIdx = -1;
      const tabsBar = el("div", { class: "browser-tabs" });
      const addrBar = el("div", { class: "toolbar" });
      const bookBar = el("div", { class: "browser-bookmarks" });
      const frameHost = el("div", { style: { flex: "1", position: "relative", background: "#fff" } });

      root.append(tabsBar, addrBar, bookBar, frameHost);

      const backB = el("button", { onclick: () => runInFrame("history.back()") }, "◀");
      const fwdB = el("button", { onclick: () => runInFrame("history.forward()") }, "▶");
      const reloadB = el("button", { onclick: () => activeFrame() && (activeFrame().src = activeFrame().src) }, "↻");
      const addrInput = el("input", { type: "text", placeholder: "Search or enter address",
        style: { flex: "1" },
        onkeydown: e => { if (e.key === "Enter") navigate(e.target.value); }});
      const newTabB = el("button", { onclick: () => openTab("about:home") }, "+ Tab");
      addrBar.append(backB, fwdB, reloadB, addrInput, newTabB);

      ["about:home", "https://en.wikipedia.org", "https://duckduckgo.com/?q=DevinWOS", "https://example.com", "https://news.ycombinator.com"].forEach(u => {
        bookBar.appendChild(el("button", { onclick: () => navigate(u) }, pretty(u)));
      });

      function pretty(u) {
        if (u === "about:home") return "★ Home";
        try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; }
      }

      function openTab(url) {
        const tab = { url, title: "New Tab", frame: null };
        tabs.push(tab);
        renderTabs();
        setActive(tabs.length - 1);
        if (url) navigate(url);
      }

      function setActive(i) {
        activeIdx = i;
        renderTabs();
        if (tabs[i]) {
          addrInput.value = tabs[i].url === "about:home" ? "" : tabs[i].url;
          frameHost.innerHTML = "";
          if (tabs[i].frame) frameHost.appendChild(tabs[i].frame);
        }
      }

      function renderTabs() {
        tabsBar.innerHTML = "";
        tabs.forEach((t, i) => {
          const tEl = el("div", {
            class: "browser-tab" + (i === activeIdx ? " active" : ""),
            onclick: () => setActive(i),
          },
            el("span", {}, t.title || "New tab"),
            el("button", {
              class: "x",
              onclick: (e) => { e.stopPropagation(); closeTab(i); }
            }, "×"),
          );
          tabsBar.appendChild(tEl);
        });
      }

      function closeTab(i) {
        tabs.splice(i, 1);
        if (activeIdx >= tabs.length) activeIdx = tabs.length - 1;
        if (tabs.length === 0) openTab("about:home");
        else setActive(activeIdx);
      }

      function activeFrame() {
        return tabs[activeIdx] && tabs[activeIdx].frame;
      }

      function runInFrame(code) {
        const f = activeFrame();
        try { f && f.contentWindow.eval(code); } catch (e) {}
      }

      function homeHTML() {
        return `<!doctype html><html><head><meta charset="utf-8"/>
        <style>
          body{font:15px/1.5 system-ui,sans-serif;margin:0;background:linear-gradient(160deg,#0f172a,#1e3a8a);color:#fff;min-height:100vh;display:grid;place-items:center;text-align:center;padding:20px}
          .wrap{max-width:720px;width:100%}
          h1{font-weight:400;font-size:40px;margin:10px 0 4px;}
          .logo{font-size:80px;margin:0}
          .bar{margin:20px auto;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:50px;padding:12px 18px;display:flex;gap:8px}
          .bar input{flex:1;background:transparent;border:none;outline:none;color:#fff;font:inherit}
          .bar button{background:#3a7bd5;border:none;color:#fff;padding:6px 14px;border-radius:40px;cursor:pointer}
          .shortcuts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:20px}
          .shortcut{background:rgba(255,255,255,0.08);padding:14px;border-radius:8px;cursor:pointer;color:#fff;text-decoration:none}
          .shortcut:hover{background:rgba(255,255,255,0.16)}
        </style></head><body><div class="wrap">
        <div class="logo">🌐</div>
        <h1>DevinWOS Browser</h1>
        <p style="opacity:.8">Type a URL or search the web.</p>
        <form class="bar" onsubmit="event.preventDefault();parent.postMessage({navigate: this.q.value},'*');">
          <input name="q" placeholder="Search with DuckDuckGo or enter a URL">
          <button>Go</button>
        </form>
        <div class="shortcuts">
          <a class="shortcut" href="https://en.wikipedia.org" target="_top">Wikipedia</a>
          <a class="shortcut" href="https://example.com" target="_top">example.com</a>
          <a class="shortcut" href="https://duckduckgo.com" target="_top">DuckDuckGo</a>
          <a class="shortcut" href="https://news.ycombinator.com" target="_top">Hacker News</a>
        </div>
        <p style="opacity:.55;margin-top:30px;font-size:12px">⚠ Some sites block embedding. If a page refuses to load, that's their X-Frame-Options policy, not us.</p>
        </div></body></html>`;
      }

      window.addEventListener("message", (e) => {
        if (e.data && e.data.navigate) navigate(e.data.navigate);
      });

      function navigate(url) {
        if (!url) return;
        if (url === "about:home") {
          const f = document.createElement("iframe");
          f.srcdoc = homeHTML();
          setFrame(f, "Home", "about:home");
          return;
        }
        if (!/^https?:\/\//.test(url) && !url.startsWith("about:")) {
          if (url.includes(".") && !url.includes(" ")) url = "https://" + url;
          else url = "https://duckduckgo.com/?q=" + encodeURIComponent(url);
        }
        const f = document.createElement("iframe");
        f.src = url;
        f.referrerPolicy = "no-referrer";
        setFrame(f, url, url);
      }

      function setFrame(frame, title, url) {
        if (activeIdx === -1) openTab(url);
        const tab = tabs[activeIdx];
        tab.frame = frame;
        tab.title = pretty(url);
        tab.url = url;
        addrInput.value = url === "about:home" ? "" : url;
        frameHost.innerHTML = "";
        frameHost.appendChild(frame);
        renderTabs();
        frame.addEventListener("load", () => {
          try {
            const t = frame.contentDocument && frame.contentDocument.title;
            if (t) { tab.title = t; renderTabs(); }
          } catch {}
        });
      }

      openTab("about:home");
    }
  });
})();
