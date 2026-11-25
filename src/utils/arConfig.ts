import type { GroupId } from './frpData';
import { SPECIMEN_DIMENSIONS, SPECIMEN_GROUPS } from './frpData';

/**
 * Tỷ lệ quy đổi từ không gian mô phỏng (1 đơn vị = 100 mm) sang không gian thực tế WebXR (1 đơn vị = 1 mét).
 * D = 1.50 đơn vị -> 0.15 m (150 mm), H = 3.00 đơn vị -> 0.30 m (300 mm).
 */
export const AR_PHYSICAL_SCALE = 0.1;

/**
 * Độ cao bù đáy bệ mâm nén dưới (-0.70 đơn vị) để đặt khít lên mặt phẳng thực tế (y = 0 m).
 */
export const AR_BASE_PEDESTAL_OFFSET_M = 0.07;

export type ArSupportState =
  | 'checking'
  | 'supported'
  | 'unsupported'
  | 'insecure-context';

export interface ArPhysicalDimensions {
  diameterM: number;
  heightM: number;
  overlapArcM: number;
  reticleInnerRadiusM: number;
  reticleOuterRadiusM: number;
  totalFrpThicknessMm: number;
}

export function computeArDimensionsMeters(groupId: GroupId): ArPhysicalDimensions {
  const spec = SPECIMEN_GROUPS[groupId];
  const diameterM = SPECIMEN_DIMENSIONS.diameterMm / 1000;
  const heightM = SPECIMEN_DIMENSIONS.heightMm / 1000;
  const overlapArcM = SPECIMEN_DIMENSIONS.overlapMm / 1000;
  const radiusM = diameterM / 2;

  return {
    diameterM,
    heightM,
    overlapArcM,
    reticleInnerRadiusM: radiusM,
    reticleOuterRadiusM: radiusM + 0.015,
    totalFrpThicknessMm: Number((spec.layers * spec.tfMmPerLayer).toFixed(3)),
  };
}

export function getArCapabilitySummary(state: ArSupportState): {
  canLaunchWebXR: boolean;
  title: string;
  detail: string;
} {
  switch (state) {
    case 'supported':
      return {
        canLaunchWebXR: true,
        title: 'Thiết bị hỗ trợ WebXR AR (1:1)',
        detail:
          'Hướng camera xuống mặt bàn hoặc sàn phẳng để nhận diện bề mặt và đặt mẫu trụ D = 150 mm × H = 300 mm đúng kích thước thật.',
      };
    case 'insecure-context':
      return {
        canLaunchWebXR: false,
        title: 'Yêu cầu kết nối HTTPS cho WebXR',
        detail:
          'WebXR API chỉ hoạt động trên môi trường HTTPS bảo mật. Hãy mở liên kết ứng dụng trên thiết bị di động hỗ trợ ARCore qua HTTPS.',
      };
    case 'checking':
      return {
        canLaunchWebXR: false,
        title: 'Đang kiểm tra khả năng WebXR...',
        detail: 'Đang kiểm tra hỗ trợ immersive-ar trên trình duyệt.',
      };
    case 'unsupported':
    default:
      return {
        canLaunchWebXR: false,
        title: 'Trình duyệt hiện tại chưa hỗ trợ WebXR AR',
        detail:
          'Thiết bị desktop hoặc trình duyệt hiện tại không có phiên immersive-ar. Bạn có thể bật chế độ Lưới thước chuẩn 1:1 ngay trên màn hình hoặc mở link trên điện thoại Android (Chrome + ARCore).',
      };
  }
}
