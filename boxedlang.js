const normalizeArg = (value, boxes) => {
  let normalized = value;
  if (normalized.startsWith("$")) {
    const key = normalized.slice(1);
    normalized = boxes[key] ?? "";
  }
  return normalized.replace(/~/g, " ").replace(/:/g, "");
};

const pullCmdFrom = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  const [cmd, ...rest] = trimmed.split(" ");
  const argString = rest.join(" ").trim();
  const args = argString ? argString.split("|").map((arg) => arg.trim()) : [];
  return { cmd: cmd.toLowerCase(), args };
};

const makeCodeFrom = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => pullCmdFrom(line))
    .filter(Boolean);

const mk = (value) => value.replace(/ /g, "~").replace(/:/g, "");

const undoMk = (value) => value.replace(/~/g, " ");

const handleCommand = (state, instruction, outputLines, inputProvider) => {
  const { cmd, args } = instruction;
  const getArg = (index) => normalizeArg(args[index] ?? "", state.boxes);

  if (cmd === "box") {
    const key = getArg(0);
    state.boxes[key] = getArg(1);
    return;
  }

  if (cmd === "say") {
    outputLines.push(getArg(0));
    return;
  }

  if (cmd === "ask") {
    const key = getArg(0);
    const promptText = getArg(1) || "?";
    const response = inputProvider ? inputProvider(promptText) : window.prompt(promptText);
    state.boxes[key] = response ?? "";
    return;
  }

  if (cmd === "del") {
    const key = getArg(0);
    delete state.boxes[key];
    return;
  }

  if (cmd === "test") {
    const left = getArg(0);
    const right = getArg(1);
    state.lastTest = left === right;
    return;
  }

  if (cmd === "math") {
    const key = getArg(0);
    const left = parseFloat(getArg(1));
    const op = getArg(2);
    const right = parseFloat(getArg(3));
    let result = left;
    if (op === "+") {
      result = left + right;
    } else if (op === "-") {
      result = left - right;
    } else if (op === "*") {
      result = left * right;
    } else if (op === "/") {
      result = right === 0 ? 0 : left / right;
    }
    state.boxes[key] = Number.isNaN(result) ? "" : String(result);
    return;
  }

  if (cmd === "wait") {
    return;
  }

  if (cmd === "mark") {
    const key = getArg(0);
    state.marks[key] = state.line;
    return;
  }

  if (cmd === "jump") {
    const key = getArg(0);
    if (state.marks[key] !== undefined) {
      state.line = state.marks[key];
    }
    return;
  }

  if (cmd === "if") {
    const left = getArg(0);
    const right = getArg(1);
    state.lastTest = left === right;
    if (!state.lastTest) {
      state.line += 1;
    }
    return;
  }

  if (cmd === "jumpif") {
    const key = getArg(0);
    const left = getArg(1);
    const right = getArg(2);
    if (left === right && state.marks[key] !== undefined) {
      state.line = state.marks[key];
    }
  }
};

const runBoxedCode = (text, options = {}) => {
  const code = Array.isArray(text) ? text : makeCodeFrom(text);
  const state = {
    boxes: {},
    marks: {},
    line: 0,
    lastTest: false,
  };
  const outputLines = [];

  while (state.line < code.length) {
    const instruction = code[state.line];
    handleCommand(state, instruction, outputLines, options.inputProvider);
    state.line += 1;
  }

  return outputLines;
};

export { pullCmdFrom, makeCodeFrom, mk, undoMk, runBoxedCode };
