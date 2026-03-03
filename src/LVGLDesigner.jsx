import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import * as jsyaml from "js-yaml";

// ================================================================
// ESPHome LVGL Visual Designer
// Features: Flex layout, Title bars, Nav footer, Theme/styles,
//           Buttonmatrix, Widget toolbox, YAML export
// ================================================================

const uid = () => "w" + Math.random().toString(36).slice(2, 9);

// ---- Display presets ----
const DISPLAY_PRESETS = [
  { label: "240×320", w: 240, h: 320 },
  { label: "320×240", w: 320, h: 240 },
  { label: "320×480", w: 320, h: 480 },
  { label: "480×320", w: 480, h: 320 },
  { label: "480×272", w: 480, h: 272 },
  { label: "800×480", w: 800, h: 480 },
];

const FONTS = ["montserrat_10","montserrat_12","montserrat_14","montserrat_16","montserrat_18","montserrat_20","montserrat_22","montserrat_24","montserrat_28","montserrat_36"];
const FONT_SIZES = { montserrat_10:10, montserrat_12:12, montserrat_14:14, montserrat_16:16, montserrat_18:18, montserrat_20:20, montserrat_22:22, montserrat_24:24, montserrat_28:28, montserrat_36:36 };

const ALIGN_OPTIONS = ["top_left","top_mid","top_right","left_mid","center","right_mid","bottom_left","bottom_mid","bottom_right"];
const FLEX_FLOWS = ["row","column","row_wrap","column_wrap","row_reverse","column_reverse"];
const FLEX_ALIGNS = ["start","end","center","space_evenly","space_around","space_between"];
const FLEX_CROSS = ["start","end","center","stretch"];

// ---- Widget definitions ----
const WIDGET_DEFS = {
  obj: { label: "Container", icon: "☐", defaults: { width: 200, height: 100, bg_color: "#1a1a2e", bg_opa: "cover", border_width: 1, border_color: "#334466", radius: 0, pad_all: 4, layout_type: "none" }},
  label: { label: "Label", icon: "A", defaults: { text: "Label", text_font: "montserrat_14", text_align: "left", width: 0, height: 0 }},
  button: { label: "Button", icon: "⬜", defaults: { width: 100, height: 40, border_width: 2, text: "Button", text_font: "montserrat_14" }},
  buttonmatrix: { label: "Button Matrix", icon: "⊞", defaults: { width: 220, height: 80, border_width: 0, pad_all: 4, pad_column: 4, pad_row: 4, items_border_width: 1, items_radius: 4, items_text_font: "montserrat_12", rows: [[{text:"Btn1",id:"b1"},{text:"Btn2",id:"b2"},{text:"Btn3",id:"b3"}]] }},
  arc: { label: "Arc", icon: "◔", defaults: { width: 120, height: 120, value: 70, min_value: 0, max_value: 100, start_angle: 135, end_angle: 45, arc_color: "#4a90d0", arc_width: 10, indicator_color: "#80c0ff", indicator_width: 10, bg_opa: "transp" }},
  bar: { label: "Bar", icon: "▬", defaults: { width: 180, height: 20, value: 60, min_value: 0, max_value: 100, bg_color: "#333355", indicator_color: "#4a90d0", radius: 4 }},
  switch: { label: "Switch", icon: "⊘", defaults: { width: 50, height: 26, checked: false, bg_color: "#555577", indicator_color: "#4a90d0" }},
  slider: { label: "Slider", icon: "⊶", defaults: { width: 180, height: 20, value: 50, min_value: 0, max_value: 100, bg_color: "#333355", indicator_color: "#4a90d0", knob_color: "#ffffff" }},
  checkbox: { label: "Checkbox", icon: "☑", defaults: { text: "Check me", checked: false, text_color: "#ffffff", text_font: "montserrat_14", indicator_color: "#4a90d0" }},
  spinner: { label: "Spinner", icon: "⟳", defaults: { width: 60, height: 60, arc_color: "#4a90d0", arc_width: 6 }},
  dropdown: { label: "Dropdown", icon: "▾", defaults: { width: 140, height: 36, options: "Option 1\\nOption 2\\nOption 3", bg_color: "#2a2a4a", border_color: "#4a90d0", border_width: 1, text_color: "#ffffff", text_font: "montserrat_14", radius: 4 }},
};

// ---- Default state ----
function createDefaultState() {
  return {
    displaySize: { w: 240, h: 320 },
    scale: 2,
    theme: {
      button: { bg_color: "#2f8cd8", bg_grad_color: "#005782", border_color: "#0077b3", border_width: 1, text_color: "#ffffff", radius: 6 },
      label: { text_color: "#ffffff" },
      buttonmatrix: { bg_opa: "transp", border_width: 0, text_color: "#ffffff", items_bg_color: "#2f8cd8", items_bg_grad_color: "#005782", items_border_color: "#0077b3", items_border_width: 1, items_text_color: "#ffffff" },
    },
    styleDefinitions: [
      { id: "header_footer", bg_color: "#2f8cd8", bg_grad_color: "#005782", bg_grad_dir: "VER", bg_opa: "COVER", border_opa: "TRANSP", border_color: "#0077b3", text_color: "#ffffff", radius: 0, pad_all: 0, pad_row: 0, pad_column: 0, height: 30, width: "100%" },
    ],
    navFooter: { enabled: true, buttons: [
      { id: "page_prev", text: "◀", action: "lvgl.page.previous" },
      { id: "page_home", text: "⌂", action: "lvgl.page.show: main_page" },
      { id: "page_next", text: "▶", action: "lvgl.page.next" },
    ]},
    pages: [
      { id: "main_page", name: "Main", bgColor: "#000000", layout_type: "none", titleBar: { enabled: true, text: "⚓ BOAT LIGHTING ⚓", bg_color: "#16213e", text_color: "#ffffff", height: 36 }, widgets: [] },
    ],
    selectedPage: 0,
    selectedWidget: null,
  };
}

// ---- Flex layout engine ----
function computeFlexPositions(container, children, scale) {
  const lt = container.layout_type || "none";
  if (lt === "none" || !children.length) return children.map(c => ({ ...c }));

  const isRow = lt === "flex" && (container.flex_flow || "row").startsWith("row");
  const flow = container.flex_flow || "row";
  const padAll = (container.pad_all || 0);
  const gapMain = isRow ? (container.pad_column || padAll) : (container.pad_row || padAll);
  const gapCross = isRow ? (container.pad_row || padAll) : (container.pad_column || padAll);
  const cw = container.width || 200;
  const ch = container.height || 100;
  const alignMain = container.flex_align_main || "start";
  const alignCross = container.flex_align_cross || "start";

  const mainTotal = isRow ? cw - 2 * padAll : ch - 2 * padAll;
  const crossTotal = isRow ? ch - 2 * padAll : cw - 2 * padAll;

  // Measure children
  let fixedSum = 0, growSum = 0;
  const measured = children.map(c => {
    const mainSz = isRow ? (c.width || 40) : (c.height || 30);
    const crossSz = isRow ? (c.height || 30) : (c.width || 40);
    const grow = c.flex_grow || 0;
    if (grow > 0) growSum += grow; else fixedSum += mainSz;
    return { ...c, _mainSz: mainSz, _crossSz: crossSz, _grow: grow };
  });
  const totalGaps = Math.max(0, children.length - 1) * gapMain;
  const freeSpace = Math.max(0, mainTotal - fixedSum - totalGaps);

  // Assign sizes for flex_grow items
  measured.forEach(c => { if (c._grow > 0) c._mainSz = freeSpace * c._grow / growSum; });

  // Compute positions along main axis
  let pos = padAll;
  const usedSpace = measured.reduce((s, c) => s + c._mainSz, 0) + totalGaps;
  if (alignMain === "center") pos = padAll + (mainTotal - usedSpace) / 2;
  else if (alignMain === "end") pos = padAll + mainTotal - usedSpace;
  else if (alignMain === "space_between" && children.length > 1) {
    const spacing = (mainTotal - measured.reduce((s, c) => s + c._mainSz, 0)) / (children.length - 1);
    return measured.map((c, i) => {
      const mp = padAll + measured.slice(0, i).reduce((s, m) => s + m._mainSz, 0) + i * spacing;
      const cp = alignCross === "center" ? padAll + (crossTotal - c._crossSz) / 2 : alignCross === "end" ? padAll + crossTotal - c._crossSz : padAll;
      return { ...c, _cx: isRow ? mp : cp, _cy: isRow ? cp : mp };
    });
  } else if (alignMain === "space_evenly") {
    const spacing = (mainTotal - measured.reduce((s, c) => s + c._mainSz, 0)) / (children.length + 1);
    return measured.map((c, i) => {
      const mp = padAll + (i + 1) * spacing + measured.slice(0, i).reduce((s, m) => s + m._mainSz, 0);
      const cp = alignCross === "center" ? padAll + (crossTotal - c._crossSz) / 2 : alignCross === "end" ? padAll + crossTotal - c._crossSz : padAll;
      return { ...c, _cx: isRow ? mp : cp, _cy: isRow ? cp : mp };
    });
  }

  return measured.map(c => {
    const mp = pos;
    pos += c._mainSz + gapMain;
    const stretch = alignCross === "stretch";
    const cSz = stretch ? crossTotal : c._crossSz;
    const cp = alignCross === "center" ? padAll + (crossTotal - cSz) / 2 : alignCross === "end" ? padAll + crossTotal - cSz : padAll;
    return { ...c, _cx: isRow ? mp : cp, _cy: isRow ? cp : mp, ...(stretch && isRow ? { height: cSz } : stretch ? { width: cSz } : {}) };
  });
}

