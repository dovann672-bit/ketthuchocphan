import * as THREE from 'three';
import type { GroupId, LayerKey } from '../utils/frpData';
import { SPECIMEN_GROUPS, computeExplodedLayerOffsets } from '../utils/frpData';
import type { ComponentKey } from '../utils/specimenTooltip';
import { computeXrayCrossSection } from '../utils/xraySection';
import type { ProceduralTextureSet } from './proceduralTextures';

export interface LayerCalloutAnchor {
  key: LayerKey;
  label: string;
  specText: string;
  color: string;
  worldPos: THREE.Vector3;
}

export interface ScaleCalloutAnchor {
  key: 'diameter' | 'height' | 'overlap';
  label: string;
  worldPos: THREE.Vector3;
}

export interface SpecimenRig {
  root: THREE.Group;
  inspectableTargets: THREE.Object3D[];
  hoverableTargets: THREE.Object3D[];
  updateState: (params: {
    groupId: GroupId;
    explodeValue: number;
    loadRatio: number;
    bulgeNorm: number;
    isPassiveConfinement: boolean;
    isRuptured: boolean;
    salineMode: boolean;
    elapsed: number;
    scaleGuideVisible?: boolean;
    hideTallFrame?: boolean;
    xrayMode?: boolean;
    xrayHeightMm?: number;
  }) => void;
  setInspectionMarker: (worldPos: THREE.Vector3 | null, worldNormal?: THREE.Vector3) => void;
  getCalloutAnchors: (groupId: GroupId, explodeValue: number) => LayerCalloutAnchor[];
  getScaleCalloutAnchors: () => ScaleCalloutAnchor[];
  dispose: () => void;
}

// 1 unit = 100 mm => D = 150 mm (R = 0.75), H = 300 mm (3.00), Overlap = 150 mm (2.0 rad)
const CORE_RADIUS = 0.75;
const CORE_HEIGHT = 3.0;
const OVERLAP_ARC = 2.0; // 150mm / 75mm = 2.0 rad (~114.6 deg)

interface DeformableCylinder {
  geometry: THREE.CylinderGeometry;
  basePositions: Float32Array;
  baseRadius: number;
}

function createDeformableCylinder(
  radius: number,
  height: number,
  radialSegments: number,
  heightSegments: number,
  openEnded: boolean,
  thetaStart = 0,
  thetaLength = Math.PI * 2,
): DeformableCylinder {
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    radialSegments,
    heightSegments,
    openEnded,
    thetaStart,
    thetaLength,
  );
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const basePositions = new Float32Array(posAttr.array);
  return { geometry, basePositions, baseRadius: radius };
}

function applyBarrelDeformation(
  dc: DeformableCylinder,
  axialSquash: number,
  bulgeAmount: number,
  ruptureTearGap: number,
) {
  const posAttr = dc.geometry.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const base = dc.basePositions;
  const halfH = CORE_HEIGHT / 2;

  for (let i = 0; i < posAttr.count; i++) {
    const ix = i * 3;
    const bx = base[ix];
    const by = base[ix + 1];
    const bz = base[ix + 2];

    // y trong khoảng [-1.5, +1.5], chuẩn hóa [0..1] từ đáy lên đỉnh
    const yNorm = (by + halfH) / CORE_HEIGHT;
    const barrelProfile = Math.sin(Math.PI * Math.max(0, Math.min(1, yNorm)));
    const radialScale = 1 + bulgeAmount * barrelProfile;

    let x = bx * radialScale;
    let y = by * (1 - axialSquash);
    let z = bz * radialScale;

    // Hiệu ứng nứt vỡ ngang khi đứt sợi FRP ở tải 100%
    if (ruptureTearGap > 0) {
      const distFromMid = Math.abs(by);
      if (distFromMid < 0.35) {
        const tearFactor = (1 - distFromMid / 0.35) * ruptureTearGap;
        const r = Math.hypot(bx, bz);
        if (r > 0.1) {
          const angle = Math.atan2(bz, bx);
          const jagged = Math.sin(angle * 7) * 0.04 * tearFactor;
          x += (bx / r) * (0.09 * tearFactor + jagged);
          z += (bz / r) * (0.09 * tearFactor + jagged);
          y += (by >= 0 ? 1 : -1) * 0.06 * tearFactor;
        }
      }
    }

    arr[ix] = x;
    arr[ix + 1] = y;
    arr[ix + 2] = z;
  }
  posAttr.needsUpdate = true;
}

/**
 * Tạo mũi tên lực 3D dạng khối (thân trụ + đầu nón) để hiện rõ lực nén và bó hông
 */
function createVectorArrow(color: number, emissive: number, shaftLen = 0.42, radius = 0.032): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.75,
    roughness: 0.3,
    metalness: 0.15,
  });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, shaftLen, 12),
    mat,
  );
  shaft.position.y = shaftLen / 2;
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 1.45, radius * 3.8, 14),
    mat,
  );
  head.position.y = shaftLen + radius * 1.9;
  g.add(shaft, head);
  return g;
}

