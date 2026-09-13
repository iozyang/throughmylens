import { copy } from "./copy";
import { localize, type Locale, type Photograph } from "./types";
import styles from "./photography.module.css";
import { formatPhotoDate } from "./metadata-date";

export function ImageMetadata({ photograph, locale }: { photograph: Photograph; locale: Locale }) {
  const date = formatPhotoDate(photograph.date, photograph.time, locale);
  const location = photograph.location && localize(photograph.location, locale).trim();
  const focal = photograph.focalLength35mm;
  const parameters = [focal, photograph.aperture, photograph.shutterSpeed,
    photograph.iso && `ISO ${photograph.iso}`].filter(Boolean);
  return <span className={styles.metadata}>
    <span className={styles.metadataLocation}>{location || (locale === "zh" ? "地点待补充" : "Location not supplied")}</span>
    <span className={styles.metadataDate}>{date}</span>
    <span className={styles.metadataTechnical}>{parameters.length
      ? parameters.map((parameter, index) => <span className={styles.metadataParameter} key={index}>{parameter}{index < parameters.length - 1 ? " " : ""}</span>)
      : copy[locale].noParameters}</span>
    {photograph.demo && <span className={styles.metadataCredit}>© {photograph.credit.name} · {locale === "zh" ? "演示选片" : "Demo"}</span>}
  </span>;
}
