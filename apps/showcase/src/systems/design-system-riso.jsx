import { useState, useEffect, useCallback, useContext, createContext, useId } from "react";
import portrait1 from "../../images/portraits/pexels-isabel-ponce-2161054782-37185454.jpg";
import portrait2 from "../../images/portraits/pexels-esrakorkmaz-17191688.jpg";
import portrait3 from "../../images/portraits/pexels-matvalina-16059612.jpg";
import portrait4 from "../../images/portraits/pexels-enesbeydilli-26733191.jpg";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — RISO
   Duotone Print + Tweakable Press · Single-theme standalone spec + live preview
   Includes an in-preview tweak panel with Paper + Ink selectors and sliders
   for registration, halftone, grain, ink bleed, and type tremor.
   Images are filtered through SVG feColorMatrix duotone + ghost filters so
   every press setting also applies to photographs.
   ═══════════════════════════════════════════════════════════════ */

const portraits = [
  { src: portrait1, alt: "Portrait 01", credit: "Isabel Ponce · Pexels" },
  { src: portrait2, alt: "Portrait 02", credit: "Esra Korkmaz · Pexels" },
  { src: portrait3, alt: "Portrait 03", credit: "Mat Valina · Pexels" },
  { src: portrait4, alt: "Portrait 04", credit: "Enes Beydilli · Pexels" },
];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16) / 255,
    g: parseInt(h.substring(2, 4), 16) / 255,
    b: parseInt(h.substring(4, 6), 16) / 255,
  };
}

const TM = { name: "Riso", tag: "Duotone Print + Tweakable Press", color: "#FF48B0" };

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

/* ═══════════════════════════════════════════════════════════════
   PAPER + INK PRESETS — bundled parameter sets
   ═══════════════════════════════════════════════════════════════ */
const paperPresets = {
  cream:     { label: "Cream",     paper: "#F4EFE4", blend: "multiply",   density: 0.92, textInk: "#1A1614" },
  kraft:     { label: "Kraft",     paper: "#D4BE94", blend: "multiply",   density: 0.85, textInk: "#2A1F12" },
  white:     { label: "White",     paper: "#FDFCF8", blend: "multiply",   density: 0.98, textInk: "#151515" },
  gray:      { label: "Gray",      paper: "#BFBDB5", blend: "darken",     density: 0.82, textInk: "#141414" },
  newsprint: { label: "Newsprint", paper: "#E4DCC9", blend: "color-burn", density: 0.78, textInk: "#2B2620" },
};

const inkPresets = {
  classic:  { label: "Blue + Pink",   c1: "#3255A4", c2: "#FF48B0" },
  electric: { label: "Pink + Green",  c1: "#FF48B0", c2: "#00A95C" },
  sunset:   { label: "Red + Yellow",  c1: "#FF665E", c2: "#E8C700" },
  forest:   { label: "Teal + Green",  c1: "#00838F", c2: "#00A95C" },
  spritz:   { label: "Blue + Yellow", c1: "#3255A4", c2: "#E8C700" },
  ink:      { label: "Black + Pink",  c1: "#1A1A1A", c2: "#FF48B0" },
};

const tweakDefaults = {
  paperKey: "cream",
  inkKey: "classic",
  offsetX: 2,
  offsetY: -1,
  dotSize: 6,
  dotAngle: 15,
  dotSoftness: 0.35,
  grainAmount: 0.35,
  grainFrequency: 1.2,
  inkBleed: 0.3,
  tremor: 0.5,
};

/* ═══════════════════════════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════════════════════════ */
const RisoContext = createContext(null);

/* ═══════════════════════════════════════════════════════════════
   SHARED HELPERS (match dark-spec chrome from original)
   ═══════════════════════════════════════════════════════════════ */
const Tk = ({ n, v, d, a = "#999" }) => <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" }}><code className="mn" style={{ fontSize: 10, color: "#CCC", minWidth: 170 }}>{n}</code><code className="mn" style={{ fontSize: 10, color: a, minWidth: 120 }}>{v}</code>{d && <span style={{ fontSize: 9.5, color: "#555" }}>{d}</span>}</div>;
const Sw = ({ c, n, v, b }) => <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}><div style={{ width: 24, height: 24, borderRadius: 0, background: c, border: b || "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }} /><div><div style={{ fontSize: 10.5, fontWeight: 600, color: "#CCC" }}>{n}</div><code className="mn" style={{ fontSize: 9, color: "#666" }}>{v}</code></div></div>;
const H3 = ({ children }) => <h3 style={{ fontSize: 13, fontWeight: 700, color: "#EEE", margin: "22px 0 10px", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{children}</h3>;
const H4 = ({ children }) => <h4 style={{ fontSize: 11.5, fontWeight: 600, color: "#CCC", margin: "16px 0 6px" }}>{children}</h4>;
const P = ({ children }) => <p style={{ fontSize: 12, color: "#999", lineHeight: 1.6, margin: "0 0 10px" }}>{children}</p>;
const Do = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 4, marginBottom: 4, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#34D399", flexShrink: 0 }}>✓</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Dont = ({ children }) => <div style={{ display: "flex", gap: 6, padding: "6px 10px", borderRadius: 4, marginBottom: 4, background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.12)" }}><span style={{ fontSize: 10, fontWeight: 700, color: "#FF6B6B", flexShrink: 0 }}>✗</span><span style={{ fontSize: 10.5, color: "#BBB", lineHeight: 1.4 }}>{children}</span></div>;
const Pill = ({ children, color }) => <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 0, background: `${color}10`, border: `1px solid ${color}25`, color, fontWeight: 600 }}>{children}</span>;

const CBox = ({ title, parts, contract, specs, dos, donts, accent }) => {
  const [open, setOpen] = useState(false);
  return (<div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.07)", marginBottom: 8 }}>
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
   RISO PROVIDER — maps tweak state to CSS custom properties
   ═══════════════════════════════════════════════════════════════ */
function RisoProvider({ children, tweaks, setTweaks }) {
  const paper = paperPresets[tweaks.paperKey];
  const ink = inkPresets[tweaks.inkKey];
  const rawId = useId();
  const safeId = rawId.replace(/:/g, "-");
  const filterPrimary = `${safeId}-duo-primary`;
  const filterGhost = `${safeId}-duo-ghost`;
  const vars = {
    "--riso-paper":        paper.paper,
    "--riso-text":         paper.textInk,
    "--riso-ink-1":        ink.c1,
    "--riso-ink-2":        ink.c2,
    "--riso-blend":        paper.blend,
    "--riso-ink-density":  String(paper.density),
    "--riso-off-x":        `${tweaks.offsetX}px`,
    "--riso-off-y":        `${tweaks.offsetY}px`,
    "--riso-ht-size":      `${tweaks.dotSize}px`,
    "--riso-ht-angle":     `${tweaks.dotAngle}deg`,
    "--riso-ht-softness":  String(tweaks.dotSoftness),
    "--riso-grain-amount": String(tweaks.grainAmount),
    "--riso-bleed":        `${tweaks.inkBleed}px`,
    "--riso-tremor":       `${tweaks.tremor}px`,
  };
  return (
    <RisoContext.Provider value={{ tweaks, setTweaks, paper, ink, filterPrimary, filterGhost }}>
      <div style={{ ...vars, background: "var(--riso-paper)", color: "var(--riso-text)", position: "relative", width: "100%" }}>
        <RisoFilters primaryId={filterPrimary} ghostId={filterGhost} ink={ink} paper={paper} />
        {children}
      </div>
    </RisoContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SVG FILTERS — duotone + ghost feColorMatrix filters for images
   ═══════════════════════════════════════════════════════════════ */
function RisoFilters({ primaryId, ghostId, ink, paper }) {
  const c1 = hexToRgb(ink.c1);
  const p  = hexToRgb(paper.paper);
  const c2 = hexToRgb(ink.c2);

  // Primary duotone: linearly interpolate from ink-1 (shadows) to paper (highlights)
  // along Rec.709 luminance. output_R = Δr·luminance + c1.r, etc.
  const dr = p.r - c1.r, dg = p.g - c1.g, db = p.b - c1.b;
  const duotoneMatrix = [
    `${0.2126 * dr} ${0.7152 * dr} ${0.0722 * dr} 0 ${c1.r}`,
    `${0.2126 * dg} ${0.7152 * dg} ${0.0722 * dg} 0 ${c1.g}`,
    `${0.2126 * db} ${0.7152 * db} ${0.0722 * db} 0 ${c1.b}`,
    `0 0 0 1 0`,
  ].join(" ");

  // Ghost / second-ink mask: flat ink-2 color with alpha = 1 - luminance
  // (so ink-2 only reveals in shadow areas; highlights go transparent)
  const ghostMatrix = [
    `0 0 0 0 ${c2.r}`,
    `0 0 0 0 ${c2.g}`,
    `0 0 0 0 ${c2.b}`,
    `${-0.2126} ${-0.7152} ${-0.0722} 0 1`,
  ].join(" ");

  return (
    <svg aria-hidden style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}>
      <defs>
        <filter id={primaryId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={duotoneMatrix} />
        </filter>
        <filter id={ghostId} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={ghostMatrix} />
        </filter>
      </defs>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RISO PRIMITIVES
   ═══════════════════════════════════════════════════════════════ */
function DuotoneText({ children, size = 14, weight = 500, style = {}, ink = 1 }) {
  const primaryColor = ink === 1 ? "var(--riso-ink-1)" : "var(--riso-ink-2)";
  const shadowColor = ink === 1 ? "var(--riso-ink-2)" : "var(--riso-ink-1)";
  return (
    <span style={{ position: "relative", display: "inline-block", color: primaryColor, fontSize: size, fontWeight: weight, lineHeight: 1, ...style }}>
      <span style={{ position: "relative", zIndex: 2 }}>{children}</span>
      <span aria-hidden style={{
        position: "absolute", left: 0, top: 0, width: "100%",
        color: shadowColor,
        mixBlendMode: "var(--riso-blend)",
        opacity: "var(--riso-ink-density)",
        transform: "translate(var(--riso-off-x), var(--riso-off-y))",
        pointerEvents: "none",
        zIndex: 1,
      }}>{children}</span>
    </span>
  );
}

function HalftoneStrip({ height = 14, ink = 1, opacity = 1, style = {} }) {
  const color = ink === 1 ? "var(--riso-ink-1)" : "var(--riso-ink-2)";
  return (
    <div style={{
      height,
      width: "100%",
      overflow: "hidden",
      opacity: `calc(var(--riso-ink-density) * ${opacity})`,
      mixBlendMode: "var(--riso-blend)",
      position: "relative",
      ...style,
    }}>
      <div style={{
        position: "absolute",
        inset: "-50%",
        backgroundImage: `radial-gradient(circle, ${color} calc(35% - (var(--riso-ht-softness) * 15%)), transparent calc(36% + (var(--riso-ht-softness) * 15%)))`,
        backgroundSize: "var(--riso-ht-size) var(--riso-ht-size)",
        transform: "rotate(var(--riso-ht-angle))",
        filter: "blur(var(--riso-bleed))",
      }} />
    </div>
  );
}

function InkTag({ children, ink = 1, size = 9 }) {
  const color = ink === 1 ? "var(--riso-ink-1)" : "var(--riso-ink-2)";
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: size,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      fontWeight: 700,
      color,
      mixBlendMode: "var(--riso-blend)",
      opacity: "var(--riso-ink-density)",
    }}>{children}</span>
  );
}

function GrainLayer() {
  const ctx = useContext(RisoContext);
  const tweaks = ctx?.tweaks ?? tweakDefaults;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${tweaks.grainFrequency}' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>`;
  const encoded = encodeURIComponent(svg);
  return (
    <div aria-hidden style={{
      position: "absolute", inset: 0,
      pointerEvents: "none",
      opacity: tweaks.grainAmount,
      mixBlendMode: "overlay",
      backgroundImage: `url("data:image/svg+xml;charset=utf8,${encoded}")`,
      backgroundSize: "220px 220px",
      zIndex: 100,
    }} />
  );
}

function RisoImage({ src, alt = "", width = 260, aspectRatio = "4/5", style = {} }) {
  const ctx = useContext(RisoContext);
  const { filterPrimary, filterGhost } = ctx || {};
  return (
    <div style={{
      position: "relative",
      width,
      aspectRatio,
      overflow: "hidden",
      filter: "blur(calc(var(--riso-bleed) * 0.5))",
      mixBlendMode: "var(--riso-blend)",
      opacity: "var(--riso-ink-density)",
      flexShrink: 0,
      ...style,
    }}>
      {/* Primary duotone layer — shadows=ink-1, highlights=paper */}
      <img src={src} alt={alt} style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        filter: `url(#${filterPrimary})`,
        display: "block",
      }} />
      {/* Ghost / secondary-ink misregistration layer */}
      <img src={src} alt="" aria-hidden style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        filter: `url(#${filterGhost})`,
        transform: "translate(var(--riso-off-x), var(--riso-off-y))",
        mixBlendMode: "multiply",
        display: "block",
      }} />
      {/* Halftone texture overlay — dot pitch + softness driven by same tweaks */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        pointerEvents: "none",
        backgroundImage: `radial-gradient(circle, rgba(0,0,0,0.38) calc(28% - (var(--riso-ht-softness) * 14%)), transparent calc(30% + (var(--riso-ht-softness) * 14%)))`,
        backgroundSize: "var(--riso-ht-size) var(--riso-ht-size)",
        mixBlendMode: "overlay",
        opacity: 0.45,
      }} />
    </div>
  );
}

