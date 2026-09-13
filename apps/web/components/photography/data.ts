import type { Photograph, Place, Project } from "./types";

// Ordered, curated homepage data. No connection to the private draft library.
// Replace this adapter with explicitly published CMS records in the publishing phase.
export const photographs: Photograph[] = [
  {
    id: "evening-20260817", src: "/photographs/evening-20260817.jpg", width: 2400, height: 2058,
    alt: { zh: "村落与田野上空铺展开金色、橘粉色的晚霞，远山在天际延伸", en: "Gold and rose clouds above fields and a village, with mountains along the horizon" },
    date: "2026-08-17", aperture: "f/1.7", iso: 100,
    order: 0, focalPosition: { desktop: "50% 68%", mobile: "44% 50%" },
    credit: { name: "SHEPS.LOG", url: "", license: "Photographer-supplied; all rights reserved." },
  },
];
photographs.push(
  {
    id: "mountain-layers", src: "/photographs/demo-mountain-layers.jpg", width: 1600, height: 2400, demo: true,
    alt: { zh: "浅蓝色天空下，远山与近处山脊层层交叠", en: "Mountain ridges receding in blue layers beneath a pale sky" },
    order: 1, focalPosition: { desktop: "50% 65%", mobile: "50% 50%" },
    credit: { name: "Fabrizio Conti", url: "https://unsplash.com/photos/J_3FErYqafI", license: "Unsplash License" },
  },
  {
    id: "blanca-lake", src: "/photographs/demo-blanca-lake.jpg", width: 2400, height: 1350, demo: true,
    alt: { zh: "云雾笼罩陡峭山壁，绿色湖水倒映山谷", en: "Clouds drifting above a steep alpine valley reflected in a green lake" },
    location: { zh: "布兰卡湖，美国", en: "Blanca Lake, United States" },
    order: 2, focalPosition: { desktop: "50% 60%", mobile: "48% 60%" },
    credit: { name: "Yoshi Takekawa", url: "https://unsplash.com/photos/4qKVQYOluDk", license: "Unsplash License" },
  },
  {
    id: "coastal-contours", src: "/photographs/demo-coastal-contours.jpg", width: 1596, height: 2400, demo: true,
    alt: { zh: "俯瞰金色海崖、绿色草地与礁石间的白色浪花", en: "An aerial view of golden cliffs, green grass and waves curling around coastal rocks" },
    location: { zh: "德文郡，英国", en: "Devon, United Kingdom" },
    order: 3, focalPosition: { desktop: "50% 48%", mobile: "50% 50%" },
    credit: { name: "Red Zeppelin", url: "https://unsplash.com/photos/7G-CZTxw10o", license: "Unsplash License" },
  },
  {
    id: "salt-point", src: "/photographs/demo-salt-point.jpg", width: 1600, height: 2400, demo: true,
    alt: { zh: "灰色天空下，岩石海岸沿平静的海面延伸", en: "A rocky coastline stretching along quiet water under a grey sky" },
    location: { zh: "盐角州立公园，美国", en: "Salt Point, United States" },
    order: 4, focalPosition: { desktop: "50% 57%", mobile: "50% 50%" },
    credit: { name: "Ronan Furuta", url: "https://unsplash.com/photos/tWzAHnh2Grc", license: "Unsplash License" },
  },
);
export const heroIds = ["evening-20260817", "blanca-lake", "salt-point"];
// Mock project titles/year are not claims about the source photographs' capture dates.
export const projects: Project[] = [
  { slug: "mountain-silence", title: { zh: "山间静默", en: "Mountain Silence" }, year: "2026", photographId: "blanca-lake" },
  { slug: "edge-of-land", title: { zh: "陆地的边缘", en: "The Edge of Land" }, year: "2026", photographId: "coastal-contours" },
];
// Approximate public place centres only; never copy GPS from private assets here.
export const places: Place[] = [
  { slug: "blanca-lake", name: { zh: "布兰卡湖", en: "Blanca Lake" }, coordinates: [-121.34, 47.93], photographId: "blanca-lake" },
  { slug: "salt-point", name: { zh: "盐角", en: "Salt Point" }, coordinates: [-123.32, 38.57], photographId: "salt-point" },
  { slug: "devon", name: { zh: "德文郡", en: "Devon" }, coordinates: [-3.28, 50.65], photographId: "coastal-contours" },
];
