import { StrictMode, useState, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home.jsx";

const SketchSystem = lazy(() => import("../design-system-sketch.jsx"));
const PrismSystem = lazy(() => import("../design-system-prism.jsx"));
const RevoltSystem = lazy(() => import("../design-system-revolt.jsx"));
const TerminalSystem = lazy(() => import("../design-system-terminal.jsx"));
const EditorialSystem = lazy(() => import("../design-system-editorial.jsx"));
const SwissSystem = lazy(() => import("../design-system-swiss.jsx"));
const RisoSystem = lazy(() => import("../design-system-riso.jsx"));

const systems = {
  sketch: SketchSystem,
  prism: PrismSystem,
  revolt: RevoltSystem,
  terminal: TerminalSystem,
  editorial: EditorialSystem,
  swiss: SwissSystem,
  riso: RisoSystem,
};

function Root() {
  const [route, setRoute] = useState("home");

  const SystemComponent = systems[route];
  if (SystemComponent) {
    return (
      <Suspense fallback={<Loading />}>
        <BackButton onClick={() => setRoute("home")} />
        <SystemComponent />
      </Suspense>
    );
  }

  return <Home onNavigate={setRoute} />;
}

function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(10,10,10,0.9)",
        backdropFilter: "blur(8px)",
        color: "#999",
        fontSize: 12,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#EEE";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#999";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
      }}
    >
      ← All Systems
    </button>
  );
}

function Loading() {
  return (
    <div style={{
      width: "100%",
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0A0A0A",
      color: "#555",
      fontSize: 13,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      Loading...
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
