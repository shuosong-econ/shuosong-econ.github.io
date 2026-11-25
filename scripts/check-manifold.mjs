import assert from "node:assert/strict";
import {
  createQuinticMesh,
  quinticPoint,
  projectionMatrix,
  projectPoint,
} from "../calabi-yau.mjs";
const fifth = (x, y) => [
  x ** 5 - 10 * x ** 3 * y ** 2 + 5 * x * y ** 4,
  5 * x ** 4 * y - 10 * x ** 2 * y ** 3 + y ** 5,
];
let residual = 0;
for (let a = 0; a < 5; a++)
  for (let b = 0; b < 5; b++) {
    for (const u of [
      0,
      0.00001,
      0.3,
      Math.PI / 4,
      Math.PI / 2 - 0.00001,
      Math.PI / 2,
    ]) {
      for (const v of [-1.12, -0.001, 0, 0.001, 1.12]) {
        const [x, y, z, w] = quinticPoint(u, v, a, b);
        const p = fifth(x, y),
          q = fifth(z, w);
        residual = Math.max(residual, Math.hypot(p[0] + q[0] - 1, p[1] + q[1]));
      }
    }
  }
assert.ok(residual < 1e-11, `Quintic residual ${residual}`);
const mesh = createQuinticMesh();
const count = mesh.vertices.length / 14;
assert.equal(count, 25 * 29 * 41);
assert.ok(mesh.vertices.every(Number.isFinite));
assert.ok(mesh.indices.every((i) => i < count));
assert.ok(mesh.edges.every((i) => i < count));
assert.throws(() => createQuinticMesh(0, 10), RangeError);
assert.throws(() => createQuinticMesh(10, 11), RangeError);
assert.throws(() => createQuinticMesh(200, 200), RangeError);
assert.throws(() => projectionMatrix(4), RangeError);
assert.throws(() => projectionMatrix(0, Infinity), RangeError);
const shapes = [];
for (let view = 0; view < 4; view++) {
  const base = projectionMatrix(view, 0);
  shapes.push(
    Array.from(base)
      .map((n) => n.toFixed(4))
      .join(","),
  );
  for (let t = 0; t < 400; t += 8) {
    const m = projectionMatrix(view, t);
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        let dot = 0;
        for (let i = 0; i < 4; i++) dot += m[a * 4 + i] * m[b * 4 + i];
        assert.ok(
          Math.abs(dot - Number(a === b)) < 1e-6,
          "Viewing frame must remain orthonormal",
        );
      }
    for (let i = 0; i < mesh.vertices.length; i += 14 * 4) {
      const p = projectPoint(mesh.vertices.subarray(i, i + 4), m);
      const screenX = 0.5 + p[0] * 0.2;
      const screenY = 0.535 - (p[1] * 0.2 * 480) / 620;
      assert.ok(screenX > 0.13 && screenX < 0.87, "Cover side margin");
      assert.ok(
        screenY > 0.27 && screenY < 0.8,
        "Keep labels and serial number clear",
      );
      assert.ok(Math.abs(p[2] * 0.24) < 1, "Depth clipping");
    }
  }
}
assert.equal(new Set(shapes).size, 4);
console.log(
  `PASS: 25 quintic patches, ${count} vertices, residual ${residual.toExponential(2)}, 4 orthonormal projections, animated bounds and index limits.`,
);
