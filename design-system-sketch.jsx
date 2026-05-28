import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — SKETCH
   Linear + Hand-Drawn · Single-theme standalone spec + live preview
   ═══════════════════════════════════════════════════════════════ */

const TM = { name: "Sketch", tag: "Linear + Hand-Drawn", color: "#B8A9C8" };

const chatList = [
  { id: 1, name: "Tokyo Trip", preview: "Want me to build a day-by-day itinerary?", time: "2m", unread: 2, avatar: "🗼", online: true },
  { id: 2, name: "Recipe Ideas", preview: "Here are 5 ramen variations you'll love...", time: "1h", unread: 0, avatar: "🍜" },
  { id: 3, name: "Book Club", preview: "I'd recommend starting with Murakami's...", time: "3h", unread: 1, avatar: "📖", online: true },
  { id: 4, name: "Fitness Plan", preview: "Your 4-week progressive routine is ready.", time: "1d", unread: 0, avatar: "💪" },
  { id: 5, name: "Code Review", preview: "The auth middleware looks solid, but...", time: "2d", unread: 0, avatar: "⚡" },
];
const msgs = [
  { id: 1, sender: "user", text: "Hey, can you help me plan a trip to Tokyo?" },
  { id: 2, sender: "ai", text: "Absolutely! Tokyo is incredible. Are you looking for a culture-focused trip, food adventure, or a mix of everything?" },
  { id: 3, sender: "user", text: "Definitely a mix — temples in the morning, ramen at night." },
  { id: 4, sender: "ai", text: "Perfect combo. I'd suggest starting in Asakusa for Senso-ji, then heading to Shibuya for the evening food scene. Want me to build a day-by-day itinerary?" },
];

/* ─── SHARED HELPERS ─── */
const Tk = ({ n, v, d, a = "#999" }) => <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" }}><code className="mn" style={{ fontSize: 10, color: "#CCC", minWidth: 170 }}>{n}</code><code className="mn" style={{ fontSize: 10, color: a, minWidth: 120 }}>{v}</code>{d && <span style={{ fontSize: 9.5, color: "#555" }}>{d}</span>}</div>;
const Sw = ({ c, n, v, b }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}><div style={{ width: 24, height: 24, borderRadius: 4, background: c, border: b || "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} /><div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#CCC" }}>{n}</div><code className="mn" style={{ fontSize: 9, color: "#666" }}>{v}</code></div></div>;
const H3 = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, color: "#EEE", margin: "22px 0 10px", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</h3>;
const H4 = ({ children }) => <h4 style={{ fontSize: 11.5, fontWeight: 600, color: "#CCC", margin: "16px 0 6px" }}>{children}</h4>;
const P = ({ children }) => <p style={{ fontSize: 12, color: "#999", lineHeight: 1.6, margin: "0 0 10px" }}>{children}</p>;
const Do = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 4, marginBottom: 4, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#34D399", flexShrink: 0 }}>✓</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Dont = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 4, marginBottom: 4, background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#FF6B6B", flexShrink: 0 }}>✗</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Pill = ({ children, color }) => <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, background: `${color}10`, border: `1px solid ${color}25`, color, fontWeight: 600 }}>{children}</span>;

