// Complex Fermat curves obtained as sections of Calabi–Yau hypersurfaces.
// Parameterization: A. J. Hanson, Notices of the AMS 41(9), 1994, pp. 1156–1163.
const TAU = Math.PI * 2;
export const SURFACES = [
  {
    name: "Elliptic aperture",
    powers: [3, 3],
    extent: 0.68,
    angles: [0, 0, 0, 0, 0, 0.78],
    roll: 0,
    scale: 0.53,
    aspect: [0.94, 1.02, 1],
  },
  {
    name: "Quartic wings",
    powers: [4, 4],
    extent: 0.52,
    angles: [0, 0, 0, 0, 0, 0.78],
    roll: Math.PI / 2,
    scale: 0.54,
    aspect: [1.22, 0.76, 1],
  },
  {
    name: "Quintic corolla",
    powers: [5, 5],
    extent: 0.95,
    angles: [0, 0, 0, 0, 1.5, 0.15],
    roll: 0.3,
    scale: 0.515,
  },
  {
    name: "Sextic column",
    powers: [2, 6],
    extent: 0.65,
    angles: [0, 0, 0.6, 0.1, 0.8, 0.2],
    roll: 0,
    scale: 0.48,
    aspect: [0.66, 1.15, 1],
  },
].map((specimen) =>
  Object.freeze({
    ...specimen,
    angles: Object.freeze(specimen.angles),
    powers: Object.freeze(specimen.powers),
    aspect: Object.freeze(specimen.aspect ?? [1, 1, 1]),
  }),
);
Object.freeze(SURFACES);

export function fermatPoint(u, v, branchA, branchB, powers) {
  const c = Math.cos(u),
    s = Math.sin(u);
  const ch = Math.cosh(v),
    sh = Math.sinh(v);
  const root = (re, im, branch, degree) => {
    const radius = Math.pow(Math.hypot(re, im), 2 / degree);
    const angle = (Math.atan2(im, re) * 2) / degree + (TAU * branch) / degree;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  };
  return [
    ...root(c * ch, -s * sh, branchA, powers[0]),
    ...root(s * ch, c * sh, branchB, powers[1]),
  ];
}

export function createSurfaceMesh(specimen, uSteps = 28, vSteps = 40) {
  const { powers, extent } = specimen;
  if (
    !Array.isArray(powers) ||
    powers.length !== 2 ||
    !powers.every((n) => Number.isInteger(n) && n >= 2 && n <= 8) ||
    !Number.isFinite(extent) ||
    extent <= 0 ||
    extent > 2
  )
    throw new RangeError("Invalid Fermat surface.");
  if (
    !Number.isInteger(uSteps) ||
    !Number.isInteger(vSteps) ||
    uSteps < 2 ||
    vSteps < 2 ||
    vSteps % 2 ||
    powers[0] * powers[1] * (uSteps + 1) * (vSteps + 1) > 65535
  ) {
    throw new RangeError(
      "Use at least two subdivisions, an even v count, and at most 65,535 vertices.",
    );
  }
  const vertices = [],
    indices = [],
    edges = [];
  const epsilon = 0.00002;
  for (let a = 0; a < powers[0]; a++) {
    for (let b = 0; b < powers[1]; b++) {
      const offset = vertices.length / 14;
      for (let i = 0; i <= uSteps; i++) {
        const u = (Math.PI / 4) * (1 - Math.cos((Math.PI * i) / uSteps));
        for (let j = 0; j <= vSteps; j++) {
          const t = (2 * j) / vSteps - 1;
          const v = Math.sign(t) * Math.pow(Math.abs(t), 1.5) * extent;
          const p = fermatPoint(u, v, a, b, powers);
          const lo = fermatPoint(Math.max(0, u - epsilon), v, a, b, powers);
          const hi = fermatPoint(
            Math.min(Math.PI / 2, u + epsilon),
            v,
            a,
            b,
            powers,
          );
          const down = fermatPoint(u, v - epsilon, a, b, powers);
          const up = fermatPoint(u, v + epsilon, a, b, powers);
          vertices.push(
            ...p,
            ...hi.map((n, k) => n - lo[k]),
            ...up.map((n, k) => n - down[k]),
            i / uSteps,
            j / vSteps,
          );
          if (i < uSteps && j < vSteps) {
            const n = offset + i * (vSteps + 1) + j;
            indices.push(
              n,
              n + vSteps + 1,
              n + 1,
              n + 1,
              n + vSteps + 1,
              n + vSteps + 2,
            );
          }
          const n = offset + i * (vSteps + 1) + j;
          if (j < vSteps && i % 2 === 0) edges.push(n, n + 1);
          if (i < uSteps && j % 4 === 0) edges.push(n, n + vSteps + 1);
        }
      }
    }
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    edges: new Uint16Array(edges),
  };
}

