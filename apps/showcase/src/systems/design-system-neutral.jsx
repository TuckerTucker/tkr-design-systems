import { useState, useEffect, useCallback } from "react";
/* neutral is the registry alias of wireframe: same spec, same token file */
import tokens from "@systems/wireframe/tokens.json";
import { motion, reducedMotionCss, contrastRatio, contrastText, wcagLevel, px, lh } from "../tokens.js";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — NEUTRAL
   Greyscale Wireframe Reference · Single-theme standalone spec + live preview
   ═══════════════════════════════════════════════════════════════ */

/* Every design value comes from systems/wireframe/tokens.json (docs/specs/TOKENS.md § 4). */
const { color: C, font: F, radius: rad, border_width: bw } = tokens;
const X = tokens.extras.color;
const T = { ...tokens.type, ...tokens.extras.type };
const rule = (w, col) => `${w}px solid ${col}`;

const TM = { name: "Neutral", tag: "Greyscale Wireframe Reference", color: C.accent };

const chatList = [
  { id: 1, name: "Tokyo Trip", preview: "Want me to build a day-by-day itinerary?", time: "2m", unread: 2, avatar: "🗼", online: true },
  { id: 2, name: "Recipe Ideas", preview: "Here are 5 ramen variations you'll love...", time: "1h", unread: 0, avatar: "🍜" },
  { id: 3, name: "Book Club", preview: "I'd recommend starting with Murakami's...", time: "3h", unread: 1, avatar: "📖", online: true },
  { id: 4, name: "Fitness Plan", preview: "Your 4-week progressive routine is ready.", time: "1d", unread: 0, avatar: "💪" },
  { id: 5, name: "Code Review", preview: "The auth middleware looks solid, but...", time: "2d", unread: 0, avatar: "⚡" },
];
const msgs = [
  { id: 1, sender: "user", text: "Hey, can you help me plan a trip to Tokyo?" },
  { id: 2, sender: "ai", text: "Absolutely. Tokyo is incredible. Are you looking for a culture-focused trip, a food adventure, or a mix of everything?" },
  { id: 3, sender: "user", text: "Definitely a mix — temples in the morning, ramen at night." },
  { id: 4, sender: "ai", text: "Perfect combination. I'd suggest starting in Asakusa for Senso-ji, then heading to Shibuya for the evening food scene. Want me to build a day-by-day itinerary?" },
];

/* ─── SHARED HELPERS ─── */
const Tk = ({ n, v, d, a = "#999" }) => <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" }}><code className="mn" style={{ fontSize: 10, color: "#CCC", minWidth: 170 }}>{n}</code><code className="mn" style={{ fontSize: 10, color: a, minWidth: 120 }}>{v}</code>{d && <span style={{ fontSize: 9.5, color: "#555" }}>{d}</span>}</div>;
const Sw = ({ c, n, v, b }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}><div style={{ width: 24, height: 24, borderRadius: 6, background: c, border: b || "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} /><div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#CCC" }}>{n}</div><code className="mn" style={{ fontSize: 9, color: "#666" }}>{v}</code></div></div>;
const H3 = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, color: "#EEE", margin: "22px 0 10px", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</h3>;
const H4 = ({ children }) => <h4 style={{ fontSize: 11.5, fontWeight: 600, color: "#CCC", margin: "16px 0 6px" }}>{children}</h4>;
const P = ({ children }) => <p style={{ fontSize: 12, color: "#999", lineHeight: 1.6, margin: "0 0 10px" }}>{children}</p>;
const Do = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 6, marginBottom: 4, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#34D399", flexShrink: 0 }}>✓</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Dont = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 6, marginBottom: 4, background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#FF6B6B", flexShrink: 0 }}>✗</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Pill = ({ children, color }) => <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 6, background: `${color}10`, border: `1px solid ${color}25`, color, fontWeight: 600 }}>{children}</span>;

