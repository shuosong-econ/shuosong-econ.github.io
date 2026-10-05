import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const html = read("index.html");
const script = read("script.js");
const css = read("styles.css");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");

const resourcePaths = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
  .map((match) => match[1])
  .filter((path) => !/^(https?:|mailto:)/.test(path));
for (const path of resourcePaths) {
  assert.ok(existsSync(resolve(root, path)), `Missing local resource: ${path}`);
}
for (const [, fragment] of html.matchAll(/href="#([^"]+)"/g)) {
  assert.ok(ids.includes(fragment), `Missing anchor target: ${fragment}`);
}
// Verify every migrated photograph, including the case-sensitive original path.
const photoFiles = [...script.matchAll(/\bfile:\s*["']([^"']+)["']/g)].map(
  (match) => match[1],
);
assert.equal(
  photoFiles.length,
  16,
  "All 16 original gallery entries must remain available",
);
for (const file of photoFiles) {
  assert.ok(
    existsSync(resolve(root, "figures", file)),
    `Missing original: ${file}`,
  );
  const stem = file.replace(/\.[^.]+$/, "").toLowerCase();
  for (const size of ["", "-large"]) {
    assert.ok(
      existsSync(resolve(root, "assets/photos", `${stem}${size}.webp`)),
      `Missing optimized image: ${stem}${size}`,
    );
  }
}
assert.ok(
  css.includes("prefers-reduced-motion"),
  "System motion preference must be supported",
);
assert.deepEqual(
  [...new Set(script.match(/https?:\/\/[^\s"'`]+/g) || [])],
  ["https://api.ipapi.is/"],
  "The optional, non-blocking IP lookup is the only external runtime request",
);
assert.ok(
  existsSync(resolve(root, "googlee4e7935b7dd5b043.html")),
  "Keep the existing Google verification file",
);
assert.ok(
  existsSync(resolve(root, ".nojekyll")),
  "GitHub Pages must serve the static source directly",
);
console.log(
  `PASS: ${ids.length} unique IDs, ${resourcePaths.length} local references, 16 original/thumbnail/large image sets, static Pages deployment.`,
);
