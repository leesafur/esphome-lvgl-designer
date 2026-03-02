# CLAUDE.md — ESPHome LVGL Visual Designer

## Project Overview
A single-page React/Vite app that lets users visually design LVGL UIs for ESPHome-based ESP32 touchscreen devices. The entire app lives in one file: `src/LVGLDesigner.jsx`.

## Tech Stack
- **React 18** + **Vite 6**
- **js-yaml** — for parsing YAML back into designer state
- No other runtime dependencies
- Deployed to **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`)
- Live URL: `https://leesafur.github.io/esphome-lvgl-designer/`

## Key Architecture

### Single-file design
Everything is in `src/LVGLDesigner.jsx` (~1000 lines). Sections are clearly marked with `// ===` banners:
- Widget definitions & defaults (`WIDGET_DEFS`)
- Flex layout engine (`computeFlexPositions`)
- SVG widget renderer (`RenderWidget`)
- YAML generator (`generateYaml`)
- YAML → state importer (`yamlToState`, `parseYamlWidget`, `fromHex`)
- UI panels (`Toolbox`, `ElementTree`, `PropertyEditor`)
- Main app (`LVGLDesigner`)

### State shape
```js
{
  displaySize: { w, h },       // canvas resolution
  scale: number,               // preview scale multiplier
  theme: { button, label, buttonmatrix },
  styleDefinitions: [...],
  navFooter: { enabled, buttons: [...] },
  pages: [{ id, name, bgColor, layout_type, titleBar, widgets: [...] }],
  selectedPage: number,
  selectedWidget: uid | null,
}
```

### Widget shape
```js
{
  uid: string,        // internal key (never in YAML)
  type: string,       // 'label', 'button', 'buttonmatrix', 'obj', etc.
  id: string,         // ESPHome id (goes in YAML)
  x, y, width, height,
  flex_grow: number,
  // type-specific props: bg_color, text, value, rows, children, etc.
}
```

### Buttonmatrix buttons (per-button colors)
Each button in `rows` can have optional overrides:
```js
{ id, text, bg_color?, text_color?, border_color? }
```
When set, `generateYaml` auto-creates a `style_definitions` entry (e.g. `b1_style`) and adds `styles: b1_style` to that button in the YAML.

## Color conventions
- **Internal state**: `#RRGGBB` hex strings
- **YAML output**: `0xRRGGBB` (via `toHex()`)
- **YAML input**: `0xRRGGBB` numbers/strings → converted back with `fromHex()`

## Save / Load / Autosave
- **Autosave**: `useEffect` writes full state to `localStorage` on every change
- **Load on startup**: `useState` initializer reads from `localStorage`
- **💾 Save**: exports `lvgl-design.json` (full state as JSON)
- **📂 Load**: imports a `lvgl-design.json` file and replaces state

## YAML → Canvas ("Apply to Canvas")
- Uses `js-yaml` to parse the textarea content
- `yamlToState()` reconstructs pages, widgets, and theme from parsed YAML
- Best-effort: widget positions/colors/properties round-trip cleanly
- Title bars appear as plain `obj` widgets after import (they're embedded in YAML that way)
- Nav footer and display size are preserved from current state (not encoded in YAML body)

## Git / Deployment
- Branch: `main`
- Push to `main` → GitHub Actions builds → deploys to GitHub Pages automatically
- Git identity configured locally: `leesafur` / `leesafur@users.noreply.github.com`
- Vite base path: `/esphome-lvgl-designer/` (required for GitHub Pages asset paths)

## Common Tasks

### Run locally
```bash
npm install
npm run dev
# opens at http://localhost:5173
```

### Add a new widget type
1. Add entry to `WIDGET_DEFS` with `label`, `icon`, and `defaults`
2. Add a `case` in `RenderWidget` for SVG preview
3. Add property fields in `PropertyEditor` (find the right `T === "..."` block)
4. Handle YAML output in `writeWidget` (add to `skipKeys` if handled specially)
5. Handle YAML import in `parseYamlWidget` if needed

### Add a new property to buttonmatrix buttons
Same pattern as per-button colors:
1. Add color picker (or input) in the row editor in `PropertyEditor`
2. Use `btn.new_prop || w.items_fallback` in `RenderWidget` SVG render
3. Add to the auto-style collection condition in `generateYaml` pre-pass
4. Add to the `allStyles` map in `generateYaml`
5. Update the `styles:` reference condition in rows YAML output

## Known Limitations
- YAML round-trip loses title bar (imports as obj widget)
- Display size is not encoded in YAML (comment only), not restored on Apply
- No undo/redo
- No z-order control for widgets