const CBox = ({ title, parts, contract, specs, dos, donts, accent }) => {
  const [open, setOpen] = useState(false);
  return (<div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
    <div onClick={() => setOpen(!open)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: open ? "rgba(255,255,255,0.02)" : "transparent" }}>
      <span style={{ fontSize: 9, color: "#555", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      <span className="mn" style={{ fontSize: 12, fontWeight: 700, color: "#EEE" }}>{title}</span>
      <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>{parts.map(p => <code key={p} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.03)", color: "#666" }}>{p}</code>)}</div>
    </div>
    {open && <div style={{ padding: "0 14px 14px" }}>
      <div style={{ padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>Contract</div>
        <div style={{ fontSize: 11, color: "#BBB", lineHeight: 1.5 }}>{contract}</div>
      </div>
      {specs?.map((s, i) => <Tk key={i} n={s[0]} v={s[1]} d={s[2]} a={accent} />)}
      <div style={{ marginTop: 8 }}>{dos?.map((d, i) => <Do key={i}>{d}</Do>)}{donts?.map((d, i) => <Dont key={i}>{d}</Dont>)}</div>
    </div>}
  </div>);
};

/* ═══════════════════════════════════════════════════════════════
   LIVE CHAT DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function NeutralChat({ sel, setSel }) {
  return (
    <div className="app-sh" style={{ background: C.page_bg, fontFamily: F.body, borderRadius: rad.chrome, border: rule(bw.default, C.border_default), color: C.text_primary }}>
      {/* Sidebar */}
      <div className="sb" style={{ borderRight: rule(bw.default, C.border_default), background: C.surface }}>
        <div style={{ padding: "16px", borderBottom: rule(bw.default, C.border_default) }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.text_primary, lineHeight: 1.2 }}>Neutral</div>
          <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 4 }}>5 conversations</div>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: rule(bw.default, C.border_default) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: rad.input, border: rule(bw.default, C.border_input), background: C.surface }}>
            <span style={{ fontSize: 13, color: C.text_muted }}>⌕</span>
            <input placeholder="Search conversations" className="si" style={{ fontFamily: "inherit", color: C.text_primary, fontSize: 13 }} />
          </div>
        </div>

        <div className="cl">
          {chatList.map((c, i) => (
            <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "12px 16px", borderBottom: rule(bw.default, C.border_default), background: sel === c.id ? C.surface_selected : C.surface, cursor: "pointer", animationDelay: `${i * 40}ms` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ width: 32, height: 32, borderRadius: 16, background: C.border_default, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>{c.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 14, fontWeight: sel === c.id ? 600 : 500, color: C.text_primary }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: C.text_secondary, flexShrink: 0 }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 2, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</div>
                </div>
                {c.unread > 0 && <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: C.accent, color: C.accent_foreground, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{c.unread}</div>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 16px", borderTop: rule(bw.default, C.border_default), background: C.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: C.border_default, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: C.text_secondary }}>TH</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.text_primary }}>T. Harris</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="ca" style={{ background: C.page_bg }}>
        <div style={{ padding: "16px 20px", borderBottom: rule(bw.default, C.border_default), background: C.surface }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.text_primary }}>Tokyo Trip</div>
              <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>{msgs.length} messages</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: C.success }} />
              <span style={{ fontSize: 12, color: C.text_secondary }}>Active</span>
            </div>
          </div>
        </div>

        <div className="ma" style={{ padding: "20px" }}>
          {msgs.map((m, i) => (
            <div key={m.id} className="mi" style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "72%", animationDelay: `${i * 70}ms` }}>
              <div style={{ fontSize: 11, color: C.text_secondary, marginBottom: 4, textAlign: m.sender === "user" ? "right" : "left" }}>
                {m.sender === "user" ? "You" : "Assistant"}
              </div>
              <div style={{
                padding: "10px 14px",
                borderRadius: tokens.extras.radius.message,
                background: m.sender === "user" ? C.surface_inverse : C.surface,
                color: m.sender === "user" ? C.text_inverse : C.text_primary,
                border: m.sender === "ai" ? rule(bw.default, C.border_default) : "none",
                fontSize: 14,
                lineHeight: 1.55,
              }}>{m.text}</div>
            </div>
          ))}

          <div className="mi" style={{ alignSelf: "flex-start", maxWidth: "100%", animationDelay: "320ms" }}>
            <div style={{ fontSize: 12, color: C.text_secondary, fontWeight: 500, marginBottom: 8 }}>Suggestions</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["Temples", "Ramen", "Culture", "Parks"].map((l, ti) => (
                <div key={ti} className="bc-nt" style={{ padding: "8px 16px", borderRadius: rad.default, border: rule(bw.default, C.border_default), background: C.surface, cursor: "pointer", fontSize: 13, fontWeight: 500, color: C.text_primary }}>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px", borderTop: rule(bw.default, C.border_default), background: C.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: rad.input, border: rule(bw.default, C.border_input), background: C.surface }}>
            <input placeholder="Type a message..." className="si" style={{ fontFamily: "inherit", color: C.text_primary, fontSize: 14 }} />
            <div className="snd" style={{ padding: "6px 16px", borderRadius: rad.default, background: C.action, color: C.action_foreground, fontSize: 13, fontWeight: 600 }}>Send</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const notes = [
    "System font stack only — no brand typeface commitment. The wireframe is deliberately font-agnostic.",
    `Seven greyscale values: ${C.page_bg} page, ${C.surface} surface, ${C.border_default} border, ${C.text_muted} disabled, ${C.text_secondary} secondary, ${C.accent} interactive, ${C.text_primary} primary text`,
    `Accent is ${C.accent} (dark grey) — the system has no chromatic accent color at all`,
    "Border-radius: 6px default, 8px for chrome. Modest rounding — neither sharp nor bubbly.",
    "4px grid with allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64",
    "Elevation via borders only — no shadows, no backdrop-blur, no translucency",
    "Type scale: 11, 12, 13, 14, 16, 18, 24. Seven sizes, same as every system.",
    `Semantic colors reserved for status only: success ${C.success}, warning ${C.warning}, danger ${C.danger}, info ${C.info}`,
  ];
  return (<div>
    <P>Live implementation of the Neutral wireframe system. Every token from the wireframe spec applied to a working interface. This is the universal baseline — all other design systems are transformations of this greyscale reference.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 480, borderRadius: 8, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <NeutralChat sel={sel} setSel={setSel} />
      </div>
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Design tokens in action</div>
        {notes.map((n, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 6, border: `1px solid ${TM.color}20`, background: `${TM.color}06`, marginBottom: 4, fontSize: 10, color: "#BBB", lineHeight: 1.4 }}>
            <span style={{ color: TM.color, marginRight: 4 }}>→</span>{n}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   NEUTRAL SPEC
   ═══════════════════════════════════════════════════════════════ */
function neutralSpec(a) { return {
  overview: () => (<div>
    <P>Neutral is the greyscale wireframe reference system. It defines the universal baseline palette, type scale, spacing grid, and component library that all other design systems build upon. Where Swiss adds red, Terminal adds phosphor green, and Prism adds frosted glass — Neutral commits to nothing. That is its purpose.</P>
    <P>{`The system uses the platform's native font stack, a 4px spacing grid, 6px border radius, and borders-only elevation. Every color is greyscale. The darkest interactive tone (${C.accent}) serves as the accent. The result is a deliberately unbranded, structurally complete interface that reads as "wireframe" — not as a finished product.`}</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[
        ["No brand commitment", "System fonts, no chromatic accent, no personality. The wireframe is a structural sketch — any brand can be projected onto it later."],
        ["Greyscale hierarchy", `Seven grey values from ${C.page_bg} to ${C.text_primary} carry all visual weight. The value hierarchy is calibrated so each step is perceptually distinct.`],
        ["Borders, not shadows", `Elevation is communicated through 1px borders (${C.border_default}) only. No box-shadow, no blur, no translucency. Depth is flat and explicit.`],
        ["Universal component set", "42 components (12 primitives + 18 composites + 12 patterns) define every building block. Other systems reinterpret these — Neutral defines them."],
      ].map(([t, d], i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div>
          <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div>
        </div>))}
    </div>
    <H3>When to Use Neutral</H3>
    <Do>Wireframing and prototyping — before a visual design direction has been chosen</Do>
    <Do>Structural validation — confirming information architecture, flow, and layout work before applying brand</Do>
    <Do>As a reference implementation — the canonical baseline that all themed systems transform</Do>
    <Dont>Ship Neutral as a production design — it is deliberately unbranded and intended to be replaced</Dont>
    <Dont>Add chromatic color to Neutral — that makes it a themed system, not a wireframe</Dont>
  </div>),

  color: () => (<div>
    <P>Neutral uses a calibrated greyscale palette. Seven core values from near-white to near-black, plus four semantic colors reserved strictly for status communication. No chromatic accent exists.</P>
    <H3>Page &amp; Surface</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c={C.page_bg} n="Page Background" v={C.page_bg} b="1px solid rgba(255,255,255,0.15)" />
      <Sw c={C.surface} n="Surface" v={C.surface} b="1px solid rgba(255,255,255,0.15)" />
      <Sw c={C.surface} n="Surface Elevated" v={C.surface} b="1px solid rgba(255,255,255,0.15)" />
    </div>
    <H3>Text</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c={C.text_primary} n="Primary" v={C.text_primary} />
      <Sw c={C.text_secondary} n="Secondary" v={C.text_secondary} />
      <Sw c={C.text_muted} n="Muted / Disabled" v={C.text_muted} />
    </div>
    <H3>Interactive &amp; Structural</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c={C.accent} n="Interactive" v={C.accent} />
      <Sw c={C.border_default} n="Border" v={C.border_default} />
      <Sw c={C.text_inverse} n="Inverse (on dark)" v={C.text_inverse} b="1px solid rgba(255,255,255,0.15)" />
    </div>
    <H3>Semantic Status</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
      <Sw c={C.success} n="Success" v={C.success} />
      <Sw c={C.warning} n="Warning" v={C.warning} />
      <Sw c={C.danger} n="Danger" v={C.danger} />
      <Sw c={C.info} n="Info" v={C.info} />
    </div>
    <Do>Use semantic colors only for status communication — success, warning, danger, info. Never decorative.</Do>
    <Do>{`Maintain the greyscale value hierarchy: page (${C.page_bg}) → surface (${C.surface}) → border (${C.border_default}) → secondary (${C.text_secondary}) → interactive (${C.accent}) → primary (${C.text_primary})`}</Do>
    <Dont>Introduce any chromatic accent — that transforms Neutral into a themed system</Dont>
    <Dont>{`Use #000000 for text — ${C.text_primary} is the darkest value. Pure black is too harsh on light backgrounds.`}</Dont>

    <H3>Contrast Ratios</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Primary on Page", C.text_primary, C.page_bg], ["Primary on Surface", C.text_primary, C.surface], ["Secondary on Surface", C.text_secondary, C.surface], ["Interactive on Surface", C.accent, C.surface], ["Disabled on Surface", C.text_muted, C.surface, "Decorative only"], ["Inverse on Interactive", C.accent_foreground, C.accent]].map(([n, fg, bg, use]) => [`${n} (${fg} on ${bg})`, contrastText(fg, bg), use ?? wcagLevel(contrastRatio(fg, bg))]).map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 95px", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: r[2].includes("AAA") ? "#34D399" : r[2].includes("AA") ? "#FBBF24" : "#666" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  typography: () => (<div>
    <P>Neutral uses the platform's native system font stack. This is deliberate — wireframes should not commit to a typeface. The structure and scale carry the hierarchy, not the font's personality.</P>
    <H3>Font Families</H3>
    <div style={{ padding: 14, borderRadius: 6, border: `1px solid ${a}30`, background: `${a}04`, marginBottom: 12 }}>
      <div style={{ fontFamily: F.body, fontSize: 26, color: "#EEE", marginBottom: 4, fontWeight: 700 }}>System Sans</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: a, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Primary — structural</div>
      <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>{`${F.body}. Renders as San Francisco on macOS, Segoe UI on Windows, Roboto on Android. The wireframe intentionally uses whatever the platform provides.`}</div>
    </div>
    <div style={{ padding: 14, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)", marginBottom: 12 }}>
      <div style={{ fontFamily: F.mono, fontSize: 22, color: "#EEE", marginBottom: 4, fontWeight: 600 }}>System Mono</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: C.text_secondary, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Secondary — tokens &amp; code</div>
      <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>{`${F.mono}. Used sparingly for technical labels, code excerpts, and tabular data. Not for body text.`}</div>
    </div>
    <Do>Let the platform choose the font — that is the point of a wireframe system</Do>
    <Dont>Override system fonts with a branded typeface — that makes Neutral a themed system</Dont>
    <Dont>Use the mono stack for body text or UI labels — reserve it for code and data</Dont>

    <H3>Type Scale (Seven Sizes)</H3>
    <P>Every text element uses one of these seven sizes. The scale covers caption through display with clear perceptual steps between each role.</P>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["display", T.display, "Dashboard metrics, hero numbers"],
        ["title", T.title, "Page headings"],
        ["heading", T.heading, "Section headings"],
        ["body", T.body, "Primary content text"],
        ["secondary", T.small, "Supporting text, descriptions"],
        ["label", T.label, "Metadata, badges, captions"],
        ["caption", T.caption, "Fine print, timestamps"],
      ].map(([n, t, use]) => [n, px(t.size), String(t.weight), lh(t.line_height), use]).map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 48px 40px 36px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>
          {t.slice(1).map((v, vi) => <span key={vi} style={{ fontSize: 10, color: vi < 3 ? "#999" : "#666" }}>{v}</span>)}
        </div>))}
    </div>

    <H3>Case &amp; Tracking</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Metadata labels", "UPPERCASE", "0.05em", "Light tracking on uppercase for legibility"], ["Body text", "Mixed case", "0", "Default tracking"], ["Headers", "Mixed case", "0", "Default tracking"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 100px 60px 1fr", padding: "5px 10px", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: a }}>{r[1]}</code>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[2]}</code>
          <span style={{ fontSize: 10, color: "#777" }}>{r[3]}</span>
        </div>))}
    </div>
  </div>),

  elevation: () => (<div>
    <P>Neutral has a borders-only elevation strategy. No shadows, no blur, no translucency. Depth is communicated through surface color (page vs surface) and border weight. This is the simplest possible elevation model — other systems layer shadows and glass effects on top of it.</P>
    <H3>Border Tokens</H3>
    <Tk n="border.light" v={rule(bw.default, C.border_default)} d="Component boundaries, dividers" a={a} />
    <Tk n="border.strong" v={rule(bw.strong, C.border_strong)} d="Input focus, interactive card hover" a={a} />
    <Tk n="elevation.shadow" v="none" d="Shadows are not used" a={a} />
    <Tk n="elevation.blur" v="none" d="Backdrop-filter is not used" a={a} />

    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
      {[{ r: rad.default, l: "Default", t: "radius.default" }, { r: rad.input, l: "Inputs", t: "radius.inputs" }, { r: rad.chrome, l: "Chrome", t: "radius.chrome" }].map(item => (
        <div key={item.t} style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: item.r, border: `2px solid ${a}40`, background: "rgba(255,255,255,0.02)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <code className="mn" style={{ fontSize: 9, color: "#999" }}>{item.r}px</code>
          </div>
          <div style={{ fontSize: 9.5, color: "#CCC", fontWeight: 600 }}>{item.l}</div>
          <code className="mn" style={{ fontSize: 8.5, color: "#666" }}>{item.t}</code>
        </div>))}
    </div>
    <P>Neutral uses modest rounding (6–8px) — enough to soften rectangles without introducing a bubble aesthetic. This is a middle ground that other systems push in either direction (Swiss → 0px, Prism → 12–16px).</P>

    <H3>The 4px Grid</H3>
    <P>Every spacing value is drawn from a 4px-based scale. The allowed steps provide fine-grained control while maintaining rhythm.</P>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["4px", "Tight gaps (label to input)"], ["8px", "Compact spacing (within components)"], ["12px", "Component gap, internal padding"], ["16px", "Standard padding, sidebar items"], ["20px", "Comfortable padding"], ["24px", "Section content padding"], ["32px", "Section gap"], ["40px", "Major section breaks"], ["48px", "Page-level spacing"], ["64px", "Hero spacing"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr", padding: "5px 10px", borderBottom: i < 9 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: a }}>{r[0]}</code>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[1]}</span>
        </div>))}
    </div>
    <Do>Use 12px as the default component gap and 32px as the default section gap</Do>
    <Do>Use page margins of 12px on mobile and 32px on desktop</Do>
    <Dont>Use shadows of any kind — borders are the only depth signal</Dont>
    <Dont>Use backdrop-filter or translucency — all surfaces are fully opaque</Dont>
  </div>),

  components: () => (<div>
    <P>Neutral defines 42 components across three tiers: 12 primitives, 18 composites, and 12 patterns. Each component specifies anatomy, behavioral contract, exact token values, and do/don't rules. Click to expand.</P>

    <H4>Primitives</H4>
    <CBox title="Button" parts={["label", "icon"]} accent={a}
      contract={`The primary interactive element. 48px tall default, 6px radius. Primary variant uses ${C.accent} fill with ${C.surface} text. Secondary uses ${C.surface} fill with ${C.border_default} border and ${C.text_secondary} text. Ghost is transparent with no border.`}
      specs={[["height.default", "48px"], ["height.small", "32px"], ["height.large", "56px"], ["radius", "6px"], ["font-size", "14px"], ["font-weight", "500"], ["primary.fill", `${C.accent} (interactive)`], ["primary.text", `${C.surface} (inverse)`], ["secondary.fill", `${C.surface} (surface)`], ["secondary.stroke", `${bw.strong}px ${C.border_input}`], ["secondary.text", `${C.text_secondary} (secondary)`], ["ghost.fill", "transparent"], ["ghost.text", `${C.text_secondary} (secondary)`], ["disabled.fill", C.border_default], ["disabled.text", C.text_muted], ["danger.fill", `${C.danger} (danger)`], ["danger.text", `${C.surface} (inverse)`]]}
      dos={["Use only one primary button per screen — it represents the primary action", "Use the danger variant only for irreversible destructive actions"]}
      donts={["Use more than one primary button in a view", "Use ghost buttons where the action needs visual weight"]} />

    <CBox title="Input" parts={["placeholder", "value", "focus", "clear"]} accent={a}
      contract={`48px tall text input field. 6px radius, ${C.surface} fill, ${bw.strong}px ${C.border_input} stroke. Placeholder text in ${C.text_muted}, entered value in ${C.text_primary}. Variants: text, password, search, numeric.`}
      specs={[["height", "48px"], ["radius", "6px"], ["fill", `${C.surface} (surface)`], ["stroke", `${bw.strong}px ${C.border_input}`], ["placeholder.color", `${C.text_muted} (disabled)`], ["value.color", `${C.text_primary} (primary)`], ["value.font-size", "14px"], ["focus.stroke", `${bw.strong}px ${C.focus_ring} (interactive)`]]}
      dos={["Always pair inputs with a label via the form_field composite", `Use ${C.text_muted} for placeholders to clearly distinguish from entered values`]}
      donts={["Style inputs without a visible border — the 1.5px stroke is required", "Use placeholder text as a substitute for a label"]} />

    <CBox title="Avatar" parts={["identifier", "status_dot"]} accent={a}
      contract={`32x32 circle identifier. Monogram variant: ${C.border_default} fill with 2-letter initials in ${C.text_secondary}. Photo placeholder variant: diagonal stripe pattern. Optional status dot (8px) positioned bottom-right.`}
      specs={[["size", "32x32"], ["radius", "16px (full circle)"], ["monogram.fill", C.border_default], ["monogram.text", `${C.text_secondary}, 600 weight`], ["status.size", "8px circle"], ["status.online", `${C.success} (success)`]]}
      dos={["Use monogram as the default avatar — it works without user photos"]}
      donts={["Use avatars larger than 32px in list contexts — save space for content"]} />

    <CBox title="Badge" parts={["text", "shape"]} accent={a}
      contract={`Small indicator element. Count variant: pill (16–20px tall, 10px radius), ${C.accent} fill, white digit. Status variant: semantic color fill. Tag variant: ${C.surface} fill with ${C.border_default} border. Dot variant: 8px circle.`}
      specs={[["count.fill", `${C.accent} (interactive)`], ["count.text", `${C.surface}, 11px, 600`], ["count.radius", "10px"], ["status.fill", "Semantic color"], ["status.text", `${C.surface}, 10px, 600, UPPER`], ["tag.fill", C.surface], ["tag.stroke", `${bw.default}px ${C.border_default}`], ["tag.text", `${C.text_secondary}, 12px`], ["dot.size", "8px circle"]]}
      dos={["Use count badges sparingly — only for unread or notification counts"]}
      donts={["Stack multiple badge types on the same element"]} />

    <H4>Composites</H4>
    <CBox title="Card" parts={["container", "content", "border"]} accent={a}
      contract={`The universal container. 6px radius, ${C.surface} fill, ${bw.default}px ${C.border_default} stroke, 16px internal padding. Cards are the primary boundary pattern — every distinct content group lives in one.`}
      specs={[["radius", "6px"], ["fill", `${C.surface} (surface)`], ["stroke", `${bw.default}px ${C.border_default}`], ["padding", "16px all sides"], ["hover.stroke", `${bw.strong}px ${C.border_input} (interactive cards only)`], ["selected.stroke", `2px ${C.accent}`], ["empty.stroke", `dashed ${C.border_default}`]]}
      dos={["Use cards for any distinct content with a clear boundary", "Keep card padding consistent at 16px — component_gap (12px) for sub-elements"]}
      donts={["Nest cards inside cards — use dividers instead", "Add shadow to cards — border is the only elevation signal"]} />

    <CBox title="ListItem" parts={["avatar", "title", "preview", "timestamp", "badge"]} accent={a}
      contract={`64–96px tall row. Avatar (32px) on left, title (14px ${C.text_primary}) and preview (12px ${C.text_secondary}) stacked. Timestamp top-right (11px ${C.text_secondary}). Optional badge on right. Selection signaled by ${C.page_bg} background, never by accent bar.`}
      specs={[["height", "64-96px"], ["avatar", "32px, left-aligned"], ["title.font", `14px, 500 weight, ${C.text_primary}`], ["title.selected", "600 weight"], ["preview.font", `12px, ${C.text_secondary}, truncate with ellipsis`], ["timestamp.font", `11px, ${C.text_secondary}`], ["divider", `${bw.default}px ${C.border_default} below`], ["selected.bg", C.page_bg]]}
      dos={["Truncate preview text with ellipsis — never wrap to multiple lines", `Use background fill (${C.page_bg}) alone for selection — no colored accent bars`]}
      donts={["Use a chromatic accent bar for selection — Neutral has no accent color", "Omit the bottom divider — list items need visible separation"]} />

    <CBox title="Stat" parts={["value", "label", "trend"]} accent={a}
      contract={`Dashboard metric display. Value in 24px ${C.text_primary} weight 700 (display role). Label in 12px ${C.text_secondary} weight 600 uppercase tracked above value. Optional trend indicator below.`}
      specs={[["value.font", `24px, 700, ${C.text_primary}`], ["label.font", `12px, 600, UPPER, 0.05em tracking, ${C.text_secondary}`], ["trend.positive", `${C.success} (success)`], ["trend.negative", `${C.danger} (danger)`]]}
      dos={["Place labels above values — the label provides context before the number"]}
      donts={["Use display type sizes (24px) for non-metric content"]} />

    <H4>Patterns</H4>
    <CBox title="Sidebar" parts={["brand", "search", "nav_list", "footer"]} accent={a}
      contract={`Fixed width 240–280px, full viewport height. ${C.surface} fill, ${bw.default}px ${C.border_default} right border. Brand area at top, search input, nav items in middle, account footer at bottom.`}
      specs={[["width", "240-280px"], ["fill", `${C.surface} (surface)`], ["border-right", `${bw.default}px ${C.border_default}`], ["brand.height", "64-80px"], ["nav.active.bg", C.page_bg], ["nav.item.font", `14px, ${C.text_primary} active / ${C.text_secondary} inactive`]]}
      dos={[`Use uppercase tracked section labels (12px ${C.text_secondary}) to group nav items`]}
      donts={[`Use a chromatic highlight for active nav items — ${C.page_bg} background only`]} />

    <CBox title="Modal" parts={["overlay", "container", "title", "body", "actions"]} accent={a}
      contract="Centered card on semi-transparent overlay. 480px wide on desktop, full-width minus margins on mobile. 8px radius. Title at top, body content, button row at bottom-right."
      specs={[["overlay", X.overlay_scrim], ["width.default", "480px"], ["width.confirm", "360px"], ["width.form", "560-640px"], ["radius", "8px"], ["title.font", `16px, 600, ${C.text_primary}`], ["close.position", "top-right"]]}
      dos={["Use the confirmation variant (360px) for simple yes/no decisions"]}
      donts={["Stack modals on top of modals — use a single modal at a time"]} />

    <CBox title="Dashboard" parts={["sidebar", "header", "stats", "cards"]} accent={a}
      contract="Full-page layout combining sidebar, header, and content area. Four variants: metrics-heavy (stat grid), conversation (chat), list-focus (scrollable list), and mixed (overview)."
      specs={[["sidebar.width", "240-280px"], ["header.height", "56px mobile / 64px desktop"], ["stat.grid", "3-4 columns on desktop"], ["content.padding", "24-32px"]]}
      dos={["Choose the variant that matches the primary content type"]}
      donts={["Mix variant patterns — pick one and commit"]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Neutral layouts. These patterns define how components arrange into screens.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width", `240–280px fixed, ${C.surface} surface`], ["Main area", `Fluid, fills remaining, ${C.page_bg} page background`], ["Divider", `${rule(bw.default, C.border_default)} (right border of sidebar)`], ["Brand area", "64–80px tall, top of sidebar"], ["Nav items", `Active: ${C.page_bg} bg + 600 weight. Inactive: transparent + 400 weight.`]] },
      { n: "Message Thread", rows: [["Direction", "Vertical stack, chronological"], ["User messages", `Right-aligned, ${C.accent} fill, ${C.surface} text, 8px radius`], ["AI messages", `Left-aligned, ${C.surface} fill, ${C.text_primary} text, ${bw.default}px ${C.border_default} border, 8px radius`], ["Max width", "72% of container"], ["Gap", "12–16px between messages"], ["Sender label", `11px ${C.text_secondary}, above bubble`]] },
      { n: "Selection Model", rows: [["Signaling", `${C.page_bg} background fill — no accent bar, no chromatic indicator`], ["Title weight", "Bumps from 500 to 600 on selection"], ["Transition", "Instant — no animation on selection change"], ["Focus outline", `${rule(bw.focus, C.focus_ring)} offset 2px (keyboard focus)`]] },
      { n: "Mobile-First Expansion", rows: [["Mobile viewport", "375px width"], ["Desktop viewport", "1280px width"], ["Expansion: two-column", "60% main / 40% panel, 24px gap"], ["Expansion: card grid", "2–3 columns, 16px gap"], ["Expansion: centered", "Max 640px content width"], ["Expansion: left sidebar", "200–280px sidebar"]] },
      { n: "Empty & Error States", rows: [["Empty icon", `64x64 placeholder in ${C.text_muted}`], ["Empty title", `16px ${C.text_primary}, weight 600`], ["Empty description", `13px ${C.text_secondary}, max 2 lines`], ["Error variant", "Same layout with retry button"], ["First-use variant", "Stronger primary CTA (Get Started)"]] },
    ].map((p, pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4>
      <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        {p.rows.map((r, ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "160px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
        </div>))}
      </div>
    </div>))}
  </div>),

  extensions: () => (<div>
    <H3>1. The Greyscale Value Hierarchy</H3>
    <P>Neutral's defining characteristic is its calibrated greyscale. Seven values are arranged in a perceptual hierarchy where each step serves a distinct role. The system never reaches pure black (#000) or pure white (#FFF for page) — the endpoints are softened for comfort.</P>
    <Tk n={C.page_bg} v="Page background" d="The canvas — everything sits on this" a={a} />
    <Tk n={C.surface} v="Surface" d="Cards, panels, headers — elevated above page" a={a} />
    <Tk n={C.border_default} v="Border" d="Boundaries, dividers — structural lines" a={a} />
    <Tk n={C.text_muted} v="Disabled / muted" d="Placeholder text, inactive elements" a={a} />
    <Tk n={C.text_secondary} v="Secondary text" d="Labels, metadata, descriptions" a={a} />
    <Tk n={C.accent} v="Interactive" d="Buttons, links, active states — the 'accent'" a={a} />
    <Tk n={C.text_primary} v="Primary text" d="Headings, body copy — the strongest value" a={a} />
    <Do>{`Treat ${C.accent} as the accent — it is the only value used for interactive fills`}</Do>
    <Do>{`Maintain perceptual separation between adjacent values — ${C.text_secondary} and ${C.accent} should feel like different tones`}</Do>
    <Dont>Use #000000 or #FFFFFF as page backgrounds — they are too extreme for wireframes</Dont>

    <H3>2. Borders-Only Elevation</H3>
    <P>Neutral communicates depth exclusively through surface color and border weight. There are no shadows, no blur, no translucency. This is the simplest elevation model — it makes the wireframe feel flat and structural, which is the intent.</P>
    <Tk n="border.light" v={rule(bw.default, C.border_default)} d="Standard container boundary" a={a} />
    <Tk n="border.strong" v={rule(bw.strong, C.border_strong)} d="Focus state, hover emphasis" a={a} />
    <Tk n="depth.signal" v="Surface color only" d={`${C.page_bg} → ${C.surface} indicates 'above'`} a={a} />
    <Do>{`Use the page-to-surface color shift (${C.page_bg} → ${C.surface}) as the primary depth cue`}</Do>
    <Do>Use 1.5px borders for interactive hover states to signal affordance</Do>
    <Dont>Add any box-shadow, drop-shadow, or backdrop-filter</Dont>

    <H3>3. Universal Component Library</H3>
    <P>Neutral defines 42 components that form the complete wireframe vocabulary. Every other design system reinterprets these same 42 components through its own visual grammar. The neutral versions are the canonical reference.</P>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {[
        ["12 Primitives", "button, input, textarea, select, checkbox, radio, toggle, label, icon, avatar, badge, divider"],
        ["18 Composites", "card, list_item, form_field, table_row, table_header, nav_item, tab_item, breadcrumb_trail, pagination, toast, stat, key_value, button_group, search_bar, banner, accordion_item, stepper, dropdown_menu"],
        ["12 Patterns", "sidebar, header, form, data_table, modal, drawer, empty_state, command_palette, settings_layout, article, dashboard, auth"],
      ].map(([t, d]) => (
        <div key={t} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 4 }}>{t}</div>
          <div style={{ fontSize: 9.5, color: "#777", lineHeight: 1.5 }}>{d}</div>
        </div>))}
    </div>

    <H3>4. Placeholder Content Conventions</H3>
    <P>Wireframes use realistic but obviously fictitious sample data. This makes the wireframe feel alive without confusing it with production data.</P>
    <Tk n="names" v="Alex Rivera, Jordan Chen, Sam Okafor, Taylor Kim, Robin Patel" a={a} />
    <Tk n="organizations" v="Northwind Trading, Blue Harbor Consulting, Ridge Valley Health" a={a} />
    <Tk n="emails" v="user@example.com" a={a} />
    <Tk n="dates" v="MM/DD/YYYY format" a={a} />
    <Tk n="body_text" v="Lorem ipsum dolor sit amet, consectetur adipiscing elit." a={a} />
  </div>),

  voice: () => (<div>
    <P>Neutral speaks in plain, functional language. No personality, no warmth, no brand voice. Labels describe what they label. Buttons say what they do. Errors say what went wrong. Nothing more.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Plain", "Functional", "Descriptive", "Neutral"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never branded", "Never emotional"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>

    <H3>Placeholder &amp; State Text</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Input placeholder", "Type a message...", "Descriptive, lowercase"],
        ["Search placeholder", "Search", "Single word"],
        ["Empty list", "No items yet", "Plain statement"],
        ["Loading", "Loading...", "Trailing ellipsis"],
        ["Error", "Something went wrong. Try again.", "What happened + what to do"],
        ["Success", "Saved", "Past-tense verb"],
        ["Confirm destructive", "Delete this item?", "Action + object + question mark"],
      ].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <span style={{ fontSize: 11, color: C.text_primary, fontFamily: F.body, background: C.page_bg, padding: "2px 6px", display: "inline-block", borderRadius: 3, fontWeight: 500 }}>{p[1]}</span>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>))}
    </div>

    <H3>Vocabulary</H3>
    <Do>Use common, unambiguous verbs: Save, Send, Delete, Cancel, Create, Edit, Close</Do>
    <Do>Use sentence case for all text — including buttons and labels</Do>
    <Dont>Use branded language, marketing copy, or personality-driven phrasing</Dont>
    <Dont>Use jargon, abbreviations, or technical terms in user-facing labels</Dont>

    <H3>Error Messages</H3>
    <P>Neutral error messages follow a strict pattern: what happened, then what the user can do about it.</P>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
      {[["Connection lost", "Check your connection and try again."], ["File too large", "Maximum file size is 10MB."], ["Permission denied", "You don't have access to this resource."], ["Not found", "This page doesn't exist."]].map(([t, d]) => (
        <div key={t} style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#DDD", marginBottom: 2 }}>{t}</div>
          <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>{d}</div>
        </div>))}
    </div>
  </div>),
};}

