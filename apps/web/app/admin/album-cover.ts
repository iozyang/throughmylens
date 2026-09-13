export function latestCoverPhotos<T extends { id: string; created_at: string }>(photos: readonly T[], count: 1 | 4 = 1): T[] {
  return [...photos].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id)).slice(0, count);
}