// ================================================================
// SVG WIDGET RENDERERS
// ================================================================
function RenderWidget({ w, s, theme, isSelected, onSelect, onDragStart, parentX = 0, parentY = 0, useFlex, flexX, flexY }) {
  const x = (useFlex ? flexX : (w.x || 0)) * s + parentX;
  const y = (useFlex ? flexY : (w.y || 0)) * s + parentY;
  const ww = (w.width || 0) * s;
  const hh = (w.height || 0) * s;
  const fs = FONT_SIZES[w.text_font || "montserrat_14"] || 14;

  const handleMouseDown = (e) => {
    e.stopPropagation();
    onSelect(w.uid);
    if (onDragStart) onDragStart(e, w.uid);
  };

  const sel = isSelected ? <rect x={x-2} y={y-2} width={ww+4} height={hh+4} fill="none" stroke="#00ff88" strokeWidth={2} strokeDasharray="5 3" rx={4}/> : null;

  switch (w.type) {
    case "label": {
      const tw = ww || 200 * s;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel && <rect x={x-2} y={y-2} width={tw+4} height={fs*s+6} fill="none" stroke="#00ff88" strokeWidth={2} strokeDasharray="5 3"/>}
        <text x={x} y={y + 2} fill={w.text_color || theme?.label?.text_color || "#fff"} fontSize={fs * s} fontFamily="sans-serif" dominantBaseline="hanging">{w.text || "Label"}</text>
      </g>;
    }
    case "button": {
      const tc = w.text_color || theme?.button?.text_color || "#fff";
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <rect x={x} y={y} width={ww} height={hh} rx={(w.radius ?? theme?.button?.radius ?? 6)*s} fill={w.bg_color || theme?.button?.bg_color || "#2f8cd8"} stroke={w.border_color || theme?.button?.border_color || "#0077b3"} strokeWidth={(w.border_width??2)*s}/>
        <text x={x+ww/2} y={y+hh/2} fill={tc} fontSize={fs*s} fontFamily="sans-serif" textAnchor="middle" dominantBaseline="central" fontWeight="500">{w.text||"Button"}</text>
      </g>;
    }
    case "obj": {
      const bg = w.bg_opa === "transp" ? "transparent" : (w.bg_color || "#1a1a2e");
      const children = w.children || [];
      const isFlexContainer = w.layout_type === "flex";
      const laid = isFlexContainer ? computeFlexPositions(w, children, s) : children;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <rect x={x} y={y} width={ww} height={hh} rx={(w.radius||0)*s} fill={bg} stroke={w.border_color||"#334"} strokeWidth={(w.border_width||0)*s} strokeOpacity={w.border_width?1:0}/>
        {laid.map((c, i) => <RenderWidget key={c.uid} w={c} s={s} theme={theme} isSelected={false} onSelect={onSelect} parentX={x} parentY={y} useFlex={isFlexContainer} flexX={c._cx||0} flexY={c._cy||0}/>)}
      </g>;
    }
    case "buttonmatrix": {
      const rows = w.rows || [[]];
      const padA = (w.pad_all || 4);
      const padC = (w.pad_column || w.pad_all || 4);
      const padR = (w.pad_row || w.pad_all || 4);
      const innerW = (w.width || 220) - 2 * padA;
      const rowH = ((w.height || 80) - 2 * padA - (rows.length - 1) * padR) / rows.length;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <rect x={x} y={y} width={ww} height={hh} rx={(w.radius||0)*s} fill={w.bg_color||"#1a1a2e"}/>
        {rows.map((row, ri) => {
          const btnW = (innerW - (row.length - 1) * padC) / row.length;
          return row.map((btn, bi) => {
            const bx = x + (padA + bi * (btnW + padC)) * s;
            const by = y + (padA + ri * (rowH + padR)) * s;
            return <g key={`${ri}-${bi}`}>
              <rect x={bx} y={by} width={btnW*s} height={rowH*s} rx={(w.items_radius||4)*s} fill={btn.bg_color||w.items_bg_color||theme?.buttonmatrix?.items_bg_color||"#2f8cd8"} stroke={btn.border_color||w.items_border_color||theme?.buttonmatrix?.items_border_color||"#0077b3"} strokeWidth={(w.items_border_width||1)*s}/>
              <text x={bx+btnW*s/2} y={by+rowH*s/2} fill={btn.text_color||w.items_text_color||theme?.buttonmatrix?.items_text_color||"#fff"} fontSize={(FONT_SIZES[w.items_text_font||"montserrat_12"]||12)*s} fontFamily="sans-serif" textAnchor="middle" dominantBaseline="central">{btn.text||"Btn"}</text>
            </g>;
          });
        })}
      </g>;
    }
    case "arc": {
      const cx = x + ww / 2, cy = y + hh / 2;
      const r = Math.min(ww, hh) / 2 - (w.arc_width || 10) * s;
      const sa = (w.start_angle || 135);
      const ea = (w.end_angle || 45);
      const sweep = ea <= sa ? (360 - sa + ea) : (ea - sa);
      const valSweep = ((w.value || 0) - (w.min_value || 0)) / ((w.max_value || 100) - (w.min_value || 0)) * sweep;
      const arcP = (a, rad) => { const rr = a * Math.PI / 180; return { x: cx + rad * Math.cos(rr), y: cy + rad * Math.sin(rr) }; };
      const mkArc = (start, sw, rad) => { const s1 = arcP(start, rad), e1 = arcP(start + sw, rad); return `M${s1.x},${s1.y} A${rad},${rad} 0 ${sw>180?1:0} 1 ${e1.x},${e1.y}`; };
      const aw = (w.arc_width || 10) * s;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <circle cx={cx} cy={cy} r={ww/2} fill="transparent"/>
        <path d={mkArc(sa, sweep, r)} fill="none" stroke={w.arc_color||"#4a90d0"} strokeWidth={aw} strokeLinecap="round"/>
        {valSweep > 0 && <path d={mkArc(sa, valSweep, r)} fill="none" stroke={w.indicator_color||"#80c0ff"} strokeWidth={aw} strokeLinecap="round"/>}
        <text x={cx} y={cy} fill="#fff" fontSize={16*s} fontFamily="sans-serif" textAnchor="middle" dominantBaseline="central" fontWeight="700">{w.value||0}%</text>
      </g>;
    }
    case "bar": {
      const pct = ((w.value||0)-(w.min_value||0))/((w.max_value||100)-(w.min_value||0));
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <rect x={x} y={y} width={ww} height={hh} rx={(w.radius||4)*s} fill={w.bg_color||"#333"}/>
        <rect x={x} y={y} width={ww*pct} height={hh} rx={(w.radius||4)*s} fill={w.indicator_color||"#4a90d0"}/>
      </g>;
    }
    case "switch": {
      const on = w.checked;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <rect x={x} y={y} width={ww} height={hh} rx={hh/2} fill={on?w.indicator_color||"#4a90d0":w.bg_color||"#555"}/>
        <circle cx={on?x+ww-hh/2:x+hh/2} cy={y+hh/2} r={hh/2-3*s} fill="#fff"/>
      </g>;
    }
    case "slider": {
      const pct = ((w.value||0)-(w.min_value||0))/((w.max_value||100)-(w.min_value||0));
      const knobX = x + ww * pct;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <rect x={x} y={y+hh*0.3} width={ww} height={hh*0.4} rx={hh*0.2} fill={w.bg_color||"#333"}/>
        <rect x={x} y={y+hh*0.3} width={ww*pct} height={hh*0.4} rx={hh*0.2} fill={w.indicator_color||"#4a90d0"}/>
        <circle cx={knobX} cy={y+hh/2} r={hh*0.45} fill={w.knob_color||"#fff"} stroke="#888" strokeWidth={s}/>
      </g>;
    }
    case "checkbox": {
      const sz = (FONT_SIZES[w.text_font||"montserrat_14"]||14) * s;
      const boxSz = sz * 1.2;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel && <rect x={x-2} y={y-2} width={boxSz+(w.text?.length||4)*sz*0.6+8} height={boxSz+4} fill="none" stroke="#00ff88" strokeWidth={2} strokeDasharray="5 3"/>}
        <rect x={x} y={y} width={boxSz} height={boxSz} rx={3*s} fill={w.checked?w.indicator_color||"#4a90d0":"#333"} stroke="#666" strokeWidth={s}/>
        {w.checked && <text x={x+boxSz/2} y={y+boxSz/2} fill="#fff" fontSize={boxSz*0.7} textAnchor="middle" dominantBaseline="central">✓</text>}
        <text x={x+boxSz+6*s} y={y+boxSz/2} fill={w.text_color||"#fff"} fontSize={sz} fontFamily="sans-serif" dominantBaseline="central">{w.text||"Checkbox"}</text>
      </g>;
    }
    case "spinner": {
      const cx2=x+ww/2, cy2=y+hh/2, r2=Math.min(ww,hh)/2-(w.arc_width||6)*s;
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke="#333" strokeWidth={(w.arc_width||6)*s}/>
        <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke={w.arc_color||"#4a90d0"} strokeWidth={(w.arc_width||6)*s} strokeDasharray={`${r2*1.2} ${r2*4}`} strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from={`0 ${cx2} ${cy2}`} to={`360 ${cx2} ${cy2}`} dur="1s" repeatCount="indefinite"/>
        </circle>
      </g>;
    }
    case "dropdown": {
      const opts = (w.options||"").split("\\n");
      return <g onMouseDown={handleMouseDown} style={{cursor:"pointer"}}>
        {sel}
        <rect x={x} y={y} width={ww} height={hh} rx={(w.radius||4)*s} fill={w.bg_color||"#2a2a4a"} stroke={w.border_color||"#4a90d0"} strokeWidth={(w.border_width||1)*s}/>
        <text x={x+8*s} y={y+hh/2} fill={w.text_color||"#fff"} fontSize={fs*s} fontFamily="sans-serif" dominantBaseline="central">{opts[0]||"Select"}</text>
        <text x={x+ww-14*s} y={y+hh/2} fill={w.text_color||"#fff"} fontSize={fs*s} fontFamily="sans-serif" dominantBaseline="central">▼</text>
      </g>;
    }
    default: return null;
  }
}

