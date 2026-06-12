import { StrictMode, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import Home from "./Home.jsx";

const SketchSystem = lazy(() => import("./systems/design-system-sketch.jsx"));
const PrismSystem = lazy(() => import("./systems/design-system-prism.jsx"));
const RevoltSystem = lazy(() => import("./systems/design-system-revolt.jsx"));
const TerminalSystem = lazy(() => import("./systems/design-system-terminal.jsx"));
const EditorialSystem = lazy(() => import("./systems/design-system-editorial.jsx"));
const SwissSystem = lazy(() => import("./systems/design-system-swiss.jsx"));
const RisoSystem = lazy(() => import("./systems/design-system-riso.jsx"));
const NeutralSystem = lazy(() => import("./systems/design-system-neutral.jsx"));

const systems = {
  neutral: NeutralSystem,
  sketch: SketchSystem,
  prism: PrismSystem,
  revolt: RevoltSystem,
  terminal: TerminalSystem,
  editorial: EditorialSystem,
  swiss: SwissSystem,
  riso: RisoSystem,
};

function parseHash() {
  const raw = window.location.hash.slice(1);
  const slash = raw.indexOf("/");
  const system = slash === -1 ? raw : raw.slice(0, slash);
  const section = slash === -1 ? "" : raw.slice(slash + 1);
  return { system: systems[system] ? system : "home", section };
}

function Root() {
  const [route, setRoute] = useState(() => parseHash().system);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash().system);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = useCallback((id) => {
    window.location.hash = id === "home" ? "" : id;
  }, []);

  const SystemComponent = systems[route];
  if (SystemComponent) {
    return (
      <Suspense fallback={<Loading />}>
        <BackButton onClick={() => navigate("home")} />
        <SystemComponent />
      </Suspense>
    );
  }

  return <Home onNavigate={navigate} />;
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
