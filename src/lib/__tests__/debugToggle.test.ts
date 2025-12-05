import { describe, expect, it, beforeEach } from "vitest";
import { isDebugEnabled, persistDebugEnabled } from "../debugToggle";

describe("debugToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState({}, "", "/");
  });

  it("returns true when query param debug=1 is present", () => {
    window.history.pushState({}, "", "/?debug=1");
    expect(isDebugEnabled()).toBe(true);
  });

  it("returns true when stored flag is set", () => {
    window.localStorage.setItem("debugEvents", "1");
    expect(isDebugEnabled()).toBe(true);
  });

  it("prefers query flag over storage", () => {
    window.localStorage.setItem("debugEvents", "0");
    window.history.pushState({}, "", "/?debug=1");
    expect(isDebugEnabled()).toBe(true);
  });

  it("returns false by default", () => {
    expect(isDebugEnabled()).toBe(false);
  });

  it("persistDebugEnabled stores the flag", () => {
    persistDebugEnabled(true);
    expect(window.localStorage.getItem("debugEvents")).toBe("1");
    persistDebugEnabled(false);
    expect(window.localStorage.getItem("debugEvents")).toBe("0");
  });
});