// ================================================================
// YAML GENERATOR
// ================================================================
function toHex(c) { return c ? "0x" + c.replace("#","").toUpperCase() : "0x000000"; }
function indent(n) { return "  ".repeat(n); }

function generateYaml(state) {
  const { theme, styleDefinitions, navFooter, pages, displaySize } = state;
  let y = "";
  y += `# ESPHome LVGL Configuration\n# Generated by LVGL Visual Designer\n# Display: ${displaySize.w}×${displaySize.h}\n\n`;
  y += `lvgl:\n`;
  y += `${indent(1)}log_level: WARN\n`;
  y += `${indent(1)}color_depth: 16\n`;
  y += `${indent(1)}displays:\n${indent(2)}- my_display\n`;
  y += `${indent(1)}touchscreens:\n${indent(2)}- my_touchscreen\n\n`;

  // Theme
  y += `${indent(1)}theme:\n`;
  if (theme.button) {
    y += `${indent(2)}button:\n`;
    Object.entries(theme.button).forEach(([k,v]) => { if(v) y += `${indent(3)}${k}: ${k.includes("color")?toHex(v):v}\n`; });
  }
  if (theme.label) {
    y += `${indent(2)}label:\n`;
    Object.entries(theme.label).forEach(([k,v]) => { if(v) y += `${indent(3)}${k}: ${k.includes("color")?toHex(v):v}\n`; });
  }
  if (theme.buttonmatrix) {
    y += `${indent(2)}buttonmatrix:\n`;
    const bm = theme.buttonmatrix;
    Object.entries(bm).forEach(([k,v]) => {
      if(!k.startsWith("items_") && v !== undefined && v !== "") y += `${indent(3)}${k}: ${k.includes("color")?toHex(v):v}\n`;
    });
    const itemKeys = Object.entries(bm).filter(([k])=>k.startsWith("items_"));
    if (itemKeys.length) {
      y += `${indent(3)}items:\n`;
      itemKeys.forEach(([k,v]) => { if(v!==undefined&&v!=="") y += `${indent(4)}${k.replace("items_","")}: ${k.includes("color")?toHex(v):v}\n`; });
    }
  }
  y += "\n";

  // Collect auto style definitions for per-button colors
  const autoButtonStyles = [];
  pages.forEach(page => {
    const collect = (widgets) => widgets.forEach(w => {
      if (w.type === "buttonmatrix" && w.rows) {
        w.rows.forEach(row => row.forEach(btn => {
          if (btn.bg_color || btn.text_color || btn.border_color) autoButtonStyles.push(btn);
        }));
      }
      if (w.children?.length) collect(w.children);
    });
    collect(page.widgets);
  });

  // Style definitions
  const allStyles = [...styleDefinitions, ...autoButtonStyles.map(btn => ({ id: `${btn.id}_style`, ...(btn.bg_color ? { bg_color: btn.bg_color } : {}), ...(btn.text_color ? { text_color: btn.text_color } : {}), ...(btn.border_color ? { border_color: btn.border_color } : {}) }))];
  if (allStyles.length) {
    y += `${indent(1)}style_definitions:\n`;
    allStyles.forEach(sd => {
      y += `${indent(2)}- id: ${sd.id}\n`;
      Object.entries(sd).forEach(([k,v]) => { if(k!=="id"&&v!==undefined&&v!=="") y += `${indent(3)}${k}: ${k.includes("color")?toHex(v):v}\n`; });
    });
    y += "\n";
  }

  // Top layer (nav footer)
  if (navFooter.enabled) {
    y += `${indent(1)}top_layer:\n${indent(2)}widgets:\n`;
    y += `${indent(3)}- buttonmatrix:\n`;
    y += `${indent(5)}align: bottom_mid\n`;
    y += `${indent(5)}styles: header_footer\n`;
    y += `${indent(5)}outline_width: 0\n`;
    y += `${indent(5)}id: top_layer\n`;
    y += `${indent(5)}items:\n${indent(6)}styles: header_footer\n`;
    y += `${indent(5)}rows:\n${indent(6)}- buttons:\n`;
    navFooter.buttons.forEach(b => {
      y += `${indent(8)}- id: ${b.id}\n`;
      y += `${indent(9)}text: "${b.text}"\n`;
      y += `${indent(9)}on_press:\n${indent(10)}then:\n${indent(11)}${b.action}:\n`;
    });
    y += "\n";
  }

  // Pages
  y += `${indent(1)}pages:\n`;
  pages.forEach(page => {
    y += `${indent(2)}- id: ${page.id}\n`;
    y += `${indent(3)}bg_color: ${toHex(page.bgColor)}\n`;
    if (page.layout_type === "flex") {
      y += `${indent(3)}layout:\n${indent(4)}type: flex\n`;
      if (page.flex_flow) y += `${indent(4)}flex_flow: ${page.flex_flow}\n`;
      if (page.flex_align_main) y += `${indent(4)}flex_align_main: ${page.flex_align_main}\n`;
      if (page.flex_align_cross) y += `${indent(4)}flex_align_cross: ${page.flex_align_cross}\n`;
      if (page.flex_align_track) y += `${indent(4)}flex_align_track: ${page.flex_align_track}\n`;
    }
    y += `${indent(3)}widgets:\n`;

    // Title bar
    if (page.titleBar?.enabled) {
      const tb = page.titleBar;
      y += `${indent(4)}- obj:\n`;
      y += `${indent(6)}x: 0\n${indent(6)}y: 0\n`;
      y += `${indent(6)}width: ${displaySize.w}\n`;
      y += `${indent(6)}height: ${tb.height || 36}\n`;
      y += `${indent(6)}bg_color: ${toHex(tb.bg_color)}\n`;
      y += `${indent(6)}border_width: 0\n${indent(6)}radius: 0\n${indent(6)}pad_all: 0\n`;
      y += `${indent(6)}widgets:\n`;
      y += `${indent(7)}- label:\n`;
      y += `${indent(9)}text: "${tb.text}"\n`;
      y += `${indent(9)}align: center\n`;
      y += `${indent(9)}text_font: montserrat_14\n`;
      y += `${indent(9)}text_color: ${toHex(tb.text_color)}\n`;
    }

    // Widgets
    const writeWidget = (widget, depth) => {
      const d = depth;
      y += `${indent(d)}- ${widget.type}:\n`;
      if (widget.id) y += `${indent(d+2)}id: ${widget.id}\n`;
      const skipKeys = new Set(["uid","type","id","children","rows","_cx","_cy","_mainSz","_crossSz","_grow","text","layout_type","flex_flow","flex_align_main","flex_align_cross","flex_align_track","flex_grow","items_bg_color","items_text_color","items_border_color","items_border_width","items_radius","items_text_font","checked","value","min_value","max_value","start_angle","end_angle","arc_color","arc_width","indicator_color","indicator_width","knob_color","bg_opa","options"]);
      
      // Position
      if (widget.x !== undefined && widget.x !== 0) y += `${indent(d+2)}x: ${widget.x}\n`;
      if (widget.y !== undefined && widget.y !== 0) y += `${indent(d+2)}y: ${widget.y}\n`;
      if (widget.width) y += `${indent(d+2)}width: ${widget.width}\n`;
      if (widget.height) y += `${indent(d+2)}height: ${widget.height}\n`;

      // Layout
      if (widget.layout_type === "flex") {
        y += `${indent(d+2)}layout:\n${indent(d+3)}type: flex\n`;
        if (widget.flex_flow) y += `${indent(d+3)}flex_flow: ${widget.flex_flow}\n`;
        if (widget.flex_align_main) y += `${indent(d+3)}flex_align_main: ${widget.flex_align_main}\n`;
        if (widget.flex_align_cross) y += `${indent(d+3)}flex_align_cross: ${widget.flex_align_cross}\n`;
      }
      if (widget.flex_grow) y += `${indent(d+2)}flex_grow: ${widget.flex_grow}\n`;

      // Style props
      Object.entries(widget).forEach(([k, v]) => {
        if (skipKeys.has(k) || v === undefined || v === "" || v === 0) return;
        if (k.includes("color")) y += `${indent(d+2)}${k}: ${toHex(v)}\n`;
        else y += `${indent(d+2)}${k}: ${v}\n`;
      });

      // Type-specific
      if (widget.text !== undefined) y += `${indent(d+2)}text: "${widget.text}"\n`;
      if (widget.bg_opa) y += `${indent(d+2)}bg_opa: ${widget.bg_opa.toUpperCase()}\n`;
      if (widget.checked !== undefined) y += `${indent(d+2)}checked: ${widget.checked}\n`;
      if (widget.value !== undefined) y += `${indent(d+2)}value: ${widget.value}\n`;
      if (widget.min_value !== undefined) y += `${indent(d+2)}min_value: ${widget.min_value}\n`;
      if (widget.max_value !== undefined) y += `${indent(d+2)}max_value: ${widget.max_value}\n`;
      if (widget.start_angle !== undefined) y += `${indent(d+2)}start_angle: ${widget.start_angle}\n`;
      if (widget.end_angle !== undefined) y += `${indent(d+2)}end_angle: ${widget.end_angle}\n`;
      if (widget.arc_color) y += `${indent(d+2)}arc_color: ${toHex(widget.arc_color)}\n`;
      if (widget.arc_width) y += `${indent(d+2)}arc_width: ${widget.arc_width}\n`;
      if (widget.indicator_color) { y += `${indent(d+2)}indicator:\n${indent(d+3)}arc_color: ${toHex(widget.indicator_color)}\n`; if(widget.indicator_width) y += `${indent(d+3)}arc_width: ${widget.indicator_width}\n`; }
      if (widget.options) y += `${indent(d+2)}options: "${widget.options}"\n`;

      // Buttonmatrix rows
      if (widget.type === "buttonmatrix" && widget.rows) {
        if (widget.items_bg_color) {
          y += `${indent(d+2)}items:\n`;
          if(widget.items_bg_color) y += `${indent(d+3)}bg_color: ${toHex(widget.items_bg_color)}\n`;
          if(widget.items_text_color) y += `${indent(d+3)}text_color: ${toHex(widget.items_text_color)}\n`;
          if(widget.items_border_color) y += `${indent(d+3)}border_color: ${toHex(widget.items_border_color)}\n`;
          if(widget.items_border_width) y += `${indent(d+3)}border_width: ${widget.items_border_width}\n`;
          if(widget.items_radius) y += `${indent(d+3)}radius: ${widget.items_radius}\n`;
        }
        y += `${indent(d+2)}rows:\n`;
        widget.rows.forEach(row => {
          y += `${indent(d+3)}- buttons:\n`;
          row.forEach(btn => {
            y += `${indent(d+5)}- id: ${btn.id || uid()}\n`;
            y += `${indent(d+6)}text: "${btn.text}"\n`;
            if (btn.bg_color || btn.text_color || btn.border_color) y += `${indent(d+6)}styles: ${btn.id}_style\n`;
          });
        });
      }

      // Children
      if (widget.children?.length) {
        y += `${indent(d+2)}widgets:\n`;
        widget.children.forEach(c => writeWidget(c, d + 3));
      }
    };

    page.widgets.forEach(w => writeWidget(w, 4));
    y += "\n";
  });

  return y;
}