// Column-major SO(4) matrices. A fourth-dimensional turn changes the projection,
// not the surface: every sampled point remains on its original Fermat section.
export function projectionMatrix(specimen, time = 0) {
  if (
    !Array.isArray(specimen.angles) ||
    specimen.angles.length !== 6 ||
    !specimen.angles.every(Number.isFinite) ||
    !Number.isFinite(specimen.roll ?? 0) ||
    !Number.isFinite(time)
  )
    throw new RangeError("Invalid projection.");
  const angles = [...specimen.angles];
  angles[0] += 0.045 * Math.sin(time * 0.13);
  angles[2] += 0.055 * Math.sin(time * 0.11);
  angles[4] += 0.04 * Math.sin(time * 0.16);
  angles.push(specimen.roll ?? 0);
  const matrix = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);
  const planes = [
    [0, 1],
    [2, 3],
    [1, 3],
    [0, 2],
    [1, 2],
    [0, 1],
    [0, 2],
  ];
  for (let n = 0; n < planes.length; n++) {
    const [a, b] = planes[n],
      c = Math.cos(angles[n]),
      s = Math.sin(angles[n]);
    for (let column = 0; column < 4; column++) {
      const i = column * 4,
        x = matrix[i + a],
        y = matrix[i + b];
      matrix[i + a] = c * x - s * y;
      matrix[i + b] = s * x + c * y;
    }
  }
  return matrix;
}

export function projectPoint(point, matrix, aspect = [1, 1, 1]) {
  return [0, 2, 1].map(
    (row, i) =>
      aspect[i] *
      point.reduce((sum, x, column) => sum + matrix[column * 4 + row] * x, 0),
  );
}

const VERTEX = `
attribute vec4 aPosition;
attribute vec4 aTangentU;
attribute vec4 aTangentV;
attribute vec2 aUV;
uniform mat4 uRotation;
uniform vec2 uScale;
uniform vec3 uAspect;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUV;
void main() {
  vec3 p = (uRotation * aPosition).xzy * uAspect;
  vec3 du = (uRotation * aTangentU).xzy * uAspect;
  vec3 dv = (uRotation * aTangentV).xzy * uAspect;
  vec3 normal = cross(du, dv);
  vNormal = normal / max(length(normal), 0.000000000001);
  vPosition = p;
  vUV = aUV;
  gl_Position = vec4(p.xy * uScale + vec2(0.0, -0.07), -p.z * 0.24, 1.0);
}`;

const FRAGMENT = `
#extension GL_OES_standard_derivatives : enable
precision mediump float;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUV;
void main() {
  vec3 normal = normalize(vNormal);
  if (normal.z < 0.0) normal = -normal;
  vec3 light = normalize(vec3(-0.55, 0.8, 1.3));
  float diffuse = max(dot(normal, light), 0.0);
  float rim = pow(1.0 - abs(normal.z), 2.0);
  float specular = pow(max(dot(normal, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 42.0);
  float depth = clamp(0.5 + vPosition.z * 0.22, 0.0, 1.0);
  vec3 shade = mix(vec3(0.27, 0.34, 0.30), vec3(0.91, 0.94, 0.88), 0.23 + diffuse * 0.72);
  shade += specular * 0.19 + rim * 0.065;
  shade = mix(shade, vec3(0.82, 0.87, 0.80), (1.0 - depth) * 0.22);
  vec2 grid = vUV * vec2(14.0, 20.0);
  vec2 distanceToLine = abs(fract(grid - 0.5) - 0.5) / max(fwidth(grid), vec2(0.001));
  float ink = 1.0 - smoothstep(0.35, 1.05, min(distanceToLine.x, distanceToLine.y));
  shade = mix(shade, vec3(0.28, 0.37, 0.32), ink * 0.23);
  gl_FragColor = vec4(shade, 1.0);
}`;

