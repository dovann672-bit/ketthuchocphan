export type GroupId = 'M0' | 'G1' | 'G2' | 'C1' | 'C2';
export type FiberType = 'NONE' | 'GFRP' | 'CFRP';
export type CameraPreset = 'overview' | 'layers' | 'top_platen' | 'overlap';

export interface SpecimenGroupSpec {
  id: GroupId;
  shortLabel: string;
  name: string;
  description: string;
  fiberType: FiberType;
  layers: number;
  rhoFPercent: number; // Hàm lượng sợi ρf (%)
  tfMmPerLayer: number; // Chiều dày danh định 1 lớp sợi (mm)
  fccMPa: number; // Cường độ nén dọc trục f'cc (MPa)
  deltaFccPct: number; // Tăng cường độ so với M0 (%)
  eccuPermille: number; // Biến dạng cực hạn εccu (‰)
  fctMPa: number; // Cường độ kéo gián tiếp fct (MPa)
  ecGPa: number; // Mô đun đàn hồi Ec (GPa)
  tauB_MPa: number | null; // Ứng suất bám dính cắt τb (MPa)
  kdPercent: number; // Hệ số duy trì độ bền sau xâm thực Kd (%)
  accentColor: string;
  curveColor: string;
}

export const SPECIMEN_DIMENSIONS = {
  diameterMm: 150,
  heightMm: 300,
  overlapMm: 150,
  epoxyBaseMm: 1.2,
  maxPlatenCapacityKN: 2000,
  areaMm2: Math.PI * 75 * 75, // ≈ 17,671.46 mm²
} as const;

export const SPECIMEN_GROUPS: Record<GroupId, SpecimenGroupSpec> = {
  M0: {
    id: 'M0',
    shortLabel: 'M0 · B25 chuẩn',
    name: 'M0 (0 lớp - Bê tông B25 chuẩn)',
    description: 'Mẫu đối chứng không gia cường FRP, phá hoại cắt nghiêng giòn ở tải đỉnh.',
    fiberType: 'NONE',
    layers: 0,
    rhoFPercent: 0,
    tfMmPerLayer: 0,
    fccMPa: 25.4,
    deltaFccPct: 0,
    eccuPermille: 2.8,
    fctMPa: 2.45,
    ecGPa: 28.5,
    tauB_MPa: null,
    kdPercent: 81.5,
    accentColor: '#94a3b8',
    curveColor: '#94a3b8',
  },
  G1: {
    id: 'G1',
    shortLabel: 'G1 · 1 lớp GFRP',
    name: 'G1 (1 lớp GFRP, ρf = 0.93%)',
    description: 'Bọc 1 lớp sợi thủy tinh định hướng 90°, đoạn nối chồng 150 mm, keo Sikadur-330.',
    fiberType: 'GFRP',
    layers: 1,
    rhoFPercent: 0.93,
    tfMmPerLayer: 0.35,
    fccMPa: 33.5,
    deltaFccPct: 31.9,
    eccuPermille: 6.4,
    fctMPa: 3.18,
    ecGPa: 30.2,
    tauB_MPa: 2.35,
    kdPercent: 94.2,
    accentColor: '#38bdf8',
    curveColor: '#38bdf8',
  },
  G2: {
    id: 'G2',
    shortLabel: 'G2 · 2 lớp GFRP',
    name: 'G2 (2 lớp GFRP, ρf = 1.87%)',
    description: 'Bọc 2 lớp sợi thủy tinh định hướng 90°, tăng cường độ +58.3% và biến dạng cực hạn 9.20‰.',
    fiberType: 'GFRP',
    layers: 2,
    rhoFPercent: 1.87,
    tfMmPerLayer: 0.35,
    fccMPa: 40.2,
    deltaFccPct: 58.3,
    eccuPermille: 9.2,
    fctMPa: 3.72,
    ecGPa: 31.8,
    tauB_MPa: 2.28,
    kdPercent: 96.0,
    accentColor: '#22d3ee',
    curveColor: '#22d3ee',
  },
  C1: {
    id: 'C1',
    shortLabel: 'C1 · 1 lớp CFRP',
    name: 'C1 (1 lớp CFRP, ρf = 0.45%)',
    description: 'Bọc 1 lớp sợi carbon mô đun cao định hướng 90°, bó hông hiệu quả ở tỷ lệ sợi thấp.',
    fiberType: 'CFRP',
    layers: 1,
    rhoFPercent: 0.45,
    tfMmPerLayer: 0.167,
    fccMPa: 39.8,
    deltaFccPct: 56.7,
    eccuPermille: 5.5,
    fctMPa: 3.65,
    ecGPa: 32.4,
    tauB_MPa: 2.42,
    kdPercent: 95.8,
    accentColor: '#f59e0b',
    curveColor: '#f59e0b',
  },
  C2: {
    id: 'C2',
    shortLabel: 'C2 · 2 lớp CFRP',
    name: 'C2 (2 lớp CFRP, ρf = 0.90%)',
    description: 'Bọc 2 lớp sợi carbon cường độ cao, đạt cường độ nén 48.6 MPa (+91.3% so với M0).',
    fiberType: 'CFRP',
    layers: 2,
    rhoFPercent: 0.9,
    tfMmPerLayer: 0.167,
    fccMPa: 48.6,
    deltaFccPct: 91.3,
    eccuPermille: 7.8,
    fctMPa: 4.25,
    ecGPa: 35.1,
    tauB_MPa: 2.3,
    kdPercent: 97.5,
    accentColor: '#10b981',
    curveColor: '#10b981',
  },
};

