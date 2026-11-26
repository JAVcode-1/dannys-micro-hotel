import { useState } from "react";
import { flushSync } from "react-dom";

let themeChanging = false;

export default function ThemeToggle() {
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.theme === "dark",
  );

  async function toggle(button: HTMLButtonElement) {
    if (themeChanging) return;
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";

    function applyTheme() {
      root.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", theme === "dark" ? "#10172A" : "#FAFAFD");
      try {
        localStorage.setItem("staytrack-theme", theme);
      } catch {
        // The theme still applies when storage is unavailable.
      }
      flushSync(() => setDark(theme === "dark"));
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      applyTheme();
      return;
    }

    themeChanging = true;
    try {
      if (
        document.startViewTransition &&
        window.CSS?.supports("clip-path", "circle(0)")
      ) {
        const bounds = button.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;
        const y = bounds.top + bounds.height / 2;
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );
        root.style.setProperty("--theme-origin", `${x}px ${y}px`);
        root.style.setProperty("--theme-radius", `${radius}px`);
        root.dataset.themeTransition = "reveal";
        const transition = document.startViewTransition(applyTheme);
        // A hidden or resized viewport can skip the animation.
        void transition.ready.catch(() => {});
        await Promise.all([transition.updateCallbackDone, transition.finished]);
      } else {
        root.dataset.themeTransition = "fade";
        // Commit the transition rules before changing the theme colors.
        void getComputedStyle(root).backgroundColor;
        applyTheme();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
      }
    } catch {
      if (root.dataset.theme !== theme) applyTheme();
    } finally {
      delete root.dataset.themeTransition;
      root.style.removeProperty("--theme-origin");
      root.style.removeProperty("--theme-radius");
      themeChanging = false;
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Dark mode"
      aria-pressed={dark}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={(event) => void toggle(event.currentTarget)}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {dark ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
          </>
        ) : (
          <path d="M20.9 13.4A9 9 0 1 1 10.6 3.1a7 7 0 0 0 10.3 10.3Z" />
        )}
      </svg>
    </button>
  );
}
