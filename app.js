const bootScreen = document.getElementById("bootScreen");
const desktop = document.getElementById("desktop");
const status = document.getElementById("status");
const windowsContainer = document.getElementById("windows");
const desktopArea = document.getElementById("desktopArea");
const launcher = document.getElementById("launcher");
const launcherGrid = document.getElementById("launcherGrid");
const launcherSearch = document.getElementById("launcherSearch");
const launcherClose = document.getElementById("launcherClose");
const activitiesButton = document.getElementById("activitiesButton");
const templates = document.getElementById("templates");

const appState = {
  notesKey: "slopOS-notes",
  boxedKey: "slopOS-boxed",
  openWindows: new Map(),
  zIndex: 10,
  cascadeOffset: 0,
};

const apps = {
  about: { title: "About slopOS", icon: "🪐" },
  notes: { title: "Notes", icon: "📝" },
  terminal: { title: "Terminal", icon: "💻" },
  files: { title: "Files", icon: "📁" },
  browser: { title: "Browser", icon: "🌐" },
  gallery: { title: "Gallery", icon: "🖼️" },
  boxed: { title: "BoxedLang Studio", icon: "📦" },
  settings: { title: "Settings", icon: "⚙️" },
};

const terminalResponses = {
  help: "Available commands: help, status, clear, time, neofetch",
  status: "All systems nominal. Network uplink stable.",
  neofetch:
    "slopOS 24.04 LTS (web)\nKernel: 6.8.0-virtual\nShell: slopOS sh\nUptime: 3 mins",
};

const boxedSample = `# BoxedLang Studio sample
box greeting = "Hello from BoxedLang!"
box count = 3

say greeting
math total = count * 4 + 2
say total

if total > 10 jump celebration
say "Total is small."
jump end

mark celebration
say "Total is big!"

mark end
say "Done."`;

const parseBoxedValue = (value, variables, lineNumber) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Missing value on line ${lineNumber}.`);
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  if (!Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  if (variables.has(trimmed)) {
    return variables.get(trimmed);
  }
  throw new Error(`Unknown value "${trimmed}" on line ${lineNumber}.`);
};

const evaluateBoxedExpression = (expression, variables, lineNumber) => {
  const replaced = expression.replace(
    /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
    (token) => {
      if (!variables.has(token)) {
        throw new Error(`Unknown variable "${token}" on line ${lineNumber}.`);
      }
      const value = variables.get(token);
      if (typeof value !== "number") {
        throw new Error(`Variable "${token}" is not a number on line ${lineNumber}.`);
      }
      return String(value);
    }
  );

  if (!/^[0-9+\-*/%().<>=!&|\s]+$/.test(replaced)) {
    throw new Error(`Invalid characters in expression on line ${lineNumber}.`);
  }

  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${replaced});`)();
};

const runBoxedProgram = (source) => {
  const lines = source.split(/\r?\n/);
  const labels = new Map();
  const variables = new Map();
  const output = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      return;
    }
    const match = trimmed.match(/^mark\s+([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (match) {
      labels.set(match[1], index);
    }
  });

  let pointer = 0;
  while (pointer < lines.length) {
    const raw = lines[pointer];
    const trimmed = raw.trim();
    const lineNumber = pointer + 1;

    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) {
      pointer += 1;
      continue;
    }

    const [command] = trimmed.split(/\s+/);
    const rest = trimmed.slice(command.length).trim();

    try {
      if (command === "box") {
        const match = trimmed.match(
          /^box\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=\s*)?(.*)$/
        );
        if (!match || !match[2]) {
          throw new Error(`Invalid box declaration on line ${lineNumber}.`);
        }
        const value = parseBoxedValue(match[2], variables, lineNumber);
        variables.set(match[1], value);
      } else if (command === "say") {
        if (!rest) {
          throw new Error(`Missing say message on line ${lineNumber}.`);
        }
        if (rest.startsWith("$")) {
          const name = rest.slice(1).trim();
          if (!variables.has(name)) {
            throw new Error(`Unknown variable "${name}" on line ${lineNumber}.`);
          }
          output.push(String(variables.get(name)));
        } else {
          output.push(String(parseBoxedValue(rest, variables, lineNumber)));
        }
      } else if (command === "math") {
        const match = trimmed.match(
          /^math\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/
        );
        if (!match) {
          throw new Error(`Invalid math statement on line ${lineNumber}.`);
        }
        const value = evaluateBoxedExpression(match[2], variables, lineNumber);
        variables.set(match[1], value);
      } else if (command === "if") {
        const match = trimmed.match(
          /^if\s+(.+)\s+jump\s+([a-zA-Z_][a-zA-Z0-9_]*)$/
        );
        if (!match) {
          throw new Error(`Invalid if statement on line ${lineNumber}.`);
        }
        const result = evaluateBoxedExpression(match[1], variables, lineNumber);
        if (result) {
          const labelLine = labels.get(match[2]);
          if (labelLine === undefined) {
            throw new Error(`Unknown mark "${match[2]}" on line ${lineNumber}.`);
          }
          pointer = labelLine;
          continue;
        }
      } else if (command === "mark") {
        // Labels are handled in the pre-pass.
      } else if (command === "jump") {
        const match = trimmed.match(/^jump\s+([a-zA-Z_][a-zA-Z0-9_]*)$/);
        if (!match) {
          throw new Error(`Invalid jump statement on line ${lineNumber}.`);
        }
        const labelLine = labels.get(match[1]);
        if (labelLine === undefined) {
          throw new Error(`Unknown mark "${match[1]}" on line ${lineNumber}.`);
        }
        pointer = labelLine;
        continue;
      } else {
        throw new Error(`Unknown command "${command}" on line ${lineNumber}.`);
      }
    } catch (error) {
      error.lineNumber = lineNumber;
      error.sourceLine = raw;
      throw error;
    }

    pointer += 1;
  }

  return output;
};

