"use client";

import { useEffect, useState } from "react";
import { applyLiveMetadata, metadataChannel } from "./live-metadata";
import type { Photograph } from "./types";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function useLiveMetadata(initial: Photograph[]) {
  const [photographs, setPhotographs] = useState(initial);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    let channel: BroadcastChannel | undefined;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      controller?.abort();
      const pending = new AbortController();
      controller = pending;
      const timeout = setTimeout(() => pending.abort(), 8000);
      try {
        const response = await fetch(`${API.replace(/\/$/, "")}/api/v1/public/selected-work/metadata`, {
          cache: "no-store", credentials: "omit", signal: pending.signal,
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!active || pending.signal.aborted || !Array.isArray(payload.photos)) return;
        const next = applyLiveMetadata(initial, payload.photos);
        setPhotographs(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      } catch { /* Keep the last successful metadata, or static offline fallback. */ }
      finally {
        clearTimeout(timeout);
        if (controller === pending) controller = undefined;
      }
    }
    void refresh();
    // Do not starve a slow (but still within timeout) request at every poll.
    const timer = setInterval(() => { if (!controller) void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    try { channel = new BroadcastChannel(metadataChannel); channel.onmessage = refresh; } catch { /* Optional. */ }
    return () => {
      active = false; controller?.abort(); channel?.close(); clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [initial]);
  return photographs;
}
