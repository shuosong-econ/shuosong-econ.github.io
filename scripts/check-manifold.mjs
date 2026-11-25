import assert from "node:assert/strict";
import {
  SURFACES,
  createSurfaceMesh,
  fermatPoint,
  projectionMatrix,
  projectPoint,
} from "../calabi-yau.mjs";
const power = (x, y, n) => {
  let re = 1,
    im = 0;
  for (let i = 0; i < n; i++) [re, im] = [re * x - im * y, re * y + im * x];
  return [re, im];
};
let residual = 0;
const counts = [];
for (const specimen of SURFACES) {
  const { powers, extent, scale, aspect } = specimen;
  for (let a = 0; a < powers[0]; a++)
    for (let b = 0; b < powers[1]; b++) {
      for (const u of [
        0,
        0.00001,
        0.3,
        Math.PI / 4,
        Math.PI / 2 - 0.00001,
        Math.PI / 2,
      ]) {
        for (const v of [-extent, -0.001, 0, 0.001, extent]) {
          const [x, y, z, w] = fermatPoint(u, v, a, b, powers);
          const p = power(x, y, powers[0]),
            q = power(z, w, powers[1]);
          residual = Math.max(
            residual,
            Math.hypot(p[0] + q[0] - 1, p[1] + q[1]),
          );
        }
      }
    }
  const mesh = createSurfaceMesh(specimen);
  const count = mesh.vertices.length / 14;
  counts.push(count);
  assert.equal(count, powers[0] * powers[1] * 29 * 41);
  assert.ok(mesh.vertices.every(Number.isFinite));
  assert.ok(mesh.indices.every((i) => i < count));
  assert.ok(mesh.edges.every((i) => i < count));
  assert.equal(mesh.indices.length, powers[0] * powers[1] * 28 * 40 * 6);
  for (let t = 0; t < 48; t += 0.5) {
    const m = projectionMatrix(specimen, t);
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
      const p = projectPoint(mesh.vertices.subarray(i, i + 4), m, aspect);
      const x = 0.5 + (p[0] * scale) / 2;
      const y = 0.535 - (((p[1] * scale) / 2) * 480) / 620;
      assert.ok(x > 0.13 && x < 0.87, `${specimen.name}: cover side margin`);
      assert.ok(y > 0.27 && y < 0.8, `${specimen.name}: label clearance`);
      assert.ok(Math.abs(p[2] * 0.24) < 1, "Depth clipping");
    }
  }
  const first = projectionMatrix(specimen, 0);
  const fourthSecond = projectionMatrix(specimen, 4);
  const loop = projectionMatrix(specimen, 48);
  for (let i = 0; i < 16; i++)
    assert.ok(
      Math.abs(first[i] - loop[i]) < 1e-6,
      "Motion loop closes without a jump",
    );
  let movement = 0,
    samples = 0;
  for (let i = 0; i < mesh.vertices.length; i += 14 * 20) {
    const point = mesh.vertices.subarray(i, i + 4);
    const a = projectPoint(point, first, aspect);
    const b = projectPoint(point, fourthSecond, aspect);
    movement += Math.hypot(a[0] - b[0], a[1] - b[1]) * scale * 240;
    samples++;
  }
  assert.ok(
    movement / samples > 6,
    `${specimen.name}: motion must be visible within four seconds`,
  );
  for (let t = 0; t < 48; t += 0.5) {
    const a = projectionMatrix(specimen, t),
      b = projectionMatrix(specimen, t + 1 / 30);
    assert.ok(
      a.every((v, i) => Math.abs(v - b[i]) < 0.012),
      "Continuous frame-to-frame rotation",
    );
  }
  console.log(
    `${specimen.name}: mean four-second movement ${(movement / samples).toFixed(1)} canvas pixels`,
  );
}
assert.ok(residual < 1e-11, `Fermat residual ${residual}`);
assert.equal(
  new Set(SURFACES.map((s) => s.powers.join(","))).size,
  4,
  "Four distinct equations",
);
assert.equal(new Set(counts).size, 4, "Four independently sampled geometries");
assert.throws(() => createSurfaceMesh(SURFACES[0], 0, 10), RangeError);
assert.throws(() => createSurfaceMesh(SURFACES[0], 10, 11), RangeError);
assert.throws(() => createSurfaceMesh(SURFACES[0], 200, 200), RangeError);
for (const powers of [[1, 5], [3, 9], [3, NaN], [3], [3.5, 4]]) {
  assert.throws(
    () => createSurfaceMesh({ ...SURFACES[0], powers }),
    RangeError,
  );
}
assert.throws(
  () => createSurfaceMesh({ ...SURFACES[0], extent: Infinity }),
  RangeError,
);
assert.throws(
  () => projectionMatrix({ ...SURFACES[0], angles: [0] }),
  RangeError,
);
assert.throws(
  () => projectionMatrix({ ...SURFACES[0], roll: NaN }),
  RangeError,
);
assert.throws(() => projectionMatrix(SURFACES[0], Infinity), RangeError);
console.log(
  `PASS: four distinct equations, mesh sizes ${counts.join("/")}, residual ${residual.toExponential(2)}, rotations, visible motion, seamless loop, animated bounds and index limits.`,
);
