"use client";

import { useEffect } from "react";

export function ActivateSubscriberSession() {
  useEffect(() => {
    const query = window.location.search.slice(1);
    if (!query) return;
    let stopped = false;
    const activate = async () => {
      for (let attempt = 0; attempt < 5 && !stopped; attempt += 1) {
        const response = await fetch("/api/creem/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        }).catch(() => null);
        if (response?.ok || response?.status !== 409) return;
        await new Promise((resolve) => window.setTimeout(resolve, 1000 * (attempt + 1)));
      }
    };
    void activate();
    return () => {
      stopped = true;
    };
  }, []);
  return null;
}
