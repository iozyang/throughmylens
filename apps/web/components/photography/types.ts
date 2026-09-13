export type Locale = "zh" | "en";
export type LocalizedText = { zh: string; en?: string };

export function localize(value: LocalizedText, locale: Locale): string {
  return (locale === "en" && value.en?.trim()) || value.zh;
}

export type Photograph = {
  id: string;
  src: string;
  fullSrc?: string;
  width: number;
  height: number;
  alt: LocalizedText;
  title?: LocalizedText;
  location?: LocalizedText;
  demo?: boolean;
  date?: string;
  time?: string;
  focalLength?: string;
  focalLength35mm?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: number;
  order: number;
  focalPosition: { desktop: string; mobile: string };
  credit: { name: string; url: string; license: string };
};

export type Project = {
  slug: string;
  title: LocalizedText;
  year?: string;
  photographId: string;
};

export type Place = {
  slug: string;
  name: LocalizedText;
  coordinates: [longitude: number, latitude: number];
  photographId: string;
};

export type ViewerSelection = {
  photograph: Photograph;
  source: HTMLElement;
  previewSrc: string;
};
