/* Terminal — a small fake shell with real commands over the virtual FS */
(function () {
  "use strict";
  const DO = window.DevinOS;
  const { el, ICONS, esc } = DO;

  DO.registerApp({
    id: "terminal",
    title: "Terminal",
    icon: ICONS.terminal,
    defaultSize: { w: 720, h: 460 },
    mount(win) {
      const root = win.bodyRoot;
      root.classList.add("terminal-body");

      let cwd = "/Users/Devin";
      const history = []; let hIdx = -1;

      function prompt() {
        return `<span class="term-prompt">devin@devinwos</span>:<span class="term-path">${cwd}</span>$ `;
      }
      function write(html, cls) {
        const line = el("div", { class: "term-line" + (cls ? " " + cls : "") });
        line.innerHTML = html;
        root.insertBefore(line, inputLine);
      }
      function writeHtml(html) {
        const line = el("div", { class: "term-line" });
        line.innerHTML = html;
        root.insertBefore(line, inputLine);
      }

      const input = el("input", { type: "text", spellcheck: "false", autocomplete: "off", autofocus: true });
      const promptSpan = el("span");
      const inputLine = el("div", { class: "term-input-line" }, promptSpan, input);
      root.appendChild(inputLine);

      write(`DevinWOS Terminal [Version 1.0.0]
Type 'help' to get started. Tip: try 'fortune', 'matrix', or 'cowsay hello'.`);
      redraw();

      function redraw() {
        promptSpan.innerHTML = prompt();
        root.scrollTop = root.scrollHeight;
      }

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const cmd = input.value; input.value = "";
          if (cmd.trim()) { history.push(cmd); hIdx = history.length; }
          write(prompt() + esc(cmd));
          exec(cmd);
          redraw();
        } else if (e.key === "ArrowUp") {
          if (hIdx > 0) { hIdx--; input.value = history[hIdx]; }
          e.preventDefault();
        } else if (e.key === "ArrowDown") {
          if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; }
          else { hIdx = history.length; input.value = ""; }
          e.preventDefault();
        } else if (e.key === "Tab") {
          e.preventDefault();
          const val = input.value;
          const parts = val.split(" ");
          const last = parts[parts.length - 1];
          if (!last) return;
          const list = DO.FS.list(resolvePath(".")).map(n => n.name);
          const match = list.filter(n => n.startsWith(last));
          if (match.length === 1) {
            parts[parts.length - 1] = match[0];
            input.value = parts.join(" ");
          } else if (match.length > 1) {
            write(match.join("  "));
          }
        }
      });
      root.addEventListener("click", () => input.focus());

      function resolvePath(p) {
        if (!p || p === "." ) return cwd;
        if (p === "..") {
          const parts = cwd.split("/").filter(Boolean); parts.pop();
          return "/" + parts.join("/");
        }
        if (p.startsWith("/")) return p;
        return (cwd === "/" ? "" : cwd) + "/" + p;
      }

      function cmd_help() {
        return `Commands:
  help                  show this help
  clear                 clear screen
  echo [msg]            print message
  whoami                print current user
  date                  print current date/time
  ls [path]             list directory
  cd [path]             change directory
  pwd                   print working directory
  cat <file>            print file contents
  mkdir <dir>           make directory
  touch <file>          create empty file
  rm <path>             remove file/folder
  open <app|file>       open an app or file
  apps                  list installed apps
  games                 list installed games
  fortune               random message
  matrix                digital rain
  cowsay <msg>          ascii cow says
  neofetch              system info
  exit                  close terminal`;
      }

      function exec(line) {
        const [cmd, ...args] = line.trim().split(/\s+/);
        if (!cmd) return;
        switch (cmd) {
          case "help": write(cmd_help()); break;
          case "clear": root.querySelectorAll(".term-line").forEach(n => n.remove()); break;
          case "echo": write(esc(args.join(" "))); break;
          case "whoami": write("devin"); break;
          case "date": write(new Date().toString()); break;
          case "pwd": write(cwd); break;
          case "ls": {
            const path = resolvePath(args[0] || ".");
            const items = DO.FS.list(path);
            if (!items.length) { write("(empty)"); return; }
            const grid = items.map(n => {
              const badge = n.type === "dir" ? "📁" : "📄";
              return `${badge} ${esc(n.name)}`;
            }).join("   ");
            writeHtml(grid);
            break;
          }
          case "cd": {
            const path = resolvePath(args[0] || "/Users/Devin");
            const n = DO.FS.resolve(path);
            if (!n || n.type !== "dir") { write("cd: not a directory: " + path, "term-err"); break; }
            cwd = path === "/" ? "/" : path.replace(/\/+$/, "");
            break;
          }
          case "cat": {
            if (!args[0]) { write("cat: missing file", "term-err"); break; }
            const c = DO.FS.readFile(resolvePath(args[0]));
            if (c == null) { write("cat: no such file", "term-err"); break; }
            write(esc(c));
            break;
          }
          case "mkdir": {
            if (!args[0]) { write("mkdir: missing operand", "term-err"); break; }
            const ok = DO.FS.mkdir(resolvePath(args[0]));
            if (!ok) write("mkdir: could not create", "term-err");
            break;
          }
          case "touch": {
            if (!args[0]) { write("touch: missing operand", "term-err"); break; }
            DO.FS.writeFile(resolvePath(args[0]), "");
            break;
          }
          case "rm": {
            if (!args[0]) { write("rm: missing operand", "term-err"); break; }
            const ok = DO.FS.remove(resolvePath(args[0]));
            if (!ok) write("rm: no such file", "term-err");
            break;
          }
          case "open": {
            if (!args[0]) { write("open: missing target", "term-err"); break; }
            const t = args[0];
            if (DO.apps.get(t)) { DO.WM.open(t); break; }
            const path = resolvePath(t);
            const node = DO.FS.resolve(path);
            if (node && node.type === "file") DO.WM.open("notepad", { path });
            else write("open: unknown: " + t, "term-err");
            break;
          }
          case "apps": write(Array.from(DO.apps.values()).filter(a => a.id !== "gta" && a.id !== "minesweeper" && a.id !== "solitaire").map(a => `• ${a.id}  —  ${a.title}`).join("\n")); break;
          case "games": write("• minesweeper  —  Minesweeper\n• solitaire  —  Solitaire\n• gta  —  Grand Theft Web"); break;
          case "fortune": {
            const list = [
              "The cake is a lie.",
              "It's dangerous to go alone. Take this terminal.",
              "Do or do not. There is no rm -rf /.",
              "A watched pointer never clicks.",
              "sudo make me a sandwich",
              "42.",
            ];
            write(list[Math.floor(Math.random()*list.length)]);
            break;
          }
          case "matrix": {
            const charset = "01ｱｲｳｴｵｶｷｸｹｺ@#$%&";
            let lines = 16;
            const iv = setInterval(() => {
              if (lines-- <= 0) { clearInterval(iv); return; }
              let s = "";
              for (let i = 0; i < 60; i++) s += charset[Math.floor(Math.random()*charset.length)];
              writeHtml(`<span style="color:#5aff5a">${esc(s)}</span>`);
              redraw();
            }, 80);
            break;
          }
          case "cowsay": {
            const msg = args.join(" ") || "Moo!";
            const bar = "-".repeat(msg.length + 2);
            writeHtml(`<pre style="margin:0">${esc(" " + bar + "\n< " + msg + " >\n " + bar)}</pre>
<pre style="margin:0">        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||</pre>`);
            break;
          }
          case "neofetch": {
            writeHtml(`
<pre style="margin:0;color:#9fffa0">      _______________
     /               \\
    |    DevinWOS    |
    |                |
    |    web-based   |
     \\_______________/</pre>
OS: DevinWOS 1.0 web
Host: ${esc(navigator.platform || "?")}
Kernel: JavaScript ${new Date().getFullYear()}
Shell: devinsh v1
Resolution: ${screen.width}x${screen.height}
CPU: ${navigator.hardwareConcurrency || "?"} logical cores
Memory: ${navigator.deviceMemory || "?"} GB
Accent: ${DO.Settings.get().accent}
`);
            break;
          }
          case "exit": win.close(); break;
          default: write("command not found: " + cmd + "  (try 'help')", "term-err");
        }
      }

      setTimeout(() => input.focus(), 40);
    }
  });
})();