export function createSpecimenRig(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): SpecimenRig {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Mặt phẳng cắt ngang cho chế độ X-Ray Cross-Section (giữ phần bên dưới cutWorldY)
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 50);
  const upperGhostPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
  const specimenClipList = [cutPlane];

  // --- 1. BỆ MÁY NÉN THỦY LỰC & KHUNG THÍ NGHIỆM 2.000 kN ---
  const rigFrameGroup = new THREE.Group();
  root.add(rigFrameGroup);

  const darkCastIronMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e2530,
      roughness: 0.72,
      metalness: 0.48,
    }),
  );
  const machinedSteelMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.steelMap,
      roughness: 0.24,
      metalness: 0.88,
    }),
  );
  const platenFaceMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.platenTopMap,
      roughness: 0.28,
      metalness: 0.86,
    }),
  );
  const chromeRodMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdbe4ef,
      roughness: 0.14,
      metalness: 0.94,
    }),
  );
  const brassAccentMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd99b26,
      roughness: 0.3,
      metalness: 0.85,
    }),
  );

  // Đế máy & Bóng tiếp xúc sàn
  const contactShadowMesh = new THREE.Mesh(
    track(new THREE.PlaneGeometry(6.8, 6.8)),
    track(
      new THREE.MeshBasicMaterial({
        map: textures.contactShadowMap,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    ),
  );
  contactShadowMesh.rotation.x = -Math.PI / 2;
  contactShadowMesh.position.y = -0.68;
  rigFrameGroup.add(contactShadowMesh);

  // Mâm nén dưới (composite 6 chi tiết)
  const bottomPlatenGroup = new THREE.Group();
  rigFrameGroup.add(bottomPlatenGroup);

  const lowerPedestal = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.75, 1.92, 0.32, 32)),
    darkCastIronMat,
  );
  lowerPedestal.position.y = -0.54;
  lowerPedestal.receiveShadow = true;

  const lowerSeatingRing = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.22, 1.32, 0.18, 32)),
    machinedSteelMat,
  );
  lowerSeatingRing.position.y = -0.29;
  lowerSeatingRing.receiveShadow = true;

  const lowerPlatenDisc = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.1, 1.14, 0.2, 40)),
    [machinedSteelMat, platenFaceMat, machinedSteelMat],
  );
  lowerPlatenDisc.position.y = -0.1; // Mặt trên tại y = 0.00
  lowerPlatenDisc.receiveShadow = true;
  lowerPlatenDisc.castShadow = true;

  bottomPlatenGroup.add(lowerPedestal, lowerSeatingRing, lowerPlatenDisc);

  // 4 bu lông neo quanh bệ dưới
  const boltGeo = track(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6));
  for (let b = 0; b < 4; b++) {
    const ang = (b * Math.PI) / 2 + Math.PI / 4;
    const bolt = new THREE.Mesh(boltGeo, brassAccentMat);
    bolt.position.set(Math.cos(ang) * 1.48, -0.34, Math.sin(ang) * 1.48);
    bottomPlatenGroup.add(bolt);
  }

  // Hai cột dẫn hướng máy nén 2.000 kN phía sau hai bên (có thể ẩn khi xem AR để tập trung mẫu 1:1 trên bàn)
  const tallFrameGroup = new THREE.Group();
  rigFrameGroup.add(tallFrameGroup);

  const colGeo = track(new THREE.CylinderGeometry(0.1, 0.1, 5.6, 16));
  const collarGeo = track(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16));
  [-2.55, 2.55].forEach((xPos) => {
    const col = new THREE.Mesh(colGeo, chromeRodMat);
    col.position.set(xPos, 2.1, -0.95);
    col.castShadow = true;
    const baseCollar = new THREE.Mesh(collarGeo, darkCastIronMat);
    baseCollar.position.set(xPos, -0.45, -0.95);
    const topCollar = new THREE.Mesh(collarGeo, darkCastIronMat);
    topCollar.position.set(xPos, 4.75, -0.95);
    tallFrameGroup.add(col, baseCollar, topCollar);
  });

  // Dầm ngang trên máy nén
  const crossheadBeam = new THREE.Mesh(
    track(new THREE.BoxGeometry(5.6, 0.34, 0.62)),
    darkCastIronMat,
  );
  crossheadBeam.position.set(0, 4.92, -0.95);
  tallFrameGroup.add(crossheadBeam);

  // Mâm nén trên (composite 6 chi tiết di chuyển theo tải nén)
  const topPlatenGroup = new THREE.Group();
  topPlatenGroup.position.y = CORE_HEIGHT; // Mặt dưới tại y = 3.00 khi tải = 0
  rigFrameGroup.add(topPlatenGroup);

  const upperPlatenDisc = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.14, 1.1, 0.2, 40)),
    [machinedSteelMat, machinedSteelMat, platenFaceMat],
  );
  upperPlatenDisc.position.y = 0.1;
  upperPlatenDisc.castShadow = true;
  upperPlatenDisc.receiveShadow = true;

  const sphericalSeat = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.55, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5)),
    machinedSteelMat,
  );
  sphericalSeat.position.y = 0.2;
  sphericalSeat.castShadow = true;

  const loadCellRing = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.68, 0.72, 0.24, 28)),
    brassAccentMat,
  );
  loadCellRing.position.y = 0.58;

  const hydraulicPiston = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.42, 0.42, 1.25, 24)),
    chromeRodMat,
  );
  hydraulicPiston.position.y = 1.3;
  hydraulicPiston.castShadow = true;

  const upperFlange = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.86, 0.86, 0.14, 28)),
    darkCastIronMat,
  );
  upperFlange.position.y = 0.82;

  topPlatenGroup.add(
    upperPlatenDisc,
    sphericalSeat,
    loadCellRing,
    upperFlange,
    hydraulicPiston,
  );

  // --- 2. MẪU TRỤ BÊ TÔNG B25 & CÁC LỚP VẬT LIỆU BÓC TÁCH ---
  const specimenGroup = new THREE.Group();
  specimenGroup.position.y = CORE_HEIGHT / 2; // Tâm tại y = 1.50 (đáy y = 0, đỉnh y = 3.00)
  root.add(specimenGroup);

  // Lõi bê tông B25 (D = 150 mm, H = 300 mm)
  const coreDeform = createDeformableCylinder(CORE_RADIUS, CORE_HEIGHT, 32, 14, false);
  track(coreDeform.geometry);
  const concreteMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.concreteMap,
      bumpMap: textures.concreteBump,
      bumpScale: 0.028,
      roughness: 0.92,
      metalness: 0.02,
      clippingPlanes: specimenClipList,
      clipShadows: true,
    }),
  );
  const coreMesh = new THREE.Mesh(coreDeform.geometry, concreteMat);
  coreMesh.castShadow = true;
  coreMesh.receiveShadow = true;
  specimenGroup.add(coreMesh);

  // Mạng nhánh vi nứt phân nhánh cho M0 khi tải >= 68%
  const m0MicroCrackGroup = new THREE.Group();
  m0MicroCrackGroup.visible = false;
  const microLineVerts: number[] = [];
  for (let i = 0; i < 14; i++) {
    const baseAng = (i / 14) * Math.PI * 2;
    const baseY = ((i % 5) - 2) * 0.42;
    const r = CORE_RADIUS + 0.015;
    const x1 = Math.cos(baseAng) * r;
    const z1 = Math.sin(baseAng) * r;
    const ang2 = baseAng + (i % 2 === 0 ? 0.24 : -0.22);
    const x2 = Math.cos(ang2) * (r + 0.01);
    const z2 = Math.sin(ang2) * (r + 0.01);
    const y2 = baseY + (i % 2 === 0 ? 0.28 : -0.26);
    microLineVerts.push(x1, baseY, z1, x2, y2, z2);
    // Nhánh rẽ phụ
    const ang3 = ang2 + (i % 2 === 0 ? -0.12 : 0.14);
    microLineVerts.push(x2, y2, z2, Math.cos(ang3) * (r + 0.008), Math.sin(ang3) * (r + 0.008), y2 + 0.14);
  }
  const microCrackGeo = track(new THREE.BufferGeometry());
  microCrackGeo.setAttribute('position', new THREE.Float32BufferAttribute(microLineVerts, 3));
  const microCrackMat = track(
    new THREE.LineBasicMaterial({
      color: 0x1c1414,
      transparent: true,
      opacity: 0.85,
      clippingPlanes: specimenClipList,
    }),
  );
  m0MicroCrackGroup.add(new THREE.LineSegments(microCrackGeo, microCrackMat));
  specimenGroup.add(m0MicroCrackGroup);

  // Vết nứt cắt chéo 45° cho mẫu M0 ở tải 100% (nổi rõ ngoài bề mặt phình ngang)
  const m0ShearCrackGroup = new THREE.Group();
  m0ShearCrackGroup.visible = false;
  const crackMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x120b0b,
      side: THREE.DoubleSide,
      clippingPlanes: specimenClipList,
    }),
  );
  const crackGlowMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      clippingPlanes: specimenClipList,
    }),
  );
  const crackRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(CORE_RADIUS + 0.052, 0.024, 6, 36)),
    crackMat,
  );
  crackRing.rotation.x = Math.PI / 2 + 0.74; // ~42-45 deg diagonal shear crack
  crackRing.rotation.z = 0.18;
  const crackRingHighlight = new THREE.Mesh(
    track(new THREE.TorusGeometry(CORE_RADIUS + 0.048, 0.011, 6, 36)),
    crackGlowMat,
  );
  crackRingHighlight.rotation.copy(crackRing.rotation);

  const crackRing2 = new THREE.Mesh(
    track(new THREE.TorusGeometry(CORE_RADIUS + 0.05, 0.02, 6, 36)),
    crackMat,
  );
  crackRing2.rotation.x = Math.PI / 2 - 0.68;
  crackRing2.rotation.z = -0.22;
  crackRing2.position.y = -0.18;

  // Các mảnh vỡ bê tông tách khỏi thân trụ M0
  const spallGeo = track(new THREE.DodecahedronGeometry(0.065, 0));
  const spallMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x8f9499,
      roughness: 0.92,
      clippingPlanes: specimenClipList,
    }),
  );
  [
    [0.82, 0.12, 0.32],
    [-0.78, -0.22, 0.36],
    [0.35, -0.35, 0.78],
    [-0.28, 0.42, 0.76],
  ].forEach(([sx, sy, sz]) => {
    const chip = new THREE.Mesh(spallGeo, spallMat);
    chip.position.set(sx, sy, sz);
    chip.scale.set(1.1, 0.65, 0.85);
    m0ShearCrackGroup.add(chip);
  });

  m0ShearCrackGroup.add(crackRing, crackRingHighlight, crackRing2);
  specimenGroup.add(m0ShearCrackGroup);

  // Các lớp vật liệu đồng tâm chia thành 2 nửa (trái / phải) để bóc tách mượt mà không xuyên nhau
  // và có đoạn nối chồng 150 mm (2.0 rad) ở mặt trước-phải
  interface ShellPair {
    group: THREE.Group;
    leftMesh: THREE.Mesh;
    rightMesh: THREE.Mesh;
    leftDeform: DeformableCylinder;
    rightDeform: DeformableCylinder;
    overlapMesh?: THREE.Mesh;
    overlapDeform?: DeformableCylinder;
    seamLine?: THREE.Line;
  }

  function buildSplitShell(
    radius: number,
    material: THREE.Material,
    hasOverlap = false,
    overlapRadiusOffset = 0.014,
  ): ShellPair {
    const group = new THREE.Group();
    // Nửa phải: góc [0 .. PI], Nửa trái: góc [PI .. 2*PI]
    const rightDeform = createDeformableCylinder(
      radius,
      CORE_HEIGHT,
      20,
      12,
      true,
      0,
      Math.PI,
    );
    const leftDeform = createDeformableCylinder(
      radius,
      CORE_HEIGHT,
      20,
      12,
      true,
      Math.PI,
      Math.PI,
    );
    track(rightDeform.geometry);
    track(leftDeform.geometry);

    const rightMesh = new THREE.Mesh(rightDeform.geometry, material);
    const leftMesh = new THREE.Mesh(leftDeform.geometry, material);
    rightMesh.castShadow = true;
    leftMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    leftMesh.receiveShadow = true;

    group.add(rightMesh, leftMesh);

    let overlapMesh: THREE.Mesh | undefined;
    let overlapDeform: DeformableCylinder | undefined;
    let seamLine: THREE.Line | undefined;

    if (hasOverlap) {
      // Đoạn nối chồng 150 mm (2.0 rad) đặt ở góc mặt trước [-0.35 .. +1.65 rad]
      const overlapStart = -0.35;
      overlapDeform = createDeformableCylinder(
        radius + overlapRadiusOffset,
        CORE_HEIGHT,
        16,
        12,
        true,
        overlapStart,
        OVERLAP_ARC,
      );
      track(overlapDeform.geometry);
      overlapMesh = new THREE.Mesh(overlapDeform.geometry, material);
      overlapMesh.castShadow = true;
      group.add(overlapMesh);

      // Đường viền đánh dấu mép đoạn nối chồng 150 mm
      const seamPts = [
        new THREE.Vector3(
          Math.sin(overlapStart + OVERLAP_ARC) * (radius + overlapRadiusOffset + 0.005),
          -CORE_HEIGHT / 2,
          Math.cos(overlapStart + OVERLAP_ARC) * (radius + overlapRadiusOffset + 0.005),
        ),
        new THREE.Vector3(
          Math.sin(overlapStart + OVERLAP_ARC) * (radius + overlapRadiusOffset + 0.005),
          CORE_HEIGHT / 2,
          Math.cos(overlapStart + OVERLAP_ARC) * (radius + overlapRadiusOffset + 0.005),
        ),
      ];
      const seamGeo = track(new THREE.BufferGeometry().setFromPoints(seamPts));
      const seamMat = track(
        new THREE.LineBasicMaterial({
          color: 0xfbbf24,
          transparent: true,
          opacity: 0.9,
          clippingPlanes: specimenClipList,
        }),
      );
      seamLine = new THREE.Line(seamGeo, seamMat);
      group.add(seamLine);
    }

    specimenGroup.add(group);
    return {
      group,
      leftMesh,
      rightMesh,
      leftDeform,
      rightDeform,
      overlapMesh,
      overlapDeform,
      seamLine,
    };
  }

  // Lớp 1: Primer Epoxy (hổ phách trong mờ)
  const primerMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      map: textures.primerMap,
      transparent: true,
      opacity: 0.42,
      roughness: 0.25,
      metalness: 0.0,
      clearcoat: isSoftwareGl ? 0 : 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: specimenClipList,
    }),
  );
  const primerShell = buildSplitShell(CORE_RADIUS + 0.012, primerMat, false);
  primerShell.leftMesh.renderOrder = 2;
  primerShell.rightMesh.renderOrder = 2;

  // Lớp 2: Keo nền kết cấu Sikadur-330 (1.2 mm)
  const epoxyMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdbe2ea,
      map: textures.epoxyMap,
      roughness: 0.55,
      metalness: 0.05,
      side: THREE.DoubleSide,
      clippingPlanes: specimenClipList,
      clipShadows: true,
    }),
  );
  const epoxyShell = buildSplitShell(CORE_RADIUS + 0.028, epoxyMat, false);

  // Lớp 3A & 3B: Sợi FRP định hướng 90° + đoạn nối chồng 150 mm
  const gfrpMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.gfrpMap,
      bumpMap: textures.gfrpBump,
      bumpScale: 0.014,
      transparent: true,
      opacity: 0.84,
      roughness: 0.34,
      metalness: 0.05,
      clearcoat: isSoftwareGl ? 0 : 0.55,
      side: THREE.DoubleSide,
      clippingPlanes: specimenClipList,
    }),
  );
  const cfrpMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.cfrpMap,
      bumpMap: textures.cfrpBump,
      bumpScale: 0.018,
      roughness: 0.38,
      metalness: 0.18,
      anisotropy: isSoftwareGl ? 0 : 0.65,
      clearcoat: isSoftwareGl ? 0 : 0.35,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
      clippingPlanes: specimenClipList,
      clipShadows: true,
    }),
  );

  const frp1Shell = buildSplitShell(CORE_RADIUS + 0.048, cfrpMat, true, 0.014);
  const frp2Shell = buildSplitShell(CORE_RADIUS + 0.072, cfrpMat, true, 0.014);

  // Lớp 4: Lớp phủ bảo vệ Topcoat Epoxy
  const topcoatMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xfffbeb,
      transparent: true,
      opacity: 0.24,
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: isSoftwareGl ? 0 : 1.0,
      clearcoatRoughness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      clippingPlanes: specimenClipList,
    }),
  );
  const topcoatShell = buildSplitShell(CORE_RADIUS + 0.095, topcoatMat, false);
  topcoatShell.leftMesh.renderOrder = 4;
  topcoatShell.rightMesh.renderOrder = 4;

  // Vòng đứt sợi giòn ngang tại giữa thân trụ khi đạt tải 100% (cho nhóm FRP)
  const frpRuptureGroup = new THREE.Group();
  frpRuptureGroup.visible = false;
  const ruptureGapMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xdc2626,
      side: THREE.DoubleSide,
      clippingPlanes: specimenClipList,
    }),
  );
  const ruptureCoreBandMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x7c828a,
      map: textures.concreteMap,
      roughness: 0.95,
      side: THREE.DoubleSide,
      clippingPlanes: specimenClipList,
    }),
  );
  const ruptureStrandMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.42,
      clippingPlanes: specimenClipList,
    }),
  );
  const ruptureBand = new THREE.Mesh(
    track(new THREE.CylinderGeometry(CORE_RADIUS + 0.125, CORE_RADIUS + 0.125, 0.12, 32, 1, true)),
    ruptureGapMat,
  );
  const crushedCoreReveal = new THREE.Mesh(
    track(new THREE.CylinderGeometry(CORE_RADIUS + 0.118, CORE_RADIUS + 0.118, 0.08, 32, 1, true)),
    ruptureCoreBandMat,
  );
  frpRuptureGroup.add(ruptureBand, crushedCoreReveal);

  const strandGeo = track(new THREE.BoxGeometry(0.24, 0.026, 0.018));
  for (let s = 0; s < 32; s++) {
    const ang = (s / 32) * Math.PI * 2;
    const strand = new THREE.Mesh(strandGeo, ruptureStrandMat);
    const r = CORE_RADIUS + 0.142 + (s % 3) * 0.008;
    strand.position.set(
      Math.cos(ang) * r,
      (s % 2 === 0 ? 1 : -1) * (0.055 + (s % 3) * 0.015),
      Math.sin(ang) * r,
    );
    strand.rotation.y = -ang;
    strand.rotation.z = (s % 2 === 0 ? 1 : -1) * (0.42 + (s % 4) * 0.1);
    frpRuptureGroup.add(strand);
  }
  specimenGroup.add(frpRuptureGroup);

  // --- 3. VÉC-TƠ LỰC NÉN (ĐỎ), PHÌNH NGANG (CAM) & BÓ HÔNG HOOP (CYAN/XANH NGỌC) ---
  const vectorsGroup = new THREE.Group();
  root.add(vectorsGroup);

  // 4 mũi tên đỏ chỉ xuống đặt trên mâm nén trên
  const axialArrows: THREE.Group[] = [];
  const axialArrowOffsets = [
    [-0.48, 0.48],
    [0.48, 0.48],
    [-0.48, -0.48],
    [0.48, -0.48],
  ];
  axialArrowOffsets.forEach(([ax, az]) => {
    const arr = createVectorArrow(0xef4444, 0x991b1b, 0.48, 0.036);
    arr.rotation.x = Math.PI; // Hướng xuống dưới
    arr.position.set(ax, 3.85, az);
    axialArrows.push(arr);
    vectorsGroup.add(arr);
  });

  // 6 mũi tên cam phình ngang lõi bê tông hướng ra ngoài tại giữa thân trụ
  const radialArrows: THREE.Group[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const arr = createVectorArrow(0xf97316, 0x9a3412, 0.36, 0.028);
    // Xoay cho trục +Y của mũi tên hướng theo phương bán kính (cos, 0, sin)
    arr.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang)),
    );
    arr.position.set(Math.cos(ang) * 0.78, CORE_HEIGHT / 2, Math.sin(ang) * 0.78);
    radialArrows.push(arr);
    vectorsGroup.add(arr);
  }

  // Vòng véc-tơ ứng suất kéo vòng (Hoop Tensile Stress) phát sáng màu cyan/xanh ngọc quanh FRP
  const hoopGroup = new THREE.Group();
  hoopGroup.position.y = CORE_HEIGHT / 2;
  vectorsGroup.add(hoopGroup);

  const hoopMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      metalness: 0.2,
    }),
  );
  [-0.55, 0, 0.55].forEach((yRing) => {
    for (let seg = 0; seg < 4; seg++) {
      const startAng = seg * (Math.PI / 2) + 0.15;
      const arcLen = Math.PI / 2 - 0.42;
      const rRing = CORE_RADIUS + 0.14;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const a = startAng + (k / 12) * arcLen;
        pts.push(new THREE.Vector3(Math.cos(a) * rRing, yRing, Math.sin(a) * rRing));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = track(new THREE.TubeGeometry(curve, 12, 0.022, 8, false));
      const tube = new THREE.Mesh(tubeGeo, hoopMat);
      hoopGroup.add(tube);

      // Đầu mũi tên tiếp tuyến theo chiều kéo vòng
      const endAng = startAng + arcLen;
      const tangent = new THREE.Vector3(-Math.sin(endAng), 0, Math.cos(endAng)).normalize();
      const cone = new THREE.Mesh(track(new THREE.ConeGeometry(0.055, 0.15, 10)), hoopMat);
      cone.position.set(Math.cos(endAng) * rRing, yRing, Math.sin(endAng) * rRing);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      hoopGroup.add(cone);
    }
  });

  // --- 4. BỒN NGÂM MÔI TRƯỜNG XÂM THỰC (NaCl 3.5% / KIỀM 60 NGÀY) ---
  const salineGroup = new THREE.Group();
  salineGroup.visible = false;
  root.add(salineGroup);

  const bathLiquidMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: isSoftwareGl ? 0.22 : 0.26,
      roughness: 0.12,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const bathGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xa5f3fc,
      transparent: true,
      opacity: 0.16,
      roughness: 0.08,
      metalness: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );

  const bathLiquid = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.36, 1.36, 3.02, 40)),
    bathLiquidMat,
  );
  bathLiquid.position.y = CORE_HEIGHT / 2;
  bathLiquid.renderOrder = 8;

  const bathTankWall = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.42, 1.42, 3.16, 40, 1, true)),
    bathGlassMat,
  );
  bathTankWall.position.y = CORE_HEIGHT / 2 + 0.05;
  bathTankWall.renderOrder = 9;

  const bathRim = new THREE.Mesh(
    track(new THREE.TorusGeometry(1.42, 0.03, 10, 48)),
    machinedSteelMat,
  );
  bathRim.rotation.x = Math.PI / 2;
  bathRim.position.y = CORE_HEIGHT + 0.12;

  salineGroup.add(bathLiquid, bathTankWall, bathRim);

  // 48 ion Cl⁻ dùng InstancedMesh
  const ionCount = 48;
  const ionGeo = track(new THREE.SphereGeometry(0.036, 10, 10));
  const ionMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    }),
  );
  const ionInstanced = new THREE.InstancedMesh(ionGeo, ionMat, ionCount);
  ionInstanced.frustumCulled = false;
  salineGroup.add(ionInstanced);

  const ionSeeds = Array.from({ length: ionCount }, (_, i) => ({
    angle: (i / ionCount) * Math.PI * 2 + (i % 5) * 0.4,
    yBase: 0.25 + ((i * 0.37) % 2.55),
    phase: i * 0.61,
    speed: 0.7 + (i % 4) * 0.25,
  }));

  // --- 5. THƯỚC ĐO TỶ LỆ CHUẨN 1:1 (D = 150 mm, H = 300 mm, NỐI CHỒNG 150 mm) ---
  const scaleGuideGroup = new THREE.Group();
  scaleGuideGroup.visible = false;
  root.add(scaleGuideGroup);

  const caliperMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.92,
    }),
  );
  const caliperAccentMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.95,
    }),
  );

  // Vòng tròn đường kính chuẩn D = 150 mm quanh chân mẫu (y = 0.012)
  const baseDiamRing = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.08, CORE_RADIUS + 0.125, 48)),
    caliperMat,
  );
  baseDiamRing.rotation.x = -Math.PI / 2;
  baseDiamRing.position.y = 0.012;
  scaleGuideGroup.add(baseDiamRing);

  // Vòng ngoài bệ máy & vạch chia 50 mm trên mặt nền
  const outerFootprintRing = new THREE.Mesh(
    track(new THREE.RingGeometry(1.94, 1.98, 56)),
    caliperMat,
  );
  outerFootprintRing.rotation.x = -Math.PI / 2;
  outerFootprintRing.position.y = -0.69;
  scaleGuideGroup.add(outerFootprintRing);

  // Thước chiều cao đứng H = 300 mm (x = -1.32, y = 0..3.00)
  const heightShaft = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.014, 0.014, CORE_HEIGHT, 8)),
    caliperMat,
  );
  heightShaft.position.set(-1.32, CORE_HEIGHT / 2, 0);
  scaleGuideGroup.add(heightShaft);

  [0, CORE_HEIGHT / 2, CORE_HEIGHT].forEach((tickY, idx) => {
    const tick = new THREE.Mesh(
      track(new THREE.BoxGeometry(idx === 1 ? 0.14 : 0.24, 0.016, 0.016)),
      caliperMat,
    );
    tick.position.set(-1.32, tickY, 0);
    scaleGuideGroup.add(tick);
  });

  // Thước đường kính ngang D = 150 mm đặt ở mặt trước (y = 2.88, z = 1.18) để không bị mâm nén che khuất
  const diamZ = 1.18;
  const diamY = CORE_HEIGHT - 0.12;
  const diamShaft = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.014, 0.014, CORE_RADIUS * 2, 8)),
    caliperMat,
  );
  diamShaft.rotation.z = Math.PI / 2;
  diamShaft.position.set(0, diamY, diamZ);
  scaleGuideGroup.add(diamShaft);

  [-CORE_RADIUS, CORE_RADIUS].forEach((tickX) => {
    const tick = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.016, 0.16, 0.016)),
      caliperMat,
    );
    tick.position.set(tickX, diamY, diamZ);
    scaleGuideGroup.add(tick);

    const extArm = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.012, 0.012, diamZ)),
      caliperMat,
    );
    extArm.position.set(tickX, diamY, diamZ / 2);
    scaleGuideGroup.add(extArm);
  });

  // Cung đánh dấu đoạn nối chồng 150 mm màu vàng hổ phách ở phần thân dưới (y = 0.95)
  const overlapArcCurvePts: THREE.Vector3[] = [];
  for (let k = 0; k <= 16; k++) {
    const a = -0.35 + (k / 16) * OVERLAP_ARC;
    const r = CORE_RADIUS + 0.14;
    overlapArcCurvePts.push(new THREE.Vector3(Math.sin(a) * r, 0.95, Math.cos(a) * r));
  }
  const overlapArcCurve = new THREE.CatmullRomCurve3(overlapArcCurvePts);
  const overlapArcTube = new THREE.Mesh(
    track(new THREE.TubeGeometry(overlapArcCurve, 16, 0.018, 6, false)),
    caliperAccentMat,
  );
  scaleGuideGroup.add(overlapArcTube);

  // --- 6. ĐIỂM ĐÁNH DẤU KHẢO SÁT VẾT NỨT CHI TIẾT (FORENSIC MARKER) ---
  const inspectionMarkerGroup = new THREE.Group();
  inspectionMarkerGroup.visible = false;
  root.add(inspectionMarkerGroup);

  const markerOuterMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    }),
  );
  const markerInnerMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
    }),
  );
  const markerRing = new THREE.Mesh(
    track(new THREE.RingGeometry(0.085, 0.115, 32)),
    markerOuterMat,
  );
  const markerCenterDot = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.025, 20)),
    markerInnerMat,
  );
  const markerPin = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8)).rotateX(Math.PI / 2),
    markerInnerMat,
  );
  markerPin.position.z = 0.12;
  inspectionMarkerGroup.add(markerRing, markerCenterDot, markerPin);

  // --- 7. CHẾ ĐỘ X-RAY CROSS-SECTION (MẶT CẮT NGANG & BÓNG X-RAY PHẦN TRÊN) ---
  const crossSectionCapGroup = new THREE.Group();
  crossSectionCapGroup.visible = false;
  root.add(crossSectionCapGroup);

  const coreCutMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdbe0e6,
      map: textures.concreteMap,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
  );
  const coreCapMesh = new THREE.Mesh(
    track(new THREE.CircleGeometry(CORE_RADIUS, 48)).rotateX(-Math.PI / 2),
    coreCutMat,
  );
  crossSectionCapGroup.add(coreCapMesh);

  const primerCapMat = track(
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide }),
  );
  const primerCapRing = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS, CORE_RADIUS + 0.015, 48)).rotateX(-Math.PI / 2),
    primerCapMat,
  );
  primerCapRing.position.y = 0.001;

  const epoxyCapMat = track(
    new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide }),
  );
  const epoxyCapRing = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.015, CORE_RADIUS + 0.042, 48)).rotateX(-Math.PI / 2),
    epoxyCapMat,
  );
  epoxyCapRing.position.y = 0.001;

  const frp1CapMat = track(
    new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide }),
  );
  const frp1CapRing = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.042, CORE_RADIUS + 0.066, 48)).rotateX(-Math.PI / 2),
    frp1CapMat,
  );
  frp1CapRing.position.y = 0.001;

  const frp2CapMat = track(
    new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide }),
  );
  const frp2CapRing = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.066, CORE_RADIUS + 0.09, 48)).rotateX(-Math.PI / 2),
    frp2CapMat,
  );
  frp2CapRing.position.y = 0.001;

  const topcoatCapMat = track(
    new THREE.MeshBasicMaterial({ color: 0xfde68a, side: THREE.DoubleSide }),
  );
  const topcoatCapRing1Layer = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.084, CORE_RADIUS + 0.102, 48)).rotateX(-Math.PI / 2),
    topcoatCapMat,
  );
  topcoatCapRing1Layer.position.y = 0.001;

  const topcoatCapRing2Layer = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.108, CORE_RADIUS + 0.126, 48)).rotateX(-Math.PI / 2),
    topcoatCapMat,
  );
  topcoatCapRing2Layer.position.y = 0.001;

  // Cung nối chồng 150 mm (2.0 rad) đặt tách vòng ngoài để nhìn rõ cả lớp sợi gốc lẫn đoạn nối chồng
  const overlapThetaStart = -0.35 - Math.PI / 2;
  const overlapCapMat = track(
    new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide }),
  );
  const overlapCapArc1Layer = new THREE.Mesh(
    track(
      new THREE.RingGeometry(
        CORE_RADIUS + 0.066,
        CORE_RADIUS + 0.084,
        28,
        1,
        overlapThetaStart,
        OVERLAP_ARC,
      ),
    ).rotateX(-Math.PI / 2),
    overlapCapMat,
  );
  overlapCapArc1Layer.position.y = 0.0025;

  const overlapCapArc2Layer = new THREE.Mesh(
    track(
      new THREE.RingGeometry(
        CORE_RADIUS + 0.09,
        CORE_RADIUS + 0.108,
        28,
        1,
        overlapThetaStart,
        OVERLAP_ARC,
      ),
    ).rotateX(-Math.PI / 2),
    overlapCapMat,
  );
  overlapCapArc2Layer.position.y = 0.0025;

  // Khung laser X-Ray cyan quanh mặt cắt
  const xrayLaserMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    }),
  );
  const xrayLaserRing = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.16, CORE_RADIUS + 0.182, 64)).rotateX(-Math.PI / 2),
    xrayLaserMat,
  );
  xrayLaserRing.position.y = 0.002;
  crossSectionCapGroup.add(
    primerCapRing,
    epoxyCapRing,
    frp1CapRing,
    frp2CapRing,
    topcoatCapRing1Layer,
    topcoatCapRing2Layer,
    overlapCapArc1Layer,
    overlapCapArc2Layer,
    xrayLaserRing,
  );

  for (let t = 0; t < 4; t++) {
    const ang = (t * Math.PI) / 2;
    const tick = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.006, 0.014)), xrayLaserMat);
    tick.position.set(Math.cos(ang) * (CORE_RADIUS + 0.24), 0.002, Math.sin(ang) * (CORE_RADIUS + 0.24));
    tick.rotation.y = -ang;
    crossSectionCapGroup.add(tick);
  }

  // Bóng X-Ray bán trong suốt của nửa trên trụ (phía trên mặt cắt)
  const xrayGhostGroup = new THREE.Group();
  xrayGhostGroup.visible = false;
  root.add(xrayGhostGroup);

  const xrayGhostMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      side: THREE.FrontSide,
      clippingPlanes: [upperGhostPlane],
    }),
  );
  const xrayGhostCylinder = new THREE.Mesh(
    track(new THREE.CylinderGeometry(CORE_RADIUS + 0.095, CORE_RADIUS + 0.095, CORE_HEIGHT, 36, 1, false)),
    xrayGhostMat,
  );
  xrayGhostCylinder.position.y = CORE_HEIGHT / 2;
  xrayGhostCylinder.renderOrder = 6;

  const xrayGhostTopRing = new THREE.Mesh(
    track(new THREE.RingGeometry(CORE_RADIUS + 0.075, CORE_RADIUS + 0.098, 48)).rotateX(-Math.PI / 2),
    track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    ),
  );
  xrayGhostTopRing.position.y = CORE_HEIGHT;
  xrayGhostGroup.add(xrayGhostCylinder, xrayGhostTopRing);

  const inspectableTargets: THREE.Object3D[] = [
    coreMesh,
    frp1Shell.leftMesh,
    frp1Shell.rightMesh,
    ...(frp1Shell.overlapMesh ? [frp1Shell.overlapMesh] : []),
    frp2Shell.leftMesh,
    frp2Shell.rightMesh,
    ...(frp2Shell.overlapMesh ? [frp2Shell.overlapMesh] : []),
    topcoatShell.leftMesh,
    topcoatShell.rightMesh,
  ];

  // Gắn metadata nhận diện từng lớp vật liệu cho hệ thống chú giải (hover tooltip)
  const tagTarget = (obj: THREE.Object3D | undefined, componentKey: ComponentKey, isOverlapZone = false) => {
    if (!obj) return;
    obj.userData.componentKey = componentKey;
    obj.userData.isOverlapZone = isOverlapZone;
  };
  tagTarget(coreMesh, 'concrete');
  tagTarget(primerShell.leftMesh, 'primer');
  tagTarget(primerShell.rightMesh, 'primer');
  tagTarget(epoxyShell.leftMesh, 'epoxy');
  tagTarget(epoxyShell.rightMesh, 'epoxy');
  tagTarget(frp1Shell.leftMesh, 'frp1');
  tagTarget(frp1Shell.rightMesh, 'frp1');
  tagTarget(frp1Shell.overlapMesh, 'frp1', true);
  tagTarget(frp2Shell.leftMesh, 'frp2');
  tagTarget(frp2Shell.rightMesh, 'frp2');
  tagTarget(frp2Shell.overlapMesh, 'frp2', true);
  tagTarget(topcoatShell.leftMesh, 'topcoat');
  tagTarget(topcoatShell.rightMesh, 'topcoat');
  tagTarget(lowerPlatenDisc, 'platen');
  tagTarget(upperPlatenDisc, 'platen');

  // Gắn metadata cho các vành mặt cắt X-Ray để rê chuột trên mặt cắt cũng hiện thông số
  tagTarget(coreCapMesh, 'concrete');
  tagTarget(primerCapRing, 'primer');
  tagTarget(epoxyCapRing, 'epoxy');
  tagTarget(frp1CapRing, 'frp1');
  tagTarget(frp2CapRing, 'frp2');
  tagTarget(topcoatCapRing1Layer, 'topcoat');
  tagTarget(topcoatCapRing2Layer, 'topcoat');
  tagTarget(overlapCapArc1Layer, 'frp1', true);
  tagTarget(overlapCapArc2Layer, 'frp2', true);

  const hoverableTargets: THREE.Object3D[] = [
    coreCapMesh,
    primerCapRing,
    epoxyCapRing,
    frp1CapRing,
    frp2CapRing,
    topcoatCapRing1Layer,
    topcoatCapRing2Layer,
    overlapCapArc1Layer,
    overlapCapArc2Layer,
    coreMesh,
    primerShell.leftMesh,
    primerShell.rightMesh,
    epoxyShell.leftMesh,
    epoxyShell.rightMesh,
    frp1Shell.leftMesh,
    frp1Shell.rightMesh,
    ...(frp1Shell.overlapMesh ? [frp1Shell.overlapMesh] : []),
    frp2Shell.leftMesh,
    frp2Shell.rightMesh,
    ...(frp2Shell.overlapMesh ? [frp2Shell.overlapMesh] : []),
    topcoatShell.leftMesh,
    topcoatShell.rightMesh,
    lowerPlatenDisc,
    upperPlatenDisc,
  ];

  const _dummy = new THREE.Object3D();
  const _ionColor = new THREE.Color();
  const _zAxis = new THREE.Vector3(0, 0, 1);

  const shells: Record<'primer' | 'epoxy' | 'frp1' | 'frp2' | 'topcoat', ShellPair> = {
    primer: primerShell,
    epoxy: epoxyShell,
    frp1: frp1Shell,
    frp2: frp2Shell,
    topcoat: topcoatShell,
  };

  function updateShellDeformation(
    shell: ShellPair,
    axialSquash: number,
    bulgeAmount: number,
    ruptureGap: number,
  ) {
    applyBarrelDeformation(shell.leftDeform, axialSquash, bulgeAmount, ruptureGap);
    applyBarrelDeformation(shell.rightDeform, axialSquash, bulgeAmount, ruptureGap);
    if (shell.overlapDeform) {
      applyBarrelDeformation(shell.overlapDeform, axialSquash, bulgeAmount, ruptureGap);
    }
  }

  return {
    root,
    inspectableTargets,
    hoverableTargets,
    updateState: ({
      groupId,
      explodeValue,
      loadRatio,
      bulgeNorm,
      isPassiveConfinement,
      isRuptured,
      salineMode,
      elapsed,
      scaleGuideVisible = false,
      hideTallFrame = false,
      xrayMode = false,
      xrayHeightMm = 150,
    }) => {
      scaleGuideGroup.visible = scaleGuideVisible;
      tallFrameGroup.visible = !hideTallFrame && !xrayMode;
      contactShadowMesh.visible = !hideTallFrame;
      const spec = SPECIMEN_GROUPS[groupId];
      const hasFrp = spec.fiberType !== 'NONE';
      const hasTwoLayers = spec.layers >= 2;

      // Vật liệu sợi & bê tông ăn mòn
      const activeFrpMat = spec.fiberType === 'GFRP' ? gfrpMat : cfrpMat;
      frp1Shell.leftMesh.material = activeFrpMat;
      frp1Shell.rightMesh.material = activeFrpMat;
      if (frp1Shell.overlapMesh) frp1Shell.overlapMesh.material = activeFrpMat;
      frp2Shell.leftMesh.material = activeFrpMat;
      frp2Shell.rightMesh.material = activeFrpMat;
      if (frp2Shell.overlapMesh) frp2Shell.overlapMesh.material = activeFrpMat;

      const targetConcMap =
        salineMode && !hasFrp ? textures.concreteCorrodedMap : textures.concreteMap;
      if (concreteMat.map !== targetConcMap) {
        concreteMat.map = targetConcMap;
        concreteMat.needsUpdate = true;
      }
      if (coreCutMat.map !== targetConcMap) {
        coreCutMat.map = targetConcMap;
        coreCutMat.needsUpdate = true;
      }

      // Hiển thị từng lớp theo tổ hợp
      primerShell.group.visible = hasFrp;
      epoxyShell.group.visible = hasFrp;
      frp1Shell.group.visible = hasFrp;
      frp2Shell.group.visible = hasTwoLayers;
      topcoatShell.group.visible = hasFrp;

      // Biến dạng nén dọc trục và phình ngang dạng thùng (barrel bulge)
      const axialSquash = loadRatio * (hasFrp ? 0.052 : 0.025);
      const bulgeAmount = bulgeNorm * (hasFrp ? 0.082 : 0.042);
      const ruptureGap = isRuptured && hasFrp ? 1.0 : 0.0;

      applyBarrelDeformation(coreDeform, axialSquash, bulgeAmount, isRuptured && !hasFrp ? 0.45 : 0);

      if (hasFrp) {
        updateShellDeformation(primerShell, axialSquash, bulgeAmount, 0);
        updateShellDeformation(epoxyShell, axialSquash, bulgeAmount, 0);
        updateShellDeformation(frp1Shell, axialSquash, bulgeAmount, ruptureGap);
        if (hasTwoLayers) {
          updateShellDeformation(frp2Shell, axialSquash, bulgeAmount, ruptureGap);
        }
        updateShellDeformation(topcoatShell, axialSquash, bulgeAmount, ruptureGap * 0.7);
      }

      // Hiệu ứng tách lớp vật liệu (Exploded View): tách nửa trái và nửa phải sang 2 bên theo bậc thang rõ ràng
      const offsets = computeExplodedLayerOffsets(groupId, explodeValue);
      const offsetMap = new Map(offsets.map((o) => [o.key, o]));

      (['primer', 'epoxy', 'frp1', 'frp2', 'topcoat'] as const).forEach((key) => {
        const shell = shells[key];
        const info = offsetMap.get(key);
        if (!info) return;
        const rad = info.radialOffset;
        shell.rightMesh.position.set(rad, info.yOffset, 0);
        shell.leftMesh.position.set(-rad, info.yOffset, 0);
        if (shell.overlapMesh) {
          shell.overlapMesh.position.set(rad, info.yOffset, 0);
        }
        if (shell.seamLine) {
          shell.seamLine.position.set(rad, info.yOffset, 0);
        }
      });

      // Mâm nén trên đi xuống theo tỷ lệ tải (ẩn ở chế độ X-Ray để nhìn rõ mặt cắt từ trên xuống)
      const platenTravel = axialSquash * CORE_HEIGHT;
      topPlatenGroup.position.y = CORE_HEIGHT - platenTravel;
      topPlatenGroup.visible = !xrayMode;

      // Đồng bộ mặt phẳng cắt X-Ray Cross-Section & các vành lớp đồng tâm
      if (xrayMode) {
        const xrayInfo = computeXrayCrossSection(groupId, xrayHeightMm, loadRatio, salineMode);
        cutPlane.constant = xrayInfo.cutWorldY;
        upperGhostPlane.constant = -xrayInfo.cutWorldY;

        crossSectionCapGroup.visible = true;
        crossSectionCapGroup.position.y = xrayInfo.cutWorldY;
        crossSectionCapGroup.scale.set(xrayInfo.radialBulgeScale, 1, xrayInfo.radialBulgeScale);

        primerCapRing.visible = hasFrp;
        epoxyCapRing.visible = hasFrp;
        frp1CapRing.visible = hasFrp;
        frp2CapRing.visible = hasTwoLayers;
        topcoatCapRing1Layer.visible = hasFrp && !hasTwoLayers;
        topcoatCapRing2Layer.visible = hasFrp && hasTwoLayers;
        overlapCapArc1Layer.visible = hasFrp && !hasTwoLayers;
        overlapCapArc2Layer.visible = hasFrp && hasTwoLayers;

        frp1CapMat.color.setHex(spec.fiberType === 'GFRP' ? 0x38bdf8 : 0x10b981);
        frp2CapMat.color.setHex(spec.fiberType === 'GFRP' ? 0x22d3ee : 0x34d399);

        xrayGhostGroup.visible = true;
        const ghostRadialScale = 1 + bulgeAmount * 0.55;
        xrayGhostCylinder.scale.set(ghostRadialScale, 1 - axialSquash, ghostRadialScale);
        xrayGhostCylinder.position.y = (CORE_HEIGHT * (1 - axialSquash)) / 2;
        xrayGhostTopRing.position.y = CORE_HEIGHT * (1 - axialSquash);
        xrayGhostTopRing.scale.setScalar(ghostRadialScale);
      } else {
        cutPlane.constant = 50;
        crossSectionCapGroup.visible = false;
        xrayGhostGroup.visible = false;
      }

      // Vết nứt / đứt sợi ở tải cao & 100%
      m0MicroCrackGroup.visible = !hasFrp && loadRatio >= 0.68;
      if (m0MicroCrackGroup.visible) {
        const microScale = 1 + bulgeAmount * 1.02;
        m0MicroCrackGroup.scale.set(microScale, 1 - axialSquash, microScale);
      }

      m0ShearCrackGroup.visible = isRuptured && !hasFrp;
      if (m0ShearCrackGroup.visible) {
        const crackScale = 1 + bulgeAmount * 1.04;
        m0ShearCrackGroup.scale.set(crackScale, 1 - axialSquash, crackScale);
      }
      frpRuptureGroup.visible = isRuptured && hasFrp && explodeValue < 0.15;
      if (frpRuptureGroup.visible) {
        ruptureStrandMat.color.setHex(spec.fiberType === 'GFRP' ? 0xbef2ff : 0xcbd5e1);
        const rupScale = 1 + bulgeAmount * 1.05;
        frpRuptureGroup.scale.set(rupScale, 1, rupScale);
      }

      // Véc-tơ lực nén đỏ
      const showAxial = loadRatio > 0.02 && !xrayMode;
      axialArrows.forEach((arr, idx) => {
        arr.visible = showAxial;
        if (showAxial) {
          const s = 0.45 + 0.65 * loadRatio;
          arr.scale.set(1, s, 1);
          const [ax, az] = axialArrowOffsets[idx];
          arr.position.set(ax, topPlatenGroup.position.y + 0.92 + 0.35 * s, az);
        }
      });

      // Mũi tên cam phình ngang bê tông (tải > 70%, hoặc > 65% với M0)
      const showLateral = loadRatio > (hasFrp ? 0.7 : 0.65);
      radialArrows.forEach((arr, i) => {
        arr.visible = showLateral;
        if (showLateral) {
          const ang = (i / 6) * Math.PI * 2;
          const rStart = CORE_RADIUS + bulgeAmount + 0.05;
          arr.position.set(Math.cos(ang) * rStart, CORE_HEIGHT / 2, Math.sin(ang) * rStart);
          const latScale = 0.6 + 0.7 * bulgeNorm;
          arr.scale.set(1, latScale, 1);
        }
      });

      // Vòng ứng suất bó hông FRP phát sáng khi tải > 70%
      hoopGroup.visible = isPassiveConfinement && explodeValue < 0.2 && !xrayMode;
      if (hoopGroup.visible) {
        const hoopIntensity = 0.7 + 0.9 * Math.max(0, (loadRatio - 0.7) / 0.3);
        hoopMat.emissiveIntensity = isRuptured ? 0.2 : hoopIntensity;
        hoopMat.color.setHex(isRuptured ? 0xf87171 : 0x22d3ee);
        hoopMat.emissive.setHex(isRuptured ? 0xef4444 : 0x06b6d4);
        hoopGroup.rotation.y = elapsed * 0.35;
        const ringScale = 1 + bulgeAmount * 0.9;
        hoopGroup.scale.set(ringScale, 1, ringScale);
      }

      // Chế độ môi trường xâm thực (NaCl 3.5% / Kiềm 60 ngày)
      salineGroup.visible = salineMode;
      if (salineMode) {
        const barrierRadius = hasFrp ? CORE_RADIUS + 0.16 : CORE_RADIUS + 0.03;
        for (let i = 0; i < ionCount; i++) {
          const seed = ionSeeds[i];
          const cycle = (elapsed * seed.speed + seed.phase) % 2.4;
          // Ion trôi từ ngoài thành bể (1.32) tiến vào mẫu rồi bị chặn lại ở lớp bảo vệ FRP hoặc bám lên M0
          const approach = cycle < 1.2 ? cycle / 1.2 : 2 - cycle / 1.2;
          const r = 1.32 - approach * (1.32 - barrierRadius);
          const ang = seed.angle + elapsed * 0.22 * (i % 2 === 0 ? 1 : -1);
          const y = seed.yBase + Math.sin(elapsed * 1.4 + seed.phase) * 0.12;

          _dummy.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
          const pulseScale = approach > 0.85 && hasFrp ? 1.3 : 1.0;
          _dummy.scale.setScalar(pulseScale);
          _dummy.updateMatrix();
          ionInstanced.setMatrixAt(i, _dummy.matrix);

          // Đổi màu ion: xanh ngọc khi bị FRP chặn, cam/đỏ cảnh báo khi ăn mòn lõi M0
          _ionColor.setHex(hasFrp ? 0x2dd4bf : 0xf97316);
          ionInstanced.setColorAt(i, _ionColor);
        }
        ionInstanced.instanceMatrix.needsUpdate = true;
        if (ionInstanced.instanceColor) ionInstanced.instanceColor.needsUpdate = true;
      }
    },

    getCalloutAnchors: (groupId, explodeValue) => {
      const offsets = computeExplodedLayerOffsets(groupId, explodeValue);
      const yLayout: Record<LayerKey, { side: number; y: number; extraX: number }> = {
        concrete: { side: 0, y: CORE_HEIGHT * 0.9, extraX: 0 },
        primer: { side: -1, y: 2.15, extraX: 0.12 },
        epoxy: { side: 1, y: 2.32, extraX: 0.16 },
        frp1: { side: 1, y: 1.48, extraX: 0.22 },
        frp2: { side: -1, y: 1.05, extraX: 0.26 },
        topcoat: { side: 1, y: 0.62, extraX: 0.28 },
      };

      return offsets.map((layer) => {
        const cfg = yLayout[layer.key];
        let x = 0;
        let y = cfg.y;
        let z = 0;

        if (layer.key === 'concrete') {
          x = 0;
          z = CORE_RADIUS * 0.45;
        } else {
          const shell = shells[layer.key];
          const rad = layer.radialOffset;
          const baseR = shell.rightDeform.baseRadius;
          x = cfg.side * (rad + baseR * 0.9 + cfg.extraX);
          y = cfg.y + layer.yOffset * 0.4;
          z = baseR * 0.45;
        }

        return {
          key: layer.key,
          label: layer.label,
          specText: layer.specText,
          color: layer.color,
          worldPos: new THREE.Vector3(x, y, z),
        };
      });
    },

    setInspectionMarker: (worldPos, worldNormal) => {
      if (!worldPos) {
        inspectionMarkerGroup.visible = false;
        return;
      }
      const normal = worldNormal ? worldNormal.clone().normalize() : new THREE.Vector3(0, 0, 1);
      inspectionMarkerGroup.position.copy(worldPos).addScaledVector(normal, 0.025);
      inspectionMarkerGroup.quaternion.setFromUnitVectors(_zAxis, normal);
      inspectionMarkerGroup.visible = true;
    },

    getScaleCalloutAnchors: () => [
      {
        key: 'diameter',
        label: 'D = 150 mm (0.15 m)',
        worldPos: new THREE.Vector3(0.0, CORE_HEIGHT - 0.12, 1.32),
      },
      {
        key: 'height',
        label: 'H = 300 mm (0.30 m)',
        worldPos: new THREE.Vector3(-1.62, CORE_HEIGHT * 0.52, 0),
      },
      {
        key: 'overlap',
        label: 'Nối chồng 150 mm',
        worldPos: new THREE.Vector3(0.95, 1.05, 0.72),
      },
    ],

    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
