import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

const TITLE_TAPS = 5;
const COMBO_WINDOW_MS = 4000;

let unlocked = __DEV__;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getDebugUnlocked() {
  return unlocked;
}

export function unlockDebug() {
  if (unlocked) {
    return;
  }

  unlocked = true;
  listeners.forEach((listener) => listener());
}

export function useDebugUnlocked(): boolean {
  return useSyncExternalStore(subscribe, getDebugUnlocked, getDebugUnlocked);
}

export function useDebugCombo() {
  const tapsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    tapsRef.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => reset, [reset]);

  const registerTitleTap = useCallback(() => {
    if (tapsRef.current === 0) {
      timerRef.current = setTimeout(reset, COMBO_WINDOW_MS);
      tapsRef.current = 1;
      return;
    }

    const next = tapsRef.current + 1;
    if (next < TITLE_TAPS) {
      tapsRef.current = next;
      return;
    }

    unlockDebug();
    reset();
  }, [reset]);

  return { registerTitleTap };
}
