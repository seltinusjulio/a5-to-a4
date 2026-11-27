import * as THREE from 'three';

export const PAGE_W = 1.485; // 148.5 mm (A5 width)
export const PAGE_H = 2.1; // 210 mm (A5 height)
export const LEAF_SEG_X = 20;
export const LEAF_SEG_Z = 2;
export const LEAF_HALF_THICKNESS = 0.0014;

/**
 * Detects software WebGL renderers (SwiftShader, llvmpipe, WARP) to adapt rendering cost
 * without changing scene geometry, layout, or interactive logic.
 */
export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

/**
 * Checks whether WebGL is available in the current environment (returns false in jsdom).
 */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a procedural Swiss prepress cutting-mat / drafting workbench texture.
 */
export function createWorkbenchTexture(
  isDark: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = isDark ? '#141414' : '#E7E7E2';
    ctx.fillRect(0, 0, size, size);

    // Fine millimeter-like sub-grid
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.035)' : 'rgba(13,13,13,0.05)';
    ctx.lineWidth = 1;
    const minorStep = 32;
    for (let i = 0; i <= size; i += minorStep) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Major centimeter grid
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,13,13,0.11)';
    ctx.lineWidth = 1.5;
    const majorStep = 128;
    for (let i = 0; i <= size; i += majorStep) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Subtle registration crosshairs at major intersections
    ctx.strokeStyle = isDark ? 'rgba(240,74,46,0.22)' : 'rgba(217,56,30,0.24)';
    ctx.lineWidth = 1.2;
    for (let x = 0; x <= size; x += majorStep) {
      for (let y = 0; y <= size; y += majorStep) {
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 6, y);
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x, y + 6);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 7);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/**
 * Creates a soft radial contact shadow texture for grounding the booklet on the workbench.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.48
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a crisp procedural page texture (used for blank pages or while PDF page renders).
 */