export const GROUP_ORDER: GroupId[] = ['M0', 'G1', 'G2', 'C1', 'C2'];

export interface StressStrainState {
  loadRatio: number; // 0..1
  strainPermille: number; // ‰
  stressMPa: number; // MPa
  axialLoadKN: number; // kN
  hoopStressMPa: number; // Ứng suất kéo vòng trên áo FRP (MPa)
  lateralBulgeNorm: number; // 0..1 mức độ phình ngang ở giữa thân trụ
  isPassiveConfinementActive: boolean; // load > 70% đối với mẫu FRP
  isRuptured: boolean; // load >= 0.995
}

/**
 * Mô hình ứng xử ứng suất – biến dạng (Lam & Teng 2003 cho bê tông bọc FRP, Popovics cho M0).
 * Ở chế độ xâm thực (NaCl 3.5% / Kiềm 60 ngày), cường độ đỉnh suy giảm theo hệ số Kd (%).
 */
export function computeStressStrainPoint(
  groupId: GroupId,
  loadRatioRaw: number,
  salineMode = false,
): StressStrainState {
  const spec = SPECIMEN_GROUPS[groupId];
  const loadRatio = Math.max(0, Math.min(1, loadRatioRaw));
  const durabilityScale = salineMode ? spec.kdPercent / 100 : 1.0;

  const strainPermille = loadRatio * spec.eccuPermille;
  let stressMPa = 0;

  if (spec.fiberType === 'NONE') {
    // Bê tông B25 không bó: nhánh tăng lên đỉnh ở ~72% biến dạng cực hạn (2.0‰), sau đó mềm hóa nhẹ tới 2.80‰
    const peakStrain = spec.eccuPermille * 0.72; // ~2.016‰
    const fPeak = spec.fccMPa * durabilityScale;
    if (strainPermille <= peakStrain) {
      const r = strainPermille / peakStrain;
      stressMPa = fPeak * (2 * r - r * r);
    } else {
      const postRatio = (strainPermille - peakStrain) / (spec.eccuPermille - peakStrain);
      stressMPa = fPeak * (1 - 0.16 * postRatio * postRatio);
    }
  } else {
    // Lam & Teng parabolic-linear model cho bê tông bọc FRP
    const fco = 25.4 * (salineMode ? 0.98 : 1.0); // Lõi bê tông được bảo vệ tốt bởi lớp Epoxy-FRP
    const fccEff = spec.fccMPa * durabilityScale;
    const ecSlope = spec.ecGPa; // GPa = MPa / ‰
    const epsT = 2.0; // Ngưỡng chuyển tiếp sang nhánh tăng cứng bó hông (~2.0‰)
    const e2 = (fccEff - fco) / Math.max(0.1, spec.eccuPermille - epsT);

    if (strainPermille <= epsT) {
      const term1 = ecSlope * strainPermille;
      const denom = Math.max(0.001, 4 * (fco - ecSlope * epsT) + 2 * e2 * epsT);
      // Đảm bảo tiếp tuyến liên tục tại epsT với đường thẳng nhánh 2
      const a = (ecSlope - e2) * (ecSlope - e2) / Math.max(1.0, 4 * fco);
      stressMPa = Math.min(
        fccEff,
        term1 - a * strainPermille * strainPermille,
      );
      // Điều chỉnh mượt để khớp chính xác tại epsT
      const valAtT = ecSlope * epsT - a * epsT * epsT;
      const targetAtT = fco + e2 * 0;
      const blend = strainPermille / epsT;
      stressMPa = stressMPa + (targetAtT - valAtT) * blend * blend;
      void denom;
    } else {
      stressMPa = fco + e2 * (strainPermille - epsT);
    }
  }

  stressMPa = Math.max(0, stressMPa);
  const axialLoadKN = (stressMPa * SPECIMEN_DIMENSIONS.areaMm2) / 1000;

  // Hiệu ứng bó hông (Passive Confinement) kích hoạt rõ rệt khi tải > 70%
  const activeLateralRatio = Math.max(0, (loadRatio - 0.7) / 0.3);
  const isPassiveConfinementActive = spec.fiberType !== 'NONE' && loadRatio > 0.7;

  // Phình ngang lõi bê tông: mẫu M0 phình trước khi nứt cắt (tuy không bị bó), mẫu FRP phình làm căng vòng sợi
  const lateralBulgeNorm =
    loadRatio <= 0.7
      ? loadRatio * 0.14
      : 0.098 + activeLateralRatio * (spec.fiberType === 'NONE' ? 0.55 : 0.9);

  // Ứng suất kéo vòng trên sợi FRP (MPa)
  const maxHoopMPa = spec.fiberType === 'CFRP' ? 1450 : spec.fiberType === 'GFRP' ? 680 : 0;
  const hoopStressMPa =
    spec.fiberType === 'NONE' || loadRatio <= 0.7
      ? spec.fiberType === 'NONE'
        ? 0
        : (loadRatio / 0.7) * maxHoopMPa * 0.12
      : maxHoopMPa * (0.12 + 0.88 * Math.pow(activeLateralRatio, 0.85));

  const isRuptured = loadRatio >= 0.995;

  return {
    loadRatio,
    strainPermille,
    stressMPa,
    axialLoadKN,
    hoopStressMPa,
    lateralBulgeNorm,
    isPassiveConfinementActive,
    isRuptured,
  };
}

