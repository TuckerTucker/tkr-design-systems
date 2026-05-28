import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — PRISM
   Liquid Glass + Bento · Single-theme standalone spec + live preview
   ═══════════════════════════════════════════════════════════════ */

const TM = { name: "Prism", tag: "Liquid Glass + Bento", color: "#7DDFBE" };

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
function PrismChat({ sel, setSel }) {
  const g = { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" };
  const gs = { ...g, background: "rgba(255,255,255,0.14)" };
  return (
    <div className="app-sh" style={{ background: "linear-gradient(150deg,#4A5D6B 0%,#5A4A5E 40%,#6B5A5A 70%,#4A6058 100%)", fontFamily: "'Outfit',sans-serif", borderRadius: 20, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "radial-gradient(circle,rgba(180,160,210,0.2) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, background: "radial-gradient(circle,rgba(130,200,180,0.18) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div className="sb" style={{ borderRight: "1px solid rgba(255,255,255,0.1)", position: "relative", zIndex: 1 }}>
        <div style={{ padding: "18px 14px 12px" }}><div style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em", marginBottom: 14 }}>Prism</div><div style={{ ...g, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>⌕</span><input placeholder="Search..." className="si gi" style={{ fontFamily: "'Outfit',sans-serif", color: "rgba(255,255,255,0.8)" }} /></div></div>
        <div className="cl">{chatList.map((c, i) => (
          <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "10px 12px", cursor: "pointer", borderRadius: 12, margin: "0 6px 3px", ...(sel===c.id?gs:{}), transition: "all 0.25s", animationDelay: `${i*70}ms` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, ...g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, position: "relative" }}>{c.avatar}{c.online&&<div style={{ position: "absolute", bottom: -1, right: -1, width: 7, height: 7, borderRadius: "50%", background: "#7DDFBE", border: "2px solid rgba(74,93,107,0.8)" }} />}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12.5, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{c.name}</span><span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{c.time}</span></div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{c.preview}</div></div>
              {c.unread > 0 && <div style={{ width: 18, height: 18, borderRadius: 6, background: "rgba(125,223,190,0.25)", border: "1px solid rgba(125,223,190,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 600, color: "#7DDFBE" }}>{c.unread}</div>}
            </div>
          </div>
        ))}</div>
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.08)" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 28, height: 28, borderRadius: 8, ...g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>◈</div><div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>You · active</div></div></div>
      </div>
      <div className="ca" style={{ position: "relative", zIndex: 1 }}>
        <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "14px 20px", ...g }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 16 }}>🗼</span><div><div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>Tokyo Trip</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>active session</div></div></div></div>
        <div className="ma" style={{ padding: 16 }}>
          {msgs.map((m, i) => (<div key={m.id} className="mi" style={{ alignSelf: m.sender==="user"?"flex-end":"flex-start", maxWidth: "78%", animationDelay: `${i*100}ms` }}>
            <div style={{ padding: "12px 16px", borderRadius: m.sender==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px", fontSize: 13, lineHeight: 1.6, ...g, ...(m.sender==="user"?{ background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.95)" }:{ color: "rgba(255,255,255,0.8)" }) }}>{m.text}</div>
          </div>))}
        </div>
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}><div style={{ ...g, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}><input placeholder="Message..." className="si gi" style={{ fontFamily: "'Outfit',sans-serif", color: "rgba(255,255,255,0.85)" }} /><div className="snd" style={{ width: 30, height: 30, borderRadius: 10, ...g, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>↑</div></div></div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const notes = [
    "Glass panels via backdrop-filter: blur(20px) + rgba opacity",
    "User messages: higher glass opacity (0.18) vs AI (0.08)",
    "Ambient light orbs (radial-gradient divs) behind glass layers",
    "No timestamps or sender labels — atmospheric minimalism",
    "Icon-only send button (↑) in glass container",
    "Online indicators use solid teal (#7DDFBE) accent",
    "Selected sidebar item: elevated glass tier (0.14 opacity)",
  ];
  return (<div>
    <P>Live implementation of the Prism design system. Every token, component, and pattern from the spec applied to a working interface. Click sidebar items to see selection state behavior.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 460, borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <PrismChat sel={sel} setSel={setSel} />
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
   PRISM SPEC
   ═══════════════════════════════════════════════════════════════ */
function prismSpec(a) { return {
  overview: () => (<div>
    <P>Prism is an atmospheric interface aesthetic built on frosted glass panels, translucent layers, and moody gradient backgrounds. It creates depth through transparency and light rather than borders or shadows. Every surface is a window into the environment behind it.</P>
    <P>The system's identity comes from its materiality — interfaces that feel like looking through layered glass panes in a dimly lit architectural space.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[["Transparency is structure","Glass opacity tiers replace traditional backgrounds. Higher opacity = higher hierarchy. The environment always bleeds through."],["The gradient is the canvas","The multi-stop background gradient isn't decorative — it's required. Glass panels over a solid color are just semi-transparent rectangles."],["Blur carries elevation","Instead of box-shadows, Prism uses backdrop-filter blur. More blur = further from surface."],["Light as accent","Ambient light orbs and subtle luminance shifts replace traditional accent colors. Teal (#7DDFBE) used sparingly."]].map(([t,d],i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div><div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div></div>))}
    </div>
    <H3>When to Use Prism</H3>
    <Do>Media players, creative tools, OS interfaces, editorial platforms, e-commerce showcases</Do>
    <Dont>Data-dense dashboards (glass reduces contrast) or accessibility-first products</Dont>
  </div>),

  color: () => (<div>
    <P>Nearly every color is RGBA with alpha channels. Colors are context-dependent — the gradient behind the glass affects appearance.</P>
    <H3>Background Gradient</H3>
    <div style={{ height: 40, borderRadius: 6, background: "linear-gradient(150deg,#4A5D6B 0%,#5A4A5E 40%,#6B5A5A 70%,#4A6058 100%)", marginBottom: 6, border: "1px solid rgba(255,255,255,0.1)" }} />
    <Tk n="gradient.angle" v="150deg" d="Diagonal" a={a} />
    <Tk n="gradient.stops" v="#4A5D6B → #5A4A5E → #6B5A5A → #4A6058" a={a} />
    <H3>Glass Surfaces</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="rgba(255,255,255,0.08)" n="Base" v="rgba(…,0.08)" />
      <Sw c="rgba(255,255,255,0.14)" n="Elevated" v="rgba(…,0.14)" />
      <Sw c="rgba(255,255,255,0.18)" n="Strong" v="rgba(…,0.18)" />
    </div>
    <H3>Text (opacity-based)</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="rgba(255,255,255,0.95)" n="Primary" v="0.95" b="1px solid rgba(255,255,255,0.2)" />
      <Sw c="rgba(255,255,255,0.8)" n="Secondary" v="0.80" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="rgba(255,255,255,0.4)" n="Tertiary" v="0.40" b="1px solid rgba(255,255,255,0.1)" />
    </div>
    <H3>Accent — Teal</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#7DDFBE" n="Solid" v="#7DDFBE" />
      <Sw c="rgba(125,223,190,0.25)" n="Tinted" v="rgba(…,0.25)" />
      <Sw c="rgba(125,223,190,0.4)" n="Border" v="rgba(…,0.4)" />
    </div>
    <H3>Contrast Notes</H3>
    <P>Glass interfaces are inherently low-contrast. Ratios measured against darkest gradient stop:</P>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Primary on darkest gradient","~14:1","AAA"],["Primary on glass base","~10:1","AAA"],["Secondary on glass base","~5.5:1","AA"],["Tertiary on glass base","~2.5:1","Fails"],["Accent teal on glass base","~7:1","AAA"]].map((r,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 65px 50px", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: r[2]==="AAA"?"#34D399":r[2]==="AA"?"#FBBF24":"#FF6B6B" }}>{r[2]}</span>
        </div>))}
    </div>
    <Dont>Use tertiary text (0.4 opacity) for critical information — fails contrast on lighter areas</Dont>
  </div>),

  typography: () => (<div>
    <P>Single font — Outfit — in varying weights. No dual-font system. Hierarchy via weight, size, and opacity.</P>
    <div style={{ padding: "14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
      <div style={{ fontFamily: "'Outfit'", fontSize: 20, fontWeight: 300, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>Outfit</div>
      <div style={{ fontFamily: "'Outfit'", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Light 300 · Regular 400 · Medium 500 · Semibold 600</div>
      <div style={{ fontSize: 10.5, color: "#999" }}>Geometric sans-serif with soft, rounded feel. Light weights add airiness matching the glass aesthetic.</div>
    </div>
    <H3>Type Scale</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["display","16px","500","1.3","-0.02em","App name"],["title","13.5px","500","1.3","-0.01em","Headers"],["body","13px","400","1.6","0","Messages"],["label","12.5px","500","1.3","0","Sidebar items"],["caption","11px","400","1.4","0","Previews"],["micro","10px","500","1.3","0.03em","Status"],["micro-sm","9px","600","1.3","0","Badges"]].map((t,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 48px 42px 38px 50px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>
          {t.slice(1).map((v,vi) => <span key={vi} style={{ fontSize: 10, color: vi < 4 ? "#999" : "#666" }}>{v}</span>)}
        </div>))}
    </div>
    <Do>Use negative letter-spacing on display/title for tighter, premium feel</Do>
    <Dont>Use bold (700) weight — semibold (600) is the maximum permitted</Dont>
  </div>),

  elevation: () => (<div>
    <P>The Glass Composition System — three independent axes that combine to create translucent, layered surfaces. No box-shadows. Depth = blur + opacity.</P>
    <H3>Blur Tiers</H3>
    <Tk n="blur.subtle" v="backdrop-filter: blur(12px)" d="Decorative panels, avatars" a={a} />
    <Tk n="blur.standard" v="backdrop-filter: blur(20px)" d="Default glass surfaces" a={a} />
    <Tk n="blur.heavy" v="backdrop-filter: blur(24px)" d="Headers, overlays" a={a} />
    <H3>Opacity Tiers</H3>
    <Tk n="opacity.base" v="rgba(255,255,255,0.08)" d="Default panels" a={a} />
    <Tk n="opacity.elevated" v="rgba(255,255,255,0.14)" d="Selected/active" a={a} />
    <Tk n="opacity.strong" v="rgba(255,255,255,0.18)" d="User messages" a={a} />
    <H3>Composition Table</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Sidebar item (default)","None","transparent","None"],["Sidebar item (selected)","None","0.14","0.12"],["Avatar","blur(12px)","0.08","0.12"],["Chat header","blur(24px)","0.08","0.12"],["AI message","blur(20px)","0.08","0.12"],["User message","blur(20px)","0.18","0.12"],["Text input","blur(12px)","0.08","0.12"],["Send button","None","0.14","0.18"]].map((c,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 70px", padding: "5px 10px", borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          {c.map((v,vi) => <span key={vi} style={{ fontSize: 10, color: vi === 0 ? "#BBB" : "#888" }}>{v}</span>)}
        </div>))}
    </div>
    <H3>Performance Budget</H3>
    <Tk n="perf.maxBlurLayers" v="6" d="Max simultaneous per viewport" a={a} />
    <Tk n="perf.fallback" v="@supports + solid bg" d="For non-supporting devices" a={a} />
    <Do>Test on mid-range mobile — backdrop-filter is GPU-intensive</Do>
    <Dont>Apply blur to frequently re-rendered elements (animated lists)</Dont>
    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 12 }}>
      {[{r:6,l:"Badge"},{r:10,l:"Avatar"},{r:12,l:"Item"},{r:14,l:"Input"},{r:16,l:"Message"},{r:20,l:"Shell"}].map(x => (
        <div key={x.l} style={{ textAlign: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: x.r, border: "1px solid rgba(125,223,190,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <code className="mn" style={{ fontSize: 7, color: "#888" }}>{x.r}</code>
          </div>
          <div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>{x.l}</div>
        </div>))}
    </div>
  </div>),

  components: () => (<div>
    <P>Each component specifies glass composition, token values, and accessibility considerations. Click to expand.</P>
    <CBox title="ChatBubble" parts={["glass-panel","text","tail-radius"]} accent={a}
      contract="Must distinguish user from AI through glass opacity tier. Must support multi-line wrapping. No visible metadata — Prism keeps conversations clean and atmospheric."
      specs={[["padding","12px 16px"],["border-radius.user","16px 16px 4px 16px","Tail bottom-right"],["border-radius.ai","16px 16px 16px 4px","Tail bottom-left"],["user.opacity","rgba(…,0.18)","Glass strong"],["ai.opacity","rgba(…,0.08)","Glass base"],["blur","blur(20px)","Standard"],["border","1px solid rgba(…,0.12)"],["user.text","rgba(…,0.95)","Primary"],["ai.text","rgba(…,0.8)","Secondary"],["font","body (13px/1.6)"]]}
      dos={["Differentiate user/AI solely through opacity tier","Keep metadata-free for atmospheric feel"]}
      donts={["Add timestamps or sender labels","Use solid background fills"]} />
    <CBox title="SidebarItem" parts={["container","glass-avatar","title","preview","time","badge"]} accent={a}
      contract="Must show selected state through elevated glass. Must truncate preview. Must support unread badge with accent teal."
      specs={[["padding","10px 12px"],["border-radius","12px"],["selected.bg","rgba(…,0.14)","Glass elevated"],["selected.border","1px solid rgba(…,0.12)"],["avatar.size","34px"],["avatar.radius","10px"],["avatar.composition","blur(12px) + base + border"],["online.color","#7DDFBE"],["online.size","7px circle"],["title.color","rgba(…,0.85)"],["preview.color","rgba(…,0.4)"],["badge.bg","rgba(125,223,190,0.25)"],["badge.border","rgba(125,223,190,0.4)"],["badge.color","#7DDFBE","Solid accent"]]}
      dos={["Use glass composition for selected state"]}
      donts={["Use hard borders for selection","Use solid fills"]} />
    <CBox title="TextInput" parts={["glass-container","input","placeholder","glass-button"]} accent={a}
      contract="Must have visible glass boundary. Focus state. Send button uses elevated glass."
      specs={[["padding","10px 14px"],["border-radius","14px"],["composition","blur(12px) + base + border"],["placeholder.color","rgba(…,0.3)"],["text.color","rgba(…,0.85)"],["button.size","30px"],["button.radius","10px"],["button.composition","elevated + strong border"],["button.icon","↑ at rgba(…,0.7)"]]}
      dos={["Use icon-only send button (↑)"]}
      donts={["Use text labels like 'Send' or 'go →'"]} />
    <CBox title="Badge" parts={["glass-container","count"]} accent={a}
      contract="Must use accent teal. Must be visible against glass surfaces."
      specs={[["size","18px height"],["border-radius","6px"],["background","rgba(125,223,190,0.25)","Tinted glass"],["border","1px solid rgba(125,223,190,0.4)"],["color","#7DDFBE","Solid accent"],["font","micro-sm (9px/600)"]]}
      dos={["Use tinted glass for badges"]}
      donts={["Use solid color fills"]} />
    <CBox title="Header" parts={["glass-panel","icon","title","subtitle"]} accent={a}
      contract="Must separate from content via glass + border. Must show context and status."
      specs={[["padding","14px 20px"],["composition","blur(24px) + base + border","Heavy blur"],["border-bottom","rgba(…,0.1)"],["title.color","rgba(…,0.9)"],["title.font","title (13.5px/500)"],["subtitle.color","rgba(…,0.35)"],["subtitle.text","'active session'"]]}
      dos={["Use heaviest blur tier (24px)"]}
      donts={["Fill with solid accent color","Use cursive fonts for status"]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Prism layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width","260px fixed"],["Divider","1px solid rgba(…,0.1)"],["Sidebar bg","Inherits page gradient — no separate bg"],["Content order","Brand → Search → Chat list → User panel"]] },
      { n: "Chat Message Flow", rows: [["Alignment","User → right, AI → left"],["Max width","78%"],["Gap","12px"],["Entrance","fadeSlideUp, 500ms ease-out, 100ms stagger"],["Metadata","Hidden — no timestamps, no sender labels"]] },
      { n: "Active Selection", rows: [["Model","Single select"],["Visual","Glass tier shift: base → elevated"],["Transition","250ms ease-out"]] },
      { n: "Ambient Background", rows: [["Gradient","4-stop, 150deg diagonal"],["Orb count","2–3 per viewport"],["Orb size","120–200px diameter"],["Orb opacity","0.15–0.25"],["Orb interaction","pointer-events: none"]] },
    ].map((p,pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4>
      <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        {p.rows.map((r,ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
        </div>))}
      </div>
    </div>))}
  </div>),

  extensions: () => (<div>
    <H3>1. Ambient Light Orbs</H3>
    <P>Background radial gradients positioned at fixed coordinates. They create pools of colored light that bleed through glass panels, giving environmental depth.</P>
    <Tk n="element" v="div with radial-gradient" a={a} />
    <Tk n="size" v="120–200px diameter" a={a} />
    <Tk n="opacity" v="0.15–0.25" d="Subtle, never dominant" a={a} />
    <Tk n="pointer-events" v="none" d="Purely decorative" a={a} />
    <Tk n="z-index" v="0" d="Behind all content" a={a} />
    <Tk n="max-count" v="3 per viewport" a={a} />
    <Do>Use colors complementary to gradient stops — muted mauves, soft teals</Do>
    <Dont>Animate orb positions (motion sickness risk + performance)</Dont>
    <Dont>Use bright or saturated orb colors</Dont>
    <H3>2. Glass Composition System</H3>
    <P>Every surface built by composing three independent axes: blur radius, background opacity, border opacity. Any blur tier can pair with any opacity tier. See Elevation section for full documentation.</P>
    <Do>Treat axes as independent — composable, not preset</Do>
    <Dont>Lock specific combinations into named presets</Dont>
    <H3>3. Performance Budget</H3>
    <Tk n="max.blur.layers" v="6" d="Simultaneous visible" a={a} />
    <Tk n="fallback.strategy" v="@supports query" a={a} />
    <Tk n="fallback.bg" v="rgba(40,50,55,0.85)" d="Solid for non-supporting" a={a} />
    <Do>{"Provide pre-blurred fallback for older browsers"}</Do>
    <H3>4. Multi-Stop Gradient Background</H3>
    <P>The page gradient is structural, not decorative. Glass over a solid color is visually meaningless. The gradient makes transparency legible.</P>
    <Do>At least 4 stops with hue variation. Mid-range lightness (HSL 30–45%).</Do>
    <Dont>2-stop linear gradient — insufficient for glass surfaces</Dont>
  </div>),

  voice: () => (<div>
    <P>Prism's voice is minimal and ambient. Microcopy should feel like whispered labels in a quiet gallery.</P>
    <H3>Tone</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Minimal","Ambient","Understated","Quietly confident"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never loud","Never playful"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>
    <H3>Labels</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Chat input","Message...","Single word, no preamble"],["Search","Search...","Identical to Sketch"],["Status","active session","Lowercase, descriptive"],["User panel","You · active","Dot separator"],["Empty state","No conversations yet","Plain, no emoji"]].map((p,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <span style={{ fontSize: 10.5, color: "#7DDFBE" }}>{p[1]}</span>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>))}
    </div>
    <Do>Single-word labels. Dot separator (·). Lowercase for all status/meta text.</Do>
    <Dont>Emoji. Exclamation marks. Personality. Editorial commentary.</Dont>
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
  const spec = prismSpec(TM.color);
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
  const [sec, setSec] = useState("preview");
  const [sel, setSel] = useState(1);

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0A0A0A", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#EEE" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
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
        .gi::placeholder { color: rgba(255,255,255,0.25) }
        .snd { cursor: pointer; transition: transform 0.1s; flex-shrink: 0 }
        .snd:hover { transform: scale(1.05) }
        .mi { animation: fadeSlideUp 0.35s ease both }
        .ci { animation: fadeSlideUp 0.3s ease both }
        .ci:hover { opacity: 0.88 }
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
