# ESPHome LVGL Visual Designer

A browser-based visual UI designer for [ESPHome](https://esphome.io) LVGL displays. Design your ESP32 touchscreen interfaces visually and export production-ready YAML.

![ESPHome LVGL Designer](https://img.shields.io/badge/ESPHome-LVGL_Designer-blue?style=flat-square)

## Features

- **Visual Canvas** — Pixel-accurate preview matching real display resolutions (240×320 through 800×480)
- **11 LVGL Widget Types** — Container, Label, Button, Button Matrix, Arc, Bar, Switch, Slider, Checkbox, Spinner, Dropdown
- **Flex Layout Engine** — Full ESPHome flex layout support: `flex_flow`, `flex_align_main`, `flex_align_cross`, `flex_grow`, pad_row/pad_column
- **Title Bar** — Per-page configurable header with text, colors, and height
- **Navigation Footer** — `top_layer` buttonmatrix matching the ESPHome cookbook pattern (prev/home/next)
- **Theme System** — Global theme for button/label/buttonmatrix mapping directly to ESPHome's `theme:` block
- **Style Definitions** — Reusable style definitions for consistent styling
- **Button Matrix Editor** — Full row/button management with item styling
- **Drag & Drop** — Click to select, drag to reposition, arrow keys to nudge
- **Multi-Page Support** — Add/remove/configure multiple display pages
- **YAML Export** — Generates valid ESPHome LVGL YAML ready to paste into your config

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Build for Production

```bash
npm run build
```

Static files will be in `dist/` — deploy to any web server, GitHub Pages, Netlify, etc.

## Usage

1. Select your display resolution from the top bar
2. Add widgets from the **Toolbox** (left panel)
3. Click widgets on the canvas to select, drag to move
4. Edit properties in the **Properties** panel (right)
5. Configure page settings, title bars, and layouts in the **Page** tab
6. Set up your color theme in the **Theme** tab (left panel)
7. Click **YAML** to export your configuration

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow keys | Nudge selected widget 1px |
| Shift + Arrow | Nudge 10px |
| Delete / Backspace | Remove selected widget |

## Target Platforms

Designed for ESPHome displays including:
- **ST7789V** (240×320) — CYD, generic SPI displays
- **ILI9341** (320×240)
- **ILI9488** (480×320)
- **800×480** panels (Waveshare, Guition, etc.)

## License

MIT
