import type { CatalogRecord, TextPair } from "./photo-api";

export function translationFields(record: CatalogRecord): Record<string, TextPair> {
  return { title: record.title, alt: record.alt, description: record.description, series: record.series,
    ...Object.fromEntries((["place", "district", "city", "region", "country", "geocodeQuery"] as const).map(k => [`location.${k}`, record.location[k]])) };
}

export function applyTranslations(current: CatalogRecord, original: CatalogRecord, suggestions: Record<string, string>) {
  const next = structuredClone(current), pairs = translationFields(next), before = translationFields(original);
  const applied: string[] = [];
  for (const [key, value] of Object.entries(suggestions)) {
    if (pairs[key] && !pairs[key].en.trim() && pairs[key].zh === before[key]?.zh && value.trim()) {
      pairs[key].en = value; applied.push(key);
    }
  }
  return { record: next, applied };
}
