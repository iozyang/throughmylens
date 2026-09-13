"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { localize, type Locale, type Photograph } from "./types";
import styles from "./photography.module.css";

export function HeroSlideshow({ photographs, locale, paused = false }: {
  photographs: Photograph[]; locale: Locale; paused?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [slots, setSlots] = useState([0, Math.min(1, photographs.length - 1)]);
  const [ready, setReady] = useState<Record<string, boolean>>({});
  const [visible, setVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  const transitioning = useRef(false);
  const lastTransition = useRef(0);
  const replacement = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => { if (replacement.current) clearTimeout(replacement.current); }, []);
  useEffect(() => {
    if (paused || !visible || photographs.length < 2) return;
    const timer = setInterval(() => {
      if (!lastTransition.current) lastTransition.current = performance.now();
      if (performance.now() - lastTransition.current < 7200) return;
      const nextSlot = 1 - active;
      const nextPhoto = photographs[slots[nextSlot]];
      if (document.hidden || transitioning.current || !ready[nextPhoto.id]) return;
      transitioning.current = true;
      lastTransition.current = performance.now();
      setActive(nextSlot);
      replacement.current = setTimeout(() => {
        setSlots((previous) => {
          const next = [...previous];
          next[active] = (previous[nextSlot] + 1) % photographs.length;
          return next;
        });
        transitioning.current = false;
      }, 1600);
    }, 200);
    return () => clearInterval(timer);
  }, [active, slots, ready, photographs, paused, visible]);

  return (
    <section ref={root} className={styles.hero} aria-label={locale === "zh" ? "摄影选片" : "Featured photographs"}
      onContextMenu={(event) => event.preventDefault()}>
      {slots.map((index, slot) => {
        const photo = photographs[index];
        if (!photo || (slot === 1 && photographs.length === 1)) return null;
        return <div key={slot} className={styles.heroLayer} data-active={slot === active}
          aria-hidden={slot !== active} style={{ "--focal-desktop": photo.focalPosition.desktop,
            "--focal-mobile": photo.focalPosition.mobile } as CSSProperties}>
          <Image key={photo.id} src={photo.src} alt={localize(photo.alt, locale)} fill
            draggable={false}
            sizes="100vw" quality={90} preload={slot === 0 && index === 0}
            loading={slot === 0 && index === 0 ? undefined : "eager"}
            onLoad={(event) => {
              const image = event.currentTarget;
              const markReady = () => { if (image.naturalWidth) setReady((value) => ({ ...value, [photo.id]: true })); };
              void image.decode().then(markReady).catch(markReady);
            }} />
        </div>;
      })}
    </section>
  );
}
