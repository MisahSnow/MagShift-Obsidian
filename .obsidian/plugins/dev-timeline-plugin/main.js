/*
  Dev Timeline — Obsidian Plugin
  Registers a `dev-timeline` fenced code block that renders an
  interactive SVG/HTML project timeline from a simple YAML spec.
*/

const { Plugin } = require("obsidian");

// ─── Colour palette (maps colour names → hex pairs [light, dark]) ────────────
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

const DEFAULT_COLORS = ["purple","teal","amber","coral","blue","pink","green"];

// ─── Tiny YAML parser (handles the subset we need) ───────────────────────────
function parseYAML(src) {
  const lines = src.split("\n");
  const root = {};
  const stack = [{ obj: root, indent: -1 }];
  let currentList = null;
  let currentListKey = null;
  let currentListIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith("#")) continue;

    const indent = raw.search(/\S/);
    const content = raw.trim();

    // List item
    if (content.startsWith("- ")) {
      const val = content.slice(2).trim();
      // inline list item with key:value pairs? — treat as object
      if (val.includes(": ")) {
        const obj = {};
        // parse all key:value on this line
        const parts = val.match(/(\w+):\s*([^,]+)/g) || [];
        parts.forEach(p => {
          const [k, ...vs] = p.split(":");
          obj[k.trim()] = coerce(vs.join(":").trim());
        });
        // find parent list
        if (currentList) currentList.push(obj);
      } else {
        if (currentList) currentList.push(coerce(val));
      }
      continue;
    }

    // Key: value or Key: (block)
    const colonIdx = content.indexOf(":");
    if (colonIdx === -1) continue;
    const key = content.slice(0, colonIdx).trim();
    const val = content.slice(colonIdx + 1).trim();

    // Pop stack to correct indent level
    while (stack.length > 1 && stack[stack.length-1].indent >= indent) stack.pop();
    const parent = stack[stack.length-1].obj;

    if (val === "" || val === null) {
      // Could be a list or nested object — peek ahead
      const next = lines[i+1];
      if (next && next.trim().startsWith("- ")) {
        parent[key] = [];
        currentList = parent[key];
        currentListKey = key;
        currentListIndent = indent;
      } else {
        const nested = {};
        parent[key] = nested;
        stack.push({ obj: nested, indent });
      }
    } else {
      parent[key] = coerce(val);
      currentList = null;
    }
  }
  return root;
}

