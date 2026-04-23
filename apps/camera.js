/* Camera — real getUserMedia */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS } = DO;

  DO.registerApp({
    id: "camera",
    title: "Camera",
    icon: ICONS.camera,
    defaultSize: { w: 640, h: 520 },
    single: true,
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("camera-body");

      const video = el("video", { autoplay: true, playsInline: true, muted: true });
      const snapshots = el("div", { class: "camera-snapshots" });
      const shutter = el("button", { class: "camera-shutter", onclick: capture },
        DO.svg(`<circle cx="12" cy="12" r="6" fill="currentColor"/>`, { width: 24, height: 24 })
      );
      const swapBtn = el("button", { onclick: () => { facing = facing === "user" ? "environment" : "user"; startStream(); } }, "Swap");
      const stopBtn = el("button", { onclick: () => { stopStream(); } }, "Stop");

      const controls = el("div", { class: "camera-controls" }, swapBtn, shutter, stopBtn);
      root.append(video, snapshots, controls);

      let stream = null;
      let facing = "user";

      async function startStream() {
        stopStream();
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
          video.srcObject = stream;
        } catch (e) {
          root.innerHTML = "";
          root.appendChild(el("div", { style: { color: "#fff", textAlign: "center", padding: "24px" } },
            "Camera unavailable.", el("br",{}), el("small",{}, String(e))
          ));
        }
      }
      function stopStream() {
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      }
      function capture() {
        if (!stream) return;
        const vw = video.videoWidth, vh = video.videoHeight;
        const c = document.createElement("canvas"); c.width = vw; c.height = vh;
        c.getContext("2d").drawImage(video, 0, 0);
        const url = c.toDataURL("image/png");
        const img = el("img", { src: url });
        img.addEventListener("click", () => {
          const name = "snapshot-" + Date.now() + ".png";
          DO.FS.writeFile("/Users/Devin/Pictures/" + name, url);
          DO.toast("Camera", "Saved " + name + " to Pictures");
        });
        snapshots.prepend(img);
        DO.blip(1320, 0.08, 0.05);
      }

      win.onClose = stopStream;
      startStream();
    }
  });
})();
