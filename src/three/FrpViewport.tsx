import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type RefObject,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  AR_BASE_PEDESTAL_OFFSET_M,
  AR_PHYSICAL_SCALE,
  type ArSupportState,
} from '../utils/arConfig';
import {
  computeCrackCameraPose,
  computeCrackInspectionReport,
  type CrackInspectionReport,
} from '../utils/crackAnalysis';
import type { CameraPreset, GroupId, LayerKey } from '../utils/frpData';
import { computeExplodedLayerOffsets, computeStressStrainPoint } from '../utils/frpData';
import {
  selectHoveredComponent,
  type ComponentKey,
  type HoverHitCandidate,
} from '../utils/specimenTooltip';
import { computeXrayCameraPose, computeXrayCrossSection } from '../utils/xraySection';
import { createProceduralTextures } from './proceduralTextures';
import { createSpecimenRig, type ScaleCalloutAnchor } from './specimenBuilder';

export interface HoverSpecimenPayload {
  componentKey: ComponentKey;
  isOverlapZone: boolean;
  clientX: number;
  clientY: number;
}

export interface FrpViewportHandle {
  startArSession: () => Promise<void>;
  endArSession: () => Promise<void>;
  placeArAtReticle: () => void;
  resetArPlacement: () => void;
  clearInspectionMarker: () => void;
}

interface FrpViewportProps {
  groupId: GroupId;
  explodeValue: number; // 0..1
  loadRatio: number; // 0..1
  salineMode: boolean;
  cameraPreset: CameraPreset;
  presetNonce: number;
  scaleMode1to1: boolean;
  arActive: boolean;
  arShowFrame: boolean;
  arOverlayRef: RefObject<HTMLDivElement | null>;
  onArSupportChange: (state: ArSupportState) => void;
  onArSessionChange: (active: boolean) => void;
  onArStatusChange: (placed: boolean, message: string) => void;
  crackAnalysisMode: boolean;
  onSurfaceInspect: (report: CrackInspectionReport | null) => void;
  onHoverComponentChange?: (hover: HoverSpecimenPayload | null) => void;
  xrayMode: boolean;
  xrayHeightMm: number;
  xrayCameraNonce: number;
  xrayTopDown: boolean;
}

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [5.9, 2.8, 7.5], target: [0, 0.95, 0] },
  layers: { pos: [4.6, 2.1, 6.0], target: [0, 0.85, 0] },
  overlap: { pos: [3.25, 1.65, 3.35], target: [0.22, 1.12, 0.2] },
  top_platen: { pos: [3.9, 3.85, 4.1], target: [0, 2.15, 0] },
};

const ALL_LAYER_KEYS: LayerKey[] = ['concrete', 'primer', 'epoxy', 'frp1', 'frp2', 'topcoat'];
const SCALE_KEYS: Array<ScaleCalloutAnchor['key']> = ['diameter', 'height', 'overlap'];
const SCALE_LABELS: Record<ScaleCalloutAnchor['key'], string> = {
  diameter: 'D = 150 mm (0.15 m)',
  height: 'H = 300 mm (0.30 m)',
  overlap: 'Nối chồng 150 mm',
};

