import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { apiQueryClient, apiQueryOptions } from "./api-query";
import App from "./App";
import SuccessToasts from "./SuccessToasts";
import {
  initializeDevelopmentCapabilities,
  isolatedDevelopment,
  hallEnabled,
} from "./staff-auth";
import "./styles.css";
import "./guest-booking.css";
import "./sign-in.css";
import "./landing.css";
import "./staff-workspace.css";
import "./theme.css";

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
  const capabilities = await initializeDevelopmentCapabilities();
  if (capabilities)
    apiQueryClient.setQueryData(
      apiQueryOptions("/guest/booking-status", undefined, ["public"]).queryKey,
      capabilities,
    );
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={apiQueryClient}>
        <SuccessToasts />
        <App hallEnabled={hallEnabled} reviewsEnabled={isolatedDevelopment} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
void start();
