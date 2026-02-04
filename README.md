# slopOS

A browser-based web OS experience built for GitHub Pages.

## GitHub Pages

1. Push this repo to GitHub.
2. In **Settings → Pages**, choose **Deploy from a branch** and select the `main` branch with `/root`.
3. Save and open the published URL.

## Local preview

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.

## BoxedLang

slopOS ships with a tiny scripting language called **BoxedLang** for demos and
automation. Scripts are stored in the virtual filesystem and use this format:

```
<cmd> <arg1>|<arg2>|...
```

### Example

```
box name|slopOS
say Welcome~to~$name
```

### Commands

- `box <name>|<value>`: Store a value in a box.
- `say <message>`: Print a line (`~` becomes a space).
- `ask <box>|<prompt>`: Prompt for input and store the response.
- `del <box>`: Remove a stored value.
- `test <left>|<right>`: Compare values.
- `math <box>|<left>|<op>|<right>`: Basic math (`+`, `-`, `*`, `/`).
- `wait <ms>`: Placeholder for delays.
- `mark <name>` / `jump <name>`: Labels and jumps.
- `if <left>|<right>`: Skip the next line if the values do not match.
- `jumpif <mark>|<left>|<right>`: Jump to a mark when values match.

### Running scripts

- **Terminal:** `boxed <filename>` runs a `.box` file from the virtual filesystem.
- **Files app:** select a `.box` file and press **Run** to see the output.
