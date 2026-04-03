/*
  Dev Timeline — Obsidian Plugin
  Uses DOM API (createElementNS) throughout — never innerHTML —
  so it works inside Obsidian's sandboxed renderer.
*/

const { Plugin, parseYaml: parseObsidianYaml } = require("obsidian");

const SVG_NS = "http://www.w3.org/2000/svg";

const PALETTE = {
  purple: { light: "#7F77DD", bg_light: "#EEEDFE", dark: "#AFA9EC", bg_dark: "#3C3489" },
  teal:   { light: "#1D9E75", bg_light: "#E1F5EE", dark: "#5DCAA5", bg_dark: "#085041" },
  amber:  { light: "#BA7517", bg_light: "#FAEEDA", dark: "#EF9F27", bg_dark: "#633806" },
  coral:  { light: "#D85A30", bg_light: "#FAECE7", dark: "#F0997B", bg_dark: "#712B13" },
  blue:   { light: "#378ADD", bg_light: "#E6F1FB", dark: "#85B7EB", bg_dark: "#0C447C" },
  pink:   { light: "#D4537E", bg_light: "#FBEAF0", dark: "#ED93B1", bg_dark: "#72243E" },
  green:  { light: "#639922", bg_light: "#EAF3DE", dark: "#97C459", bg_dark: "#27500A" },
  red:    { light: "#E24B4A", bg_light: "#FCEBEB", dark: "#F09595", bg_dark: "#791F1F" },
  gray:   { light: "#888780", bg_light: "#F1EFE8", dark: "#B4B2A9", bg_dark: "#444441" },
};

const DEFAULT_COLORS = ["purple", "teal", "amber", "coral", "blue", "pink", "green"];

function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
  if (parent) parent.appendChild(node);
  return node;
}

function parseYAML(src) {
  if (typeof parseObsidianYaml === "function") {
    const parsed = parseObsidianYaml(src);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Timeline spec must be a YAML object.");
    }
    return parsed;
  }

  return parseSimpleYAML(src);
}

