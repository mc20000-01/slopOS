import { runBoxedCode } from "./boxedlang.js";

const bootScreen = document.getElementById("bootScreen");
const desktop = document.getElementById("desktop");
const status = document.getElementById("status");
const windowPane = document.getElementById("window");
const windowTitle = document.getElementById("windowTitle");
const windowBody = document.getElementById("windowBody");
const minimize = document.getElementById("minimize");
const closeButton = document.getElementById("close");
const templates = document.getElementById("templates");

const virtualFiles = {
  "hello.box": "say Hello~world\nbox name|slopOS\nsay Welcome~to~$name",
  "readme.txt": "slopOS virtual filesystem. Try running hello.box.",
};

const appState = {
  activeApp: "about",
  notesKey: "slopOS-notes",
  terminalHistory: [],
  terminalOutput: null,
};

const appContent = {
  about: {
    title: "About slopOS",
  },
  notes: {
    title: "Notes",
  },
  terminal: {
    title: "Terminal",
  },
  gallery: {
    title: "Gallery",
  },
  files: {
    title: "Files",
  },
};

const terminalResponses = {
  help: "Available commands: help, status, clear, time, ls, cat <file>, boxed <file>",
  status: "All systems nominal. Network uplink stable.",
};

const setStatus = () => {
  const now = new Date();
  status.textContent = `${now.toLocaleDateString()} · ${now.toLocaleTimeString()}`;
};

const renderTerminalLine = (line) => {
  if (!appState.terminalOutput) {
    return;
  }
  const p = document.createElement("p");
  p.textContent = line;
  appState.terminalOutput.appendChild(p);
  appState.terminalOutput.scrollTop = appState.terminalOutput.scrollHeight;
};

const appendTerminalLine = (line) => {
  appState.terminalHistory.push(line);
  renderTerminalLine(line);
};

const resetTerminalOutput = () => {
  if (!appState.terminalOutput) {
    return;
  }
  appState.terminalOutput.innerHTML = "";
};

const runBoxedScript = (source, destination) => {
  const lines = runBoxedCode(source);
  if (destination === "terminal") {
    lines.forEach((line) => appendTerminalLine(line));
    return;
  }
  return lines;
};

const renderFileList = (container, onSelect) => {
  container.innerHTML = "";
  Object.keys(virtualFiles)
    .sort()
    .forEach((filename) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "file-entry";
      button.textContent = filename;
      button.addEventListener("click", () => onSelect(filename));
      container.appendChild(button);
    });
};

const renderApp = (appName) => {
  appState.activeApp = appName;
  const template = templates.content.querySelector(
    `[data-template="${appName}"]`
  );

  if (!template) {
    return;
  }

  windowTitle.textContent = appContent[appName]?.title ?? "App";
  windowBody.innerHTML = "";
  windowBody.appendChild(template.cloneNode(true));

  if (appName === "notes") {
    const notesArea = windowBody.querySelector("#notesArea");
    notesArea.value = localStorage.getItem(appState.notesKey) ?? "";
    notesArea.addEventListener("input", (event) => {
      localStorage.setItem(appState.notesKey, event.target.value);
    });
  }

  if (appName === "terminal") {
    const output = windowBody.querySelector("#terminalOutput");
    const form = windowBody.querySelector("#terminalForm");
    const input = windowBody.querySelector("#terminalInput");

    appState.terminalOutput = output;
    resetTerminalOutput();
    appState.terminalHistory.forEach((line) => renderTerminalLine(line));

    if (appState.terminalHistory.length === 0) {
      appendTerminalLine("Type 'help' for a command list.");
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const command = input.value.trim();
      if (!command) {
        return;
      }
      appendTerminalLine(`$ ${command}`);

      const [baseCommand, ...args] = command.split(" ");

      if (baseCommand === "clear") {
        appState.terminalHistory = [];
        resetTerminalOutput();
      } else if (baseCommand === "time") {
        appendTerminalLine(new Date().toLocaleString());
      } else if (baseCommand === "ls") {
        Object.keys(virtualFiles)
          .sort()
          .forEach((file) => appendTerminalLine(file));
      } else if (baseCommand === "cat") {
        const filename = args.join(" ");
        if (!filename) {
          appendTerminalLine("Usage: cat <filename>");
        } else if (!virtualFiles[filename]) {
          appendTerminalLine(`File not found: ${filename}`);
        } else {
          appendTerminalLine(virtualFiles[filename]);
        }
      } else if (baseCommand === "boxed") {
        const filename = args.join(" ");
        if (!filename) {
          appendTerminalLine("Usage: boxed <filename>");
        } else if (!virtualFiles[filename]) {
          appendTerminalLine(`File not found: ${filename}`);
        } else {
          runBoxedScript(virtualFiles[filename], "terminal");
        }
      } else {
        appendTerminalLine(
          terminalResponses[baseCommand] ?? `Unknown command: ${command}`
        );
      }
      input.value = "";
    });
  }

  if (appName === "files") {
    const list = windowBody.querySelector("#fileList");
    const viewer = windowBody.querySelector("#fileViewer");
    const filenameLabel = windowBody.querySelector("#fileName");
    const runButton = windowBody.querySelector("#runBoxed");
    const output = windowBody.querySelector("#filesOutput");

    const showFile = (filename) => {
      const contents = virtualFiles[filename];
      filenameLabel.textContent = filename;
      viewer.value = contents;
      const isBox = filename.endsWith(".box");
      runButton.hidden = !isBox;
      output.textContent = "";

      if (isBox) {
        runButton.onclick = () => {
          const lines = runBoxedScript(contents);
          output.textContent = lines.join("\n");
          if (lines.length === 0) {
            output.textContent = "(no output)";
          }
        };
      }
    };

    renderFileList(list, showFile);
    const firstFile = Object.keys(virtualFiles).sort()[0];
    if (firstFile) {
      showFile(firstFile);
    }
  }
};

const attachAppLaunchers = () => {
  document.querySelectorAll("[data-app]").forEach((button) => {
    button.addEventListener("click", () => {
      const app = button.dataset.app;
      if (app === "launcher") {
        windowPane.classList.remove("minimized");
        return;
      }
      renderApp(app);
      windowPane.classList.remove("minimized");
    });
  });
};

minimize.addEventListener("click", () => {
  windowPane.classList.toggle("minimized");
});

closeButton.addEventListener("click", () => {
  windowPane.classList.add("minimized");
});

setInterval(setStatus, 1000);

setTimeout(() => {
  bootScreen.hidden = true;
  desktop.hidden = false;
  setStatus();
  renderApp("about");
  attachAppLaunchers();
}, 1200);