function detectSoftwareWebGL(): boolean {
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

export const FrpViewport = forwardRef<FrpViewportHandle, FrpViewportProps>(function FrpViewport(
  {
    groupId,
    explodeValue,
    loadRatio,
    salineMode,
    cameraPreset,
    presetNonce,
    scaleMode1to1,
    arActive,
    arShowFrame,
    arOverlayRef,
    onArSupportChange,
    onArSessionChange,
    onArStatusChange,
    crackAnalysisMode,
    onSurfaceInspect,
    onHoverComponentChange,
    xrayMode,
    xrayHeightMm,
    xrayCameraNonce,
    xrayTopDown,
  },
  ref,
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const calloutElsRef = useRef<Record<LayerKey, HTMLDivElement | null>>({
    concrete: null,
    primer: null,
    epoxy: null,
    frp1: null,
    frp2: null,
    topcoat: null,
  });
  const scaleCalloutElsRef = useRef<Record<ScaleCalloutAnchor['key'], HTMLDivElement | null>>({
    diameter: null,
    height: null,
    overlap: null,
  });

  const [webglLost, setWebglLost] = useState(false);
  const [hasHoverTooltip, setHasHoverTooltip] = useState(false);

  // Ref đồng bộ trạng thái React -> vòng lặp WebGL không làm unmount canvas
  const stateRef = useRef({
    groupId,
    explodeTarget: explodeValue,
    loadTarget: loadRatio,
    salineMode,
    scaleMode1to1,
    arActive,
    arShowFrame,
    crackAnalysisMode,
    xrayMode,
    xrayHeightMm,
  });

  stateRef.current = {
    groupId,
    explodeTarget: explodeValue,
    loadTarget: loadRatio,
    salineMode,
    scaleMode1to1,
    arActive,
    arShowFrame,
    crackAnalysisMode,
    xrayMode,
    xrayHeightMm,
  };

  const callbacksRef = useRef({
    onArSupportChange,
    onArSessionChange,
    onArStatusChange,
    onSurfaceInspect,
    onHoverComponentChange,
  });
  callbacksRef.current = {
    onArSupportChange,
    onArSessionChange,
    onArStatusChange,
    onSurfaceInspect,
    onHoverComponentChange,
  };

  const cameraGoalRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESETS.overview.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.overview.target),
  });

  const triggerRenderRef = useRef<(() => void) | null>(null);
  const xrApiRef = useRef<FrpViewportHandle | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      startArSession: async () => {
        if (xrApiRef.current) {
          await xrApiRef.current.startArSession();
        }
      },
      endArSession: async () => {
        if (xrApiRef.current) {
          await xrApiRef.current.endArSession();
        }
      },
      placeArAtReticle: () => {
        xrApiRef.current?.placeArAtReticle();
      },
      resetArPlacement: () => {
        xrApiRef.current?.resetArPlacement();
      },
      clearInspectionMarker: () => {
        xrApiRef.current?.clearInspectionMarker();
      },
    }),
    [],
  );

  // Kiểm tra khả năng WebXR AR trên thiết bị
  useEffect(() => {
    let cancelled = false;
    async function checkXr() {
      if (!window.isSecureContext) {
        if (!cancelled) callbacksRef.current.onArSupportChange('insecure-context');
        return;
      }
      const xrNav = (navigator as Navigator & { xr?: XRSystem }).xr;
      if (!xrNav || typeof xrNav.isSessionSupported !== 'function') {
        if (!cancelled) callbacksRef.current.onArSupportChange('unsupported');
        return;
      }
      try {
        const supported = await xrNav.isSessionSupported('immersive-ar');
        if (!cancelled) {
          callbacksRef.current.onArSupportChange(supported ? 'supported' : 'unsupported');
        }
      } catch {
        if (!cancelled) callbacksRef.current.onArSupportChange('unsupported');
      }
    }
    checkXr();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraPreset];
    cameraGoalRef.current.pos.set(...preset.pos);
    cameraGoalRef.current.target.set(...preset.target);
    cameraGoalRef.current.active = true;
    triggerRenderRef.current?.();
  }, [cameraPreset, presetNonce]);

  useEffect(() => {
    if (!xrayMode) return;
    const info = computeXrayCrossSection(groupId, xrayHeightMm, loadRatio, salineMode);
    const pose = computeXrayCameraPose(info.cutWorldY, xrayTopDown);
    cameraGoalRef.current.pos.set(...pose.pos);
    cameraGoalRef.current.target.set(...pose.target);
    cameraGoalRef.current.active = true;
    triggerRenderRef.current?.();
  }, [xrayMode, xrayCameraNonce, xrayTopDown]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!crackAnalysisMode) {
      xrApiRef.current?.clearInspectionMarker();
    } else {
      setHasHoverTooltip(false);
      callbacksRef.current.onHoverComponentChange?.(null);
    }
    if (arActive) {
      setHasHoverTooltip(false);
      callbacksRef.current.onHoverComponentChange?.(null);
    }
    triggerRenderRef.current?.();
  }, [
    groupId,
    explodeValue,
    loadRatio,
    salineMode,
    scaleMode1to1,
    arActive,
    arShowFrame,
    crackAnalysisMode,
    xrayMode,
    xrayHeightMm,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: isSoftwareGl,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x090d14, 1);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    renderer.xr.enabled = true;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => {
      setWebglLost(false);
      requestRender();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    const defaultBg = new THREE.Color(0x090d14);
    const defaultFog = new THREE.FogExp2(0x090d14, 0.032);
    scene.background = defaultBg;
    scene.fog = defaultFog;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.02, 60);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(...CAMERA_PRESETS.overview.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 2.4;
    controls.maxDistance = 12.5;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.minPolarAngle = 0.18;

    // 3-point warm/cool studio lighting + RectAreaLight (bỏ qua RectAreaLight trên software GL)
    const hemiLight = new THREE.HemisphereLight(0xc2dcff, 0x151c28, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    keyLight.position.set(4.5, 6.8, 5.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 18;
    const d = 4.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.9);
    rimLight.position.set(-4.8, 3.8, -4.5);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xe0f2fe, 2.2, 4.0, 4.0);
      softbox.position.set(-3.8, 3.2, 2.5);
      softbox.lookAt(0, 1.5, 0);
      scene.add(softbox);
    }

    // Sàn phòng thí nghiệm cơ học vật liệu
    const floorGeo = new THREE.CircleGeometry(22, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0d131d,
      roughness: 0.88,
      metalness: 0.12,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.71;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const gridHelper = new THREE.GridHelper(18, 24, 0x263549, 0x162030);
    gridHelper.position.y = -0.7;
    scene.add(gridHelper);

    // Kết cấu vật liệu thủ tục & mô hình mẫu trụ
    const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());
    const rig = createSpecimenRig(textures, isSoftwareGl);
    scene.add(rig.root);

    // Nhóm neo đặt mẫu AR ở tỷ lệ 1:1 (D = 0.15 m, H = 0.30 m) & vòng định tâm Reticle
    const arAnchorGroup = new THREE.Group();
    arAnchorGroup.visible = false;
    scene.add(arAnchorGroup);

    const reticleGroup = new THREE.Group();
    reticleGroup.matrixAutoUpdate = false;
    reticleGroup.visible = false;
    scene.add(reticleGroup);

    const reticleRingGeo = new THREE.RingGeometry(0.075, 0.092, 40).rotateX(-Math.PI / 2);
    const reticleRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    const reticleRing = new THREE.Mesh(reticleRingGeo, reticleRingMat);

    const reticleDotGeo = new THREE.CircleGeometry(0.014, 20).rotateX(-Math.PI / 2);
    const reticleDotMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
    });
    const reticleDot = new THREE.Mesh(reticleDotGeo, reticleDotMat);
    reticleGroup.add(reticleRing, reticleDot);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Biến nội suy mượt mà
    let smoothExplode = stateRef.current.explodeTarget;
    let smoothLoad = stateRef.current.loadTarget;
    let prevTime = performance.now();
    let elapsed = 0;

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

    // Trạng thái phiên WebXR AR
    let activeXrSession: XRSession | null = null;
    let hitTestSource: XRHitTestSource | null = null;
    let arPlacedOnce = false;

    const _projVec = new THREE.Vector3();
    const _hitPos = new THREE.Vector3();
    const _hitQuat = new THREE.Quaternion();
    const _hitScale = new THREE.Vector3();

    const cancelCameraPreset = () => {
      cameraGoalRef.current.active = false;
    };
    controls.addEventListener('start', cancelCameraPreset);

    const onControlChange = () => {
      requestRender();
    };
    controls.addEventListener('change', onControlChange);

    let pendingResize: { w: number; h: number } | null = null;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      let polls = 0;
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        polls += 1;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED && polls < 16) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateCallouts(curGroupId: GroupId, curExplode: number, curScaleMode: boolean) {
      const anchors = rig.getCalloutAnchors(curGroupId, curExplode);
      const anchorMap = new Map(anchors.map((a) => [a.key, a]));
      const w = container!.clientWidth || window.innerWidth;
      const h = container!.clientHeight || window.innerHeight;
      const showLayerLabels = curExplode > 0.14 && !renderer.xr.isPresenting;

      ALL_LAYER_KEYS.forEach((key) => {
        const el = calloutElsRef.current[key];
        if (!el) return;
        const anchor = anchorMap.get(key);
        if (!showLayerLabels || !anchor) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }

        _projVec.copy(anchor.worldPos).project(camera);
        const inFront = _projVec.z >= -1 && _projVec.z <= 1;
        if (!inFront) {
          el.style.opacity = '0';
          return;
        }

        const sx = (_projVec.x * 0.5 + 0.5) * w;
        const sy = (-_projVec.y * 0.5 + 0.5) * h;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = Math.min(1, (curExplode - 0.14) / 0.2).toFixed(2);
      });

      const showScaleLabels = curScaleMode && !renderer.xr.isPresenting;
      const scaleAnchors = showScaleLabels ? rig.getScaleCalloutAnchors() : [];
      const scaleMap = new Map(scaleAnchors.map((a) => [a.key, a]));

      SCALE_KEYS.forEach((key) => {
        const el = scaleCalloutElsRef.current[key];
        if (!el) return;
        const anchor = scaleMap.get(key);
        if (!showScaleLabels || !anchor) {
          el.style.opacity = '0';
          return;
        }
        _projVec.copy(anchor.worldPos).project(camera);
        if (_projVec.z < -1 || _projVec.z > 1) {
          el.style.opacity = '0';
          return;
        }
        const sx = (_projVec.x * 0.5 + 0.5) * w;
        const sy = (-_projVec.y * 0.5 + 0.5) * h;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = '1';
      });
    }

    function updateRigStep(dt: number) {
      const s = stateRef.current;
      const dampK = isSoftwareGl ? 18 : 9;

      smoothExplode = THREE.MathUtils.damp(smoothExplode, s.explodeTarget, dampK, dt);
      smoothLoad = THREE.MathUtils.damp(smoothLoad, s.loadTarget, dampK, dt);

      if (Math.abs(smoothExplode - s.explodeTarget) < 0.001) smoothExplode = s.explodeTarget;
      if (Math.abs(smoothLoad - s.loadTarget) < 0.001) smoothLoad = s.loadTarget;

      const physState = computeStressStrainPoint(s.groupId, smoothLoad, s.salineMode);
      const needsContinuousAnim =
        s.salineMode ||
        (physState.isPassiveConfinementActive && !physState.isRuptured && smoothExplode < 0.2);

      if (needsContinuousAnim) {
        elapsed += dt;
      }

      const inXr = renderer.xr.isPresenting;
      controls.minDistance = s.crackAnalysisMode || s.xrayMode ? 1.05 : 2.4;
      controls.minPolarAngle = s.xrayMode ? 0.04 : 0.18;
      rig.updateState({
        groupId: s.groupId,
        explodeValue: smoothExplode,
        loadRatio: smoothLoad,
        bulgeNorm: physState.lateralBulgeNorm,
        isPassiveConfinement: physState.isPassiveConfinementActive,
        isRuptured: physState.isRuptured,
        salineMode: s.salineMode,
        elapsed,
        scaleGuideVisible: s.scaleMode1to1 || inXr,
        hideTallFrame: inXr && !s.arShowFrame,
        xrayMode: s.xrayMode,
        xrayHeightMm: s.xrayHeightMm,
      });

      return { s, needsContinuousAnim };
    }

    function stepAndRender() {
      if (renderer.xr.isPresenting) return false;

      if (pendingResize) {
        camera.aspect = pendingResize.w / pendingResize.h;
        camera.updateProjectionMatrix();
        renderer.setSize(pendingResize.w, pendingResize.h);
        pendingResize = null;
      }

      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      let cameraMoving = false;
      if (cameraGoalRef.current.active) {
        const alpha = 1 - Math.exp(-7 * dt);
        camera.position.lerp(cameraGoalRef.current.pos, alpha);
        controls.target.lerp(cameraGoalRef.current.target, alpha);
        if (
          camera.position.distanceTo(cameraGoalRef.current.pos) < 0.015 &&
          controls.target.distanceTo(cameraGoalRef.current.target) < 0.015
        ) {
          camera.position.copy(cameraGoalRef.current.pos);
          controls.target.copy(cameraGoalRef.current.target);
          cameraGoalRef.current.active = false;
        } else {
          cameraMoving = true;
        }
      }

      controls.update();

      const { s, needsContinuousAnim } = updateRigStep(dt);

      renderer.render(scene, camera);
      container!.dataset.frames = String(Number(container!.dataset.frames || '0') + 1);
      container!.dataset.tris = String(renderer.info.render.triangles);
      updateCallouts(s.groupId, smoothExplode, s.scaleMode1to1);

      const stillTransitioning =
        cameraMoving ||
        Math.abs(smoothExplode - s.explodeTarget) > 0.001 ||
        Math.abs(smoothLoad - s.loadTarget) > 0.001 ||
        needsContinuousAnim;

      return stillTransitioning;
    }

    function requestRender() {
      if (disposed || renderer.xr.isPresenting) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed || renderer.xr.isPresenting) {
          renderBusy = false;
          return;
        }
        renderDirty = false;
        const keepGoing = stepAndRender();
        const done = () => {
          renderBusy = false;
          if (!disposed && !renderer.xr.isPresenting && (renderDirty || keepGoing)) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function placeAnchorAtReticle() {
      if (!reticleGroup.visible) {
        callbacksRef.current.onArStatusChange(
          arPlacedOnce,
          'Chưa tìm thấy mặt phẳng — di chuyển camera chậm về phía mặt bàn hoặc sàn.',
        );
        return;
      }
      reticleGroup.matrix.decompose(_hitPos, _hitQuat, _hitScale);
      arAnchorGroup.position.copy(_hitPos);
      arAnchorGroup.quaternion.copy(_hitQuat);
      arAnchorGroup.visible = true;
      arPlacedOnce = true;
      callbacksRef.current.onArStatusChange(
        true,
        'Đã đặt mẫu trụ tỷ lệ 1:1 (D = 150 mm × H = 300 mm). Chạm màn hình để dời vị trí.',
      );
    }

    function resetArPlacement() {
      arAnchorGroup.visible = false;
      arPlacedOnce = false;
      callbacksRef.current.onArStatusChange(
        false,
        'Hướng camera xuống mặt bàn hoặc sàn phẳng để quét vị trí đặt mẫu 1:1.',
      );
    }

    async function startArSession() {
      if (activeXrSession) return;
      const xrNav = (navigator as Navigator & { xr?: XRSystem }).xr;
      if (!xrNav) {
        callbacksRef.current.onArSupportChange('unsupported');
        return;
      }

      const overlayRoot = arOverlayRef.current;
      const sessionInit: XRSessionInit = {
        requiredFeatures: ['hit-test'],
        optionalFeatures: overlayRoot ? ['dom-overlay', 'local-floor'] : ['local-floor'],
        ...(overlayRoot ? { domOverlay: { root: overlayRoot } } : {}),
      };

      const session = await xrNav.requestSession('immersive-ar', sessionInit);
      activeXrSession = session;
      arPlacedOnce = false;

      // Chuyển mô hình sang nhóm neo AR với tỷ lệ vật lý 1:1 (0.1 m/unit)
      arAnchorGroup.add(rig.root);
      rig.root.scale.setScalar(AR_PHYSICAL_SCALE);
      rig.root.position.set(0, AR_BASE_PEDESTAL_OFFSET_M, 0);
      rig.root.rotation.set(0, 0, 0);
      arAnchorGroup.visible = false;

      scene.background = null;
      scene.fog = null;
      renderer.setClearAlpha(0);
      floorMesh.visible = false;
      gridHelper.visible = false;
      controls.enabled = false;
      reticleGroup.visible = false;

      const onSelect = () => {
        placeAnchorAtReticle();
      };
      session.addEventListener('select', onSelect);

      const onSessionEnd = () => {
        session.removeEventListener('select', onSelect);
        session.removeEventListener('end', onSessionEnd);
        if (hitTestSource) {
          hitTestSource.cancel();
          hitTestSource = null;
        }
        activeXrSession = null;
        renderer.setAnimationLoop(null);

        // Khôi phục mô hình về chế độ 3D tiêu chuẩn
        scene.add(rig.root);
        rig.root.scale.set(1, 1, 1);
        rig.root.position.set(0, 0, 0);
        rig.root.rotation.set(0, 0, 0);
        arAnchorGroup.visible = false;
        reticleGroup.visible = false;

        scene.background = defaultBg;
        scene.fog = defaultFog;
        renderer.setClearColor(0x090d14, 1);
        floorMesh.visible = true;
        gridHelper.visible = true;
        controls.enabled = true;

        callbacksRef.current.onArSessionChange(false);
        requestRender();
      };
      session.addEventListener('end', onSessionEnd);

      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);

      try {
        const viewerSpace = await session.requestReferenceSpace('viewer');
        if (session.requestHitTestSource) {
          hitTestSource = (await session.requestHitTestSource({ space: viewerSpace })) ?? null;
        }
      } catch {
        hitTestSource = null;
      }

      callbacksRef.current.onArSessionChange(true);
      callbacksRef.current.onArStatusChange(
        false,
        'Đang quét mặt phẳng... Hướng camera xuống mặt bàn rồi chạm để đặt mẫu 1:1.',
      );

      prevTime = performance.now();
      renderer.setAnimationLoop((_timestamp, frame?: XRFrame) => {
        const now = performance.now();
        const dt = Math.min(0.1, Math.max(0.001, (now - prevTime) / 1000));
        prevTime = now;

        const refSpace = renderer.xr.getReferenceSpace();
        if (frame && hitTestSource && refSpace) {
          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const pose = hitTestResults[0].getPose(refSpace);
            if (pose) {
              reticleGroup.visible = true;
              reticleGroup.matrix.fromArray(pose.transform.matrix);
            }
          } else {
            reticleGroup.visible = false;
          }
        }

        updateRigStep(dt);
        renderer.render(scene, camera);
      });
    }

    async function endArSession() {
      if (activeXrSession) {
        await activeXrSession.end();
      }
    }

    xrApiRef.current = {
      startArSession,
      endArSession,
      placeArAtReticle: placeAnchorAtReticle,
      resetArPlacement,
      clearInspectionMarker: () => {
        rig.setInspectionMarker(null);
        requestRender();
      },
    };

    // Raycasting tương tác bề mặt khi bật chế độ 'Phân tích vết nứt chi tiết'
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const _normalMatrix = new THREE.Matrix3();
    const _worldNormal = new THREE.Vector3();
    const _radialOut = new THREE.Vector3();
    let downX = 0;
    let downY = 0;
    let isPointerDown = false;
    let wasHoveringTooltip = false;
    let lastHoverTs = 0;

    function isHierarchyVisible(obj: THREE.Object3D): boolean {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (!cur.visible) return false;
        cur = cur.parent;
      }
      return true;
    }

    function clearTooltipHover() {
      if (wasHoveringTooltip) {
        wasHoveringTooltip = false;
        setHasHoverTooltip(false);
        callbacksRef.current.onHoverComponentChange?.(null);
      }
    }

    function pickSpecimenSurface(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const visibleTargets = rig.inspectableTargets.filter(isHierarchyVisible);
      const hits = raycaster.intersectObjects(visibleTargets, false);
      return hits.length > 0 ? hits[0] : null;
    }

    function pickHoverComponent(clientX: number, clientY: number) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const visibleTargets = rig.hoverableTargets.filter(isHierarchyVisible);
      const hits = raycaster.intersectObjects(visibleTargets, false);
      if (hits.length === 0) return null;

      const candidates: HoverHitCandidate[] = [];
      for (const h of hits) {
        const key = h.object.userData?.componentKey as ComponentKey | undefined;
        if (!key) continue;
        candidates.push({
          componentKey: key,
          isOverlapZone: Boolean(h.object.userData?.isOverlapZone),
          distance: h.distance,
        });
      }
      return selectHoveredComponent(candidates, smoothExplode, stateRef.current.groupId);
    }

    const onPointerMove = (e: PointerEvent) => {
      if (renderer.xr.isPresenting) {
        clearTooltipHover();
        if (canvas.style.cursor !== '') canvas.style.cursor = '';
        return;
      }

      if (isPointerDown) {
        clearTooltipHover();
        return;
      }

      const now = performance.now();
      if (now - lastHoverTs < 36) return;
      lastHoverTs = now;

      if (stateRef.current.crackAnalysisMode) {
        clearTooltipHover();
        const hit = pickSpecimenSurface(e.clientX, e.clientY);
        canvas.style.cursor = hit ? 'crosshair' : 'grab';
        return;
      }

      const picked = pickHoverComponent(e.clientX, e.clientY);
      if (picked) {
        if (!wasHoveringTooltip) setHasHoverTooltip(true);
        wasHoveringTooltip = true;
        canvas.style.cursor = 'pointer';
        callbacksRef.current.onHoverComponentChange?.({
          componentKey: picked.componentKey,
          isOverlapZone: picked.isOverlapZone,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      } else {
        clearTooltipHover();
        canvas.style.cursor = 'grab';
      }
    };

    const onPointerLeave = () => {
      clearTooltipHover();
      if (canvas.style.cursor !== '') canvas.style.cursor = '';
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      isPointerDown = true;
      clearTooltipHover();
    };

    const onPointerUp = (e: PointerEvent) => {
      isPointerDown = false;
      const s = stateRef.current;
      if (!s.crackAnalysisMode || renderer.xr.isPresenting) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;

      const hit = pickSpecimenSurface(e.clientX, e.clientY);
      if (!hit) return;

      _radialOut.set(hit.point.x, 0, hit.point.z);
      if (_radialOut.lengthSq() > 0.0001) _radialOut.normalize();
      else _radialOut.set(0, 0, 1);

      if (hit.face) {
        _normalMatrix.getNormalMatrix(hit.object.matrixWorld);
        _worldNormal.copy(hit.face.normal).applyMatrix3(_normalMatrix).normalize();
        if (_worldNormal.dot(_radialOut) < 0) {
          _worldNormal.negate();
        }
      } else {
        _worldNormal.copy(_radialOut);
      }

      rig.setInspectionMarker(hit.point, _worldNormal);
      const pose = computeCrackCameraPose(hit.point, _worldNormal, 1.85);
      cameraGoalRef.current.pos.set(pose.pos.x, pose.pos.y, pose.pos.z);
      cameraGoalRef.current.target.set(pose.target.x, pose.target.y, pose.target.z);
      cameraGoalRef.current.active = true;

      const report = computeCrackInspectionReport({
        groupId: s.groupId,
        loadRatio: s.loadTarget,
        salineMode: s.salineMode,
        hitPoint: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      });
      callbacksRef.current.onSurfaceInspect(report);
      requestRender();
    };

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    triggerRenderRef.current = requestRender;
    requestRender();

    const onResize = () => {
      if (!container || disposed || renderer.xr.isPresenting) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      pendingResize = { w, h };
      requestRender();
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      xrApiRef.current = null;
      triggerRenderRef.current = null;
      renderer.setAnimationLoop(null);
      if (activeXrSession) {
        activeXrSession.end().catch(() => {});
      }
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      controls.removeEventListener('start', cancelCameraPreset);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      reticleRingGeo.dispose();
      reticleRingMat.dispose();
      reticleDotGeo.dispose();
      reticleDotMat.dispose();
      rig.dispose();
      textures.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      envTex.dispose();
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, [arOverlayRef]);

  const currentLayers = computeExplodedLayerOffsets(groupId, explodeValue);
  const layerMetaMap = new Map(currentLayers.map((l) => [l.key, l]));

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#090d14]"
      data-testid="frp-viewport"
      data-group={groupId}
      data-explode={Math.round(explodeValue * 100)}
      data-load={Math.round(loadRatio * 100)}
      data-saline={salineMode ? 'on' : 'off'}
      data-scale-1to1={scaleMode1to1 ? 'on' : 'off'}
      data-ar-active={arActive ? 'on' : 'off'}
      data-crack-mode={crackAnalysisMode ? 'on' : 'off'}
      data-xray-mode={xrayMode ? 'on' : 'off'}
      data-xray-height={Math.round(xrayHeightMm)}
    >
      {/* Dedicated stable WebGL mount container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* 3D Projected Callout Labels (cập nhật trực tiếp qua DOM refs, không gây re-render React) */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden z-10 transition-opacity duration-150 ${
          hasHoverTooltip ? 'opacity-15' : 'opacity-100'
        }`}
      >
        {ALL_LAYER_KEYS.map((key) => {
          const meta = layerMetaMap.get(key);
          return (
            <div
              key={key}
              ref={(el) => {
                calloutElsRef.current[key] = el;
              }}
              style={{ opacity: 0 }}
              className="absolute top-0 left-0 will-change-transform transition-opacity duration-150"
            >
              {meta && (
                <div className="bg-[#0b1019]/92 border border-slate-700/80 rounded-md px-2.5 py-1.5 shadow-lg max-w-[210px]">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-xs shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-[11px] font-semibold text-slate-100 whitespace-nowrap">
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                    {meta.specText}
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {/* Nhãn kích thước thực tế 1:1 (chỉ hiện khi bật Chế độ thước chuẩn 1:1) */}
        {SCALE_KEYS.map((key) => (
          <div
            key={key}
            ref={(el) => {
              scaleCalloutElsRef.current[key] = el;
            }}
            style={{ opacity: 0 }}
            className="absolute top-0 left-0 will-change-transform transition-opacity duration-150"
          >
            <div
              className={`border rounded-md px-2 py-1 shadow-lg font-mono text-[11px] font-semibold whitespace-nowrap ${
                key === 'overlap'
                  ? 'bg-[#1a1406]/95 border-amber-400/70 text-amber-300'
                  : 'bg-[#081320]/95 border-sky-400/70 text-sky-300'
              }`}
            >
              {SCALE_LABELS[key]}
            </div>
          </div>
        ))}
      </div>

      {webglLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090d14]/95">
          <div className="border border-slate-700 bg-slate-900 rounded-lg px-6 py-4 text-center max-w-sm">
            <p className="text-sm font-semibold text-slate-100">
              Ngữ cảnh đồ họa WebGL tạm gián đoạn
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Đang khôi phục mô hình 3D... Vui lòng tải lại trang nếu màn hình không tự cập nhật.
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

