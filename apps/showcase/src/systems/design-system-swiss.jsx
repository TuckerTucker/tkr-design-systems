import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — SWISS
   Grid-strict + Rams Heritage · Single-theme standalone spec + live preview
   ═══════════════════════════════════════════════════════════════ */

const TM = { name: "Swiss", tag: "Grid-strict + Rams Heritage", color: "#E3000B" };

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
const Sw = ({ c, n, v, b }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}><div style={{ width: 24, height: 24, borderRadius: 0, background: c, border: b || "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} /><div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#CCC" }}>{n}</div><code className="mn" style={{ fontSize: 9, color: "#666" }}>{v}</code></div></div>;
const H3 = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, color: "#EEE", margin: "22px 0 10px", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</h3>;
const H4 = ({ children }) => <h4 style={{ fontSize: 11.5, fontWeight: 600, color: "#CCC", margin: "16px 0 6px" }}>{children}</h4>;
const P = ({ children }) => <p style={{ fontSize: 12, color: "#999", lineHeight: 1.6, margin: "0 0 10px" }}>{children}</p>;
const Do = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 0, marginBottom: 4, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#34D399", flexShrink: 0 }}>✓</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Dont = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 0, marginBottom: 4, background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#FF6B6B", flexShrink: 0 }}>✗</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Pill = ({ children, color }) => <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 0, background: `${color}10`, border: `1px solid ${color}25`, color, fontWeight: 600 }}>{children}</span>;

