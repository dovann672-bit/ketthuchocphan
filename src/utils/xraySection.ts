import type { GroupId } from './frpData';
import { SPECIMEN_DIMENSIONS, SPECIMEN_GROUPS, computeStressStrainPoint } from './frpData';
import type { ComponentKey } from './specimenTooltip';

export const XRAY_MIN_HEIGHT_MM = 15;
export const XRAY_MAX_HEIGHT_MM = 285;
export const XRAY_DEFAULT_HEIGHT_MM = 150;

export interface XrayLayerBand {
  key: ComponentKey;
  label: string;
  thicknessMm: number;
  thicknessLabel: string;
  innerRadiusMm: number;
  outerRadiusMm: number;
  color: string;
  roleSummary: string;
}

export interface XrayCrossSectionSummary {
  groupId: GroupId;
  cutHeightMm: number;
  yNorm: number; // 0..1
  cutWorldY: number; // world units (1 unit = 100 mm)
  radialBulgeScale: number;
  effectiveDiameterMm: number;
  totalJacketThicknessMm: number;
  hasOverlapAtCut: boolean;
  bands: XrayLayerBand[];
}

export function clampXrayHeightMm(heightMm: number): number {
  if (!Number.isFinite(heightMm)) return XRAY_DEFAULT_HEIGHT_MM;
  return Math.max(XRAY_MIN_HEIGHT_MM, Math.min(XRAY_MAX_HEIGHT_MM, Math.round(heightMm)));
}

/**
 * Tính bảng phân lớp độ dày và bán kính mặt cắt ngang tại cao độ cutHeightMm (15..285 mm)
 */
export function computeXrayCrossSection(
  groupId: GroupId,
  cutHeightMmRaw: number,
  loadRatioRaw = 0,
  salineMode = false,
): XrayCrossSectionSummary {
  const spec = SPECIMEN_GROUPS[groupId];
  const cutHeightMm = clampXrayHeightMm(cutHeightMmRaw);
  const yNorm = cutHeightMm / SPECIMEN_DIMENSIONS.heightMm;
  const loadRatio = Math.max(0, Math.min(1, loadRatioRaw));
  const phys = computeStressStrainPoint(groupId, loadRatio, salineMode);
  const hasFrp = spec.fiberType !== 'NONE';

  const axialSquash = loadRatio * (hasFrp ? 0.052 : 0.025);
  const bulgeAmount = phys.lateralBulgeNorm * (hasFrp ? 0.082 : 0.042);
  const radialBulgeScale = 1 + bulgeAmount * Math.sin(Math.PI * yNorm);

  // Tọa độ Y thực tế trong scene (0..3.0 bị nén quanh tâm y = 1.5)
  const localBy = (yNorm - 0.5) * 3.0;
  const cutWorldY = 1.5 + localBy * (1 - axialSquash);

  const coreR = (SPECIMEN_DIMENSIONS.diameterMm / 2) * radialBulgeScale;
  const bands: XrayLayerBand[] = [
    {
      key: 'concrete',
      label: 'Lõi Bê tông B25',
      thicknessMm: coreR,
      thicknessLabel: `R = ${coreR.toFixed(1)} mm`,
      innerRadiusMm: 0,
      outerRadiusMm: coreR,
      color: '#94a3b8',
      roleSummary: 'Chịu nén dọc trục, mài tạo nhám lộ cốt liệu',
    },
  ];

  let cursorR = coreR;
  let totalJacketThicknessMm = 0;

  if (hasFrp) {
    const primerMm = 0.15;
    bands.push({
      key: 'primer',
      label: 'Lớp 1 · Primer Epoxy',
      thicknessMm: primerMm,
      thicknessLabel: `${primerMm.toFixed(2)} mm`,
      innerRadiusMm: cursorR,
      outerRadiusMm: cursorR + primerMm,
      color: '#f59e0b',
      roleSummary: 'Thẩm thấu mao dẫn, tạo cầu bám dính',
    });
    cursorR += primerMm;
    totalJacketThicknessMm += primerMm;

    const epoxyMm = SPECIMEN_DIMENSIONS.epoxyBaseMm;
    bands.push({
      key: 'epoxy',
      label: 'Lớp 2 · Keo Sikadur-330',
      thicknessMm: epoxyMm,
      thicknessLabel: `${epoxyMm.toFixed(2)} mm`,
      innerRadiusMm: cursorR,
      outerRadiusMm: cursorR + epoxyMm,
      color: '#cbd5e1',
      roleSummary: 'Keo kết cấu truyền ứng suất cắt',
    });
    cursorR += epoxyMm;
    totalJacketThicknessMm += epoxyMm;

    const fiberColor1 = spec.fiberType === 'GFRP' ? '#38bdf8' : '#10b981';
    const tf = spec.tfMmPerLayer;
    bands.push({
      key: 'frp1',
      label: `Lớp 3 · ${spec.fiberType} (Lớp 1)`,
      thicknessMm: tf,
      thicknessLabel: `${tf.toFixed(3)} mm`,
      innerRadiusMm: cursorR,
      outerRadiusMm: cursorR + tf,
      color: fiberColor1,
      roleSummary: 'Sợi đơn hướng 90° bó hông thụ động',
    });
    cursorR += tf;
    totalJacketThicknessMm += tf;

    if (spec.layers >= 2) {
      const fiberColor2 = spec.fiberType === 'GFRP' ? '#22d3ee' : '#34d399';
      bands.push({
        key: 'frp2',
        label: `Lớp 3 · ${spec.fiberType} (Lớp 2)`,
        thicknessMm: tf,
        thicknessLabel: `${tf.toFixed(3)} mm`,
        innerRadiusMm: cursorR,
        outerRadiusMm: cursorR + tf,
        color: fiberColor2,
        roleSummary: `Bọc kép 90° (tổng ρf = ${spec.rhoFPercent.toFixed(2)}%)`,
      });
      cursorR += tf;
      totalJacketThicknessMm += tf;
    }

    const topcoatMm = 0.25;
    bands.push({
      key: 'topcoat',
      label: 'Lớp 4 · Phủ Topcoat',
      thicknessMm: topcoatMm,
      thicknessLabel: `${topcoatMm.toFixed(2)} mm`,
      innerRadiusMm: cursorR,
      outerRadiusMm: cursorR + topcoatMm,
      color: '#fbbf24',
      roleSummary: `Chặn UV & Cl⁻ (Kd = ${spec.kdPercent.toFixed(1)}%)`,
    });
    cursorR += topcoatMm;
    totalJacketThicknessMm += topcoatMm;
  }

  return {
    groupId,
    cutHeightMm,
    yNorm,
    cutWorldY,
    radialBulgeScale,
    effectiveDiameterMm: cursorR * 2,
    totalJacketThicknessMm,
    hasOverlapAtCut: hasFrp,
    bands,
  };
}

export function computeXrayCameraPose(
  cutWorldY: number,
  topDown = false,
): { pos: [number, number, number]; target: [number, number, number] } {
  const safeY = Math.max(0.15, Math.min(2.85, cutWorldY));
  if (topDown) {
    return {
      pos: [0.35, safeY + 2.85, 0.55],
      target: [0, safeY - 0.08, 0],
    };
  }
  return {
    pos: [2.55, safeY + 2.05, 2.75],
    target: [0, Math.max(0.35, safeY - 0.14), 0],
  };
}
