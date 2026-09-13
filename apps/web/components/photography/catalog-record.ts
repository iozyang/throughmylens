import type { LocalizedText } from "./types";

export type PhotoRecord = {
  slug: string; file: string; src: string; width: number; height: number; order: number;
  title: LocalizedText; alt: LocalizedText; description: LocalizedText;
  location: {
    place: LocalizedText; district: LocalizedText; city: LocalizedText;
    region: LocalizedText; country: LocalizedText; countryCode: string;
    display: LocalizedText; geocodeQuery: LocalizedText;
  };
  geo: {
    latitude: number | ""; longitude: number | ""; coordinateSystem: "WGS84";
    source: "exif" | "geocoded" | "manual" | "";
    precision: "exact" | "approximate" | "city" | "";
  };
  date: string; time: string; timezone: string;
  camera: { brand: string; model: string }; lens: { brand: string; model: string };
  focalLength: string; focalLength35mm: string; aperture: string; shutterSpeed: string; iso: number | "";
  series: { slug: string; zh: string; en: string };
  tags: string[] | "";
};