const setStatus = () => {
  const now = new Date();
  status.textContent = `${now.toLocaleDateString()} · ${now.toLocaleTimeString()}`;
};

const focusWindow = (windowEl) => {
  appState.zIndex += 1;
  windowEl.style.zIndex = appState.zIndex;
  document.querySelectorAll(".window").forEach((windowItem) => {
    windowItem.classList.toggle("is-focused", windowItem === windowEl);
  });
};

const updateDockIndicators = () => {
  document.querySelectorAll(".dock-button[data-app]").forEach((button) => {
    const appName = button.dataset.app;
    if (!appName || appName === "launcher") {
      return;
    }
    button.classList.toggle("running", appState.openWindows.has(appName));
  });
};

const attachDrag = (windowEl, header) => {
  header.addEventListener("pointerdown", (event) => {
    if (windowEl.classList.contains("maximized")) {
      return;
    }
    focusWindow(windowEl);
    header.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = windowEl.offsetLeft;
    const startTop = windowEl.offsetTop;
    const bounds = desktopArea.getBoundingClientRect();

    const handleMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const nextLeft = Math.min(
        Math.max(0, startLeft + dx),
        bounds.width - windowEl.offsetWidth
      );
      const nextTop = Math.min(
        Math.max(0, startTop + dy),
        bounds.height - windowEl.offsetHeight
      );
      windowEl.style.left = `${nextLeft}px`;
      windowEl.style.top = `${nextTop}px`;
    };

    const handleUp = () => {
      header.releasePointerCapture(event.pointerId);
      header.removeEventListener("pointermove", handleMove);
      header.removeEventListener("pointerup", handleUp);
    };

    header.addEventListener("pointermove", handleMove);
    header.addEventListener("pointerup", handleUp);
  });
};

const wireNotes = (windowEl) => {
  const notesArea = windowEl.querySelector("#notesArea");
  if (!notesArea) {
    return;
  }
  notesArea.value = localStorage.getItem(appState.notesKey) ?? "";
  notesArea.addEventListener("input", (event) => {
    localStorage.setItem(appState.notesKey, event.target.value);
  });
};

const wireTerminal = (windowEl) => {
  const output = windowEl.querySelector("#terminalOutput");
  const form = windowEl.querySelector("#terminalForm");
  const input = windowEl.querySelector("#terminalInput");

  if (!output || !form || !input) {
    return;
  }

  const appendLine = (line) => {
    const p = document.createElement("p");
    p.textContent = line;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight;
  };

  appendLine("Type 'help' for a command list.");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const command = input.value.trim();
    if (!command) {
      return;
    }
    appendLine(`$ ${command}`);
    if (command === "clear") {
      output.innerHTML = "";
    } else if (command === "time") {
      appendLine(new Date().toLocaleString());
    } else {
      appendLine(terminalResponses[command] ?? `Unknown command: ${command}`);
    }
    input.value = "";
  });
};

const wireBoxed = (windowEl) => {
  const editor = windowEl.querySelector("#boxedEditor");
  const outputPanel = windowEl.querySelector("#boxedOutput");
  const runButton = windowEl.querySelector("#boxedRun");

  if (!editor || !outputPanel || !runButton) {
    return;
  }

  const storedProgram = localStorage.getItem(appState.boxedKey);
  editor.value = storedProgram ?? boxedSample;

  const writeOutput = (lines) => {
    outputPanel.innerHTML = "";
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      outputPanel.appendChild(p);
    });
  };

  const runProgram = () => {
    try {
      const output = runBoxedProgram(editor.value);
      writeOutput(output.length ? output : ["(no output)"]);
    } catch (error) {
      const lineNumber = error.lineNumber ?? 0;
      const sourceLine = error.sourceLine ?? "";
      writeOutput([
        `Error: ${error.message}`,
        `Line ${lineNumber}: ${sourceLine.trim()}`,
        `${" ".repeat(`Line ${lineNumber}: `.length)}^`,
      ]);
    }
  };

  editor.addEventListener("input", (event) => {
    localStorage.setItem(appState.boxedKey, event.target.value);
  });

  runButton.addEventListener("click", runProgram);

  runProgram();
};

