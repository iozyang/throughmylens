"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { privateImageUrl, request, type Photo } from "./photo-api";
import MetadataEditor from "./metadata-editor";
import { latestCoverPhotos } from "./album-cover";
import GalleryImage from "./gallery-image";
import { useGalleryLayout } from "./use-gallery-layout";
import { useGalleryPreload } from "./use-gallery-preload";
import styles from "./asset-manager.module.css";

const columns = [16, 8, 4, 3, 1];
export default function AlbumManager() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState(2);
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(true);
  const grid = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  const captureLayout = useGalleryLayout(grid, mode);
  const noClickBefore = useRef(0);
  const [limit, setLimit] = useState(256);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const job = ++generation.current;
    setLoading(true); setError("");
    try {
      try { await request("/auth/me"); setSignedIn(true); }
      catch { setSignedIn(false); throw new Error("请先在后台首页登录，再进入相册。"); }
      const collected: Photo[] = [];
      for (let page = 1; ; page++) {
        const data = await request<{ items: Photo[]; total: number }>(`/photos?page=${page}&page_size=200&deleted=${deleted}`);
        if (job !== generation.current) return;
        collected.push(...data.items);
        if (collected.length >= data.total || !data.items.length) break;
      }
      setPhotos([...new Map(collected.map(p => [p.id, p])).values()]);
    } catch (e) { if (job === generation.current) setError((e as Error).message); }
    finally { if (job === generation.current) setLoading(false); }
  }, [deleted]);
  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    const counter = generation;
    return () => { clearTimeout(timer); counter.current++; };
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    const timer = setInterval(() => {
      request<Photo>(`/photos/${selected}`).then(p => { if (active) setPhotos(current => current.map(v => v.id === p.id ? p : v)); }).catch(() => {});
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [selected]);

  const changeMode = useCallback((next: number, x?: number, y?: number) => {
    next = Math.max(0, Math.min(4, next));
    if (next === modeRef.current) return;
    captureLayout(x, y);
    modeRef.current = next; setMode(next);
  }, [captureLayout]);
  useEffect(() => {
    const node = grid.current;
    if (!node) return;
    let lastWheel = 0;
    let pinchDistance = 0;
    const distance = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    const wheel = (e: WheelEvent) => {
      if (!unlocked || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      if (Date.now() - lastWheel < 240 || Math.abs(e.deltaY) < 2) return;
      lastWheel = Date.now(); changeMode(modeRef.current + (e.deltaY < 0 ? 1 : -1), e.clientX, e.clientY);
    };
    const touchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { e.preventDefault(); pinchDistance = distance(e); noClickBefore.current = Date.now() + 800; }
    };
    const touchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchDistance) return;
      e.preventDefault(); noClickBefore.current = Date.now() + 800;
      const d = distance(e), ratio = d / pinchDistance;
      if (ratio > 1.2 || ratio < .8) {
        changeMode(modeRef.current + (ratio > 1 ? 1 : -1), (e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2);
        pinchDistance = d;
      }
    };
    const end = () => { pinchDistance = 0; };
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("touchstart", touchStart, { passive: false });
    node.addEventListener("touchmove", touchMove, { passive: false });
    node.addEventListener("touchend", end); node.addEventListener("touchcancel", end);
    return () => { node.removeEventListener("wheel", wheel); node.removeEventListener("touchstart", touchStart); node.removeEventListener("touchmove", touchMove); node.removeEventListener("touchend", end); node.removeEventListener("touchcancel", end); };
  }, [unlocked, changeMode, category, loading]);

  const projects = [...new Map(photos.filter(p => p.record.series.slug).map(p => [p.record.series.slug, p.record.series])).values()];
  const filtered = useMemo(() => photos.filter(p => category === "all" || category === p.record.series.slug).sort((a, b) => (Number(a.record.order) - Number(b.record.order)) || a.id.localeCompare(b.id)), [photos, category]);
  useGalleryPreload(grid, filtered, mode);
  const focused = photos.find(p => p.id === selected);
  function enter(key: string) { setCategory(key); setLimit(256); setUnlocked(false); }
  const cover = (items: Photo[], count: 1 | 4 = 1) => <div className={styles.albumCover}>{latestCoverPhotos(items, count).map(p => { const image = p.assets.find(a => a.kind === "thumbnail"); return image ? <img key={p.id} src={privateImageUrl(image.url)} alt="" loading="lazy" /> : <span key={p.id}>处理中</span>; })}{!items.length && <span>暂无照片</span>}</div>;

  return <main className={styles.manager}>
    <header className={styles.managerHeader}><Link href="/admin">← 后台首页</Link><span className={styles.kicker}>THROUGHMYLENS / PRIVATE ARCHIVE</span></header>
    <div className={styles.heading}><div><h1>{category ? category === "all" ? deleted ? "最近删除" : "全部照片" : projects.find(p => p.slug === category)?.zh || category : "管理我的照片"}</h1><p>{category ? `${filtered.length} 张照片` : "按项目整理你的影像"}</p></div><div className={styles.toolbar}>{category && <button onClick={() => { setCategory(null); setUnlocked(false); }}>返回相册</button>}<button disabled={loading} onClick={load}>刷新</button><button disabled={loading} onClick={() => { setPhotos([]); setDeleted(!deleted); setCategory(null); }}>{deleted ? "返回照片" : "最近删除"}</button></div></div>
    {error && <p className={styles.notice} role="alert">{error} {!signedIn && <Link href="/admin">前往登录</Link>}</p>}
    {loading && <p role="status">正在读取私有照片…</p>}
    {!loading && signedIn && !category && <><div className={styles.albums}><button className={styles.album} onClick={() => enter("all")}>{cover(photos, deleted ? 1 : 4)}<strong>{deleted ? "最近删除" : "全部照片"}</strong><span>{photos.length}</span></button>{projects.map(project => { const items = photos.filter(p => p.record.series.slug === project.slug); return <button className={styles.album} key={project.slug} onClick={() => enter(project.slug)}>{cover(items)}<strong>{project.zh || project.en || project.slug}</strong><span>{items.length}</span></button>; })}</div>{!projects.length && !deleted && <p className={styles.hint}>在照片的 Metadata 中填写项目标识与名称，这里会自动生成对应相册。</p>}</>}
    {category && signedIn && <><div className={styles.zoomBar}><div className={styles.toolbar}><button aria-pressed={unlocked} onClick={() => setUnlocked(!unlocked)}>{unlocked ? "滚轮缩放已解锁" : "解锁滚轮缩放"}</button><button aria-label="缩小缩略图" disabled={mode === 0} onClick={() => changeMode(mode - 1)}>−</button><span aria-live="polite">{columns[mode]} 列{mode === 4 ? " / 原比例" : ""}</span><button aria-label="放大缩略图" disabled={mode === 4} onClick={() => changeMode(mode + 1)}>＋</button></div><p className={styles.hint}>{unlocked ? "滚轮调整照片大小；再次点击锁定后恢复上下浏览。" : "滚轮上下浏览。手机可双指缩放，也可使用 ＋ / −。"}</p></div>
      <div ref={grid} className={`${styles.photoGrid} ${mode === 4 ? styles.natural : ""}`} style={{ "--columns": columns[mode] } as CSSProperties}>
        {filtered.slice(0, limit).map((p, index) => <GalleryImage key={p.id} photo={p} mode={mode} index={index} onOpen={() => { if (Date.now() >= noClickBefore.current) setSelected(p.id); }} />)}
      </div>{!filtered.length && !loading && <p className={styles.empty}>这个相册还没有照片。</p>}{filtered.length > limit && <button className={styles.loadMore} onClick={() => setLimit(limit + 256)}>继续显示照片（{limit} / {filtered.length}）</button>}
    </>}
    {focused && <MetadataEditor key={focused.id} photo={focused} onClose={() => setSelected(null)} onSaved={p => { setPhotos(current => p.publication_status === (deleted ? "deleted" : "draft") ? current.map(v => v.id === p.id ? p : v) : current.filter(v => v.id !== p.id)); }} />}
  </main>;
}
