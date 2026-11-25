// Complex Fermat curves obtained as sections of Calabi–Yau hypersurfaces.
// Parameterization: A. J. Hanson, Notices of the AMS 41(9), 1994, pp. 1156–1163.
const TAU = Math.PI * 2;
export const SURFACES = [
  {
    name: "Elliptic fold",
    powers: [3, 3],
    extent: 0.62,
    angles: [0.28, -0.18, 0.48, 0.32, 0.72, -0.22],
    roll: -0.2,
    scale: 0.45,
    aspect: [0.86, 1.08, 1],
    phase: 0,
  },
  {
    name: "Quartic sail",
    powers: [4, 4],
    extent: 0.48,
    angles: [0.12, 0.32, 0.28, -0.4, 1.1, 0.18],
    roll: -0.45,
    scale: 0.46,
    aspect: [1.18, 0.88, 1],
    phase: 1.5,
  },
  {
    name: "Quintic bloom",
    powers: [5, 5],
    extent: 0.78,
    angles: [0.15, -0.18, 0.1, 0.12, 1.38, -0.38],
    roll: 0.5,
    scale: 0.46,
    aspect: [1, 1, 1],
    phase: 3,
  },
  {
    name: "Sextic helix",
    powers: [2, 6],
    extent: 0.66,
    angles: [0.48, 0.15, 1.05, 0.18, 0.45, -0.28],
    roll: 0.25,
    timeOffset: 6,
    scale: 0.43,
    aspect: [0.9, 1.07, 1],
    phase: 4.5,
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
    !Number.isFinite(specimen.timeOffset ?? 0) ||
    !Number.isFinite(time)
  )
    throw new RangeError("Invalid projection.");
  const angles = [...specimen.angles];
  const phase = specimen.phase ?? 0;
  if (!Number.isFinite(phase)) throw new RangeError("Invalid motion phase.");
  // Coordinated, periodic rotations keep both shape and speed continuous.
  // Different phase offsets let the four objects move independently.
  const t = ((time + (specimen.timeOffset ?? 0)) * TAU) / 48;
  angles[0] += 0.24 * Math.sin(t + phase);
  angles[1] += 0.12 * Math.sin(2 * t - phase);
  angles[2] += 0.28 * Math.sin(t + phase + 0.7);
  angles[3] += 0.12 * Math.sin(2 * t + phase);
  angles[4] += 0.38 * Math.sin(2 * t - phase + 0.4);
  angles[5] += 0.1 * Math.sin(3 * t + phase);
  angles.push((specimen.roll ?? 0) + 0.12 * Math.sin(t - phase));
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
uniform float uLightPhase;
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUV;
void main() {
  vec3 normal = normalize(vNormal);
  if (normal.z < 0.0) normal = -normal;
  vec3 eye = vec3(0.0, 0.0, 1.0);
  vec3 key = normalize(vec3(-0.65 + 0.32 * sin(uLightPhase), 0.85, 1.4));
  vec3 fill = normalize(vec3(0.9, -0.35 + 0.25 * cos(uLightPhase), 0.9));
  float diffuse = max(dot(normal, key), 0.0);
  float bounce = max(dot(normal, fill), 0.0);
  float edge = pow(1.0 - abs(normal.z), 2.5);
  float depth = clamp(0.5 + vPosition.z * 0.18, 0.0, 1.0);
  // Pearl-white body with a cool silver shadow and a warm reflected softbox.
  // Broad fill light keeps the folds legible without a dark, cloth-like finish.
  vec3 shade = mix(vec3(0.48, 0.59, 0.58), vec3(0.88, 0.94, 0.91), 0.35 + diffuse * 0.65);
  shade += vec3(0.08, 0.09, 0.1) * bounce;
  float gloss = pow(max(dot(normal, normalize(key + eye)), 0.0), 48.0);
  float softGloss = pow(max(dot(normal, normalize(fill + eye)), 0.0), 16.0);
  vec3 reflection = reflect(-eye, normal);
  float bandPosition = -0.3 + 0.32 * sin(uLightPhase);
  float softbox = exp(-pow((reflection.x - bandPosition) / 0.24, 2.0));
  softbox *= smoothstep(-0.65, 0.45, reflection.y);
  shade += vec3(1.0, 0.98, 0.92) * (gloss * 0.38 + softbox * 0.22);
  shade += vec3(0.84, 0.94, 1.0) * (softGloss * 0.16 + edge * 0.1);
  shade *= 0.94 + depth * 0.06;
  vec2 grid = vUV * vec2(14.0, 20.0);
  vec2 distanceToLine = abs(fract(grid - 0.5) - 0.5) / max(fwidth(grid), vec2(0.001));
  float ink = 1.0 - smoothstep(0.15, 0.8, min(distanceToLine.x, distanceToLine.y));
  // Engraved detail recedes in the highlights instead of darkening every fold.
  shade = mix(shade, shade * vec3(0.73, 0.8, 0.78), ink * 0.22 * (1.0 - min(gloss + softbox, 1.0) * 0.7));
  gl_FragColor = vec4(min(shade, vec3(1.0)), 1.0);
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
    const lightPhase = gl.getUniformLocation(program, "uLightPhase");
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    return {
      gl,
      dispose,
      render(matrix, width, height, view, zoom, proportions, time) {
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
        gl.uniform1f(lightPhase, ((time * TAU) / 24 + view * 0.7) % TAU);
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
          time,
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
