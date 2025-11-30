import { useEffect, useState } from "react";

type WaitState = {
  untilTs: number;
};

const listeners = new Set<() => void>();
let waitState: WaitState = { untilTs: 0 };

function notify() {
  listeners.forEach((fn) => fn());
}

export function setRateLimitWait(ms: number) {
  const until = Date.now() + Math.max(0, ms);
  waitState = { untilTs: until };
  notify();
}

export function clearRateLimitWait() {
  waitState = { untilTs: 0 };
  notify();
}

export function getRateLimitWait() {
  return waitState;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRateLimitWait() {
  const [state, setState] = useState(waitState);

  useEffect(() => {
    const unsub = subscribe(() => setState(getRateLimitWait()));
    return unsub;
  }, []);

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, waitState.untilTs - Date.now()),
  );

  useEffect(() => {
    if (!state.untilTs) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      setRemaining(Math.max(0, state.untilTs - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [state.untilTs]);

  return {
    untilTs: state.untilTs,
    remainingMs: remaining,
    isWaiting: state.untilTs > Date.now(),
  };
}
