import { useState, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — EDITORIAL
   Long-form Serif + Newsprint Masthead · Single-theme standalone spec + live preview
   ═══════════════════════════════════════════════════════════════ */

const TM = { name: "Editorial", tag: "Long-form Serif + Newsprint Masthead", color: "#8B1E2D" };

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
  { id: 4, sender: "ai", text: "Perfect combination. I'd suggest starting in Asakusa for Senso-ji at sunrise, then heading to Shibuya for the evening food scene. Want me to build a day-by-day itinerary?" },
];

/* ─── SHARED HELPERS ─── */
const Tk = ({ n, v, d, a = "#999" }) => <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" }}><code className="mn" style={{ fontSize: 10, color: "#CCC", minWidth: 170 }}>{n}</code><code className="mn" style={{ fontSize: 10, color: a, minWidth: 120 }}>{v}</code>{d && <span style={{ fontSize: 9.5, color: "#555" }}>{d}</span>}</div>;
const Sw = ({ c, n, v, b }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}><div style={{ width: 24, height: 24, borderRadius: 2, background: c, border: b || "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} /><div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#CCC" }}>{n}</div><code className="mn" style={{ fontSize: 9, color: "#666" }}>{v}</code></div></div>;
const H3 = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, color: "#EEE", margin: "22px 0 10px", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</h3>;
const H4 = ({ children }) => <h4 style={{ fontSize: 11.5, fontWeight: 600, color: "#CCC", margin: "16px 0 6px" }}>{children}</h4>;
const P = ({ children }) => <p style={{ fontSize: 12, color: "#999", lineHeight: 1.6, margin: "0 0 10px" }}>{children}</p>;
const Do = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 4, marginBottom: 4, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#34D399", flexShrink: 0 }}>✓</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Dont = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 4, marginBottom: 4, background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#FF6B6B", flexShrink: 0 }}>✗</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Pill = ({ children, color }) => <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, background: `${color}10`, border: `1px solid ${color}25`, color, fontWeight: 600 }}>{children}</span>;

