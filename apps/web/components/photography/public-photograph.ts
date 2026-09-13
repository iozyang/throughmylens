import type { PhotoRecord } from "./catalog-record";
import type { Photograph } from "./types";

type DisplayRecord = Pick<PhotoRecord, "slug" | "src" | "width" | "height" | "order" | "title" | "alt" |
  "date" | "time" | "focalLength" | "focalLength35mm" | "aperture" | "shutterSpeed"> & {
    iso: number | string; // JSON imports widen the empty-string literal to string.
    location: Pick<PhotoRecord["location"], "display">;
  };

// Explicit allowlist: internal administrative addresses, geocode queries, GPS,
// equipment records, tags and series are not part of the browser payload.
export function toPublicPhotograph(record: DisplayRecord): Photograph {
  return {
    id: record.slug, src: record.src, width: record.width, height: record.height,
    title: record.title, alt: record.alt, location: record.location.display,
    date: record.date, time: record.time,
    focalLength: record.focalLength, focalLength35mm: record.focalLength35mm,
    aperture: record.aperture, shutterSpeed: record.shutterSpeed, iso: typeof record.iso === "number" ? record.iso : undefined,
    order: record.order,
    focalPosition: { desktop: "50% 50%", mobile: "50% 50%" },
    credit: { name: "SHEPS.LOG", url: "", license: "All rights reserved." },
  };
}
