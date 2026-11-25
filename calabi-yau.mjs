// A 2D section of the Fermat quintic, z₁⁵ + z₂⁵ = 1, in four real dimensions.
// Parameterization: A. J. Hanson, Notices of the AMS 41(9), 1994, pp. 1156–1163.
// All covers share this geometry; only the four-dimensional viewing frame changes.
const TAU = Math.PI * 2;
const EXTENT = 1.12;
const VIEWS = [
  [0.12, 0.18, 0.78, 0.3, -0.52, 0.12],
  [0.88, -0.48, 0.34, -0.62, 0.24, -0.4],
  [-0.52, 0.72, 1.28, 0.68, -0.18, 0.65],
  [1.34, 0.24, -0.46, -0.3, 0.72, -0.18],
];

export function quinticPoint(u, v, branchA, branchB) {
  const c = Math.cos(u),
    s = Math.sin(u);
  const ch = Math.cosh(v),
    sh = Math.sinh(v);
  const root = (re, im, branch) => {
    const radius = Math.pow(Math.hypot(re, im), 0.4);
    const angle = Math.atan2(im, re) * 0.4 + (TAU * branch) / 5;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  };
  return [...root(c * ch, -s * sh, branchA), ...root(s * ch, c * sh, branchB)];
}

export function createQuinticMesh(uSteps = 28, vSteps = 40) {
  if (
    !Number.isInteger(uSteps) ||
    !Number.isInteger(vSteps) ||
    uSteps < 2 ||
    vSteps < 2 ||
    vSteps % 2 ||
    25 * (uSteps + 1) * (vSteps + 1) > 65535
  ) {
    throw new RangeError(
      "Use at least two subdivisions, an even v count, and at most 65,535 vertices.",
    );
  }
  const vertices = [],
    indices = [],
    edges = [];
  const epsilon = 0.00002;
  for (let a = 0; a < 5; a++) {
    for (let b = 0; b < 5; b++) {
      const offset = vertices.length / 14;
      for (let i = 0; i <= uSteps; i++) {
        const u = (Math.PI / 4) * (1 - Math.cos((Math.PI * i) / uSteps));
        for (let j = 0; j <= vSteps; j++) {
          const t = (2 * j) / vSteps - 1;
          const v = Math.sign(t) * Math.pow(Math.abs(t), 1.5) * EXTENT;
          const p = quinticPoint(u, v, a, b);
          const lo = quinticPoint(Math.max(0, u - epsilon), v, a, b);
          const hi = quinticPoint(Math.min(Math.PI / 2, u + epsilon), v, a, b);
          const down = quinticPoint(u, v - epsilon, a, b);
          const up = quinticPoint(u, v + epsilon, a, b);
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
// not the surface: every sampled point still belongs to the same quintic section.
export function projectionMatrix(view, time = 0) {
  if (
    !Number.isInteger(view) ||
    view < 0 ||
    view >= VIEWS.length ||
    !Number.isFinite(time)
  )
    throw new RangeError("Invalid projection.");
  const angles = [...VIEWS[view]];
  angles[0] += 0.1 * Math.sin(time * 0.13);
  angles[2] += 0.12 * Math.sin(time * 0.11);
  angles[4] += 0.08 * Math.sin(time * 0.16);
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

export function projectPoint(point, matrix) {
  return [0, 2, 1].map((row) =>
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
varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUV;
void main() {
  vec3 p = (uRotation * aPosition).xzy;
  vec3 du = (uRotation * aTangentU).xzy;
  vec3 dv = (uRotation * aTangentV).xzy;
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

function setupGPU(canvas, mesh) {
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
    for (const [target, data] of [
      [gl.ARRAY_BUFFER, mesh.vertices],
      [gl.ELEMENT_ARRAY_BUFFER, mesh.indices],
    ]) {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Mesh allocation failed.");
      buffers.push(buffer);
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, data, gl.STATIC_DRAW);
    }
    for (const [name, size, offset] of [
      ["aPosition", 4, 0],
      ["aTangentU", 4, 4],
      ["aTangentV", 4, 8],
      ["aUV", 2, 12],
    ]) {
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 56, offset * 4);
    }
    const rotation = gl.getUniformLocation(program, "uRotation");
    const scale = gl.getUniformLocation(program, "uScale");
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    return {
      gl,
      dispose,
      render(matrix, width, height) {
        if (gl.isContextLost()) return false;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniformMatrix4fv(rotation, false, matrix);
        gl.uniform2f(scale, 0.4, (0.4 * width) / height);
        gl.drawElements(
          gl.TRIANGLES,
          mesh.indices.length,
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
export function createCalabiYauRenderer() {
  const mesh = createQuinticMesh();
  const surface = document.createElement("canvas");
  let gpu = setupGPU(surface, mesh);
  let lost = false;
  let fallback;
  surface.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    lost = true;
  });
  surface.addEventListener("webglcontextrestored", () => {
    gpu?.dispose();
    gpu = setupGPU(surface, mesh);
    lost = false;
  });
  function wireframe(ctx, matrix, width, height) {
    fallback ??= createQuinticMesh(12, 16);
    const points = [];
    const vertices = fallback.vertices;
    for (let i = 0; i < vertices.length; i += 14) {
      const p = projectPoint(vertices.subarray(i, i + 4), matrix);
      points.push([
        width * (0.5 + p[0] * 0.2),
        height * 0.535 - p[1] * width * 0.2,
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
      const matrix = projectionMatrix(view, time);
      ctx.clearRect(0, 0, width, height);
      if (!lost && gpu?.render(matrix, width, height)) {
        ctx.drawImage(surface, 0, 0);
        ctx.canvas.dataset.renderer = "webgl";
      } else {
        wireframe(ctx, matrix, width, height);
        ctx.canvas.dataset.renderer = "wireframe";
      }
    },
  };
}
