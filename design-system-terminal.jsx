import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — TERMINAL
   CLI + Phosphor Heritage · Single-theme standalone spec + live preview
   ═══════════════════════════════════════════════════════════════ */

const TM = { name: "Terminal", tag: "CLI + Phosphor Heritage", color: "#00FF66" };

const chatList = [
  { id: 1, name: "tokyo_trip", preview: "build day-by-day itinerary?", time: "2m", unread: 2, avatar: "🗼", online: true },
  { id: 2, name: "recipe_ideas", preview: "5 ramen variations you'll love...", time: "1h", unread: 0, avatar: "🍜" },
  { id: 3, name: "book_club", preview: "recommend starting with Murakami...", time: "3h", unread: 1, avatar: "📖", online: true },
  { id: 4, name: "fitness_plan", preview: "4-week progressive routine ready.", time: "1d", unread: 0, avatar: "💪" },
  { id: 5, name: "code_review", preview: "auth middleware looks solid, but...", time: "2d", unread: 0, avatar: "⚡" },
];
const msgs = [
  { id: 1, sender: "user", text: "Hey, can you help me plan a trip to Tokyo?" },
  { id: 2, sender: "ai", text: "Absolutely. Tokyo is incredible. Are you looking for a culture-focused trip, food adventure, or a mix of everything?" },
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
function TerminalChat({ sel, setSel }) {
  return (
    <div className="app-sh" style={{ background: "#0A0F0A", fontFamily: "'JetBrains Mono', monospace", borderRadius: 0, border: "1px solid #1F2F1F", color: "#C8F7C5" }}>
      {/* Sidebar */}
      <div className="sb" style={{ borderRight: "1px solid #1F2F1F" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px dashed #1F2F1F" }}>
          <div style={{ color: "#00FF66", fontSize: 11, fontWeight: 700 }}>terminal@chat:~$</div>
          <div style={{ color: "#5EAA66", fontSize: 10, marginTop: 2 }}>// {chatList.length} sessions · 3 active</div>
        </div>
        <div style={{ padding: "10px 14px", borderBottom: "1px dashed #1F2F1F" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#5EAA66", fontSize: 10 }}>$ grep</span>
            <input placeholder="..." className="si" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#C8F7C5", fontSize: 11 }} />
          </div>
        </div>
        <div className="cl">
          <div style={{ padding: "8px 14px 4px", color: "#3D7044", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>// sessions</div>
          {chatList.map((c, i) => (
            <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "5px 14px", cursor: "pointer", animationDelay: `${i * 40}ms` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ color: sel === c.id ? "#00FF66" : "#3D7044", fontSize: 11, width: 10 }}>{sel === c.id ? ">" : " "}</span>
                <span style={{ color: sel === c.id ? "#C8F7C5" : "#5EAA66", fontSize: 11, fontWeight: sel === c.id ? 700 : 400, flex: 1 }}>{c.name}</span>
                {c.unread > 0 && <span style={{ color: "#FFB000", fontSize: 10 }}>[{c.unread}]</span>}
                <span style={{ color: "#3D7044", fontSize: 9 }}>{c.time}</span>
              </div>
              <div style={{ paddingLeft: 14, fontSize: 10, color: "#3D7044", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>// {c.preview}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px dashed #1F2F1F" }}>
          <div style={{ fontSize: 10, color: "#5EAA66" }}>$ whoami</div>
          <div style={{ fontSize: 10, color: "#C8F7C5", marginTop: 2 }}>tucker<span style={{ color: "#3D7044" }}>@local</span></div>
        </div>
      </div>

      {/* Main */}
      <div className="ca">
        <div style={{ padding: "10px 16px", borderBottom: "1px dashed #1F2F1F" }}>
          <div style={{ color: "#5EAA66", fontSize: 10 }}>┌─ SESSION · tokyo_trip · active ─────────────────────┐</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 2, marginTop: 2 }}>
            <span style={{ color: "#00FF66", fontSize: 12, fontWeight: 700 }}>│</span>
            <span style={{ color: "#C8F7C5", fontSize: 12 }}>Tokyo Trip</span>
            <span style={{ color: "#3D7044", fontSize: 10 }}>// 4 exchanges · connected</span>
            <span style={{ marginLeft: "auto", color: "#FFB000", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em" }}>● LIVE</span>
          </div>
          <div style={{ color: "#5EAA66", fontSize: 10 }}>└─────────────────────────────────────────────────────┘</div>
        </div>

        <div className="ma" style={{ padding: "14px 16px" }}>
          {msgs.map((m, i) => (
            <div key={m.id} className="mi" style={{ maxWidth: "100%", animationDelay: `${i * 60}ms` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ color: m.sender === "user" ? "#A9FF47" : "#00FF66", fontSize: 10, fontWeight: 700 }}>
                  {m.sender === "user" ? "user@local>" : "ai@system>"}
                </span>
                <span style={{ color: "#3D7044", fontSize: 9 }}>[00:{String(i + 1).padStart(2, '0')}:{String((i * 17) % 60).padStart(2, '0')}]</span>
              </div>
              <div style={{ color: m.sender === "user" ? "#C8F7C5" : "#DDFFDA", fontSize: 12, paddingLeft: 14, lineHeight: 1.55, marginTop: 1 }}>
                {m.text}
              </div>
            </div>
          ))}
          <div className="mi" style={{ maxWidth: "100%", animationDelay: "320ms" }}>
            <div style={{ color: "#3D7044", fontSize: 10, marginBottom: 4 }}>// pick a vibe — type number or label</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: "1px dashed #1F2F1F" }}>
              {[["[1]", "temples"], ["[2]", "ramen"], ["[3]", "culture"], ["[4]", "parks"]].map((t, ti) => (
                <div key={ti} className="bc-term" style={{ padding: "6px 10px", borderRight: ti % 2 === 0 ? "1px dashed #1F2F1F" : "none", borderBottom: ti < 2 ? "1px dashed #1F2F1F" : "none", fontSize: 11, cursor: "pointer" }}>
                  <span style={{ color: "#FFB000" }}>{t[0]}</span> <span style={{ color: "#C8F7C5" }}>{t[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "10px 16px", borderTop: "1px dashed #1F2F1F" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#00FF66", fontSize: 11, fontWeight: 700 }}>$</span>
            <input placeholder="type command or message..." className="si" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#C8F7C5", fontSize: 12 }} />
            <span className="term-cursor" style={{ color: "#00FF66", fontSize: 12, fontWeight: 700 }}>█</span>
          </div>
          <div style={{ marginTop: 4, color: "#3D7044", fontSize: 9 }}>// /help · /clear · ⏎ send</div>
        </div>
      </div>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const notes = [
    "ASCII box-drawings (┌─┐ └─┘) frame session context — no rounded borders",
    "`user@local>` / `ai@system>` prefixes replace chat-bubble anatomy entirely",
    "Timestamp format [00:01:17] inline with sender tag — not a separate column",
    "Phosphor green (#00FF66) sole accent — amber (#FFB000) for counts, red for errors",
    "JetBrains Mono only — no secondary typeface anywhere in the system",
    "Blinking █ cursor on active input (1s step-end) — signature motion",
    "Border-radius: 0 everywhere. All borders 1px dashed or solid #1F2F1F",
    "Suggestion chips numbered [1][2][3] — type number to select, not click",
  ];
  return (<div>
    <P>Live implementation of the Terminal design system. Every token, component, and pattern from the spec applied to a working interface. Click sidebar items to see selection state behavior.</P>
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: 1, height: 460, borderRadius: 0, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.45)" }}>
        <TerminalChat sel={sel} setSel={setSel} />
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
   TERMINAL SPEC
   ═══════════════════════════════════════════════════════════════ */
function terminalSpec(a) { return {
  overview: () => (<div>
    <P>Terminal is a CLI-heritage interface aesthetic built on a single monospace typeface, phosphor-green accents on near-black surfaces, and ASCII box-drawing characters as the only structural decoration. Every visual affordance is something you could type into a real shell.</P>
    <P>The system's identity comes from its honesty — no gradients, no shadows, no bubbles, no transitions longer than 150ms. Hierarchy is communicated through prefix characters (<code>$</code>, <code>&gt;</code>, <code>//</code>), indentation, and color temperature within the green-to-amber-to-red spectrum.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[
        ["Typeable hierarchy","Every visual indicator corresponds to a character you could type: > for active, $ for prompt, // for comments, [n] for selection. No abstract UI-only symbols."],
        ["Monospace is the grid","JetBrains Mono is the only font family. Column alignment replaces grid systems. Everything snaps to character widths — there is no intermediate spacing scale."],
        ["Color as signal, not decoration","Phosphor green = standard. Amber = attention/count. Red = error. Muted greens (#3D7044, #5EAA66) = metadata. Never decorative, always diagnostic."],
        ["Box-drawings as chrome","Structural borders use ┌ ─ ┐ │ └ ┘ characters. Solid CSS borders are dashed #1F2F1F when used at all. This is the single strongest identity moment."],
      ].map(([t, d], i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div>
          <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div>
        </div>))}
    </div>
    <H3>When to Use Terminal</H3>
    <Do>Developer tools, devops consoles, data-dense dashboards, admin panels, agentic/keyboard-driven interfaces, logs &amp; observability</Do>
    <Do>Products that celebrate power-user efficiency over discoverability</Do>
    <Dont>Consumer onboarding, marketing pages, or first-time-user flows</Dont>
    <Dont>Emotional / expressive moments — Terminal is deliberately affectless</Dont>
  </div>),

  color: () => (<div>
    <P>Terminal uses a phosphor-heritage palette. Near-black surfaces, a narrow band of greens for content, amber for attention, red for error. Every color has a diagnostic meaning — no purely decorative hues.</P>
    <H3>Background Surfaces</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#0A0F0A" n="Page" v="#0A0F0A" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#111811" n="Surface" v="#111811" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#151D15" n="Elevated" v="#151D15" b="1px solid rgba(255,255,255,0.15)" />
      <Sw c="#1F2F1F" n="Border" v="#1F2F1F" />
      <Sw c="#000000" n="Void" v="#000000" b="1px solid rgba(255,255,255,0.15)" />
    </div>
    <H3>Phosphor Greens (Primary Spectrum)</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#C8F7C5" n="Text Primary" v="#C8F7C5" />
      <Sw c="#DDFFDA" n="Text AI Output" v="#DDFFDA" />
      <Sw c="#00FF66" n="Accent / Prompt" v="#00FF66" />
      <Sw c="#A9FF47" n="Accent Alt / User Tag" v="#A9FF47" />
      <Sw c="#5EAA66" n="Text Secondary" v="#5EAA66" />
      <Sw c="#3D7044" n="Text Muted" v="#3D7044" />
    </div>
    <H3>Signal Colors</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      <Sw c="#FFB000" n="Amber / Count" v="#FFB000" />
      <Sw c="#FF4E4E" n="Red / Error" v="#FF4E4E" />
      <Sw c="#4EB3FF" n="Blue / Link" v="#4EB3FF" />
    </div>
    <Do>Use amber <code>#FFB000</code> only for counts, warnings, and attention indicators</Do>
    <Do>Use red <code>#FF4E4E</code> only for errors, destructive actions, failed states</Do>
    <Dont>Use colors outside the palette — especially no purples, pinks, or gradients</Dont>
    <Dont>Use pure white (#FFFFFF) — text primary is off-white-green (#C8F7C5)</Dont>
    <H3>Contrast Ratios</H3>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Text primary on Page","15.2:1","AAA"],["Accent green on Page","14.1:1","AAA"],["Text secondary on Page","7.8:1","AAA"],["Text muted on Page","4.6:1","AA"],["Amber on Page","11.9:1","AAA"],["Red on Page","6.7:1","AA"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 55px", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: r[2].includes("AAA") ? "#34D399" : "#FBBF24" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  typography: () => (<div>
    <P>Terminal uses a single monospace family for the entire system. There is no secondary typeface, no editorial escape hatch, no serif fallback. Typography is the grid.</P>
    <H3>Font Family</H3>
    <div style={{ padding: 14, borderRadius: 0, border: `1px solid ${a}30`, background: `${a}04`, marginBottom: 12 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, color: a, marginBottom: 4, fontWeight: 700 }}>JetBrains Mono</div>
      <div style={{ fontSize: 10, fontWeight: 600, color: a, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>The only family</div>
      <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Used for navigation, body text, headings, timestamps, prompts, commands, metadata, and labels. Zero exceptions. Alternatives in fallback order: Berkeley Mono → IBM Plex Mono → Menlo → Courier.</div>
    </div>
    <Do>Use weight and color to distinguish hierarchy (700 for prompts, 400 for body, 500 for labels)</Do>
    <Dont>Introduce a secondary sans or serif family for "warmth" — Terminal is affectless on purpose</Dont>
    <Dont>Use italic — monospace italic variants render poorly and read as glitch</Dont>
    <H3>Type Scale</H3>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["display","14px","700","1.3","0","Session headers, brand"],["body","12px","400","1.55","0","Message text"],["label","11px","700","1.3","0","Session names, prompts"],["meta","10px","400","1.4","0","Timestamps, file paths"],["micro","9px","600","1.4","0.08em","Status tags (LIVE, TYPING)"],["comment","10px","400","1.4","0","// prefixed secondaries"]].map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 48px 42px 38px 50px 1fr", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>
          {t.slice(1).map((v, vi) => <span key={vi} style={{ fontSize: 10, color: vi < 4 ? "#999" : "#666" }}>{v}</span>)}
        </div>))}
    </div>
    <H3>Prefix Convention</H3>
    <P>Terminal replaces icon affordances with typeable character prefixes. This is the core typographic grammar of the system.</P>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["$","Shell prompt — input fields, user actions","#00FF66"],[">","AI / system output, selected state","#00FF66"],["<","User-originated message (alternative form)","#A9FF47"],["//","Comment / secondary metadata","#3D7044"],["[n]","Numbered selection (chips, menus)","#FFB000"],["●","Active status indicator","#FFB000"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "50px 1fr", padding: "6px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <code className="mn" style={{ fontSize: 13, color: r[2], fontWeight: 700 }}>{r[0]}</code>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[1]}</span>
        </div>))}
    </div>
  </div>),

  elevation: () => (<div>
    <P>Terminal has no elevation system in the conventional sense. There are no shadows, no blurs, no translucency, and border-radius is 0 everywhere. Depth is communicated through prefix characters, indentation, and color temperature.</P>
    <H3>Border Tokens</H3>
    <Tk n="border.width.default" v="1px" d="All component boundaries" a={a} />
    <Tk n="border.style.default" v="dashed" d="Dashed borders for soft boundaries — signature" a={a} />
    <Tk n="border.style.strong" v="solid" d="Reserved for focus / error states" a={a} />
    <Tk n="border.color.default" v="#1F2F1F" d="Dark green-black, low contrast" a={a} />
    <Tk n="border.color.accent" v="#00FF66" d="Phosphor green — focus + active" a={a} />
    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
      {[{ r: 0, l: "All elements", t: "radius.none" }].map(item => (
        <div key={item.t} style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: item.r, border: `2px solid ${a}55`, background: "rgba(255,255,255,0.02)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <code className="mn" style={{ fontSize: 9, color: "#999" }}>{item.r}px</code>
          </div>
          <div style={{ fontSize: 9.5, color: "#CCC", fontWeight: 600 }}>{item.l}</div>
          <code className="mn" style={{ fontSize: 8.5, color: "#666" }}>{item.t}</code>
        </div>))}
    </div>
    <H3>ASCII Box-Drawings (Structural Chrome)</H3>
    <P>Terminal's signature elevation moment is ASCII box-drawings rendered as text, not CSS borders. They frame sessions, contexts, and grouped content.</P>
    <div style={{ padding: "12px 14px", border: "1px dashed #1F2F1F", background: "rgba(0,255,102,0.03)", marginBottom: 10 }}>
      <pre className="mn" style={{ fontSize: 10, color: "#5EAA66", lineHeight: 1.4, margin: 0 }}>{`┌─ SESSION · tokyo_trip · active ─┐
│  Tokyo Trip — 4 exchanges       │
└─────────────────────────────────┘`}</pre>
    </div>
    <Do>Use ┌─┐ └─┘ characters for session / context framing</Do>
    <Do>Use ─── as full-width dividers inside box-drawn frames</Do>
    <Dont>Use box-shadow, drop-shadow, filter: blur, or backdrop-filter — ever</Dont>
    <Dont>Use border-radius greater than 0 for any element</Dont>
  </div>),

  components: () => (<div>
    <P>Each component specifies anatomy, behavioral contract, exact token values, and do/don't rules. Click to expand.</P>
    <CBox title="MessageLine" parts={["prefix", "sender-tag", "timestamp", "body"]} accent={a}
      contract="Replace chat-bubble anatomy with prefixed text. Must visually distinguish user (yellow-green #A9FF47) from AI (phosphor #00FF66) via the sender-tag color. Must render timestamp inline, not above or beside."
      specs={[["font-family", "'JetBrains Mono'"], ["body.font-size", "12px"], ["body.color.user", "#C8F7C5"], ["body.color.ai", "#DDFFDA"], ["body.line-height", "1.55"], ["body.padding-left", "14px", "Indents under prefix"], ["sender-tag.font-size", "10px"], ["sender-tag.font-weight", "700"], ["user.prefix", "'user@local>'"], ["ai.prefix", "'ai@system>'"], ["timestamp.format", "'[HH:MM:SS]'"], ["timestamp.color", "#3D7044"]]}
      dos={["Use the prefix format 'sender@scope>' — shell-login convention", "Keep timestamps inline with the sender tag, not as separate metadata columns"]}
      donts={["Wrap messages in bordered containers — no chat bubbles ever", "Right-align user messages — both senders left-align; distinction is by prefix + color"]} />

    <CBox title="SidebarItem" parts={["selection-marker", "name", "unread-count", "timestamp", "preview"]} accent={a}
      contract="Single selection via '>' marker character (not background fill). Must truncate preview with ellipsis. Unread count rendered as [n] in amber."
      specs={[["padding", "5px 14px"], ["selection-marker.char", "'>'"], ["selection-marker.color", "#00FF66"], ["unselected-marker", "' '", "Empty space, maintains alignment"], ["name.font-size", "11px"], ["name.color.selected", "#C8F7C5"], ["name.color.unselected", "#5EAA66"], ["unread.format", "'[n]'"], ["unread.color", "#FFB000"], ["preview.prefix", "'// '"], ["preview.color", "#3D7044"]]}
      dos={["Use '>' prefix character for selection — not a left bar or background fill", "Render unread counts as [2], [1] in amber — bracket notation is signature"]}
      donts={["Use background-color fills for selection (that's Sketch / Swiss pattern)", "Show avatars — Terminal does not have user avatars, only text"]} />

    <CBox title="TextInput" parts={["prompt", "input", "cursor", "hint"]} accent={a}
      contract="Must display '$' prompt prefix. Must show a blinking █ cursor after the input value. Must include a /command hint line below."
      specs={[["padding", "10px 16px"], ["prompt.char", "'$'"], ["prompt.color", "#00FF66"], ["prompt.font-weight", "700"], ["input.font-size", "12px"], ["input.color", "#C8F7C5"], ["cursor.char", "'█'"], ["cursor.animation", "blink 1s step-end infinite"], ["hint.format", "'// /help · /clear · ⏎ send'"], ["hint.color", "#3D7044"], ["hint.font-size", "9px"]]}
      dos={["Show the blinking █ cursor only when input is focused", "Support slash commands (/help, /clear) alongside regular input"]}
      donts={["Render a send button as a separate clickable element — use '⏎ send' hint instead", "Use placeholder text that looks like commands ('Type message') — use '...' or blank"]} />

    <CBox title="SessionHeader" parts={["top-rule", "title-line", "bottom-rule", "status-pill"]} accent={a}
      contract="Must render ASCII box-drawing top and bottom rules. Title line shows session name and exchange count. Optional LIVE status pill in amber."
      specs={[["top-rule.format", "'┌─ SESSION · <name> · <state> ─┐'"], ["rule.color", "#5EAA66"], ["title.color", "#C8F7C5"], ["exchange-count.prefix", "'// '"], ["exchange-count.color", "#3D7044"], ["status-pill.format", "'● LIVE'"], ["status-pill.color", "#FFB000"], ["status-pill.font-size", "9px"], ["status-pill.letter-spacing", "0.08em"]]}
      dos={["Use literal ┌─┐ characters — this is the signature chrome moment", "Include exchange count in the title line as '// N exchanges'"]}
      donts={["Replace the box-drawings with CSS borders — defeats the identity", "Add an icon/avatar next to the title — Terminal has no icons"]} />

    <CBox title="SuggestionGrid" parts={["comment-intro", "numbered-cells", "dashed-frame"]} accent={a}
      contract="Render suggestion options as numbered [1]-[4] cells in a 2×2 grid with dashed borders. Introduced by a '//' comment line."
      specs={[["intro.prefix", "'// '"], ["intro.color", "#3D7044"], ["grid.columns", "2"], ["grid.frame", "1px dashed #1F2F1F"], ["cell.padding", "6px 10px"], ["cell.number.format", "'[1]', '[2]', etc."], ["cell.number.color", "#FFB000"], ["cell.label.color", "#C8F7C5"], ["selection-method", "Type number key OR click"]]}
      dos={["Number options [1] [2] [3] [4] — enables keyboard selection", "Use dashed borders for the grid frame — signature soft chrome"]}
      donts={["Use more than 4 options — Terminal grids cap at 2×2", "Use emoji as primary label — numbered text is the Terminal convention"]} />

    <CBox title="StatusIndicator" parts={["dot-char", "label"]} accent={a}
      contract="Render status as a Unicode bullet (●) followed by an uppercase tracked label. Color communicates state."
      specs={[["dot.char", "'●'"], ["label.text-transform", "uppercase"], ["label.letter-spacing", "0.08em"], ["label.font-size", "9px"], ["label.font-weight", "700"], ["states", "LIVE (#FFB000) · IDLE (#5EAA66) · ERROR (#FF4E4E)"]]}
      dos={["Use ● character for status bullets, not colored div circles"]}
      donts={["Use background-pill containers around status — use color + character only"]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Terminal layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width", "260px fixed"], ["Main area", "Fluid, fills remaining"], ["Sidebar order", "Prompt brand → Search → // sessions → List → $ whoami"], ["Vertical divider", "1px solid #1F2F1F"], ["Background", "#0A0F0A for both panes"]] },
      { n: "Message Flow", rows: [["Direction", "Vertical stack, chronological"], ["Alignment", "ALL messages left-aligned — distinction via prefix color"], ["Max width", "100% (no indent)"], ["Gap", "12px between messages"], ["Entrance", "fadeSlideUp, 250ms linear, 60ms stagger"], ["Metadata", "Inline with sender tag — never below or right"]] },
      { n: "Active Selection", rows: [["Model", "Single selection only"], ["Trigger", "Click or keyboard number [1-9]"], ["Visual", "'>' marker character prepended, name color shift"], ["Transition", "Instant — no animation"], ["Focus outline", "2px solid #00FF66"]] },
      { n: "Search / Input", rows: [["Prompt prefix", "$ grep (search) / $ (input)"], ["Cursor", "Blinking █, 1s step-end"], ["Placeholder", "'...' or empty — never descriptive"], ["Keyboard", "/commands supported alongside text"]] },
    ].map((p, pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4>
      <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        {p.rows.map((r, ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "130px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
        </div>))}
      </div>
    </div>))}
  </div>),

  extensions: () => (<div>
    <H3>1. Prefix Grammar</H3>
    <P>Terminal's defining feature. Every piece of UI is prefixed with a typeable character that signals its role. This replaces icons, chevrons, bullets, and most decorative UI entirely.</P>
    <Tk n="shell prompt" v="'$'" d="Input fields, actionable lines" a={a} />
    <Tk n="output pointer" v="'>'" d="AI messages, selected state" a={a} />
    <Tk n="user input" v="'<'" d="Alternative user-message prefix" a={a} />
    <Tk n="comment" v="'//'" d="Secondary metadata, hints" a={a} />
    <Tk n="selection" v="'[n]'" d="Numbered options, counts" a={a} />
    <Tk n="status dot" v="'●'" d="Live / idle / error state" a={a} />
    <H4>Vocabulary &amp; Tone</H4>
    <P>Language should feel like man-page or README text — declarative, lowercase, no hedging, no exclamation points. Read as if it could be piped through grep.</P>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <div style={{ padding: "10px 12px", borderRadius: 0, border: "1px solid rgba(52,211,153,0.12)", background: "rgba(52,211,153,0.04)" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#34D399", marginBottom: 5 }}>GOOD COPY</div>
        {["$ search sessions", "// 4 exchanges · connected", "> type command or message...", "[1] temples  [2] ramen", "// /help · /clear · ⏎ send", "● LIVE"].map(x => <div key={x} className="mn" style={{ fontSize: 11, color: "#C8F7C5", marginBottom: 2 }}>{x}</div>)}
      </div>
      <div style={{ padding: "10px 12px", borderRadius: 0, border: "1px solid rgba(255,107,107,0.12)", background: "rgba(255,107,107,0.04)" }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: "#FF6B6B", marginBottom: 5 }}>BAD COPY</div>
        {["Search your chats!", "You have 4 new messages", "What can I help with?", "Pick an option below:", "Click send to continue", "🔴 Live"].map(x => <div key={x} className="mn" style={{ fontSize: 11, color: "#FF6B6B", marginBottom: 2, textDecoration: "line-through", opacity: 0.6 }}>{x}</div>)}
      </div>
    </div>

    <H3>2. ASCII Box-Drawing Chrome</H3>
    <P>Box-drawing Unicode characters (U+2500 range) replace CSS-drawn borders for session framing and context isolation. This is the single most distinct visual moment of the system.</P>
    <Tk n="characters" v="┌ ─ ┐ │ └ ┘ ┏ ┓ ╭ ╮ ╰ ╯" d="U+2500 to U+257F range" a={a} />
    <Tk n="usage" v="Session headers, quote blocks" a={a} />
    <Tk n="color" v="#5EAA66 or #3D7044" d="Secondary greens" a={a} />
    <Tk n="CSS alternative" v="1px dashed #1F2F1F" d="When Unicode unavailable" a={a} />
    <Do>Use ┌─┐ └─┘ for major session framing — replaces traditional card borders</Do>
    <Do>Use ───── as full-width dividers between sections</Do>
    <Dont>Mix CSS borders and ASCII box-drawings in the same container</Dont>
    <Dont>Use heavy-weight variants (┏┓┗┛) for decorative effect — reserve for error states</Dont>

    <H3>3. Blinking Cursor</H3>
    <P>The only allowed motion in Terminal. A solid block character (█) that blinks in a step-end rhythm on active input fields. 1-second cycle, no easing — CSS animation must use <code>step-end</code> timing.</P>
    <Tk n="character" v="'█' (U+2588)" a={a} />
    <Tk n="animation" v="blink 1s step-end infinite" a={a} />
    <Tk n="keyframes" v="0%,50%: opacity 1; 51%,100%: opacity 0" a={a} />
    <Tk n="color" v="#00FF66" d="Phosphor green — never other colors" a={a} />
    <Tk n="scope" v="Active/focused input only" a={a} />
    <Do>Show cursor only when input is focused — never as persistent decoration</Do>
    <Dont>Use ease-in-out timing — cursors must hard-flip, not fade</Dont>

    <H3>4. Keyboard-First Interaction</H3>
    <P>Every action reachable via keyboard. Numbered options [1-9] map to number keys. Slash commands (/help, /clear, /new) map to typed input. Click is supported but secondary.</P>
    <Tk n="selection.keys" v="1-9" d="Selects corresponding [n] item" a={a} />
    <Tk n="command.prefix" v="'/'" d="Triggers command mode" a={a} />
    <Tk n="commands" v="/help /clear /new /search" a={a} />
    <Tk n="send" v="⏎ (Enter)" d="No Cmd+Enter variant" a={a} />
    <Do>Support every click action with a keyboard equivalent</Do>
    <Do>Advertise keyboard shortcuts inline in hint text (// /help · /clear)</Do>
    <Dont>Require the mouse for any primary action — accessibility rule</Dont>
  </div>),

  voice: () => (<div>
    <P>Terminal speaks the way a shell does — declarative, lowercase, no emotional framing, no hedging. Microcopy should read as if it could be output by a program.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Declarative", "Lowercase", "Dry", "Functional"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never cheerful", "Never apologetic"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>
    <H3>Placeholder &amp; State Text</H3>
    <div style={{ borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Chat input", "type command or message...", "Lowercase, ends in '...'"],
        ["Search", "...", "Empty or three-dot only"],
        ["Empty chat list", "// no sessions found", "'//' comment form"],
        ["Loading state", "// working...", "Comment form, no spinner"],
        ["Error state", "error: connection refused", "Lowercase 'error:' prefix"],
        ["Success state", "ok", "Single word, no punctuation"],
      ].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "130px 1fr 1fr", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <code className="mn" style={{ fontSize: 10.5, color: "#C8F7C5" }}>{p[1]}</code>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>))}
    </div>
    <H3>Conventions</H3>
    <Do>Lowercase everything. Title case only for proper nouns inside content.</Do>
    <Do>Use ellipses for incomplete states; single words ('ok', 'done', 'fail') for terminal states.</Do>
    <Do>Reach for Unix vocabulary: 'grep', 'session', 'connection', 'exit', 'piped'.</Do>
    <Dont>Use sentence-case or title-case UI chrome. No "Welcome Back" or "Click Send".</Dont>
    <Dont>Use exclamation points. Ever.</Dont>
    <Dont>Apologize for errors ('Oops!', 'Sorry!'). State what failed.</Dont>
    <H3>Symbol Vocabulary</H3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {[["$", "Shell prompt, active input"], [">", "AI output, selected row"], ["//", "Comment, secondary info"], ["[n]", "Numbered selection"], ["●", "Status indicator"], ["█", "Cursor (active input only)"], ["⏎", "Send / confirm key"], ["┌─┐", "Session framing chrome"], ["─", "Divider, full-width"]].map(([s, u]) => (
        <div key={s} style={{ padding: "6px 8px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.05)" }}>
          <code className="mn" style={{ fontSize: 13, color: a, fontWeight: 700 }}>{s}</code>
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
  const spec = terminalSpec(TM.color);
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
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
        .ci:hover { background: rgba(0,255,102,0.04) }
        .bc-term:hover { background: rgba(0,255,102,0.08) !important }
        .term-cursor { animation: blink 1s step-end infinite }
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