// ================================================================
// UI PANELS
// ================================================================

// ---- Toolbox ----
function Toolbox({ onAdd }) {
  return <div style={{ padding: 8 }}>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b8aaf", marginBottom: 8 }}>Widgets</div>
    {Object.entries(WIDGET_DEFS).map(([type, def]) => (
      <button key={type} onClick={() => onAdd(type)} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 8px", marginBottom: 2,
        background: "transparent", border: "1px solid transparent", borderRadius: 4, color: "#c0d0e0",
        cursor: "pointer", fontSize: 12, textAlign: "left", transition: "all 0.15s",
      }} onMouseEnter={e=>{ e.target.style.background="#141e2e"; e.target.style.borderColor="#1e3a5f" }}
         onMouseLeave={e=>{ e.target.style.background="transparent"; e.target.style.borderColor="transparent" }}>
        <span style={{ fontSize: 16, width: 22, textAlign: "center", filter: "brightness(1.3)" }}>{def.icon}</span>
        <span>{def.label}</span>
        <span style={{ marginLeft: "auto", fontSize: 14, color: "#3a6a9a" }}>+</span>
      </button>
    ))}
  </div>;
}

// ---- Element Tree ----
function ElementTree({ widgets, selected, onSelect, onDelete }) {
  const renderItem = (w, depth = 0) => (
    <div key={w.uid}>
      <div onClick={() => onSelect(w.uid)} style={{
        display: "flex", alignItems: "center", gap: 4, padding: "3px 6px", paddingLeft: 6 + depth * 14,
        background: selected === w.uid ? "#1a3050" : "transparent", borderLeft: selected === w.uid ? "2px solid #4a90d0" : "2px solid transparent",
        cursor: "pointer", fontSize: 11, color: selected === w.uid ? "#8ac4ff" : "#8899aa", transition: "all 0.1s",
      }}>
        <span style={{ fontSize: 12 }}>{WIDGET_DEFS[w.type]?.icon || "?"}</span>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.id || w.type}</span>
        <span onClick={(e) => { e.stopPropagation(); onDelete(w.uid); }} style={{ color: "#664444", cursor: "pointer", fontSize: 13, padding: "0 2px" }} title="Delete">×</span>
      </div>
      {w.children?.map(c => renderItem(c, depth + 1))}
    </div>
  );
  return <div style={{ fontSize: 11 }}>{widgets.length ? widgets.map(w => renderItem(w)) : <div style={{ padding: 12, color: "#556", textAlign: "center" }}>No widgets. Add from toolbox.</div>}</div>;
}

// ---- Property Editor ----
function PropField({ label, value, onChange, type = "text", options, step, min, max }) {
  const st = { flex: 1, background: "#0d1520", border: "1px solid #1e3050", borderRadius: 3, padding: "3px 6px", color: "#c0d8f0", fontSize: 11, fontFamily: "monospace" };
  return <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
    <label style={{ width: 90, fontSize: 10, color: "#6b8aaf", textTransform: "lowercase" }}>{label}</label>
    {type === "color" ? <div style={{ display: "flex", gap: 4, flex: 1, alignItems: "center" }}>
      <input type="color" value={value||"#000000"} onChange={e => onChange(e.target.value)} style={{ width: 26, height: 20, border: "1px solid #334", borderRadius: 3, padding: 0, cursor: "pointer" }}/>
      <input type="text" value={value||""} onChange={e => onChange(e.target.value)} style={{ ...st, flex: 1 }}/>
    </div>
    : type === "select" ? <select value={value||""} onChange={e => onChange(e.target.value)} style={{ ...st, cursor: "pointer" }}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
    : type === "checkbox" ? <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} style={{ cursor: "pointer" }}/>
    : <input type={type} value={value??""} onChange={e => onChange(type==="number"?parseFloat(e.target.value)||0:e.target.value)} step={step} min={min} max={max} style={st}/>}
  </div>;
}