export interface CurvePoint {
  strainPermille: number;
  stressMPa: number;
  loadRatio: number;
}

export function generateStressStrainCurve(
  groupId: GroupId,
  steps = 48,
  salineMode = false,
): CurvePoint[] {
  const pts: CurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const r = i / steps;
    const state = computeStressStrainPoint(groupId, r, salineMode);
    pts.push({
      strainPermille: state.strainPermille,
      stressMPa: state.stressMPa,
      loadRatio: r,
    });
  }
  return pts;
}

export type LayerKey = 'concrete' | 'primer' | 'epoxy' | 'frp1' | 'frp2' | 'topcoat';

export interface ExplodedLayerInfo {
  key: LayerKey;
  label: string;
  specText: string;
  radialOffset: number; // scene units (1 unit = 100mm)
  yOffset: number;
  color: string;
}

/**
 * Tính độ dịch chuyển bóc tách cho từng lớp vật liệu theo tỷ lệ explodeRatio (0..1)
 */
export function computeExplodedLayerOffsets(
  groupId: GroupId,
  explodeRatioRaw: number,
): ExplodedLayerInfo[] {
  const spec = SPECIMEN_GROUPS[groupId];
  const e = Math.max(0, Math.min(1, explodeRatioRaw));

  const layers: ExplodedLayerInfo[] = [
    {
      key: 'concrete',
      label: 'Lõi Bê tông B25',
      specText: 'D = 150 mm · Mài tạo nhám lộ cốt liệu',
      radialOffset: 0,
      yOffset: 0,
      color: '#cbd5e1',
    },
  ];

  if (spec.fiberType === 'NONE') {
    return layers;
  }

  const fiberLabel = spec.fiberType === 'GFRP' ? 'Sợi GFRP' : 'Sợi CFRP';
  const fiberColor = spec.fiberType === 'GFRP' ? '#67e8f9' : '#94a3b8';

  layers.push(
    {
      key: 'primer',
      label: 'Lớp 1 · Primer Epoxy',
      specText: 'Nhựa lót thẩm thấu bề mặt bê tông',
      radialOffset: e * 0.28,
      yOffset: e * 0.24,
      color: '#f59e0b',
    },
    {
      key: 'epoxy',
      label: 'Lớp 2 · Keo Sikadur-330',
      specText: 'Keo nền kết cấu dày 1.2 mm',
      radialOffset: e * 0.58,
      yOffset: e * 0.12,
      color: '#cbd5e1',
    },
    {
      key: 'frp1',
      label: `Lớp 3 · ${fiberLabel} (Lớp 1)`,
      specText: `Phương sợi 90° · tf = ${spec.tfMmPerLayer.toFixed(3)} mm · Nối chồng 150 mm`,
      radialOffset: e * 0.92,
      yOffset: 0,
      color: fiberColor,
    },
  );

  if (spec.layers >= 2) {
    layers.push({
      key: 'frp2',
      label: `Lớp 3 · ${fiberLabel} (Lớp 2)`,
      specText: `Bọc kép 90° · Tổng ρf = ${spec.rhoFPercent.toFixed(2)}%`,
      radialOffset: e * 1.24,
      yOffset: -e * 0.12,
      color: fiberColor,
    });
  }

  layers.push({
    key: 'topcoat',
    label: 'Lớp 4 · Phủ bảo vệ Topcoat',
    specText: 'Kháng tia UV & ion Cl⁻ xâm thực',
    radialOffset: e * (spec.layers >= 2 ? 1.56 : 1.24),
    yOffset: -e * 0.24,
    color: '#fbbf24',
  });

  return layers;
}
