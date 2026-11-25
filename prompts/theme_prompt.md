I use a local app with a web interface (HTML, CSS and JavaScript, no frameworks). All of its colors are defined in ONE file, `web/themes.css`, as CSS variables inside blocks like `html[data-theme="dark"] { ... }`. The list of themes shown in Settings is in `web/themes.js`.

I will paste the current contents of both files below. Change the look as I describe, and give me back the COMPLETE new contents of both files (even if `themes.js` is unchanged), each in its own code block.

# What I want
[DESCRIBE THE LOOK: e.g. "a warm, cozy dark theme like a fireplace, less blue", "high contrast for tired eyes", "pastel light theme", "make syntax colors like Solarized", "add a third theme called Forest"]

# Rules
1. Do not rename, remove or add variables inside an existing theme block. Every theme block must define the same set of variables. Only change the values (hex colors).
2. To add a theme, copy a whole block, change the name in `data-theme="..."`, and add `["name", "Label"]` to the `THEMES` list in `web/themes.js`. The first entry is the default.
3. Keep text readable: `--ink` on `--bg`, `--panel` and `--side` must have a contrast ratio of at least 7:1 for dark themes and 7:1 for light themes; `--mute` at least 4.5:1; `--accent-ink` on `--accent` at least 4.5:1; each syntax color (`--t-*`) on `--code-bg` at least 4.5:1, except comments (`--t-c`) at least 3.5:1.
4. Avoid pure white (`#ffffff`) and pure black (`#000000`), and avoid very saturated colors. Prefer soft, slightly muted tones that are easy on the eyes for hours of reading.
5. Light themes must not be glaring: backgrounds should be tinted (for example warm gray or soft cream), not white.
6. Variable meanings are written in the comments of the dark block; follow them. `--on-ok` is the text color placed on top of `--ok`. `--rail*` is the narrow icon bar; it may be darker than the rest even in a light theme.
7. Only colors may change. Do not touch any other file, add fonts, or add images.

# Current files
`web/themes.css`:
```css
[PASTE THE WHOLE FILE]
```

`web/themes.js`:
```js
[PASTE THE WHOLE FILE]
```
