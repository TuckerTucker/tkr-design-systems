import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════
   FULLY INTEGRATED DESIGN SYSTEM — PROPER INTEGRATION
   Hub · Architecture (full) · Specs (full) · Live Previews (full)
   ═══════════════════════════════════════════════════════════════ */

const TM = {
  sketch: { name: "Sketch", tag: "Linear + Hand-Drawn", color: "#B8A9C8" },
  prism: { name: "Prism", tag: "Liquid Glass + Bento", color: "#7DDFBE" },
  revolt: { name: "Revolt", tag: "Neobrutalist + Y2K", color: "#FF3366" },
};

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

const TokenTable = ({ data }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {data.map((g, gi) => (<div key={gi}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#CCC", marginBottom: 6 }}>{g.category}</div>
      <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ padding: "5px 10px", fontSize: 9, color: "#555", textTransform: "uppercase" }}>Token</div>
          {Object.values(TM).map(t => <div key={t.name} style={{ padding: "5px 10px", fontSize: 9, color: t.color, textTransform: "uppercase", borderLeft: "1px solid rgba(255,255,255,0.03)" }}>{t.name}</div>)}
        </div>
        {g.tokens.map((t, ti) => (
          <div key={ti} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: ti < g.tokens.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
            <div style={{ padding: "5px 10px", fontSize: 10, color: "#CCC", fontFamily: "'JetBrains Mono',monospace" }}>{t.name}</div>
            {["sketch", "prism", "revolt"].map(theme => (
              <div key={theme} style={{ padding: "5px 10px", fontSize: 10, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)", display: "flex", alignItems: "center", gap: 4 }}>
                {t[theme]?.startsWith("#") && t[theme].length <= 8 && <div style={{ width: 10, height: 10, borderRadius: 2, background: t[theme], border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />}
                <span style={{ fontSize: 10 }}>{t[theme]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>))}
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   LIVE CHAT DASHBOARDS (full, from original chat-dashboard-6-aesthetics)
   ═══════════════════════════════════════════════════════════════ */
function SketchChat({ sel, setSel }) {
  return (
    <div className="app-sh" style={{ background: "#FAFAF8", fontFamily: "'IBM Plex Sans',sans-serif", borderRadius: 14, border: "1px solid #E5E3DE" }}>
      <div className="sb" style={{ borderRight: "1px solid #E5E3DE" }}>
        <div style={{ padding: "16px 14px 10px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 15, fontWeight: 600, color: "#2C2C2C", letterSpacing: "-0.02em" }}>Sketch</span><span style={{ fontFamily: "'Caveat',cursive", fontSize: 14, color: "#B8A9C8", fontWeight: 700, transform: "rotate(-3deg)", display: "inline-block" }}>✦ AI</span></div><div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E3DE", display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 13, color: "#C0BCB6" }}>⌕</span><input placeholder="Search..." className="si" style={{ fontFamily: "'IBM Plex Sans',sans-serif", color: "#2C2C2C" }} /></div></div>
        <div style={{ padding: "0 14px 8px" }}><div style={{ fontFamily: "'Caveat',cursive", fontSize: 13, color: "#C4B8D4", fontWeight: 700, transform: "rotate(-1.5deg)" }}>↓ your chats</div></div>
        <div className="cl">{chatList.map((c, i) => (
          <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "10px 14px", cursor: "pointer", borderRadius: 10, margin: "0 6px 3px", background: sel===c.id?"#F0EDE8":"transparent", border: sel===c.id?"1px solid #E5E3DE":"1px solid transparent", animationDelay: `${i*60}ms` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "#F0EDE8", border: "1px solid #E5E3DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{c.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12.5, fontWeight: 600, color: "#2C2C2C" }}>{c.name}</span><span style={{ fontSize: 10, color: "#B0ADA8" }}>{c.time}</span></div><div style={{ fontSize: 11, color: "#8A8680", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{c.preview}</div></div>
              {c.unread > 0 && <div style={{ width: 18, height: 18, borderRadius: 6, background: "#B8A9C8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#FFF" }}>{c.unread}</div>}
            </div>
          </div>
        ))}</div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid #E5E3DE" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 28, height: 28, borderRadius: 7, background: "#F0EDE8", border: "1px solid #E5E3DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#8A8680" }}>Y</div><div style={{ fontSize: 11.5, fontWeight: 500, color: "#555" }}>Your account</div></div></div>
      </div>
      <div className="ca">
        <div style={{ borderBottom: "1px solid #E5E3DE", padding: "12px 20px" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 16 }}>🗼</span><div style={{ fontSize: 13.5, fontWeight: 600, color: "#2C2C2C" }}>Tokyo Trip</div><div style={{ marginLeft: "auto", fontFamily: "'Caveat',cursive", fontSize: 13, color: "#B8A9C8", fontWeight: 700 }}>✎ active</div></div></div>
        <div className="ma" style={{ padding: 16 }}>
          {msgs.map((m, i) => (<div key={m.id} className="mi" style={{ alignSelf: m.sender==="user"?"flex-end":"flex-start", maxWidth: "78%", animationDelay: `${i*80}ms` }}>{m.sender==="ai"&&i===1&&<div style={{ fontFamily: "'Caveat',cursive", fontSize: 13, color: "#B8A9C8", fontWeight: 700, marginBottom: 3, paddingLeft: 4, transform: "rotate(-1.5deg)" }}>↓ ooh fun one!</div>}<div style={{ padding: "11px 15px", borderRadius: 12, fontSize: 13, lineHeight: 1.55, ...(m.sender==="user"?{ background: "#2C2C2C", color: "#FAFAF8" }:{ background: "#F0EDE8", color: "#2C2C2C", border: "1px solid #E5E3DE" }) }}>{m.text}</div></div>))}
          <div className="mi" style={{ alignSelf: "flex-start", maxWidth: "85%", animationDelay: "400ms" }}><div style={{ fontFamily: "'Caveat',cursive", fontSize: 13, color: "#C4B8D4", fontWeight: 700, marginBottom: 6, transform: "rotate(-1deg)" }}>pick a vibe ~</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{["🏯 Temples","🍜 Ramen","🎌 Culture","🌸 Parks"].map(t=>(<div key={t} className="bc" style={{ padding: "10px", borderRadius: 8, background: "#F7F5F0", border: "1px solid #E5E3DE", fontSize: 11.5, color: "#555", textAlign: "center", cursor: "pointer" }}>{t}</div>))}</div></div>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "1px solid #E5E3DE" }}><div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 10, border: "1px solid #E5E3DE", background: "#FFF" }}><input placeholder="Type here..." className="si" style={{ fontFamily: "'IBM Plex Sans',sans-serif", color: "#2C2C2C" }} /><div className="snd" style={{ fontFamily: "'Caveat',cursive", fontSize: 17, color: "#B8A9C8", fontWeight: 700 }}>go →</div></div></div>
      </div>
    </div>
  );
}

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

function RevoltChat({ sel, setSel }) {
  const [hov, setHov] = useState(null);
  return (
    <div className="app-sh" style={{ background: "#FFFEF5", fontFamily: "'Space Mono',monospace", borderRadius: 0, border: "3px solid #111" }}>
      <div className="sb" style={{ borderRight: "3px solid #111" }}>
        <div style={{ padding: "12px 12px 10px", background: "#C8FF00", borderBottom: "3px solid #111" }}><div style={{ fontSize: 14, fontWeight: 700, color: "#111", textTransform: "uppercase", letterSpacing: "0.08em" }}>REVOLT.chat</div></div>
        <div style={{ padding: "10px 10px 6px" }}><div style={{ display: "flex", border: "2px solid #111" }}><input placeholder="FIND..." className="si" style={{ fontFamily: "'Space Mono',monospace", color: "#111", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.05em", padding: "8px 10px" }} /></div></div>
        <div className="cl">{chatList.map((c, i) => (
          <div key={c.id} onClick={() => setSel(c.id)} onMouseEnter={() => setHov(c.id)} onMouseLeave={() => setHov(null)} className="ci" style={{ padding: "10px 12px", cursor: "pointer", margin: "0 8px 4px", border: sel===c.id?"2px solid #111":"2px solid transparent", background: sel===c.id?"#C8FF00":"transparent", boxShadow: sel===c.id?"3px 3px 0 #111":"none", transform: hov===c.id?"rotate(-0.5deg)":"none", transition: "transform 0.12s", animationDelay: `${i*50}ms` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, border: "2px solid #111", background: sel===c.id?"#FF3366":"#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{c.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, fontWeight: 700, color: "#111", textTransform: "uppercase" }}>{c.name}</span><span style={{ fontSize: 9, fontWeight: 700, color: "#999" }}>{c.time}</span></div><div style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{c.preview}</div></div>
              {c.unread > 0 && <div style={{ padding: "2px 6px", border: "2px solid #111", background: "#FF3366", fontSize: 9, fontWeight: 700, color: "#FFF" }}>{c.unread}</div>}
            </div>
          </div>
        ))}</div>
        <div style={{ padding: "10px 12px", borderTop: "3px solid #111", background: "#FFF" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 26, height: 26, border: "2px solid #111", background: "#C8FF00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900 }}>U</div><div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#111" }}>USER_01</div></div></div>
      </div>
      <div className="ca">
        <div style={{ borderBottom: "3px solid #111", padding: "10px 16px", background: "#FF3366" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 16 }}>🗼</span><span style={{ fontSize: 12, fontWeight: 700, color: "#FFF", textTransform: "uppercase", letterSpacing: "0.06em" }}>TOKYO TRIP</span><div style={{ marginLeft: "auto", padding: "2px 8px", border: "2px solid #FFF", fontSize: 9, fontWeight: 700, color: "#FFF" }}>LIVE</div></div></div>
        <div className="ma" style={{ padding: 16 }}>
          {msgs.map((m, i) => (<div key={m.id} className="mi" style={{ alignSelf: m.sender==="user"?"flex-end":"flex-start", maxWidth: "80%", animationDelay: `${i*60}ms` }}>
            <div style={{ padding: "10px 14px", border: "2px solid #111", fontSize: 11.5, lineHeight: 1.5, ...(m.sender==="user"?{ background: "#FF3366", color: "#FFF", boxShadow: "4px 4px 0 #111" }:{ background: "#FFF", boxShadow: "4px 4px 0 #111", color: "#111" }) }}>{m.text}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: "#999", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.1em", textAlign: m.sender==="user"?"right":"left" }}>{m.sender==="user"?"YOU":"BOT"} // 00:{i+1}</div>
          </div>))}
        </div>
        <div style={{ padding: "10px 16px", borderTop: "3px solid #111" }}><div style={{ display: "flex", border: "2px solid #111" }}><input placeholder="SAY SOMETHING..." className="si" style={{ fontFamily: "'Space Mono',monospace", color: "#111", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.04em", padding: "10px 12px" }} /><div className="snd" style={{ width: 44, borderLeft: "2px solid #111", background: "#C8FF00", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900, color: "#111" }}>→</div></div></div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ theme, sel, setSel }) {
  const Chat = theme === "sketch" ? SketchChat : theme === "prism" ? PrismChat : RevoltChat;
  const notes = theme === "sketch"
    ? ["Caveat cursive annotations above AI messages at -1.5° rotation","1px solid borders define all boundaries — zero box-shadows","Purple (#B8A9C8) accent exclusively on annotation layer elements","Bento suggestion chips in 2-column grid with emoji prefix","Cursive send label ('go →') — key Sketch identity moment","IBM Plex Sans for all structural text, Caveat for editorial only","Selected sidebar item: bg fill + border (no shadow, no accent bar)"]
    : theme === "prism"
    ? ["Glass panels via backdrop-filter: blur(20px) + rgba opacity","User messages: higher glass opacity (0.18) vs AI (0.08)","Ambient light orbs (radial-gradient divs) behind glass layers","No timestamps or sender labels — atmospheric minimalism","Icon-only send button (↑) in glass container","Online indicators use solid teal (#7DDFBE) accent","Selected sidebar item: elevated glass tier (0.14 opacity)"]
    : ["Hard-offset shadows: 4px 4px 0 #111 — zero blur always","2px solid #111 borders on every component boundary","border-radius: 0 on all elements — rectangles only","Code-style timestamps: YOU // 00:1 below every message","Lime (#C8FF00) active state with hard shadow on selection","Pink (#FF3366) header bar + user message fills","Hover rotation: -0.5deg counterclockwise on sidebar items"];
  return (<div>
    <P>Live implementation of the {TM[theme].name} design system. Every token, component, and pattern from the spec applied to a working interface. Click sidebar items to see selection state behavior.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 440, borderRadius: theme === "revolt" ? 0 : 16, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <Chat sel={sel} setSel={setSel} />
      </div>
      <div style={{ width: 190, flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Design tokens in action</div>
        {notes.map((n, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 4, border: `1px solid ${TM[theme].color}15`, background: `${TM[theme].color}06`, marginBottom: 4, fontSize: 10, color: "#BBB", lineHeight: 1.4 }}>
            <span style={{ color: TM[theme].color, marginRight: 4 }}>→</span>{n}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   ARCHITECTURE (full, from original design-system-architecture)
   ═══════════════════════════════════════════════════════════════ */
const primitiveTokens = [
  { category: "Color — Background", tokens: [
    { name: "color.bg.page", sketch: "#FAFAF8", prism: "gradient(150deg, #4A5D6B → #4A6058)", revolt: "#FFFEF5" },
    { name: "color.bg.surface", sketch: "#F0EDE8", prism: "rgba(255,255,255,0.08)", revolt: "#FFFFFF" },
    { name: "color.bg.elevated", sketch: "#FFFFFF", prism: "rgba(255,255,255,0.14)", revolt: "#FFFFFF" },
  ]},
  { category: "Color — Text", tokens: [
    { name: "color.text.primary", sketch: "#2C2C2C", prism: "rgba(255,255,255,0.95)", revolt: "#111111" },
    { name: "color.text.secondary", sketch: "#8A8680", prism: "rgba(255,255,255,0.4)", revolt: "#666666" },
    { name: "color.text.on-accent", sketch: "#FAFAF8", prism: "#FFFFFF", revolt: "#FFFFFF" },
  ]},
  { category: "Color — Accent", tokens: [
    { name: "color.accent.primary", sketch: "#B8A9C8", prism: "#7DDFBE", revolt: "#FF3366" },
    { name: "color.accent.secondary", sketch: "#C4B8D4", prism: "rgba(125,223,190,0.25)", revolt: "#C8FF00" },
    { name: "color.accent.cta", sketch: "#B8A9C8", prism: "rgba(255,255,255,0.15)", revolt: "#C8FF00" },
  ]},
  { category: "Color — Structural", tokens: [
    { name: "color.border.default", sketch: "#E5E3DE", prism: "rgba(255,255,255,0.12)", revolt: "#111111" },
    { name: "color.border.strong", sketch: "#D5CFC8", prism: "rgba(255,255,255,0.18)", revolt: "#111111" },
  ]},
  { category: "Typography", tokens: [
    { name: "font.family.primary", sketch: "IBM Plex Sans", prism: "Outfit", revolt: "Space Mono" },
    { name: "font.family.display", sketch: "Caveat (cursive)", prism: "Outfit", revolt: "Space Mono" },
    { name: "font.weight.label", sketch: "600", prism: "500", revolt: "700" },
    { name: "font.transform.labels", sketch: "none", prism: "none", revolt: "uppercase" },
    { name: "font.tracking.labels", sketch: "-0.02em", prism: "-0.02em", revolt: "0.08em" },
  ]},
  { category: "Elevation", tokens: [
    { name: "elevation.strategy", sketch: "Border-only, no shadows", prism: "Backdrop blur + opacity", revolt: "Hard offset, 0 blur" },
    { name: "elevation.low", sketch: "none", prism: "blur(12px)", revolt: "2px 2px 0 #111" },
    { name: "elevation.medium", sketch: "none", prism: "blur(20px)", revolt: "4px 4px 0 #111" },
    { name: "border.radius.component", sketch: "10px", prism: "12px", revolt: "0" },
    { name: "border.radius.container", sketch: "16px", prism: "20px", revolt: "0" },
  ]},
  { category: "Motion", tokens: [
    { name: "motion.duration.standard", sketch: "300ms", prism: "350ms", revolt: "150ms" },
    { name: "motion.easing.default", sketch: "ease", prism: "ease-out", revolt: "linear" },
    { name: "motion.stagger.messages", sketch: "80ms", prism: "100ms", revolt: "60ms" },
    { name: "motion.philosophy", sketch: "Subtle, natural", prism: "Atmospheric, fluid", revolt: "Mechanical, abrupt" },
  ]},
];

const semanticTokens = [
  { category: "Interactive States", tokens: [
    { name: "state.hover", sketch: "opacity: 0.88", prism: "opacity: 0.88", revolt: "transform: rotate(-0.5deg)" },
    { name: "state.active/selected", sketch: "bg: surface + border", prism: "bg: glass elevated", revolt: "bg: lime + border + shadow" },
    { name: "state.focus", sketch: "2px solid #B8A9C8", prism: "2px solid rgba(…,0.5)", revolt: "2px solid #111" },
  ]},
  { category: "Surface Roles", tokens: [
    { name: "surface.card", sketch: "Warm gray + border", prism: "Glass panel (blur+opacity)", revolt: "White + hard shadow" },
    { name: "surface.message.user", sketch: "Near-black fill", prism: "Glass strong (0.18)", revolt: "Pink fill (#FF3366)" },
    { name: "surface.message.ai", sketch: "Warm gray + border", prism: "Glass base (0.08)", revolt: "White + hard shadow" },
    { name: "surface.input", sketch: "White + 1px border", prism: "Glass panel", revolt: "White + 2px border" },
  ]},
  { category: "Content Hierarchy", tokens: [
    { name: "hierarchy.primary", sketch: "Size + font-weight", prism: "Size + font-weight", revolt: "Size + uppercase + weight" },
    { name: "hierarchy.metadata", sketch: "Cursive annotation", prism: "Low opacity small text", revolt: "Code-style comment (YOU // 00:1)" },
    { name: "hierarchy.emphasis", sketch: "Accent color text", prism: "Brighter glass opacity", revolt: "Accent bg color fill" },
  ]},
];

const archPatterns = [
  { name: "Sidebar + Main Layout", aspects: [
    { aspect: "Sidebar width", shared: "260px fixed", revolt: "—", prism: "—", sketch: "—" },
    { aspect: "Main area", shared: "Fluid, fills remaining", revolt: "—", prism: "—", sketch: "—" },
    { aspect: "Sidebar sections", shared: "Brand → Search → List → User", revolt: "—", prism: "—", sketch: "—" },
    { aspect: "Vertical divider", shared: null, revolt: "3px solid #111", prism: "1px rgba(…,0.1)", sketch: "1px solid #E5E3DE" },
    { aspect: "Sidebar background", shared: null, revolt: "Flat, same as page", prism: "Inherits gradient", sketch: "Flat, same as page" },
  ]},
  { name: "Chat Message Flow", aspects: [
    { aspect: "Direction", shared: "Vertical stack, chronological", revolt: "—", prism: "—", sketch: "—" },
    { aspect: "Alignment", shared: "User → right, AI → left", revolt: "—", prism: "—", sketch: "—" },
    { aspect: "Max width", shared: null, revolt: "80%", prism: "78%", sketch: "78%" },
    { aspect: "Entrance animation", shared: "Staggered per message", revolt: "300ms, 60ms delay", prism: "500ms, 100ms delay", sketch: "400ms, 80ms delay" },
    { aspect: "Metadata display", shared: null, revolt: "Below: code-style", prism: "Hidden", sketch: "Above: cursive annotation" },
    { aspect: "Tail/radius", shared: null, revolt: "0 (square)", prism: "16px / 4px tail", sketch: "12px uniform" },
  ]},
  { name: "Active Selection", aspects: [
    { aspect: "Count", shared: "Single selection only", revolt: "—", prism: "—", sketch: "—" },
    { aspect: "Trigger", shared: "Click or keyboard", revolt: "—", prism: "—", sketch: "—" },
    { aspect: "Indicator method", shared: null, revolt: "bg fill + border + shadow", prism: "Stronger glass opacity", sketch: "bg fill + border" },
    { aspect: "Transition", shared: null, revolt: "Instant (linear)", prism: "0.25s ease-out", sketch: "0.2s ease" },
  ]},
];

const archComponents = [
  { name: "ChatBubble", parts: "container · text · metadata · tail", contract: "Distinguish user from AI. Support text wrapping. Max-width constraint.",
    sketch: "12px radius, border-only AI bubbles, cursive annotations above", prism: "16px radius, glass panels, no metadata", revolt: "0 radius, hard shadows, code-style timestamps below" },
  { name: "SidebarItem", parts: "container · avatar · title · preview · time · badge", contract: "Single selection. Truncate preview. Keyboard-focusable.",
    sketch: "bg fill + border for selection", prism: "Glass opacity shift for selection", revolt: "Lime bg + shadow + avatar color swap" },
  { name: "TextInput", parts: "container · input · placeholder · action", contract: "Visible boundary. Focus state. Discoverable action.",
    sketch: "1px border, cursive send label ('go →')", prism: "Glass panel, icon-only send (↑)", revolt: "2px border, integrated lime button (→)" },
  { name: "Header", parts: "container · icon · title · status", contract: "Identify context. Separate from content. Show status.",
    sketch: "Transparent bg, cursive status ('✎ active')", prism: "Glass panel, text status ('active session')", revolt: "Pink fill, status pill ('LIVE')" },
];

const archExtensions = {
  sketch: ["Annotation system — cursive overlays at -1° to -3°, Caveat 700, #B8A9C8","Dual-font boundary — Plex = structural, Caveat = editorial (strict, inviolable)","Bento suggestion chips — 2-col emoji grid with cursive intro","No-shadow rule — borders only, zero box-shadows anywhere"],
  prism: ["Ambient light orbs — radial gradient divs, 120-200px, 0.15-0.25 opacity","Glass composition system — blur × opacity × border, independently composable","Performance budget — max 6 simultaneous backdrop-filter elements","Multi-stop gradient background — 4+ stops required for glass meaning"],
  revolt: ["Code-style timestamps — SENDER // 00:INDEX format on every message","Hover rotation — -0.5deg counterclockwise, max ±1deg, linear easing","Zero-blur shadows — hard offset only, always #111, always bottom-right","Status pills — bordered rectangular labels (LIVE, TYPING, OFFLINE)"],
};

function ArchView({ sec, setSec, nav }) {
  const archSecs = [
    { id: "layers", l: "Layer Architecture" },
    { id: "primitives", l: "Primitive Tokens" },
    { id: "semantic", l: "Semantic Tokens" },
    { id: "components", l: "Component Contracts" },
    { id: "patterns", l: "Patterns" },
    { id: "extensions", l: "Extensions" },
    { id: "compare", l: "⬡ Live Compare" },
  ];
  const content = {
    layers: () => (<div>
      <P>The system is organized in five layers. Lower layers are more concrete and theme-specific. Higher layers are more abstract and shared. The key principle: names flow down, values flow up.</P>
      {[
        { n: "Layer 0 — Primitives", s: "VARIES per theme", c: "#FF6B6B", d: "Raw values. Hex colors, px sizes, font names, ms durations. Each theme defines its own complete set.", items: ["color.bg.page","font.family.primary","border.radius.component","motion.duration.standard"] },
        { n: "Layer 1 — Semantic Tokens", s: "SHARED names, VARIES values", c: "#FBBF24", d: "Role-based aliases that map to primitives. Token names are universal; each theme maps them differently.", items: ["surface.card","state.active","hierarchy.primary","surface.message.user"] },
        { n: "Layer 2 — Component Contracts", s: "SHARED anatomy, VARIES rendering", c: "#34D399", d: "Each component has a fixed anatomy (parts list) and behavior contract. Themes control how each part renders.", items: ["ChatBubble.container","SidebarItem.badge","TextInput.action","Header.status"] },
        { n: "Layer 3 — Composition Patterns", s: "SHARED structure, VARIES decoration", c: "#60A5FA", d: "Layout rules, flow logic, and interaction patterns. Spatial structure is invariant; visual treatment adapts.", items: ["Sidebar+Main","ChatFlow","ActiveSelection","SearchPattern"] },
        { n: "Layer 4 — Theme Extensions", s: "UNIQUE per theme", c: "#A78BFA", d: "Features that exist in only one theme. Not shared, not abstracted. Documented as opt-in capabilities.", items: ["Revolt: hover rotation","Prism: ambient orbs","Sketch: annotations"] },
      ].map((l, i) => (<div key={i} style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: `rgba(255,255,255,${0.01+i*0.005})`, marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: l.c }} /><span style={{ fontSize: 12, fontWeight: 700, color: "#EEE" }}>{l.n}</span><span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 600, color: l.c, padding: "1px 6px", borderRadius: 3, border: `1px solid ${l.c}30`, background: `${l.c}10` }}>{l.s}</span></div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>{l.d}</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{l.items.map(item => <code key={item} className="mn" style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "rgba(255,255,255,0.03)", color: "#777" }}>{item}</code>)}</div>
      </div>))}
      <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 8, border: "1px dashed rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#CCC", marginBottom: 4 }}>Adding a new theme</div>
        <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>Define all Layer 0 primitives → Map to Layer 1 semantic tokens → Write Layer 2 component rendering specs → Verify Layer 3 pattern composition → Document Layer 4 unique extensions. The shared structure guarantees consistency. The theme layer guarantees personality.</div>
      </div>
    </div>),
    primitives: () => <TokenTable data={primitiveTokens} />,
    semantic: () => <TokenTable data={semanticTokens} />,
    components: () => (<div>
      <P>Shared anatomy and behavioral contracts. Each theme renders differently while maintaining the same structural parts.</P>
      {archComponents.map((comp, ci) => (<div key={ci} style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span className="mn" style={{ fontSize: 12, fontWeight: 700, color: "#EEE" }}>{comp.name}</span><span style={{ fontSize: 10, color: "#555" }}>{comp.parts}</span></div>
        <div style={{ fontSize: 11, color: "#999", marginBottom: 8, padding: "6px 10px", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>{comp.contract}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {["sketch","prism","revolt"].map(theme => (<div key={theme} style={{ padding: "8px 10px", borderRadius: 6, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: TM[theme].color, textTransform: "uppercase", marginBottom: 4 }}>{theme}</div>
            <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>{comp[theme]}</div>
          </div>))}
        </div>
      </div>))}
    </div>),
    patterns: () => (<div>
      <P>Green rows are shared invariants. Rows with theme values show where each aesthetic diverges.</P>
      {archPatterns.map((p, pi) => (<div key={pi} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#EEE", marginBottom: 6 }}>{p.name}</div>
        <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr 1fr 1fr", background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ padding: "5px 10px", fontSize: 9, color: "#555", textTransform: "uppercase" }}>Aspect</div>
            <div style={{ padding: "5px 10px", fontSize: 9, color: "#34D399", textTransform: "uppercase", borderLeft: "1px solid rgba(255,255,255,0.03)" }}>Shared</div>
            {Object.values(TM).map(t => <div key={t.name} style={{ padding: "5px 10px", fontSize: 9, color: t.color, textTransform: "uppercase", borderLeft: "1px solid rgba(255,255,255,0.03)" }}>{t.name}</div>)}
          </div>
          {p.aspects.map((a, ai) => {
            const isShared = a.shared !== null;
            return (<div key={ai} style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr 1fr 1fr", borderBottom: ai < p.aspects.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none", background: isShared ? "rgba(52,211,153,0.025)" : "transparent" }}>
              <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{a.aspect}</div>
              {isShared
                ? <div style={{ padding: "5px 10px", fontSize: 10, color: "#34D399", borderLeft: "1px solid rgba(255,255,255,0.02)", gridColumn: "2/6" }}>{a.shared}</div>
                : <><div style={{ padding: "5px 10px", fontSize: 10, color: "#333", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>—</div><div style={{ padding: "5px 10px", fontSize: 10, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{a.sketch}</div><div style={{ padding: "5px 10px", fontSize: 10, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{a.prism}</div><div style={{ padding: "5px 10px", fontSize: 10, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{a.revolt}</div></>
              }
            </div>);
          })}
        </div>
      </div>))}
    </div>),
    extensions: () => (<div>
      <P>Features unique to a single theme. Not shared, not abstracted. When adding a new theme, this is where its personality lives.</P>
      {Object.entries(TM).map(([key, t]) => (<div key={key} style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.name} <span style={{ fontWeight: 400, fontSize: 10, opacity: 0.6, textTransform: "none" }}>— {t.tag}</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {archExtensions[key].map((f, fi) => (<div key={fi} style={{ padding: "8px 12px", borderRadius: 6, border: `1px solid ${t.color}15`, background: `${t.color}06`, fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{f}</div>))}
        </div>
        <div style={{ marginTop: 4 }}><span onClick={() => nav(key, "extensions")} style={{ fontSize: 10, color: t.color, cursor: "pointer", textDecoration: "underline", textDecorationColor: `${t.color}40`, textUnderlineOffset: 2 }}>→ Full {t.name} extensions spec</span></div>
      </div>))}
    </div>),
    compare: () => (<div>
      <P>All three live previews side by side. Click any to enter that theme's full spec + preview.</P>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {Object.entries(TM).map(([key, t]) => (
          <div key={key} onClick={() => nav(key, "preview")} style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t.name} <span style={{ color: "#555", textTransform: "none" }}>— {t.tag}</span></div>
            <div style={{ height: 220, borderRadius: key === "revolt" ? 0 : 10, overflow: "hidden", border: `1px solid ${t.color}30` }}>
              {key === "sketch" ? <SketchChat sel={1} setSel={() => {}} /> : key === "prism" ? <PrismChat sel={1} setSel={() => {}} /> : <RevoltChat sel={1} setSel={() => {}} />}
            </div>
          </div>
        ))}
      </div>
    </div>),
  };
  return (<div style={{ display: "flex", minHeight: "100%" }}>
    <div style={{ width: 170, minWidth: 170, borderRight: "1px solid rgba(255,255,255,0.05)", padding: "10px 0" }}>
      {archSecs.map(s => (<div key={s.id} onClick={() => setSec(s.id)} style={{ padding: "7px 14px", cursor: "pointer", background: sec === s.id ? "rgba(255,255,255,0.03)" : "transparent", borderLeft: sec === s.id ? "2px solid #FFF" : "2px solid transparent" }}><span style={{ fontSize: 11, fontWeight: sec === s.id ? 600 : 400, color: sec === s.id ? "#EEE" : "#777" }}>{s.l}</span></div>))}
    </div>
    <div key={sec} style={{ flex: 1, padding: "18px 28px", overflowY: "auto", animation: "fadeIn 0.2s ease" }}>
      <div style={{ maxWidth: 740 }}><h2 style={{ fontSize: 16, fontWeight: 700, color: "#FFF", margin: "0 0 14px" }}>{archSecs.find(s => s.id === sec)?.l}</h2>{content[sec]?.()}</div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   SKETCH SPEC (full content from standalone spec)
   ═══════════════════════════════════════════════════════════════ */
function sketchSpec(a) { return {
  overview: () => (<div>
    <P>Sketch is an aesthetic that balances engineering-grade precision with human warmth. Its foundation is a clean, linear design system built on IBM Plex Sans — tight spacing, 1px borders, neutral surfaces. What makes it distinct is a second layer: hand-drawn cursive annotations in Caveat that add editorial personality.</P>
    <P>The system's identity lives in the tension between these two modes. The structural layer is precise, predictable, and grid-aligned. The annotation layer is rotated, informal, and warm. Neither should invade the other's territory.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[["Precision first","Every structural element aligns to a 4px grid. Borders are exactly 1px. Radius is consistent at 8–12px. No visual ambiguity in the foundation layer."],["Warmth second","The annotation layer adds humanity — but sparingly. It appears in metadata, status, and editorial moments. Never in navigation, form inputs, or body text."],["No shadows, ever","Sketch defines all boundaries with 1px borders. Zero box-shadows anywhere in the system. Depth is communicated through background color separation, not elevation."],["One accent, one role","Muted purple (#B8A9C8) is the only accent color. It is reserved exclusively for the annotation/editorial layer. Structural elements use the neutral palette only."]].map(([t,d],i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div><div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div></div>))}
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Sw c="#FAFAF8" n="Page" v="#FAFAF8" b="1px solid rgba(255,255,255,0.15)" /><Sw c="#F0EDE8" n="Surface" v="#F0EDE8" b="1px solid rgba(255,255,255,0.12)" /><Sw c="#F7F5F0" n="Surface Subtle" v="#F7F5F0" b="1px solid rgba(255,255,255,0.12)" /><Sw c="#FFFFFF" n="Elevated" v="#FFFFFF" b="1px solid rgba(255,255,255,0.15)" /><Sw c="#2C2C2C" n="Inverse" v="#2C2C2C" /><Sw c="#E5E3DE" n="Muted" v="#E5E3DE" b="1px solid rgba(255,255,255,0.12)" /></div>
    <H3>Text</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Sw c="#2C2C2C" n="Primary" v="#2C2C2C" /><Sw c="#555555" n="Secondary" v="#555555" /><Sw c="#8A8680" n="Tertiary" v="#8A8680" /><Sw c="#B0ADA8" n="Placeholder" v="#B0ADA8" /><Sw c="#FAFAF8" n="On Inverse" v="#FAFAF8" b="1px solid rgba(255,255,255,0.15)" /><Sw c="#FFFFFF" n="On Accent" v="#FFFFFF" b="1px solid rgba(255,255,255,0.15)" /></div>
    <H3>Accent — Annotation Purple</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Sw c="#B8A9C8" n="Primary" v="#B8A9C8" /><Sw c="#C4B8D4" n="Light" v="#C4B8D4" /><Sw c="#9A8BAA" n="Dark (hover)" v="#9A8BAA" /></div>
    <Do>Use accent purple only for: annotations, status text, editorial labels, send button, unread badges</Do>
    <Dont>Use purple for body text, headings, borders, backgrounds, or structural elements</Dont>
    <H3>Contrast Ratios</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Primary text on Page","12.8:1","AAA"],["Primary text on Surface","10.4:1","AAA"],["Secondary text on Page","7.2:1","AAA"],["Tertiary text on Page","4.7:1","AA"],["Accent purple on Page","3.6:1","AA (lg)"],["On-inverse on Inverse bg","12.8:1","AAA"],["White on Accent badge","4.1:1","AA"]].map((r,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 55px", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span><code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code><span style={{ fontSize: 9, fontWeight: 600, color: r[2].includes("AAA") ? "#34D399" : "#FBBF24" }}>{r[2]}</span></div>))}
    </div>
  </div>),
  typography: () => (<div>
    <P>Sketch uses a strict dual-font system. The boundary between the two families is the most important typographic rule in the system.</P>
    <H3>Font Families</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
      <div style={{ padding: "14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}><div style={{ fontFamily: "'IBM Plex Sans'", fontSize: 18, color: "#EEE", marginBottom: 4 }}>IBM Plex Sans</div><div style={{ fontSize: 10, fontWeight: 600, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Structural — the grid</div><div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>All navigation, body text, headings, form inputs, labels, buttons (except send), metadata, timestamps. Everything that carries functional meaning.</div></div>
      <div style={{ padding: "14px", borderRadius: 8, border: "1px solid rgba(184,169,200,0.2)", background: "rgba(184,169,200,0.04)" }}><div style={{ fontFamily: "'Caveat'", fontSize: 22, color: "#B8A9C8", marginBottom: 4 }}>Caveat</div><div style={{ fontSize: 10, fontWeight: 600, color: "#B8A9C8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Editorial — the wink</div><div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Annotations above AI messages, status indicators, section labels, empty state messages, the send button label, whimsical editorial asides.</div></div>
    </div>
    <Do>Use Caveat exclusively with color.accent.primary (#B8A9C8 or #C4B8D4)</Do>
    <Dont>Use Caveat for headings, body text, navigation labels, form inputs, or error messages</Dont>
    <Dont>Use IBM Plex Sans for annotations, status indicators, or editorial asides</Dont>
    <H3>Type Scale</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["display","18px","600","1.3","-0.02em","Page titles"],["heading","15px","600","1.3","-0.02em","Section headings"],["title","13.5px","600","1.3","-0.01em","Chat headers, card titles"],["body","13px","400","1.55","0","Message text"],["label","12.5px","600","1.3","0","Sidebar item names"],["caption","11px","400","1.4","0","Preview text"],["micro","10px","500","1.3","0","Timestamps, meta"],["annotation","13px","700","1.3","0","Caveat only"]].map((t,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "75px 48px 42px 38px 50px 1fr", padding: "5px 10px", borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.025)" : "none", background: t[0]==="annotation" ? "rgba(184,169,200,0.04)" : "transparent" }}>
          <code className="mn" style={{ fontSize: 10, color: t[0]==="annotation" ? "#B8A9C8" : "#CCC" }}>{t[0]}</code>
          {t.slice(1).map((v,vi) => <span key={vi} style={{ fontSize: 10, color: vi < 4 ? "#999" : "#666" }}>{v}</span>)}
        </div>))}
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
      {[{r:8,l:"Component",t:"radius.sm"},{r:10,l:"Container",t:"radius.md"},{r:12,l:"Message",t:"radius.lg"},{r:16,l:"App shell",t:"radius.xl"}].map(item => (
        <div key={item.t} style={{ textAlign: "center" }}><div style={{ width: 44, height: 44, borderRadius: item.r, border: "2px solid rgba(184,169,200,0.35)", background: "rgba(255,255,255,0.02)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}><code className="mn" style={{ fontSize: 9, color: "#999" }}>{item.r}px</code></div><div style={{ fontSize: 9.5, color: "#CCC", fontWeight: 600 }}>{item.l}</div><code className="mn" style={{ fontSize: 8.5, color: "#666" }}>{item.t}</code></div>))}
    </div>
    <H3>Shadow Rules</H3>
    <Dont>Use box-shadow on any element. This is a structural rule, never violated.</Dont>
    <Dont>Use drop-shadow, text-shadow, or filter: shadow.</Dont>
    <Do>Use background color separation (page → surface → elevated) to create visual hierarchy without shadows.</Do>
  </div>),
  components: () => (<div>
    <P>Each component specifies anatomy, behavioral contract, exact token values, and do/don't rules. Click to expand.</P>
    <CBox title="ChatBubble" parts={["container","text","annotation","tail"]} accent={a}
      contract="Must visually distinguish user messages from AI messages. Must support multi-line text with proper wrapping. Must allow optional cursive annotation above AI messages."
      specs={[["padding","11px 15px"],["border-radius","12px","Uniform on all corners"],["font-size","13px (body)"],["line-height","1.55"],["max-width","78%","Of chat container"],["user.background","#2C2C2C","Inverse surface"],["user.color","#FAFAF8","On-inverse text"],["ai.background","#F0EDE8","Surface"],["ai.color","#2C2C2C","Primary text"],["ai.border","1px solid #E5E3DE"]]}
      dos={["Add cursive annotations above AI messages for editorial moments ('ooh fun one!', '↓ great question')","Use consistent 12px radius on all bubble corners (no directional tail shape)"]}
      donts={["Add box-shadow to bubbles (use border only for AI messages)","Use annotations on user messages — annotations are the AI's editorial voice","Show timestamps on every message — Sketch keeps metadata minimal"]} />
    <CBox title="SidebarItem" parts={["container","avatar","title","preview","time","badge"]} accent={a}
      contract="Must show selected/unselected state clearly. Must truncate preview text with ellipsis. Must be keyboard-focusable. Must support unread count badge."
      specs={[["padding","10px 14px"],["border-radius","10px"],["margin","0 6px 3px","Inset from sidebar edge"],["selected.bg","#F0EDE8","Surface color"],["selected.border","1px solid #E5E3DE"],["avatar.size","34px"],["avatar.radius","8px"],["avatar.bg","#F0EDE8"],["avatar.border","1px solid #E5E3DE"],["title.font","label (12.5px/600)"],["preview.font","caption (11px/400)"],["preview.color","#8A8680","Tertiary text"]]}
      dos={["Use background color + border for selected state — never shadow","Truncate preview to single line with text-overflow: ellipsis"]}
      donts={["Use a left accent bar for selection (that's the Lucid pattern, not Sketch)","Show online status indicators (Sketch omits real-time presence)"]} />
    <CBox title="TextInput" parts={["container","input","placeholder","action"]} accent={a}
      contract="Must have a clearly visible boundary. Must show focus state. Placeholder must be legible. Action element must be discoverable."
      specs={[["padding","9px 14px"],["border-radius","10px"],["border","1px solid #E5E3DE"],["background","#FFFFFF","Elevated surface"],["font","body (13px/400)","IBM Plex Sans"],["placeholder.color","#B0ADA8","45% opacity"],["action.font","Caveat 17px/700","Annotation font"],["action.color","#B8A9C8","Accent purple"],["action.label","'go →'","Cursive send label"]]}
      dos={["Use sentence-case placeholder text ('Type here...', 'Search...')","Use Caveat for the send action label — key Sketch identity moment"]}
      donts={["Use uppercase placeholders (that's Revolt's convention)","Use an icon-only send button (Sketch uses text labels for warmth)"]} />
    <CBox title="Badge" parts={["container","count"]} accent={a}
      contract="Must be legible at small sizes. Must contrast with parent surface."
      specs={[["size","18px height, min 18px width"],["border-radius","6px"],["background","#B8A9C8","Accent purple"],["color","#FFFFFF","On-accent"],["font","micro (9px/700)"]]}
      dos={["Use solid fill for badge background"]} donts={["Use bordered/outlined badges (that's Revolt)","Use any color other than accent purple"]} />
    <CBox title="Header" parts={["container","icon","title","status"]} accent={a}
      contract="Must identify the current chat context. Must separate from content area below."
      specs={[["padding","12px 20px"],["border-bottom","1px solid #E5E3DE"],["background","transparent","Inherits page bg"],["title.font","title (13.5px/600)"],["status.font","Caveat 13px/700","Annotation"],["status.color","#B8A9C8"],["status.text","'✎ active'"]]}
      dos={["Use Caveat for status — editorial annotation style","Keep visually lightweight — transparent bg, thin border"]}
      donts={["Fill header with accent background (that's Revolt)","Use glass/blur in header (that's Prism)"]} />
    <CBox title="BentoChip" parts={["container","emoji","label"]} accent={a}
      contract="Must be tappable. Must appear in 2-column grid. Must support emoji prefix."
      specs={[["padding","10px"],["border-radius","8px"],["background","#F7F5F0","Surface subtle"],["border","1px solid #E5E3DE"],["font","caption (11.5px/400)"],["color","#555555","Secondary text"],["text-align","center"],["hover.bg","#EDE9E2"],["grid.columns","2","Always 2"],["grid.gap","6px"]]}
      dos={["Introduce chips with a cursive annotation label ('pick a vibe ~')","Always use emoji as first character"]}
      donts={["Use more than 2 columns","Show chips without an introductory annotation"]} />
  </div>),
  patterns: () => (<div>
    <P>Composition rules for Sketch layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width","260px fixed"],["Main area","Fluid, fills remaining"],["Sidebar order","Brand → Search → Section label (cursive) → Chat list → User panel"],["Vertical divider","1px solid #E5E3DE"],["Background","#FAFAF8 for both panes"]] },
      { n: "Chat Message Flow", rows: [["Direction","Vertical stack, chronological"],["Alignment","User → right, AI → left"],["Max width","78% of container"],["Gap","12px between messages"],["Entrance","fadeSlideUp, 400ms ease, 80ms stagger"],["Annotations","Cursive text above select AI messages"],["Suggestion chips","After final AI message when choices available"]] },
      { n: "Active Selection", rows: [["Model","Single selection only"],["Trigger","Click or Enter/Space"],["Visual","bg: #F0EDE8, border: 1px solid #E5E3DE"],["Transition","200ms ease"],["Avatar change","None — stays consistent"]] },
      { n: "Search", rows: [["Position","Top of sidebar, below brand"],["Container","1px border, white bg, 8px radius"],["Icon","⌕ prefix, #C0BCB6"],["Placeholder","'Search...' — sentence case"]] },
    ].map((p,pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4><div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>{p.rows.map((r,ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div><div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div></div>))}</div></div>))}
  </div>),
  extensions: () => (<div>
    <H3>1. Annotation System</H3>
    <P>Sketch's defining feature. Cursive text overlays that provide editorial commentary, status, and human warmth.</P>
    <Tk n="font" v="Caveat, 700 weight" a={a} /><Tk n="color" v="#B8A9C8 or #C4B8D4" d="Accent purple only" a={a} /><Tk n="rotation" v="-1° to -3°" d="Always counterclockwise" a={a} /><Tk n="max-rotation" v="-3°" d="Never exceed" a={a} /><Tk n="transform-origin" v="left center" a={a} />
    <H4>Placement Rules</H4>
    <Do>Above AI messages for editorial reactions ("↓ ooh fun one!")</Do><Do>As section labels in the sidebar ("↓ your chats")</Do><Do>As status text in headers ("✎ active")</Do><Do>As empty state messages ("✎ sketching your itinerary...")</Do><Do>As the send button label ("go →")</Do><Do>As introductions to bento chips ("pick a vibe ~")</Do>
    <Dont>On user messages — annotations are the AI/system's editorial voice</Dont><Dont>In form inputs, labels, or error messages</Dont><Dont>In navigation items or headings</Dont><Dont>More than once per visible viewport — they lose impact when overused</Dont>
    <H4>Vocabulary & Tone</H4>
    <P>Annotations should feel like a friend's handwritten margin note — casual, warm, slightly playful. Never formal, robotic, or instructional.</P>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <div style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(52,211,153,0.12)", background: "rgba(52,211,153,0.04)" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#34D399", marginBottom: 5 }}>GOOD ANNOTATIONS</div>
        {["↓ ooh fun one!","pick a vibe ~","✎ sketching ideas...","✦ nice choice!","↓ your chats","go →"].map(x => <div key={x} style={{ fontFamily: "'Caveat'", fontSize: 13, color: "#B8A9C8", fontWeight: 700, marginBottom: 1 }}>{x}</div>)}
      </div>
      <div style={{ padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,107,107,0.12)", background: "rgba(255,107,107,0.04)" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#FF6B6B", marginBottom: 5 }}>BAD ANNOTATIONS</div>
        {["Processing your request...","Click here to continue","ERROR: Invalid input","Navigation Menu","Submit Form","IMPORTANT NOTICE"].map(x => <div key={x} style={{ fontFamily: "'Caveat'", fontSize: 13, color: "#FF6B6B", fontWeight: 700, marginBottom: 1, textDecoration: "line-through", opacity: 0.5 }}>{x}</div>)}
      </div>
    </div>
    <H3>2. Dual-Font Boundary</H3>
    <P>The boundary between IBM Plex Sans and Caveat is strict and inviolable. If unsure which font to use, it's IBM Plex Sans. Caveat is the exception, never the default.</P>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Navigation labels","IBM Plex Sans","Structural"],["Body / message text","IBM Plex Sans","Structural"],["Form inputs","IBM Plex Sans","Structural"],["Headings","IBM Plex Sans","Structural"],["Button labels (standard)","IBM Plex Sans","Structural"],["Send button","Caveat","Annotation"],["Status indicators","Caveat","Annotation"],["Section labels","Caveat","Annotation"],["AI message annotations","Caveat","Annotation"],["Empty state messages","Caveat","Annotation"],["Chip introductions","Caveat","Annotation"]].map((r,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px", padding: "5px 10px", borderBottom: i < 10 ? "1px solid rgba(255,255,255,0.025)" : "none", background: r[2]==="Annotation" ? "rgba(184,169,200,0.03)" : "transparent" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <span style={{ fontSize: 10.5, color: r[2]==="Annotation" ? "#B8A9C8" : "#999", fontFamily: r[2]==="Annotation" ? "'Caveat'" : "'IBM Plex Sans'", fontWeight: r[2]==="Annotation" ? 700 : 400 }}>{r[1]}</span>
          <span style={{ fontSize: 9.5, color: r[2]==="Annotation" ? "#B8A9C8" : "#666", fontWeight: 500 }}>{r[2]}</span>
        </div>))}
    </div>
    <H3>3. Bento Suggestion Chips</H3>
    <Tk n="trigger" v="AI offers multiple choices" d="Only when options exist" a={a} /><Tk n="layout" v="2-column grid, 6px gap" d="Never 1 or 3+ columns" a={a} /><Tk n="format" v="Emoji + label" d="e.g., '🏯 Temples'" a={a} /><Tk n="intro" v="Cursive annotation above" d="e.g., 'pick a vibe ~'" a={a} /><Tk n="position" v="After final AI message" a={a} />
    <H3>4. No-Shadow Rule</H3>
    <P>Zero box-shadows anywhere. All visual hierarchy through background color separation and 1px borders. This is what fundamentally separates Sketch from neumorphic systems.</P>
    <Do>Use background tiers: page (#FAFAF8) → surface (#F0EDE8) → elevated (#FFFFFF)</Do>
    <Dont>Use box-shadow, drop-shadow, text-shadow, or any shadow property for any purpose</Dont>
  </div>),
  voice: () => (<div>
    <P>Sketch has a distinct voice that extends beyond the annotation layer. Every piece of microcopy contributes to the system's personality.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Warm","Casual","Helpful","Gently playful"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never formal","Never robotic"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>
    <H3>Placeholder Text</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Chat input","Type here...","Plex"],["Sidebar search","Search...","Plex"],["Empty chat list","✎ no conversations yet","Caveat"],["Loading state","✎ sketching your itinerary...","Caveat"],["Error state","Something went wrong. Try again?","Plex"]].map((p,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 60px", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span><span style={{ fontSize: 10.5, color: p[2]==="Caveat" ? "#B8A9C8" : "#999", fontFamily: p[2]==="Caveat" ? "'Caveat'" : "'IBM Plex Sans'", fontWeight: p[2]==="Caveat" ? 700 : 400 }}>{p[1]}</span><span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span></div>))}
    </div>
    <H3>Conventions</H3>
    <Do>Sentence case everywhere. Never title case, never all caps.</Do><Do>Annotations end with soft punctuation (ellipsis, tilde, exclamation). Never periods.</Do><Do>Use arrow characters (→, ↓) instead of spelled-out words.</Do><Do>Keep annotations under 5 words. Margin notes, not sentences.</Do>
    <Dont>Technical jargon in annotations. "Loading" → "✎ sketching..."</Dont><Dont>Formal punctuation (colons, semicolons, periods) in annotations.</Dont>
    <H3>Symbol Vocabulary</H3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {[["✎","Active / in-progress"],["✦","Positive / highlights"],["↓","Points to content below"],["→","Action labels, navigation"],["~","Soft endings, casual tone"],["!","Enthusiasm (sparingly)"]].map(([s,u]) => <div key={s} style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}><span style={{ fontSize: 16, fontFamily: "'Caveat'", color: a, fontWeight: 700 }}>{s}</span><div style={{ fontSize: 9.5, color: "#777", marginTop: 1 }}>{u}</div></div>)}
    </div>
  </div>),
};}

/* ═══════════════════════════════════════════════════════════════
   PRISM SPEC (full content)
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
    <Do>Media players, creative tools, OS interfaces, editorial platforms, e-commerce showcases</Do>
    <Dont>Data-dense dashboards (glass reduces contrast) or accessibility-first products</Dont>
  </div>),
  color: () => (<div>
    <P>Nearly every color is RGBA with alpha channels. Colors are context-dependent — the gradient behind the glass affects appearance.</P>
    <H3>Background Gradient</H3>
    <div style={{ height: 40, borderRadius: 6, background: "linear-gradient(150deg,#4A5D6B 0%,#5A4A5E 40%,#6B5A5A 70%,#4A6058 100%)", marginBottom: 6, border: "1px solid rgba(255,255,255,0.1)" }} />
    <Tk n="gradient.angle" v="150deg" d="Diagonal" a={a} /><Tk n="gradient.stops" v="#4A5D6B → #5A4A5E → #6B5A5A → #4A6058" a={a} />
    <H3>Glass Surfaces</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Sw c="rgba(255,255,255,0.08)" n="Base" v="rgba(…,0.08)" /><Sw c="rgba(255,255,255,0.14)" n="Elevated" v="rgba(…,0.14)" /><Sw c="rgba(255,255,255,0.18)" n="Strong" v="rgba(…,0.18)" /></div>
    <H3>Text (opacity-based)</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Sw c="rgba(255,255,255,0.95)" n="Primary" v="0.95" b="1px solid rgba(255,255,255,0.2)" /><Sw c="rgba(255,255,255,0.8)" n="Secondary" v="0.80" b="1px solid rgba(255,255,255,0.15)" /><Sw c="rgba(255,255,255,0.4)" n="Tertiary" v="0.40" b="1px solid rgba(255,255,255,0.1)" /></div>
    <H3>Accent — Teal</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}><Sw c="#7DDFBE" n="Solid" v="#7DDFBE" /><Sw c="rgba(125,223,190,0.25)" n="Tinted" v="rgba(…,0.25)" /><Sw c="rgba(125,223,190,0.4)" n="Border" v="rgba(…,0.4)" /></div>
    <H3>Contrast Notes</H3>
    <P>Glass interfaces are inherently low-contrast. Ratios measured against darkest gradient stop:</P>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Primary on darkest gradient","~14:1","AAA"],["Primary on glass base","~10:1","AAA"],["Secondary on glass base","~5.5:1","AA"],["Tertiary on glass base","~2.5:1","Fails"],["Accent teal on glass base","~7:1","AAA"]].map((r,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 65px 50px", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span><code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code><span style={{ fontSize: 9, fontWeight: 600, color: r[2]==="AAA"?"#34D399":r[2]==="AA"?"#FBBF24":"#FF6B6B" }}>{r[2]}</span></div>))}
    </div>
    <Dont>Use tertiary text (0.4 opacity) for critical information — fails contrast on lighter areas</Dont>
  </div>),
  typography: () => (<div>
    <P>Single font — Outfit — in varying weights. No dual-font system. Hierarchy via weight, size, and opacity.</P>
    <div style={{ padding: "14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}><div style={{ fontFamily: "'Outfit'", fontSize: 20, fontWeight: 300, color: "rgba(255,255,255,0.9)", marginBottom: 4 }}>Outfit</div><div style={{ fontFamily: "'Outfit'", fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>Light 300 · Regular 400 · Medium 500 · Semibold 600</div><div style={{ fontSize: 10.5, color: "#999" }}>Geometric sans-serif with soft, rounded feel. Light weights add airiness matching the glass aesthetic.</div></div>
    <H3>Type Scale</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["display","16px","500","1.3","-0.02em","App name"],["title","13.5px","500","1.3","-0.01em","Headers"],["body","13px","400","1.6","0","Messages"],["label","12.5px","500","1.3","0","Sidebar items"],["caption","11px","400","1.4","0","Previews"],["micro","10px","500","1.3","0.03em","Status"],["micro-sm","9px","600","1.3","0","Badges"]].map((t,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 48px 42px 38px 50px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>{t.slice(1).map((v,vi) => <span key={vi} style={{ fontSize: 10, color: vi < 4 ? "#999" : "#666" }}>{v}</span>)}
        </div>))}
    </div>
    <Do>Use negative letter-spacing on display/title for tighter, premium feel</Do>
    <Dont>Use bold (700) weight — semibold (600) is the maximum permitted</Dont>
  </div>),
  elevation: () => (<div>
    <P>The Glass Composition System — three independent axes that combine to create translucent, layered surfaces. No box-shadows. Depth = blur + opacity.</P>
    <H3>Blur Tiers</H3>
    <Tk n="blur.subtle" v="backdrop-filter: blur(12px)" d="Decorative panels, avatars" a={a} /><Tk n="blur.standard" v="backdrop-filter: blur(20px)" d="Default glass surfaces" a={a} /><Tk n="blur.heavy" v="backdrop-filter: blur(24px)" d="Headers, overlays" a={a} />
    <H3>Opacity Tiers</H3>
    <Tk n="opacity.base" v="rgba(255,255,255,0.08)" d="Default panels" a={a} /><Tk n="opacity.elevated" v="rgba(255,255,255,0.14)" d="Selected/active" a={a} /><Tk n="opacity.strong" v="rgba(255,255,255,0.18)" d="User messages" a={a} />
    <H3>Composition Table</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Sidebar item (default)","None","transparent","None"],["Sidebar item (selected)","None","0.14","0.12"],["Avatar","blur(12px)","0.08","0.12"],["Chat header","blur(24px)","0.08","0.12"],["AI message","blur(20px)","0.08","0.12"],["User message","blur(20px)","0.18","0.12"],["Text input","blur(12px)","0.08","0.12"],["Send button","None","0.14","0.18"]].map((c,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 80px 70px", padding: "5px 10px", borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>{c.map((v,vi) => <span key={vi} style={{ fontSize: 10, color: vi === 0 ? "#BBB" : "#888" }}>{v}</span>)}</div>))}
    </div>
    <H3>Performance Budget</H3>
    <Tk n="perf.maxBlurLayers" v="6" d="Max simultaneous per viewport" a={a} /><Tk n="perf.fallback" v="@supports + solid bg" d="For non-supporting devices" a={a} />
    <Do>Test on mid-range mobile — backdrop-filter is GPU-intensive</Do>
    <Dont>Apply blur to frequently re-rendered elements (animated lists)</Dont>
    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 12 }}>{[{r:6,l:"Badge"},{r:10,l:"Avatar"},{r:12,l:"Item"},{r:14,l:"Input"},{r:16,l:"Message"},{r:20,l:"Shell"}].map(x => <div key={x.l} style={{ textAlign: "center" }}><div style={{ width: 38, height: 38, borderRadius: x.r, border: "1px solid rgba(125,223,190,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}><code className="mn" style={{ fontSize: 7, color: "#888" }}>{x.r}</code></div><div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>{x.l}</div></div>)}</div>
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
      dos={["Use tinted glass for badges"]} donts={["Use solid color fills"]} />
    <CBox title="Header" parts={["glass-panel","icon","title","subtitle"]} accent={a}
      contract="Must separate from content via glass + border. Must show context and status."
      specs={[["padding","14px 20px"],["composition","blur(24px) + base + border","Heavy blur"],["border-bottom","rgba(…,0.1)"],["title.color","rgba(…,0.9)"],["title.font","title (13.5px/500)"],["subtitle.color","rgba(…,0.35)"],["subtitle.text","'active session'"]]}
      dos={["Use heaviest blur tier (24px)"]} donts={["Fill with solid accent color","Use cursive fonts for status"]} />
  </div>),
  patterns: () => (<div>
    <P>Composition rules for Prism layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width","260px fixed"],["Divider","1px solid rgba(…,0.1)"],["Sidebar bg","Inherits page gradient — no separate bg"],["Content order","Brand → Search → Chat list → User panel"]] },
      { n: "Chat Message Flow", rows: [["Alignment","User → right, AI → left"],["Max width","78%"],["Gap","12px"],["Entrance","fadeSlideUp, 500ms ease-out, 100ms stagger"],["Metadata","Hidden — no timestamps, no sender labels"]] },
      { n: "Active Selection", rows: [["Model","Single select"],["Visual","Glass tier shift: base → elevated"],["Transition","250ms ease-out"]] },
      { n: "Ambient Background", rows: [["Gradient","4-stop, 150deg diagonal"],["Orb count","2–3 per viewport"],["Orb size","120–200px diameter"],["Orb opacity","0.15–0.25"],["Orb interaction","pointer-events: none"]] },
    ].map((p,pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4><div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>{p.rows.map((r,ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div><div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div></div>))}</div></div>))}
  </div>),
  extensions: () => (<div>
    <H3>1. Ambient Light Orbs</H3>
    <P>Background radial gradients positioned at fixed coordinates. They create pools of colored light that bleed through glass panels, giving environmental depth.</P>
    <Tk n="element" v="div with radial-gradient" a={a} /><Tk n="size" v="120–200px diameter" a={a} /><Tk n="opacity" v="0.15–0.25" d="Subtle, never dominant" a={a} /><Tk n="pointer-events" v="none" d="Purely decorative" a={a} /><Tk n="z-index" v="0" d="Behind all content" a={a} /><Tk n="max-count" v="3 per viewport" a={a} />
    <Do>Use colors complementary to gradient stops — muted mauves, soft teals</Do>
    <Dont>Animate orb positions (motion sickness risk + performance)</Dont><Dont>Use bright or saturated orb colors</Dont>
    <H3>2. Glass Composition System</H3>
    <P>Every surface built by composing three independent axes: blur radius, background opacity, border opacity. Any blur tier can pair with any opacity tier. See Elevation section for full documentation.</P>
    <Do>Treat axes as independent — composable, not preset</Do>
    <Dont>Lock specific combinations into named presets</Dont>
    <H3>3. Performance Budget</H3>
    <Tk n="max.blur.layers" v="6" d="Simultaneous visible" a={a} /><Tk n="fallback.strategy" v="@supports query" a={a} /><Tk n="fallback.bg" v="rgba(40,50,55,0.85)" d="Solid for non-supporting" a={a} />
    <Do>{"Provide pre-blurred fallback for older browsers"}</Do>
    <H3>4. Multi-Stop Gradient Background</H3>
    <P>The page gradient is structural, not decorative. Glass over a solid color is visually meaningless. The gradient makes transparency legible.</P>
    <Do>At least 4 stops with hue variation. Mid-range lightness (HSL 30–45%).</Do>
    <Dont>2-stop linear gradient — insufficient for glass surfaces</Dont>
  </div>),
  voice: () => (<div>
    <P>Prism's voice is minimal and ambient. Microcopy should feel like whispered labels in a quiet gallery.</P>
    <H3>Tone</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>{["Minimal","Ambient","Understated","Quietly confident"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}{["Never loud","Never playful"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}</div>
    <H3>Labels</H3>
    <div style={{ borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Chat input","Message...","Single word, no preamble"],["Search","Search...","Identical to Sketch"],["Status","active session","Lowercase, descriptive"],["User panel","You · active","Dot separator"],["Empty state","No conversations yet","Plain, no emoji"]].map((p,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span><span style={{ fontSize: 10.5, color: "#7DDFBE" }}>{p[1]}</span><span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span></div>))}
    </div>
    <Do>Single-word labels. Dot separator (·). Lowercase for all status/meta text.</Do>
    <Dont>Emoji. Exclamation marks. Personality. Editorial commentary.</Dont>
  </div>),
};}

/* ═══════════════════════════════════════════════════════════════
   REVOLT SPEC (full content)
   ═══════════════════════════════════════════════════════════════ */
function revoltSpec(a) { return {
  overview: () => (<div>
    <P>Revolt is a neobrutalist interface system with Y2K energy. It rejects polish, rounded corners, and subtle gradients in favor of hard borders, offset shadows, monospaced type, and a deliberately raw aesthetic.</P>
    <P>The system's identity is confrontational clarity. Every element announces itself with thick black borders and hard shadows. Color is restricted to five values. Typography is monospaced and uppercase.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[["Black borders define everything","Every element has a 2–3px solid black border. This is the system's skeleton. Remove the borders and the interface collapses."],["Zero blur, hard offset shadows","All shadows use 0px blur radius. Shadow = offset only (e.g., 4px 4px 0 #111). The hard edge is the aesthetic."],["Five colors, no exceptions","Black, white, cream, neon lime, hot pink. That's the entire palette. Every color has a strict role. No gradients. No opacity variations."],["Zero radius everywhere","border-radius: 0 on every element. Rectangles only. No rounding, no pills, no circles. Structural rule."]].map(([t,d],i) => (
        <div key={i} style={{ padding: "10px 12px", border: "2px solid rgba(255,255,255,0.08)" }}><div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.02em" }}>{t}</div><div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div></div>))}
    </div>
    <Do>Creative agencies, indie games, Gen Z social platforms, music apps, portfolio sites, dev tools</Do>
    <Dont>Corporate products, financial services, healthcare, or trust-first aesthetics</Dont>
  </div>),
  color: () => (<div>
    <P>Five colors total. Each has exactly one role. Adding a sixth would break the system.</P>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 12 }}><Sw c="#111" n="Black" v="#111" b="2px solid #333" /><Sw c="#FFF" n="White" v="#FFF" b="2px solid #111" /><Sw c="#FFFEF5" n="Cream" v="#FFFEF5" b="2px solid #111" /><Sw c="#C8FF00" n="Lime" v="#C8FF00" b="2px solid #111" /><Sw c="#FF3366" n="Pink" v="#FF3366" b="2px solid #111" /></div>
    <H3>Color Roles</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["#111","Black","Borders, shadows, text","Backgrounds"],["#FFF","White","Card surfaces, AI messages","Text on light"],["#FFFEF5","Cream","Page background only","Any other role"],["#C8FF00","Lime","Active states, send button","Text or borders"],["#FF3366","Pink","User msgs, headers, badges","AI msgs or structural"]].map((c,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "30px 50px 1fr 1fr", padding: "6px 10px", borderBottom: i < 4 ? "2px solid rgba(255,255,255,0.04)" : "none" }}>
          <div style={{ width: 18, height: 18, background: c[0], border: "2px solid #333" }} /><span style={{ fontSize: 10, fontWeight: 700, color: "#DDD" }}>{c[1]}</span><span style={{ fontSize: 10, color: "#999" }}>{c[2]}</span><span style={{ fontSize: 10, color: "#FF6B6B" }}>Never: {c[3]}</span>
        </div>))}
    </div>
    <H3>Contrast Ratios</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["Black on Cream","18.5:1","AAA"],["Black on White","19.9:1","AAA"],["Black on Lime","15.3:1","AAA"],["White on Pink","4.2:1","AA"],["Black on Pink","4.8:1","AA"]].map((r,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 65px 50px", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span><code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code><span style={{ fontSize: 9, fontWeight: 600, color: "#34D399" }}>{r[2]}</span></div>))}
    </div>
    <P>High-contrast palette naturally passes WCAG AA on all combinations.</P>
  </div>),
  typography: () => (<div>
    <P>Single monospaced font — Space Mono — everywhere. No secondary font. Everything except body text is uppercase.</P>
    <div style={{ padding: "14px", border: "2px solid rgba(255,255,255,0.08)", marginBottom: 12 }}><div style={{ fontFamily: "'Space Mono'", fontSize: 18, fontWeight: 700, color: "#EEE", textTransform: "uppercase", letterSpacing: "0.06em" }}>Space Mono</div><div style={{ fontSize: 10.5, color: "#888" }}>Regular 400 · Bold 700. Two weights only.</div></div>
    <H3>Transform Rules</H3>
    <Tk n="transform.labels" v="uppercase" d="All labels, nav, headings" a={a} /><Tk n="transform.body" v="none" d="Message text only" a={a} /><Tk n="transform.placeholders" v="uppercase" d="Input placeholders" a={a} /><Tk n="transform.meta" v="uppercase" d="Timestamps, status" a={a} />
    <H3>Type Scale</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["display","14px","700","0.08em","Brand, titles"],["title","12px","700","0.06em","Headers, labels"],["body","11.5px","400","0","Messages (not uppercase)"],["label","11px","700","0.04em","Sidebar items"],["caption","10px","400","0","Preview text"],["micro","9px","700","0.1em","Status pills"],["micro-sm","8px","700","0.1em","Code metadata"]].map((t,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 48px 38px 50px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>{t.slice(1).map((v,vi) => <span key={vi} style={{ fontSize: 10, color: vi < 3 ? "#999" : "#666" }}>{v}</span>)}
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
      {[["sm","2px 2px 0 #111"],["md","3px 3px 0 #111"],["lg","4px 4px 0 #111"],["xl","6px 6px 0 #111"]].map(([n,v]) => <div key={n} style={{ textAlign: "center" }}><div style={{ width: 52, height: 36, background: "#FFF", border: "2px solid #111", boxShadow: v, marginBottom: 6 }} /><code className="mn" style={{ fontSize: 9, color: "#CCC" }}>{n}</code><div><code className="mn" style={{ fontSize: 8, color: "#666" }}>{v}</code></div></div>)}
    </div>
    <Tk n="blur" v="0px" d="ALWAYS. No exceptions." a={a} /><Tk n="shadow.color" v="#111" d="Always black" a={a} />
    <H3>Border System</H3>
    <Tk n="border.width.component" v="2px" d="Buttons, inputs, cards, avatars" a={a} /><Tk n="border.width.structural" v="3px" d="Sidebar divider, header, footer" a={a} /><Tk n="border.color" v="#111111" d="Always black" a={a} /><Tk n="border.radius" v="0" d="All elements. No exceptions." a={a} />
    <H3>Rule Hierarchy</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["border-radius: 0","INVIOLABLE","Zero everywhere"],["Shadow blur: 0","INVIOLABLE","Hard offset only"],["5-color palette","INVIOLABLE","No new colors"],["Border color: #111","INVIOLABLE","Always black"],["Shadow offset (2–6px)","FLEXIBLE","Can vary"],["Hover rotation angle","FLEXIBLE","±1° max"],["Letter-spacing","FLEXIBLE","Adjustable"]].map((r,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{r[0]}</code><span style={{ fontSize: 9.5, fontWeight: 700, color: r[1]==="INVIOLABLE"?"#FF3366":"#C8FF00" }}>{r[1]}</span><span style={{ fontSize: 10, color: "#888" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),
  components: () => (<div>
    <P>Each component obeys the hard-border, zero-radius, 5-color system. Click to expand.</P>
    <CBox title="ChatBubble" parts={["bordered-box","text","code-meta"]} accent={a}
      contract="Must distinguish user from AI through fill color. Must show code-style metadata below every message. Must use hard shadows."
      specs={[["padding","10px 14px"],["border","2px solid #111"],["border-radius","0"],["shadow","4px 4px 0 #111","shadow.lg"],["user.background","#FF3366","Pink"],["user.color","#FFFFFF"],["ai.background","#FFFFFF"],["ai.color","#111111"],["font","body (11.5px/1.5)"],["meta.format","'YOU // 00:1'","Code-style"],["meta.font","micro-sm (8px/700)"],["meta.color","#999999"],["meta.transform","uppercase"],["meta.spacing","0.1em"]]}
      dos={["Show code-style metadata below every message","Use hard shadows on every bubble"]} donts={["Use rounded corners","Hide metadata","Use colored shadows"]} />
    <CBox title="SidebarItem" parts={["bordered-container","bordered-avatar","title","preview","badge"]} accent={a}
      contract="Must show selected state with lime fill + border + shadow. Must rotate on hover. Avatar fills pink when selected."
      specs={[["padding","10px 12px"],["border-radius","0"],["selected.bg","#C8FF00","Lime"],["selected.border","2px solid #111"],["selected.shadow","3px 3px 0 #111"],["hover.transform","rotate(-0.5deg)"],["avatar.size","30px"],["avatar.border","2px solid #111"],["avatar.bg.default","#FFFFFF"],["avatar.bg.selected","#FF3366","Pink when active"],["title.transform","uppercase"]]}
      dos={["Rotate -0.5deg on hover — signature interaction","Swap avatar bg to pink when selected"]} donts={["Use subtle opacity changes","Round any corners"]} />
    <CBox title="TextInput" parts={["bordered-container","input","bordered-button"]} accent={a}
      contract="Must use 2px black border. Send button integrated in container. Button uses lime fill."
      specs={[["border","2px solid #111"],["border-radius","0"],["placeholder.transform","uppercase"],["placeholder.text","'SAY SOMETHING...'"],["button.width","44px"],["button.bg","#C8FF00","Lime"],["button.border-left","2px solid #111","Internal divider"],["button.icon","→","Right arrow, not ↑"],["button.font","16px / 900"]]}
      dos={["Use → (right arrow) for send, not ↑","Integrate button in input container","Uppercase placeholder"]} donts={["Separate button visually","Use cursive labels"]} />
    <CBox title="Header" parts={["accent-bar","icon","title","status-pill"]} accent={a}
      contract="Must use accent fill (pink) as background. Must show status in bordered pill."
      specs={[["padding","10px 16px"],["background","#FF3366","Pink fill"],["border-bottom","3px solid #111"],["title.color","#FFFFFF"],["title.transform","uppercase"],["status.border","2px solid #FFF"],["status.padding","2px 8px"],["status.text","'LIVE'","Uppercase pill"]]}
      dos={["Fill header with pink","Show status in bordered rectangular pill"]} donts={["Transparent header (Sketch)","Glass header (Prism)"]} />
  </div>),
  patterns: () => (<div>
    <P>Composition rules for Revolt layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width","260px fixed"],["Divider","3px solid #111 (structural weight)"],["Header bg","Lime (#C8FF00) for brand"],["Section dividers","3px solid #111"]] },
      { n: "Chat Message Flow", rows: [["Alignment","User → right, AI → left"],["Max width","80% (widest of all themes)"],["Gap","12px"],["Entrance","fadeSlideUp, 300ms ease-out, 60ms stagger"],["Metadata","Below every message: code-style"],["Shadows","shadow.lg on every bubble"]] },
      { n: "Active Selection", rows: [["Model","Single select"],["Visual","Lime bg + 2px border + shadow.md"],["Avatar change","Fills pink"],["Transition","150ms linear (instant)"]] },
      { n: "Search", rows: [["Container","2px black border, no radius"],["Placeholder","'FIND...' — uppercase mono"],["No icon","Too decorative for Revolt"]] },
    ].map((p,pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4><div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>{p.rows.map((r,ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div><div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div></div>))}</div></div>))}
  </div>),
  extensions: () => (<div>
    <H3>1. Code-Style Timestamps</H3>
    <P>Metadata rendered as monospace code comments. Makes chat feel like reading a terminal log.</P>
    <Tk n="format" v="SENDER // 00:INDEX" d="e.g., 'YOU // 00:1'" a={a} /><Tk n="font" v="micro-sm (8px/700)" a={a} /><Tk n="color" v="#999999" a={a} /><Tk n="transform" v="uppercase" a={a} /><Tk n="spacing" v="0.1em" a={a} /><Tk n="position" v="Below message, aligned to sender side" a={a} />
    <Do>Show on every message — part of the visual rhythm</Do>
    <Dont>Use natural language timestamps ("just now", "2 min ago")</Dont>
    <H3>2. Hover Rotation</H3>
    <P>Interactive elements rotate slightly on hover. Mechanical, almost glitchy feel.</P>
    <Tk n="angle.default" v="-0.5deg" a={a} /><Tk n="angle.max" v="±1deg" a={a} /><Tk n="duration" v="120ms" a={a} /><Tk n="easing" v="linear" d="Mechanical snap" a={a} /><Tk n="applies-to" v="SidebarItem, ChatBubble" a={a} />
    <Do>Apply to hoverable cards and list items</Do>
    <Dont>Rotate buttons, inputs, or nav elements</Dont><Dont>Exceed 1 degree</Dont>
    <H3>3. Zero-Blur Shadows</H3>
    <P>All box-shadows use 0px blur radius. Always #111. Always bottom-right offset. The most inviolable visual rule.</P>
    <Dont>Add blur to any shadow for any reason</Dont><Dont>Use colored shadows or negative offsets</Dont>
    <H3>4. Status Pills</H3>
    <P>System status in rectangular bordered pills with uppercase text.</P>
    <Tk n="border" v="2px solid (context color)" a={a} /><Tk n="padding" v="2px 8px" a={a} /><Tk n="font" v="micro (9px/700)" a={a} /><Tk n="radius" v="0" d="Rectangular" a={a} /><Tk n="variants" v="LIVE, TYPING, OFFLINE, ERROR" a={a} />
    <Do>White border + white text on accent backgrounds</Do>
    <Do>Black border + black text on white/cream backgrounds</Do>
  </div>),
  voice: () => (<div>
    <P>Revolt's voice is blunt, mechanical, and stripped of all softness. Microcopy reads like terminal output.</P>
    <H3>Tone</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>{["Blunt","Mechanical","Direct","Code-like"].map(t => <span key={t} style={{ fontSize: 9, padding: "2px 7px", background: "rgba(52,211,153,0.05)", border: "2px solid rgba(52,211,153,0.15)", color: "#34D399", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t}</span>)}{["Never warm","Never playful"].map(t => <span key={t} style={{ fontSize: 9, padding: "2px 7px", background: "rgba(255,107,107,0.05)", border: "2px solid rgba(255,107,107,0.15)", color: "#FF6B6B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{t}</span>)}</div>
    <H3>Labels</H3>
    <div style={{ border: "2px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
      {[["Chat input","SAY SOMETHING...","Imperative, uppercase"],["Search","FIND...","One word, commanding"],["Status","LIVE","Bordered pill"],["User label","USER_01","Underscore-separated"],["Empty state","NO_DATA","Code variable format"],["Loading","LOADING...","Uppercase + ellipsis"],["Metadata","YOU // 00:1","Comment-style"]].map((p,i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", padding: "5px 10px", borderBottom: i < 6 ? "1px solid rgba(255,255,255,0.025)" : "none" }}><span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span><span style={{ fontSize: 10.5, color: "#C8FF00", fontFamily: "'Space Mono'", fontWeight: 700 }}>{p[1]}</span><span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span></div>))}
    </div>
    <Do>UPPERCASE all labels and status. Underscores for compounds. // as separator.</Do>
    <Dont>Emoji — ever. Enthusiasm. Casual tone. Sentence case (except body text).</Dont>
  </div>),
};}

/* ═══════════════════════════════════════════════════════════════
   HUB LANDING + THEME SPEC VIEW + MAIN SHELL
   ═══════════════════════════════════════════════════════════════ */
function HubLanding({ nav }) {
  return (<div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 20px" }}>
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 10 }}>{Object.values(TM).map(t => <div key={t.name} style={{ width: 7, height: 7, borderRadius: 2, background: t.color }} />)}</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#FFF", letterSpacing: "-0.04em", margin: "0 0 6px" }}>Multi-Aesthetic Design System</h1>
      <p style={{ fontSize: 13, color: "#666", maxWidth: 440, margin: "0 auto" }}>One shared architecture. Three distinct visual languages. Live interactive previews. Full specifications.</p>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
      {Object.entries(TM).map(([key, t]) => (
        <div key={key} onClick={() => nav(key, "overview")} style={{ cursor: "pointer", borderRadius: key === "revolt" ? 0 : 10, border: `1px solid ${t.color}30`, padding: "14px", background: `${t.color}06`, transition: "border-color 0.2s" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: t.color, marginBottom: 2 }}>{t.name}</div>
          <div style={{ fontSize: 10, color: "#777", marginBottom: 10 }}>{t.tag}</div>
          <div style={{ height: 110, borderRadius: key === "revolt" ? 0 : 8, overflow: "hidden", marginBottom: 8, border: `1px solid ${t.color}20` }}>
            {key === "sketch" ? <SketchChat sel={1} setSel={() => {}} /> : key === "prism" ? <PrismChat sel={1} setSel={() => {}} /> : <RevoltChat sel={1} setSel={() => {}} />}
          </div>
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{["Overview","Color","Typography","Elevation","Components","Extensions","Voice","Preview"].map(l => <span key={l} style={{ fontSize: 8, padding: "1px 5px", borderRadius: key === "revolt" ? 0 : 3, border: `1px solid ${t.color}15`, color: "#666" }}>{l}</span>)}</div>
        </div>
      ))}
    </div>
    <div onClick={() => nav("arch", "layers")} style={{ padding: "16px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><div style={{ fontSize: 13, fontWeight: 700, color: "#EEE" }}>System Architecture</div><div style={{ fontSize: 9, color: "#555", padding: "2px 6px", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)" }}>7 sections</div></div>
      <div style={{ fontSize: 11, color: "#777", marginBottom: 8 }}>5-layer model, primitive + semantic token comparisons, component contracts, pattern charts, extension registry, and live side-by-side previews.</div>
      <div style={{ display: "flex", gap: 6 }}>{["Layers","Primitives","Semantics","Components","Patterns","Extensions","Live Compare"].map((l,i) => <div key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}><div style={{ width: 6, height: 6, borderRadius: 1.5, background: ["#FF6B6B","#FF6B6B","#FBBF24","#34D399","#60A5FA","#A78BFA","#FFF"][i] }} /><span style={{ fontSize: 9, color: "#777" }}>{l}</span></div>)}</div>
    </div>
    <div style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 10, fontWeight: 600, color: "#999" }}>Quick Compare</div>
      {[["Font","IBM Plex + Caveat","Outfit","Space Mono"],["Elevation","Borders only","Backdrop blur","Hard-offset shadows"],["Radius","8–12px","12–20px","0px"],["Palette","5 neutrals + 1 accent","RGBA opacity tiers","5 flat colors"],["Motion","Subtle, ease","Atmospheric, ease-out","Mechanical, linear"],["Voice","Warm, editorial","Minimal, ambient","Blunt, code-like"]].map((r,ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 1fr", borderTop: "1px solid rgba(255,255,255,0.02)" }}>
          <div style={{ padding: "5px 10px", fontSize: 10, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          {r.slice(1).map((v,vi) => <div key={vi} style={{ padding: "5px 10px", fontSize: 10, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{v}</div>)}
        </div>))}
    </div>
  </div>);
}

function ThemeView({ theme, sec, setSec, nav, sel, setSel }) {
  const t = TM[theme];
  const specSections = [
    { id: "overview", l: "Overview" },{ id: "color", l: "Color" },{ id: "typography", l: "Typography" },
    { id: "elevation", l: "Elevation" },{ id: "components", l: "Components" },{ id: "patterns", l: "Patterns" },
    { id: "extensions", l: "Extensions" },{ id: "voice", l: "Voice & Tone" },{ id: "preview", l: "⬡ Preview" },
  ];
  const spec = theme === "sketch" ? sketchSpec(t.color) : theme === "prism" ? prismSpec(t.color) : revoltSpec(t.color);
  return (<div style={{ display: "flex", minHeight: "100%" }}>
    <div style={{ width: 160, minWidth: 160, borderRight: "1px solid rgba(255,255,255,0.05)", padding: "10px 0" }}>
      {specSections.map(s => (
        <div key={s.id} onClick={() => setSec(s.id)} style={{ padding: "6px 12px", cursor: "pointer", background: sec === s.id ? "rgba(255,255,255,0.03)" : "transparent", borderLeft: sec === s.id ? `2px solid ${t.color}` : "2px solid transparent" }}>
          <span style={{ fontSize: 11, fontWeight: sec === s.id ? 600 : 400, color: sec === s.id ? (s.id === "preview" ? t.color : "#EEE") : "#777" }}>{s.l}</span>
        </div>
      ))}
    </div>
    <div key={sec} style={{ flex: 1, padding: "18px 28px", overflowY: "auto", animation: "fadeIn 0.2s ease" }}>
      <div style={{ maxWidth: 720 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#FFF", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: t.color }}>{specSections.find(s => s.id === sec)?.l}</span>
        </h2>
        {sec === "preview" ? <PreviewView theme={theme} sel={sel} setSel={setSel} /> : spec[sec]?.()}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function App() {
  const [view, setView] = useState("hub");
  const [sec, setSec] = useState("layers");
  const [sel, setSel] = useState(1);
  const themes = ["sketch","prism","revolt"];
  const nav = (v, s) => {
    const fromTheme = themes.includes(view);
    const toTheme = themes.includes(v);
    if (!s && fromTheme && toTheme) {
      // Switching between themes — keep current section
      setView(v);
    } else {
      setView(v);
      setSec(s || (v === "arch" ? "layers" : "overview"));
    }
    setSel(1);
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#0A0A0A", fontFamily: "'DM Sans',system-ui,sans-serif", color: "#EEE" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeSlideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        .mn{font-family:'JetBrains Mono',monospace}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.05);border-radius:3px}
        .app-sh{display:flex;width:100%;height:100%;overflow:hidden}
        .sb{width:220px;min-width:220px;display:flex;flex-direction:column;overflow:hidden}
        .cl{flex:1;overflow-y:auto;padding:0 0 4px}
        .ca{flex:1;display:flex;flex-direction:column;overflow:hidden}
        .ma{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
        .si{border:none;outline:none;background:transparent;flex:1;font-size:11px;width:100%}
        .gi::placeholder{color:rgba(255,255,255,0.25)}
        input::placeholder{opacity:0.4}
        .snd{cursor:pointer;transition:transform 0.1s;flex-shrink:0}.snd:hover{transform:scale(1.05)}
        .mi{animation:fadeSlideUp 0.35s ease both}
        .ci{animation:fadeSlideUp 0.3s ease both}.ci:hover{opacity:0.88}
        .bc:hover{background:#EDE9E2 !important}
      `}</style>

      {/* TOP NAV */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", height: 40 }}>
        <span onClick={() => nav("hub")} style={{ fontSize: 12, fontWeight: 700, color: "#EEE", cursor: "pointer", marginRight: 20, letterSpacing: "-0.02em" }}>Design System</span>
        {[{id:"hub",l:"Hub",c:"#FFF"},{id:"arch",l:"Architecture",c:"#FFF"},{id:"sketch",l:"Sketch",c:"#B8A9C8"},{id:"prism",l:"Prism",c:"#7DDFBE"},{id:"revolt",l:"Revolt",c:"#FF3366"}].map(tab => (
          <div key={tab.id} onClick={() => nav(tab.id)} style={{ padding: "0 10px", height: 40, display: "flex", alignItems: "center", cursor: "pointer", fontSize: 11, fontWeight: view === tab.id ? 600 : 400, color: view === tab.id ? tab.c : "#555", borderBottom: view === tab.id ? `2px solid ${tab.c}` : "2px solid transparent", transition: "all 0.15s" }}>{tab.l}</div>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 9, color: "#333" }}>v1.0</div>
      </div>

      {view !== "hub" && <div style={{ padding: "4px 16px", borderBottom: "1px solid rgba(255,255,255,0.02)", display: "flex", gap: 4, alignItems: "center" }}>
        <span onClick={() => nav("hub")} style={{ fontSize: 9, color: "#444", cursor: "pointer" }}>Hub</span><span style={{ fontSize: 9, color: "#2A2A2A" }}>›</span>
        <span style={{ fontSize: 9, color: view === "arch" ? "#888" : TM[view]?.color }}>{view === "arch" ? "Architecture" : TM[view]?.name}</span>
        <span style={{ fontSize: 9, color: "#2A2A2A" }}>›</span><span style={{ fontSize: 9, color: "#666" }}>{sec}</span>
      </div>}

      <div key={view} style={{ minHeight: "calc(100vh - 40px)", animation: "fadeIn 0.2s ease" }}>
        {view === "hub" && <HubLanding nav={nav} />}
        {view === "arch" && <ArchView sec={sec} setSec={setSec} nav={nav} />}
        {["sketch","prism","revolt"].includes(view) && <ThemeView theme={view} sec={sec} setSec={setSec} nav={nav} sel={sel} setSel={setSel} />}
      </div>
    </div>
  );
}
