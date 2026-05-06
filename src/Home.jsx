import { useState } from "react";

const systems = [
  {
    id: "integrated",
    name: "Integrated System",
    tag: "Sketch + Prism + Revolt",
    description: "Multi-theme design system with three distinct visual languages — hand-drawn warmth, liquid glass, and neobrutalist energy.",
    colors: ["#B8A9C8", "#7DDFBE", "#FF3366"],
    themes: ["Sketch", "Prism", "Revolt"],
  },
  {
    id: "terminal",
    name: "Terminal System",
    tag: "CLI + Phosphor Heritage",
    description: "Monochrome terminal aesthetic with phosphor green accents. Sharp edges, monospace type, command-line heritage.",
    colors: ["#00FF66"],
    themes: ["Terminal"],
  },
  {
    id: "editorial",
    name: "Editorial System",
    tag: "Long-form Serif + Newsprint Masthead",
    description: "Classic editorial typography with deep crimson accents. Serif-driven hierarchy built for long-form reading and newsprint gravitas.",
    colors: ["#8B1E2D"],
    themes: ["Editorial"],
  },
  {
    id: "swiss",
    name: "Swiss System",
    tag: "Grid-strict + Rams Heritage",
    description: "Grid-strict neo-grotesk aesthetic in the Rams lineage. A fixed seven-size type scale, a single saturated red used sparingly, and typography — including large numerals — carrying all hierarchy.",
    colors: ["#E3000B"],
    themes: ["Swiss"],
  },
  {
    id: "riso",
    name: "Riso System",
    tag: "Duotone Print + Tweakable Press",
    description: "Two-ink risograph aesthetic with paper stock presets, halftone, grain, and live misregistration controls. A tweakable press, rendered in CSS.",
    colors: ["#3255A4", "#FF48B0"],
    themes: ["Riso"],
  },
];

export default function Home({ onNavigate }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{
      width: "100%",
      minHeight: "100vh",
      background: "#0A0A0A",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      color: "#EEE",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <div style={{ animation: "fadeIn 0.4s ease-out", textAlign: "center", marginBottom: 48 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "#555",
          marginBottom: 12,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          TKR Design Systems
        </div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          color: "#EEE",
          margin: 0,
          lineHeight: 1.2,
        }}>
          Choose a System
        </h1>
        <p style={{
          fontSize: 14,
          color: "#666",
          marginTop: 8,
          maxWidth: 400,
          lineHeight: 1.6,
        }}>
          Each system is a complete design language with architecture specs, tokens, components, and live previews.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 20,
        width: "100%",
        maxWidth: 720,
        animation: "fadeIn 0.5s ease-out 0.1s both",
      }}>
        {systems.map((sys) => {
          const isHovered = hovered === sys.id;
          const borderColor = isHovered ? sys.colors[0] : "rgba(255,255,255,0.08)";
          return (
            <div
              key={sys.id}
              onClick={() => onNavigate(sys.id)}
              onMouseEnter={() => setHovered(sys.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: 28,
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                background: isHovered ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.01)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {sys.colors.map((c, i) => (
                    <div key={i} style={{
                      width: 12,
                      height: 12,
                      borderRadius: (sys.id === "terminal" || sys.id === "riso" || sys.id === "swiss") ? 0 : 6,
                      background: c,
                      transition: "transform 0.2s",
                      transform: isHovered ? "scale(1.2)" : "scale(1)",
                    }} />
                  ))}
                </div>
                <span style={{
                  fontSize: 9,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#555",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  {sys.tag}
                </span>
              </div>

              <div>
                <h2 style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#EEE",
                  margin: 0,
                }}>
                  {sys.name}
                </h2>
                <p style={{
                  fontSize: 13,
                  color: "#777",
                  lineHeight: 1.6,
                  margin: "8px 0 0",
                }}>
                  {sys.description}
                </p>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {sys.themes.map((t) => (
                  <span key={t} style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: (sys.id === "terminal" || sys.id === "riso" || sys.id === "swiss") ? 0 : 4,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#999",
                    fontWeight: 500,
                  }}>
                    {t}
                  </span>
                ))}
              </div>

              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: "auto",
                fontSize: 12,
                fontWeight: 600,
                color: isHovered ? sys.colors[0] : "#555",
                transition: "color 0.2s",
              }}>
                Open System
                <span style={{
                  transition: "transform 0.2s",
                  transform: isHovered ? "translateX(4px)" : "translateX(0)",
                  display: "inline-block",
                }}>
                  →
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
