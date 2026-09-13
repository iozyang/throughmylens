import Image from "next/image";
import Link from "next/link";
import { copy } from "./copy";
import { SectionHeading } from "./section-heading";
import { localize, type Locale, type Photograph, type Project } from "./types";
import styles from "./photography.module.css";

export function SelectedProjects({ projects, photographs, locale }: { projects: Project[]; photographs: Photograph[]; locale: Locale }) {
  const text = copy[locale];
  return <section className={styles.projects} aria-labelledby="projects-heading">
    <SectionHeading id="projects-heading" title={text.selectedProjects} href={`/${locale}/projects`} label={text.exploreProjects} />
    <div className={styles.projectSequence}>
      {projects.map((project) => {
        const photo = photographs.find((item) => item.id === project.photographId);
        if (!photo) return null;
        return <article key={project.slug} className={styles.project}>
          <Link href={`/${locale}/projects/${project.slug}`}>
            <Image src={photo.src} alt={localize(photo.alt, locale)} width={photo.width} height={photo.height}
              quality={90} sizes="(max-width: 760px) 90vw, 70vw" />
            <div className={styles.projectCaption}><h3>{localize(project.title, locale)}</h3>
              <span>{project.year}{photo.demo && ` · ${locale === "zh" ? "演示项目" : "Demo project"}`}</span>
            </div>
          </Link>
        </article>;
      })}
    </div>
  </section>;
}
