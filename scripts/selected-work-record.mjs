const localized = () => ({ zh: "", en: "" });

export function upgradeRecord(record) {
  // Parsing a known maker prefix preserves the original words; unknown strings
  // remain intact in model. Lens brand is never inferred from camera brand.
  const camera = typeof record.camera === "string" ? (() => {
    const match = record.camera.match(/^(NIKON CORPORATION|DJI|Hasselblad|SONY|Canon|FUJIFILM|Nikon|Sony|Apple)(?:\s+(.*))?$/);
    return match ? { brand: match[1], model: match[2] ?? "" } : { brand: "", model: record.camera };
  })() : record.camera ?? { brand: "", model: "" };
  const lens = typeof record.lens === "string" ? { brand: "", model: record.lens } : record.lens ?? { brand: "", model: "" };
  const location = record.location?.display ? record.location : {
    place: localized(), district: localized(), city: localized(), region: localized(), country: localized(),
    countryCode: "", display: record.location ?? localized(), geocodeQuery: localized(),
  };
  return {
    slug: record.slug, file: record.file, src: record.src, width: record.width, height: record.height, order: record.order,
    title: record.title ?? localized(), alt: record.alt ?? localized(), description: record.description ?? localized(),
    location,
    geo: { latitude: record.geo?.latitude ?? "", longitude: record.geo?.longitude ?? "", coordinateSystem: record.geo?.coordinateSystem ?? "WGS84", source: record.geo?.source ?? "", precision: record.geo?.precision ?? "" },
    date: record.date ?? "", time: record.time ?? "", timezone: record.timezone ?? "",
    camera, lens,
    focalLength: record.focalLength ?? "", focalLength35mm: record.focalLength35mm ?? "",
    aperture: record.aperture ?? "", shutterSpeed: record.shutterSpeed ?? "", iso: record.iso ?? "",
    series: record.series ?? { slug: "", zh: "", en: "" }, tags: record.tags?.length ? record.tags : "",
  };
}
