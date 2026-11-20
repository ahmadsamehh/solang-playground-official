"use client";

import { useEffect, useState } from "react";

/** Current time, re-rendering every `intervalMs` so relative timestamps stay fresh. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default useNow;
