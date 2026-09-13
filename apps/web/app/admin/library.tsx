"use client";

/* Images are preprocessed by the API; do not re-encode private signed URLs with Next. */
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "./library.module.css";

import { privateImageUrl, API, csrf, errorText, request, type Config, type Values, type Photo } from "./photo-api";
import MetadataEditor from "./metadata-editor";
type QueueItem = { id: string; file: File; preview: string; missing: string[]; summary: string; error: string; state: "checked" | "uploading" | "done" | "failed"; progress: number };
const DEFAULTS: Config = { preset: "preserve", long_edge: 3000, quality: 90, min_quality: 80, max_output_kb: 4096 };
const fields: { key: keyof Values; label: string; placeholder: string; numeric?: boolean; optional?: boolean }[] = [
  { key: "camera_make", label: "相机品牌", placeholder: "如 Nikon" },
  { key: "camera_model", label: "相机型号", placeholder: "如 Z 8" },
  { key: "lens", label: "镜头", placeholder: "如 NIKKOR Z 24–70mm f/2.8 S" },
  { key: "focal_length", label: "焦距 · mm", placeholder: "50", numeric: true },
  { key: "aperture", label: "光圈 · f/", placeholder: "2.8", numeric: true },
  { key: "shutter_speed", label: "快门 · 秒", placeholder: "1/250" },
  { key: "iso", label: "ISO", placeholder: "100", numeric: true },
  { key: "captured_at", label: "拍摄时间", placeholder: "2026:09:10 16:30:00", optional: true },
  { key: "location", label: "拍摄地点（公开名称）", placeholder: "如 中国 · 上海 · 外滩" },
];
const bytes = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
const stateLabel: Record<string, string> = { pending: "排队中", processing: "生成展示图", ready: "展示图就绪", failed: "处理失败" };


function Recipe({ config, onChange, disabled = false }: { config: Config; onChange: (v: Config) => void; disabled?: boolean }) {
  return <fieldset className={styles.recipe} disabled={disabled}>
    <legend>展示图处理</legend>
    <div className={styles.presetChoice}>
      {(["preserve", "web_standard"] as const).map((preset) => <label key={preset} className={config.preset === preset ? styles.presetActive : ""}>
        <input type="radio" checked={config.preset === preset} onChange={() => onChange({ ...config, preset })} />
        <span><strong>{preset === "preserve" ? "Preserve" : "Web Standard"}</strong><small>{preset === "preserve" ? "展示大图保留原始像素尺寸" : "按指定长边缩小展示大图"}</small></span>
      </label>)}
    </div>
    <div className={styles.recipeGrid}>
      <label>展示长边 · px<input type="number" min="1280" max="6000" step="1" disabled={config.preset === "preserve"} value={config.long_edge} onChange={(e) => onChange({ ...config, long_edge: Number(e.target.value) })} /></label>
      <label>单个文件上限 · KB<input type="number" min="128" max="16384" value={config.max_output_kb} onChange={(e) => onChange({ ...config, max_output_kb: Number(e.target.value) })} /></label>
      <label>目标 JPEG 质量<input type="number" min="60" max="100" value={config.quality} onChange={(e) => onChange({ ...config, quality: Number(e.target.value) })} /></label>
      <label>最低 JPEG 质量<input type="number" min="60" max={config.quality} value={config.min_quality} onChange={(e) => onChange({ ...config, min_quality: Number(e.target.value) })} /></label>
    </div>
    <p className={styles.hint}>原件始终保留。展示图不放大、不裁切；达到质量下限仍超出体积时会停止并提示。</p>
  </fieldset>;
}