function PropertyEditor({ widget, onChange }) {
  if (!widget) return <div style={{ padding: 12, color: "#556", fontSize: 12, textAlign: "center" }}>Select a widget on the canvas or element tree.</div>;
  const up = (k, v) => onChange({ ...widget, [k]: v });
  const T = widget.type;

  return <div style={{ padding: 8, fontSize: 11 }}>
    <div style={{ fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: "#4a90d0", marginBottom: 6 }}>{T} Properties</div>
    <PropField label="ID" value={widget.id} onChange={v => up("id", v)}/>
    
    <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>POSITION & SIZE</div>
    <PropField label="x" value={widget.x} onChange={v => up("x", v)} type="number"/>
    <PropField label="y" value={widget.y} onChange={v => up("y", v)} type="number"/>
    <PropField label="width" value={widget.width} onChange={v => up("width", v)} type="number"/>
    <PropField label="height" value={widget.height} onChange={v => up("height", v)} type="number"/>
    {widget.flex_grow !== undefined && <PropField label="flex_grow" value={widget.flex_grow} onChange={v => up("flex_grow", v)} type="number" min={0}/>}

    {(T === "label" || T === "button" || T === "checkbox" || T === "dropdown") && <>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>TEXT</div>
      <PropField label="text" value={widget.text} onChange={v => up("text", v)}/>
      <PropField label="text_color" value={widget.text_color} onChange={v => up("text_color", v)} type="color"/>
      <PropField label="text_font" value={widget.text_font} onChange={v => up("text_font", v)} type="select" options={FONTS}/>
    </>}

    {(T === "button" || T === "obj" || T === "dropdown" || T === "buttonmatrix") && <>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>BACKGROUND</div>
      <PropField label="bg_color" value={widget.bg_color} onChange={v => up("bg_color", v)} type="color"/>
      {T === "obj" && <PropField label="bg_opa" value={widget.bg_opa} onChange={v => up("bg_opa", v)} type="select" options={["cover","transp","50%"]}/>}
      <PropField label="border_color" value={widget.border_color} onChange={v => up("border_color", v)} type="color"/>
      <PropField label="border_width" value={widget.border_width} onChange={v => up("border_width", v)} type="number"/>
      <PropField label="radius" value={widget.radius} onChange={v => up("radius", v)} type="number"/>
      <PropField label="pad_all" value={widget.pad_all} onChange={v => up("pad_all", v)} type="number"/>
    </>}

    {T === "obj" && <>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>LAYOUT</div>
      <PropField label="layout" value={widget.layout_type} onChange={v => up("layout_type", v)} type="select" options={["none","flex"]}/>
      {widget.layout_type === "flex" && <>
        <PropField label="flex_flow" value={widget.flex_flow} onChange={v => up("flex_flow", v)} type="select" options={FLEX_FLOWS}/>
        <PropField label="align_main" value={widget.flex_align_main} onChange={v => up("flex_align_main", v)} type="select" options={FLEX_ALIGNS}/>
        <PropField label="align_cross" value={widget.flex_align_cross} onChange={v => up("flex_align_cross", v)} type="select" options={FLEX_CROSS}/>
        <PropField label="pad_column" value={widget.pad_column} onChange={v => up("pad_column", v)} type="number"/>
        <PropField label="pad_row" value={widget.pad_row} onChange={v => up("pad_row", v)} type="number"/>
      </>}
    </>}

    {(T === "arc") && <>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>ARC</div>
      <PropField label="value" value={widget.value} onChange={v => up("value", v)} type="number" min={0} max={100}/>
      <PropField label="min_value" value={widget.min_value} onChange={v => up("min_value", v)} type="number"/>
      <PropField label="max_value" value={widget.max_value} onChange={v => up("max_value", v)} type="number"/>
      <PropField label="start_angle" value={widget.start_angle} onChange={v => up("start_angle", v)} type="number"/>
      <PropField label="end_angle" value={widget.end_angle} onChange={v => up("end_angle", v)} type="number"/>
      <PropField label="arc_color" value={widget.arc_color} onChange={v => up("arc_color", v)} type="color"/>
      <PropField label="arc_width" value={widget.arc_width} onChange={v => up("arc_width", v)} type="number"/>
      <PropField label="indicator" value={widget.indicator_color} onChange={v => up("indicator_color", v)} type="color"/>
    </>}

    {(T === "bar" || T === "slider") && <>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>VALUE</div>
      <PropField label="value" value={widget.value} onChange={v => up("value", v)} type="number"/>
      <PropField label="min_value" value={widget.min_value} onChange={v => up("min_value", v)} type="number"/>
      <PropField label="max_value" value={widget.max_value} onChange={v => up("max_value", v)} type="number"/>
      <PropField label="bg_color" value={widget.bg_color} onChange={v => up("bg_color", v)} type="color"/>
      <PropField label="indicator" value={widget.indicator_color} onChange={v => up("indicator_color", v)} type="color"/>
      {T === "slider" && <PropField label="knob_color" value={widget.knob_color} onChange={v => up("knob_color", v)} type="color"/>}
    </>}

    {T === "switch" && <>
      <PropField label="checked" value={widget.checked} onChange={v => up("checked", v)} type="checkbox"/>
      <PropField label="bg_color" value={widget.bg_color} onChange={v => up("bg_color", v)} type="color"/>
      <PropField label="indicator" value={widget.indicator_color} onChange={v => up("indicator_color", v)} type="color"/>
    </>}

    {T === "buttonmatrix" && <>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>BUTTON ITEMS</div>
      <PropField label="items bg" value={widget.items_bg_color} onChange={v => up("items_bg_color", v)} type="color"/>
      <PropField label="items text" value={widget.items_text_color} onChange={v => up("items_text_color", v)} type="color"/>
      <PropField label="items border" value={widget.items_border_color} onChange={v => up("items_border_color", v)} type="color"/>
      <PropField label="items border_w" value={widget.items_border_width} onChange={v => up("items_border_width", v)} type="number"/>
      <PropField label="items radius" value={widget.items_radius} onChange={v => up("items_radius", v)} type="number"/>
      <PropField label="pad_column" value={widget.pad_column} onChange={v => up("pad_column", v)} type="number"/>
      <PropField label="pad_row" value={widget.pad_row} onChange={v => up("pad_row", v)} type="number"/>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 8, marginBottom: 4 }}>ROWS</div>
      {(widget.rows || []).map((row, ri) => (
        <div key={ri} style={{ marginBottom: 6, padding: 4, background: "#0a1018", borderRadius: 4, border: "1px solid #1a2a3a" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#6b8aaf" }}>Row {ri + 1}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { const nr = [...(widget.rows||[])]; nr[ri] = [...nr[ri], { text: "New", id: "b" + uid() }]; up("rows", nr); }} style={{ fontSize: 10, background: "#1a3050", border: "1px solid #2a4a6a", color: "#8ac4ff", borderRadius: 3, padding: "1px 6px", cursor: "pointer" }}>+ Btn</button>
              {(widget.rows||[]).length > 1 && <button onClick={() => { const nr = [...(widget.rows||[])]; nr.splice(ri, 1); up("rows", nr); }} style={{ fontSize: 10, background: "#301a1a", border: "1px solid #6a2a2a", color: "#ff8a8a", borderRadius: 3, padding: "1px 6px", cursor: "pointer" }}>×</button>}
            </div>
          </div>
          {row.map((btn, bi) => (
            <div key={bi} style={{ display: "flex", gap: 4, marginBottom: 2, alignItems: "center" }}>
              <input value={btn.text} onChange={e => { const nr = [...(widget.rows||[])]; nr[ri] = [...nr[ri]]; nr[ri][bi] = { ...btn, text: e.target.value }; up("rows", nr); }} style={{ flex: 1, background: "#0d1520", border: "1px solid #1e3050", borderRadius: 3, padding: "2px 4px", color: "#c0d8f0", fontSize: 10, fontFamily: "monospace" }}/>
              <input type="color" value={btn.bg_color || widget.items_bg_color || "#2f8cd8"} onChange={e => { const nr = [...(widget.rows||[])]; nr[ri] = [...nr[ri]]; nr[ri][bi] = { ...btn, bg_color: e.target.value }; up("rows", nr); }} title="Button bg color" style={{ width: 20, height: 20, padding: 1, border: "1px solid #1e3050", borderRadius: 3, cursor: "pointer" }}/>
              <input type="color" value={btn.text_color || widget.items_text_color || "#ffffff"} onChange={e => { const nr = [...(widget.rows||[])]; nr[ri] = [...nr[ri]]; nr[ri][bi] = { ...btn, text_color: e.target.value }; up("rows", nr); }} title="Button text color" style={{ width: 20, height: 20, padding: 1, border: "1px solid #1e3050", borderRadius: 3, cursor: "pointer" }}/>
              <input type="color" value={btn.border_color || widget.items_border_color || "#0077b3"} onChange={e => { const nr = [...(widget.rows||[])]; nr[ri] = [...nr[ri]]; nr[ri][bi] = { ...btn, border_color: e.target.value }; up("rows", nr); }} title="Button border color" style={{ width: 20, height: 20, padding: 1, border: "1px solid #1e3050", borderRadius: 3, cursor: "pointer" }}/>
              {row.length > 1 && <span onClick={() => { const nr = [...(widget.rows||[])]; nr[ri] = nr[ri].filter((_,i)=>i!==bi); up("rows", nr); }} style={{ color: "#664444", cursor: "pointer", fontSize: 12 }}>×</span>}
            </div>
          ))}
        </div>
      ))}
      <button onClick={() => up("rows", [...(widget.rows||[]), [{ text: "Btn", id: "b" + uid() }]])} style={{ width: "100%", padding: "4px 8px", background: "#1a3050", border: "1px solid #2a4a6a", color: "#8ac4ff", borderRadius: 4, fontSize: 10, cursor: "pointer", marginTop: 4 }}>+ Add Row</button>
    </>}

    {T === "dropdown" && <PropField label="options" value={widget.options} onChange={v => up("options", v)}/>}
  </div>;
}

// ================================================================
// YAML → STATE (import)
// ================================================================
function fromHex(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseInt(String(v).replace(/^0x/i, ""), 16);
  if (isNaN(n)) return undefined;
  return "#" + n.toString(16).padStart(6, "0").toUpperCase();
}

