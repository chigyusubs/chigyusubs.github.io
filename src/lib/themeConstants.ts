import { Theme, lightTheme, darkTheme } from "./theme";

export type ThemeName = "light" | "dark";

export const defaultThemes: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

export function getPreferredTheme(initialName?: ThemeName): ThemeName {
  if (initialName) return initialName;
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("theme") as ThemeName | null;
    if (stored === "light" || stored === "dark") return stored;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }
  return "light";
}
