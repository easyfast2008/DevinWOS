/* Media Player */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "mediaplayer",
    title: "Media Player",
    icon: ICONS.media,
    defaultSize: { w: 620, h: 480 },
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("mp-body");

      const queue = []; let idx = -1;
      const drop = el("div", { class: "mp-drop" }, "Drop audio/video files here, or click Add.");
      const player = el("div", { class: "mp-player", style: { display: "none" } });
      const media = el("video", { controls: true });
      const title = el("div", { class: "mp-title" });
      const list = el("div", { class: "mp-list" });
      const bar = el("div", { class: "toolbar" },
        el("button", { onclick: () => fileInput.click() }, "Add"),
        el("button", { onclick: () => prev() }, "◀◀"),
        el("button", { onclick: () => { if (media.paused) media.play(); else media.pause(); } }, "▶/❚❚"),
        el("button", { onclick: () => next() }, "▶▶"),
        el("button", { onclick: () => { queue.length = 0; idx = -1; render(); } }, "Clear"),
      );
      player.append(media, title, list);
      root.append(bar, drop, player);

      const fileInput = el("input", { type: "file", multiple: true, accept: "audio/*,video/*", style: { display: "none" },
        onchange: e => addFiles(Array.from(e.target.files)) });
      root.appendChild(fileInput);

      root.addEventListener("dragover", e => { e.preventDefault(); });
      root.addEventListener("drop", e => {
        e.preventDefault(); addFiles(Array.from(e.dataTransfer.files));
      });

      function addFiles(files) {
        files.forEach(f => queue.push({ name: f.name, url: URL.createObjectURL(f), kind: f.type.startsWith("video") ? "video" : "audio" }));
        if (idx === -1 && queue.length) play(0);
        render();
      }
      function play(i) {
        if (!queue[i]) return;
        idx = i;
        const t = queue[i];
        media.src = t.url;
        media.style.height = t.kind === "audio" ? "40px" : "auto";
        title.textContent = t.name;
        media.play().catch(()=>{});
        render();
      }
      function next() { if (idx < queue.length - 1) play(idx + 1); }
      function prev() { if (idx > 0) play(idx - 1); }
      media.addEventListener("ended", next);

      function render() {
        drop.style.display = queue.length ? "none" : "grid";
        player.style.display = queue.length ? "flex" : "none";
        list.innerHTML = "";
        queue.forEach((t, i) => {
          list.appendChild(el("div", {
            class: "mp-item" + (i === idx ? " playing" : ""),
            onclick: () => play(i),
          }, el("span", {}, t.name), el("span", {}, t.kind)));
        });
      }

      win.onClose = () => queue.forEach(t => URL.revokeObjectURL(t.url));
    }
  });
})();
