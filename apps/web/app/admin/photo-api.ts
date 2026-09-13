export const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
export const privateImageUrl = (url: string) => url.startsWith("/") ? `${API}${url}` : url;
export type Config = { preset: "preserve" | "web_standard"; long_edge: number; quality: number; min_quality: number; max_output_kb: number };
export type TextPair = { zh: string; en: string };
export type CatalogRecord = {
  slug: string; file: string; src: string; width: number | ""; height: number | ""; order: number | "";
  title: TextPair; alt: TextPair; description: TextPair;
  location: Record<"place" | "district" | "city" | "region" | "country" | "display" | "geocodeQuery", TextPair> & { countryCode: string };
  geo: { latitude: number | ""; longitude: number | ""; coordinateSystem: "WGS84"; source: "" | "exif" | "geocoded" | "manual"; precision: "" | "exact" | "approximate" | "city" };
  date: string; time: string; timezone: string;
  camera: { brand: string; model: string }; lens: { brand: string; model: string };
  focalLength: string; focalLength35mm: string; aperture: string; shutterSpeed: string; iso: number | "";
  series: { slug: string; zh: string; en: string }; tags: string[] | "";
};
export type Values = { camera_make: string; camera_model: string; lens: string; focal_length: number | null; aperture: number | null; shutter_speed: string; iso: number | null; captured_at: string; location: string };
export type Translation = { title: string; caption: string; alt_text: string };
export type Asset = { kind: string; url: string; width: number; height: number; byte_size: number; quality: number };
export type Photo = { id: string; created_at: string; filename: string; width: number; height: number; byte_size: number; color_profile: string; publication_status: string; processing_status: string; processing_config: Config; processing_error: string | null; metadata: Values; record: CatalogRecord; sources: Record<string, string>; review_status: string; missing_fields: string[]; translations: Record<"zh" | "en", Translation>; version: number; assets: Asset[] };

export function csrf(): string {
  return document.cookie.split("; ").find((v) => v.startsWith("tml_csrf="))?.split("=").slice(1).join("=") || "";
}
export function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => v.msg || "输入有误").join("；");
  if (value && typeof value === "object" && "message" in value) return String(value.message);
  return "操作未完成，请稍后重试。";
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}/api/v1${path}`, { ...options, credentials: "include", cache: "no-store", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf(), ...options.headers } });
  } catch { throw new Error("无法连接图片服务，请确认 API 终端正在运行。"); }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("登录信息无效或已过期，请重新登录。");
    throw new Error(errorText(data.detail));
  }
  return response.status === 204 ? undefined as T : response.json();
}
