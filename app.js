const bootScreen = document.getElementById("bootScreen");
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
};

const terminalResponses = {
  help: "Available commands: help, status, clear, time",
  status: "All systems nominal. Network uplink stable.",
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