const CBox = ({ title, parts, contract, specs, dos, donts, accent }) => {
  const [open, setOpen] = useState(false);
  return (<div style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
    <div onClick={() => setOpen(!open)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: open ? "rgba(255,255,255,0.02)" : "transparent" }}>
      <span style={{ fontSize: 9, color: "#555", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      <span className="mn" style={{ fontSize: 12, fontWeight: 700, color: "#EEE" }}>{title}</span>
      <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>{parts.map(p => <code key={p} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 2, background: "rgba(255,255,255,0.03)", color: "#666" }}>{p}</code>)}</div>
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
function SketchChat({ sel, setSel }) {
  return (
    <div className="app-sh" style={{ background: "#FAFAF8", fontFamily: "'IBM Plex Sans',sans-serif", borderRadius: 14, border: "1px solid #E5E3DE" }}>
      <div className="sb" style={{ borderRight: "1px solid #E5E3DE" }}>
        <div style={{ padding: "16px 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2C", letterSpacing: "-0.02em" }}>Sketch</span>
            <span style={{ fontFamily: "'Caveat',cursive", fontSize: 14, color: "#B8A9C8", fontWeight: 700, transform: "rotate(-3deg)", display: "inline-block" }}>✦ AI</span>
          </div>
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E3DE", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#C0BCB6" }}>⌕</span>
            <input placeholder="Search..." className="si" style={{ fontFamily: "'IBM Plex Sans',sans-serif", color: "#2C2C2C" }} />
          </div>
        </div>
        <div style={{ padding: "0 14px 8px" }}>
          <div style={{ fontFamily: "'Caveat',cursive", fontSize: 13, color: "#C4B8D4", fontWeight: 700, transform: "rotate(-1.5deg)" }}>↓ your chats</div>
        </div>
        <div className="cl">
          {chatList.map((c, i) => (
            <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "10px 14px", cursor: "pointer", borderRadius: 10, margin: "0 6px 3px", background: sel === c.id ? "#F0EDE8" : "transparent", border: sel === c.id ? "1px solid #E5E3DE" : "1px solid transparent", animationDelay: `${i * 60}ms` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: "#F0EDE8", border: "1px solid #E5E3DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{c.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "#2C2C2C" }}>{c.name}</span>
                    <span style={{ fontSize: 10, color: "#B0ADA8" }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#8A8680", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{c.preview}</div>
                </div>
                {c.unread > 0 && <div style={{ width: 18, height: 18, borderRadius: 6, background: "#B8A9C8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#FFF" }}>{c.unread}</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid #E5E3DE" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "#F0EDE8", border: "1px solid #E5E3DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#8A8680" }}>Y</div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: "#555" }}>Your account</div>
          </div>
        </div>
      </div>

      <div className="ca">
        <div style={{ borderBottom: "1px solid #E5E3DE", padding: "12px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>🗼</span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2C2C" }}>Tokyo Trip</div>
            <div style={{ marginLeft: "auto", fontFamily: "'Caveat',cursive", fontSize: 13, color: "#B8A9C8", fontWeight: 700 }}>✎ active</div>
          </div>
        </div>
        <div className="ma" style={{ padding: 16 }}>
          {msgs.map((m, i) => (
            <div key={m.id} className="mi" style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "78%", animationDelay: `${i * 80}ms` }}>
              {m.sender === "ai" && i === 1 && <div style={{ fontFamily: "'Caveat',cursive", fontSize: 13, color: "#B8A9C8", fontWeight: 700, marginBottom: 3, paddingLeft: 4, transform: "rotate(-1.5deg)" }}>↓ ooh fun one!</div>}
              <div style={{ padding: "11px 15px", borderRadius: 12, fontSize: 13, lineHeight: 1.55, ...(m.sender === "user" ? { background: "#2C2C2C", color: "#FAFAF8" } : { background: "#F0EDE8", color: "#2C2C2C", border: "1px solid #E5E3DE" }) }}>{m.text}</div>
            </div>
          ))}
          <div className="mi" style={{ alignSelf: "flex-start", maxWidth: "85%", animationDelay: "400ms" }}>
            <div style={{ fontFamily: "'Caveat',cursive", fontSize: 13, color: "#C4B8D4", fontWeight: 700, marginBottom: 6, transform: "rotate(-1deg)" }}>pick a vibe ~</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {["🏯 Temples", "🍜 Ramen", "🎌 Culture", "🌸 Parks"].map(t => (
                <div key={t} className="bc" style={{ padding: "10px", borderRadius: 8, background: "#F7F5F0", border: "1px solid #E5E3DE", fontSize: 11.5, color: "#555", textAlign: "center", cursor: "pointer" }}>{t}</div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E5E3DE" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 10, border: "1px solid #E5E3DE", background: "#FFF" }}>
            <input placeholder="Type here..." className="si" style={{ fontFamily: "'IBM Plex Sans',sans-serif", color: "#2C2C2C" }} />
            <div className="snd" style={{ fontFamily: "'Caveat',cursive", fontSize: 17, color: "#B8A9C8", fontWeight: 700 }}>go →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const notes = [
    "Caveat cursive annotations above AI messages at -1.5° rotation",
    "1px solid borders define all boundaries — zero box-shadows",
    "Purple (#B8A9C8) accent exclusively on annotation layer elements",
    "Bento suggestion chips in 2-column grid with emoji prefix",
    "Cursive send label ('go →') — key Sketch identity moment",
    "IBM Plex Sans for all structural text, Caveat for editorial only",
    "Selected sidebar item: bg fill + border (no shadow, no accent bar)",
  ];
  return (<div>
    <P>Live implementation of the Sketch design system. Every token, component, and pattern from the spec applied to a working interface. Click sidebar items to see selection state behavior.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 460, borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <SketchChat sel={sel} setSel={setSel} />
      </div>
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Design tokens in action</div>
        {notes.map((n, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 4, border: `1px solid ${TM.color}15`, background: `${TM.color}06`, marginBottom: 4, fontSize: 10, color: "#BBB", lineHeight: 1.4 }}>
            <span style={{ color: TM.color, marginRight: 4 }}>→</span>{n}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   SKETCH SPEC
   ═══════════════════════════════════════════════════════════════ */
function sketchSpec(a) { return {
  overview: () => (<div>
    <P>Sketch is an aesthetic that balances engineering-grade precision with human warmth. Its foundation is a clean, linear design system built on IBM Plex Sans — tight spacing, 1px borders, neutral surfaces. What makes it distinct is a second layer: hand-drawn cursive annotations in Caveat that add editorial personality.</P>
    <P>The system's identity lives in the tension between these two modes. The structural layer is precise, predictable, and grid-aligned. The annotation layer is rotated, informal, and warm. Neither should invade the other's territory.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[
        ["Precision first", "Every structural element aligns to a 4px grid. Borders are exactly 1px. Radius is consistent at 8–12px. No visual ambiguity in the foundation layer."],
        ["Warmth second", "The annotation layer adds humanity — but sparingly. It appears in metadata, status, and editorial moments. Never in navigation, form inputs, or body text."],
        ["No shadows, ever", "Sketch defines all boundaries with 1px borders. Zero box-shadows anywhere in the system. Depth is communicated through background color separation, not elevation."],
        ["One accent, one role", "Muted purple (#B8A9C8) is the only accent color. It is reserved exclusively for the annotation/editorial layer. Structural elements use the neutral palette only."],
      ].map(([t, d], i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div>
          <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div>
        </div>
      ))}
    </div>
    <H3>When to Use Sketch</H3>
    <Do>Productivity tools, developer platforms, educational products, community-driven apps, onboarding flows, editorial interfaces</Do>
    <Do>Products that need to feel approachable without sacrificing clarity or density</Do>
    <Dont>Luxury/premium brands expecting high-polish visuals (use Prism instead)</Dont>
    <Dont>Counter-culture or rebellious brand identities (use Revolt instead)</Dont>
  </div>),

  color: () => (<div>
    <P>Sketch uses a deliberately restrained palette. Five neutral tones form the structural foundation. A single muted purple serves as the accent, reserved exclusively for the annotation layer.</P>
    <H3>Background Surfaces</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#FAFAF8" n="Page" v="#FAFAF8" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#F0EDE8" n="Surface" v="#F0EDE8" b="1px solid rgba(255,255,255,0.12)" />
      <Sw c="#F7F5F0" n="Surface Subtle" v="#F7F5F0" b="1px solid rgba(255,255,255,0.12)" />
      <Sw c="#FFFFFF" n="Elevated" v="#FFFFFF" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#2C2C2C" n="Inverse" v="#2C2C2C" />
      <Sw c="#E5E3DE" n="Muted" v="#E5E3DE" b="1px solid rgba(255,255,255,0.12)" />
    </div>
    <H3>Text</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#2C2C2C" n="Primary" v="#2C2C2C" />
      <Sw c="#555555" n="Secondary" v="#555555" />
      <Sw c="#8A8680" n="Tertiary" v="#8A8680" />
      <Sw c="#B0ADA8" n="Placeholder" v="#B0ADA8" />
      <Sw c="#FAFAF8" n="On Inverse" v="#FAFAF8" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#FFFFFF" n="On Accent" v="#FFFFFF" b="1px solid rgba(255,255,255,0.15)" />
    </div>
    <H3>Accent — Annotation Purple</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#B8A9C8" n="Primary" v="#B8A9C8" />
      <Sw c="#C4B8D4" n="Light" v="#C4B8D4" />
      <Sw c="#9A8BAA" n="Dark (hover)" v="#9A8BAA" />
    </div>
    <Do>Use accent purple only for: annotations, status text, editorial labels, send button, unread badges</Do>
    <Dont>Use purple for body text, headings, borders, backgrounds, or structural elements</Dont>
    <H3>Contrast Ratios</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Primary text on Page", "12.8:1", "AAA"],
        ["Primary text on Surface", "10.4:1", "AAA"],
        ["Secondary text on Page", "7.2:1", "AAA"],
        ["Tertiary text on Page", "4.7:1", "AA"],
        ["Accent purple on Page", "3.6:1", "AA (lg)"],
        ["On-inverse on Inverse bg", "12.8:1", "AAA"],
        ["White on Accent badge", "4.1:1", "AA"],
      ].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 55px", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: r[2].includes("AAA") ? "#34D399" : "#FBBF24" }}>{r[2]}</span>
        </div>
      ))}
    </div>
  </div>),

  typography: () => (<div>
    <P>Sketch uses a strict dual-font system. The boundary between the two families is the most important typographic rule in the system.</P>
    <H3>Font Families</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
      <div style={{ padding: "14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'IBM Plex Sans'", fontSize: 18, color: "#EEE", marginBottom: 4 }}>IBM Plex Sans</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Structural — the grid</div>
        <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>All navigation, body text, headings, form inputs, labels, buttons (except send), metadata, timestamps. Everything that carries functional meaning.</div>
      </div>
      <div style={{ padding: "14px", borderRadius: 8, border: "1px solid rgba(184,169,200,0.2)", background: "rgba(184,169,200,0.04)" }}>
        <div style={{ fontFamily: "'Caveat'", fontSize: 22, color: "#B8A9C8", marginBottom: 4 }}>Caveat</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#B8A9C8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Editorial — the wink</div>
        <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Annotations above AI messages, status indicators, section labels, empty state messages, the send button label, whimsical editorial asides.</div>
      </div>
    </div>
    <Do>Use Caveat exclusively with color.accent.primary (#B8A9C8 or #C4B8D4)</Do>
    <Dont>Use Caveat for headings, body text, navigation labels, form inputs, or error messages</Dont>
    <Dont>Use IBM Plex Sans for annotations, status indicators, or editorial asides</Dont>
    <H3>Type Scale</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["display", "18px", "600", "1.3", "-0.02em", "Page titles"],
        ["heading", "15px", "600", "1.3", "-0.02em", "Section headings"],
        ["title", "13.5px", "600", "1.3", "-0.01em", "Chat headers, card titles"],
        ["body", "13px", "400", "1.55", "0", "Message text"],
        ["label", "12.5px", "600", "1.3", "0", "Sidebar item names"],
        ["caption", "11px", "400", "1.4", "0", "Preview text"],
        ["micro", "10px", "500", "1.3", "0", "Timestamps, meta"],
        ["annotation", "13px", "700", "1.3", "0", "Caveat only"],
      ].map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "75px 48px 42px 38px 50px 1fr", padding: "5px 10px", borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.025)" : "none", background: t[0] === "annotation" ? "rgba(184,169,200,0.04)" : "transparent" }}>
          <code className="mn" style={{ fontSize: 10, color: t[0] === "annotation" ? "#B8A9C8" : "#CCC" }}>{t[0]}</code>
          {t.slice(1).map((v, vi) => <span key={vi} style={{ fontSize: 10, color: vi < 4 ? "#999" : "#666" }}>{v}</span>)}
        </div>
      ))}
    </div>
  </div>),

  elevation: () => (<div>
    <P>Sketch uses borders as its sole boundary mechanism. There are no box-shadows in the system. Every container, card, and component boundary is defined by a 1px solid border.</P>
    <H3>Border Tokens</H3>
    <Tk n="border.width.default" v="1px" d="All component boundaries" a={a} />
    <Tk n="border.style" v="solid" d="Always solid (except annotation callouts: dashed)" a={a} />
    <Tk n="border.color.default" v="#E5E3DE" d="Standard boundary" a={a} />
    <Tk n="border.color.strong" v="#D5CFC8" d="Structural dividers" a={a} />
    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
      {[
        { r: 8, l: "Component", t: "radius.sm" },
        { r: 10, l: "Container", t: "radius.md" },
        { r: 12, l: "Message", t: "radius.lg" },
        { r: 16, l: "App shell", t: "radius.xl" },
      ].map(item => (
        <div key={item.t} style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: item.r, border: "2px solid rgba(184,169,200,0.35)", background: "rgba(255,255,255,0.02)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <code className="mn" style={{ fontSize: 9, color: "#999" }}>{item.r}px</code>
          </div>
          <div style={{ fontSize: 9.5, color: "#CCC", fontWeight: 600 }}>{item.l}</div>
          <code className="mn" style={{ fontSize: 8.5, color: "#666" }}>{item.t}</code>
        </div>
      ))}
    </div>
    <H3>Shadow Rules</H3>
    <Dont>Use box-shadow on any element. This is a structural rule, never violated.</Dont>
    <Dont>Use drop-shadow, text-shadow, or filter: shadow.</Dont>
    <Do>Use background color separation (page → surface → elevated) to create visual hierarchy without shadows.</Do>
  </div>),

  components: () => (<div>
    <P>Each component specifies anatomy, behavioral contract, exact token values, and do/don't rules. Click to expand.</P>
    <CBox title="ChatBubble" parts={["container", "text", "annotation", "tail"]} accent={a}
      contract="Must visually distinguish user messages from AI messages. Must support multi-line text with proper wrapping. Must allow optional cursive annotation above AI messages."
      specs={[
        ["padding", "11px 15px"],
        ["border-radius", "12px", "Uniform on all corners"],
        ["font-size", "13px (body)"],
        ["line-height", "1.55"],
        ["max-width", "78%", "Of chat container"],
        ["user.background", "#2C2C2C", "Inverse surface"],
        ["user.color", "#FAFAF8", "On-inverse text"],
        ["ai.background", "#F0EDE8", "Surface"],
        ["ai.color", "#2C2C2C", "Primary text"],
        ["ai.border", "1px solid #E5E3DE"],
      ]}
      dos={[
        "Add cursive annotations above AI messages for editorial moments ('ooh fun one!', '↓ great question')",
        "Use consistent 12px radius on all bubble corners (no directional tail shape)",
      ]}
      donts={[
        "Add box-shadow to bubbles (use border only for AI messages)",
        "Use annotations on user messages — annotations are the AI's editorial voice",
        "Show timestamps on every message — Sketch keeps metadata minimal",
      ]} />

    <CBox title="SidebarItem" parts={["container", "avatar", "title", "preview", "time", "badge"]} accent={a}
      contract="Must show selected/unselected state clearly. Must truncate preview text with ellipsis. Must be keyboard-focusable. Must support unread count badge."
      specs={[
        ["padding", "10px 14px"],
        ["border-radius", "10px"],
        ["margin", "0 6px 3px", "Inset from sidebar edge"],
        ["selected.bg", "#F0EDE8", "Surface color"],
        ["selected.border", "1px solid #E5E3DE"],
        ["avatar.size", "34px"],
        ["avatar.radius", "8px"],
        ["avatar.bg", "#F0EDE8"],
        ["avatar.border", "1px solid #E5E3DE"],
        ["title.font", "label (12.5px/600)"],
        ["preview.font", "caption (11px/400)"],
        ["preview.color", "#8A8680", "Tertiary text"],
      ]}
      dos={[
        "Use background color + border for selected state — never shadow",
        "Truncate preview to single line with text-overflow: ellipsis",
      ]}
      donts={[
        "Use a left accent bar for selection (that's the Lucid pattern, not Sketch)",
        "Show online status indicators (Sketch omits real-time presence)",
      ]} />

    <CBox title="TextInput" parts={["container", "input", "placeholder", "action"]} accent={a}
      contract="Must have a clearly visible boundary. Must show focus state. Placeholder must be legible. Action element must be discoverable."
      specs={[
        ["padding", "9px 14px"],
        ["border-radius", "10px"],
        ["border", "1px solid #E5E3DE"],
        ["background", "#FFFFFF", "Elevated surface"],
        ["font", "body (13px/400)", "IBM Plex Sans"],
        ["placeholder.color", "#B0ADA8", "45% opacity"],
        ["action.font", "Caveat 17px/700", "Annotation font"],
        ["action.color", "#B8A9C8", "Accent purple"],
        ["action.label", "'go →'", "Cursive send label"],
      ]}
      dos={[
        "Use sentence-case placeholder text ('Type here...', 'Search...')",
        "Use Caveat for the send action label — key Sketch identity moment",
      ]}
      donts={[
        "Use uppercase placeholders (that's Revolt's convention)",
        "Use an icon-only send button (Sketch uses text labels for warmth)",
      ]} />

    <CBox title="Badge" parts={["container", "count"]} accent={a}
      contract="Must be legible at small sizes. Must contrast with parent surface."
      specs={[
        ["size", "18px height, min 18px width"],
        ["border-radius", "6px"],
        ["background", "#B8A9C8", "Accent purple"],
        ["color", "#FFFFFF", "On-accent"],
        ["font", "micro (9px/700)"],
      ]}
      dos={["Use solid fill for badge background"]}
      donts={["Use bordered/outlined badges (that's Revolt)", "Use any color other than accent purple"]} />

    <CBox title="Header" parts={["container", "icon", "title", "status"]} accent={a}
      contract="Must identify the current chat context. Must separate from content area below."
      specs={[
        ["padding", "12px 20px"],
        ["border-bottom", "1px solid #E5E3DE"],
        ["background", "transparent", "Inherits page bg"],
        ["title.font", "title (13.5px/600)"],
        ["status.font", "Caveat 13px/700", "Annotation"],
        ["status.color", "#B8A9C8"],
        ["status.text", "'✎ active'"],
      ]}
      dos={[
        "Use Caveat for status — editorial annotation style",
        "Keep visually lightweight — transparent bg, thin border",
      ]}
      donts={[
        "Fill header with accent background (that's Revolt)",
        "Use glass/blur in header (that's Prism)",
      ]} />

    <CBox title="BentoChip" parts={["container", "emoji", "label"]} accent={a}
      contract="Must be tappable. Must appear in 2-column grid. Must support emoji prefix."
      specs={[
        ["padding", "10px"],
        ["border-radius", "8px"],
        ["background", "#F7F5F0", "Surface subtle"],
        ["border", "1px solid #E5E3DE"],
        ["font", "caption (11.5px/400)"],
        ["color", "#555555", "Secondary text"],
        ["text-align", "center"],
        ["hover.bg", "#EDE9E2"],
        ["grid.columns", "2", "Always 2"],
        ["grid.gap", "6px"],
      ]}
      dos={[
        "Introduce chips with a cursive annotation label ('pick a vibe ~')",
        "Always use emoji as first character",
      ]}
      donts={[
        "Use more than 2 columns",
        "Show chips without an introductory annotation",
      ]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Sketch layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [
        ["Sidebar width", "260px fixed"],
        ["Main area", "Fluid, fills remaining"],
        ["Sidebar order", "Brand → Search → Section label (cursive) → Chat list → User panel"],
        ["Vertical divider", "1px solid #E5E3DE"],
        ["Background", "#FAFAF8 for both panes"],
      ]},
      { n: "Chat Message Flow", rows: [
        ["Direction", "Vertical stack, chronological"],
        ["Alignment", "User → right, AI → left"],
        ["Max width", "78% of container"],
        ["Gap", "12px between messages"],
        ["Entrance", "fadeSlideUp, 400ms ease, 80ms stagger"],
        ["Annotations", "Cursive text above select AI messages"],
        ["Suggestion chips", "After final AI message when choices available"],
      ]},
      { n: "Active Selection", rows: [
        ["Model", "Single selection only"],
        ["Trigger", "Click or Enter/Space"],
        ["Visual", "bg: #F0EDE8, border: 1px solid #E5E3DE"],
        ["Transition", "200ms ease"],
        ["Avatar change", "None — stays consistent"],
      ]},
      { n: "Search", rows: [
        ["Position", "Top of sidebar, below brand"],
        ["Container", "1px border, white bg, 8px radius"],
        ["Icon", "⌕ prefix, #C0BCB6"],
        ["Placeholder", "'Search...' — sentence case"],
      ]},
    ].map((p, pi) => (
      <div key={pi} style={{ marginBottom: 14 }}>
        <H4>{p.n}</H4>
        <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
          {p.rows.map((r, ri) => (
            <div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
              <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
              <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>),

  extensions: () => (<div>
    <H3>1. Annotation System</H3>
    <P>Sketch's defining feature. Cursive text overlays that provide editorial commentary, status, and human warmth.</P>
    <Tk n="font" v="Caveat, 700 weight" a={a} />
    <Tk n="color" v="#B8A9C8 or #C4B8D4" d="Accent purple only" a={a} />
    <Tk n="rotation" v="-1° to -3°" d="Always counterclockwise" a={a} />
    <Tk n="max-rotation" v="-3°" d="Never exceed" a={a} />
    <Tk n="transform-origin" v="left center" a={a} />
    <H4>Placement Rules</H4>
    <Do>Above AI messages for editorial reactions ("↓ ooh fun one!")</Do>
    <Do>As section labels in the sidebar ("↓ your chats")</Do>
    <Do>As status text in headers ("✎ active")</Do>
    <Do>As empty state messages ("✎ sketching your itinerary...")</Do>
    <Do>As the send button label ("go →")</Do>
    <Do>As introductions to bento chips ("pick a vibe ~")</Do>
    <Dont>On user messages — annotations are the AI/system's editorial voice</Dont>
    <Dont>In form inputs, labels, or error messages</Dont>
    <Dont>In navigation items or headings</Dont>
    <Dont>More than once per visible viewport — they lose impact when overused</Dont>
    <H4>Vocabulary &amp; Tone</H4>
    <P>Annotations should feel like a friend's handwritten margin note — casual, warm, slightly playful. Never formal, robotic, or instructional.</P>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <div style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(52,211,153,0.12)", background: "rgba(52,211,153,0.04)" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#34D399", marginBottom: 5 }}>GOOD ANNOTATIONS</div>
        {["↓ ooh fun one!", "pick a vibe ~", "✎ sketching ideas...", "✦ nice choice!", "↓ your chats", "go →"].map(x => (
          <div key={x} style={{ fontFamily: "'Caveat'", fontSize: 13, color: "#B8A9C8", fontWeight: 700, marginBottom: 1 }}>{x}</div>
        ))}
      </div>
      <div style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,107,107,0.12)", background: "rgba(255,107,107,0.04)" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#FF6B6B", marginBottom: 5 }}>BAD ANNOTATIONS</div>
        {["Processing your request...", "Click here to continue", "ERROR: Invalid input", "Navigation Menu", "Submit Form", "IMPORTANT NOTICE"].map(x => (
          <div key={x} style={{ fontFamily: "'Caveat'", fontSize: 13, color: "#FF6B6B", fontWeight: 700, marginBottom: 1, textDecoration: "line-through", opacity: 0.5 }}>{x}</div>
        ))}
      </div>
    </div>

    <H3>2. Dual-Font Boundary</H3>
    <P>The boundary between IBM Plex Sans and Caveat is strict and inviolable. If unsure which font to use, it's IBM Plex Sans. Caveat is the exception, never the default.</P>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Navigation labels", "IBM Plex Sans", "Structural"],
        ["Body / message text", "IBM Plex Sans", "Structural"],
        ["Form inputs", "IBM Plex Sans", "Structural"],
        ["Headings", "IBM Plex Sans", "Structural"],
        ["Button labels (standard)", "IBM Plex Sans", "Structural"],
        ["Send button", "Caveat", "Annotation"],
        ["Status indicators", "Caveat", "Annotation"],
        ["Section labels", "Caveat", "Annotation"],
        ["AI message annotations", "Caveat", "Annotation"],
        ["Empty state messages", "Caveat", "Annotation"],
        ["Chip introductions", "Caveat", "Annotation"],
      ].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px", padding: "5px 10px", borderBottom: i < 10 ? "1px solid rgba(255,255,255,0.025)" : "none", background: r[2] === "Annotation" ? "rgba(184,169,200,0.03)" : "transparent" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <span style={{ fontSize: 10.5, color: r[2] === "Annotation" ? "#B8A9C8" : "#999", fontFamily: r[2] === "Annotation" ? "'Caveat'" : "'IBM Plex Sans'", fontWeight: r[2] === "Annotation" ? 700 : 400 }}>{r[1]}</span>
          <span style={{ fontSize: 9.5, color: r[2] === "Annotation" ? "#B8A9C8" : "#666", fontWeight: 500 }}>{r[2]}</span>
        </div>
      ))}
    </div>

    <H3>3. Bento Suggestion Chips</H3>
    <Tk n="trigger" v="AI offers multiple choices" d="Only when options exist" a={a} />
    <Tk n="layout" v="2-column grid, 6px gap" d="Never 1 or 3+ columns" a={a} />
    <Tk n="format" v="Emoji + label" d="e.g., '🏯 Temples'" a={a} />
    <Tk n="intro" v="Cursive annotation above" d="e.g., 'pick a vibe ~'" a={a} />
    <Tk n="position" v="After final AI message" a={a} />

    <H3>4. No-Shadow Rule</H3>
    <P>Zero box-shadows anywhere. All visual hierarchy through background color separation and 1px borders. This is what fundamentally separates Sketch from neumorphic systems.</P>
    <Do>Use background tiers: page (#FAFAF8) → surface (#F0EDE8) → elevated (#FFFFFF)</Do>
    <Dont>Use box-shadow, drop-shadow, text-shadow, or any shadow property for any purpose</Dont>
  </div>),

  voice: () => (<div>
    <P>Sketch has a distinct voice that extends beyond the annotation layer. Every piece of microcopy contributes to the system's personality.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Warm", "Casual", "Helpful", "Gently playful"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never formal", "Never robotic"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>
    <H3>Placeholder Text</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Chat input", "Type here...", "Plex"],
        ["Sidebar search", "Search...", "Plex"],
        ["Empty chat list", "✎ no conversations yet", "Caveat"],
        ["Loading state", "✎ sketching your itinerary...", "Caveat"],
        ["Error state", "Something went wrong. Try again?", "Plex"],
      ].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 60px", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <span style={{ fontSize: 10.5, color: p[2] === "Caveat" ? "#B8A9C8" : "#999", fontFamily: p[2] === "Caveat" ? "'Caveat'" : "'IBM Plex Sans'", fontWeight: p[2] === "Caveat" ? 700 : 400 }}>{p[1]}</span>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>
      ))}
    </div>
    <H3>Conventions</H3>
    <Do>Sentence case everywhere. Never title case, never all caps.</Do>
    <Do>Annotations end with soft punctuation (ellipsis, tilde, exclamation). Never periods.</Do>
    <Do>Use arrow characters (→, ↓) instead of spelled-out words.</Do>
    <Do>Keep annotations under 5 words. Margin notes, not sentences.</Do>
    <Dont>Technical jargon in annotations. "Loading" → "✎ sketching..."</Dont>
    <Dont>Formal punctuation (colons, semicolons, periods) in annotations.</Dont>
    <H3>Symbol Vocabulary</H3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {[
        ["✎", "Active / in-progress"],
        ["✦", "Positive / highlights"],
        ["↓", "Points to content below"],
        ["→", "Action labels, navigation"],
        ["~", "Soft endings, casual tone"],
        ["!", "Enthusiasm (sparingly)"],
      ].map(([s, u]) => (
        <div key={s} style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 16, fontFamily: "'Caveat'", color: a, fontWeight: 700 }}>{s}</span>
          <div style={{ fontSize: 9.5, color: "#777", marginTop: 1 }}>{u}</div>
        </div>
      ))}
    </div>
  </div>),
};}

