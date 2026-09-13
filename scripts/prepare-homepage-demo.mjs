// One-time asset preparation, not run by the website or during normal startup.
// Sources and licenses are recorded in docs/homepage.md. No private library reads.
import { createRequire } from "node:module";
import { mkdir, access, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireWeb = createRequire(path.join(root, "apps/web/package.json"));
const sharp = createRequire(requireWeb.resolve("next/package.json"))("sharp");
const directory = path.join(root, "apps/web/public/photographs");
await mkdir(directory, { recursive: true });
const sources = [
  ["demo-blanca-lake", "photo-1476041178066-aa562074def7"],
  ["demo-salt-point", "photo-1768066578235-14a9699b6710"],
  ["demo-mountain-layers", "photo-1530274083826-2facadf42457"],
  ["demo-coastal-contours", "photo-1710790095456-6b122a198033"],
];
for (const [name, id] of sources) {
  const output = path.join(directory, `${name}.jpg`);
  if (await access(output).then(() => true).catch(() => false)) {
    const metadata = await sharp(output).metadata();
    console.log(JSON.stringify({ name, width: metadata.width, height: metadata.height, existing: true }));
    continue;
  }
  const response = await fetch(`https://images.unsplash.com/${id}?fit=max&w=2400&h=2400&q=88&fm=jpg`, { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const info = await sharp(bytes).rotate().withIccProfile("srgb")
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toFile(output);
  console.log(JSON.stringify({ name, width: info.width, height: info.height, bytes: info.size }));
}

// Natural Earth coastline only, no political borders. Equirectangular projection.
const mapOutput = path.join(root, "apps/web/public/world-coastline.svg");
if (!await access(mapOutput).then(() => true).catch(() => false)) {
  const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json", { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Map: HTTP ${response.status}`);
  const topology = await response.json();
  const paths = topology.arcs.map((arc) => {
    let x = 0, y = 0, previousLongitude;
    return arc.map(([dx, dy], index) => {
      x += dx; y += dy;
      const longitude = x * topology.transform.scale[0] + topology.transform.translate[0];
      const latitude = y * topology.transform.scale[1] + topology.transform.translate[1];
      const command = !index || Math.abs(longitude - previousLongitude) > 180 ? "M" : "L";
      previousLongitude = longitude;
      return `${command}${((longitude + 180) * 3).toFixed(2)},${((90 - latitude) * 3).toFixed(2)}`;
    }).join("");
  }).join("");
  await writeFile(mapOutput, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 540"><!-- Natural Earth / world-atlas 2.0.2; see docs/homepage.md --><path d="${paths}" fill="none" stroke="#a6aaa0" stroke-width=".65" stroke-linejoin="round"/></svg>\n`);
  console.log("Prepared local world coastline.");
}
const licenseOutput = path.join(root, "apps/web/public/world-atlas-LICENSE.txt");
if (!await access(licenseOutput).then(() => true).catch(() => false)) {
  const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/LICENSE", { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`Map license: HTTP ${response.status}`);
  await writeFile(licenseOutput, await response.text());
}