const CBox = ({ title, parts, contract, specs, dos, donts, accent }) => {
  const [open, setOpen] = useState(false);
  return (<div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
    <div onClick={() => setOpen(!open)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: open ? "rgba(255,255,255,0.02)" : "transparent" }}>
      <span style={{ fontSize: 9, color: "#555", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
      <span className="mn" style={{ fontSize: 12, fontWeight: 700, color: "#EEE" }}>{title}</span>
      <div style={{ display: "flex", gap: 3, marginLeft: "auto" }}>{parts.map(p => <code key={p} style={{ fontSize: 8, padding: "1px 5px", borderRadius: 2, background: "rgba(255,255,255,0.03)", color: "#666" }}>{p}</code>)}</div>
    </div>
    {open && <div style={{ padding: "0 14px 14px" }}>
      <div style={{ padding: "8px 12px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", marginBottom: 10 }}>
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
function EditorialChat({ sel, setSel }) {
  return (
    <div className="app-sh" style={{ background: "#F8F4EC", fontFamily: "'Fraunces', Georgia, serif", borderRadius: 0, border: "1px solid #D8CEB9", color: "#1A1614" }}>
      {/* Sidebar */}
      <div className="sb" style={{ borderRight: "1px solid #D8CEB9" }}>
        <div style={{ padding: "18px 16px 10px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: "#1A1614", letterSpacing: "-0.02em", lineHeight: 0.95 }}>Editorial</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B1E2D", fontWeight: 600, marginTop: 5 }}>Vol. I · No. 04 · April</div>
        </div>
        <div style={{ borderTop: "3px double #8B1E2D", margin: "0 16px 12px" }} />

        <div style={{ padding: "0 16px 10px" }}>
          <input placeholder="Search the archives…" className="si" style={{ fontFamily: "'Fraunces', serif", fontSize: 12, color: "#1A1614", fontStyle: "italic", borderBottom: "1px solid #D8CEB9", paddingBottom: 4 }} />
        </div>

        <div style={{ padding: "0 16px 4px", fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8B7D6F", fontWeight: 600 }}>Recent Dispatches</div>

        <div className="cl">
          {chatList.map((c, i) => (
            <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "10px 16px", cursor: "pointer", borderTop: i === 0 ? "1px solid #1A1614" : "1px solid #E8DFCA", background: sel === c.id ? "#F1ECDF" : "transparent", animationDelay: `${i * 60}ms` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B7D6F", fontWeight: 600 }}>{c.time} ago · {c.avatar}</span>
                {c.unread > 0 && <span style={{ fontFamily: "'Fraunces', serif", fontSize: 11, fontWeight: 700, color: "#8B1E2D" }}>{c.unread} new</span>}
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: sel === c.id ? 700 : 600, color: "#1A1614", letterSpacing: "-0.01em", lineHeight: 1.15 }}>{c.name}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "#5C4F44", lineHeight: 1.4, marginTop: 3, fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid #1A1614" }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8B7D6F", fontWeight: 600 }}>Your byline</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 13, fontWeight: 600, color: "#1A1614", marginTop: 2 }}>T. Harris</div>
        </div>
      </div>

      {/* Main */}
      <div className="ca">
        {/* Masthead */}
        <div style={{ padding: "18px 24px 10px", borderBottom: "1px solid #1A1614" }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#8B1E2D", fontWeight: 700, marginBottom: 4 }}>Dispatch · Tokyo Desk</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, color: "#1A1614", letterSpacing: "-0.02em", lineHeight: 1 }}>Tokyo Trip</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8B7D6F", fontWeight: 600 }}>Filed 14:23 · 4 exchanges</div>
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 12, fontStyle: "italic", color: "#5C4F44", marginTop: 6, lineHeight: 1.4 }}>Planning a culture-and-cuisine tour of the capital — morning temples, evening ramen, a brief aside on Shibuya's after-dark food scene.</div>
        </div>

        {/* Messages as article */}
        <div className="ma" style={{ padding: "20px 24px" }}>
          {msgs.map((m, i) => (
            <div key={m.id} className="mi" style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: m.sender === "user" ? "68%" : "86%", animationDelay: `${i * 100}ms` }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: "0.18em", textTransform: "uppercase", color: m.sender === "user" ? "#8B1E2D" : "#8B7D6F", fontWeight: 700, marginBottom: 6, borderBottom: m.sender === "ai" ? "1px solid #D8CEB9" : "none", paddingBottom: m.sender === "ai" ? 4 : 0 }}>
                {m.sender === "user" ? "Reply · T. Harris" : "The Dispatch"}
                <span style={{ color: "#8B7D6F", fontWeight: 500, marginLeft: 8 }}>14:{23 + i}</span>
              </div>
              {m.sender === "ai" ? (
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: "#1A1614", lineHeight: 1.55, fontWeight: 400 }}>
                  {i === 1 ? (<><span style={{ fontFamily: "'Fraunces', serif", fontSize: 54, lineHeight: 0.85, fontWeight: 700, float: "left", marginRight: 8, marginTop: 6, marginBottom: -4, color: "#8B1E2D" }}>{m.text.charAt(0)}</span>{m.text.slice(1)}</>) : m.text}
                </div>
              ) : (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontStyle: "italic", color: "#1A1614", lineHeight: 1.55, paddingLeft: 10, borderLeft: "2px solid #8B1E2D" }}>{m.text}</div>
              )}
            </div>
          ))}

          <div className="mi" style={{ alignSelf: "flex-start", maxWidth: "100%", animationDelay: "400ms" }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8B7D6F", fontWeight: 700, marginBottom: 6 }}>Choose a Section →</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderTop: "1px solid #D8CEB9", borderLeft: "1px solid #D8CEB9" }}>
              {[["I.", "Temples"], ["II.", "Ramen"], ["III.", "Culture"], ["IV.", "Parks"]].map(([n, l], ti) => (
                <div key={ti} className="bc-ed" style={{ padding: "10px 12px", borderRight: "1px solid #D8CEB9", borderBottom: "1px solid #D8CEB9", cursor: "pointer" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 10, color: "#8B1E2D", fontWeight: 600, fontStyle: "italic" }}>{n}</div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 14, color: "#1A1614", fontWeight: 600, letterSpacing: "-0.01em" }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #1A1614", background: "#F1ECDF" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <input placeholder="Write your reply…" className="si" style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: "#1A1614", fontStyle: "italic" }} />
            <div className="snd" style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: "#8B1E2D" }}>File Reply →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const notes = [
    "Fraunces serif for all body + display type; Inter only for metadata + labels",
    "Drop cap on first AI message (54px Fraunces 700, burgundy) — masthead convention",
    "Dateline metadata in Inter, 8.5px, 0.18em tracking, uppercase — small-caps effect",
    "Burgundy (#8B1E2D) reserved exclusively for mastheads, drop caps, and reply marks",
    "3px double rule under sidebar brand — newspaper masthead tradition",
    "User messages italic Inter with burgundy left rule — voice-via-typography",
    "AI messages roman Fraunces with horizontal divider above sender — article convention",
    "Input placeholder italic Fraunces — echoes the content-editing register",
  ];
  return (<div>
    <P>Live implementation of the Editorial design system. Every token, component, and pattern from the spec applied to a working interface. Click sidebar items to see selection state behavior.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 480, borderRadius: 0, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <EditorialChat sel={sel} setSel={setSel} />
      </div>
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Design tokens in action</div>
        {notes.map((n, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 4, border: `1px solid ${TM.color}20`, background: `${TM.color}06`, marginBottom: 4, fontSize: 10, color: "#BBB", lineHeight: 1.4 }}>
            <span style={{ color: TM.color, marginRight: 4 }}>→</span>{n}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   EDITORIAL SPEC
   ═══════════════════════════════════════════════════════════════ */
function editorialSpec(a) { return {
  overview: () => (<div>
    <P>Editorial is a long-form publishing aesthetic built on a display serif for content, a clean sans for metadata, and the typographic conventions of printed newspapers and literary magazines. Messages read as dispatches; replies read as marginalia; the interface feels like a broadsheet.</P>
    <P>Its identity lives in the dual-typeface boundary and the treatment of metadata as small-cap tracked chrome. Where a conversational UI uses bubbles, Editorial uses article conventions: datelines, drop caps, horizontal rules, pull-quotes.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[
        ["Serif content, sans chrome","Fraunces carries the conversation — every message, heading, and reply. Inter is reserved for metadata, timestamps, labels, and system chrome. Never mix within a line."],
        ["Metadata as small caps","All timestamps, section labels, sender tags, and navigation rendered in Inter, 8.5–9px, 0.16–0.20em tracking, uppercase. This creates the newsprint rhythm."],
        ["Burgundy is the masthead","#8B1E2D appears only in mastheads, drop caps, reply rules, and unread counts. It is editorial red, not a generic accent — treat it with restraint."],
        ["Rules, not boxes","Horizontal rules (1px solid #1A1614) and double rules (3px double #8B1E2D) carry structural weight. Avoid panels, cards, and bordered containers with backgrounds."],
      ].map(([t, d], i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div>
          <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div>
        </div>))}
    </div>
    <H3>When to Use Editorial</H3>
    <Do>Content-first products, reading apps, research tools, long-form AI dialogue, archive/journal interfaces</Do>
    <Do>Brands with literary or editorial positioning (publishers, magazines, writing platforms)</Do>
    <Dont>Data-dense dashboards (serif at small sizes fails) or rapid utility apps</Dont>
    <Dont>Youth-oriented consumer apps — Editorial reads as grown-up and quiet</Dont>
  </div>),

  color: () => (<div>
    <P>Editorial uses a warm cream paper stock, deep ink instead of pure black, and a single saturated burgundy that appears only in masthead moments. The palette is restrained on purpose — newsprint looks expensive precisely because it is quiet.</P>
    <H3>Paper &amp; Ink</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#F8F4EC" n="Paper (Page)" v="#F8F4EC" />
      <Sw c="#F1ECDF" n="Paper Subtle" v="#F1ECDF" />
      <Sw c="#FFFFFF" n="Stock (Elevated)" v="#FFFFFF" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#1A1614" n="Ink Primary" v="#1A1614" />
      <Sw c="#5C4F44" n="Ink Secondary" v="#5C4F44" />
      <Sw c="#8B7D6F" n="Ink Tertiary" v="#8B7D6F" />
    </div>
    <H3>Masthead Burgundy</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#8B1E2D" n="Masthead" v="#8B1E2D" />
      <Sw c="#A32B3C" n="Masthead Light" v="#A32B3C" />
      <Sw c="#6B1623" n="Masthead Deep" v="#6B1623" />
    </div>
    <Do>Use burgundy only for: drop caps, masthead text, reply left-rules, unread counts, major section rules</Do>
    <Dont>Use burgundy for body text, navigation labels, buttons, backgrounds, or structural dividers</Dont>

    <H3>Structural Colors</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#D8CEB9" n="Rule (light)" v="#D8CEB9" />
      <Sw c="#E8DFCA" n="Rule (hairline)" v="#E8DFCA" />
      <Sw c="#1A1614" n="Rule (strong)" v="#1A1614" />
    </div>
    <H3>Contrast Ratios</H3>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Ink primary on Paper","13.4:1","AAA"],["Ink secondary on Paper","6.8:1","AA"],["Ink tertiary on Paper","4.2:1","AA"],["Burgundy on Paper","5.7:1","AA"],["Burgundy on Paper Subtle","5.4:1","AA"],["Ink primary on Stock","14.8:1","AAA"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 55px", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: r[2].includes("AAA") ? "#34D399" : "#FBBF24" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  typography: () => (<div>
    <P>Editorial uses a strict two-family system. Fraunces carries content; Inter carries chrome. The boundary between them is the single most important typographic rule in the system and it is never blurred.</P>
    <H3>Font Families</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
      <div style={{ padding: 14, borderRadius: 4, border: `1px solid ${a}25`, background: `${a}04` }}>
        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, color: a, marginBottom: 4, fontWeight: 700, letterSpacing: "-0.01em" }}>Fraunces</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: a, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Content — the byline</div>
        <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Every message, heading, drop cap, and pull-quote. Reply text when rendered by the AI ("The Dispatch"). Input placeholders. Fallbacks: Fraunces → Georgia → serif.</div>
      </div>
      <div style={{ padding: 14, borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, color: "#EEE", marginBottom: 4, fontWeight: 600, letterSpacing: "-0.02em" }}>Inter</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Chrome — the small caps</div>
        <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Datelines, timestamps, sender tags, navigation labels, status indicators, button text. Always with 0.14–0.20em letter-spacing and uppercase when used at small sizes. Fallback: system-ui.</div>
      </div>
    </div>
    <Do>Use Inter exclusively in uppercase with tracking ≥0.14em when under 11px</Do>
    <Do>Use Fraunces italic for user-reply messages — italic is a voice, not decoration</Do>
    <Dont>Set body text in Inter — Fraunces carries all content, always</Dont>
    <Dont>Set metadata in Fraunces — metadata is Inter-only chrome</Dont>

    <H3>Type Scale</H3>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["display","24px","700","1.0","-0.02em","Fraunces","Masthead title"],
        ["heading","18px","700","1.1","-0.02em","Fraunces","Section heads"],
        ["body-lg","15px","400","1.55","-0.005em","Fraunces","AI messages"],
        ["body","13px","400","1.55","0","Fraunces","Reply bodies (italic)"],
        ["dek","12px","400","1.45","0","Fraunces italic","Subtitles, deks"],
        ["metadata","9px","700","1.3","0.18em","Inter (UPPER)","Datelines, tags"],
        ["micro","8.5px","600","1.3","0.16em","Inter (UPPER)","Timestamps"],
        ["dropcap","54px","700","0.85","-0.04em","Fraunces","Opening letter"],
      ].map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "75px 48px 42px 38px 50px 90px 1fr", padding: "5px 10px", borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.025)" : "none", background: t[5].includes("Fraunces") ? `${a}06` : "transparent" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>
          {t.slice(1, 5).map((v, vi) => <span key={vi} style={{ fontSize: 10, color: "#999" }}>{v}</span>)}
          <span style={{ fontSize: 9, color: t[5].includes("Fraunces") ? a : "#34D399", fontWeight: 600 }}>{t[5]}</span>
          <span style={{ fontSize: 10, color: "#666" }}>{t[6]}</span>
        </div>))}
    </div>

    <H3>Dual-Family Boundary</H3>
    <P>The boundary between Fraunces and Inter is strict. If unsure which to use, ask: "Is this something a reader reads, or a navigator navigates?" Readers read Fraunces. Navigators navigate with Inter.</P>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["AI / system messages", "Fraunces", "Content"],
        ["User reply messages", "Fraunces italic", "Content"],
        ["Chat / section titles", "Fraunces", "Content"],
        ["Drop caps", "Fraunces 700", "Content"],
        ["Input placeholders", "Fraunces italic", "Content"],
        ["Datelines (TOKYO · 14:23)", "Inter", "Chrome"],
        ["Sender tags (The Dispatch)", "Inter", "Chrome"],
        ["Timestamps", "Inter", "Chrome"],
        ["Section labels (RECENT)", "Inter", "Chrome"],
        ["Button labels (File Reply →)", "Inter", "Chrome"],
        ["Navigation items", "Inter", "Chrome"],
      ].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px", padding: "5px 10px", borderBottom: i < 10 ? "1px solid rgba(255,255,255,0.025)" : "none", background: r[2] === "Content" ? `${a}06` : "transparent" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <span style={{ fontSize: 10.5, color: r[2] === "Content" ? a : "#34D399", fontFamily: r[1].includes("Fraunces") ? "'Fraunces', serif" : "'Inter', sans-serif", fontWeight: r[1].includes("700") ? 700 : 400, fontStyle: r[1].includes("italic") ? "italic" : "normal" }}>{r[1]}</span>
          <span style={{ fontSize: 9.5, color: r[2] === "Content" ? a : "#34D399", fontWeight: 500 }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  elevation: () => (<div>
    <P>Editorial has no elevation system in the conventional sense. There are no shadows. Depth is communicated through paper-tier backgrounds (paper → paper subtle → stock) and structural rules rather than surface lift.</P>
    <H3>Rule Tokens</H3>
    <Tk n="rule.hairline" v="1px solid #E8DFCA" d="Between sidebar items, soft dividers" a={a} />
    <Tk n="rule.default" v="1px solid #D8CEB9" d="Standard boundaries, sidebar borders" a={a} />
    <Tk n="rule.strong" v="1px solid #1A1614" d="Section boundaries, masthead" a={a} />
    <Tk n="rule.masthead" v="3px double #8B1E2D" d="Signature — under brand only" a={a} />
    <Tk n="rule.reply" v="2px solid #8B1E2D" d="Left rule on user replies" a={a} />

    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
      {[{ r: 0, l: "Structural", t: "radius.none" }, { r: 2, l: "Inputs", t: "radius.sm" }, { r: 4, l: "Spec chrome", t: "radius.md" }].map(item => (
        <div key={item.t} style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: item.r, border: `2px solid ${a}40`, background: "rgba(255,255,255,0.02)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <code className="mn" style={{ fontSize: 9, color: "#999" }}>{item.r}px</code>
          </div>
          <div style={{ fontSize: 9.5, color: "#CCC", fontWeight: 600 }}>{item.l}</div>
          <code className="mn" style={{ fontSize: 8.5, color: "#666" }}>{item.t}</code>
        </div>))}
    </div>

    <H3>Paper Tiers (Depth Without Shadow)</H3>
    <P>Depth is expressed through three progressively lighter paper stocks. Use in order, never skip a tier.</P>
    <Tk n="paper.page" v="#F8F4EC" d="Base newsprint" a={a} />
    <Tk n="paper.subtle" v="#F1ECDF" d="Selected items, input bars" a={a} />
    <Tk n="paper.stock" v="#FFFFFF" d="Highlighted / quoted content" a={a} />

    <H3>Shadow Rules</H3>
    <Dont>Use box-shadow on any element — rules and paper tiers carry all hierarchy</Dont>
    <Dont>Use drop-shadow, text-shadow, or backdrop-filter</Dont>
    <Do>Use 1px horizontal rules liberally — they are the primary spatial structure</Do>
    <Do>Reserve the 3px double rule for the masthead only — it loses meaning if reused</Do>
  </div>),

  components: () => (<div>
    <P>Each component specifies anatomy, behavioral contract, exact token values, and do/don't rules. Click to expand.</P>

    <CBox title="DispatchMessage (AI)" parts={["dateline", "rule", "body", "dropcap?"]} accent={a}
      contract="Render AI messages as article prose. Must show dateline metadata above in Inter smallcaps, followed by a 1px rule, then Fraunces body copy. First AI message in a session receives a drop cap on its opening letter."
      specs={[["dateline.font", "'Inter', 8.5px, 700, 0.18em"], ["dateline.color", "#8B7D6F"], ["dateline.format", "'The Dispatch · 14:23'"], ["rule", "1px solid #D8CEB9"], ["body.font", "'Fraunces', 15px, 400"], ["body.line-height", "1.55"], ["body.color", "#1A1614"], ["dropcap.font-size", "54px"], ["dropcap.color", "#8B1E2D"], ["dropcap.float", "left"], ["dropcap.margin", "6px 8px -4px 0"], ["dropcap.trigger", "First AI message only"]]}
      dos={["Always use the horizontal rule separator between dateline and body — newspaper convention", "Apply drop cap to the opening character of the first AI message only, not every one"]}
      donts={["Wrap in a bubble, card, or bordered container — messages are prose, not chat items", "Use Inter for the body copy — body is Fraunces always"]} />

    <CBox title="ReplyMessage (User)" parts={["dateline", "left-rule", "body"]} accent={a}
      contract="Render user replies as italicized marginalia with a burgundy left rule. Aligned right within a constrained max-width. No horizontal rule above."
      specs={[["dateline.color", "#8B1E2D", "Burgundy for user tag"], ["dateline.format", "'Reply · <name>  14:24'"], ["body.font", "'Inter', 13px, italic"], ["body.color", "#1A1614"], ["body.padding-left", "10px"], ["body.border-left", "2px solid #8B1E2D"], ["max-width", "68%"], ["align-self", "flex-end"]]}
      dos={["Use Inter italic for user text — the italic carries the voice", "Keep the burgundy left rule thin (2px) — it's a reply mark, not a block"]}
      donts={["Use Fraunces italic for user replies — Inter italic is the chosen voice", "Add a right-side rule or a border on top — only the left rule is used"]} />

    <CBox title="SidebarItem" parts={["time", "unread", "title", "preview", "hairline-top"]} accent={a}
      contract="Render each recent dispatch as a small article preview. Title in Fraunces, time in Inter smallcaps, preview in Inter italic. Hairline rule above each item; top item uses strong rule."
      specs={[["padding", "10px 16px"], ["rule.top.first", "1px solid #1A1614"], ["rule.top.default", "1px solid #E8DFCA"], ["time.font", "'Inter', 8.5px, 600, 0.16em UPPER"], ["time.color", "#8B7D6F"], ["unread.font", "'Fraunces', 11px, 700"], ["unread.color", "#8B1E2D"], ["unread.format", "'2 new'", "Never '[2]' or digit-only"], ["title.font", "'Fraunces', 15px, 600"], ["selected.title.weight", "700"], ["selected.background", "#F1ECDF"], ["preview.font", "'Inter', 11px, italic"], ["preview.color", "#5C4F44"]]}
      dos={["Render unread count as 'N new' (e.g., '2 new') — magazine convention", "Use a strong (black) rule above the first item, hairline between the rest"]}
      donts={["Use a circular badge for unread count — Editorial uses text form", "Use a left accent bar for selection — background fill is the selection mechanism"]} />

    <CBox title="Masthead (Chat Header)" parts={["kicker", "title", "filed-meta", "dek"]} accent={a}
      contract="Render the chat header as a masthead. Burgundy kicker in Inter smallcaps, large Fraunces title, filed-at metadata, and optional italic dek (summary). Strong bottom rule."
      specs={[["padding", "18px 24px 10px"], ["border-bottom", "1px solid #1A1614"], ["kicker.font", "'Inter', 9px, 700, 0.20em UPPER"], ["kicker.color", "#8B1E2D"], ["kicker.format", "'Dispatch · Tokyo Desk'"], ["title.font", "'Fraunces', 24px, 700"], ["title.color", "#1A1614"], ["filed.font", "'Inter', 9px, 600, 0.14em UPPER"], ["filed.color", "#8B7D6F"], ["filed.format", "'Filed 14:23 · N exchanges'"], ["dek.font", "'Fraunces italic', 12px"], ["dek.color", "#5C4F44"]]}
      dos={["Keep the kicker in burgundy — it identifies the 'desk' or 'section'", "Use a dek (italic summary) only when you have real editorial framing to offer"]}
      donts={["Use an avatar or icon in the masthead — Editorial uses typography only", "Use Fraunces for the kicker — kicker is Inter chrome"]} />

    <CBox title="SectionGrid (Suggestions)" parts={["kicker", "cells", "roman-numerals"]} accent={a}
      contract="Render suggestion options as a 2×2 grid of 'sections' numbered with Roman numerals (I, II, III, IV). Inter smallcap intro; Fraunces labels. Single-pixel paper-tone grid rules."
      specs={[["intro.format", "'Choose a Section →'"], ["grid.columns", "2"], ["grid.rule", "1px solid #D8CEB9"], ["cell.padding", "10px 12px"], ["numeral.font", "'Fraunces italic', 10px"], ["numeral.color", "#8B1E2D"], ["label.font", "'Fraunces', 14px, 600"], ["label.color", "#1A1614"]]}
      dos={["Use Roman numerals (I, II, III, IV) — matches magazine section convention", "Keep the grid to 2×2 — more than four options breaks the form"]}
      donts={["Use Arabic digits or bullets — Roman numerals are the Editorial signature", "Add emoji prefixes — chrome stays literary, no pictograms"]} />

    <CBox title="TextInput" parts={["placeholder", "rule-above", "action"]} accent={a}
      contract="Single-line input with italic Fraunces placeholder. No bordered container — only a 1px black rule above separating input from messages. Action rendered as an Inter smallcap link."
      specs={[["container.border-top", "1px solid #1A1614"], ["container.background", "#F1ECDF"], ["container.padding", "14px 24px"], ["input.font", "'Fraunces italic', 15px"], ["input.color", "#1A1614"], ["placeholder.text", "'Write your reply…'"], ["action.font", "'Inter', 10px, 700, 0.18em UPPER"], ["action.label", "'File Reply →'"], ["action.color", "#8B1E2D"]]}
      dos={["Use 'File Reply →' as the send label — editorial verb, not 'Send'", "Use italic Fraunces for placeholders — matches the content register"]}
      donts={["Use a bordered box around the input — the top rule is the only boundary", "Use a send button rectangle — the action is a text link"]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Editorial layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width", "280px fixed"], ["Main area", "Fluid, fills remaining"], ["Sidebar order", "Brand → 3px double rule → Search → Section label → Items → Byline"], ["Vertical divider", "1px solid #D8CEB9"], ["Background (both)", "#F8F4EC"]] },
      { n: "Message Flow", rows: [["Direction", "Vertical stack, chronological"], ["Alignment", "AI → left (86% max), Reply → right (68% max)"], ["Gap", "20px between messages — generous prose breathing room"], ["Entrance", "fadeSlideUp, 450ms ease-out, 100ms stagger"], ["Metadata", "Above body, Inter smallcaps, 6px gap to body rule"]] },
      { n: "Active Selection", rows: [["Model", "Single selection only"], ["Trigger", "Click or Enter/Space"], ["Visual", "Background: #F1ECDF; title weight shifts 600 → 700"], ["Transition", "150ms ease"], ["Focus outline", "2px solid #8B1E2D offset 2px"]] },
      { n: "Search", rows: [["Position", "Below double rule, above section list"], ["Container", "No box — only 1px bottom border"], ["Font", "Fraunces italic, 12px"], ["Placeholder", "'Search the archives…' — italic"]] },
    ].map((p, pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4>
      <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        {p.rows.map((r, ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
        </div>))}
      </div>
    </div>))}
  </div>),

  extensions: () => (<div>
    <H3>1. Drop Cap System</H3>
    <P>Editorial's most distinct typographic moment. The first AI message in a session receives a large Fraunces drop cap rendered in burgundy. Reserved exclusively for opening exchanges — never subsequent messages.</P>
    <Tk n="font" v="'Fraunces', 700 weight" a={a} />
    <Tk n="size" v="54px" d="Approximately 3.6× body size" a={a} />
    <Tk n="color" v="#8B1E2D" d="Masthead burgundy only" a={a} />
    <Tk n="line-height" v="0.85" d="Tightened to sit on baseline" a={a} />
    <Tk n="letter-spacing" v="-0.04em" d="Negative tracking for display" a={a} />
    <Tk n="float" v="left" a={a} />
    <Tk n="margin" v="6px 8px -4px 0" d="Top right bottom left" a={a} />
    <Tk n="trigger" v="First AI message in session" d="Never second or later" a={a} />
    <H4>Placement Rules</H4>
    <Do>Apply to the first AI message only — drop caps open a piece, not paragraphs</Do>
    <Do>Skip the drop cap if the first message starts with a quote or number</Do>
    <Dont>Use drop caps on user-reply messages — they are editorial, not correspondent</Dont>
    <Dont>Use more than one drop cap per visible viewport</Dont>

    <H3>2. Dual-Family Boundary</H3>
    <P>The strict separation of Fraunces (content) and Inter (chrome) is the backbone of the system. Every piece of type belongs clearly to one or the other; never both within a line.</P>
    <Tk n="content family" v="Fraunces" d="Messages, titles, replies, placeholders" a={a} />
    <Tk n="chrome family" v="Inter" d="Metadata, datelines, nav, buttons" a={a} />
    <Tk n="chrome case" v="UPPERCASE" d="Always, under 11px" a={a} />
    <Tk n="chrome tracking" v="0.14em to 0.20em" d="Always, under 11px" a={a} />
    <Do>Set all Inter under 11px in UPPERCASE with ≥0.14em tracking — this is the newsprint rhythm</Do>
    <Dont>Run Fraunces and Inter on the same line — the boundary is spatial as well as semantic</Dont>

    <H3>3. Dateline Metadata Convention</H3>
    <P>Every message carries a dateline — not a timestamp. Datelines combine the source/sender, an optional location-equivalent (the "desk"), and the time of filing. Set in Inter smallcaps.</P>
    <Tk n="format.ai" v="'The Dispatch  14:23'" d="Sender · time" a={a} />
    <Tk n="format.user" v="'Reply · <name>  14:24'" d="Role · name · time" a={a} />
    <Tk n="format.section" v="'DISPATCH · TOKYO DESK'" d="Kicker · desk" a={a} />
    <Tk n="font" v="'Inter', 8.5–9px, 700, 0.16–0.20em" a={a} />
    <Tk n="color.ai" v="#8B7D6F" a={a} />
    <Tk n="color.user" v="#8B1E2D" d="Burgundy for user/reply marks" a={a} />
    <Do>Use desk names (Tokyo Desk, Recipes Desk, Code Desk) for session kickers</Do>
    <Dont>Use "Today", "Yesterday", or relative times in datelines — exact filing time only</Dont>

    <H3>4. Rule System</H3>
    <P>Three rules carry all structural hierarchy. Strong 1px black rules separate major sections. Hairline rules (#E8DFCA) divide list items. The 3px double rule in burgundy appears only once per view — under the sidebar brand.</P>
    <Tk n="masthead.rule" v="3px double #8B1E2D" d="Appears once per view only" a={a} />
    <Tk n="section.rule" v="1px solid #1A1614" d="Major separators" a={a} />
    <Tk n="list.rule" v="1px solid #D8CEB9" d="Between list items" a={a} />
    <Tk n="hairline.rule" v="1px solid #E8DFCA" d="Soft dividers" a={a} />
    <Do>Use the double rule only under the masthead — it is the system's signature moment</Do>
    <Dont>Use double rules as decorative dividers elsewhere — diluted meaning</Dont>
  </div>),

  voice: () => (<div>
    <P>Editorial speaks like a staff writer — formal-but-warm, precise, confident without being clinical. Avoid conversational filler ("Hey", "Got it", "Sure thing"). Avoid exclamation points. The AI is "The Dispatch" or "The Desk" — not a chatbot, not an assistant.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Literary", "Considered", "Warm-formal", "Concise"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never chatty", "Never apologetic"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>
    <H3>Placeholder &amp; State Text</H3>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Reply input", "Write your reply…", "Fraunces italic"],
        ["Sidebar search", "Search the archives…", "Fraunces italic"],
        ["Empty list", "No dispatches filed yet.", "Fraunces"],
        ["Loading", "Filing…", "Inter UPPER"],
        ["Error", "Could not file reply. Retry.", "Fraunces"],
        ["Success", "Filed.", "Inter UPPER"],
      ].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <span style={{ fontSize: 11, color: p[2].includes("UPPER") ? "#8B7D6F" : a, fontFamily: p[2].includes("Fraunces") ? "'Fraunces', serif" : "'Inter', sans-serif", fontStyle: p[2].includes("italic") ? "italic" : "normal", textTransform: p[2].includes("UPPER") ? "uppercase" : "none", letterSpacing: p[2].includes("UPPER") ? "0.16em" : "0" }}>{p[1]}</span>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>))}
    </div>
    <H3>Vocabulary</H3>
    <Do>Use editorial verbs: 'file', 'draft', 'dispatch', 'byline', 'archive', 'revise'</Do>
    <Do>Speak in first person plural when possible — "We'd suggest…" reads as editorial voice</Do>
    <Dont>Use tech jargon ('ping', 'send', 'submit', 'thread') in user-facing copy</Dont>
    <Dont>Use emoji in messages or chrome — Editorial is post-emoji</Dont>

    <H3>Conventions</H3>
    <Do>Sentence case for headings; title case acceptable for section names (I. Temples)</Do>
    <Do>Em dashes for interruption; en dashes for ranges; Oxford commas throughout</Do>
    <Do>End sentences with periods. Ellipses only in placeholders and loading.</Do>
    <Dont>Exclamation points in any copy, anywhere</Dont>
    <Dont>Contractions in system chrome ("don't" → "do not" in error states)</Dont>

    <H3>Symbol Vocabulary</H3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {[["§", "Section marker"], ["¶", "Paragraph marker"], ["—", "Em dash (interruption)"], ["–", "En dash (range)"], ["…", "Continuation"], ["→", "Action arrow (File Reply →)"], ["I.", "Section numeral"], ["·", "Middle dot separator"], ["'", "Typographic apostrophe"]].map(([s, u]) => (
        <div key={s} style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 18, fontFamily: "'Fraunces', serif", color: a, fontWeight: 700 }}>{s}</span>
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
  const spec = editorialSpec(TM.color);
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box }
        .mn { font-family: 'JetBrains Mono', monospace }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 3px }
        .app-sh { display: flex; width: 100%; height: 100%; overflow: hidden }
        .sb { width: 240px; min-width: 240px; display: flex; flex-direction: column; overflow: hidden }
        .cl { flex: 1; overflow-y: auto }
        .ca { flex: 1; display: flex; flex-direction: column; overflow: hidden }
        .ma { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px }
        .si { border: none; outline: none; background: transparent; flex: 1; font-size: 11px; width: 100% }
        input::placeholder { opacity: 0.5 }
        .snd { cursor: pointer; transition: opacity 0.15s; flex-shrink: 0 }
        .snd:hover { opacity: 0.7 }
        .mi { animation: fadeSlideUp 0.45s ease-out both }
        .ci { animation: fadeSlideUp 0.35s ease-out both }
        .ci:hover { background: rgba(139,30,45,0.04) }
        .bc-ed:hover { background: #F1ECDF !important }
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
