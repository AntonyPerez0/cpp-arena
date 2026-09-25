// Theme (light or dark) and text size. The inline script in index.html applies
// the saved choice before the app loads so pages don't flash the wrong colors.
import { useEffect, useSyncExternalStore } from "react";
import { useStore, type Theme } from "../state/store";

const media = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
const listeners = new Set<() => void>();

export function resolveTheme(t: Theme): "dark" | "light" {
  if (t === "system") return media?.matches ? "light" : "dark";
  return t;
}

function apply(theme: Theme, scale: number) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  if (root.dataset.theme !== resolved) {
    root.dataset.theme = resolved;
    listeners.forEach((l) => l());
  }
  root.style.setProperty("--scale", String(scale || 1));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "light" ? "#f5f6f8" : "#0d0f13");
}

/** Keeps <html data-theme> and the text size in sync with the settings. Mount once. */
export function useAppearance() {
  const theme = useStore((s) => s.settings.theme);
  const scale = useStore((s) => s.settings.textScale);
  useEffect(() => {
    apply(theme, scale);
    if (theme !== "system" || !media) return;
    const onChange = () => apply(theme, scale);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, scale]);
}

/** The theme actually showing ("dark" or "light"). */
export function useResolvedTheme(): "dark" | "light" {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
}

export const TEXT_SIZES = [
  { value: 1, label: "Default" },
  { value: 1.125, label: "Large" },
  { value: 1.25, label: "Larger" },
  { value: 1.4, label: "Largest" },
];
