import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  clearRateLimitWait,
  getRateLimitWait,
  setRateLimitWait,
  useRateLimitWait,
} from "../rateLimit";
import { renderHook, act } from "@testing-library/react";

describe("rateLimit", () => {
  beforeEach(() => {
    clearRateLimitWait();
    vi.useRealTimers();
  });

  it("stores and clears wait state", () => {
    setRateLimitWait(5000);
    const state = getRateLimitWait();
    expect(state.untilTs).toBeGreaterThan(Date.now());
    clearRateLimitWait();
    expect(getRateLimitWait().untilTs).toBe(0);
  });

  it("hook reports remaining time", () => {
    vi.useFakeTimers();
    setRateLimitWait(2000);
    const { result } = renderHook(() => useRateLimitWait());
    expect(result.current.isWaiting).toBe(true);
    expect(result.current.remainingMs).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(2100);
    });
    expect(result.current.isWaiting).toBe(false);
    vi.useRealTimers();
  });
});