export function createPagePlaceholderTexture(
  pageNumber: number | null,
  isCover: boolean,
  isBackCover: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 420;
  const h = 594;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Paper ivory background
    ctx.fillStyle = pageNumber === null ? '#F7F7F4' : '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // Subtle paper edge border
    ctx.strokeStyle = '#DCDCD6';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    if (pageNumber === null) {
      // Blank page styling
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#C8C8C0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(28, 28, w - 56, h - 56);
      ctx.setLineDash([]);

      ctx.fillStyle = '#9A9A92';
      ctx.font = '600 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('∅', w / 2, h / 2 - 6);
      ctx.font = '600 14px sans-serif';
      ctx.fillText('HALAMAN KOSONG', w / 2, h / 2 + 22);
    } else {
      // Top editorial band for cover/back-cover
      if (isCover) {
        ctx.fillStyle = '#D9381E';
        ctx.fillRect(24, 24, w - 48, 34);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SAMPUL DEPAN · A5', 36, 46);
      } else if (isBackCover) {
        ctx.fillStyle = '#181818';
        ctx.fillRect(24, 24, w - 48, 34);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('SAMPUL BELAKANG · A5', 36, 46);
      }

      // Page number centerpiece
      ctx.fillStyle = '#141414';
      ctx.font = '700 64px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(pageNumber), w / 2, h / 2 + 12);

      ctx.fillStyle = '#737373';
      ctx.font = '600 13px monospace';
      ctx.fillText(`HALAMAN ${pageNumber}`, w / 2, h / 2 + 44);

      // Subtle wireframe lines
      ctx.strokeStyle = '#EAEAE4';
      ctx.lineWidth = 2;
      for (let y = h * 0.68; y < h - 48; y += 20) {
        ctx.beginPath();
        ctx.moveTo(44, y);
        ctx.lineTo(w - 44, y);
        ctx.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

/**
 * Composites a rendered PDF page data URL onto an A5 proportioned paper canvas
 * respecting the booklet's outer margin, spine gutter, and optional fold marker.
 */
export function createPdfPageTextureFromImage(
  img: HTMLImageElement,
  options: {
    pageNumber: number;
    isLeftOnSpread: boolean;
    outerMarginMm: number;
    gutterMarginMm: number;
    showFoldLine: boolean;
    maxAnisotropy: number;
  }
): THREE.CanvasTexture {
  const w = 512;
  const h = Math.round((512 * 210) / 148.5);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Pure crisp white printed paper base
    ctx.fillStyle = '#FCFBF8';
    ctx.fillRect(0, 0, w, h);

    const outerPxX = (options.outerMarginMm / 148.5) * w;
    const outerPxY = (options.outerMarginMm / 210) * h;
    const gutterPxX = (options.gutterMarginMm / 148.5) * w;

    const padLeft = options.isLeftOnSpread ? outerPxX : gutterPxX;
    const padRight = options.isLeftOnSpread ? gutterPxX : outerPxX;
    const boxW = Math.max(10, w - padLeft - padRight);
    const boxH = Math.max(10, h - outerPxY * 2);

    const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const boxAspect = boxW / boxH;

    let drawW = boxW;
    let drawH = boxH;
    if (imgAspect > boxAspect) {
      drawH = boxW / imgAspect;
    } else {
      drawW = boxH * imgAspect;
    }

    const drawX = padLeft + (boxW - drawW) / 2;
    const drawY = outerPxY + (boxH - drawH) / 2;

    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // Subtle spine crease shadow
    const spineGrad = options.isLeftOnSpread
      ? ctx.createLinearGradient(w - 28, 0, w, 0)
      : ctx.createLinearGradient(0, 0, 28, 0);
    if (options.isLeftOnSpread) {
      spineGrad.addColorStop(0, 'rgba(0,0,0,0)');
      spineGrad.addColorStop(1, 'rgba(0,0,0,0.14)');
      ctx.fillStyle = spineGrad;
      ctx.fillRect(w - 28, 0, 28, h);
    } else {
      spineGrad.addColorStop(0, 'rgba(0,0,0,0.14)');
      spineGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = spineGrad;
      ctx.fillRect(0, 0, 28, h);
    }

    // Optional fold line indicator along the spine edge
    if (options.showFoldLine) {
      ctx.strokeStyle = 'rgba(217, 56, 30, 0.72)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      const spineX = options.isLeftOnSpread ? w - 2 : 2;
      ctx.moveTo(spineX, 0);
      ctx.lineTo(spineX, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = options.maxAnisotropy;
  return texture;
}

/**
 * Builds a subdivided BufferGeometry for one face (front or back) of a booklet leaf.
 * Front face (+1) faces +Y at theta = 0; Back face (-1) faces +Y at theta = PI.
 */
export function createLeafFaceGeometry(sideSign: 1 | -1): THREE.BufferGeometry {
  const cols = LEAF_SEG_X + 1;
  const rows = LEAF_SEG_Z + 1;
  const vertexCount = cols * rows;

  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  let ptrUV = 0;
  for (let iz = 0; iz <= LEAF_SEG_Z; iz++) {
    const vNorm = iz / LEAF_SEG_Z; // 0 (top, -Z) .. 1 (bottom, +Z)
    for (let ix = 0; ix <= LEAF_SEG_X; ix++) {
      const uNorm = ix / LEAF_SEG_X; // 0 (spine) .. 1 (outer edge)
      uvs[ptrUV++] = sideSign === 1 ? uNorm : 1 - uNorm;
      uvs[ptrUV++] = 1 - vNorm;
    }
  }

  const indices: number[] = [];
  for (let iz = 0; iz < LEAF_SEG_Z; iz++) {
    for (let ix = 0; ix < LEAF_SEG_X; ix++) {
      const a = iz * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;

      if (sideSign === 1) {
        // Outward normal +Y when flat on right (theta = 0)
        indices.push(a, c, b);
        indices.push(b, c, d);
      } else {
        // Outward normal -Y at theta = 0, which flips to +Y when turned to left (theta = PI)
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  // Initialize flat resting pose
  updateLeafFaceGeometry(geometry, 0, 0, 0, sideSign, 0);
  return geometry;
}

/**
 * Updates vertex positions and analytical normals of a leaf face in-place (zero GC).
 * Produces smooth paper curvature when turning pages or folding A4 sheets into A5.
 */
export function updateLeafFaceGeometry(
  geometry: THREE.BufferGeometry,
  theta: number, // 0 (flat right) .. Math.PI (flat left)
  spineY: number,
  archHeight: number, // parabolic curl along local normal during turn/fold
  sideSign: 1 | -1,
  spineGutterLift: number // subtle resting book spine curve when open
): void {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;

  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Local normal pointing toward Front face (+Y at theta=0, -Y at theta=PI)
  const nX = -sinT;
  const nY = cosT;

  const cols = LEAF_SEG_X + 1;
  const halfThickOffset = sideSign * LEAF_HALF_THICKNESS;

  for (let ix = 0; ix <= LEAF_SEG_X; ix++) {
    const u = ix / LEAF_SEG_X;
    const dist = u * PAGE_W;

    // Combine dynamic turn arch + gentle spine gutter lift near fold
    const sinPiU = Math.sin(u * Math.PI);
    const gutterCurve = Math.sin(Math.min(1, u * 2.2) * (Math.PI / 2)) * (1 - u) * spineGutterLift;
    const bendN = sinPiU * archHeight + gutterCurve;

    // Derivative d(bendN)/d(dist) for crisp analytical normals (no computeVertexNormals GC needed)
    const dBendDu = Math.PI * Math.cos(u * Math.PI) * archHeight;
    const slope = dBendDu / PAGE_W;

    // Tangent in XY plane along the curved leaf: (cosT - slope*sinT, sinT + slope*cosT)
    const tx = cosT - slope * sinT;
    const ty = sinT + slope * cosT;
    const tLen = Math.hypot(tx, ty) || 1;
    // Outward surface normal rotated by sideSign
    const outNx = (-ty / tLen) * sideSign;
    const outNy = (tx / tLen) * sideSign;

    const totalOffset = bendN + halfThickOffset;
    const px = dist * cosT + totalOffset * nX;
    const py = spineY + dist * sinT + totalOffset * nY;

    for (let iz = 0; iz <= LEAF_SEG_Z; iz++) {
      const idx = iz * cols + ix;
      const pz = (iz / LEAF_SEG_Z - 0.5) * PAGE_H;

      posAttr.setXYZ(idx, px, py, pz);
      normAttr.setXYZ(idx, outNx, outNy, 0);
    }
  }

  posAttr.needsUpdate = true;
  normAttr.needsUpdate = true;
}

/**
 * Builds a pair of realistic metallic U-shaped saddle-stitch staples along the booklet spine.
 */
export function createSaddleStitchStaplesGroup(
  metalMaterial: THREE.MeshStandardMaterial
): THREE.Group {
  const staplesGroup = new THREE.Group();
  const stapleLength = 0.16; // 16 mm wide wire crown
  const legDepth = 0.045;
  const wireRadius = 0.0085;

  const zPositions = [-PAGE_H * 0.27, PAGE_H * 0.27];

  zPositions.forEach((zCenter) => {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.015, -legDepth, zCenter - stapleLength / 2),
      new THREE.Vector3(0.0, 0.0, zCenter - stapleLength / 2),
      new THREE.Vector3(0.0, 0.004, zCenter),
      new THREE.Vector3(0.0, 0.0, zCenter + stapleLength / 2),
      new THREE.Vector3(0.015, -legDepth, zCenter + stapleLength / 2),
    ]);

    const tubeGeo = new THREE.TubeGeometry(path, 20, wireRadius, 8, false);
    const stapleMesh = new THREE.Mesh(tubeGeo, metalMaterial);
    stapleMesh.castShadow = true;
    stapleMesh.receiveShadow = true;
    staplesGroup.add(stapleMesh);
  });

  return staplesGroup;
}
