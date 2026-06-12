import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — REVOLT
   Neobrutalist + Y2K · Single-theme standalone spec + live preview
   ═══════════════════════════════════════════════════════════════ */

const TM = { name: "Revolt", tag: "Neobrutalist + Y2K", color: "#FF3366" };

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
function RevoltChat({ sel, setSel }) {
  const [hov, setHov] = useState(null);
  return (
    <div className="app-sh" style={{ background: "#FFFEF5", fontFamily: "'Space Mono', monospace", borderRadius: 0, border: "3px solid #111" }}>
      {/* Sidebar */}
      <div className="sb" style={{ borderRight: "3px solid #111" }}>
        <div style={{ padding: "12px 12px 10px", background: "#C8FF00", borderBottom: "3px solid #111" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111", textTransform: "uppercase", letterSpacing: "0.08em" }}>REVOLT.chat</div>
        </div>
        <div style={{ padding: "10px 10px 6px" }}>
          <div style={{ display: "flex", border: "2px solid #111" }}>
            <input placeholder="FIND..." className="si" style={{ fontFamily: "'Space Mono', monospace", color: "#111", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.05em", padding: "8px 10px" }} />
          </div>
        </div>
        <div className="cl">
          {chatList.map((c, i) => (
            <div key={c.id} onClick={() => setSel(c.id)} onMouseEnter={() => setHov(c.id)} onMouseLeave={() => setHov(null)} className="ci" style={{ padding: "10px 12px", cursor: "pointer", margin: "0 8px 4px", border: sel === c.id ? "2px solid #111" : "2px solid transparent", background: sel === c.id ? "#C8FF00" : "transparent", boxShadow: sel === c.id ? "3px 3px 0 #111" : "none", transform: hov === c.id ? "rotate(-0.5deg)" : "none", transition: "transform 0.12s", animationDelay: `${i * 50}ms` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 30, height: 30, border: "2px solid #111", background: sel === c.id ? "#FF3366" : "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{c.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#111", textTransform: "uppercase" }}>{c.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#999" }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{c.preview}</div>
                </div>
                {c.unread > 0 && <div style={{ padding: "2px 6px", border: "2px solid #111", background: "#FF3366", fontSize: 9, fontWeight: 700, color: "#FFF" }}>{c.unread}</div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 12px", borderTop: "3px solid #111", background: "#FFF" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, border: "2px solid #111", background: "#C8FF00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>U</div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#111" }}>USER_01</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="ca">
        <div style={{ borderBottom: "3px solid #111", padding: "10px 16px", background: "#FF3366" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🗼</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FFF", textTransform: "uppercase", letterSpacing: "0.06em" }}>TOKYO TRIP</span>
            <div style={{ marginLeft: "auto", padding: "2px 8px", border: "2px solid #FFF", fontSize: 9, fontWeight: 700, color: "#FFF" }}>LIVE</div>
          </div>
        </div>

        <div className="ma" style={{ padding: 16 }}>
          {msgs.map((m, i) => (
            <div key={m.id} className="mi" style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "80%", animationDelay: `${i * 60}ms` }}>
              <div style={{ padding: "10px 14px", border: "2px solid #111", fontSize: 11.5, lineHeight: 1.5, ...(m.sender === "user" ? { background: "#FF3366", color: "#FFF", boxShadow: "4px 4px 0 #111" } : { background: "#FFF", boxShadow: "4px 4px 0 #111", color: "#111" }) }}>{m.text}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#999", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.1em", textAlign: m.sender === "user" ? "right" : "left" }}>{m.sender === "user" ? "YOU" : "BOT"} // 00:{i + 1}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "10px 16px", borderTop: "3px solid #111" }}>
          <div style={{ display: "flex", border: "2px solid #111" }}>
            <input placeholder="SAY SOMETHING..." className="si" style={{ fontFamily: "'Space Mono', monospace", color: "#111", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.04em", padding: "10px 12px" }} />
            <div className="snd" style={{ width: 44, borderLeft: "2px solid #111", background: "#C8FF00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#111" }}>→</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const notes = [
    "Hard-offset shadows: 4px 4px 0 #111 — zero blur always",
    "2px solid #111 borders on every component boundary",
    "border-radius: 0 on all elements — rectangles only",
    "Code-style timestamps: YOU // 00:1 below every message",
    "Lime (#C8FF00) active state with hard shadow on selection",
    "Pink (#FF3366) header bar + user message fills",
    "Hover rotation: -0.5deg counterclockwise on sidebar items",
  ];
  return (<div>
    <P>Live implementation of the Revolt design system. Every token, component, and pattern from the spec applied to a working interface. Click sidebar items to see selection state behavior.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 460, borderRadius: 0, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <RevoltChat sel={sel} setSel={setSel} />
      </div>
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Design tokens in action</div>
        {notes.map((n, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 0, border: `1px solid ${TM.color}15`, background: `${TM.color}06`, marginBottom: 4, fontSize: 10, color: "#BBB", lineHeight: 1.4 }}>
            <span style={{ color: TM.color, marginRight: 4 }}>→</span>{n}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   REVOLT SPEC
   ═══════════════════════════════════════════════════════════════ */
function revoltSpec(a) { return {
  overview: () => (<div>
    <P>Revolt is a neobrutalist interface system with Y2K energy. It rejects polish, rounded corners, and subtle gradients in favor of hard borders, offset shadows, monospaced type, and a deliberately raw aesthetic.</P>
    <P>The system's identity is confrontational clarity. Every element announces itself with thick black borders and hard shadows. Color is restricted to five values. Typography is monospaced and uppercase.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[["Black borders define everything","Every element has a 2–3px solid black border. This is the system's skeleton. Remove the borders and the interface collapses."],["Zero blur, hard offset shadows","All shadows use 0px blur radius. Shadow = offset only (e.g., 4px 4px 0 #111). The hard edge is the aesthetic."],["Five colors, no exceptions","Black, white, cream, neon lime, hot pink. That's the entire palette. Every color has a strict role. No gradients. No opacity variations."],["Zero radius everywhere","border-radius: 0 on every element. Rectangles only. No rounding, no pills, no circles. Structural rule."]].map(([t, d], i) => (
        <div key={i} style={{ padding: "10px 12px", border: "2px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.02em" }}>{t}</div>
          <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div>
        </div>))}
    </div>
    <Do>Creative agencies, indie games, Gen Z social platforms, music apps, portfolio sites, dev tools</Do>
    <Dont>Corporate products, financial services, healthcare, or trust-first aesthetics</Dont>
  </div>),

  color: () => (<div>
    <P>Five colors total. Each has exactly one role. Adding a sixth would break the system.</P>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 12 }}>
      <Sw c="#111" n="Black" v="#111" b="2px solid #333" />
      <Sw c="#FFF" n="White" v="#FFF" b="2px solid #111" />
      <Sw c="#FFFEF5" n="Cream" v="#FFFEF5" b="2px solid #111" />
      <Sw c="#C8FF00" n="Lime" v="#C8FF00" b="2px solid #111" />
      <Sw c="#FF3366" n="Pink" v="#FF3366" b="2px solid #111" />
    </div>
    <H3>Color Roles</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["#111","Black","Borders, shadows, text","Backgrounds"],["#FFF","White","Card surfaces, AI messages","Text on light"],["#FFFEF5","Cream","Page background only","Any other role"],["#C8FF00","Lime","Active states, send button","Text or borders"],["#FF3366","Pink","User msgs, headers, badges","AI msgs or structural"]].map((c, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "30px 50px 1fr 1fr", padding: "6px 10px", borderBottom: i < 4 ? "2px solid rgba(255,255,255,0.04)" : "none" }}>
          <div style={{ width: 18, height: 18, background: c[0], border: "2px solid #333" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#DDD" }}>{c[1]}</span>
          <span style={{ fontSize: 10, color: "#999" }}>{c[2]}</span>
          <span style={{ fontSize: 10, color: "#FF6B6B" }}>Never: {c[3]}</span>
        </div>))}
    </div>
    <H3>Contrast Ratios</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["Black on Cream","18.5:1","AAA"],["Black on White","19.9:1","AAA"],["Black on Lime","15.3:1","AAA"],["White on Pink","4.2:1","AA"],["Black on Pink","4.8:1","AA"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 65px 50px", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: "#34D399" }}>{r[2]}</span>
        </div>))}
    </div>
    <P>High-contrast palette naturally passes WCAG AA on all combinations.</P>
  </div>),

  typography: () => (<div>
    <P>Single monospaced font — Space Mono — everywhere. No secondary font. Everything except body text is uppercase.</P>
    <div style={{ padding: "14px", border: "2px solid rgba(255,255,255,0.08)", marginBottom: 12 }}>
      <div style={{ fontFamily: "'Space Mono'", fontSize: 18, fontWeight: 700, color: "#EEE", textTransform: "uppercase", letterSpacing: "0.06em" }}>Space Mono</div>
      <div style={{ fontSize: 10.5, color: "#888" }}>Regular 400 · Bold 700. Two weights only.</div>
    </div>
    <H3>Transform Rules</H3>
    <Tk n="transform.labels" v="uppercase" d="All labels, nav, headings" a={a} />
    <Tk n="transform.body" v="none" d="Message text only" a={a} />
    <Tk n="transform.placeholders" v="uppercase" d="Input placeholders" a={a} />
    <Tk n="transform.meta" v="uppercase" d="Timestamps, status" a={a} />
    <H3>Type Scale</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["display","14px","700","0.08em","Brand, titles"],["title","12px","700","0.06em","Headers, labels"],["body","11.5px","400","0","Messages (not uppercase)"],["label","11px","700","0.04em","Sidebar items"],["caption","10px","400","0","Preview text"],["micro","9px","700","0.1em","Status pills"],["micro-sm","8px","700","0.1em","Code metadata"]].map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 48px 38px 50px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>
          {t.slice(1).map((v, vi) => <span key={vi} style={{ fontSize: 10, color: vi < 3 ? "#999" : "#666" }}>{v}</span>)}
        </div>))}
    </div>
    <P>Revolt's font sizes run smaller. Wide letter-spacing + uppercase makes text appear larger than pixel size.</P>
    <Do>Wide letter-spacing (0.04–0.1em) on all uppercase text</Do>
    <Dont>Letter-spacing on body text — hurts readability</Dont>
  </div>),

  elevation: () => (<div>
    <P>Hard-offset box-shadows with zero blur. The shadow is a solid rectangle displaced from the element.</P>
    <H3>Shadow Scale</H3>
    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
      {[["sm","2px 2px 0 #111"],["md","3px 3px 0 #111"],["lg","4px 4px 0 #111"],["xl","6px 6px 0 #111"]].map(([n, v]) => (
        <div key={n} style={{ textAlign: "center" }}>
          <div style={{ width: 52, height: 36, background: "#FFF", border: "2px solid #111", boxShadow: v, marginBottom: 6 }} />
          <code className="mn" style={{ fontSize: 9, color: "#CCC" }}>{n}</code>
          <div><code className="mn" style={{ fontSize: 8, color: "#666" }}>{v}</code></div>
        </div>))}
    </div>
    <Tk n="blur" v="0px" d="ALWAYS. No exceptions." a={a} />
    <Tk n="shadow.color" v="#111" d="Always black" a={a} />
    <H3>Border System</H3>
    <Tk n="border.width.component" v="2px" d="Buttons, inputs, cards, avatars" a={a} />
    <Tk n="border.width.structural" v="3px" d="Sidebar divider, header, footer" a={a} />
    <Tk n="border.color" v="#111111" d="Always black" a={a} />
    <Tk n="border.radius" v="0" d="All elements. No exceptions." a={a} />
    <H3>Rule Hierarchy</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["border-radius: 0","INVIOLABLE","Zero everywhere"],["Shadow blur: 0","INVIOLABLE","Hard offset only"],["5-color palette","INVIOLABLE","No new colors"],["Border color: #111","INVIOLABLE","Always black"],["Shadow offset (2–6px)","FLEXIBLE","Can vary"],["Hover rotation angle","FLEXIBLE","±1° max"],["Letter-spacing","FLEXIBLE","Adjustable"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{r[0]}</code>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: r[1] === "INVIOLABLE" ? "#FF3366" : "#C8FF00" }}>{r[1]}</span>
          <span style={{ fontSize: 10, color: "#888" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  components: () => (<div>
    <P>Each component obeys the hard-border, zero-radius, 5-color system. Click to expand.</P>
    <CBox title="ChatBubble" parts={["bordered-box", "text", "code-meta"]} accent={a}
      contract="Must distinguish user from AI through fill color. Must show code-style metadata below every message. Must use hard shadows."
      specs={[["padding","10px 14px"],["border","2px solid #111"],["border-radius","0"],["shadow","4px 4px 0 #111","shadow.lg"],["user.background","#FF3366","Pink"],["user.color","#FFFFFF"],["ai.background","#FFFFFF"],["ai.color","#111111"],["font","body (11.5px/1.5)"],["meta.format","'YOU // 00:1'","Code-style"],["meta.font","micro-sm (8px/700)"],["meta.color","#999999"],["meta.transform","uppercase"],["meta.spacing","0.1em"]]}
      dos={["Show code-style metadata below every message","Use hard shadows on every bubble"]}
      donts={["Use rounded corners","Hide metadata","Use colored shadows"]} />

    <CBox title="SidebarItem" parts={["bordered-container", "bordered-avatar", "title", "preview", "badge"]} accent={a}
      contract="Must show selected state with lime fill + border + shadow. Must rotate on hover. Avatar fills pink when selected."
      specs={[["padding","10px 12px"],["border-radius","0"],["selected.bg","#C8FF00","Lime"],["selected.border","2px solid #111"],["selected.shadow","3px 3px 0 #111"],["hover.transform","rotate(-0.5deg)"],["avatar.size","30px"],["avatar.border","2px solid #111"],["avatar.bg.default","#FFFFFF"],["avatar.bg.selected","#FF3366","Pink when active"],["title.transform","uppercase"]]}
      dos={["Rotate -0.5deg on hover — signature interaction","Swap avatar bg to pink when selected"]}
      donts={["Use subtle opacity changes","Round any corners"]} />

    <CBox title="TextInput" parts={["bordered-container", "input", "bordered-button"]} accent={a}
      contract="Must use 2px black border. Send button integrated in container. Button uses lime fill."
      specs={[["border","2px solid #111"],["border-radius","0"],["placeholder.transform","uppercase"],["placeholder.text","'SAY SOMETHING...'"],["button.width","44px"],["button.bg","#C8FF00","Lime"],["button.border-left","2px solid #111","Internal divider"],["button.icon","→","Right arrow, not ↑"],["button.font","16px / 900"]]}
      dos={["Use → (right arrow) for send, not ↑","Integrate button in input container","Uppercase placeholder"]}
      donts={["Separate button visually","Use cursive labels"]} />

    <CBox title="Header" parts={["accent-bar", "icon", "title", "status-pill"]} accent={a}
      contract="Must use accent fill (pink) as background. Must show status in bordered pill."
      specs={[["padding","10px 16px"],["background","#FF3366","Pink fill"],["border-bottom","3px solid #111"],["title.color","#FFFFFF"],["title.transform","uppercase"],["status.border","2px solid #FFF"],["status.padding","2px 8px"],["status.text","'LIVE'","Uppercase pill"]]}
      dos={["Fill header with pink","Show status in bordered rectangular pill"]}
      donts={["Transparent header (Sketch)","Glass header (Prism)"]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Revolt layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width","260px fixed"],["Divider","3px solid #111 (structural weight)"],["Header bg","Lime (#C8FF00) for brand"],["Section dividers","3px solid #111"]] },
      { n: "Chat Message Flow", rows: [["Alignment","User → right, AI → left"],["Max width","80% (widest of all themes)"],["Gap","12px"],["Entrance","fadeSlideUp, 300ms ease-out, 60ms stagger"],["Metadata","Below every message: code-style"],["Shadows","shadow.lg on every bubble"]] },
      { n: "Active Selection", rows: [["Model","Single select"],["Visual","Lime bg + 2px border + shadow.md"],["Avatar change","Fills pink"],["Transition","150ms linear (instant)"]] },
      { n: "Search", rows: [["Container","2px black border, no radius"],["Placeholder","'FIND...' — uppercase mono"],["No icon","Too decorative for Revolt"]] },
    ].map((p, pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4>
      <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
        {p.rows.map((r, ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
        </div>))}
      </div>
    </div>))}
  </div>),

  extensions: () => (<div>
    <H3>1. Code-Style Timestamps</H3>
    <P>Metadata rendered as monospace code comments. Makes chat feel like reading a terminal log.</P>
    <Tk n="format" v="SENDER // 00:INDEX" d="e.g., 'YOU // 00:1'" a={a} />
    <Tk n="font" v="micro-sm (8px/700)" a={a} />
    <Tk n="color" v="#999999" a={a} />
    <Tk n="transform" v="uppercase" a={a} />
    <Tk n="spacing" v="0.1em" a={a} />
    <Tk n="position" v="Below message, aligned to sender side" a={a} />
    <Do>Show on every message — part of the visual rhythm</Do>
    <Dont>Use natural language timestamps ("just now", "2 min ago")</Dont>

    <H3>2. Hover Rotation</H3>
    <P>Interactive elements rotate slightly on hover. Mechanical, almost glitchy feel.</P>
    <Tk n="angle.default" v="-0.5deg" a={a} />
    <Tk n="angle.max" v="±1deg" a={a} />
    <Tk n="duration" v="120ms" a={a} />
    <Tk n="easing" v="linear" d="Mechanical snap" a={a} />
    <Tk n="applies-to" v="SidebarItem, ChatBubble" a={a} />
    <Do>Apply to hoverable cards and list items</Do>
    <Dont>Rotate buttons, inputs, or nav elements</Dont>
    <Dont>Exceed 1 degree</Dont>

    <H3>3. Zero-Blur Shadows</H3>
    <P>All box-shadows use 0px blur radius. Always #111. Always bottom-right offset. The most inviolable visual rule.</P>
    <Dont>Add blur to any shadow for any reason</Dont>
    <Dont>Use colored shadows or negative offsets</Dont>

    <H3>4. Status Pills</H3>
    <P>System status in rectangular bordered pills with uppercase text.</P>
    <Tk n="border" v="2px solid (context color)" a={a} />
    <Tk n="padding" v="2px 8px" a={a} />
    <Tk n="font" v="micro (9px/700)" a={a} />
    <Tk n="radius" v="0" d="Rectangular" a={a} />
    <Tk n="variants" v="LIVE, TYPING, OFFLINE, ERROR" a={a} />
    <Do>White border + white text on accent backgrounds</Do>
    <Do>Black border + black text on white/cream backgrounds</Do>
  </div>),

  voice: () => (<div>
    <P>Revolt's voice is blunt, mechanical, and stripped of all softness. Microcopy reads like terminal output.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Blunt","Mechanical","Direct","Code-like"].map(t => <span key={t} style={{ fontSize: 9, padding: "2px 7px", background: "rgba(52,211,153,0.05)", border: "2px solid rgba(52,211,153,0.15)", color: "#34D399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t}</span>)}
      {["Never warm","Never playful"].map(t => <span key={t} style={{ fontSize: 9, padding: "2px 7px", background: "rgba(255,107,107,0.05)", border: "2px solid rgba(255,107,107,0.15)", color: "#FF6B6B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t}</span>)}
    </div>
    <H3>Labels</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["Chat input","SAY SOMETHING...","Imperative, uppercase"],["Search","FIND...","One word, commanding"],["Status","LIVE","Bordered pill"],["User label","USER_01","Underscore-separated"],["Empty state","NO_DATA","Code variable format"],["Loading","LOADING...","Uppercase + ellipsis"],["Metadata","YOU // 00:1","Comment-style"]].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <span style={{ fontSize: 10.5, color: "#C8FF00", fontFamily: "'Space Mono'", fontWeight: 700 }}>{p[1]}</span>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>))}
    </div>
    <Do>UPPERCASE all labels and status. Underscores for compounds. // as separator.</Do>
    <Dont>Emoji — ever. Enthusiasm. Casual tone. Sentence case (except body text).</Dont>
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
  const spec = revoltSpec(TM.color);
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
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
        .snd { cursor: pointer; transition: transform 0.1s; flex-shrink: 0 }
        .snd:hover { transform: scale(1.05) }
        .mi { animation: fadeSlideUp 0.25s linear both }
        .ci { animation: fadeSlideUp 0.2s linear both }
        .ci:hover { background: rgba(255,51,102,0.04) }
        .bc-rev:hover { background: rgba(200,255,0,0.08) !important }
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
