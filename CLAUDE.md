# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A single-page React/Vite app that lets users visually design LVGL UIs for ESPHome-based ESP32 touchscreen devices. The entire app lives in one file: `src/LVGLDesigner.jsx`.

**Tech Stack:** React 18, Vite 6, js-yaml (no other runtime dependencies)

**Live URL:** `https://leesafur.github.io/esphome-lvgl-designer/`

## Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

No test runner or linter is configured.

## Architecture

### Single-file design

Everything is in `src/LVGLDesigner.jsx`. Sections are marked with `// ===` banners:
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
  displaySize: { w, h },       // canvas resolution (one of DISPLAY_PRESETS)
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
  children: [...],    // nested widgets (recursive)
  // type-specific props: bg_color, text, value, rows, etc.
}
```

### Flex layout engine

`computeFlexPositions(container, children, scale)` recalculates child positions when a container uses `layout_type: "flex"`. Supports `flex_flow`, `flex_align_main`, `flex_align_cross`, `flex_grow`, `pad_row`, `pad_column`. Runs on every render.

### Three-panel layout

| Panel | Width | Contents |
|-------|-------|----------|
| Left sidebar | 220px | Tabs: Toolbox (add widgets) / Elements (widget tree) / Theme (global colors, nav footer) |
| Center canvas | flex | SVG canvas with display frame, title bar, widgets, nav footer |
| Right sidebar | 260px | Tabs: Properties (selected widget) / Page (page settings, title bar) |

### Buttonmatrix per-button colors

Each button in `rows` can have optional overrides:
```js
{ id, text, bg_color?, text_color?, border_color? }
```
When set, `generateYaml` auto-creates a `style_definitions` entry (e.g. `b1_style`) and adds `styles: b1_style` to that button in the YAML.

## Color Conventions

- **Internal state**: `#RRGGBB` hex strings
- **YAML output**: `0xRRGGBB` (via `toHex()`)
- **YAML input**: `0xRRGGBB` numbers/strings → converted back with `fromHex()`

## Save / Load / Autosave

- **Autosave**: `useEffect` writes full state to `localStorage` on every change
- **Load on startup**: `useState` initializer reads from `localStorage`
- **Save button**: exports `lvgl-design.json` (full state as JSON)
- **Load button**: imports a `lvgl-design.json` and replaces state

## YAML → Canvas ("Apply to Canvas")

- Uses `js-yaml` to parse the textarea content
- `yamlToState()` reconstructs pages, widgets, and theme from parsed YAML
- Best-effort: widget positions/colors/properties round-trip cleanly
- Title bars appear as plain `obj` widgets after import
- Nav footer and display size are preserved from current state (not encoded in YAML body)

## Git / Deployment

- Branch: `main`
- Push to `main` → GitHub Actions builds → deploys to GitHub Pages automatically
- Vite base path: `/esphome-lvgl-designer/` (required for GitHub Pages asset paths)

## Common Tasks

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

- YAML round-trip loses title bar (imports as `obj` widget)
- Display size is not encoded in YAML (comment only), not restored on Apply
- No undo/redo
- No z-order control for widgets