function PortraitCarousel({ portraits: list }) {
  const [idx, setIdx] = useState(0);
  const prev = () => setIdx((idx - 1 + list.length) % list.length);
  const next = () => setIdx((idx + 1) % list.length);
  const current = list[idx];
  return (
    <div style={{
      padding: "20px 24px 22px",
      borderTop: "1px solid rgba(0,0,0,0.15)",
      position: "relative",
      overflow: "hidden",
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <InkTag ink={2}>Portrait Series</InkTag>
          <InkTag size={8.5}>№{String(idx + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}</InkTag>
        </div>
        <InkTag size={8.5}>{current.credit}</InkTag>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, justifyContent: "center" }}>
        <button onClick={prev} className="riso-nav-btn" aria-label="Previous portrait">
          <InkTag ink={1} size={10}>← prev</InkTag>
        </button>
        <RisoImage src={current.src} alt={current.alt} width={260} aspectRatio="4/5" />
        <button onClick={next} className="riso-nav-btn" aria-label="Next portrait">
          <InkTag ink={1} size={10}>next →</InkTag>
        </button>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
        {list.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} aria-label={`Go to portrait ${i + 1}`} style={{
            width: 22,
            height: 3,
            background: i === idx ? "var(--riso-ink-2)" : "rgba(0,0,0,0.18)",
            border: "none",
            padding: 0,
            cursor: "pointer",
            mixBlendMode: "var(--riso-blend)",
            opacity: "var(--riso-ink-density)",
          }} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIVE CHAT DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
function RisoChat({ sel, setSel }) {
  return (
    <div className="app-sh riso-shell" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif", borderRadius: 0, border: "1px solid rgba(0,0,0,0.15)", overflow: "hidden", position: "relative" }}>
      {/* Sidebar */}
      <div className="sb" style={{ borderRight: "1px solid rgba(0,0,0,0.15)", position: "relative", zIndex: 2 }}>
        <div style={{ padding: "18px 16px 8px" }}>
          <DuotoneText size={28} weight={700} style={{ letterSpacing: "-0.04em" }}>RISO</DuotoneText>
          <div style={{ marginTop: 6 }}>
            <InkTag ink={2}>Edition №04 · Vol. I</InkTag>
          </div>
        </div>
        <HalftoneStrip height={10} ink={1} style={{ margin: "6px 16px 8px" }} />

        <div style={{ padding: "6px 16px 4px" }}>
          <InkTag size={9}>Recent Issues</InkTag>
        </div>

        <div className="cl">
          {chatList.map((c, i) => (
            <div key={c.id} onClick={() => setSel(c.id)} className="ci" style={{ padding: "10px 16px", cursor: "pointer", borderTop: i === 0 ? "1px solid var(--riso-text)" : "1px solid rgba(0,0,0,0.1)", background: sel === c.id ? "rgba(0,0,0,0.03)" : "transparent", animationDelay: `${i * 60}ms`, position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
                <InkTag size={8.5}>№{String(i + 1).padStart(2, "0")} · {c.time}</InkTag>
                {c.unread > 0 && (
                  <span style={{ padding: "1px 6px", background: "var(--riso-ink-2)", color: "var(--riso-paper)", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.04em", mixBlendMode: "var(--riso-blend)", opacity: "var(--riso-ink-density)" }}>{c.unread}</span>
                )}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: sel === c.id ? 700 : 600, color: "var(--riso-text)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                {sel === c.id ? <DuotoneText size={14} weight={700}>{c.name}</DuotoneText> : c.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--riso-text)", opacity: 0.65, lineHeight: 1.4, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--riso-text)" }}>
          <InkTag size={8.5}>Press Operator</InkTag>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--riso-text)", marginTop: 2 }}>T. Harris</div>
        </div>
      </div>

      {/* Main */}
      <div className="ca" style={{ position: "relative", zIndex: 2 }}>
        <div style={{ padding: "18px 24px 10px", borderBottom: "1px solid var(--riso-text)", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <InkTag ink={2}>Issue №04 · Filed 14:23</InkTag>
            <InkTag ink={1}>● Active</InkTag>
          </div>
          <div style={{ marginTop: 6 }}>
            <DuotoneText size={30} weight={700} style={{ letterSpacing: "-0.03em" }}>Tokyo Trip</DuotoneText>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, color: "var(--riso-text)", opacity: 0.75, marginTop: 6, lineHeight: 1.4, fontStyle: "italic" }}>A printed correspondence on temples, ramen, and the after-hours food scene in Shibuya.</div>
        </div>
        <HalftoneStrip height={12} ink={2} opacity={0.85} style={{ margin: 0 }} />

        <div className="ma" style={{ padding: "18px 24px" }}>
          {msgs.map((m, i) => (
            <div key={m.id} className="mi" style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: m.sender === "user" ? "70%" : "84%", animationDelay: `${i * 80}ms` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", justifyContent: m.sender === "user" ? "flex-end" : "flex-start", marginBottom: 5 }}>
                <InkTag ink={m.sender === "user" ? 2 : 1} size={9}>
                  {m.sender === "user" ? "Reply · T. Harris" : "The Press"}
                </InkTag>
                <InkTag size={8.5}>14:{String(23 + i).padStart(2, "0")}</InkTag>
              </div>
              <div className="riso-body" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: "var(--riso-text)", lineHeight: 1.55, letterSpacing: "-0.005em", filter: "blur(calc(var(--riso-bleed) * 0.4))" }}>
                {m.text}
              </div>
            </div>
          ))}

          <div className="mi" style={{ alignSelf: "flex-start", maxWidth: "100%", animationDelay: "400ms" }}>
            <div style={{ marginBottom: 8 }}><InkTag ink={2}>Sections — 04</InkTag></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 0, borderTop: "1px solid var(--riso-text)", borderLeft: "1px solid var(--riso-text)" }}>
              {[["I", "Temples"], ["II", "Ramen"], ["III", "Culture"], ["IV", "Parks"]].map(([n, l], ti) => (
                <div key={ti} className="bc-riso" style={{ padding: "10px 12px", borderRight: "1px solid var(--riso-text)", borderBottom: "1px solid var(--riso-text)", cursor: "pointer", position: "relative" }}>
                  <InkTag ink={1} size={10}>{n}.</InkTag>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--riso-text)", letterSpacing: "-0.01em", marginTop: 3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid var(--riso-text)", background: "rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <input placeholder="Compose your reply…" className="si riso-input" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, color: "var(--riso-text)", fontStyle: "italic" }} />
            <div className="snd" style={{ cursor: "pointer" }}>
              <InkTag ink={2} size={10}>File Reply →</InkTag>
            </div>
          </div>
        </div>
      </div>

      <GrainLayer />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TWEAK PANEL — in-preview press controls
   ═══════════════════════════════════════════════════════════════ */
function Slider({ label, value, min, max, step, onChange, unit = "" }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: "#CCC", fontWeight: 500 }}>{label}</span>
        <code className="mn" style={{ fontSize: 10, color: "#888" }}>{value}{unit}</code>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: "100%", accentColor: TM.color }} />
    </div>
  );
}

function SegmentedSelect({ label, value, options, onChange, columns = 2 }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#CCC", fontWeight: 500, marginBottom: 5 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 3 }}>
        {options.map(o => (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            padding: "5px 6px",
            fontSize: 9.5,
            fontFamily: "inherit",
            background: value === o.key ? `${TM.color}20` : "rgba(255,255,255,0.02)",
            border: `1px solid ${value === o.key ? TM.color : "rgba(255,255,255,0.08)"}`,
            color: value === o.key ? TM.color : "#AAA",
            cursor: "pointer",
            borderRadius: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
            justifyContent: "flex-start",
          }}>
            {o.swatch && <span style={{ display: "flex", gap: 1, flexShrink: 0 }}>
              {o.swatch.map((c, i) => <span key={i} style={{ width: 6, height: 6, background: c, border: "1px solid rgba(0,0,0,0.15)" }} />)}
            </span>}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TweakGroup({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>{title}</div>
      {children}
    </div>
  );
}

function TweakPanel({ tweaks, setTweaks }) {
  const set = (k, v) => setTweaks({ ...tweaks, [k]: v });
  const randomize = () => {
    setTweaks({
      ...tweaks,
      offsetX: +(Math.random() * 6 - 3).toFixed(1),
      offsetY: +(Math.random() * 6 - 3).toFixed(1),
      dotSize: Math.round(4 + Math.random() * 6),
      dotAngle: [0, 15, 45, 75][Math.floor(Math.random() * 4)],
      grainAmount: +(0.2 + Math.random() * 0.4).toFixed(2),
    });
  };
  const reset = () => setTweaks(tweakDefaults);
  const copyTokens = () => {
    const p = paperPresets[tweaks.paperKey];
    const i = inkPresets[tweaks.inkKey];
    const json = JSON.stringify({ paper: p.paper, ink1: i.c1, ink2: i.c2, blend: p.blend, density: p.density, offsetX: tweaks.offsetX, offsetY: tweaks.offsetY, dotSize: tweaks.dotSize, dotAngle: tweaks.dotAngle, grainAmount: tweaks.grainAmount, bleed: tweaks.inkBleed, tremor: tweaks.tremor }, null, 2);
    try { navigator.clipboard?.writeText(json); } catch (e) { /* no-op */ }
    alert("Tokens copied to clipboard:\n\n" + json);
  };

  const paperOpts = Object.entries(paperPresets).map(([k, v]) => ({ key: k, label: v.label, swatch: [v.paper] }));
  const inkOpts = Object.entries(inkPresets).map(([k, v]) => ({ key: k, label: v.label, swatch: [v.c1, v.c2] }));

  return (
    <div style={{ fontSize: 11, color: "#CCC", fontFamily: "inherit" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Press Settings</div>

      <TweakGroup title="Paper Stock">
        <SegmentedSelect label="Paper" value={tweaks.paperKey} options={paperOpts} onChange={v => set("paperKey", v)} columns={2} />
      </TweakGroup>

      <TweakGroup title="Ink Drums">
        <SegmentedSelect label="Ink Combo" value={tweaks.inkKey} options={inkOpts} onChange={v => set("inkKey", v)} columns={2} />
      </TweakGroup>

      <TweakGroup title="Registration">
        <Slider label="Offset X" value={tweaks.offsetX} min={-4} max={4} step={0.5} onChange={v => set("offsetX", v)} unit="px" />
        <Slider label="Offset Y" value={tweaks.offsetY} min={-4} max={4} step={0.5} onChange={v => set("offsetY", v)} unit="px" />
      </TweakGroup>

      <TweakGroup title="Halftone">
        <Slider label="Dot Size" value={tweaks.dotSize} min={2} max={14} step={1} onChange={v => set("dotSize", v)} unit="px" />
        <Slider label="Angle" value={tweaks.dotAngle} min={0} max={90} step={5} onChange={v => set("dotAngle", v)} unit="°" />
        <Slider label="Softness" value={tweaks.dotSoftness} min={0} max={1} step={0.05} onChange={v => set("dotSoftness", v)} />
      </TweakGroup>

      <TweakGroup title="Grain">
        <Slider label="Amount" value={tweaks.grainAmount} min={0} max={1} step={0.05} onChange={v => set("grainAmount", v)} />
        <Slider label="Frequency" value={tweaks.grainFrequency} min={0.3} max={3} step={0.1} onChange={v => set("grainFrequency", v)} />
      </TweakGroup>

      <TweakGroup title="Ink">
        <Slider label="Bleed" value={tweaks.inkBleed} min={0} max={2} step={0.1} onChange={v => set("inkBleed", v)} unit="px" />
      </TweakGroup>

      <TweakGroup title="Type">
        <Slider label="Tremor" value={tweaks.tremor} min={0} max={3} step={0.1} onChange={v => set("tremor", v)} unit="px" />
      </TweakGroup>

      <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
        <button onClick={randomize} style={{ flex: 1, padding: "6px", fontSize: 10, fontWeight: 600, background: `${TM.color}15`, border: `1px solid ${TM.color}50`, color: TM.color, cursor: "pointer", borderRadius: 0 }}>↻ Reprint</button>
        <button onClick={reset} style={{ flex: 1, padding: "6px", fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#CCC", cursor: "pointer", borderRadius: 0 }}>Reset</button>
      </div>
      <button onClick={copyTokens} style={{ width: "100%", marginTop: 4, padding: "6px", fontSize: 10, fontWeight: 600, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#AAA", cursor: "pointer", borderRadius: 0 }}>Copy Tokens</button>
    </div>
  );
}

/* ─── PREVIEW WRAPPER ─── */
function PreviewView({ sel, setSel }) {
  const [tweaks, setTweaks] = useState(tweakDefaults);
  const notes = [
    "Two-ink drums chosen from riso presets — classic is Federal Blue + Fluorescent Pink",
    "Paper stock bundles {color, blend-mode, density} — changing paper nudges ink behavior",
    "DuotoneText offsets a second-ink ghost layer by (offsetX, offsetY) with var(--riso-blend)",
    "RisoImage applies two SVG feColorMatrix filters: primary duotone + luminance-mask ghost",
    "Ink preset changes now drive image rendering, not just text color — same knob, wider scope",
    "HalftoneStrip uses radial-gradient dot pattern sized by --riso-ht-size, rotated by --riso-ht-angle",
    "Image halftone overlay uses the same dot pitch + softness vars via overlay blend",
    "GrainLayer renders SVG feTurbulence as inline data-URL with mix-blend-mode: overlay",
    "Ink bleed applied as filter: blur() — 0.4× on body text, 0.5× on image containers",
    "All primitives consume CSS vars only — slider changes propagate without React re-render on leaves",
    "'Reprint' randomizes registration, halftone, and grain within taste-constrained ranges",
    "feColorMatrix math is luminance-based (Rec.709: 0.2126 R + 0.7152 G + 0.0722 B)",
  ];
  return (<div>
    <P>Live implementation of the Riso design system. Press settings (paper stock, ink drums, registration, halftone, grain, bleed) are controllable from the panel on the right. Every setting applies to both the chat UI and the portrait series below — images flow through the same SVG duotone filters driven by the current ink preset. In production these controls live in a separate settings surface; here they're exposed inline to make the system inspectable.</P>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <RisoProvider tweaks={tweaks} setTweaks={setTweaks}>
          <div style={{ height: 540, overflow: "hidden", boxShadow: "0 16px 60px rgba(0,0,0,0.35)" }}>
            <RisoChat sel={sel} setSel={setSel} />
          </div>
          <div style={{ boxShadow: "0 16px 60px rgba(0,0,0,0.35)", border: "1px solid rgba(0,0,0,0.15)", position: "relative" }}>
            <PortraitCarousel portraits={portraits} />
            <GrainLayer />
          </div>
        </RisoProvider>
      </div>
      <div style={{ width: 240, flexShrink: 0, padding: "12px 12px 16px", borderRadius: 0, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.015)", position: "sticky", top: 16, maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
        <TweakPanel tweaks={tweaks} setTweaks={setTweaks} />
      </div>
    </div>
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Design tokens in action</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {notes.map((n, i) => (
          <div key={i} style={{ padding: "6px 8px", borderRadius: 0, border: `1px solid ${TM.color}20`, background: `${TM.color}06`, fontSize: 10, color: "#BBB", lineHeight: 1.4 }}>
            <span style={{ color: TM.color, marginRight: 4 }}>→</span>{n}
          </div>
        ))}
      </div>
    </div>
  </div>);
}

/* ═══════════════════════════════════════════════════════════════
   RISO SPEC
   ═══════════════════════════════════════════════════════════════ */
function risoSpec(a) { return {
  overview: () => (<div>
    <P>Riso is a duotone-print aesthetic inspired by Risograph duplicators — the two-drum stencil presses beloved in zines, art books, and independent publishing. Color comes from two spot inks printed on a tinted paper stock. Registration is slightly off. Dots and grain are visible. Accidents are celebrated.</P>
    <P>Unlike the other systems in this suite, Riso is explicitly <em>tweakable</em>. Paper stock, ink drums, misregistration, halftone dot pitch, grain, and ink bleed are all first-class parameters exposed through a settings surface. The same component library produces a dramatically different output under different press configurations — as if swapping paper in a real machine.</P>
    <H3>Core Principles</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {[
        ["Two inks, one paper","Every surface is composed from exactly two spot colors over a paper stock. Neutral grays, additional hues, and dark text come from the paper color — not extra inks."],
        ["Imperfection as signal","Misregistration, ink bleed, and grain are signature moments, not defects. A too-clean riso reads as fake. Calibrate slider defaults to always sit slightly askew."],
        ["Paper drives ink behavior","Changing paper changes blend-mode, ink density, and effective contrast — because that's what real paper does. A preset selector bundles these as one decision."],
        ["Tweakable by contract","Sliders and presets for registration, halftone, grain, and bleed are part of the system, not a dev tool. Expose them in a settings panel (not inline in the page)."],
      ].map(([t, d], i) => (
        <div key={i} style={{ padding: "10px 12px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#DDD", marginBottom: 3 }}>{t}</div>
          <div style={{ fontSize: 10.5, color: "#888", lineHeight: 1.5 }}>{d}</div>
        </div>))}
    </div>
    <H3>When to Use Riso</H3>
    <Do>Independent publishing, reading apps, zines, creative communities, editorial products with visible craft</Do>
    <Do>Products that want a "press-printed" personality and can tolerate visible texture in the UI</Do>
    <Dont>Accessibility-first products (grain + blend modes reduce contrast below WCAG thresholds without care)</Dont>
    <Dont>High-data-density dashboards or financial tools — Riso's texture competes with information</Dont>
  </div>),

  color: () => (<div>
    <P>Riso operates on a two-ink-plus-paper color model. Every visible color is one of: ink-1, ink-2, paper, or a blend-mode composite of them. There is no neutral palette of additional grays or tints — paper handles that role.</P>
    <H3>Paper Stocks (Presets)</H3>
    <P>Each paper stock bundles a color, a default blend mode, and an effective ink density. Changing paper changes all three at once — just like real paper handling.</P>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {Object.values(paperPresets).map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "30px 1fr 90px 70px 60px", padding: "6px 10px", borderBottom: i < Object.keys(paperPresets).length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none", alignItems: "center" }}>
          <div style={{ width: 18, height: 18, background: p.paper, border: "1px solid rgba(255,255,255,0.2)" }} />
          <span style={{ fontSize: 11, color: "#DDD", fontWeight: 600 }}>{p.label}</span>
          <code className="mn" style={{ fontSize: 10, color: "#888" }}>{p.paper}</code>
          <code className="mn" style={{ fontSize: 10, color: a }}>{p.blend}</code>
          <code className="mn" style={{ fontSize: 10, color: "#888" }}>{p.density.toFixed(2)}×</code>
        </div>
      ))}
    </div>

    <H3>Ink Drums (Presets)</H3>
    <P>Two-ink combinations modeled after real Risograph ink drums. Choose one combo per "print run." For production, add your own named combos as needed — but keep the list short (6–10).</P>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {Object.values(inkPresets).map((ink, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 90px 90px", padding: "6px 10px", borderBottom: i < Object.keys(inkPresets).length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 2 }}><div style={{ width: 20, height: 20, background: ink.c1, border: "1px solid rgba(255,255,255,0.15)" }} /><div style={{ width: 20, height: 20, background: ink.c2, border: "1px solid rgba(255,255,255,0.15)" }} /></div>
          <span style={{ fontSize: 11, color: "#DDD", fontWeight: 600 }}>{ink.label}</span>
          <code className="mn" style={{ fontSize: 10, color: "#888" }}>{ink.c1}</code>
          <code className="mn" style={{ fontSize: 10, color: "#888" }}>{ink.c2}</code>
        </div>
      ))}
    </div>

    <Do>Reserve ink-1 for structure (labels, headings, rules) and ink-2 for accents (counts, action text, duotone shadows)</Do>
    <Do>Use the paper's natural color as the "neutral" background — never introduce a gray fill</Do>
    <Dont>Use more than two inks in a single session — every third color must come from blend-mode composition</Dont>
    <Dont>Stack identical inks on top of each other — duotone requires two distinct colors</Dont>

    <H3>Contrast Ratios (Default Preset)</H3>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Text ink on Cream paper","9.6:1","AAA"],["Ink-1 (Blue) on Cream","7.2:1","AAA"],["Ink-2 (Pink) on Cream","3.4:1","AA (lg)"],["Duotone composite on Cream","~5.8:1","AA"],["Body text through 0.35 grain","reduced ~12%","Verify per preset"]].map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{r[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: "#999" }}>{r[1]}</code>
          <span style={{ fontSize: 9, fontWeight: 600, color: r[2].includes("AAA") ? "#34D399" : "#FBBF24" }}>{r[2]}</span>
        </div>))}
    </div>
  </div>),

  typography: () => (<div>
    <P>Riso uses one grotesk for content (Space Grotesk) and a monospace for tracked metadata labels (JetBrains Mono). Type receives subtle ink-bleed and optional micro-tremor to simulate pressed-ink imperfection.</P>
    <H3>Font Families</H3>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
      <div style={{ padding: 14, borderRadius: 4, border: `1px solid ${a}25`, background: `${a}04` }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, color: a, marginBottom: 4, fontWeight: 700, letterSpacing: "-0.02em" }}>Space Grotesk</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: a, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Content — the page</div>
        <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Body text, titles, messages, replies, navigation, labels above 11px. Slightly quirky grotesk that pairs well with print textures. Fallbacks: system-ui → sans-serif.</div>
      </div>
      <div style={{ padding: 14, borderRadius: 4, border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, color: "#EEE", marginBottom: 4, fontWeight: 600, letterSpacing: "-0.01em" }}>JetBrains Mono</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#34D399", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Metadata — the colophon</div>
        <div style={{ fontSize: 10.5, color: "#999", lineHeight: 1.5 }}>Tracked uppercase labels at ≤10px: timestamps, issue numbers, sender tags, section headers. The monospace width gives the printed-catalog rhythm.</div>
      </div>
    </div>

    <H3>Type Scale</H3>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["masthead","30px","700","1.0","-0.03em","Space Grotesk","Duotone"],
        ["brand","28px","700","0.95","-0.04em","Space Grotesk","Duotone"],
        ["title","16px","700","1.1","-0.02em","Space Grotesk","Selected item"],
        ["body","14px","500","1.55","-0.005em","Space Grotesk","Messages"],
        ["item","14px","600","1.2","-0.01em","Space Grotesk","Sidebar names"],
        ["preview","11px","400","1.4","0","Space Grotesk","Preview text"],
        ["label","9px","700","1.3","0.16em UPPER","JetBrains Mono","InkTag"],
        ["micro","8.5px","700","1.3","0.14em UPPER","JetBrains Mono","Tiny meta"],
      ].map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "75px 48px 42px 38px 80px 110px 1fr", padding: "5px 10px", borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.025)" : "none", background: t[5].includes("Mono") ? "rgba(52,211,153,0.04)" : `${a}04` }}>
          <code className="mn" style={{ fontSize: 10, color: "#CCC" }}>{t[0]}</code>
          {t.slice(1, 5).map((v, vi) => <span key={vi} style={{ fontSize: 10, color: "#999" }}>{v}</span>)}
          <span style={{ fontSize: 9, color: t[5].includes("Mono") ? "#34D399" : a, fontWeight: 600 }}>{t[5]}</span>
          <span style={{ fontSize: 10, color: "#666" }}>{t[6]}</span>
        </div>))}
    </div>

    <H3>Ink Imperfection Modifiers</H3>
    <P>Type in Riso receives subtle filter effects to simulate pressed-ink behavior. These are driven by the tweak-panel sliders.</P>
    <Tk n="body.filter" v="blur(calc(var(--riso-bleed) * 0.4))" d="0.4× of halftone bleed" a={a} />
    <Tk n="body.text-shadow" v="none" d="Riso never uses text-shadow" a={a} />
    <Tk n="tremor" v="translate(±random, ±random) per letter" d="Optional; 0 by default — dramatic above 1.5px" a={a} />
    <Tk n="duotone.offset" v="translate(var(--riso-off-x), var(--riso-off-y))" d="Ghost-ink layer for display type only" a={a} />
    <Do>Apply duotone treatment only to display-size type (≥16px) — small text with offset is illegible</Do>
    <Dont>Apply tremor to body copy — reserve for display moments where the jitter reads as texture, not error</Dont>
  </div>),

  elevation: () => (<div>
    <P>Riso has no traditional elevation system. Depth is communicated through ink layering: which color sits on top, where halftone fields accumulate, how registration offsets stack. "Above" and "below" are ink-order concepts, not z-index.</P>
    <H3>Ink Stacking Order</H3>
    <Tk n="layer.paper" v="z: 0" d="Base paper stock color — always bottom" a={a} />
    <Tk n="layer.ink-1" v="z: 1" d="Primary structural ink (labels, rules)" a={a} />
    <Tk n="layer.ink-2" v="z: 2" d="Accent ink — offset for duotone ghost" a={a} />
    <Tk n="layer.grain" v="z: 100" d="Overlay-blend noise, always top" a={a} />
    <Tk n="blend.mode" v="var(--riso-blend)" d="multiply / darken / color-burn by paper" a={a} />
    <H3>Structural Rules</H3>
    <Tk n="rule.hairline" v="1px solid rgba(0,0,0,0.1)" d="Between items within sidebar" a={a} />
    <Tk n="rule.strong" v="1px solid var(--riso-text)" d="Section separators" a={a} />
    <Tk n="rule.grid" v="1px solid var(--riso-text)" d="Option-grid internal and outer rules" a={a} />

    <H3>Border Radius</H3>
    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
      {[{ r: 0, l: "Structural", t: "radius.none" }, { r: 4, l: "Spec chrome only", t: "radius.sm" }].map(item => (
        <div key={item.t} style={{ textAlign: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: item.r, border: `2px solid ${a}40`, background: "rgba(255,255,255,0.02)", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <code className="mn" style={{ fontSize: 9, color: "#999" }}>{item.r}px</code>
          </div>
          <div style={{ fontSize: 9.5, color: "#CCC", fontWeight: 600 }}>{item.l}</div>
          <code className="mn" style={{ fontSize: 8.5, color: "#666" }}>{item.t}</code>
        </div>))}
    </div>

    <H3>Shadow Rules</H3>
    <Dont>Use box-shadow — Riso's depth comes from ink layering, not cast light</Dont>
    <Dont>Use filter: drop-shadow — ever</Dont>
    <Do>Use mix-blend-mode: multiply/darken/color-burn (set per paper) for ink stacking</Do>
    <Do>Use the duotone offset ghost-layer for display-type depth instead of shadow</Do>
  </div>),

  components: () => (<div>
    <P>Each component specifies anatomy, behavioral contract, exact token/CSS-var values, and do/don't rules. Click to expand.</P>

    <CBox title="DuotoneText" parts={["primary-layer", "ghost-layer"]} accent={a}
      contract="Render a text element twice — once in the primary ink, once in the secondary ink offset by (--riso-off-x, --riso-off-y) with the paper's blend mode. Ghost layer is aria-hidden and pointer-events: none."
      specs={[["primary.color", "var(--riso-ink-1)"], ["ghost.color", "var(--riso-ink-2)"], ["ghost.transform", "translate(var(--riso-off-x), var(--riso-off-y))"], ["ghost.mix-blend-mode", "var(--riso-blend)"], ["ghost.opacity", "var(--riso-ink-density)"], ["ghost.aria", "aria-hidden"], ["ghost.pointer-events", "none"], ["min.font-size", "16px", "Below this, offset is illegible"]]}
      dos={["Use for masthead, brand wordmark, title moments, selected-state names", "Wrap selected sidebar names so selection visually intensifies"]}
      donts={["Apply to body copy or small labels — offset destroys legibility", "Stack multiple duotones on the same line — creates mud"]} />

    <CBox title="HalftoneStrip" parts={["clip-container", "dot-field", "blend-layer"]} accent={a}
      contract="Render a horizontal band of halftone dots at the current dot-size and angle. Clip overflow to prevent edge artifacts from rotation. Blend with the paper through the active blend mode."
      specs={[["dot.source", "radial-gradient(circle, <ink>, transparent)"], ["dot.size", "var(--riso-ht-size)"], ["dot.softness", "var(--riso-ht-softness)"], ["rotation", "var(--riso-ht-angle)"], ["oversize", "inset: -50%", "Prevents rotation edge gaps"], ["filter", "blur(var(--riso-bleed))"], ["opacity", "var(--riso-ink-density)"]]}
      dos={["Use beneath mastheads, between sections, as sidebar accents", "Pick ink-1 for structural strips, ink-2 for accent strips"]}
      donts={["Use full halftone fills across large content areas — breaks readability", "Rotate a strip element itself without an oversize inset clip — produces visible gaps"]} />

    <CBox title="GrainLayer" parts={["svg-filter", "blend-surface"]} accent={a}
      contract="Render an inline SVG with feTurbulence as an overlay-blend layer on top of all content. Frequency and amount come from the tweak panel. Always aria-hidden and pointer-events: none."
      specs={[["source", "inline SVG feTurbulence data-URL"], ["baseFrequency", "value from tweaks.grainFrequency"], ["numOctaves", "2"], ["stitchTiles", "stitch", "Seamless tiling"], ["mix-blend-mode", "overlay"], ["opacity", "tweaks.grainAmount"], ["z-index", "100"], ["aria", "aria-hidden"]]}
      dos={["Apply once at the theme root, covering the full content area", "Keep grainAmount ≤ 0.5 to preserve body-text contrast"]}
      donts={["Apply multiple grain layers on top of each other — noise compounds unnaturally", "Use grain on form inputs — destroys focus-indicator contrast"]} />

    <CBox title="RisoFilters (SVG defs)" parts={["duotone-filter", "ghost-filter"]} accent={a}
      contract="Render an invisible SVG with two <filter> defs: a primary duotone filter (shadows=ink-1, highlights=paper via linear luminance interpolation) and a ghost-mask filter (flat ink-2 color with alpha = 1 − luminance). IDs are per-provider (useId-scoped) so multiple Riso instances on a page do not collide."
      specs={[["primary.operation", "single feColorMatrix"], ["primary.math", "lerp(ink-1, paper, luminance)"], ["primary.luminance", "Rec.709 · 0.2126 R + 0.7152 G + 0.0722 B"], ["ghost.operation", "single feColorMatrix"], ["ghost.rgb", "constant ink-2 values"], ["ghost.alpha", "1 − luminance (shadows opaque, highlights transparent)"], ["color-interpolation-filters", "sRGB"], ["id.scoping", "useId() with ':' replaced by '-'"], ["mount.point", "inside RisoProvider div"], ["aria", "aria-hidden, width=height=0"]]}
      dos={["Recompute the two matrices whenever ink or paper changes — cheap, happens on React render", "Use sRGB color-interpolation so filter math matches CSS expectations"]}
      donts={["Share a global filter id across providers — causes collisions when multiple Riso instances mount", "Use linearRGB color-interpolation — produces muddy duotone output at the same matrix values"]} />

    <CBox title="RisoImage" parts={["primary-layer", "ghost-layer", "halftone-overlay", "bleed-container"]} accent={a}
      contract="Render a raster image three times stacked: primary duotone (filter=primary), ghost (filter=ghost, offset by --riso-off-x/y, mixBlend multiply), and a CSS halftone texture overlay. Container applies ink bleed via filter: blur() and composites with paper via var(--riso-blend) + var(--riso-ink-density)."
      specs={[["primary.filter", "url(#<primaryId>)"], ["primary.object-fit", "cover"], ["ghost.filter", "url(#<ghostId>)"], ["ghost.transform", "translate(var(--riso-off-x), var(--riso-off-y))"], ["ghost.mix-blend-mode", "multiply"], ["halftone.background-image", "radial-gradient dots at var(--riso-ht-size)"], ["halftone.opacity", "0.45"], ["halftone.mix-blend-mode", "overlay"], ["container.filter", "blur(calc(var(--riso-bleed) * 0.5))"], ["container.mix-blend-mode", "var(--riso-blend)"], ["container.opacity", "var(--riso-ink-density)"], ["aspect-ratio.default", "4/5"]]}
      dos={["Wrap every photograph in RisoImage — unfiltered images look out of place against the rest of the system", "Treat the halftone overlay as always-on — it's the bridge between CSS-drawn dots and the duotone image"]}
      donts={["Nest RisoImage inside another RisoImage — filter stacking compounds unpredictably", "Use RisoImage for iconography or logos — duotone interpolation blurs crisp edges"]} />

    <CBox title="PortraitCarousel" parts={["header", "prev-btn", "image-slot", "next-btn", "position-ticks"]} accent={a}
      contract="Single-focal carousel of RisoImage items with prev/next controls and a tick strip indicating position. All tweaks propagate to the currently-displayed image via context. Navigation is keyboard-accessible (buttons with visible focus)."
      specs={[["padding", "20px 24px 22px"], ["border-top", "1px solid rgba(0,0,0,0.15)"], ["header.components", "InkTag kicker + №-index + credit"], ["prev/next.style", "InkTag inside a bordered button"], ["image.width", "260px"], ["image.aspect-ratio", "4/5"], ["ticks.size", "22×3 px bars"], ["tick.active", "var(--riso-ink-2)"], ["tick.inactive", "rgba(0,0,0,0.18)"], ["keyboard", "prev/next focusable; tick buttons labeled"]]}
      dos={["Always display a position indicator — carousels without feedback feel broken", "Credit each image visibly — riso-tradition inherits the zine convention of naming the source"]}
      donts={["Auto-advance images on a timer — the user's in control of the press", "Animate transitions with fades or slides — riso cuts, it does not dissolve"]} />

    <CBox title="InkTag" parts={["label-text"]} accent={a}
      contract="Render a small uppercase tracked monospace label in one of the two inks. Carries all metadata (timestamps, section labels, sender tags, counts). Always Mix-blends with the paper."
      specs={[["font-family", "'JetBrains Mono', monospace"], ["font-size", "8.5–10px"], ["font-weight", "700"], ["text-transform", "uppercase"], ["letter-spacing", "0.14–0.16em"], ["color.ink-1", "var(--riso-ink-1)"], ["color.ink-2", "var(--riso-ink-2)"], ["mix-blend-mode", "var(--riso-blend)"], ["opacity", "var(--riso-ink-density)"]]}
      dos={["Use ink-1 for structural metadata (issue numbers, section labels), ink-2 for status and action cues"]}
      donts={["Use InkTag at sizes above 11px — use DuotoneText or plain text instead"]} />

    <CBox title="MessageColumn" parts={["sender-row", "body", "bleed-filter"]} accent={a}
      contract="Render a message as a typographic column (no bubble, no container). Sender row uses InkTag; body uses Space Grotesk with a subtle bleed filter tied to ink bleed."
      specs={[["padding", "0", "No intrinsic padding"], ["max-width.ai", "84%"], ["max-width.user", "70%"], ["align-self.user", "flex-end"], ["sender.InkTag", "ink-1 (AI) / ink-2 (user)"], ["body.font", "Space Grotesk, 14px, 500"], ["body.color", "var(--riso-text)"], ["body.line-height", "1.55"], ["body.filter", "blur(calc(var(--riso-bleed) * 0.4))"]]}
      dos={["Use ink-2 for user sender tag — the pink-ish accent signals 'you' by default", "Keep bleed on body small (0.4× of the halftone bleed)"]}
      donts={["Wrap messages in bubbles, cards, or bordered containers", "Apply full ink bleed (1×) to body — it becomes illegible above 0.8px"]} />

    <CBox title="PaperSelector / InkSelector" parts={["segmented-control", "swatch", "label"]} accent={a}
      contract="Segmented control in the tweak panel. Each option shows a small swatch of the paper color (Paper) or the two ink colors (Ink). Selecting an option bundles multiple parameter changes as one action."
      specs={[["paper.bundles", "{paper, blend, density, textInk}"], ["ink.bundles", "{c1, c2}"], ["swatch.size", "6×6 px (ink) / 18×18 (paper detail)"], ["columns", "2"], ["selected.border", `1px solid ${a}`], ["selected.bg", `${a}20`]]}
      dos={["Bundle related parameters under presets — a real press changes multiple things at once", "Keep preset lists short (5–8) — more becomes a menu, not a choice"]}
      donts={["Expose paper color without its matching blend mode — they are physically coupled", "Allow free-form color pickers without presets — destroys the print-lineage feel"]} />

    <CBox title="TweakPanel" parts={["preset-groups", "slider-groups", "actions"]} accent={a}
      contract="Render a settings surface with Paper + Ink preset selectors, Registration / Halftone / Grain / Ink / Type slider groups, and Reprint / Reset / Copy Tokens actions. In production, lives in a settings panel; in the preview, lives alongside the live chat."
      specs={[["slider.track.accent", "TM.color"], ["slider.step.offset", "0.5px"], ["slider.step.angle", "5°"], ["slider.step.dot-size", "1px"], ["actions", "Reprint · Reset · Copy Tokens"], ["copy.format", "JSON of resolved tweaks"]]}
      dos={["Constrain slider step values to enforce taste (0.5px, 5°, etc.)", "Include a Reprint action that randomizes registration/halftone/grain within taste bounds", "Emit JSON on Copy Tokens for downstream theme export"]}
      donts={["Expose every internal CSS-var as a slider — surface only the meaningful ones", "Let sliders produce values outside the ranges defined in the spec"]} />
  </div>),

  patterns: () => (<div>
    <P>Composition rules for Riso layouts.</P>
    {[
      { n: "Sidebar + Main", rows: [["Sidebar width", "260px fixed"], ["Main area", "Fluid, fills remaining"], ["Sidebar order", "Brand (duotone) → halftone strip → Section label → Items → Press Operator"], ["Vertical divider", "1px solid rgba(0,0,0,0.15)"], ["Background (both)", "var(--riso-paper)"]] },
      { n: "Message Flow", rows: [["Direction", "Vertical stack, chronological"], ["Alignment", "AI → left (84%), user → right (70%)"], ["Gap", "18px between messages"], ["Entrance", "fadeSlideUp, 400ms ease-out, 80ms stagger"], ["Sender row", "InkTag (ink-1 for AI, ink-2 for user) + timestamp"], ["Body filter", "blur(calc(var(--riso-bleed) * 0.4))"]] },
      { n: "Active Selection", rows: [["Model", "Single selection only"], ["Trigger", "Click or Enter/Space"], ["Visual", "Background: rgba(0,0,0,0.03); name wraps in DuotoneText"], ["Transition", "Instant"], ["Focus outline", "2px solid var(--riso-ink-2) offset 2px"]] },
      { n: "Grain + Halftone Composition", rows: [["Grain scope", "Theme root only — one layer"], ["Halftone scope", "Explicit strips and blocks, never full-page"], ["Rotation policy", "Halftone rotates; grain does not"], ["Blend stacking", "Paper → ink-1 → ink-2 (duotone) → halftone → grain"]] },
      { n: "Tweakability", rows: [["Scope", "Global — one press, one configuration per session"], ["Persistence", "Settings panel state; serializable to JSON"], ["Preset bundles", "Paper {color, blend, density, textInk}; Ink {c1, c2}"], ["Slider constraints", "Snap to taste-appropriate steps (0.5px, 5°, 1px)"], ["Randomize range", "Offset ±3px, angle ∈ {0,15,45,75}, grain 0.2–0.6"]] },
      { n: "Image Composition", rows: [["Wrapper", "RisoImage — required for every raster asset"], ["Layer stack", "primary duotone → ghost (offset) → halftone overlay → container blend"], ["Filter source", "SVG feColorMatrix defs, scoped per provider (useId)"], ["Registration", "Ghost layer offset uses same --riso-off-x / --riso-off-y as text"], ["Halftone", "Same dot pitch + softness vars as decorative strips, at reduced opacity"], ["Bleed", "container filter: blur(calc(var(--riso-bleed) * 0.5))"]] },
    ].map((p, pi) => (<div key={pi} style={{ marginBottom: 14 }}><H4>{p.n}</H4>
      <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
        {p.rows.map((r, ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "140px 1fr", borderBottom: ri < p.rows.length - 1 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#CCC", fontWeight: 500 }}>{r[0]}</div>
          <div style={{ padding: "5px 10px", fontSize: 10.5, color: "#888", borderLeft: "1px solid rgba(255,255,255,0.02)" }}>{r[1]}</div>
        </div>))}
      </div>
    </div>))}
  </div>),

  extensions: () => (<div>
    <H3>1. Paper Stock System</H3>
    <P>Paper is a first-class design token that bundles <em>four</em> values: paper color, blend mode, ink density, and text-ink color. Changing paper changes all four at once. This models the physical reality of riso: different paper stocks absorb ink differently and show it differently.</P>
    <Tk n="paper.color" v="#F4EFE4 (Cream default)" d="Base background color" a={a} />
    <Tk n="paper.blend" v="multiply | darken | color-burn" d="Ink-on-paper composite mode" a={a} />
    <Tk n="paper.density" v="0.78–0.98" d="Effective ink opacity" a={a} />
    <Tk n="paper.textInk" v="#1A1614 (cream) / #2A1F12 (kraft)" d="Neutral reading color" a={a} />
    <H4>Paper Presets</H4>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[["Cream","Multiply, 0.92","Default. Warm, forgiving. The benchmark."],["Kraft","Multiply, 0.85","Earthier. Colors shift toward muddy."],["White","Multiply, 0.98","Clinical. Maximum ink saturation."],["Gray","Darken, 0.82","Industrial zine feel. Ink darkens, not multiplies."],["Newsprint","Color-burn, 0.78","Bleached, grainy. The most 'printed'-feeling."]].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 130px 1fr", padding: "5px 10px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#DDD", fontWeight: 600 }}>{p[0]}</span>
          <code className="mn" style={{ fontSize: 10, color: a }}>{p[1]}</code>
          <span style={{ fontSize: 10.5, color: "#888" }}>{p[2]}</span>
        </div>))}
    </div>
    <Do>Treat paper as a single atomic choice — never unbundle color from blend mode</Do>
    <Dont>Expose paper color as an independent slider — breaks the bundled-choice contract</Dont>

    <H3>2. Tweak Grammar</H3>
    <P>Every visual parameter exposed via the settings panel is a CSS custom property on the theme root. Primitives read from those variables — never from context directly. This means a slider change is a single style write, and the whole composition reflows without a React render on the downstream components.</P>
    <Tk n="--riso-off-x / y" v="Registration offset" d="−4 to +4 px, step 0.5" a={a} />
    <Tk n="--riso-ht-size" v="Halftone dot pitch" d="2–14 px, step 1" a={a} />
    <Tk n="--riso-ht-angle" v="Halftone rotation" d="Snap to 0 / 15 / 45 / 75" a={a} />
    <Tk n="--riso-ht-softness" v="Dot edge feathering" d="0–1, step 0.05" a={a} />
    <Tk n="--riso-grain-amount" v="Grain opacity" d="0–1, step 0.05" a={a} />
    <Tk n="--riso-bleed" v="Ink-bleed blur" d="0–2 px, step 0.1" a={a} />
    <Tk n="--riso-blend" v="Ink-on-paper blend mode" d="From paper preset" a={a} />
    <Tk n="--riso-ink-density" v="Effective ink opacity" d="From paper preset" a={a} />
    <Tk n="--riso-tremor" v="Type position jitter" d="0–3 px, display-only" a={a} />
    <Do>Constrain slider step values to prevent out-of-taste outputs (0.5px for offset, 5° for angle)</Do>
    <Do>Bundle correlated parameters (paper → {color, blend, density}) behind preset selectors</Do>
    <Dont>Expose grain frequency as a CSS variable — SVG feTurbulence cannot read CSS custom properties; read from context in the GrainLayer directly</Dont>

    <H3>3. Misregistration System</H3>
    <P>The signature Riso moment. Two ink layers deliberately printed off-register, producing a ghosted double-exposure effect on display type. Applied through the DuotoneText primitive's ghost-layer transform.</P>
    <Tk n="default.offset" v="(2, −1) px" d="Taste-default — visible but not loud" a={a} />
    <Tk n="randomize.range" v="±3 px" d="Within this, almost always looks right" a={a} />
    <Tk n="applies.to" v="Display type ≥16px" d="Never body or small chrome" a={a} />
    <Do>Keep default misregistration small enough to read as "printed with care" — not "accidentally broken"</Do>
    <Do>Pair misregistration with the "Reprint" action to produce fresh layouts with one click</Do>
    <Dont>Apply misregistration to icons, buttons, or interactive elements — interferes with affordance</Dont>

    <H3>4. SVG Duotone Filter System</H3>
    <P>Photographs and other raster content flow through two inline SVG feColorMatrix filters so the same tweak knobs that drive text and CSS fills also drive image rendering. The filter IDs are scoped per-provider (via useId) so multiple Riso instances on one page do not collide.</P>
    <H4>Primary Duotone Filter</H4>
    <P>A single feColorMatrix that linearly interpolates between the ink-1 and paper colors based on Rec.709 luminance. Dark tones map to the primary ink; highlights map to the paper color. The matrix is recomputed on the React side whenever ink or paper changes — cheap, because it only affects the filter def, not the image element.</P>
    <Tk n="operation" v="single feColorMatrix" a={a} />
    <Tk n="math" v="out = c1 + (paper − c1) · luminance" a={a} />
    <Tk n="luminance" v="0.2126 R + 0.7152 G + 0.0722 B" d="Rec.709" a={a} />
    <Tk n="color-interpolation" v="sRGB" d="linearRGB produces muddy output" a={a} />
    <H4>Ghost / Second-Ink Mask Filter</H4>
    <P>A companion filter that outputs flat ink-2 color with alpha driven by inverse luminance. Applied to a duplicate image layer offset by the same registration variables as text — so the ghost "prints" ink-2 only in shadow areas with the same misregistration the user sees on text. This is what turns a single-ink duotone into a two-ink riso.</P>
    <Tk n="operation" v="single feColorMatrix" a={a} />
    <Tk n="rgb" v="constant ink-2 values" a={a} />
    <Tk n="alpha.math" v="1 − luminance" a={a} />
    <Tk n="blend-mode" v="multiply" d="Via container, not filter" a={a} />
    <Do>Use sRGB color-interpolation — linearRGB produces overly saturated, unprintable output</Do>
    <Do>Recompute filter defs in React whenever ink/paper changes — no need for CSS vars here</Do>
    <Dont>Expose filter-matrix coefficients as a tweak — they're mathematical, not aesthetic</Dont>
    <Dont>Use feComponentTransfer tables for the alpha math — a single feColorMatrix is cheaper and sufficient</Dont>

    <H3>5. Randomize Behavior</H3>
    <P>A "Reprint" action randomly jitters registration, halftone angle, and grain within taste-constrained ranges. This is a Riso-appropriate affordance — the aesthetic celebrates variation, so offering a one-click re-roll is idiomatic. Other systems would reject this affordance outright.</P>
    <Tk n="randomize.offsetX" v="−3 to +3 px, step 0.5" a={a} />
    <Tk n="randomize.offsetY" v="−3 to +3 px, step 0.5" a={a} />
    <Tk n="randomize.dotSize" v="4–10 px" d="Narrower than max range — stays legible" a={a} />
    <Tk n="randomize.dotAngle" v="One of {0, 15, 45, 75}" d="CMYK screen angles" a={a} />
    <Tk n="randomize.grainAmount" v="0.2–0.6" d="Always visible, never overwhelming" a={a} />
    <Do>Constrain randomize ranges to a subset of slider ranges — the press always produces pleasing results</Do>
    <Dont>Randomize paper or ink presets — those are deliberate choices, not accidents</Dont>
  </div>),

  voice: () => (<div>
    <P>Riso speaks the language of independent publishing — issues, editions, presses, filed, composed. The AI is "The Press" or "The Studio"; users are "correspondents" or "operators." Copy should feel like a zine colophon, not a chatbot.</P>
    <H3>Tone Spectrum</H3>
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 12 }}>
      {["Craft-aware", "Warm", "Considered", "Press-lineage"].map(t => <Pill key={t} color="#34D399">{t}</Pill>)}
      {["Never chatbot", "Never corporate"].map(t => <Pill key={t} color="#FF6B6B">{t}</Pill>)}
    </div>

    <H3>Placeholder &amp; State Text</H3>
    <div style={{ borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      {[
        ["Input placeholder", "Compose your reply…", "Space Grotesk italic"],
        ["Sidebar search", "Search back issues…", "Space Grotesk italic"],
        ["Empty list", "No issues filed yet.", "Space Grotesk"],
        ["Loading", "Printing.", "InkTag"],
        ["Success", "Filed.", "InkTag"],
        ["Error", "Could not file. Misregistered.", "Space Grotesk"],
      ].map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px", padding: "5px 10px", borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.025)" : "none" }}>
          <span style={{ fontSize: 10.5, color: "#BBB" }}>{p[0]}</span>
          <span style={{ fontSize: 11, color: "#DDD", fontFamily: p[2].includes("Mono") || p[2].includes("InkTag") ? "'JetBrains Mono', monospace" : "'Space Grotesk', sans-serif", fontStyle: p[2].includes("italic") ? "italic" : "normal", textTransform: p[2].includes("InkTag") ? "uppercase" : "none", letterSpacing: p[2].includes("InkTag") ? "0.16em" : "0" }}>{p[1]}</span>
          <span style={{ fontSize: 9.5, color: "#666" }}>{p[2]}</span>
        </div>))}
    </div>

    <H3>Vocabulary</H3>
    <Do>Use printing verbs: compose, file, print, reprint, edition, issue, impression, colophon</Do>
    <Do>Refer to threads as "issues," messages as "dispatches" or "correspondence," the AI as "The Press"</Do>
    <Dont>Use chat-app verbs: send, submit, post, ping, message</Dont>
    <Dont>Use emoji anywhere in copy — Riso is visual, not iconographic</Dont>

    <H3>Conventions</H3>
    <Do>Sentence case for UI chrome; UPPERCASE with 0.16em tracking for InkTag labels only</Do>
    <Do>Numbers prefixed with "№" in metadata (№04, Issue №01 / 05)</Do>
    <Do>Use · (middle dot) and — (em dash) as separators in label rows</Do>
    <Dont>Use exclamation points in any copy</Dont>
    <Dont>Capitalize headlines in title case — sentence case matches the editorial register</Dont>

    <H3>Symbol Vocabulary</H3>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
      {[["№", "Issue/edition prefix"], ["·", "Middle dot separator"], ["—", "Em dash / range"], ["→", "Forward action (File Reply →)"], ["●", "Status indicator"], ["↻", "Reprint/randomize"], ["I.", "Section numeral"], ["/", "Pair separator (01 / 05)"], ["…", "Continuation only"]].map(([s, u]) => (
        <div key={s} style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.05)" }}>
          <span style={{ fontSize: 16, fontFamily: "'Space Grotesk', sans-serif", color: a, fontWeight: 700 }}>{s}</span>
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
    { id: "preview", l: "⬡ Preview + Tweaks" }, { id: "overview", l: "Overview" }, { id: "color", l: "Color" }, { id: "typography", l: "Typography" },
    { id: "elevation", l: "Elevation" }, { id: "components", l: "Components" }, { id: "patterns", l: "Patterns" },
    { id: "extensions", l: "Extensions" }, { id: "voice", l: "Voice & Tone" },
  ];
  const spec = risoSpec(TM.color);
  return (<div style={{ display: "flex", minHeight: "100%" }}>
    <div style={{ width: 170, minWidth: 170, borderRight: "1px solid rgba(255,255,255,0.05)", padding: "10px 0" }}>
      {specSections.map(s => (
        <div key={s.id} onClick={() => setSec(s.id)} style={{ padding: "6px 12px", cursor: "pointer", background: sec === s.id ? "rgba(255,255,255,0.03)" : "transparent", borderLeft: sec === s.id ? `2px solid ${TM.color}` : "2px solid transparent" }}>
          <span style={{ fontSize: 11, fontWeight: sec === s.id ? 600 : 400, color: sec === s.id ? (s.id === "preview" ? TM.color : "#EEE") : "#777" }}>{s.l}</span>
        </div>
      ))}
    </div>
    <div key={sec} style={{ flex: 1, padding: "18px 28px", overflowY: "auto", animation: "fadeIn 0.2s ease" }}>
      <div style={{ maxWidth: 900 }}>
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box }
        .mn { font-family: 'JetBrains Mono', monospace }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 3px }
        .app-sh { display: flex; width: 100%; height: 100%; overflow: hidden }
        .sb { width: 260px; min-width: 260px; display: flex; flex-direction: column; overflow: hidden }
        .cl { flex: 1; overflow-y: auto }
        .ca { flex: 1; display: flex; flex-direction: column; overflow: hidden }
        .ma { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 18px }
        .si { border: none; outline: none; background: transparent; flex: 1; font-size: 11px; width: 100% }
        .riso-input::placeholder { opacity: 0.45 }
        input::placeholder { opacity: 0.5 }
        .snd { cursor: pointer; transition: opacity 0.15s; flex-shrink: 0 }
        .snd:hover { opacity: 0.7 }
        .mi { animation: fadeSlideUp 0.4s ease-out both }
        .ci { animation: fadeSlideUp 0.3s ease-out both }
        .ci:hover { background: rgba(0,0,0,0.04) }
        .bc-riso:hover { background: rgba(0,0,0,0.03) !important }
        .riso-shell { min-height: 540px }
        .riso-nav-btn { background: transparent; border: 1px solid rgba(0,0,0,0.15); padding: 6px 10px; cursor: pointer; font-family: inherit; transition: background 0.12s }
        .riso-nav-btn:hover { background: rgba(0,0,0,0.04) }
        .riso-nav-btn:focus-visible { outline: 2px solid var(--riso-ink-2); outline-offset: 2px }
        input[type="range"] { height: 4px; -webkit-appearance: none; background: rgba(255,255,255,0.08); border-radius: 0 }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: ${TM.color}; border-radius: 0; cursor: pointer }
        input[type="range"]::-moz-range-thumb { width: 12px; height: 12px; background: ${TM.color}; border-radius: 0; cursor: pointer; border: none }
      `}</style>

      {/* TOP NAV */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", height: 40 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#EEE", marginRight: 20, letterSpacing: "-0.02em" }}>Design System</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: TM.color, marginRight: 20, borderBottom: `2px solid ${TM.color}`, height: 40, display: "flex", alignItems: "center", padding: "0 4px" }}>{TM.name}</span>
        <span style={{ fontSize: 10, color: "#555" }}>{TM.tag}</span>
        <div style={{ marginLeft: "auto", fontSize: 9, color: "#333" }}>v1.0 · tweakable</div>
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
