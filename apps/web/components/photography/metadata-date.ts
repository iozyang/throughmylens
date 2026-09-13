export function validPhotoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function formatPhotoDate(date: string | undefined, time: string | undefined, locale: "zh" | "en") {
  if (!date || !validPhotoDate(date)) return locale === "zh" ? "时间待补充" : "Date not supplied";
  const formatted = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
  // EXIF wall-clock time has no implied timezone. Never shift the capture date.
  return time && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time) ? `${formatted} ${time}` : formatted;
}