const wireAppBehavior = (windowEl, appName) => {
  if (appName === "notes") {
    wireNotes(windowEl);
  }
  if (appName === "terminal") {
    wireTerminal(windowEl);
  }
  if (appName === "boxed") {
    wireBoxed(windowEl);
  }
};

const createWindow = (appName) => {
  const app = apps[appName];
  if (!app) {
    return null;
  }

  const windowEl = document.createElement("section");
  windowEl.className = "window";
  windowEl.dataset.app = appName;

  const header = document.createElement("header");
  header.className = "window-header";
  const title = document.createElement("h2");
  title.textContent = app.title;
  const actions = document.createElement("div");
  actions.className = "window-actions";

  const minimizeButton = document.createElement("button");
  minimizeButton.type = "button";
  minimizeButton.textContent = "–";

  const maximizeButton = document.createElement("button");
  maximizeButton.type = "button";
  maximizeButton.textContent = "▢";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "✕";

  actions.append(minimizeButton, maximizeButton, closeButton);
  header.append(title, actions);

  actions.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });

  const body = document.createElement("div");
  body.className = "window-body";
  const template = templates.content.querySelector(
    `[data-template="${appName}"]`
  );
  if (template) {
    body.appendChild(template.cloneNode(true));
  }

  windowEl.append(header, body);
  windowsContainer.appendChild(windowEl);

  const offset = appState.cascadeOffset % 120;
  windowEl.style.left = `${120 + offset}px`;
  windowEl.style.top = `${80 + offset}px`;
  appState.cascadeOffset += 28;

  focusWindow(windowEl);
  attachDrag(windowEl, header);
  wireAppBehavior(windowEl, appName);

  windowEl.addEventListener("pointerdown", () => focusWindow(windowEl));

  minimizeButton.addEventListener("click", () => {
    windowEl.classList.add("minimized");
  });

  maximizeButton.addEventListener("click", () => {
    if (windowEl.classList.contains("maximized")) {
      windowEl.classList.remove("maximized");
      const { prevLeft, prevTop, prevWidth, prevHeight } = windowEl.dataset;
      if (prevLeft) windowEl.style.left = `${prevLeft}px`;
      if (prevTop) windowEl.style.top = `${prevTop}px`;
      if (prevWidth) windowEl.style.width = `${prevWidth}px`;
      if (prevHeight) windowEl.style.height = `${prevHeight}px`;
    } else {
      windowEl.dataset.prevLeft = windowEl.offsetLeft;
      windowEl.dataset.prevTop = windowEl.offsetTop;
      windowEl.dataset.prevWidth = windowEl.offsetWidth;
      windowEl.dataset.prevHeight = windowEl.offsetHeight;
      windowEl.classList.add("maximized");
    }
    focusWindow(windowEl);
  });

  closeButton.addEventListener("click", () => {
    windowEl.remove();
    appState.openWindows.delete(appName);
    updateDockIndicators();
  });

  return windowEl;
};

const launchApp = (appName) => {
  if (!apps[appName]) {
    return;
  }
  const existing = appState.openWindows.get(appName);
  if (existing) {
    existing.classList.remove("minimized");
    focusWindow(existing);
    return;
  }
  const windowEl = createWindow(appName);
  if (windowEl) {
    appState.openWindows.set(appName, windowEl);
    updateDockIndicators();
  }
};

const setLauncherVisibility = (visible) => {
  launcher.hidden = !visible;
  if (visible) {
    launcherSearch.value = "";
    renderLauncher();
    launcherSearch.focus();
  }
};

const renderLauncher = () => {
  const query = launcherSearch.value.toLowerCase();
  launcherGrid.innerHTML = "";
  Object.entries(apps).forEach(([appName, app]) => {
    if (query && !app.title.toLowerCase().includes(query)) {
      return;
    }
    const card = document.createElement("button");
    card.className = "launcher-card";
    card.type = "button";
    card.innerHTML = `<span>${app.icon}</span><strong>${app.title}</strong>`;
    card.addEventListener("click", () => {
      launchApp(appName);
      setLauncherVisibility(false);
    });
    launcherGrid.appendChild(card);
  });
};

const attachAppLaunchers = () => {
  document.querySelectorAll("[data-app]").forEach((button) => {
    button.addEventListener("click", () => {
      const app = button.dataset.app;
      if (app === "launcher") {
        setLauncherVisibility(launcher.hidden);
        return;
      }
      setLauncherVisibility(false);
      launchApp(app);
    });
  });
};

launcherSearch.addEventListener("input", renderLauncher);
launcherClose.addEventListener("click", () => setLauncherVisibility(false));
activitiesButton.addEventListener("click", () => setLauncherVisibility(launcher.hidden));

launcher.addEventListener("click", (event) => {
  if (event.target === launcher) {
    setLauncherVisibility(false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !launcher.hidden) {
    setLauncherVisibility(false);
  }
});

setInterval(setStatus, 1000);

bootScreen.hidden = true;
desktop.hidden = false;
setStatus();
attachAppLaunchers();
launchApp("about");
