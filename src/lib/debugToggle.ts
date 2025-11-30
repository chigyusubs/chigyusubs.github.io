const QUERY_KEY = "debug";
const STORAGE_KEY = "debugEvents";

export function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get(QUERY_KEY) === "1") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "1";
}

export function persistDebugEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage errors
  }
}
