import {
  SPECIMEN_DIMENSIONS,
  SPECIMEN_GROUPS,
  computeStressStrainPoint,
  type GroupId,
} from './frpData';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface CrackInspectionReport {
  groupId: GroupId;
  heightMm: number;
  azimuthDeg: number;
  inOverlapZone: boolean;
  zoneLabel: string;
  failureTitle: string;
  mechanismDetail: string;
  crackAngleLabel: string;
  estimatedCrackWidthMm: number;
  hoopStrainPermille: number;
  localStressMPa: number;
  hoopStressMPa: number;
  severity: 'elastic' | 'confinement' | 'rupture';
}

const OVERLAP_START_RAD = -0.35;
const OVERLAP_END_RAD = 1.65;

export function computeCrackInspectionReport(params: {
  groupId: GroupId;
  loadRatio: number;
  salineMode: boolean;
  hitPoint: Vec3Like;
}): CrackInspectionReport {
  const { groupId, loadRatio, salineMode, hitPoint } = params;
  const spec = SPECIMEN_GROUPS[groupId];
  const state = computeStressStrainPoint(groupId, loadRatio, salineMode);

  const heightMm = Math.max(
    0,
    Math.min(SPECIMEN_DIMENSIONS.heightMm, Math.round(hitPoint.y * 100)),
  );

  // Góc phương vị theo hệ tọa độ Three.js CylinderGeometry (theta=0 hướng +Z, tăng về +X)
  const rawAngle = Math.atan2(hitPoint.x, hitPoint.z);
  const azimuthDeg = Math.round(((rawAngle * 180) / Math.PI + 360) % 360);

  const inOverlapZone =
    spec.fiberType !== 'NONE' &&
    rawAngle >= OVERLAP_START_RAD &&
    rawAngle <= OVERLAP_END_RAD;

  const zoneLabel =
    heightMm >= 95 && heightMm <= 205
      ? 'Vùng giữa thân trụ (tập trung phình ngang & ứng suất cực đại)'
      : heightMm > 205
        ? 'Vùng 1/3 trên gần mâm nén'
        : 'Vùng 1/3 dưới gần bệ truyền lực';

  const hasFrp = spec.fiberType !== 'NONE';
  const isRupture = state.isRuptured;
  const isConfinement = hasFrp && state.isPassiveConfinementActive;

  let severity: CrackInspectionReport['severity'] = 'elastic';
  if (isRupture) severity = 'rupture';
  else if (isConfinement || (!hasFrp && loadRatio >= 0.65)) severity = 'confinement';

  let failureTitle: string;
  let mechanismDetail: string;
  let crackAngleLabel: string;
  let estimatedCrackWidthMm: number;
  let hoopStrainPermille: number;

  if (!hasFrp) {
    crackAngleLabel = '~45° (vết nứt cắt chéo)';
    hoopStrainPermille = Number((loadRatio * 1.15).toFixed(2));
    if (isRupture) {
      failureTitle = 'Phá hoại nứt cắt chéo 45° & tách vỡ bê tông B25';
      mechanismDetail =
        'Không có lớp FRP bó hông, ứng suất kéo chính vượt cường độ fct = 2.45 MPa gây khe nứt cắt xuyên thân trụ.';
      estimatedCrackWidthMm = 3.2;
    } else if (loadRatio >= 0.65) {
      failureTitle = 'Phát triển vi nứt cắt – tách dọc thân trụ';
      mechanismDetail =
        'Lõi bê tông bắt đầu giãn nở thể tích không ổn định trước khi đạt tải đỉnh 25.4 MPa.';
      estimatedCrackWidthMm = Number((0.18 + ((loadRatio - 0.65) / 0.35) * 0.95).toFixed(2));
    } else {
      failureTitle = 'Giai đoạn nén đàn hồi (<65% tải đỉnh)';
      mechanismDetail =
        'Ứng suất nén nằm trong miền ổn định, chưa hình thành khe nứt cắt vĩ mô trên bề mặt.';
      estimatedCrackWidthMm = Number((loadRatio * 0.04).toFixed(2));
    }
  } else {
    crackAngleLabel = '0° ngang (đứt sợi vuông góc tải nén)';
    const maxHoopStrain = spec.fiberType === 'CFRP' ? 11.8 : 18.4;
    const maxHoopMPa = spec.fiberType === 'CFRP' ? 1450 : 680;
    hoopStrainPermille = Number(
      ((state.hoopStressMPa / maxHoopMPa) * maxHoopStrain).toFixed(2),
    );

    if (isRupture) {
      failureTitle = inOverlapZone
        ? `Nổ giòn đứt sợi ${spec.fiberType} sát vùng nối chồng 150 mm`
        : `Nổ giòn đứt sợi ${spec.fiberType} theo phương ngang`;
      mechanismDetail = `Biến dạng ngang đạt giới hạn đứt sợi (${hoopStrainPermille.toFixed(1)}‰), giải phóng năng lượng tức thời tại lõi B25 đang chịu nén ${state.stressMPa.toFixed(1)} MPa.`;
      estimatedCrackWidthMm = spec.fiberType === 'CFRP' ? 1.85 : 2.35;
    } else if (isConfinement) {
      failureTitle = `Hiệu ứng bó hông sợi ${spec.fiberType} đang kiềm chế vết nứt`;
      mechanismDetail =
        'Áo FRP chịu kéo vòng kiềm chế vi nứt bê tông bên trong, hạn chế bề rộng khe nứt ở mức vi mô.';
      estimatedCrackWidthMm = Number((0.06 + ((loadRatio - 0.7) / 0.3) * 0.24).toFixed(2));
    } else {
      failureTitle = 'Vùng đàn hồi — lớp keo Sikadur-330 & FRP bám dính tốt';
      mechanismDetail =
        'Chưa kích hoạt bó hông thụ động (>70% tải); bề mặt sợi và lớp phủ Topcoat còn nguyên vẹn.';
      estimatedCrackWidthMm = 0.02;
    }
  }

  return {
    groupId,
    heightMm,
    azimuthDeg,
    inOverlapZone,
    zoneLabel,
    failureTitle,
    mechanismDetail,
    crackAngleLabel,
    estimatedCrackWidthMm,
    hoopStrainPermille,
    localStressMPa: Number(state.stressMPa.toFixed(1)),
    hoopStressMPa: Number(state.hoopStressMPa.toFixed(0)),
    severity,
  };
}

