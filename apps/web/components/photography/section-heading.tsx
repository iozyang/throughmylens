import Link from "next/link";
import styles from "./photography.module.css";

export function SectionHeading({ id, title, href, label }: { id: string; title: string; href: string; label: string }) {
  return <div className={styles.sectionHeading}>
    <h2 id={id}>{title}</h2>
    <Link href={href}>{label}<span aria-hidden="true">→</span></Link>
  </div>;
}
