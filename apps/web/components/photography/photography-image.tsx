"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ImageMetadata } from "./image-metadata";
import { PhotoGesture } from "./photo-gesture";
import { copy } from "./copy";
import { localize, type Locale, type Photograph, type ViewerSelection } from "./types";
import styles from "./photography.module.css";

export function PhotographyImage({ photograph, locale, duplicate = false, layout = "strip", sizes, onView }: {
  photograph: Photograph; locale: Locale; duplicate?: boolean; layout?: "strip" | "gallery"; sizes?: string; onView: (selection: ViewerSelection) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [gesture] = useState(() => new PhotoGesture());
  const [details, setDetails] = useState(false);
  const [holding, setHolding] = useState(false);
  const touchInput = useRef(false);
  const suppressClick = useRef(false);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (!details) return;
    const timer = setTimeout(() => setDetails(false), 3500);
    return () => clearTimeout(timer);
  }, [details]);
  useEffect(() => () => gesture.cancel(), [gesture]);
  const open = () => {
    const source = button.current;
    const image = source?.querySelector("img");
    if (source && image?.complete && image.naturalWidth) {
      onView({ photograph, source, previewSrc: image.currentSrc });
    }
  };
  return <button ref={button} type="button" className={styles.photographyImage}
    style={{ "--image-ratio": photograph.width / photograph.height } as CSSProperties}
    data-details={details} data-holding={holding} data-photo-id={photograph.id} data-touch={touch} data-layout={layout}
    tabIndex={duplicate ? -1 : 0}
    aria-label={`${copy[locale].view}: ${localize(photograph.alt, locale)}`}
    onContextMenu={(event) => event.preventDefault()}
    onMouseDown={(event) => { if (duplicate) event.preventDefault(); }}
    onDragStart={(event) => event.preventDefault()}
    onPointerDown={(event) => {
      const touch = event.pointerType !== "mouse";
      touchInput.current = touch; suppressClick.current = false; setTouch(touch);
      setHolding(touch);
      gesture.start(event.clientX, event.clientY, touch, () => { setHolding(false); open(); });
    }}
    onPointerMove={(event) => {
      if (gesture.move(event.clientX, event.clientY)) setHolding(false);
    }}
    onPointerUp={() => {
      suppressClick.current = touchInput.current;
      if (gesture.release() === "metadata") setDetails((value) => !value);
      setHolding(false);
    }}
    onPointerCancel={() => { gesture.cancel(); setHolding(false); }}
    onPointerLeave={() => { gesture.leave(); setHolding(false); }}
    onBlur={() => { if (!touchInput.current) setDetails(false); }}
    onKeyDown={() => { suppressClick.current = false; setTouch(false); }}
    onClick={(event) => {
      if (suppressClick.current) { suppressClick.current = false; return; }
      // Keyboard activation remains fullscreen, including with a touch screen attached.
      const action = gesture.click(event.detail === 0);
      if (action === "metadata") setDetails((value) => !value);
      if (action === "fullscreen") open();
    }}>
    <Image src={photograph.src} alt={localize(photograph.alt, locale)} width={photograph.width}
      height={photograph.height} sizes={sizes ?? `(max-width: 760px) ${Math.ceil(photograph.width / photograph.height * 280)}px, ${Math.ceil(photograph.width / photograph.height * 420)}px`}
      quality={80} draggable={false} />
    <ImageMetadata photograph={photograph} locale={locale} />
  </button>;
}
