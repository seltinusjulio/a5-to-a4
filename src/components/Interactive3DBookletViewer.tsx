import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as pdfjsLib from 'pdfjs-dist';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Layers,
  BookOpen,
  BookMarked,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { ImpositionResult, PageCropBox } from '../types/booklet';
import { renderPageThumbnail } from '../utils/pdfRenderer';
import { detectPageCropBox } from '../utils/autoCrop';
import {
  PAGE_W,
  PAGE_H,
  detectSoftwareWebGL,
  isWebGLAvailable,
  createWorkbenchTexture,
  createContactShadowTexture,
  createPagePlaceholderTexture,
  createPdfPageTextureFromImage,
  createLeafFaceGeometry,
  updateLeafFaceGeometry,
  createSaddleStitchStaplesGroup,
} from '../utils/booklet3dScene';

interface Interactive3DBookletViewerProps {
  imposition: ImpositionResult;
  pdfDocument: pdfjsLib.PDFDocumentProxy | null;
}

type CameraPresetId = 'iso' | 'top' | 'spine' | 'front';

interface LeafMeta {
  leafIndex: number;
  sheetIndex: number; // 0 = outermost sheet, S-1 = centerfold sheet
  isUpperHalf: boolean; // true for leaves 0..S-1
  frontPage: number | null; // 2i + 1
  backPage: number | null; // 2i + 2
  frontIsCover: boolean;
  backIsBackCover: boolean;
}

interface LeafRuntime {
  meta: LeafMeta;
  frontGeo: THREE.BufferGeometry;
  backGeo: THREE.BufferGeometry;
  frontMat: THREE.MeshStandardMaterial;
  backMat: THREE.MeshStandardMaterial;
  frontMesh: THREE.Mesh;
  backMesh: THREE.Mesh;
  currentTheta: number;
  currentSpineY: number;
}

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  iso: { label: 'Isometrik', pos: [0.35, 3.35, 3.65], target: [0, 0.12, 0] },
  top: { label: 'Atas', pos: [0, 4.7, 0.35], target: [0, 0.05, 0] },
  spine: { label: 'Punggung', pos: [-2.65, 1.55, 2.55], target: [0, 0.18, 0] },
  front: { label: 'Depan', pos: [0, 1.35, 4.1], target: [0, 0.18, 0] },
};

// Reusable math objects outside animation loop (zero per-frame GC)
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();

/**
 * Mode 3D Lengkap (Interaktif WebGL / Three.js):
 * Menampilkan simulasi fisik pelipatan lembar A4 -> A5, staples punggung (saddle-stitch),
 * tampilan tumpukan terpisah (exploded stack), animasi balik halaman melengkung,
 * dan orbit kamera 360 derajat.
 */