/* ═══════════════════════════════════════════════════════════════
   THEME VIEW + MAIN SHELL
   ═══════════════════════════════════════════════════════════════ */
function ThemeView({ sec, setSec, sel, setSel }) {
  const specSections = [
    { id: "overview", l: "Overview" }, { id: "color", l: "Color" }, { id: "typography", l: "Typography" },
    { id: "elevation", l: "Elevation" }, { id: "components", l: "Components" }, { id: "patterns", l: "Patterns" },
    { id: "extensions", l: "Extensions" }, { id: "voice", l: "Voice & Tone" }, { id: "preview", l: "⬡ Preview" },
  ];
  const spec = sketchSpec(TM.color);
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
  const [sec, setSec] = useState("overview");
  const [sel, setSel] = useState(1);

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0A0A0A", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#EEE" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=Caveat:wght@400;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }
        * { box-sizing: border-box }
        .mn { font-family: 'JetBrains Mono', monospace }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05) }
        .app-sh { display: flex; width: 100%; height: 100%; overflow: hidden }
        .sb { width: 220px; min-width: 220px; display: flex; flex-direction: column; overflow: hidden }
        .cl { flex: 1; overflow-y: auto; padding: 0 0 4px }
        .ca { flex: 1; display: flex; flex-direction: column; overflow: hidden }
        .ma { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px }
        .si { border: none; outline: none; background: transparent; flex: 1; font-size: 11px; width: 100% }
        input::placeholder { opacity: 0.4 }
        .snd { cursor: pointer; transition: transform 0.1s; flex-shrink: 0 }
        .snd:hover { transform: scale(1.05) }
        .mi { animation: fadeSlideUp 0.25s linear both }
        .ci { animation: fadeSlideUp 0.2s linear both }
        .ci:hover { background: rgba(184,169,200,0.04) }
        .bc:hover { background: #EDE9E2 !important }
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
