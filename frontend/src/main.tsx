import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import SuccessToasts from "./SuccessToasts";
import {
  initializeDevelopmentCapabilities,
  isolatedDevelopment,
  hallEnabled,
} from "./staff-auth";
import "./styles.css";
import "./landing.css";

const navigation = performance.getEntriesByType("navigation")[0] as
  PerformanceNavigationTiming | undefined;
const { pathname, search, hash } = window.location;
const landingAnchors = ["#rooms", "#hall", "#contact", "#landing-main", "#top"];

if (
  navigation?.type === "reload" &&
  pathname === "/" &&
  (!hash || landingAnchors.includes(hash))
) {
  const restoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  if (hash) history.replaceState(history.state, "", pathname + search);
  window.scrollTo({ top: 0, behavior: "instant" });
  window.addEventListener(
    "pageshow",
    () => {
      requestAnimationFrame(() => {
        history.scrollRestoration = restoration;
      });
    },
    { once: true },
  );
}

async function start() {
  await initializeDevelopmentCapabilities();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <SuccessToasts />
      <App
        hallEnabled={hallEnabled}
        reviewsEnabled={isolatedDevelopment}
      />
    </StrictMode>,
  );
}
void start();