export const Interactive3DBookletViewer: React.FC<Interactive3DBookletViewerProps> = ({
  imposition,
  pdfDocument,
}) => {
  const paddedCount = imposition.metadata.paddedPageCount;
  const originalCount = imposition.metadata.originalPageCount;
  const sheetCount = Math.max(1, imposition.sheets.length);
  const totalLeaves = Math.max(2, sheetCount * 2);

  // Interactive UI state
  const [foldProgress, setFoldProgress] = useState<number>(100); // 0 = flat A4 stack, 100 = folded A5 booklet
  const [isPlayingFold, setIsPlayingFold] = useState<boolean>(false);
  const [exploded, setExploded] = useState<boolean>(false);
  const [flippedCount, setFlippedCount] = useState<number>(0); // 0 = closed front cover, 1..totalLeaves-1 = open spread, totalLeaves = closed back
  const [activeCamera, setActiveCamera] = useState<CameraPresetId>('iso');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [webglSupported] = useState<boolean>(() => isWebGLAvailable());
  const [contextLost, setContextLost] = useState<boolean>(false);
  const [remountSeed, setRemountSeed] = useState<number>(0);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false
  );

  // Isolated DOM container ref for WebGL canvas
  const canvasMountRef = useRef<HTMLDivElement>(null);

  // Build ordered physical leaf metadata from imposition
  const leavesMeta: LeafMeta[] = useMemo(() => {
    const virtualMap = new Map<
      number,
      { pageNumber: number | null; isCover: boolean; isBackCover: boolean }
    >();
    imposition.sheets.forEach((sheet) => {
      [
        sheet.front.leftPage,
        sheet.front.rightPage,
        sheet.back.leftPage,
        sheet.back.rightPage,
      ].forEach((p) => {
        virtualMap.set(p.virtualIndex, {
          pageNumber: p.pageNumber,
          isCover: p.isCover,
          isBackCover: p.isBackCover,
        });
      });
    });

    const list: LeafMeta[] = [];
    for (let i = 0; i < totalLeaves; i++) {
      const frontVirtual = i * 2 + 1;
      const backVirtual = i * 2 + 2;
      const frontInfo = virtualMap.get(frontVirtual);
      const backInfo = virtualMap.get(backVirtual);
      const isUpperHalf = i < sheetCount;
      const sheetIndex = isUpperHalf ? i : totalLeaves - 1 - i;

      list.push({
        leafIndex: i,
        sheetIndex,
        isUpperHalf,
        frontPage: frontInfo?.pageNumber ?? (frontVirtual <= originalCount ? frontVirtual : null),
        backPage: backInfo?.pageNumber ?? (backVirtual <= originalCount ? backVirtual : null),
        frontIsCover: Boolean(frontInfo?.isCover || frontVirtual === 1),
        backIsBackCover: Boolean(backInfo?.isBackCover || backVirtual === paddedCount),
      });
    }
    return list;
  }, [imposition.sheets, totalLeaves, sheetCount, originalCount, paddedCount]);

  // Mutable animation target ref so React UI updates never tear down WebGL
  const simRef = useRef({
    foldTarget: 1, // 0..1
    foldCurrent: 1,
    isPlayingFold: false,
    playDir: 1, // 1 = folding (0->1), -1 = unfolding (1->0)
    explodedTarget: 0,
    explodedCurrent: 0,
    flippedCount: 0,
    bookShiftX: -PAGE_W * 0.5,
    cameraTransitionActive: false,
    camPreset: 'iso' as CameraPresetId,
    isDark: isDarkTheme,
    showFoldLine: Boolean(imposition.options.showFoldLine),
  });

  // Reference to requestRender & texture updater exposed from the Three.js effect
  const engineApiRef = useRef<{
    requestRender: () => void;
    applyPageTexture: (pageNumber: number, img: HTMLImageElement) => void;
    updateTheme: (dark: boolean) => void;
    triggerCameraPreset: (preset: CameraPresetId) => void;
  } | null>(null);

  // Sync React controls -> mutable Three.js targets
  useEffect(() => {
    simRef.current.foldTarget = foldProgress / 100;
    engineApiRef.current?.requestRender();
  }, [foldProgress]);

  useEffect(() => {
    simRef.current.isPlayingFold = isPlayingFold;
    if (isPlayingFold) {
      simRef.current.playDir = simRef.current.foldCurrent > 0.85 ? -1 : 1;
      engineApiRef.current?.requestRender();
    }
  }, [isPlayingFold]);

  useEffect(() => {
    simRef.current.explodedTarget = exploded ? 1 : 0;
    engineApiRef.current?.requestRender();
  }, [exploded]);

  useEffect(() => {
    simRef.current.flippedCount = flippedCount;
    engineApiRef.current?.requestRender();
  }, [flippedCount]);

  useEffect(() => {
    simRef.current.showFoldLine = Boolean(imposition.options.showFoldLine);
    engineApiRef.current?.requestRender();
  }, [imposition.options.showFoldLine]);

  // Observe light/dark theme class changes on <html>
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark');
      setIsDarkTheme(dark);
      simRef.current.isDark = dark;
      engineApiRef.current?.updateTheme(dark);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Reset spread when document sheet count changes
  useEffect(() => {
    setFlippedCount(0);
    setFoldProgress(100);
    setIsPlayingFold(false);
    setExploded(false);
  }, [imposition.metadata.filename, totalLeaves]);

  // Initialize Three.js WebGL scene once per booklet structure (sheetCount / filename)
  useEffect(() => {
    if (!webglSupported) return;
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = Math.max(320, mountEl.clientWidth || 720);
    const height = Math.max(360, mountEl.clientHeight || 480);

    // 1. Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

    // 2. Scene, Studio Environment & Fog
    const scene = new THREE.Scene();
    const bgHex = simRef.current.isDark ? 0x111111 : 0xecece8;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.Fog(bgHex, 9.5, 22);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
    camera.position.set(...CAMERA_PRESETS.iso.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.iso.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.0;
    controls.maxDistance = 9.5;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.update();

    // 4. Balanced 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xdce8ff, 0x3b352d, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.55);
    keyLight.position.set(3.6, 5.4, 3.2);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1.0;
      keyLight.shadow.camera.far = 15;
      const d = 3.2;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xcfe0ff, 0.55);
    rimLight.position.set(-4.2, 2.8, -3.5);
    scene.add(rimLight);

    // 5. Composite Prepress Workbench Pedestal + Contact Shadow Grounding
    const workbenchGroup = new THREE.Group();
    let workbenchTex = createWorkbenchTexture(simRef.current.isDark, maxAnisotropy);
    const tableMat = new THREE.MeshStandardMaterial({
      map: workbenchTex,
      roughness: 0.88,
      metalness: 0.02,
    });
    const tableGeo = new THREE.PlaneGeometry(24, 24);
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.rotation.x = -Math.PI / 2;
    tableMesh.position.y = -0.02;
    tableMesh.receiveShadow = true;
    workbenchGroup.add(tableMesh);

    // Anodized aluminum ruler bar accent on the prepress workbench (rear edge)
    const rulerGeo = new THREE.BoxGeometry(4.4, 0.024, 0.12);
    const rulerMat = new THREE.MeshStandardMaterial({
      color: simRef.current.isDark ? 0x2b2b2b : 0x242424,
      roughness: 0.38,
      metalness: 0.75,
    });
    const rulerMesh = new THREE.Mesh(rulerGeo, rulerMat);
    rulerMesh.position.set(0, -0.008, -1.68);
    rulerMesh.castShadow = !isSoftwareGl;
    rulerMesh.receiveShadow = true;
    workbenchGroup.add(rulerMesh);

    // Vermilion center-fold reference marker on the ruler bar
    const markerGeo = new THREE.BoxGeometry(0.024, 0.028, 0.14);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0xd9381e,
      roughness: 0.45,
      metalness: 0.1,
    });
    const markerMesh = new THREE.Mesh(markerGeo, markerMat);
    markerMesh.position.set(0, -0.006, -1.68);
    workbenchGroup.add(markerMesh);

    // Soft radial contact shadow plane directly beneath booklet (Y offset prevents Z-fighting)
    const contactShadowTex = createContactShadowTexture();
    const contactShadowGeo = new THREE.PlaneGeometry(PAGE_W * 2.55, PAGE_H * 1.38);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = -0.005;
    workbenchGroup.add(contactShadowMesh);

    scene.add(workbenchGroup);

    // 6. Composite Booklet Assembly Group (Leaves + Saddle-Stitch Staples + Fold Spine Guide)
    const bookletGroup = new THREE.Group();
    scene.add(bookletGroup);

    const leafGap = Math.min(0.011, 0.18 / totalLeaves);
    const leafRuntimes: LeafRuntime[] = [];

    leavesMeta.forEach((meta) => {
      const frontGeo = createLeafFaceGeometry(1);
      const backGeo = createLeafFaceGeometry(-1);

      const frontTex = createPagePlaceholderTexture(
        meta.frontPage,
        meta.frontIsCover,
        false,
        maxAnisotropy
      );
      const backTex = createPagePlaceholderTexture(
        meta.backPage,
        false,
        meta.backIsBackCover,
        maxAnisotropy
      );

      const isOuterCoverLeaf = meta.leafIndex === 0 || meta.leafIndex === totalLeaves - 1;

      const frontMat = new THREE.MeshStandardMaterial({
        map: frontTex,
        roughness: isOuterCoverLeaf ? 0.56 : 0.82,
        metalness: 0.0,
        side: THREE.FrontSide,
      });

      const backMat = new THREE.MeshStandardMaterial({
        map: backTex,
        roughness: isOuterCoverLeaf ? 0.56 : 0.82,
        metalness: 0.0,
        side: THREE.FrontSide,
      });

      const frontMesh = new THREE.Mesh(frontGeo, frontMat);
      const backMesh = new THREE.Mesh(backGeo, backMat);
      frontMesh.castShadow = !isSoftwareGl;
      frontMesh.receiveShadow = true;
      backMesh.castShadow = !isSoftwareGl;
      backMesh.receiveShadow = true;

      bookletGroup.add(frontMesh);
      bookletGroup.add(backMesh);

      const initTheta = 0;
      const initY = (totalLeaves - 1 - meta.leafIndex) * leafGap + 0.01;
      updateLeafFaceGeometry(frontGeo, initTheta, initY, 0, 1, 0);
      updateLeafFaceGeometry(backGeo, initTheta, initY, 0, -1, 0);

      leafRuntimes.push({
        meta,
        frontGeo,
        backGeo,
        frontMat,
        backMat,
        frontMesh,
        backMesh,
        currentTheta: initTheta,
        currentSpineY: initY,
      });
    });

    // Metallic Saddle-Stitch Staples (brushed galvanized steel)
    const stapleMat = new THREE.MeshStandardMaterial({
      color: 0xd8dce0,
      metalness: 0.92,
      roughness: 0.22,
    });
    const staplesGroup = createSaddleStitchStaplesGroup(stapleMat);
    bookletGroup.add(staplesGroup);

    // Optional Signal Vermilion Spine Fold Guide Line along X=0
    const foldLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.015, -PAGE_H * 0.54),
      new THREE.Vector3(0, 0.015, PAGE_H * 0.54),
    ]);
    const foldLineMat = new THREE.LineBasicMaterial({
      color: 0xd9381e,
      transparent: true,
      opacity: 0.85,
    });
    const foldGuideLine = new THREE.Line(foldLineGeo, foldLineMat);
    bookletGroup.add(foldGuideLine);

    // Pre-warm shaders on GPU devices (skip on software WebGL per skill guidelines)
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 7. On-Demand Coalesced Render Loop with Software-WebGL `afterDraw` Pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;
    let lastTimestamp = performance.now();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function stepSimulation(dt: number): boolean {
      let needsMoreFrames = false;
      const s = simRef.current;

      // Auto-play fold cycle if playing
      if (s.isPlayingFold) {
        s.foldTarget += s.playDir * dt * 0.58;
        if (s.foldTarget >= 1) {
          s.foldTarget = 1;
          s.playDir = -1;
        } else if (s.foldTarget <= 0) {
          s.foldTarget = 0;
          s.playDir = 1;
        }
        setFoldProgress(Math.round(s.foldTarget * 100));
        needsMoreFrames = true;
      }

      // Smoothly damp fold and exploded state
      const prevFold = s.foldCurrent;
      s.foldCurrent = THREE.MathUtils.damp(s.foldCurrent, s.foldTarget, 7.5, dt);
      if (Math.abs(s.foldCurrent - s.foldTarget) > 0.001) {
        needsMoreFrames = true;
      } else {
        s.foldCurrent = s.foldTarget;
      }

      s.explodedCurrent = THREE.MathUtils.damp(s.explodedCurrent, s.explodedTarget, 7.0, dt);
      if (Math.abs(s.explodedCurrent - s.explodedTarget) > 0.001) {
        needsMoreFrames = true;
      } else {
        s.explodedCurrent = s.explodedTarget;
      }

      // Compute optical centering X shift
      let targetShiftX = 0;
      if (s.foldCurrent > 0.6) {
        if (s.flippedCount === 0) {
          targetShiftX = -PAGE_W * 0.5 * s.foldCurrent;
        } else if (s.flippedCount >= totalLeaves) {
          targetShiftX = PAGE_W * 0.5 * s.foldCurrent;
        }
      }
      s.bookShiftX = THREE.MathUtils.damp(s.bookShiftX, targetShiftX, 6.5, dt);
      if (Math.abs(s.bookShiftX - targetShiftX) > 0.001) {
        needsMoreFrames = true;
      }
      bookletGroup.position.x = s.bookShiftX;

      // Ground contact shadow follows booklet width & center cleanly
      const spreadRatio =
        s.foldCurrent < 0.99 || (s.flippedCount > 0 && s.flippedCount < totalLeaves) ? 1.0 : 0.58;
      contactShadowMesh.position.x =
        s.bookShiftX +
        (s.flippedCount === 0 && s.foldCurrent > 0.6
          ? PAGE_W * 0.5
          : s.flippedCount >= totalLeaves && s.foldCurrent > 0.6
          ? -PAGE_W * 0.5
          : 0);
      contactShadowMesh.scale.x = THREE.MathUtils.damp(
        contactShadowMesh.scale.x,
        spreadRatio,
        6.5,
        dt
      );
      if (Math.abs(contactShadowMesh.scale.x - spreadRatio) > 0.002) {
        needsMoreFrames = true;
      }

      // Update every leaf's angle, Y stacking height, and parabolic curl
      const explodeGap = s.explodedCurrent * 0.22;
      const isOpenSpread =
        s.foldCurrent > 0.85 && s.flippedCount > 0 && s.flippedCount < totalLeaves;

      for (let i = 0; i < leafRuntimes.length; i++) {
        const leaf = leafRuntimes[i];
        const { leafIndex, sheetIndex, isUpperHalf } = leaf.meta;

        const flatTheta = isUpperHalf ? Math.PI : 0;
        const foldedTheta = leafIndex < s.flippedCount ? Math.PI : 0;
        const targetTheta = THREE.MathUtils.lerp(flatTheta, foldedTheta, s.foldCurrent);

        const nextTheta = THREE.MathUtils.damp(leaf.currentTheta, targetTheta, 7.2, dt);
        if (Math.abs(nextTheta - targetTheta) > 0.0015) {
          needsMoreFrames = true;
        }
        leaf.currentTheta = Math.abs(nextTheta - targetTheta) <= 0.0015 ? targetTheta : nextTheta;

        const tNorm = leaf.currentTheta / Math.PI; // 0 (right) .. 1 (left)

        const yRight = (totalLeaves - 1 - leafIndex) * leafGap;
        const yLeft = leafIndex * leafGap;
        const foldedSpineY = THREE.MathUtils.lerp(yRight, yLeft, tNorm);
        const flatSpineY = sheetIndex * (leafGap * 1.65 + explodeGap);

        const turnLift = Math.sin(tNorm * Math.PI) * 0.032;
        const targetSpineY =
          0.012 +
          THREE.MathUtils.lerp(flatSpineY, foldedSpineY, s.foldCurrent) +
          (s.foldCurrent > 0.5 ? turnLift : 0) +
          sheetIndex * explodeGap * s.foldCurrent * 0.35;

        leaf.currentSpineY = THREE.MathUtils.damp(leaf.currentSpineY, targetSpineY, 8.5, dt);
        if (Math.abs(leaf.currentSpineY - targetSpineY) > 0.0008) {
          needsMoreFrames = true;
        }

        const midTurnFactor = Math.sin(tNorm * Math.PI);
        const archHeight = midTurnFactor * (0.14 + 0.16 * s.foldCurrent);
        const gutterLift = isOpenSpread ? 0.042 : 0;

        updateLeafFaceGeometry(
          leaf.frontGeo,
          leaf.currentTheta,
          leaf.currentSpineY,
          archHeight,
          1,
          gutterLift
        );
        updateLeafFaceGeometry(
          leaf.backGeo,
          leaf.currentTheta,
          leaf.currentSpineY,
          archHeight,
          -1,
          gutterLift
        );
      }

      // Position saddle-stitch staples along spine crease
      const topSpineY = 0.015 + totalLeaves * leafGap + (sheetCount - 1) * explodeGap * 0.35;
      const stapleOffset = (1 - s.foldCurrent) * 0.42;
      staplesGroup.position.y = topSpineY + stapleOffset;
      staplesGroup.visible = s.foldCurrent > 0.25;
      staplesGroup.scale.setScalar(THREE.MathUtils.clamp((s.foldCurrent - 0.25) / 0.75, 0.01, 1));

      // Fold spine reference line
      foldGuideLine.visible = s.showFoldLine && (s.foldCurrent < 0.98 || isOpenSpread);
      foldGuideLine.position.y = topSpineY + 0.01;

      // Smooth scripted camera preset transition (cancels immediately when user grabs OrbitControls)
      if (s.cameraTransitionActive) {
        const preset = CAMERA_PRESETS[s.camPreset];
        _camGoalPos.set(...preset.pos);
        _camGoalTarget.set(...preset.target);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 6.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 6.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 6.5, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 6.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 6.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 6.5, dt);

        if (
          camera.position.distanceTo(_camGoalPos) < 0.015 &&
          controls.target.distanceTo(_camGoalTarget) < 0.015
        ) {
          camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          s.cameraTransitionActive = false;
        } else {
          needsMoreFrames = true;
        }
      }

      if (Math.abs(prevFold - s.foldCurrent) > 0.0005) {
        needsMoreFrames = true;
      }

      return needsMoreFrames;
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        if (disposed) return;
        renderDirty = false;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
        lastTimestamp = now;

        const controlsMoved = controls.update();
        const animActive = stepSimulation(dt);

        renderer.render(scene, camera);

        const done = () => {
          if (disposed) return;
          renderBusy = false;
          if (renderDirty || animActive || (controls.enableDamping && controlsMoved)) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    }

    // Cancel camera preset animation if user manually interacts with OrbitControls
    const onControlStart = () => {
      simRef.current.cameraTransitionActive = false;
    };
    const onControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    // Responsive canvas sizing via ResizeObserver
    const handleResize = () => {
      if (disposed || !mountEl) return;
      const w = Math.max(320, mountEl.clientWidth);
      const h = Math.max(360, mountEl.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(mountEl);
    window.addEventListener('resize', handleResize);

    // WebGL context-loss recovery listeners
    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderBusy = false;
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored, false);

    // Expose live imperative API to React hooks
    engineApiRef.current = {
      requestRender,
      applyPageTexture: (pageNumber: number, img: HTMLImageElement) => {
        if (disposed) return;
        const outerMarginMm = imposition.options.outerMarginMm ?? 3;
        const gutterMarginMm = imposition.options.gutterMarginMm ?? 2;
        const showFoldLine = Boolean(imposition.options.showFoldLine);

        leafRuntimes.forEach((leaf) => {
          if (leaf.meta.frontPage === pageNumber) {
            const newTex = createPdfPageTextureFromImage(img, {
              pageNumber,
              isLeftOnSpread: false,
              outerMarginMm,
              gutterMarginMm,
              showFoldLine,
              maxAnisotropy,
            });
            const oldTex = leaf.frontMat.map;
            leaf.frontMat.map = newTex;
            leaf.frontMat.needsUpdate = true;
            if (oldTex) oldTex.dispose();
          }
          if (leaf.meta.backPage === pageNumber) {
            const newTex = createPdfPageTextureFromImage(img, {
              pageNumber,
              isLeftOnSpread: true,
              outerMarginMm,
              gutterMarginMm,
              showFoldLine,
              maxAnisotropy,
            });
            const oldTex = leaf.backMat.map;
            leaf.backMat.map = newTex;
            leaf.backMat.needsUpdate = true;
            if (oldTex) oldTex.dispose();
          }
        });
        requestRender();
      },
      updateTheme: (dark: boolean) => {
        if (disposed) return;
        const colorHex = dark ? 0x111111 : 0xecece8;
        scene.background = new THREE.Color(colorHex);
        scene.fog = new THREE.Fog(colorHex, 9.5, 22);
        const newWbTex = createWorkbenchTexture(dark, maxAnisotropy);
        tableMat.map = newWbTex;
        tableMat.needsUpdate = true;
        workbenchTex.dispose();
        workbenchTex = newWbTex;
        requestRender();
      },
      triggerCameraPreset: (preset: CameraPresetId) => {
        simRef.current.camPreset = preset;
        simRef.current.cameraTransitionActive = true;
        requestRender();
      },
    };

    // Initial render
    requestRender();

    // Full WebGL resource cleanup on unmount
    return () => {
      disposed = true;
      engineApiRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost, false);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored, false);
      controls.dispose();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleResize);

      leafRuntimes.forEach((leaf) => {
        leaf.frontGeo.dispose();
        leaf.backGeo.dispose();
        if (leaf.frontMat.map) leaf.frontMat.map.dispose();
        if (leaf.backMat.map) leaf.backMat.map.dispose();
        leaf.frontMat.dispose();
        leaf.backMat.dispose();
      });

      staplesGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      stapleMat.dispose();
      foldLineGeo.dispose();
      foldLineMat.dispose();
      tableGeo.dispose();
      tableMat.dispose();
      workbenchTex.dispose();
      rulerGeo.dispose();
      rulerMat.dispose();
      markerGeo.dispose();
      markerMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      contactShadowTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (mountEl.contains(renderer.domElement)) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, [
    webglSupported,
    imposition.metadata.filename,
    imposition.options.outerMarginMm,
    imposition.options.gutterMarginMm,
    imposition.options.showFoldLine,
    leavesMeta,
    totalLeaves,
    sheetCount,
    remountSeed,
  ]);

  // Lazily render PDF pages as high-res textures onto the 3D booklet leaves
  const loadedPagesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    loadedPagesRef.current.clear();
  }, [
    imposition.metadata.filename,
    imposition.options.outerMarginMm,
    imposition.options.gutterMarginMm,
    imposition.options.showFoldLine,
    imposition.options.autoCropWhiteMargins,
    imposition.options.cropPaddingMm,
    imposition.options.cropThreshold,
  ]);

  useEffect(() => {
    if (!pdfDocument || !webglSupported) return;

    const pagesToRender = new Set<number>();
    const addLeafPages = (idx: number) => {
      const meta = leavesMeta[idx];
      if (!meta) return;
      if (meta.frontPage) pagesToRender.add(meta.frontPage);
      if (meta.backPage) pagesToRender.add(meta.backPage);
    };

    addLeafPages(0);
    addLeafPages(totalLeaves - 1);
    addLeafPages(Math.max(0, sheetCount - 1));
    addLeafPages(Math.min(totalLeaves - 1, sheetCount));

    for (let i = Math.max(0, flippedCount - 3); i <= Math.min(totalLeaves - 1, flippedCount + 3); i++) {
      addLeafPages(i);
    }

    let cancelled = false;

    pagesToRender.forEach(async (pNum) => {
      if (loadedPagesRef.current.has(pNum)) return;
      loadedPagesRef.current.add(pNum);

      let cropBox: PageCropBox | undefined;
      if (imposition.options.autoCropWhiteMargins) {
        try {
          const pageProxy = await pdfDocument.getPage(pNum);
          cropBox = await detectPageCropBox(
            pageProxy,
            imposition.metadata.filename,
            pNum,
            imposition.options.cropPaddingMm ?? 3,
            imposition.options.cropThreshold ?? 245
          );
        } catch {
          // Ignore individual crop detection errors
        }
      }

      const dataUrl = await renderPageThumbnail(pdfDocument, pNum, 560, cropBox);
      if (cancelled || !dataUrl) return;

      const img = new Image();
      img.onload = () => {
        if (!cancelled) {
          engineApiRef.current?.applyPageTexture(pNum, img);
        }
      };
      img.src = dataUrl;
    });

    return () => {
      cancelled = true;
    };
  }, [
    pdfDocument,
    webglSupported,
    flippedCount,
    leavesMeta,
    totalLeaves,
    sheetCount,
    imposition.metadata.filename,
    imposition.options.autoCropWhiteMargins,
    imposition.options.cropPaddingMm,
    imposition.options.cropThreshold,
  ]);

  // Interactive button handlers
  const handleSelectCamera = useCallback((preset: CameraPresetId) => {
    setActiveCamera(preset);
    engineApiRef.current?.triggerCameraPreset(preset);
  }, []);

  const handlePrevLeaf = useCallback(() => {
    setIsPlayingFold(false);
    setFoldProgress(100);
    setFlippedCount((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextLeaf = useCallback(() => {
    setIsPlayingFold(false);
    setFoldProgress(100);
    setFlippedCount((prev) => Math.min(totalLeaves, prev + 1));
  }, [totalLeaves]);

  const handleToggleCover = useCallback(() => {
    setIsPlayingFold(false);
    setFoldProgress(100);
    setFlippedCount((prev) => (prev === 0 ? 1 : 0));
  }, []);

  const handleFoldSliderChange = (val: number) => {
    setIsPlayingFold(false);
    setFoldProgress(val);
    if (val < 100 && flippedCount > 0) {
      setFlippedCount(0);
    }
  };

  const handleResetAll = () => {
    setIsPlayingFold(false);
    setExploded(false);
    setFoldProgress(100);
    setFlippedCount(0);
    handleSelectCamera('iso');
  };

  const stageLabel =
    foldProgress < 15
      ? `Lembar A4 Datar (${sheetCount} Lembar)`
      : foldProgress < 95
      ? `Proses Melipat A4 → A5 (${foldProgress}%)`
      : flippedCount === 0
      ? 'Booklet Terlipat · Sampul Depan'
      : flippedCount >= totalLeaves
      ? 'Booklet Terlipat · Sampul Belakang'
      : `Terbuka · Hal ${leavesMeta[flippedCount - 1]?.backPage ?? '∅'} & Hal ${leavesMeta[flippedCount]?.frontPage ?? '∅'}`;

  return (
    <div
      className="relative w-full h-[520px] sm:h-[580px] bg-[#ECECE8] dark:bg-[#111111] overflow-hidden select-none"
      data-testid="interactive-3d-viewer"
    >
      {/* Isolated WebGL Canvas Mount (Zero sibling React nodes inside) */}
      {webglSupported ? (
        <div
          ref={canvasMountRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          aria-label="Kanvas pratinjau booklet 3D interaktif"
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#ECECE8] dark:bg-[#111111]"
          data-testid="webgl-fallback"
        >
          <span className="font-mono text-xs font-bold px-2 py-1 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 mb-3">
            WEBGL STUDIO 3D
          </span>
          <p className="text-sm font-bold text-neutral-900 dark:text-white max-w-md">
            Pratinjau WebGL 3D tidak tersedia pada lingkungan browser ini.
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 max-w-md">
            Gunakan mode <strong>Flipbook 3D (Ringan)</strong> untuk animasi buka-tutup dan balik halaman tanpa GPU WebGL.
          </p>
        </div>
      )}

      {/* WebGL Context Lost Recovery Overlay */}
      {contextLost && (
        <div
          role="alert"
          data-testid="webgl-context-lost"
          className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-[#ECECE8] dark:bg-[#111111]"
        >
          <span className="font-mono text-xs font-bold px-2 py-1 bg-[#D9381E] text-white mb-3">
            KONTEKS GPU TERPUTUS
          </span>
          <p className="text-sm font-bold text-neutral-900 dark:text-white max-w-md">
            Rendering WebGL dihentikan sementara oleh perangkat.
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 mb-4 max-w-md">
            Klik tombol di bawah untuk menginisialisasi ulang Studio 3D atau beralih ke mode Flipbook 3D (Ringan).
          </p>
          <button
            type="button"
            onClick={() => {
              setContextLost(false);
              setRemountSeed((s) => s + 1);
            }}
            className="h-9 px-4 bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950 hover:bg-[#D9381E] dark:hover:bg-[#F04A2E] dark:hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Muat Ulang Studio 3D</span>
          </button>
        </div>
      )}

      {/* Minimal Static Top-Left Spec Badge (No backdrop-blur, no pulsating dots) */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-600 px-2.5 py-1.5 text-[11px]">
        <span className="font-mono font-bold text-[#D9381E] dark:text-[#F04A2E]">
          3D STUDIO
        </span>
        <span className="text-neutral-400" aria-hidden="true">·</span>
        <span className="font-semibold text-neutral-950 dark:text-white" data-testid="studio-3d-status">
          {stageLabel}
        </span>
        <span className="hidden sm:inline text-neutral-400" aria-hidden="true">·</span>
        <span className="hidden sm:inline font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
          Seret 360° · Scroll Zoom
        </span>
      </div>

      {/* Unified Collapsible Bottom Control Dock (Zero Mid-Side Viewport Occlusion, Solid Surface, No backdrop-blur) */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-20 w-[calc(100%-24px)] max-w-[820px] transition-transform duration-300 ${
          dockCollapsed ? 'bottom-0 translate-y-[calc(100%-30px)]' : 'bottom-3 translate-y-0'
        }`}
      >
        {/* Collapse / Expand Tab Attached to Top Edge of Dock */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((prev) => !prev)}
            data-testid="toggle-3d-dock"
            className="h-[30px] px-3 bg-white dark:bg-[#161616] border border-b-0 border-neutral-900 dark:border-neutral-600 text-[11px] font-mono font-semibold text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Tampilkan Kontrol 3D</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Sembunyikan Kontrol</span>
              </>
            )}
          </button>
        </div>

        {/* Main Boxy Dock Body */}
        <div className="bg-white dark:bg-[#161616] border border-neutral-900 dark:border-neutral-600 p-3 flex flex-col gap-2.5">
          {/* Row 1: Fold A4 -> A5 Simulation + Exploded Stack */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2 flex-1 min-w-[210px]">
              <button
                type="button"
                onClick={() => setIsPlayingFold((prev) => !prev)}
                className={`h-7 px-2.5 border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  isPlayingFold
                    ? 'border-[#D9381E] bg-[#D9381E] text-white'
                    : 'border-neutral-900 dark:border-neutral-500 bg-white dark:bg-[#1E1E1E] text-neutral-950 dark:text-white hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950'
                }`}
              >
                {isPlayingFold ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isPlayingFold ? 'Jeda Lipat' : 'Animasi Lipat'}</span>
              </button>

              <div className="flex items-center gap-2 flex-1">
                <label
                  htmlFor="fold-progress-slider"
                  className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 whitespace-nowrap"
                >
                  Lipatan
                </label>
                <input
                  id="fold-progress-slider"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={foldProgress}
                  onChange={(e) => handleFoldSliderChange(Number(e.target.value))}
                  className="w-full accent-[#D9381E] cursor-pointer"
                />
                <span
                  className="font-mono text-[11px] font-bold tabular-nums text-neutral-950 dark:text-white w-9 text-right"
                  data-testid="fold-progress-readout"
                >
                  {foldProgress}%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setExploded((prev) => !prev)}
                aria-pressed={exploded}
                className={`h-7 px-2.5 border text-[11px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  exploded
                    ? 'border-[#D9381E] bg-[#D9381E]/10 dark:bg-[#F04A2E]/15 text-[#D9381E] dark:text-[#F04A2E]'
                    : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:border-neutral-900 dark:hover:border-neutral-400'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Pisah Lembar</span>
              </button>

              <button
                type="button"
                onClick={handleResetAll}
                title="Reset kamera dan posisi booklet"
                aria-label="Reset 3D"
                className="h-7 w-7 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#1E1E1E] hover:border-neutral-900 dark:hover:border-neutral-400 flex items-center justify-center text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Page Flip Controls + Camera Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Page Flip & Open/Close */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleCover}
                className="h-7 px-2.5 border border-neutral-900 dark:border-neutral-600 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-950 hover:text-white dark:hover:bg-neutral-100 dark:hover:text-neutral-950 text-neutral-900 dark:text-neutral-100 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {flippedCount === 0 ? (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Buka</span>
                  </>
                ) : (
                  <>
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>Tutup</span>
                  </>
                )}
              </button>

              <div className="flex items-center border border-neutral-900 dark:border-neutral-600">
                <button
                  type="button"
                  onClick={handlePrevLeaf}
                  disabled={flippedCount === 0 && foldProgress === 100}
                  aria-label="Halaman 3D sebelumnya"
                  className="h-7 px-2 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-35 disabled:pointer-events-none flex items-center text-neutral-900 dark:text-neutral-100 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span
                  className="h-7 px-2.5 border-x border-neutral-300 dark:border-neutral-700 font-mono text-[11px] font-bold tabular-nums flex items-center text-neutral-950 dark:text-white"
                  data-testid="studio-leaf-readout"
                >
                  {flippedCount}/{totalLeaves}
                </span>
                <button
                  type="button"
                  onClick={handleNextLeaf}
                  disabled={flippedCount >= totalLeaves && foldProgress === 100}
                  aria-label="Halaman 3D berikutnya"
                  className="h-7 px-2 bg-white dark:bg-[#1E1E1E] hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-35 disabled:pointer-events-none flex items-center text-neutral-900 dark:text-neutral-100 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Camera Viewpoint Presets */}
            <div className="flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-neutral-500 mr-0.5 hidden sm:block" />
              <div className="flex border border-neutral-300 dark:border-neutral-700 text-[11px] font-semibold">
                {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((presetKey, idx) => (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => handleSelectCamera(presetKey)}
                    className={`h-7 px-2 transition-colors cursor-pointer ${
                      idx > 0 ? 'border-l border-neutral-300 dark:border-neutral-700' : ''
                    } ${
                      activeCamera === presetKey
                        ? 'bg-neutral-950 dark:bg-neutral-100 text-white dark:text-neutral-950'
                        : 'bg-white dark:bg-[#1E1E1E] text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {CAMERA_PRESETS[presetKey].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