function setupGPU(canvas, meshes) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl || !gl.getExtension("OES_standard_derivatives")) return null;
  const shaders = [],
    buffers = [];
  let program;
  function dispose() {
    buffers.forEach((buffer) => gl.deleteBuffer(buffer));
    shaders.forEach((shader) => gl.deleteShader(shader));
    if (program) gl.deleteProgram(program);
  }
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VERTEX],
      [gl.FRAGMENT_SHADER, FRAGMENT],
    ]) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader allocation failed.");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader));
    }
    program = gl.createProgram();
    if (!program) throw new Error("Program allocation failed.");
    shaders.forEach((shader) => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const layouts = meshes.map((mesh) => {
      const pair = [];
      for (const [target, data] of [
        [gl.ARRAY_BUFFER, mesh.vertices],
        [gl.ELEMENT_ARRAY_BUFFER, mesh.indices],
      ]) {
        const buffer = gl.createBuffer();
        if (!buffer) throw new Error("Mesh allocation failed.");
        buffers.push(buffer);
        pair.push(buffer);
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, data, gl.STATIC_DRAW);
      }
      return pair;
    });
    const attributes = [
      ["aPosition", 4, 0],
      ["aTangentU", 4, 4],
      ["aTangentV", 4, 8],
      ["aUV", 2, 12],
    ].map(([name, size, offset]) => ({
      location: gl.getAttribLocation(program, name),
      size,
      offset,
    }));
    attributes.forEach(({ location }) => gl.enableVertexAttribArray(location));
    const rotation = gl.getUniformLocation(program, "uRotation");
    const scale = gl.getUniformLocation(program, "uScale");
    const aspect = gl.getUniformLocation(program, "uAspect");
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    return {
      gl,
      dispose,
      render(matrix, width, height, view, zoom, proportions) {
        if (gl.isContextLost()) return false;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, layouts[view][0]);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layouts[view][1]);
        for (const { location, size, offset } of attributes)
          gl.vertexAttribPointer(
            location,
            size,
            gl.FLOAT,
            false,
            56,
            offset * 4,
          );
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(rotation, false, matrix);
        gl.uniform3fv(aspect, proportions);
        gl.uniform2f(scale, zoom, (zoom * width) / height);
        gl.drawElements(
          gl.TRIANGLES,
          meshes[view].indices.length,
          gl.UNSIGNED_SHORT,
          0,
        );
        return true;
      },
    };
  } catch {
    dispose();
    return null;
  }
}

// A single shared GPU surface is copied to the existing 2D cover canvases, so
// extraction transitions can still snapshot a cover without a separate context.
export function createCalabiYauRenderer(specimens = SURFACES) {
  const meshes = specimens.map((specimen) => createSurfaceMesh(specimen));
  const surface = document.createElement("canvas");
  let gpu = setupGPU(surface, meshes);
  let lost = false;
  const fallbacks = new Map();
  surface.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
  });
  surface.addEventListener("webglcontextrestored", () => {
    gpu?.dispose();
    gpu = setupGPU(surface, meshes);
    lost = false;
  });
  function wireframe(ctx, matrix, width, height, view, zoom) {
    if (!fallbacks.has(view))
      fallbacks.set(view, createSurfaceMesh(specimens[view], 12, 16));
    const fallback = fallbacks.get(view);
    const points = [];
    const vertices = fallback.vertices;
    for (let i = 0; i < vertices.length; i += 14) {
      const p = projectPoint(
        vertices.subarray(i, i + 4),
        matrix,
        specimens[view].aspect,
      );
      points.push([
        width * (0.5 + (p[0] * zoom) / 2),
        height * 0.535 - (p[1] * width * zoom) / 2,
        p[2],
      ]);
    }
    // Depth bands preserve the folded volume even when GPU rendering is unavailable.
    ctx.lineWidth = 0.9;
    for (let band = 0; band < 4; band++) {
      ctx.beginPath();
      for (let i = 0; i < fallback.edges.length; i += 2) {
        const a = points[fallback.edges[i]],
          b = points[fallback.edges[i + 1]];
        const depthBand = Math.min(
          3,
          Math.max(0, Math.floor((a[2] + b[2] + 4) / 2)),
        );
        if (depthBand !== band) continue;
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.strokeStyle = `rgba(65, 87, 72, ${0.11 + band * 0.095})`;
      ctx.stroke();
    }
  }
  return {
    draw(ctx, view, time) {
      const { width, height } = ctx.canvas;
      if (!width || !height) return;
      const specimen = specimens[view];
      if (!specimen || !Number.isFinite(specimen.scale) || specimen.scale <= 0)
        throw new RangeError("Invalid cover view.");
      const matrix = projectionMatrix(specimen, time);
      ctx.clearRect(0, 0, width, height);
      if (
        !lost &&
        gpu?.render(
          matrix,
          width,
          height,
          view,
          specimen.scale,
          specimen.aspect ?? [1, 1, 1],
        )
      ) {
        ctx.drawImage(surface, 0, 0);
        ctx.canvas.dataset.renderer = "webgl";
      } else {
        wireframe(ctx, matrix, width, height, view, specimen.scale);
        ctx.canvas.dataset.renderer = "wireframe";
      }
    },
  };
}
