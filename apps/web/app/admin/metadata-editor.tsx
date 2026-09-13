"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { request, type CatalogRecord, type Photo, type TextPair } from "./photo-api";
import { cities, countries, regions } from "./location-options";
import styles from "./asset-manager.module.css";

function derive(record: CatalogRecord): CatalogRecord {
  const location = { ...record.location, display: { zh: "", en: "" } };
  for (const lang of ["zh", "en"] as const) {
    if (lang === "en" && (["place", "district", "city", "region", "country"] as const).some(k => location[k].zh && !location[k].en)) continue;
    location.display[lang] = [...new Set((["place", "district", "city", "region", "country"] as const).map(k => location[k][lang]).filter(Boolean))].join(lang === "zh" ? "，" : ", ");
  }
  const inferred = location.countryCode === "CN" ? ({ 香港: "Asia/Hong_Kong", 澳门: "Asia/Macau" }[location.region.zh] || "Asia/Shanghai") : countries.find(c => c.code === location.countryCode)?.timezone;
  return { ...record, location, timezone: inferred || record.timezone };
}

export default function MetadataEditor({ photo, onSaved, onClose, initialEdit = false, processing }: {
  photo: Photo; onSaved: (p: Photo) => void; onClose: () => void; initialEdit?: boolean; processing?: ReactNode;
}) {
  const [record, setRecord] = useState(photo.record);
  const [version, setVersion] = useState(photo.version);
  const [editing, setEditing] = useState(initialEdit);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewed, setReviewed] = useState(photo.review_status === "reviewed");
  const [locale, setLocale] = useState<"zh" | "en">("zh");
  const [tagInput, setTagInput] = useState(Array.isArray(photo.record.tags) ? photo.record.tags.join("，") : "");
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const asset = photo.assets.find(a => a.kind === "display") || photo.assets.find(a => a.kind === "gallery");
  // Processing may finish while this form has unsaved edits. Only update system dimensions.
  const current = derive({ ...record, width: photo.record.width, height: photo.record.height });
  const deleted = photo.publication_status === "deleted";
  const missing = [!record.camera.brand && "相机品牌", !record.camera.model && "相机型号", !record.lens.model && "镜头", !record.focalLength && "焦距", !record.aperture && "光圈", !record.shutterSpeed && "快门", !record.iso && "ISO", !current.location.display.zh && !current.location.display.en && "地点"].filter(Boolean);

  useEffect(() => {
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node?.showModal();
    return () => { node?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  useEffect(() => {
    if (editing) form.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }, [editing]);
  function change(next: CatalogRecord) { setRecord(derive(next)); setDirty(true); setReviewed(false); }
  function close() { if (!busy && (!dirty || window.confirm("有未保存的修改，确定关闭？"))) onClose(); }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await request<Photo>(`/photos/${photo.id}/metadata`, { method: "PATCH", body: JSON.stringify({ version, record: current, reviewed }) });
      setRecord(result.record); setVersion(result.version); setDirty(false); onSaved(result); setMessage("完整 JSON 已保存，图片文件名保持不变。");
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  async function removeOrRestore() {
    if (!window.confirm(deleted ? "将这张照片恢复到草稿相册？" : "将照片移入最近删除？原件与 metadata 会保留，可从最近删除恢复。未保存的修改不会保留。")) return;
    setBusy(true);
    try {
      await request(`/photos/${photo.id}${deleted ? "/restore" : ""}`, { method: deleted ? "POST" : "DELETE", body: JSON.stringify({ version }) });
      onSaved({ ...photo, publication_status: deleted ? "draft" : "deleted" }); onClose();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  function bilingual(label: string, value: TextPair, update: (value: TextPair) => void, placeholder = "", list?: string, max = 1000) {
    return <div className={styles.pair}><span>{label}</span><label><span className={styles.srOnly}>{label} 中文</span><input maxLength={max} list={list} placeholder={placeholder || "中文"} value={value.zh} onChange={e => update({ ...value, zh: e.target.value })} /></label><label><span className={styles.srOnly}>{label} 英文</span><input maxLength={max} placeholder="English（可留空）" value={value.en} onChange={e => update({ ...value, en: e.target.value })} /></label></div>;
  }

  return <dialog ref={dialog} className={styles.viewer} aria-labelledby="photo-detail-title" onCancel={e => { e.preventDefault(); close(); }}>
    <header className={styles.viewerHeader}><div><span className={styles.kicker}>PHOTO ARCHIVE</span><h2 id="photo-detail-title">{current.title.zh || current.location.display.zh || "作品信息"}</h2></div><button onClick={close} disabled={busy}>关闭 {dirty ? "（未保存）" : ""} ×</button></header>
    <div className={styles.detailLayout}>
      <div className={styles.largePhoto}>{asset ? <img src={asset.url} alt={current.alt[locale] || current.alt.zh || "照片预览"} /> : <p>{photo.processing_error || "正在生成展示图…"}</p>}
        <div className={styles.photoCaption}><p>{current.location.display[locale] || current.location.display.zh}</p><p>{[current.date, current.time].filter(Boolean).join(" ")}</p><p className={styles.parameters}>{[current.focalLength, current.aperture, current.shutterSpeed, current.iso ? `ISO ${current.iso}` : ""].filter(Boolean).map((v, i) => <span key={i}>{v}</span>)}</p></div>
        <div className={styles.previewControls}><button aria-pressed={locale === "zh"} onClick={() => setLocale("zh")}>中文预览</button><button aria-pressed={locale === "en"} onClick={() => setLocale("en")}>English</button><span>{current.width || "—"} × {current.height || "—"} px</span></div>
      </div>
      <div className={styles.information}>
        <div className={styles.toolbar}><button aria-pressed={!editing} onClick={() => setEditing(false)}>JSON 信息</button><button aria-pressed={editing} disabled={deleted} onClick={() => setEditing(true)}>编辑 Metadata</button><button className={styles.danger} disabled={busy || ["pending", "processing"].includes(photo.processing_status)} onClick={removeOrRestore}>{deleted ? "恢复照片" : "删除照片"}</button></div>
        {message && <p className={styles.notice} role="status">{message}</p>}
        {photo.processing_error && <p role="alert">{photo.processing_error}</p>}
        {!editing ? <><p className={styles.hint}>私有作品信息 · {dirty ? "未保存的预览" : "已保存"} · 空白英文回退中文展示</p><dl className={styles.summaryCard}><div><dt>名称</dt><dd>{current.file}</dd></div><div><dt>时间</dt><dd>{[current.date, current.time].filter(Boolean).join(" ") || "待补充"}</dd></div><div><dt>大小</dt><dd>{current.width || "—"} × {current.height || "—"} px{asset ? ` / ${(asset.byte_size / 1024 / 1024).toFixed(2)} MB` : ""}</dd></div><div><dt>地点</dt><dd>{current.location.display[locale] || current.location.display.zh || "待补充"}</dd></div><div><dt>参数</dt><dd className={styles.parameters}>{[current.focalLength, current.aperture, current.shutterSpeed, current.iso ? `ISO ${current.iso}` : ""].filter(Boolean).map((v, i) => <span key={i}>{v}</span>)}</dd></div><div><dt>项目</dt><dd>{current.series.zh || current.series.en || "未归类"}</dd></div></dl><details><summary>展开完整 JSON</summary><pre className={styles.json}>{JSON.stringify(current, null, 2)}</pre></details><button onClick={() => { const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${current.slug}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>下载此份 JSON</button></> :
          <form ref={form} onSubmit={save} className={styles.metadataForm}>
            <fieldset disabled={busy || deleted}><legend>作品内容</legend>
              {bilingual("标题", record.title, title => change({ ...record, title }), "如：雪的脉络", undefined, 300)}
              {bilingual("替代文本", record.alt, alt => change({ ...record, alt }), "如：雪原中蜿蜒的河流")}
              {bilingual("作品描述", record.description, description => change({ ...record, description }), "可选", undefined, 10000)}
            </fieldset>
            <fieldset disabled={busy || deleted}><legend>拍摄地点</legend>
              <label>国家 / 地区<select value={countries.some(c => c.code === record.location.countryCode) ? record.location.countryCode : "custom"} onChange={e => { const c = countries.find(c => c.code === e.target.value); change({ ...record, timezone: c?.timezone || "", location: { ...record.location, countryCode: c?.code || "", country: { zh: c?.zh || "", en: c?.en || "" }, region: { zh: "", en: "" }, city: { zh: "", en: "" }, district: { zh: "", en: "" } } }); }}><option value="custom">未指定 / 其他</option>{countries.map(c => <option key={c.code} value={c.code}>{c.zh}</option>)}</select></label>
              {bilingual("国家名称", record.location.country, country => change({ ...record, location: { ...record.location, country } }), "如：中国")}
              <label>国家代码<input maxLength={2} pattern="[A-Z]{2}|" placeholder="如：CN" value={record.location.countryCode} onChange={e => change({ ...record, timezone: "", location: { ...record.location, countryCode: e.target.value.toUpperCase() } })} /></label>
              {(["region", "city", "district", "place"] as const).map(k => <div key={k}>{bilingual(({ region: "省 / 州", city: "城市", district: "区 / 县", place: "地点" })[k], record.location[k], v => change({ ...record, location: { ...record.location, [k]: v } }), k === "place" ? "如：哈尔滨南站" : "选择建议或直接填写", k === "region" && record.location.countryCode === "CN" ? "photo-regions" : k === "city" && record.location.countryCode === "CN" ? "photo-cities" : undefined, 300)}</div>)}
              <datalist id="photo-regions">{regions.map(v => <option key={v} value={v} />)}</datalist><datalist id="photo-cities">{(cities[record.location.region.zh] || []).map(v => <option key={v} value={v} />)}</datalist>
              <p className={styles.hint}>地点 {record.location.place.zh.length} 字，建议不超过 18 字；菜单使用不带“省”“市”的名称。城市建议不是完整行政区库，可自行补充。</p>
              <label>展示地点（自动生成）<textarea readOnly rows={2} value={current.location.display.zh} /></label><p className={styles.hint}>按地点、区县、城市、省州、国家拼接并去重，不可直接修改。英文同规则生成。</p>
              {bilingual("定位检索词（可选）", record.location.geocodeQuery, geocodeQuery => change({ ...record, location: { ...record.location, geocodeQuery } }), "留待地图功能使用")}
            </fieldset>
            <fieldset disabled={busy || deleted}><legend>拍摄日期与时区</legend><div className={styles.twoColumns}>
              <label>日期<input type="date" value={record.date} onChange={e => change({ ...record, date: e.target.value })} /></label><label>时间<input type="time" step="1" value={record.time} onChange={e => change({ ...record, time: e.target.value.length === 5 ? `${e.target.value}:00` : e.target.value })} /></label>
            </div><label>时区<input placeholder="如：Asia/Shanghai" value={current.timezone} onChange={e => change({ ...record, timezone: e.target.value })} /></label><p className={styles.hint}>中国等已支持地点自动填写；多时区国家或未知地点请补充 IANA 时区，不会根据经度猜测。</p></fieldset>
            <fieldset disabled={busy || deleted}><legend>设备与参数</legend>
              {(["camera", "lens"] as const).map(k => <div key={k} className={styles.twoColumns}><label>{k === "camera" ? "相机" : "镜头"}品牌<input placeholder={k === "camera" ? "如：Nikon" : "如：NIKKOR"} maxLength={200} value={record[k].brand} onChange={e => change({ ...record, [k]: { ...record[k], brand: e.target.value } })} /></label><label>型号<input maxLength={300} placeholder={k === "camera" ? "如：Z 8" : "如：Z 24–70mm f/2.8 S"} value={record[k].model} onChange={e => change({ ...record, [k]: { ...record[k], model: e.target.value } })} /></label></div>)}
              <div className={styles.twoColumns}>{([ ["focalLength", "焦距", "50mm"], ["focalLength35mm", "35mm 等效焦距", "75mm"], ["aperture", "光圈", "f/2.8"], ["shutterSpeed", "快门", "1/250s"] ] as const).map(([k, label, sample]) => <label key={k}>{label}<input placeholder={`如：${sample}`} value={record[k]} onChange={e => change({ ...record, [k]: e.target.value })} /></label>)}<label>ISO<input type="number" min="1" step="1" max="10000000" placeholder="如：100" value={record.iso} onChange={e => change({ ...record, iso: e.target.value === "" ? "" : Number(e.target.value) })} /></label></div>
            </fieldset>
            <fieldset disabled={busy || deleted}><legend>项目与标签（可选）</legend><label>项目标识<input pattern="[a-zA-Z0-9_-]*" maxLength={100} placeholder="如：winter-2026" value={record.series.slug} onChange={e => change({ ...record, series: { ...record.series, slug: e.target.value } })} /></label>{bilingual("项目名称", record.series, v => change({ ...record, series: { ...record.series, ...v } }), "如：冬日漫游", undefined, 200)}<label>标签（用逗号分隔）<input placeholder="如：风光，雪原，航拍" value={tagInput} onChange={e => { setTagInput(e.target.value); const tags = [...new Set(e.target.value.split(/[,，]/).map(v => v.trim()).filter(Boolean))]; change({ ...record, tags: tags.length ? tags : "" }); }} /></label><label>展示顺序<input type="number" min="0" step="1" placeholder="留空使用上传时间默认排序" value={record.order} onChange={e => change({ ...record, order: e.target.value === "" ? "" : Number(e.target.value) })} /></label></fieldset>
            <details><summary>私有定位信息</summary><p className={styles.hint}>GPS 不写入公开展示图。此处不向地图服务发送坐标。</p><div className={styles.twoColumns}>{(["latitude", "longitude"] as const).map(k => <label key={k}>{k === "latitude" ? "纬度" : "经度"}<input type="number" step="any" min={k === "latitude" ? -90 : -180} max={k === "latitude" ? 90 : 180} placeholder={k === "latitude" ? "如：45.75" : "如：126.63"} value={record.geo[k]} onChange={e => change({ ...record, geo: { ...record.geo, [k]: e.target.value === "" ? "" : Number(e.target.value), source: "manual", precision: record.geo.precision || "approximate" } })} /></label>)}</div><label>坐标来源<select value={record.geo.source} onChange={e => change({ ...record, geo: { ...record.geo, source: e.target.value as CatalogRecord["geo"]["source"] } })}><option value="">未填写</option><option value="exif">EXIF</option><option value="manual">手动</option><option value="geocoded">地理编码</option></select></label><label>精度<select value={record.geo.precision} onChange={e => change({ ...record, geo: { ...record.geo, precision: e.target.value as CatalogRecord["geo"]["precision"] } })}><option value="">未填写</option><option value="exact">精确</option><option value="approximate">大致</option><option value="city">城市级</option></select></label></details>
            <p className={styles.hint}>{missing.length ? `待补充：${missing.join("、")}。可先保存草稿。` : "拍摄信息已齐全。"}</p><label className={styles.check}><input type="checkbox" checked={reviewed} disabled={!!missing.length} onChange={e => { setReviewed(e.target.checked); setDirty(true); }} />我已核对拍摄信息</label><button className={styles.save} disabled={busy}>{busy ? "保存中…" : "保存完整 Metadata"}</button>
          </form>}
        {processing}
      </div>
    </div>
  </dialog>;
}
