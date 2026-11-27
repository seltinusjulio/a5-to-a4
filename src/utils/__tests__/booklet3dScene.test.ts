import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  PAGE_W,
  LEAF_SEG_X,
  createLeafFaceGeometry,
  updateLeafFaceGeometry,
  createSaddleStitchStaplesGroup,
  detectSoftwareWebGL,
  isWebGLAvailable,
  createWorkbenchTexture,
  createContactShadowTexture,
  createPagePlaceholderTexture,
  createPdfPageTextureFromImage,
} from '../booklet3dScene';

function createMock2DContext() {
  const gradientMock = { addColorStop: vi.fn() };
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => gradientMock),
    createLinearGradient: vi.fn(() => gradientMock),
  };
}

describe('booklet3dScene procedural builders', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds front and back leaf BufferGeometries with correct vertex positions on turn', () => {
    const frontGeo = createLeafFaceGeometry(1);
    const backGeo = createLeafFaceGeometry(-1);

    const posFront = frontGeo.getAttribute('position') as THREE.BufferAttribute;
    expect(posFront.count).toBe((LEAF_SEG_X + 1) * 3);

    // At theta = 0 (flat right), outer edge vertex ix = LEAF_SEG_X sits at x = +PAGE_W
    updateLeafFaceGeometry(frontGeo, 0, 0.05, 0, 1, 0);
    expect(posFront.getX(LEAF_SEG_X)).toBeCloseTo(PAGE_W, 3);
    expect(posFront.getY(LEAF_SEG_X)).toBeCloseTo(0.05, 2);

    // At theta = Math.PI (flipped flat left), outer edge sits at x = -PAGE_W
    updateLeafFaceGeometry(frontGeo, Math.PI, 0.05, 0, 1, 0);
    expect(posFront.getX(LEAF_SEG_X)).toBeCloseTo(-PAGE_W, 3);

    // At mid-turn theta = Math.PI / 2 with positive arch, mid-point bends along -X normal
    const midIdx = Math.floor(LEAF_SEG_X / 2);
    updateLeafFaceGeometry(backGeo, Math.PI / 2, 0.02, 0.25, -1, 0.03);
    const posBack = backGeo.getAttribute('position') as THREE.BufferAttribute;
    expect(posBack.getX(midIdx)).toBeLessThan(-0.2);

    frontGeo.dispose();
    backGeo.dispose();
  });

  it('creates a saddle-stitch staples group with two metallic wire meshes', () => {
    const mat = new THREE.MeshStandardMaterial({ metalness: 0.9, roughness: 0.2 });
    const group = createSaddleStitchStaplesGroup(mat);
    expect(group.children.length).toBe(2);
    group.children.forEach((child) => {
      expect((child as THREE.Mesh).isMesh).toBe(true);
      ((child as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
    });
    mat.dispose();
  });

  it('draws procedural workbench, shadow, placeholder, and PDF page textures onto 2D canvas', () => {
    const mockCtx = createMock2DContext();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type) => {
      if (type === '2d') return mockCtx as unknown as CanvasRenderingContext2D;
      return null;
    });

    const wbLight = createWorkbenchTexture(false, 4);
    const wbDark = createWorkbenchTexture(true, 4);
    const shadow = createContactShadowTexture();
    const coverPlaceholder = createPagePlaceholderTexture(1, true, false, 4);
    const backPlaceholder = createPagePlaceholderTexture(8, false, true, 4);
    const innerPlaceholder = createPagePlaceholderTexture(4, false, false, 4);
    const blankPlaceholder = createPagePlaceholderTexture(null, false, false, 4);

    // Composite PDF page textures (both portrait and wide images, left and right spread sides)
    const portraitImg = { naturalWidth: 420, naturalHeight: 595 } as HTMLImageElement;
    const wideImg = { naturalWidth: 800, naturalHeight: 400 } as HTMLImageElement;

    const rightTex = createPdfPageTextureFromImage(portraitImg, {
      pageNumber: 1,
      isLeftOnSpread: false,
      outerMarginMm: 5,
      gutterMarginMm: 4,
      showFoldLine: true,
      maxAnisotropy: 4,
    });
    const leftTex = createPdfPageTextureFromImage(wideImg, {
      pageNumber: 2,
      isLeftOnSpread: true,
      outerMarginMm: 5,
      gutterMarginMm: 4,
      showFoldLine: false,
      maxAnisotropy: 4,
    });

    expect(wbLight.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(wbDark.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(rightTex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(leftTex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(shadow).toBeInstanceOf(THREE.CanvasTexture);
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(2);
    expect(mockCtx.createRadialGradient).toHaveBeenCalledTimes(1);

    wbLight.dispose();
    wbDark.dispose();
    shadow.dispose();
    coverPlaceholder.dispose();
    backPlaceholder.dispose();
    innerPlaceholder.dispose();
    blankPlaceholder.dispose();
    rightTex.dispose();
    leftTex.dispose();
  });

  it('detects hardware vs software WebGL contexts and handles missing WebGL safely', () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type) => {
      if (type === 'webgl2') {
        return {
          RENDERER: 0x1f01,
          getExtension: (name: string) => {
            if (name === 'WEBGL_debug_renderer_info') return { UNMASKED_RENDERER_WEBGL: 0x9246 };
            if (name === 'WEBGL_lose_context') return { loseContext };
            return null;
          },
          getParameter: () => 'Google SwiftShader',
        } as unknown as WebGL2RenderingContext;
      }
      return null;
    });

    expect(isWebGLAvailable()).toBe(true);
    expect(detectSoftwareWebGL()).toBe(true);
    expect(loseContext).toHaveBeenCalled();

    // Missing WebGL context fallback
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(isWebGLAvailable()).toBe(false);
    expect(detectSoftwareWebGL()).toBe(true);
  });
});