function parseYamlWidget(typeKey, props) {
  if (!props || typeof props !== "object") return null;
  const SKIP = new Set(["id","widgets","rows","items","layout","on_press","styles","align","outline_width"]);
  const widget = {
    uid: uid(), type: typeKey,
    id: props.id || `${typeKey}_${uid().slice(1,5)}`,
    x: props.x || 0, y: props.y || 0,
    ...(props.width !== undefined ? { width: props.width } : {}),
    ...(props.height !== undefined ? { height: props.height } : {}),
    flex_grow: props.flex_grow || 0,
  };
  Object.entries(props).forEach(([k, v]) => {
    if (SKIP.has(k) || v === undefined || v === null) return;
    widget[k] = k.includes("color") ? (fromHex(v) ?? v) : v;
  });
  if (props.items && typeof props.items === "object" && !Array.isArray(props.items)) {
    Object.entries(props.items).forEach(([k, v]) => {
      if (k === "styles") return;
      widget[`items_${k}`] = k.includes("color") ? (fromHex(v) ?? v) : v;
    });
  }
  if (typeKey === "buttonmatrix" && props.rows) {
    widget.rows = props.rows.map(row =>
      (row.buttons || []).map(btn => ({ id: btn.id || "b" + uid().slice(1,5), text: btn.text || "" }))
    );
  }
  if (props.layout) {
    widget.layout_type = props.layout.type || "none";
    if (props.layout.flex_flow) widget.flex_flow = props.layout.flex_flow;
    if (props.layout.flex_align_main) widget.flex_align_main = props.layout.flex_align_main;
    if (props.layout.flex_align_cross) widget.flex_align_cross = props.layout.flex_align_cross;
  } else {
    widget.layout_type = widget.layout_type || "none";
  }
  if (typeKey === "obj") widget.children = [];
  if (props.widgets) {
    widget.children = props.widgets.flatMap(w => {
      const [wtype, wprops] = Object.entries(w)[0] || [];
      if (!wtype) return [];
      const child = parseYamlWidget(wtype, wprops);
      return child ? [child] : [];
    });
  }
  return widget;
}

function yamlToState(yamlStr, currentState) {
  const parsed = jsyaml.load(yamlStr);
  const lvgl = parsed?.lvgl || parsed;
  if (!lvgl?.pages) throw new Error("Could not find lvgl.pages in YAML");

  const theme = JSON.parse(JSON.stringify(currentState.theme));
  ["button","label"].forEach(k => {
    if (!lvgl.theme?.[k]) return;
    theme[k] = {};
    Object.entries(lvgl.theme[k]).forEach(([pk,pv]) => { theme[k][pk] = pk.includes("color") ? (fromHex(pv) ?? pv) : pv; });
  });
  if (lvgl.theme?.buttonmatrix) {
    theme.buttonmatrix = {};
    Object.entries(lvgl.theme.buttonmatrix).forEach(([k,v]) => {
      if (k === "items" && typeof v === "object") {
        Object.entries(v).forEach(([ik,iv]) => { theme.buttonmatrix[`items_${ik}`] = ik.includes("color") ? (fromHex(iv) ?? iv) : iv; });
      } else {
        theme.buttonmatrix[k] = k.includes("color") ? (fromHex(v) ?? v) : v;
      }
    });
  }

  const pages = lvgl.pages.map((page, i) => {
    const existing = currentState.pages[i] || currentState.pages[0] || {};
    const widgets = (page.widgets || []).flatMap(w => {
      const [wtype, wprops] = Object.entries(w)[0] || [];
      if (!wtype) return [];
      const widget = parseYamlWidget(wtype, wprops);
      return widget ? [widget] : [];
    });
    return {
      id: page.id || `page_${i}`,
      name: (page.id || `Page ${i+1}`).replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()),
      bgColor: fromHex(page.bg_color) || "#000000",
      layout_type: page.layout ? (page.layout.type || "none") : "none",
      ...(page.layout?.flex_flow ? { flex_flow: page.layout.flex_flow } : {}),
      ...(page.layout?.flex_align_main ? { flex_align_main: page.layout.flex_align_main } : {}),
      ...(page.layout?.flex_align_cross ? { flex_align_cross: page.layout.flex_align_cross } : {}),
      titleBar: existing.titleBar || { enabled: false, text: "", bg_color: "#16213e", text_color: "#ffffff", height: 36 },
      widgets,
    };
  });

  return { ...currentState, theme, pages, selectedPage: 0, selectedWidget: null };
}

