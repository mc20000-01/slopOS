const bootScreen = document.querySelector("#bootScreen");
const desktop = document.getElementById("desktop");
const status = document.getElementById("status");
const windowPane = document.getElementById("window");
const windowTitle = document.getElementById("windowTitle");
const windowBody = document.getElementById("windowBody");
const minimize = document.getElementById("minimize");
const closeButton = document.getElementById("close");
const templates = document.getElementById("templates");

const appState = {
  activeApp: "about",
  notesKey: "slopOS-notes",
  boxedKey: "slopOS-boxed",
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
  boxed: {
    title: "BoxedLang Studio",
  },
};

const terminalResponses = {
  help: "Available commands: help, status, clear, time",
  status: "All systems nominal. Network uplink stable.",
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
  }

  if (appName === "boxed") {
    const editor = windowBody.querySelector("#boxedEditor");
    const outputPanel = windowBody.querySelector("#boxedOutput");
    const runButton = windowBody.querySelector("#boxedRun");

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

bootScreen?.remove();
desktop.hidden = false;
setStatus();
renderApp("about");
attachAppLaunchers();
