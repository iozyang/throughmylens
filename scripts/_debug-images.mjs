import { readdirSync } from "node:fs";

const files = readdirSync("apps/web/public/photographs/selected-work").sort();
const accepts = [
  ["avif", "image/avif,image/webp,*/*"],
  ["webp", "image/webp,*/*"],
  ["jpeg", "image/jpeg,*/*"],
];

for (const [label, accept] of accepts) {
  console.log(`\n=== Accept: ${label} ===`);
  for (const f of files) {
    const url = `http://localhost:3000/_next/image?url=%2Fphotographs%2Fselected-work%2F${encodeURIComponent(f)}&w=640&q=80`;
    const r = await fetch(url, { headers: { accept } });
    const ct = r.headers.get("content-type");
    if (!r.ok) console.log("FAIL", r.status, f, ct);
  }
}
console.log("\ndone");
