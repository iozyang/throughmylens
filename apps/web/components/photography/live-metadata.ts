import type { Photograph } from "./types";

type LiveMetadata = Pick<Photograph, "id" | "title" | "alt" | "location" | "date" | "time" |
  "focalLength35mm" | "aperture" | "shutterSpeed"> & { iso: number | "" };

export const metadataChannel = "throughmylens:public-metadata";

// Retain the explicit public image list, IDs, URLs, dimensions and order.
// Empty strings are edits too: they must clear old static values.
export function applyLiveMetadata(initial: Photograph[], updates: LiveMetadata[]): Photograph[] {
  const byId = new Map(updates.map(item => [item.id, item]));
  return initial.map(photo => {
    const update = byId.get(photo.id);
    if (!update) return photo;
    return {
      ...photo,
      title: update.title, alt: update.alt, location: update.location,
      date: update.date, time: update.time,
      focalLength35mm: update.focalLength35mm,
      aperture: update.aperture, shutterSpeed: update.shutterSpeed,
      iso: typeof update.iso === "number" ? update.iso : undefined,
    };
  });
}

export function notifyMetadataSaved() {
  try {
    const channel = new BroadcastChannel(metadataChannel);
    channel.postMessage("saved"); // Notification only; no private record in messages.
    channel.close();
  } catch { /* Focus refresh and polling also work without BroadcastChannel. */ }
}