function Editor({ photo, onSaved, onClose }: { photo: Photo; onSaved: (photo: Photo) => void; onClose: () => void }) {
  const [config, setConfig] = useState(photo.processing_config);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = ["pending", "processing"].includes(photo.processing_status);
  async function reprocess() {
    setBusy(true);
    try {
      await request(`/photos/${photo.id}/reprocess`, { method: "POST", body: JSON.stringify(config) });
      onSaved({ ...photo, processing_status: "pending", processing_config: config, processing_error: null });
      setMessage("已加入处理队列，metadata 保留。");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <MetadataEditor photo={photo} onSaved={onSaved} onClose={onClose} initialEdit processing={
    <details className={styles.processingDetails}><summary>图片质量与处理结果</summary>
      <Recipe config={config} onChange={setConfig} disabled={busy || pending} />
      <button className={styles.secondary} disabled={busy || pending} onClick={reprocess}>{pending ? stateLabel[photo.processing_status] : "按以上参数重新生成"}</button>
      <ul className={styles.assets}>{photo.assets.map(a => <li key={a.kind}><span>{a.kind}</span><span>{a.width} × {a.height} / Q{a.quality} / {bytes(a.byte_size)}</span></li>)}</ul>
      {message && <p role="status">{message}</p>}
    </details>
  } />;
}

export default function Library() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [checkingFiles, setCheckingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [limits, setLimits] = useState({ max_upload_mb: 30, max_megapixels: 60 });
  const input = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const focused = photos.find((p) => p.id === selected) || (selectedPhoto?.id === selected ? selectedPhoto : undefined);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const timer = setInterval(() => {
      request<Photo>(`/photos/${selected}`).then(p => { if (active) setSelectedPhoto(p); }).catch(() => {});
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [selected]);

  const refresh = useCallback(async () => {
    try {
      const data = await request<{ items: Photo[]; total: number }>(`/photos?page=${page}`);
      setPhotos(data.items); setTotal(data.total);
    } catch (error) { setMessage((error as Error).message); }
  }, [page]);

  useEffect(() => {
    request<{ email: string }>("/auth/me").then(setUser).catch(() => {}).finally(() => setChecking(false));
    const allocatedUrls = urls.current;
    return () => allocatedUrls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    if (!user) return;
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    request<{ max_upload_mb: number; max_megapixels: number; defaults: Config }>("/photos/config")
      .then((data) => { setLimits(data); setConfig(data.defaults); }).catch(() => {});
  }, [user]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { setUser(await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })); setPassword(""); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (selected && !window.confirm("退出将关闭当前作品编辑，请确认修改已保存。继续退出？")) return;
    try { await request("/auth/logout", { method: "POST" }); setUser(null); setPhotos([]); setSelected(null); setMessage(""); }
    catch (error) { setMessage((error as Error).message); }
  }

  async function checkFiles(files: FileList | File[]) {
    setCheckingFiles(true); setUploadOpen(true);
    const added: QueueItem[] = [];
    for (const file of Array.from(files)) {
      const item: QueueItem = { id: crypto.randomUUID(), file, preview: "", missing: [], summary: "", error: "", state: "checked", progress: 0 };
      try {
        if (!/\.jpe?g$/i.test(file.name)) throw new Error("仅支持 JPEG 文件");
        if (file.size > limits.max_upload_mb * 1024 * 1024) throw new Error(`超过 ${limits.max_upload_mb} MB 上限`);
        const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer());
        if (signature[0] !== 255 || signature[1] !== 216 || signature[2] !== 255) throw new Error("文件内容不是 JPEG");
        const exifr = await import("exifr");
        const tags = (await exifr.parse(file, { gps: false, icc: true, iptc: true, xmp: true })) || {};
        const presence = [tags.Make, tags.Model, tags.LensModel, tags.FocalLength, tags.FNumber, tags.ExposureTime, tags.ISO, tags.City || tags.Location];
        const required = fields.filter((f) => !f.optional);
        item.missing = required.filter((_, i) => !presence[i]).map((f) => f.label);
        item.summary = [tags.Make, tags.Model].filter(Boolean).join(" ") || "未找到相机信息";
        item.preview = URL.createObjectURL(file); urls.current.push(item.preview);
        // Header-level dimensions are checked before sending bytes to the server.
        const image = new Image(); image.src = item.preview; await image.decode();
        if (image.naturalWidth * image.naturalHeight > limits.max_megapixels * 1000000) throw new Error(`超过 ${limits.max_megapixels} MP 像素上限`);
      } catch (error) { item.error = (error as Error).message || "文件无法读取"; item.state = "failed"; }
      added.push(item);
    }
    setQueue((current) => [...current, ...added]); setCheckingFiles(false);
    if (input.current) input.current.value = "";
  }

  async function uploadAll() {
    setUploading(true); setMessage("");
    let firstUploaded: Photo | undefined;
    for (const item of queue.filter((q) => q.state === "checked")) {
      setQueue((current) => current.map((q) => q.id === item.id ? { ...q, state: "uploading" } : q));
      try {
        const params = new URLSearchParams({ filename: item.file.name, ...Object.fromEntries(Object.entries(config).map(([k, v]) => [k, String(v)])) });
        const uploaded = await new Promise<Photo>((resolve, reject) => {
          const xhr = new XMLHttpRequest(); xhr.open("POST", `${API}/api/v1/photos/upload?${params}`); xhr.withCredentials = true; xhr.timeout = 180000;
          xhr.setRequestHeader("Content-Type", "image/jpeg"); xhr.setRequestHeader("X-CSRF-Token", csrf());
          xhr.upload.onprogress = (event) => { if (event.lengthComputable) setQueue((current) => current.map((q) => q.id === item.id ? { ...q, progress: Math.round(event.loaded / event.total * 100) } : q)); };
          xhr.onload = () => {
            let data; try { data = JSON.parse(xhr.responseText); } catch { reject(new Error("服务未返回有效结果，请刷新图库确认。")); return; }
            if (xhr.status >= 200 && xhr.status < 300) resolve(data); else reject(new Error(errorText(data.detail)));
          };
          xhr.onerror = () => reject(new Error("上传连接中断，请检查服务后重试。"));
          xhr.ontimeout = () => reject(new Error("上传超时，请刷新图库确认是否已入库。"));
          xhr.send(item.file);
        });
        firstUploaded ??= uploaded;
        setQueue((current) => current.map((q) => q.id === item.id ? { ...q, state: "done", progress: 100 } : q));
        await refresh();
      } catch (error) { setQueue((current) => current.map((q) => q.id === item.id ? { ...q, state: "failed", error: (error as Error).message } : q)); }
    }
    setUploading(false); setPage(1);
    if (firstUploaded) {
      const first = firstUploaded;
      setPhotos(current => current.some(p => p.id === first.id) ? current : [first, ...current]);
      setSelectedPhoto(first);
      setSelected(first.id); setUploadOpen(false);
    }
  }

  if (checking) return <main className={styles.authPage}><p role="status">正在连接照片管理…</p></main>;
  if (!user) return <main className={styles.authPage}>
    <Link href="/zh" className={styles.wordmark}>through<span>my</span>lens<span className={styles.wordmarkDot}>.</span></Link>
    <form className={styles.login} onSubmit={login}><span className={styles.eyebrow}>THE PRIVATE WORKSPACE</span><h1>回到你的影像档案</h1><p>登录后管理照片、拍摄信息与展示质量。</p>
      <label>管理员邮箱<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>密码<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {message && <p className={styles.error} role="alert">{message}</p>}
      <button className={styles.primary} disabled={busy}>{busy ? "正在登录…" : "登录工作区"}</button>
    </form><span className={styles.authFoot}>throughmylens.icu / 私人摄影档案</span>
  </main>;

  return <main className={styles.workspace}>
    <header className={styles.topbar}><Link href="/zh" target="_blank" className={styles.wordmark}>through<span>my</span>lens<span className={styles.wordmarkDot}>.</span></Link><div><Link href="/zh" target="_blank" rel="noreferrer">查看网站 ↗</Link><span>{user.email}</span><button onClick={logout} className={styles.textButton} disabled={uploading}>退出</button></div></header>
    <div className={styles.workspaceBody}>
      <aside className={styles.sidebar}><span className={styles.eyebrow}>WORKSPACE</span><div className={styles.navActive}><span>照片资产库</span><span>{total.toString().padStart(2, "0")}</span></div><p>原件私有保存<br />展示质量由你决定</p><div className={styles.sidebarBottom}>V1 / COLLECTION<br /><span>throughmylens.icu</span></div></aside>
      <div className={styles.collection}>
        <div className={styles.collectionHeader}><div><span className={styles.eyebrow}>YOUR PHOTOGRAPHIC ARCHIVE</span><h1>照片资产库<span>{total}</span></h1><p>整理每一张照片，让影像以你期望的方式呈现。</p></div><div className={styles.headerActions}><Link className={styles.secondary} href="/admin/photos">管理我的照片</Link><button className={styles.primary} onClick={() => { setUploadOpen(true); input.current?.click(); }} disabled={checkingFiles || uploading}>＋ 添加照片</button></div></div>
        <input ref={input} type="file" accept="image/jpeg,.jpg,.jpeg" multiple hidden onChange={(e) => { if (e.target.files) void checkFiles(e.target.files); }} />
        {message && <div role="alert" className={styles.error}>{message}<button className={styles.textButton} onClick={() => setMessage("")}>关闭</button></div>}
        {uploadOpen && <section className={styles.uploadPanel} aria-label="照片上传">
          <div className={styles.sectionLabel}><h2>上传前检查</h2><button className={styles.textButton} disabled={uploading || checkingFiles} onClick={() => setUploadOpen(false)}>收起 −</button></div>
          <div className={styles.dropzone} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!uploading && !checkingFiles) void checkFiles(e.dataTransfer.files); }}><button className={styles.textButton} disabled={uploading || checkingFiles} onClick={() => input.current?.click()}>{checkingFiles ? "正在读取拍摄信息…" : "拖入照片，或点击选择 JPEG"}</button><span>sRGB · 单张 ≤ {limits.max_upload_mb} MB · ≤ {limits.max_megapixels} MP</span></div>
          <ul className={styles.queue}>{queue.map((item) => <li key={item.id}>{item.preview && <img src={item.preview} alt="待上传照片预览" />}<div><strong>{item.file.name}</strong><span>{bytes(item.file.size)} · {item.summary}</span>{item.missing.length > 0 && <span className={styles.warning}>待补全：{item.missing.join("、")}</span>}{item.error && <span className={styles.error}>{item.error}</span>}{item.state === "uploading" && <progress value={item.progress} max={100} />}</div><span>{item.state === "done" ? "已入库" : item.state === "uploading" ? item.progress === 100 ? "校验中…" : `${item.progress}%` : item.state === "failed" ? "未入库" : "待上传"}</span>{!uploading && <button className={styles.textButton} aria-label={`移出队列 ${item.file.name}`} onClick={() => { URL.revokeObjectURL(item.preview); setQueue((current) => current.filter((q) => q.id !== item.id)); }}>×</button>}</li>)}</ul>
          <p className={styles.hint}>拍摄信息检查在本机完成，sRGB 由服务端复核。缺少拍摄信息的照片可先存为草稿，在右侧补齐后确认审核。</p>
          <details><summary>本批次的展示质量 · {config.preset === "preserve" ? "Preserve" : "Web Standard"}</summary><Recipe config={config} onChange={setConfig} disabled={uploading} /></details>
          <div className={styles.uploadActions}><span>入库不会自动公开作品</span><button className={styles.primary} onClick={uploadAll} disabled={uploading || checkingFiles || !queue.some((q) => q.state === "checked")}>{uploading ? "正在上传与校验…" : `上传 ${queue.filter((q) => q.state === "checked").length} 张照片`}</button></div>
        </section>}
        <div className={styles.libraryBar}><span>全部照片 / {total.toString().padStart(2, "0")}</span><button onClick={refresh} className={styles.textButton}>刷新</button></div>
        {photos.length ? <div className={styles.grid}>{photos.map((photo, index) => {
          const thumbnail = photo.assets.find((a) => a.kind === "thumbnail");
          return <button key={photo.id} className={`${styles.photoCard} ${photo.id === selected ? styles.selected : ""}`} onClick={() => { if (selected && selected !== photo.id) { setMessage("请先关闭右侧作品编辑，再选择另一张照片。"); return; } setSelected(photo.id); }} aria-pressed={selected === photo.id}>
            <div className={styles.thumbnail}>{thumbnail ? <img src={privateImageUrl(thumbnail.url)} alt={photo.translations.zh.alt_text || photo.translations.zh.title || photo.filename} /> : <span>{stateLabel[photo.processing_status]}</span>}<span className={styles.photoIndex}>{String((page - 1) * 40 + index + 1).padStart(2, "0")}</span></div>
            <h3>{photo.translations.zh.title || photo.filename}</h3><p>{photo.width} × {photo.height}<span>{bytes(photo.byte_size)}</span></p><div className={styles.cardStatus}><span className={photo.processing_status === "failed" ? styles.warning : ""}>{stateLabel[photo.processing_status]}</span><span>{photo.review_status === "reviewed" ? "已核对" : photo.missing_fields.length ? `待补 ${photo.missing_fields.length} 项` : "待核对"}</span></div>
          </button>;
        })}</div> : <div className={styles.empty}><div className={styles.emptyFrame}>＋</div><h2>从第一张照片开始</h2><p>上传你的 sRGB JPEG，系统会提取拍摄信息<br />并按设定的质量生成展示图片。</p><button className={styles.secondary} onClick={() => { setUploadOpen(true); input.current?.click(); }}>选择照片</button></div>}
        {total > 40 && <nav className={styles.pagination} aria-label="图库分页"><button disabled={page === 1 || !!selected} onClick={() => setPage(page - 1)}>上一页</button><span>{page} / {Math.ceil(total / 40)}</span><button disabled={page * 40 >= total || !!selected} onClick={() => setPage(page + 1)}>下一页</button></nav>}
      </div>
      {focused && <Editor key={focused.id} photo={focused} onClose={() => setSelected(null)} onSaved={(result) => setPhotos((current) => result.publication_status === "deleted" ? current.filter(p => p.id !== result.id) : current.map((p) => p.id === result.id ? result : p))} />}
    </div>
  </main>;
}