const CBox = ({ title, parts, contract, specs, dos, donts, accent }) => {
  const [open, setOpen] = useState(false);
  return (<div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
    <div onClick={() => setOpen(!open)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: open ? "rgba(255,255,255,0.02)" : "transparent" }}>
      <span style={{ fontSize: 9, color: "#555", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      <span className="mn" style={{ fontSize: 12, fontWeight: 700, color: "#EEE" }}>{title}</span>
      <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>{parts.map(p => <code key={p} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 0, background: "rgba(255,255,255,0.03)", color: "#666" }}>{p}</code>)}</div>
    </div>
    {open && <div style={{ padding: "0 14px 14px" }}>
      <div style={{ padding: "8px 12px", borderRadius: 0, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 10 }}>
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
function SwissChat({ sel, setSel }) {
  return (
    <div className="app-sh" style={{ background: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", borderRadius: 0, border: "1px solid #E0E0E0", color: "#000000" }}>
      {/* Sidebar */}
      <div className="sb" style={{ borderRight: "1px solid #E0E0E0" }}>
        <div style={{ padding: "16px 16px 16px", borderBottom: "1px solid #000000" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#000", letterSpacing: "-0.02em", lineHeight: 1 }}>Swiss</div>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#949494", fontWeight: 600, marginTop: 8 }}>Messages — {String(chatList.length).padStart(2, '0')}</div>
        </div>

        <div style={{ padding: "16px", borderBottom: "1px solid #E0E0E0" }}>
          <input placeholder="Search" className="si" style={{ fontFamily: "'Inter', sans-serif", color: "#000", fontSize: 12 }} />
        </div>

        <div className="cl">
          {chatList.map((c, i) => (
            <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "16px", borderBottom: "1px solid #F0F0F0", background: sel === c.id ? "#F5F5F5" : "transparent", borderLeft: sel === c.id ? `2px solid ${TM.color}` : "2px solid transparent", cursor: "pointer", animationDelay: `${i * 40}ms` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#949494", fontWeight: 600 }}>{String(i + 1).padStart(2, '0')} / {chatList.length}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#949494", fontWeight: 500 }}>{c.time}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#000", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{c.name}</div>
              <div style={{ fontSize: 11, color: "#5A5A5A", marginTop: 4, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</div>
              {c.unread > 0 && <div style={{ fontSize: 32, fontWeight: 700, color: TM.color, letterSpacing: "-0.04em", marginTop: 8, lineHeight: 1 }}>{String(c.unread).padStart(2, '0')}</div>}
            </div>
          ))}
        </div>

        <div style={{ padding: "16px", borderTop: "1px solid #000000" }}>
          <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#949494", fontWeight: 600 }}>Account</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#000", letterSpacing: "-0.01em", marginTop: 4 }}>T. Harris</div>
        </div>
      </div>

      {/* Main */}
      <div className="ca">
        <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #000000" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#949494", fontWeight: 600 }}>Thread · 01</div>
            <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: TM.color, fontWeight: 700 }}>● Active</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#000", letterSpacing: "-0.025em", lineHeight: 1 }}>Tokyo Trip</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: "#000", letterSpacing: "-0.04em", lineHeight: 1 }}>{String(msgs.length).padStart(2, '0')}</div>
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#949494", fontWeight: 600, marginTop: 6 }}>Exchanges</div>
        </div>

        <div className="ma" style={{ padding: "24px" }}>
          {msgs.map((m, i) => (
            <div key={m.id} className="mi" style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "72%", textAlign: m.sender === "user" ? "right" : "left", animationDelay: `${i * 70}ms` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: m.sender === "user" ? "flex-end" : "flex-start", marginBottom: 6 }}>
                <span style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: m.sender === "user" ? TM.color : "#949494", fontWeight: 700 }}>
                  {m.sender === "user" ? "You" : "Assistant"}
                </span>
                <span style={{ fontSize: 9, letterSpacing: "0.12em", color: "#949494", fontWeight: 500 }}>— {String(i + 1).padStart(2, '0')}</span>
              </div>
              <div style={{ fontSize: 14, color: "#000", lineHeight: 1.55, letterSpacing: "-0.005em", fontWeight: 400 }}>{m.text}</div>
            </div>
          ))}

          <div className="mi" style={{ alignSelf: "flex-start", maxWidth: "100%", animationDelay: "320ms" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#949494", fontWeight: 700, marginBottom: 8 }}>Options — 04</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, borderTop: "1px solid #000", borderLeft: "1px solid #000" }}>
              {[["01", "Temples"], ["02", "Ramen"], ["03", "Culture"], ["04", "Parks"]].map(([n, l], ti) => (
                <div key={ti} className="bc-sw" style={{ padding: "12px", borderRight: "1px solid #000", borderBottom: "1px solid #000", cursor: "pointer" }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#949494", fontWeight: 600, marginBottom: 8 }}>{n}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#000", letterSpacing: "-0.01em" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "16px 24px", borderTop: "1px solid #000000" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <input placeholder="Type" className="si" style={{ fontFamily: "'Inter', sans-serif", color: "#000", fontSize: 14 }} />
            <div className="snd" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: TM.color }}>Send →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const notes = [
    "Inter at four fixed sizes only — 9, 11, 13, 14, 22, 32, 40. No in-between values.",
    "Single accent (#E3000B) used only on CTAs, selection bars, user tags, active status",
    "Unread counts rendered as 32px numerals (01, 02) — typography replaces badges",
    "Tracked uppercase labels at 0.16em — the Swiss small-caps rhythm",
    "Border-radius: 0 everywhere. Zero shadows. Structure via 1px rules only.",
    "No chat bubbles — messages are left-aligned blocks with labels above",
    "8px grid enforced: every padding value is 8, 16, 24 px. Nothing in-between.",
    "Numerical hierarchy: index (01/05), count (04), ID (01) visible everywhere",
  ];
  return (<div>
    <P>Live implementation of the Swiss design system. Every token, component, and pattern from the spec applied to a working interface. Click sidebar items to see selection state behavior.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 480, borderRadius: 0, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <SwissChat sel={sel} setSel={setSel} />
      </div>
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Design tokens in action</div>
        {notes.map((n, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 0, border: `1px solid ${TM.color}20`, background: `${TM.color}06`, marginBottom: 4, fontSize: 10, color: "#BBB", lineHeight: 1.4 }}>
            <span style={{ color: TM.color, marginRight: 4 }}>→</span>{n}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   SWISS SPEC
   ═══════════════════════════════════════════════════════════════ */
function swissSpec(a) { return {
  overview: () => (<div>
    <P>Swiss is a grid-strict interface aesthetic in the Dieter Rams / Müller-Brockmann lineage. A single neo-grotesk typeface (Inter), a fixed 8-point grid, pure black ink on white paper, and a single saturated red reserved for actions and marks. Whitespace is the feature, not the absence of one.</P>
    <P>Its identity comes from restraint and precision. There is exactly one accent color. There are exactly seven type sizes. Border-radius is exactly zero. If a decision can be removed, it should be. What remains is the typography.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[
        ["Less, but better","Every element must earn its place. If removing a border, color, or decorative touch doesn't break meaning, remove it. Restraint is the style."],
        ["Typography is the grid","Type sizes, weights, and letter-spacing carry all hierarchy. The system uses seven fixed sizes (9, 11, 13, 14, 22, 32, 40). No intermediates."],
        ["One accent, one meaning","Red (#E3000B) appears only on: CTAs, active-selection rules, user-message tags, status markers. Never decorative. Never as a fill."],
        ["Numbers are visible","Counts, indices, and IDs render as typographic elements (01 / 05, 04, 02). The system exposes quantity as a first-class design material."],
      ].map(([t, d], i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div>
          <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div>
        </div>))}
    </div>
    <H3>When to Use Swiss</H3>
    <Do>Professional / enterprise tools, precise data applications, financial &amp; legal software, reference systems, engineering dashboards</Do>
    <Do>Brands that value clarity, precision, and neutrality over warmth or personality</Do>
    <Dont>Consumer entertainment, social, or play-oriented products — Swiss is too austere</Dont>
    <Dont>Products that want visible warmth or personality — use Sketch or Editorial instead</Dont>
  </div>),

  color: () => (<div>
    <P>Swiss uses an ascetic palette. Two grays, one black, one red. No tints, no shades, no decorative accents. Each color has a fixed role and never crosses it.</P>
    <H3>Ink &amp; Paper</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#FFFFFF" n="Paper" v="#FFFFFF" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#F5F5F5" n="Paper Subtle" v="#F5F5F5" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#000000" n="Ink" v="#000000" b="1px solid rgba(255,255,255,0.2)" />
    </div>
    <H3>Text</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#000000" n="Primary" v="#000000" b="1px solid rgba(255,255,255,0.2)" />
      <Sw c="#5A5A5A" n="Secondary" v="#5A5A5A" />
      <Sw c="#949494" n="Tertiary / Labels" v="#949494" />
      <Sw c="#C8C8C8" n="Placeholder" v="#C8C8C8" />
    </div>
    <H3>Accent Red</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#E3000B" n="Accent" v="#E3000B" />
      <Sw c="#B50008" n="Accent Deep (hover)" v="#B50008" />
      <Sw c="#FCE6E7" n="Accent Tint (rare)" v="#FCE6E7" />
    </div>
    <Do>Use red exclusively for: send actions, active-selection left bars, user-message tags, live-status dots, unread counts</Do>
    <Dont>Use red as a background fill on anything — red is always type or a 2px accent bar</Dont>
    <Dont>Use tints or shades of red in the middle of the palette — #E3000B only (deep variant for hover)</Dont>

    <H3>Structural Colors</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#F0F0F0" n="Rule Hairline" v="#F0F0F0" />
      <Sw c="#E0E0E0" n="Rule Default" v="#E0E0E0" />
      <Sw c="#000000" n="Rule Strong" v="#000000" b="1px solid rgba(255,255,255,0.15)" />
    </div>
    <H3>Contrast Ratios</H3>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Ink on Paper","21:1","AAA"],["Secondary on Paper","7.5:1","AAA"],["Tertiary on Paper","3.8:1","AA (lg)"],["Accent red on Paper","5.9:1","AA"],["Ink on Accent red","3.6:1","AA (lg)"],["Rule default on Paper","1.25:1","Decorative only"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 95px", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: r[2].includes("AAA") ? "#34D399" : r[2].includes("AA") ? "#FBBF24" : "#666" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  typography: () => (<div>
    <P>Swiss uses a single neo-grotesk typeface for the entire system. The ideal is Neue Haas Grotesk or Helvetica Now. For web, Inter serves as the open-source stand-in. No secondary family exists.</P>
    <H3>Font Family</H3>
    <div style={{ padding: 14, borderRadius: 0, border: `1px solid ${a}30`, background: `${a}04`, marginBottom: 12 }}>
      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 26, color: "#EEE", marginBottom: 4, fontWeight: 700, letterSpacing: "-0.03em" }}>Inter</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: a, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>The only family</div>
      <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Used for every word in the system. Body, headings, labels, metadata, buttons, numerals. Preferred alternatives: Neue Haas Grotesk Display, Helvetica Now, Söhne. Fallback: system-ui.</div>
    </div>
    <Do>Use weight + size + case + tracking to create all hierarchy</Do>
    <Do>Use negative letter-spacing (-0.02em to -0.04em) on display sizes ≥22px</Do>
    <Dont>Introduce a secondary family (serif, mono, script) for any purpose</Dont>
    <Dont>Use italic — Swiss is upright; italic reads as foreign</Dont>

    <H3>Type Scale (Fixed — Seven Sizes Only)</H3>
    <P>Swiss forbids intermediate sizes. Every text element in the system uses one of these exactly. If a value between 13 and 14 "feels right," choose 13 or 14 — never 13.5.</P>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["display-lg","40px","700","1.0","-0.04em","Count displays (03, 12)"],
        ["display","32px","700","1.0","-0.04em","Unread counts in sidebar"],
        ["title","22px","700","1.0","-0.025em","Thread titles, masthead"],
        ["body","14px","400","1.55","-0.005em","Message text"],
        ["item","13px","600","1.2","-0.01em","Sidebar item titles"],
        ["preview","11px","400","1.4","0","Preview text, caption"],
        ["label","9px","600–700","1.3","0.16em UPPER","All metadata + labels"],
      ].map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 48px 50px 38px 80px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none", background: t[0] === "label" ? `${a}06` : "transparent" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>
          {t.slice(1).map((v, vi) => <span key={vi} style={{ fontSize: 10, color: vi < 4 ? "#999" : "#666" }}>{v}</span>)}
        </div>))}
    </div>

    <H3>Letter-Spacing Rules</H3>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Display (≥22px)", "-0.025em to -0.04em", "Tighter for larger sizes"], ["Body (13–14px)", "-0.005em to -0.01em", "Slight optical tightening"], ["Preview (11px)", "0", "Default"], ["Labels (9px UPPER)", "0.16em", "Open up for smallcap effect"], ["Labels (9px UPPER, alt)", "0.14em", "Softer variant for subheads"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 130px 1fr", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: a }}>{r[1]}</code>
          <span style={{ fontSize: 10, color: "#777" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  elevation: () => (<div>
    <P>Swiss has no elevation system. No shadows, no blurs, no translucency, no rounded corners. Depth is communicated through typography (weight, size, tracking) and whitespace. Rules (1px horizontal and vertical borders) define containers.</P>
    <H3>Rule Tokens</H3>
    <Tk n="rule.hairline" v="1px solid #F0F0F0" d="Between sidebar items" a={a} />
    <Tk n="rule.default" v="1px solid #E0E0E0" d="Standard boundaries" a={a} />
    <Tk n="rule.strong" v="1px solid #000000" d="Section separators, inputs" a={a} />
    <Tk n="rule.accent" v="2px solid #E3000B" d="Active-selection left bar only" a={a} />

    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
      {[{ r: 0, l: "All elements", t: "radius.none" }].map(item => (
        <div key={item.t} style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: item.r, border: `2px solid ${a}40`, background: "rgba(255,255,255,0.02)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <code className="mn" style={{ fontSize: 9, color: "#999" }}>{item.r}px</code>
          </div>
          <div style={{ fontSize: 9.5, color: "#CCC", fontWeight: 600 }}>{item.l}</div>
          <code className="mn" style={{ fontSize: 8.5, color: "#666" }}>{item.t}</code>
        </div>))}
    </div>
    <Dont>Use border-radius greater than 0 anywhere — this is a structural rule</Dont>

    <H3>The 8-Point Grid</H3>
    <P>Every spacing value in Swiss is a multiple of 8. Padding, margin, gap, and size values come from a closed set: 8, 16, 24, 32, 40, 48, 64. No intermediate values exist.</P>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Base unit", "8px"], ["Sidebar item padding", "16px"], ["Section padding", "24px"], ["Major section gap", "32px"], ["Container margin", "40px"], ["Generous whitespace", "48px"], ["Hero spacing", "64px"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "160px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: a }}>{r[1]}</code>
        </div>))}
    </div>
    <Do>Snap every spacing value to the 8-point scale — no 10, 12, 18, or 20</Do>
    <Do>Use whitespace as a design element — generous negative space is the Swiss texture</Do>
    <Dont>Use shadows of any kind (box-shadow, drop-shadow, text-shadow, filter)</Dont>
  </div>),

  components: () => (<div>
    <P>Each component specifies anatomy, behavioral contract, exact token values, and do/don't rules. Click to expand.</P>

    <CBox title="ThreadMessage" parts={["label-row", "body"]} accent={a}
      contract="Render messages as typographic blocks — never bubbles or cards. Small sender tag above in uppercase tracked labels, body in Inter 14px. User messages right-aligned, assistant messages left-aligned. No container, no background."
      specs={[["padding", "0", "No intrinsic padding"], ["max-width", "72%"], ["label-row.font", "Inter, 9px, 700, 0.16em UPPER"], ["label-row.gap", "8px"], ["label.assistant", "Color #949494, 'Assistant'"], ["label.user", "Color #E3000B, 'You'"], ["index.format", "'— 01', '— 02'"], ["body.font", "Inter, 14px, 400"], ["body.color", "#000000"], ["body.line-height", "1.55"], ["body.letter-spacing", "-0.005em"]]}
      dos={["Render user messages right-aligned; assistant left-aligned — structural, not decorative", "Use the red sender tag (YOU) as the only color cue for user messages"]}
      donts={["Wrap messages in bordered containers, bubbles, or backgrounds — messages are prose", "Use avatars or icons next to sender tags — typography alone"]} />

    <CBox title="SidebarItem" parts={["index", "time", "name", "preview", "count"]} accent={a}
      contract="Render each thread as a stacked typographic block. Index label on top-left, time on top-right. Name in 13px/600, preview in 11px/400. Unread count rendered as 32px numeral below preview."
      specs={[["padding", "16px"], ["border-bottom", "1px solid #F0F0F0"], ["border-left.selected", "2px solid #E3000B"], ["border-left.unselected", "2px solid transparent"], ["background.selected", "#F5F5F5"], ["index.format", "'01 / 05'"], ["index.font", "Inter, 9px, 600, 0.14em UPPER"], ["index.color", "#949494"], ["name.font", "Inter, 13px, 600, -0.01em"], ["preview.font", "Inter, 11px, 400"], ["preview.color", "#5A5A5A"], ["count.font", "Inter, 32px, 700, -0.04em"], ["count.color", "#E3000B"], ["count.format", "'02' (always 2-digit padded)"]]}
      dos={["Zero-pad all counts (01, 02) — numerical consistency is the signature", "Use the 2px left red bar only for selection — it is the only red UI structure"]}
      donts={["Use a bubble, badge, or background for unread count — the 32px numeral is the pattern", "Use the left bar for hover or focus — selection only"]} />

    <CBox title="Masthead (Thread Header)" parts={["meta-row", "title", "count"]} accent={a}
      contract="Render the thread header as a two-line block. Top row: thread index in uppercase tracked labels + red active-status indicator. Bottom row: title (22px/700) with right-aligned count numeral (40px/700)."
      specs={[["padding", "24px 24px 16px"], ["border-bottom", "1px solid #000000"], ["meta.font", "Inter, 9px, 700, 0.16em UPPER"], ["meta.format", "'Thread · 01'"], ["meta.color", "#949494"], ["status.format", "'● Active'"], ["status.color", "#E3000B"], ["title.font", "Inter, 22px, 700, -0.025em"], ["title.color", "#000"], ["count.font", "Inter, 40px, 700, -0.04em"], ["count.label", "'Exchanges' (9px UPPER below)"]]}
      dos={["Show exchange count as 40px display numeral — the system's number hierarchy", "Use the ● Active red dot as the only non-typographic status element"]}
      donts={["Use avatars, icons, or images in the masthead — Swiss is wordmarks only", "Use more than one numeral in the masthead — the exchange count is the lead figure"]} />

    <CBox title="OptionGrid (Suggestions)" parts={["intro-label", "cells"]} accent={a}
      contract="Render suggestions as a 1×N or 2×N grid of equal-width cells, framed by 1px black rules on all sides. Each cell has a zero-padded index label above and a 13px/600 label below."
      specs={[["intro.format", "'Options — 04'"], ["intro.font", "Inter, 9px, 700, 0.16em UPPER"], ["grid.frame", "1px solid #000000"], ["cell.padding", "12px"], ["cell.index.format", "'01', '02', etc."], ["cell.index.font", "Inter, 9px, 600, 0.16em UPPER"], ["cell.index.color", "#949494"], ["cell.label.font", "Inter, 13px, 600, -0.01em"], ["cell.label.color", "#000"]]}
      dos={["Use zero-padded indices (01, 02, 03, 04) — consistent numerical treatment", "Frame with hard black 1px rules — no softer variants"]}
      donts={["Add hover color fills or animations — Swiss grids are static", "Use emoji or icons as prefixes — labels are words only"]} />

    <CBox title="TextInput" parts={["input", "action"]} accent={a}
      contract="Single-line input with no bordered container. Hard 1px black rule above separating input from messages. Placeholder single word. Send action rendered as a red uppercase tracked label, not a button."
      specs={[["container.padding", "16px 24px"], ["container.border-top", "1px solid #000000"], ["input.font", "Inter, 14px, 400"], ["input.color", "#000"], ["placeholder.text", "'Type'", "Single word — never a sentence"], ["placeholder.color", "#C8C8C8"], ["action.font", "Inter, 10px, 700, 0.16em UPPER"], ["action.label", "'Send →'"], ["action.color", "#E3000B"]]}
      dos={["Use a single word for the placeholder ('Type', 'Search', 'Ask')", "Render the send label in red UPPER — the only red verb in the interface"]}
      donts={["Wrap the input in a bordered container or give it a background fill", "Use sentence-case placeholders ('Type your message...')"]} />

    <CBox title="StatusIndicator" parts={["dot", "label"]} accent={a}
      contract="Render status as a Unicode bullet (●) followed by a tracked uppercase label. Red for active, gray for inactive."
      specs={[["dot.char", "'●'"], ["label.text-transform", "uppercase"], ["label.letter-spacing", "0.16em"], ["label.font-size", "9px"], ["label.font-weight", "700"], ["color.active", "#E3000B"], ["color.inactive", "#949494"]]}
      dos={["Use ● with tracked uppercase label — character + type, not colored divs"]}
      donts={["Use a pill or bordered badge around the status — type only"]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Swiss layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width", "280px fixed"], ["Main area", "Fluid, fills remaining"], ["Sidebar order", "Brand block → Search → Thread list → Account block"], ["Vertical divider", "1px solid #E0E0E0"], ["Major section rule", "1px solid #000000"], ["Background", "#FFFFFF for both panes"]] },
      { n: "Message Flow", rows: [["Direction", "Vertical stack, chronological"], ["Alignment", "Assistant → left, You → right"], ["Max width", "72% of container"], ["Gap", "24px between messages — 8-grid compliant"], ["Entrance", "fadeSlideUp, 200ms ease, 70ms stagger"], ["Metadata", "Above body, 6px gap, Inter UPPER"]] },
      { n: "Active Selection", rows: [["Model", "Single selection only"], ["Trigger", "Click or Enter/Space"], ["Visual", "2px solid #E3000B left bar + #F5F5F5 background"], ["Transition", "Instant — no animation"], ["Focus outline", "2px solid #000000 offset 2px"]] },
      { n: "Numerical Hierarchy", rows: [["Thread ID", "01, 02, 03 — always 2-digit padded"], ["Item index", "01 / 05 — pair notation"], ["Unread count", "32px Inter 700, red"], ["Exchange count", "40px Inter 700, black"], ["Option number", "01, 02, 03, 04 — in grids"]] },
    ].map((p, pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4>
      <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        {p.rows.map((r, ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "140px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
        </div>))}
      </div>
    </div>))}
  </div>),

  extensions: () => (<div>
    <H3>1. Numerical Hierarchy</H3>
    <P>Swiss's most distinct typographic moment. Counts, indices, IDs, and quantities are rendered as visible typographic elements — not hidden in badges. Zero-padded (01, 02) for consistency. Three display sizes: 22px, 32px, 40px.</P>
    <Tk n="count.lg" v="40px / 700 / -0.04em" d="Exchange counts in masthead" a={a} />
    <Tk n="count.md" v="32px / 700 / -0.04em" d="Unread counts in sidebar" a={a} />
    <Tk n="count.sm" v="22px / 700 / -0.025em" d="Section headers with numbers" a={a} />
    <Tk n="format" v="Zero-padded 2-digit" d="01, 02, … 12 (not 1, 2)" a={a} />
    <Tk n="pair.format" v="'01 / 05'" d="Current of total — spaced with slash" a={a} />
    <H4>Placement Rules</H4>
    <Do>Zero-pad every number (01, not 1) for consistent width and column alignment</Do>
    <Do>Render counts as typography, not badges — the size carries the weight</Do>
    <Dont>Use Arabic numerals without padding — 1, 2, 3 breaks the rhythm</Dont>
    <Dont>Use numerical display in accent red unless it is an unread count</Dont>

    <H3>2. The One-Accent Rule</H3>
    <P>Red (#E3000B) appears in exactly four places in the entire system. Nowhere else. If a new red moment is proposed, audit the existing four before adding a fifth.</P>
    <Tk n="1. CTA labels" v="'Send →', 'Save', 'File'" d="Action verbs only" a={a} />
    <Tk n="2. Selection bar" v="2px solid #E3000B" d="Sidebar active item, left bar" a={a} />
    <Tk n="3. User-message tag" v="'YOU' 9px UPPER 0.16em" d="Sender label only" a={a} />
    <Tk n="4. Status dot + count" v="'● Active' + unread numerals" d="Live indicators" a={a} />
    <Do>Treat red as a finite resource — each new use dilutes the others</Do>
    <Dont>Use red for hover states, warning messages, or decorative underlines</Dont>
    <Dont>Use red as any kind of background fill — red is type and 2px accent bars only</Dont>

    <H3>3. The Fixed Type Scale</H3>
    <P>Swiss forbids intermediate sizes. Exactly seven text sizes exist. Every piece of type in the system uses one of them. This is more restrictive than standard design systems — on purpose.</P>
    <Tk n="40px" v="display-lg" d="Exchange counts" a={a} />
    <Tk n="32px" v="display" d="Unread counts" a={a} />
    <Tk n="22px" v="title" d="Thread titles" a={a} />
    <Tk n="14px" v="body" d="Message text" a={a} />
    <Tk n="13px" v="item" d="Sidebar item names" a={a} />
    <Tk n="11px" v="preview" d="Preview text" a={a} />
    <Tk n="9px" v="label" d="All metadata" a={a} />
    <Do>If a size "between 13 and 14" feels right, pick one — never 13.5</Do>
    <Do>Enforce the scale at the component level — fixed prop values only</Do>
    <Dont>Add an 8th size even for one edge case — refactor the design instead</Dont>

    <H3>4. The 8-Point Grid</H3>
    <P>Every spacing, padding, margin, and gap value is a multiple of 8. The closed set is 8, 16, 24, 32, 40, 48, 64. Nothing between. This is the invisible infrastructure of the Swiss rhythm.</P>
    <Tk n="spacing.xs" v="8px" a={a} />
    <Tk n="spacing.sm" v="16px" d="Sidebar item padding, input gap" a={a} />
    <Tk n="spacing.md" v="24px" d="Main area padding, message gap" a={a} />
    <Tk n="spacing.lg" v="32px" d="Section separation" a={a} />
    <Tk n="spacing.xl" v="48px" d="Major block breaks" a={a} />
    <Do>Snap every CSS spacing value to the scale. Audit for 10px, 12px, 20px violations.</Do>
    <Dont>Use "tight" intermediate values (10, 12, 18, 20) — refactor the design to work on 8</Dont>
  </div>),

  voice: () => (<div>
    <P>Swiss speaks like a systems manual — declarative, precise, unemotional. One word where one word suffices. Never marketing copy, never conversational filler, never ornament.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Precise", "Neutral", "Declarative", "Functional"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never warm", "Never ornate"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>

    <H3>Placeholder &amp; State Text</H3>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Input placeholder", "Type", "One word only"],
        ["Sidebar search", "Search", "One word only"],
        ["Empty list", "No threads.", "Complete sentence, one word + period"],
        ["Loading", "Loading.", "Never 'Loading…' — period, not ellipsis"],
        ["Error", "Error: send failed.", "Lowercase 'Error:' + what failed"],
        ["Success", "Sent.", "Past-tense verb + period"],
        ["Confirm", "Delete thread.", "Action + object + period"],
      ].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <span style={{ fontSize: 11, color: "#000", fontFamily: "'Inter', sans-serif", background: "#F5F5F5", padding: "2px 6px", display: "inline-block", fontWeight: 500 }}>{p[1]}</span>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>))}
    </div>

    <H3>Vocabulary</H3>
    <Do>Use one-syllable verbs when possible: Send, Save, File, Close, Open, Add, Edit</Do>
    <Do>End sentences with a period. Including one-word confirmations ('Sent.').</Do>
    <Dont>Use emoji, emoticons, or exclamation points anywhere</Dont>
    <Dont>Use conversational or promotional filler ('Welcome back', 'Let's get started')</Dont>

    <H3>Conventions</H3>
    <Do>Sentence case for all UI chrome; ALL CAPS with 0.16em tracking for 9px labels only</Do>
    <Do>Use em dashes (—) as separators in labels ('Thread · 01 — Active')</Do>
    <Do>Use middle dot (·) as visual separator inside label rows</Do>
    <Dont>Use title case for buttons ('Send Reply' → 'Send reply')</Dont>
    <Dont>Use ellipses for loading ('Loading…') — Swiss uses a period</Dont>

    <H3>Symbol Vocabulary</H3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {[["→", "Forward action (Send →)"], ["←", "Back action"], ["·", "Middle dot separator"], ["—", "Em dash range/status"], ["●", "Status indicator"], ["/", "Pair separator (01 / 05)"], ["01", "Zero-padded index"], ["03", "Zero-padded count"], ["× 04", "Multiplier label"]].map(([s, u]) => (
        <div key={s} style={{ padding: "6px 8px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 14, fontFamily: "'Inter', sans-serif", color: a, fontWeight: 700 }}>{s}</span>
          <div style={{ fontSize: 9.5, color: "#777", marginTop: 1 }}>{u}</div>
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
  const spec = swissSpec(TM.color);
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
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
        .ma { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 24px }
        .si { border: none; outline: none; background: transparent; flex: 1; font-size: 12px; width: 100% }
        input::placeholder { opacity: 0.5 }
        .snd { cursor: pointer; transition: opacity 0.12s; flex-shrink: 0 }
        .snd:hover { opacity: 0.75 }
        .mi { animation: fadeSlideUp 0.2s ease both }
        .ci { animation: fadeSlideUp 0.2s ease both }
        .ci:hover { background: #FAFAFA }
        .bc-sw:hover { background: #F5F5F5 !important }
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