/* ═══════════════════════════════════════════════════════════════
   THEME VIEW + MAIN SHELL
   ═══════════════════════════════════════════════════════════════ */
function ThemeView({ sec, setSec, sel, setSel }) {
  const specSections = [
    { id: "preview", l: "⬡ Preview" }, { id: "overview", l: "Overview" }, { id: "color", l: "Color" }, { id: "typography", l: "Typography" },
    { id: "elevation", l: "Elevation" }, { id: "components", l: "Components" }, { id: "patterns", l: "Patterns" },
    { id: "extensions", l: "Extensions" }, { id: "voice", l: "Voice & Tone" },
  ];
  const spec = neutralSpec(TM.color);
  return (<div style={{ display: "flex", minHeight: "100%" }}>
    <div style={{ width: 160, minWidth: 160, borderRight: "1px solid rgba(255,255,255,0.05)", padding: "10px 0" }}>
      {specSections.map(s => (
        <div key={s.id} onClick={() => setSec(s.id)} style={{ padding: "6px 12px", cursor: "pointer", background: sec === s.id ? "rgba(255,255,255,0.03)" : "transparent", borderLeft: sec === s.id ? `2px solid ${TM.color}` : "2px solid transparent" }}>
          <span style={{ fontSize: 11, fontWeight: sec === s.id ? 600 : 400, color: sec === s.id ? (s.id === "preview" ? TM.color : "#EEE") : "#777" }}>{s.l}</span>
        </div>
      ))}
    </div>
    <div key={sec} style={{ flex: 1, padding: "18px 28px", overflowY: "auto", animation: "fadeIn 0.2s ease" }}>
      <div style={{ maxWidth: 760 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#FFF", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: TM.color }}>{specSections.find(s => s.id === sec)?.l}</span>
        </h2>
        {sec === "preview" ? <PreviewView sel={sel} setSel={setSel} /> : spec[sec]?.()}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const readSection = () => { const s = window.location.hash.slice(1).split("/")[1]; return s || "preview"; };
  const [sec, setSecRaw] = useState(readSection);
  const [sel, setSel] = useState(1);
  const setSec = useCallback((id) => { const sys = window.location.hash.slice(1).split("/")[0]; window.location.hash = sys + "/" + id; }, []);
  useEffect(() => { const h = () => setSecRaw(readSection()); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0A0A0A", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#EEE" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box }
        .mn { font-family: 'JetBrains Mono', monospace }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05) }
        .app-sh { display: flex; width: 100%; height: 100%; overflow: hidden }
        .sb { width: 280px; min-width: 280px; display: flex; flex-direction: column; overflow: hidden }
        .cl { flex: 1; overflow-y: auto }
        .ca { flex: 1; display: flex; flex-direction: column; overflow: hidden }
        .ma { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px }
        .si { border: none; outline: none; background: transparent; flex: 1; font-size: 12px; width: 100% }
        input::placeholder { opacity: 0.5 }
        .snd { cursor: pointer; transition: opacity ${motion(tokens, "fast")}; flex-shrink: 0 }
        .snd:hover { opacity: 0.75 }
        .mi { animation: fadeSlideUp ${motion(tokens, "slow")} both }
        .ci { animation: fadeSlideUp ${motion(tokens, "moderate")} both }
        .ci:hover { background: ${C.surface_selected} !important }
        .bc-nt:hover { background: ${C.page_bg} !important }
        ${reducedMotionCss(tokens, { scope: ".app-sh", animated: [".mi", ".ci"] })}
      `}</style>

      {/* TOP NAV */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", height: 40 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#EEE", marginRight: 20, letterSpacing: "-0.02em" }}>Design System</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: TM.color, marginRight: 20, borderBottom: `2px solid ${TM.color}`, height: 40, display: "flex", alignItems: "center", padding: "0 4px" }}>{TM.name}</span>
        <span style={{ fontSize: 10, color: "#555" }}>{TM.tag}</span>
        <div style={{ marginLeft: "auto", fontSize: 9, color: "#333" }}>v1.0 · standalone</div>
      </div>

      <div style={{ padding: "4px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)", display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 9, color: TM.color }}>{TM.name}</span>
        <span style={{ fontSize: 9, color: "#2A2A2A" }}>›</span>
        <span style={{ fontSize: 9, color: "#666" }}>{sec}</span>
      </div>

      <div key={sec} style={{ minHeight: "calc(100vh - 40px)", animation: "fadeIn 0.2s ease" }}>
        <ThemeView sec={sec} setSec={setSec} sel={sel} setSel={setSel} />
      </div>
    </div>
  );
}