function parseSimpleYAML(src) {
  const lines = src.split(/\r?\n/);
  const root = {};
  const stack = [{ type: "object", value: root, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = raw.search(/\S/);
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();

    const ctx = stack[stack.length - 1];
    if (trimmed.startsWith("- ")) {
      if (ctx.type !== "array") throw new Error("Invalid YAML list structure.");
      pushListItem(lines, i, indent, trimmed.slice(2).trim(), ctx, stack);
      continue;
    }

    if (ctx.type !== "object") throw new Error("Invalid YAML object structure.");
    const entry = splitKeyValue(trimmed);
    if (!entry) continue;

    if (entry.value === "") {
      const child = createNestedContainer(lines, i + 1, indent);
      ctx.value[entry.key] = child;
      stack.push({
        type: Array.isArray(child) ? "array" : "object",
        value: child,
        indent,
      });
      continue;
    }

    ctx.value[entry.key] = coerce(entry.value);
  }

  return root;
}

function pushListItem(lines, lineIndex, indent, content, ctx, stack) {
  if (content === "") {
    const child = {};
    ctx.value.push(child);
    stack.push({ type: "object", value: child, indent });
    return;
  }

  const entry = splitKeyValue(content);
  if (!entry) {
    ctx.value.push(coerce(content));
    return;
  }

  const child = {};
  ctx.value.push(child);
  stack.push({ type: "object", value: child, indent });

  if (entry.value === "") {
    const nested = createNestedContainer(lines, lineIndex + 1, indent);
    child[entry.key] = nested;
    stack.push({
      type: Array.isArray(nested) ? "array" : "object",
      value: nested,
      indent: indent + 1,
    });
    return;
  }

  child[entry.key] = coerce(entry.value);
}

function createNestedContainer(lines, startIndex, parentIndent) {
  for (let i = startIndex; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = raw.search(/\S/);
    if (indent <= parentIndent) break;
    return trimmed.startsWith("- ") ? [] : {};
  }

  return {};
}

function splitKeyValue(content) {
  const colonIdx = content.indexOf(":");
  if (colonIdx === -1) return null;
  return {
    key: content.slice(0, colonIdx).trim(),
    value: content.slice(colonIdx + 1).trim(),
  };
}

function coerce(v) {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (v !== "" && !isNaN(Number(v))) return Number(v);
  return v;
}

function pd(s) { return new Date(s + "T00:00:00"); }
function addDays(s, n) {
  const d = pd(s);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtMonth(d) {
  return d.toLocaleString("default", { month: "short" }) + " '" + String(d.getFullYear()).slice(2);
}

function renderTimeline(spec, container) {
  const isDark = document.body.classList.contains("theme-dark");

  const phases = (spec.phases || []).map((p, i) => {
    const colorKey = p.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    const pal = PALETTE[colorKey] || PALETTE.purple;
    return {
      ...p,
      accent: isDark ? pal.dark : pal.light,
      bg: isDark ? pal.bg_dark + "44" : pal.bg_light + "bb",
      tasks: (p.tasks || []).map(t => ({
        ...t,
        end: t.end || (t.start ? addDays(t.start, t.duration || 1) : t.start),
      })),
    };
  });

  let minDate = null, maxDate = null;
  phases.forEach(p => p.tasks.forEach(t => {
    const s = pd(t.start), e = pd(t.end || t.start);
    if (!minDate || s < minDate) minDate = s;
    if (!maxDate || e > maxDate) maxDate = e;
  }));
  if (!minDate) return;

  minDate = new Date(minDate); minDate.setDate(minDate.getDate() - 3);
  maxDate = new Date(maxDate); maxDate.setDate(maxDate.getDate() + 10);
  const SPAN = maxDate - minDate;

  const W = 700, LABEL_W = 160, BAR_W = W - LABEL_W - 16;
  const ROW_H = 30, SEC_HDR = 28, SEC_PAD = 8, BAR_H = 14, BR = 4;

  const xOf = s => LABEL_W + ((pd(s) - minDate) / SPAN) * BAR_W;
  const wOf = (s, e) => Math.max(((pd(e) - pd(s)) / SPAN) * BAR_W, 2);

  let totalRows = 0;
  phases.forEach(p => totalRows += p.tasks.length);
  const H = totalRows * ROW_H + phases.length * (SEC_HDR + SEC_PAD * 2) + 48;

  const months = [];
  const mc = new Date(minDate); mc.setDate(1);
  while (mc <= maxDate) { months.push(new Date(mc)); mc.setMonth(mc.getMonth() + 1); }

  const wrap = container.createEl("div", { cls: "dev-timeline-wrap" });
  if (spec.title) {
    const hdr = wrap.createEl("div", { cls: "dev-timeline-header" });
    hdr.createEl("div", { cls: "dev-timeline-title", text: spec.title });
    if (spec.subtitle) hdr.createEl("div", { cls: "dev-timeline-subtitle", text: spec.subtitle });
  }
  const chartDiv = wrap.createEl("div", { cls: "dev-timeline-chart" });

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.display = "block";
  svg.style.overflow = "visible";
  chartDiv.appendChild(svg);

  svgEl("rect", { x: LABEL_W, y: 0, width: BAR_W, height: H - 28, rx: 4,
    fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }, svg);

  const gridStroke = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const labelFill  = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";

  months.forEach(m => {
    const x = xOf(m.toISOString().slice(0, 10));
    if (x < LABEL_W || x > W) return;
    svgEl("line", { x1: x, y1: 0, x2: x, y2: H - 28, stroke: gridStroke, "stroke-width": 0.5 }, svg);
    const t = svgEl("text", { x, y: H - 10, "text-anchor": "middle", "font-size": 10, fill: labelFill }, svg);
    t.textContent = fmtMonth(m);
  });

  const todayX = xOf(new Date().toISOString().slice(0, 10));
  if (todayX >= LABEL_W && todayX <= W - 8) {
    svgEl("line", { x1: todayX, y1: 0, x2: todayX, y2: H - 28,
      stroke: "#E24B4A", "stroke-width": 1.5, "stroke-dasharray": "3 3", opacity: 0.7 }, svg);
    const tt = svgEl("text", { x: todayX + 3, y: 11, "font-size": 9, fill: "#E24B4A", opacity: 0.8 }, svg);
    tt.textContent = "today";
  }

  const taskLabelFill = isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.72)";
  let y = 8;

  phases.forEach(p => {
    y += SEC_PAD;
    const phaseH = SEC_HDR + p.tasks.length * ROW_H;

    svgEl("rect", { x: 0, y, width: W, height: phaseH, rx: 6, fill: p.bg }, svg);
    svgEl("rect", { x: 0, y, width: 4, height: phaseH, rx: 2, fill: p.accent }, svg);

    const phLbl = svgEl("text", { x: 10, y: y + SEC_HDR / 2 + 5, "font-size": 10, "font-weight": 600, fill: p.accent }, svg);
    phLbl.textContent = p.label.toUpperCase();

    y += SEC_HDR;

    p.tasks.forEach(t => {
      const cy = y + ROW_H / 2;

      if (t.milestone) {
        const mx = xOf(t.start), sz = 8;
        svgEl("polygon", {
          points: `${mx},${cy - sz} ${mx + sz},${cy} ${mx},${cy + sz} ${mx - sz},${cy}`,
          fill: p.accent,
        }, svg);
        const ml = svgEl("text", { x: mx + sz + 6, y: cy + 4, "font-size": 11, "font-weight": 500, fill: p.accent }, svg);
        ml.textContent = t.name;
      } else {
        const x1 = xOf(t.start), bw = wOf(t.start, t.end), barY = cy - BAR_H / 2;

        svgEl("rect", { x: x1, y: barY, width: bw, height: BAR_H, rx: BR, fill: p.accent, opacity: 0.18 }, svg);

        if (t.done) {
          svgEl("rect", { x: x1, y: barY, width: bw, height: BAR_H, rx: BR, fill: p.accent, opacity: 0.75 }, svg);
          const tx = x1 + bw - 10;
          svgEl("polyline", {
            points: `${tx},${cy - 2} ${tx + 3},${cy + 2} ${tx + 7},${cy - 4}`,
            fill: "none", stroke: "white", "stroke-width": 1.5,
            "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.9,
          }, svg);
        } else if (t.active) {
          const progress = Math.min(1, Math.max(0,
            (new Date() - pd(t.start)) / (pd(t.end) - pd(t.start))
          ));
          if (progress > 0) {
            svgEl("rect", { x: x1, y: barY, width: bw * progress, height: BAR_H, rx: BR, fill: p.accent, opacity: 0.65 }, svg);
          }
        }

        const lbl = svgEl("text", {
          x: LABEL_W - 8, y: cy + 4, "text-anchor": "end", "font-size": 12, fill: taskLabelFill,
        }, svg);
        lbl.textContent = t.name;
      }

      y += ROW_H;
    });

    y += SEC_PAD;
  });
}

module.exports = class DevTimelinePlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("dev-timeline", (source, el, ctx) => {
      try {
        const spec = parseYAML(source);
        renderTimeline(spec, el);
      } catch (err) {
        el.createEl("pre", { text: "dev-timeline error:\n" + err.message });
      }
    });
  }
};