// ================================================================
// MAIN APP
// ================================================================
export default function LVGLDesigner() {
  const [state, setState] = useState(() => {
    try { const s = localStorage.getItem("lvgl_designer_state"); if (s) return JSON.parse(s); } catch(e) {}
    return createDefaultState();
  });
  const [leftPanel, setLeftPanel] = useState("toolbox");
  const [rightPanel, setRightPanel] = useState("props");
  const [showYaml, setShowYaml] = useState(false);
  const [yamlText, setYamlText] = useState("");
  const [yamlError, setYamlError] = useState("");
  const [dragInfo, setDragInfo] = useState(null);
  const svgRef = useRef(null);
  const importRef = useRef(null);

  // Autosave to localStorage on every state change
  useEffect(() => {
    try { localStorage.setItem("lvgl_designer_state", JSON.stringify(state)); } catch(e) {}
  }, [state]);

  const { displaySize, scale: S, pages, selectedPage, selectedWidget, theme, navFooter, styleDefinitions } = state;
  const page = pages[selectedPage] || pages[0];
  const W = displaySize.w * S;
  const H = displaySize.h * S;

  // ---- Helpers ----
  const updateState = useCallback((updates) => setState(s => ({ ...s, ...updates })), []);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "lvgl-design.json"; a.click();
    URL.revokeObjectURL(url);
  }, [state]);

  const importJSON = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { setState(JSON.parse(ev.target.result)); }
      catch(err) { alert("Invalid design file: " + err.message); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const applyYaml = useCallback(() => {
    try { setState(yamlToState(yamlText, state)); setYamlError(""); setShowYaml(false); }
    catch(err) { setYamlError(err.message); }
  }, [yamlText, state]);

  const findWidget = useCallback((widgets, uid) => {
    for (const w of widgets) { if (w.uid === uid) return w; if (w.children) { const f = findWidget(w.children, uid); if (f) return f; } } return null;
  }, []);

  const updateWidgetInList = useCallback((widgets, uid, updates) => {
    return widgets.map(w => {
      if (w.uid === uid) return typeof updates === "function" ? updates(w) : { ...w, ...updates };
      if (w.children) return { ...w, children: updateWidgetInList(w.children, uid, updates) };
      return w;
    });
  }, []);

  const removeWidgetFromList = useCallback((widgets, uid) => {
    return widgets.filter(w => w.uid !== uid).map(w => w.children ? { ...w, children: removeWidgetFromList(w.children, uid) } : w);
  }, []);

  const selectedWidgetData = useMemo(() => selectedWidget ? findWidget(page.widgets, selectedWidget) : null, [selectedWidget, page.widgets, findWidget]);

  // ---- Actions ----
  const addWidget = useCallback((type) => {
    const def = WIDGET_DEFS[type];
    if (!def) return;
    const w = { uid: uid(), type, id: `${type}_${uid().slice(1,5)}`, x: 10, y: (page.titleBar?.enabled ? (page.titleBar.height||36)+4 : 10), ...JSON.parse(JSON.stringify(def.defaults)), flex_grow: 0 };
    if (type === "obj") w.children = [];
    const newPages = [...pages];
    newPages[selectedPage] = { ...page, widgets: [...page.widgets, w] };
    updateState({ pages: newPages, selectedWidget: w.uid });
    setRightPanel("props");
  }, [page, pages, selectedPage, updateState]);

  const updateWidget = useCallback((updated) => {
    const newPages = [...pages];
    newPages[selectedPage] = { ...page, widgets: updateWidgetInList(page.widgets, updated.uid, updated) };
    updateState({ pages: newPages });
  }, [page, pages, selectedPage, updateWidgetInList, updateState]);

  const deleteWidget = useCallback((wuid) => {
    const newPages = [...pages];
    newPages[selectedPage] = { ...page, widgets: removeWidgetFromList(page.widgets, wuid) };
    updateState({ pages: newPages, selectedWidget: selectedWidget === wuid ? null : selectedWidget });
  }, [page, pages, selectedPage, selectedWidget, removeWidgetFromList, updateState]);

  // ---- Page management ----
  const addPage = () => {
    const id = `page_${uid().slice(1,5)}`;
    updateState({ pages: [...pages, { id, name: `Page ${pages.length+1}`, bgColor: "#000000", layout_type: "none", titleBar: { enabled: true, text: `Page ${pages.length+1}`, bg_color: "#16213e", text_color: "#ffffff", height: 36 }, widgets: [] }], selectedPage: pages.length });
  };

  // ---- Drag ----
  const onDragStart = useCallback((e, wuid) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setDragInfo({ uid: wuid, startX: e.clientX, startY: e.clientY, origWidget: findWidget(page.widgets, wuid) });
  }, [page.widgets, findWidget]);

  useEffect(() => {
    if (!dragInfo) return;
    const onMove = (e) => {
      const dx = (e.clientX - dragInfo.startX) / S;
      const dy = (e.clientY - dragInfo.startY) / S;
      const ow = dragInfo.origWidget;
      if (!ow) return;
      const newPages = [...pages];
      newPages[selectedPage] = { ...page, widgets: updateWidgetInList(page.widgets, dragInfo.uid, { x: Math.round((ow.x || 0) + dx), y: Math.round((ow.y || 0) + dy) }) };
      setState(s => ({ ...s, pages: newPages }));
    };
    const onUp = () => setDragInfo(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragInfo, S, page, pages, selectedPage, updateWidgetInList]);

  // ---- Keyboard ----
  useEffect(() => {
    const onKey = (e) => {
      if (!selectedWidget || e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteWidget(selectedWidget); }
      const d = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] }[e.key];
      if (d) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const w = findWidget(page.widgets, selectedWidget);
        if (w) { const newPages = [...pages]; newPages[selectedPage] = { ...page, widgets: updateWidgetInList(page.widgets, selectedWidget, { x: (w.x||0)+d[0]*step, y: (w.y||0)+d[1]*step }) }; setState(s => ({ ...s, pages: newPages })); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedWidget, page, pages, selectedPage, findWidget, updateWidgetInList, deleteWidget]);

  // ---- Render ----
  const titleBarH = page.titleBar?.enabled ? (page.titleBar.height || 36) : 0;
  const footerStyle = styleDefinitions.find(s => s.id === "header_footer") || {};
  const footerH = navFooter.enabled ? (footerStyle.height || 36) : 0;
  const footerBg = footerStyle.bg_color || "#2f8cd8";
  const footerText = footerStyle.text_color || "#ffffff";
  const footerRadius = (footerStyle.radius || 0) * S;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#080c12", fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace", color: "#c0d0e0", overflow: "hidden" }}>

      {/* LEFT SIDEBAR */}
      <div style={{ width: 220, borderRight: "1px solid #141e2e", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Panel tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #141e2e" }}>
          {[{k:"toolbox",l:"Toolbox"},{k:"elements",l:"Elements"},{k:"theme",l:"Theme"}].map(t => (
            <button key={t.k} onClick={() => setLeftPanel(t.k)} style={{
              flex: 1, padding: "8px 0", fontSize: 10, fontWeight: leftPanel === t.k ? 700 : 400,
              background: leftPanel === t.k ? "#0d1520" : "transparent", color: leftPanel === t.k ? "#4a90d0" : "#556",
              border: "none", borderBottom: leftPanel === t.k ? "2px solid #4a90d0" : "2px solid transparent", cursor: "pointer",
            }}>{t.l}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {leftPanel === "toolbox" && <Toolbox onAdd={addWidget}/>}
          {leftPanel === "elements" && <ElementTree widgets={page.widgets} selected={selectedWidget} onSelect={uid => updateState({ selectedWidget: uid })} onDelete={deleteWidget}/>}
          {leftPanel === "theme" && <div style={{ padding: 8, fontSize: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b8aaf", marginBottom: 6 }}>Theme</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#4a7090", marginBottom: 4, fontWeight: 600 }}>Button</div>
              <PropField label="bg_color" value={theme.button.bg_color} onChange={v => updateState({ theme: { ...theme, button: { ...theme.button, bg_color: v }}})} type="color"/>
              <PropField label="border_color" value={theme.button.border_color} onChange={v => updateState({ theme: { ...theme, button: { ...theme.button, border_color: v }}})} type="color"/>
              <PropField label="text_color" value={theme.button.text_color} onChange={v => updateState({ theme: { ...theme, button: { ...theme.button, text_color: v }}})} type="color"/>
              <PropField label="radius" value={theme.button.radius} onChange={v => updateState({ theme: { ...theme, button: { ...theme.button, radius: v }}})} type="number"/>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "#4a7090", marginBottom: 4, fontWeight: 600 }}>Label</div>
              <PropField label="text_color" value={theme.label.text_color} onChange={v => updateState({ theme: { ...theme, label: { ...theme.label, text_color: v }}})} type="color"/>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b8aaf", marginBottom: 6, marginTop: 12 }}>Nav Footer</div>
              <PropField label="enabled" value={navFooter.enabled} onChange={v => updateState({ navFooter: { ...navFooter, enabled: v }})} type="checkbox"/>
              {navFooter.enabled && navFooter.buttons.map((b, i) => (
                <PropField key={i} label={b.id} value={b.text} onChange={v => {
                  const nb = [...navFooter.buttons]; nb[i] = { ...b, text: v };
                  updateState({ navFooter: { ...navFooter, buttons: nb }});
                }}/>
              ))}
            </div>
            {(() => {
              const hfIdx = styleDefinitions.findIndex(s => s.id === "header_footer");
              const hf = styleDefinitions[hfIdx] || {};
              const upHf = (k, v) => {
                const d = [...styleDefinitions]; d[hfIdx] = { ...hf, [k]: v };
                updateState({ styleDefinitions: d });
              };
              return <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b8aaf", marginBottom: 6 }}>Header/Footer Style</div>
                <div style={{ fontSize: 9, color: "#4a6a8a", marginBottom: 6 }}>Applied to nav footer background and buttons</div>
                <PropField label="bg_color" value={hf.bg_color} onChange={v => upHf("bg_color", v)} type="color"/>
                <PropField label="bg_grad_color" value={hf.bg_grad_color} onChange={v => upHf("bg_grad_color", v)} type="color"/>
                <PropField label="bg_grad_dir" value={hf.bg_grad_dir} onChange={v => upHf("bg_grad_dir", v)} type="select" options={["VER","HOR","NONE"]}/>
                <PropField label="text_color" value={hf.text_color} onChange={v => upHf("text_color", v)} type="color"/>
                <PropField label="border_color" value={hf.border_color} onChange={v => upHf("border_color", v)} type="color"/>
                <PropField label="radius" value={hf.radius ?? 0} onChange={v => upHf("radius", v)} type="number"/>
                <PropField label="height" value={hf.height ?? 30} onChange={v => upHf("height", v)} type="number"/>
                <PropField label="pad_all" value={hf.pad_all ?? 0} onChange={v => upHf("pad_all", v)} type="number"/>
                <PropField label="pad_row" value={hf.pad_row ?? 0} onChange={v => upHf("pad_row", v)} type="number"/>
                <PropField label="pad_column" value={hf.pad_column ?? 0} onChange={v => upHf("pad_column", v)} type="number"/>
              </div>;
            })()}
          </div>}
        </div>
      </div>

      {/* CENTER: Canvas */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", overflow: "auto", padding: 12 }}>
        {/* Top bar: pages, display size, scale, yaml */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8, width: "100%", justifyContent: "center" }}>
          {pages.map((p, i) => (
            <button key={p.id} onClick={() => updateState({ selectedPage: i, selectedWidget: null })} style={{
              padding: "4px 12px", fontSize: 11, fontWeight: selectedPage === i ? 700 : 400,
              background: selectedPage === i ? "#1a3050" : "#0d1520", color: selectedPage === i ? "#8ac4ff" : "#556",
              border: `1px solid ${selectedPage === i ? "#2a5a8a" : "#1a2030"}`, borderRadius: 4, cursor: "pointer",
            }}>{p.name}</button>
          ))}
          <button onClick={addPage} style={{ padding: "4px 10px", fontSize: 13, background: "transparent", color: "#3a6a9a", border: "1px dashed #2a4a6a", borderRadius: 4, cursor: "pointer" }}>+</button>
          <span style={{ width: 1, height: 20, background: "#1a2a3a", margin: "0 4px" }}/>
          <select value={`${displaySize.w}x${displaySize.h}`} onChange={e => { const [w,h] = e.target.value.split("x").map(Number); updateState({ displaySize: { w, h }}); }} style={{ background: "#0d1520", border: "1px solid #1a2a3a", borderRadius: 3, padding: "3px 6px", color: "#8899aa", fontSize: 10 }}>
            {DISPLAY_PRESETS.map(p => <option key={p.label} value={`${p.w}x${p.h}`}>{p.label}</option>)}
          </select>
          <select value={S} onChange={e => updateState({ scale: parseFloat(e.target.value) })} style={{ background: "#0d1520", border: "1px solid #1a2a3a", borderRadius: 3, padding: "3px 6px", color: "#8899aa", fontSize: 10 }}>
            {[1, 1.5, 2, 2.5, 3].map(v => <option key={v} value={v}>{v}x</option>)}
          </select>
          <button onClick={() => { setYamlText(generateYaml(state)); setShowYaml(true); }} style={{ padding: "4px 12px", fontSize: 11, background: "#1a4020", color: "#6adf6a", border: "1px solid #2a6a3a", borderRadius: 4, cursor: "pointer", fontWeight: 600 }}>⟨/⟩ YAML</button>
          <span style={{ width: 1, height: 20, background: "#1a2a3a", margin: "0 4px" }}/>
          <button onClick={exportJSON} title="Export design as JSON file" style={{ padding: "4px 10px", fontSize: 11, background: "#1a2a3a", color: "#8ac4ff", border: "1px solid #2a4a6a", borderRadius: 4, cursor: "pointer" }}>💾 Save</button>
          <label title="Import design from JSON file" style={{ padding: "4px 10px", fontSize: 11, background: "#1a2a3a", color: "#8ac4ff", border: "1px solid #2a4a6a", borderRadius: 4, cursor: "pointer" }}>
            📂 Load<input ref={importRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }}/>
          </label>
        </div>

        {/* SVG Canvas */}
        <div style={{ border: "1px solid #1a2a3a", borderRadius: 6, overflow: "hidden", boxShadow: "0 4px 40px rgba(0,0,0,0.5)", background: "#000", flexShrink: 0 }}>
          <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} onClick={() => updateState({ selectedWidget: null })}>
            <rect width={W} height={H} fill={page.bgColor || "#000"}/>
            {/* Grid overlay — rendered before chrome so title bar and footer appear on top */}
            <defs><pattern id="grid" width={10*S} height={10*S} patternUnits="userSpaceOnUse"><rect width={10*S} height={10*S} fill="none" stroke="#ffffff" strokeWidth={0.3} strokeOpacity={0.06}/></pattern></defs>
            <rect width={W} height={H} fill="url(#grid)" pointerEvents="none"/>

            {/* Title bar */}
            {page.titleBar?.enabled && <g>
              <rect x={0} y={0} width={W} height={titleBarH * S} fill={page.titleBar.bg_color || "#16213e"}/>
              <text x={W/2} y={titleBarH*S/2} fill={page.titleBar.text_color||"#fff"} fontSize={13*S} fontFamily="sans-serif" textAnchor="middle" dominantBaseline="central" fontWeight="600">{page.titleBar.text}</text>
            </g>}

            {/* Widgets */}
            {page.widgets.map(w => (
              <RenderWidget key={w.uid} w={w} s={S} theme={theme} isSelected={selectedWidget === w.uid} onSelect={uid => { updateState({ selectedWidget: uid }); setRightPanel("props"); }} onDragStart={onDragStart}/>
            ))}

            {/* Nav footer */}
            {navFooter.enabled && <g>
              <rect x={0} y={H - footerH * S} width={W} height={footerH * S} rx={footerRadius} fill={footerBg}/>
              {navFooter.buttons.map((b, i) => {
                const bw = W / navFooter.buttons.length;
                return <g key={i}>
                  <rect x={i * bw} y={H - footerH * S} width={bw} height={footerH * S} rx={footerRadius} fill={footerBg} stroke={footerText} strokeWidth={S * 0.3} strokeOpacity={0.3}/>
                  <text x={i * bw + bw / 2} y={H - (footerH * S) / 2} fill={footerText} fontSize={14*S} fontFamily="sans-serif" textAnchor="middle" dominantBaseline="central">{b.text}</text>
                </g>;
              })}
            </g>}
          </svg>
        </div>
        <div style={{ fontSize: 9, color: "#334", marginTop: 6, textAlign: "center" }}>
          {displaySize.w}×{displaySize.h} @ {S}x | Click: select · Drag: move · Arrow keys: nudge (Shift=10px) · Delete: remove
        </div>
      </div>

      {/* RIGHT SIDEBAR: Properties + Page config */}
      <div style={{ width: 260, borderLeft: "1px solid #141e2e", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "1px solid #141e2e" }}>
          {[{k:"props",l:"Properties"},{k:"page",l:"Page"}].map(t => (
            <button key={t.k} onClick={() => setRightPanel(t.k)} style={{
              flex: 1, padding: "8px 0", fontSize: 10, fontWeight: rightPanel === t.k ? 700 : 400,
              background: rightPanel === t.k ? "#0d1520" : "transparent", color: rightPanel === t.k ? "#4a90d0" : "#556",
              border: "none", borderBottom: rightPanel === t.k ? "2px solid #4a90d0" : "2px solid transparent", cursor: "pointer",
            }}>{t.l}</button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: "auto" }}>
          {rightPanel === "props" && <PropertyEditor widget={selectedWidgetData} onChange={updateWidget}/>}
          {rightPanel === "page" && <div style={{ padding: 8, fontSize: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b8aaf", marginBottom: 6 }}>Page Settings</div>
            <PropField label="id" value={page.id} onChange={v => { const np = [...pages]; np[selectedPage] = { ...page, id: v }; updateState({ pages: np }); }}/>
            <PropField label="name" value={page.name} onChange={v => { const np = [...pages]; np[selectedPage] = { ...page, name: v }; updateState({ pages: np }); }}/>
            <PropField label="bg_color" value={page.bgColor} onChange={v => { const np = [...pages]; np[selectedPage] = { ...page, bgColor: v }; updateState({ pages: np }); }} type="color"/>

            <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 10, marginBottom: 4 }}>LAYOUT</div>
            <PropField label="layout" value={page.layout_type} onChange={v => { const np = [...pages]; np[selectedPage] = { ...page, layout_type: v }; updateState({ pages: np }); }} type="select" options={["none","flex"]}/>
            {page.layout_type === "flex" && <>
              <PropField label="flex_flow" value={page.flex_flow} onChange={v => { const np=[...pages]; np[selectedPage]={...page,flex_flow:v}; updateState({pages:np}); }} type="select" options={FLEX_FLOWS}/>
              <PropField label="align_main" value={page.flex_align_main} onChange={v => { const np=[...pages]; np[selectedPage]={...page,flex_align_main:v}; updateState({pages:np}); }} type="select" options={FLEX_ALIGNS}/>
              <PropField label="align_cross" value={page.flex_align_cross} onChange={v => { const np=[...pages]; np[selectedPage]={...page,flex_align_cross:v}; updateState({pages:np}); }} type="select" options={FLEX_CROSS}/>
            </>}

            <div style={{ fontSize: 10, fontWeight: 600, color: "#6b8aaf", marginTop: 10, marginBottom: 4 }}>TITLE BAR</div>
            <PropField label="enabled" value={page.titleBar?.enabled} onChange={v => { const np = [...pages]; np[selectedPage] = { ...page, titleBar: { ...(page.titleBar||{}), enabled: v }}; updateState({ pages: np }); }} type="checkbox"/>
            {page.titleBar?.enabled && <>
              <PropField label="text" value={page.titleBar.text} onChange={v => { const np=[...pages]; np[selectedPage]={...page,titleBar:{...page.titleBar,text:v}}; updateState({pages:np}); }}/>
              <PropField label="bg_color" value={page.titleBar.bg_color} onChange={v => { const np=[...pages]; np[selectedPage]={...page,titleBar:{...page.titleBar,bg_color:v}}; updateState({pages:np}); }} type="color"/>
              <PropField label="text_color" value={page.titleBar.text_color} onChange={v => { const np=[...pages]; np[selectedPage]={...page,titleBar:{...page.titleBar,text_color:v}}; updateState({pages:np}); }} type="color"/>
              <PropField label="height" value={page.titleBar.height} onChange={v => { const np=[...pages]; np[selectedPage]={...page,titleBar:{...page.titleBar,height:v}}; updateState({pages:np}); }} type="number"/>
            </>}

            {pages.length > 1 && <button onClick={() => { const np = pages.filter((_,i) => i !== selectedPage); updateState({ pages: np, selectedPage: Math.max(0, selectedPage - 1), selectedWidget: null }); }} style={{ width: "100%", marginTop: 12, padding: "6px 12px", background: "transparent", color: "#cc4444", border: "1px solid #663333", borderRadius: 4, fontSize: 10, cursor: "pointer" }}>Delete Page</button>}
          </div>}
        </div>
      </div>

      {/* YAML Modal */}
      {showYaml && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowYaml(false)}>
        <div onClick={e => e.stopPropagation()} style={{ width: "80%", maxWidth: 700, height: "85vh", background: "#0d1520", border: "1px solid #1a3050", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #1a2a3a" }}>
            <span style={{ fontWeight: 700, color: "#8ac4ff", fontSize: 13 }}>Generated ESPHome LVGL YAML</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={applyYaml} title="Parse YAML and update the canvas (best-effort)" style={{ padding: "4px 12px", background: "#1a3040", color: "#60c4ff", border: "1px solid #2a5a7a", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>↩ Apply to Canvas</button>
              <button onClick={() => navigator.clipboard?.writeText(yamlText)} style={{ padding: "4px 12px", background: "#1a4020", color: "#6adf6a", border: "1px solid #2a6a3a", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>📋 Copy</button>
              <button onClick={() => setShowYaml(false)} style={{ padding: "4px 10px", background: "#301a1a", color: "#ff8a8a", border: "1px solid #6a2a2a", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>✕</button>
            </div>
          </div>
          {yamlError && <div style={{ padding: "8px 16px", background: "#2a0a0a", borderBottom: "1px solid #6a2a2a", color: "#ff8a8a", fontSize: 11, fontFamily: "monospace", userSelect: "text", whiteSpace: "pre-wrap" }}>⚠ {yamlError}</div>}
          <textarea value={yamlText} onChange={e => { setYamlText(e.target.value); setYamlError(""); }} spellCheck={false} style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 16, margin: 0, fontSize: 11, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", color: "#8ac4ff", lineHeight: 1.6, whiteSpace: "pre", background: "#0d1520", border: "none", outline: "none", resize: "none" }} />
        </div>
      </div>}
    </div>
  );
}
