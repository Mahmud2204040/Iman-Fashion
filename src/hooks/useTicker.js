import { useEffect, useState } from 'react';

/**
 * useTicker — minute-level clock that triggers a re-render.
 *
 * Useful for "live" surfaces: topbar clock, greeting, dashboard date.
 * Returns a Date that updates every `intervalMs` (default 60_000) and
 * whenever the tab regains focus (so the clock catches up if the user
 * had the tab backgrounded).
 */
export function useTicker(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let id = null;

    function start() {
      if (id !== null) return;
      id = window.setInterval(() => setNow(new Date()), intervalMs);
    }

    function stop() {
      if (id !== null) {
        window.clearInterval(id);
        id = null;
      }
    }

    function sync() {
      setNow(new Date());
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        sync();
        start();
      } else {
        stop();
      }
    }

    start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', sync);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', sync);
    };
  }, [intervalMs]);

  return now;
}
