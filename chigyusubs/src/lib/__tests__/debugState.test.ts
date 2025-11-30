import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  copyDebugBuffer,
  enableDebugEvents,
  disableDebugEvents,
  getDebugBuffer,
  logDebugEvent,
  setDebugWriter,
} from "../debugState";

describe("debugState", () => {
  beforeEach(() => {
    disableDebugEvents();
    setDebugWriter(null);
    // Manually clear buffer via a dummy toggle
    enableDebugEvents();
  });

  it("orders copied events chronologically", () => {
    logDebugEvent({ kind: "a" });
    logDebugEvent({ kind: "b" });
    const text = copyDebugBuffer();
    expect(text).toContain('"kind": "a"');
    const firstIdx = text.indexOf('"kind": "a"');
    const secondIdx = text.indexOf('"kind": "b"');
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it("invokes writer when enabled", () => {
    const spy = vi.fn();
    setDebugWriter(spy);
    enableDebugEvents();
    logDebugEvent({ kind: "writer-test" });
    expect(spy).toHaveBeenCalled();
  });

  it("does not invoke writer when disabled", () => {
    const spy = vi.fn();
    setDebugWriter(spy);
    disableDebugEvents();
    logDebugEvent({ kind: "skip" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("exposes buffer for inspection", () => {
    logDebugEvent({ kind: "inspect" });
    const buf = getDebugBuffer();
    expect(buf.some((e) => e.kind === "inspect")).toBe(true);
  });
});