function coerce(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // keep dates as strings
  if (!isNaN(Number(v)) && v !== "") return Number(v);
  return v;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
function parseDate(s) { return new Date(s + "T00:00:00"); }
function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}
function fmtMonth(d) {
  return d.toLocaleString("default", { month: "short" }) + " '" + String(d.getFullYear()).slice(2);
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
function renderTimeline(spec, container) {
  const isDark = document.body.classList.contains("theme-dark");

  // Resolve phases
  const phases = (spec.phases || []).map((p, i) => {
    const colorKey = p.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
    const pal = PALETTE[colorKey] || PALETTE.purple;
    return {
      ...p,
      colorKey,
      accent: isDark ? pal.dark : pal.light,
      bg: isDark ? pal.bg_dark + "55" : pal.bg_light + "99",
      tasks: (p.tasks || []).map(t => ({
        ...t,
        end: t.end || (t.start ? addDays(t.start, t.duration || 1) : t.start),
      })),
    };
  });

  // Compute date range
  let minDate = null, maxDate = null;
  phases.forEach(p => p.tasks.forEach(t => {
    const s = parseDate(t.start);
    const e = parseDate(t.end || t.start);
    if (!minDate || s < minDate) minDate = s;
    if (!maxDate || e > maxDate) maxDate = e;
  }));
  if (!minDate) return;

  // Pad by a few days on each side
  minDate = new Date(minDate); minDate.setDate(minDate.getDate() - 3);
  maxDate = new Date(maxDate); maxDate.setDate(maxDate.getDate() + 10);
  const SPAN = maxDate - minDate;

  // Layout constants
  const TOTAL_W = 700;
  const LABEL_W = 160;
  const BAR_AREA = TOTAL_W - LABEL_W - 16;
  const ROW_H = 30;
  const SEC_HDR = 28;
  const SEC_PAD = 8;
  const BAR_H = 14;
  const BAR_RADIUS = 4;

  function xOf(dateStr) {
    return LABEL_W + ((parseDate(dateStr) - minDate) / SPAN) * BAR_AREA;
  }
  function wOf(s, e) {
    return Math.max(((parseDate(e) - parseDate(s)) / SPAN) * BAR_AREA, 2);
  }

  // Total height
  let totalRows = 0;
  phases.forEach(p => totalRows += p.tasks.length);
  const SVG_H = totalRows * ROW_H + phases.length * (SEC_HDR + SEC_PAD * 2) + 48;

  // Month grid
  const months = [];
  const mc = new Date(minDate); mc.setDate(1);
  while (mc <= maxDate) { months.push(new Date(mc)); mc.setMonth(mc.getMonth() + 1); }

  // Build SVG string
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 ${TOTAL_W} ${SVG_H}" style="display:block;overflow:visible">`;

  // Background track
  s += `<rect x="${LABEL_W}" y="0" width="${BAR_AREA}" height="${SVG_H - 28}" rx="4" fill="${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"}"/>`;

  // Month grid lines + labels
  months.forEach(m => {
    const x = xOf(m.toISOString().slice(0,10));
    if (x < LABEL_W || x > TOTAL_W) return;
    s += `<line x1="${x}" y1="0" x2="${x}" y2="${SVG_H - 28}" stroke="${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}" stroke-width="0.5"/>`;
    s += `<text x="${x}" y="${SVG_H - 10}" text-anchor="middle" font-size="10" font-family="var(--font-interface,sans-serif)" fill="${isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)"}">${fmtMonth(m)}</text>`;
  });

  // Today line
  const today = new Date().toISOString().slice(0,10);
  const todayX = xOf(today);
  if (todayX >= LABEL_W && todayX <= TOTAL_W - 8) {
    s += `<line x1="${todayX}" y1="0" x2="${todayX}" y2="${SVG_H - 28}" stroke="#E24B4A" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.7"/>`;
    s += `<text x="${todayX + 3}" y="11" font-size="9" font-family="var(--font-interface,sans-serif)" fill="#E24B4A" opacity="0.8">today</text>`;
  }

  // Phases + tasks
  let y = 8;
  phases.forEach(p => {
    y += SEC_PAD;
    const phaseH = SEC_HDR + p.tasks.length * ROW_H;

    // Phase band
    s += `<rect x="0" y="${y}" width="${TOTAL_W}" height="${phaseH}" rx="6" fill="${p.bg}"/>`;
    s += `<rect x="0" y="${y}" width="4" height="${phaseH}" rx="2" fill="${p.accent}"/>`;

    // Phase label
    s += `<text x="10" y="${y + SEC_HDR / 2 + 5}" font-size="10" font-weight="600" letter-spacing="0.8" text-transform="uppercase" font-family="var(--font-interface,sans-serif)" fill="${p.accent}" style="text-transform:uppercase">${p.label.toUpperCase()}</text>`;

    y += SEC_HDR;

    p.tasks.forEach(t => {
      const cy = y + ROW_H / 2;

      if (t.milestone) {
        const mx = xOf(t.start);
        const sz = 8;
        // Diamond
        s += `<polygon points="${mx},${cy - sz} ${mx + sz},${cy} ${mx},${cy + sz} ${mx - sz},${cy}" fill="${p.accent}"/>`;
        s += `<text x="${mx + sz + 6}" y="${cy + 4}" font-size="11" font-weight="500" font-family="var(--font-interface,sans-serif)" fill="${p.accent}">${t.name}</text>`;
      } else {
        const x1 = xOf(t.start);
        const bw = wOf(t.start, t.end);
        const barY = cy - BAR_H / 2;

        // Track
        s += `<rect x="${x1}" y="${barY}" width="${bw}" height="${BAR_H}" rx="${BAR_RADIUS}" fill="${p.accent}" opacity="0.18"/>`;
        // Fill (done = full, active = partial estimate, future = empty)
        if (t.done) {
          s += `<rect x="${x1}" y="${barY}" width="${bw}" height="${BAR_H}" rx="${BAR_RADIUS}" fill="${p.accent}" opacity="0.75"/>`;
          // Checkmark tick at right end
          const tx = x1 + bw - 10;
          s += `<polyline points="${tx},${cy - 2} ${tx + 3},${cy + 2} ${tx + 7},${cy - 4}" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
        } else if (t.active) {
          const progress = Math.min(1, (new Date() - parseDate(t.start)) / (parseDate(t.end) - parseDate(t.start)));
          s += `<rect x="${x1}" y="${barY}" width="${bw * progress}" height="${BAR_H}" rx="${BAR_RADIUS}" fill="${p.accent}" opacity="0.6"/>`;
        }

        // Task label (left, truncated visually)
        s += `<text x="${LABEL_W - 8}" y="${cy + 4}" text-anchor="end" font-size="12" font-family="var(--font-interface,sans-serif)" fill="${isDark ? "rgba(255,255,255,0.75)" : "rgba(0,0,0,0.75)"}">${t.name}</text>`;
      }

      y += ROW_H;
    });

    y += SEC_PAD;
  });

  s += `</svg>`;

  // Wrapper
  const wrap = container.createEl("div", { cls: "dev-timeline-wrap" });
  if (spec.title) {
    const hdr = wrap.createEl("div", { cls: "dev-timeline-header" });
    hdr.createEl("div", { cls: "dev-timeline-title", text: spec.title });
    if (spec.subtitle) hdr.createEl("div", { cls: "dev-timeline-subtitle", text: spec.subtitle });
  }
  const chart = wrap.createEl("div", { cls: "dev-timeline-chart" });
  chart.innerHTML = s;
}

// ─── Plugin class ─────────────────────────────────────────────────────────────
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