export function computeCrackCameraPose(
  hitPoint: Vec3Like,
  outwardNormal: Vec3Like,
  zoomDistance = 1.52,
): { pos: Vec3Like; target: Vec3Like } {
  const len = Math.hypot(outwardNormal.x, outwardNormal.y, outwardNormal.z) || 1;
  // Giữ hướng nhìn chủ yếu theo phương ngang để bám sát mặt trụ
  let nx = outwardNormal.x / len;
  let nz = outwardNormal.z / len;
  const horiz = Math.hypot(nx, nz);
  if (horiz < 0.2) {
    const rLen = Math.hypot(hitPoint.x, hitPoint.z) || 1;
    nx = hitPoint.x / rLen;
    nz = hitPoint.z / rLen;
  } else {
    nx /= horiz;
    nz /= horiz;
  }

  const targetY = Math.max(0.32, Math.min(2.68, hitPoint.y));
  const target: Vec3Like = {
    x: hitPoint.x * 0.85,
    y: targetY,
    z: hitPoint.z * 0.85,
  };

  const pos: Vec3Like = {
    x: hitPoint.x + nx * zoomDistance,
    y: Math.max(0.45, Math.min(2.95, targetY + 0.14)),
    z: hitPoint.z + nz * zoomDistance,
  };

  return { pos, target };
}
