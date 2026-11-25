import {
  GROUP_ORDER,
  SPECIMEN_DIMENSIONS,
  SPECIMEN_GROUPS,
  computeStressStrainPoint,
  generateStressStrainCurve,
  type CurvePoint,
  type GroupId,
  type SpecimenGroupSpec,
  type StressStrainState,
} from './frpData';

export interface PdfComparisonRow {
  spec: SpecimenGroupSpec;
  effectiveFccMPa: number;
  isSelected: boolean;
}

export interface PdfReportData {
  researchTitle: string;
  generatedAtIso: string;
  generatedAtDisplay: string;
  spec: SpecimenGroupSpec;
  dimensions: typeof SPECIMEN_DIMENSIONS;
  salineMode: boolean;
  environmentLabel: string;
  effectiveFccMPa: number;
  deltaEffectiveFccPct: number;
  fctIncreasePct: number;
  strainMultiplierVsM0: number;
  liveState: StressStrainState;
  activeCurve: CurvePoint[];
  dryCurve: CurvePoint[];
  m0Curve: CurvePoint[];
  comparisonRows: PdfComparisonRow[];
}

export function buildPdfFilename(
  groupId: GroupId,
  salineMode: boolean,
  date: Date = new Date(),
): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const envTag = salineMode ? '_NaCl60d' : '';
  return `Bao_cao_FRP_${groupId}${envTag}_${yyyy}-${mm}-${dd}.pdf`;
}

export function formatReportTimestamp(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function buildPdfReportData(
  groupId: GroupId,
  loadRatio: number,
  salineMode: boolean,
  generatedAt: Date = new Date(),
): PdfReportData {
  const spec = SPECIMEN_GROUPS[groupId];
  const m0 = SPECIMEN_GROUPS.M0;
  const effectiveFccMPa = salineMode
    ? Number((spec.fccMPa * (spec.kdPercent / 100)).toFixed(2))
    : spec.fccMPa;
  const m0EffectiveFcc = salineMode
    ? m0.fccMPa * (m0.kdPercent / 100)
    : m0.fccMPa;

  const deltaEffectiveFccPct =
    groupId === 'M0'
      ? 0
      : Number((((effectiveFccMPa - m0EffectiveFcc) / m0EffectiveFcc) * 100).toFixed(1));

  const fctIncreasePct =
    groupId === 'M0'
      ? 0
      : Number((((spec.fctMPa - m0.fctMPa) / m0.fctMPa) * 100).toFixed(1));

  const strainMultiplierVsM0 = Number((spec.eccuPermille / m0.eccuPermille).toFixed(2));

  const liveState = computeStressStrainPoint(groupId, loadRatio, salineMode);
  const activeCurve = generateStressStrainCurve(groupId, 60, salineMode);
  const dryCurve = generateStressStrainCurve(groupId, 60, false);
  const m0Curve = generateStressStrainCurve('M0', 48, salineMode);

  const comparisonRows: PdfComparisonRow[] = GROUP_ORDER.map((id) => {
    const rowSpec = SPECIMEN_GROUPS[id];
    const rowEff = salineMode
      ? Number((rowSpec.fccMPa * (rowSpec.kdPercent / 100)).toFixed(1))
      : rowSpec.fccMPa;
    return {
      spec: rowSpec,
      effectiveFccMPa: rowEff,
      isSelected: id === groupId,
    };
  });

  return {
    researchTitle:
      'Nghiên cứu thực nghiệm so sánh các chỉ tiêu cường độ và độ bền của kết cấu bê tông cốt thép gia cường bằng vật liệu nhựa cường độ cao (FRP)',
    generatedAtIso: generatedAt.toISOString(),
    generatedAtDisplay: formatReportTimestamp(generatedAt),
    spec,
    dimensions: SPECIMEN_DIMENSIONS,
    salineMode,
    environmentLabel: salineMode
      ? 'Xâm thực NaCl 3.5% / Kiềm (60 ngày)'
      : 'Điều kiện tiêu chuẩn (Khô ráo)',
    effectiveFccMPa,
    deltaEffectiveFccPct,
    fctIncreasePct,
    strainMultiplierVsM0,
    liveState,
    activeCurve,
    dryCurve,
    m0Curve,
    comparisonRows,
  };
}
