import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import https from "node:https";
import http from "node:http";

function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https:") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(download(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    }).on("error", reject);
  });
}

const siteUrl = (process.env.NUXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const indexUrl = process.env.LEGACY_INDEX_URL || `${siteUrl}/index.html`;
const outPath = "public/legacy/index.html";

console.log(`Downloading: ${indexUrl}`);
const buf = await download(indexUrl);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, buf);
console.log(`Saved: ${outPath} (${buf.length} bytes)`);

console.log("Done.");
