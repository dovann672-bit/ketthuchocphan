import type { GroupId } from './frpData';
import { SPECIMEN_DIMENSIONS, SPECIMEN_GROUPS, computeStressStrainPoint } from './frpData';

export type ComponentKey =
  | 'concrete'
  | 'primer'
  | 'epoxy'
  | 'frp1'
  | 'frp2'
  | 'topcoat'
  | 'platen';

export interface TooltipMetric {
  label: string;
  value: string;
}

export interface SpecimenTooltipData {
  key: ComponentKey;
  badge: string;
  title: string;
  accentColor: string;
  isOverlapZone: boolean;
  metrics: TooltipMetric[];
  technicalRole: string;
  assemblyHint: string | null;
}

export interface HoverHitCandidate {
  componentKey: ComponentKey;
  isOverlapZone: boolean;
  distance: number;
}

export interface TooltipPosition {
  left: number;
  top: number;
}

/**
 * Chọn thành phần thông minh từ danh sách va chạm Raycaster:
 * - Ở chế độ bóc tách (> 8%), chọn chính xác lớp nằm ngoài cùng tại con trỏ.
 * - Ở chế độ lắp ghép (<= 8%), ưu tiên lớp sợi FRP bên dưới lớp phủ Topcoat trong mờ
 *   để người dùng thấy ngay thông số sợi GFRP/CFRP khi rê vào thân trụ.
 */
export function selectHoveredComponent(
  hits: HoverHitCandidate[],
  explodeValue: number,
  groupId: GroupId,
): HoverHitCandidate | null {
  if (hits.length === 0) return null;

  const first = hits[0];
  const hasFrp = SPECIMEN_GROUPS[groupId].fiberType !== 'NONE';

  if (explodeValue <= 0.08 && hasFrp && first.componentKey === 'topcoat') {
    const underlyingFrp = hits.find(
      (h) =>
        (h.componentKey === 'frp2' || h.componentKey === 'frp1') &&
        h.distance - first.distance < 0.25,
    );
    if (underlyingFrp) {
      return underlyingFrp;
    }
  }

  return first;
}

/**
 * Tạo dữ liệu chú giải kỹ thuật cho từng thành phần của mẫu trụ 3D
 */
export function buildSpecimenTooltipData(params: {
  componentKey: ComponentKey;
  groupId: GroupId;
  loadRatio: number;
  salineMode: boolean;
  explodeValue: number;
  isOverlapZone?: boolean;
}): SpecimenTooltipData {
  const {
    componentKey,
    groupId,
    loadRatio,
    salineMode,
    explodeValue,
    isOverlapZone = false,
  } = params;

  const spec = SPECIMEN_GROUPS[groupId];
  const hasFrp = spec.fiberType !== 'NONE';
  const phys = computeStressStrainPoint(groupId, loadRatio, salineMode);
  const assembledHint =
    hasFrp && explodeValue <= 0.08
      ? 'Mẹo: Kéo thanh "Bóc tách lớp" để rê chuột vào từng lớp Primer, Sikadur-330 và Topcoat.'
      : null;

  switch (componentKey) {
    case 'concrete': {
      const effectiveFcc = salineMode ? spec.fccMPa * (spec.kdPercent / 100) : spec.fccMPa;
      return {
        key: 'concrete',
        badge: hasFrp ? 'LÕI CHỊU NÉN B25' : 'MẪU ĐỐI CHỨNG M0',
        title: 'Lõi Bê tông B25 (Mài tạo nhám lộ cốt liệu)',
        accentColor: '#cbd5e1',
        isOverlapZone: false,
        metrics: [
          { label: 'Kích thước mẫu', value: `D=${SPECIMEN_DIMENSIONS.diameterMm} × H=${SPECIMEN_DIMENSIONS.heightMm} mm` },
          { label: 'Mô đun Ec', value: `${spec.ecGPa.toFixed(1)} GPa` },
          { label: 'Kéo gián tiếp fct', value: `${spec.fctMPa.toFixed(2)} MPa` },
          {
            label: loadRatio > 0.01 ? 'Ứng suất hiện tại' : "Cường độ f'cc",
            value:
              loadRatio > 0.01
                ? `${phys.stressMPa.toFixed(1)} MPa (${phys.axialLoadKN.toFixed(0)} kN)`
                : `${effectiveFcc.toFixed(1)} MPa`,
          },
        ],
        technicalRole: hasFrp
          ? 'Chịu tải nén dọc trục chính; bề mặt mài lộ cốt liệu tăng lực bám dính cơ học. Khi tải > 70%, lõi bê tông phình ngang kích hoạt hiệu ứng bó hông thụ động từ áo FRP.'
          : 'Mẫu đối chứng B25 không bọc FRP (Kd = 81.5% sau 60 ngày xâm thực). Thiếu lực bó hông nên phá hoại nứt cắt chéo 45° giòn tại đỉnh tải.',
        assemblyHint: null,
      };
    }

    case 'primer': {
      const tauText = spec.tauB_MPa !== null ? `${spec.tauB_MPa.toFixed(2)} MPa` : 'N/A';
      return {
        key: 'primer',
        badge: 'LỚP 1 · EPOXY LÓT',
        title: 'Lớp 1 · Primer Epoxy thẩm thấu',
        accentColor: '#f59e0b',
        isOverlapZone: false,
        metrics: [
          { label: 'Độ bám dính τb', value: tauText },
          { label: 'Độ nhớt', value: 'Thấp (nhựa 2 thành phần)' },
          { label: 'Nền liên kết', value: 'Bê tông B25 tạo nhám' },
          { label: 'Trạng thái Cl⁻', value: salineMode ? 'Ngăn mao dẫn Cl⁻' : 'Ổn định hóa học' },
        ],
        technicalRole:
          'Thẩm thấu sâu vào hệ lỗ rỗng mao dẫn bề mặt bê tông B25, khóa bụi xi măng và tạo cầu nối bám dính hóa học cho lớp keo nền kết cấu Sikadur-330.',
        assemblyHint: null,
      };
    }

    case 'epoxy': {
      const tauText = spec.tauB_MPa !== null ? `${spec.tauB_MPa.toFixed(2)} MPa` : 'N/A';
      return {
        key: 'epoxy',
        badge: 'LỚP 2 · EPOXY KẾT CẤU',
        title: 'Lớp 2 · Keo kết cấu Sikadur-330',
        accentColor: '#94a3b8',
        isOverlapZone: false,
        metrics: [
          { label: 'Chiều dày lớp', value: `${SPECIMEN_DIMENSIONS.epoxyBaseMm.toFixed(1)} mm` },
          { label: 'Ứng suất cắt τb', value: tauText },
          { label: 'Cường độ kéo keo', value: '~30.0 MPa' },
          { label: 'Chế độ làm việc', value: 'Truyền ứng suất cắt' },
        ],
        technicalRole:
          'Lớp keo nền dày 1.2 mm lấp đầy khuyết tật bề mặt, tẩm ướt hoàn toàn sợi FRP và truyền ứng suất cắt đồng đều giữa lõi B25 với áo bó sợi.',
        assemblyHint: null,
      };
    }

    case 'frp1':
    case 'frp2': {
      const layerNum = componentKey === 'frp2' && spec.layers >= 2 ? 2 : 1;
      const fiberName = spec.fiberType === 'GFRP' ? 'GFRP (Sợi thủy tinh)' : 'CFRP (Sợi carbon)';
      const fiberColor = spec.fiberType === 'GFRP' ? '#38bdf8' : '#10b981';
      return {
        key: componentKey,
        badge: `${spec.fiberType} · PHƯƠNG SỢI 90°`,
        title: `Lớp 3 · ${fiberName} (Lớp ${layerNum}/${Math.max(1, spec.layers)})`,
        accentColor: fiberColor,
        isOverlapZone,
        metrics: [
          { label: 'Chiều dày tf / lớp', value: `${spec.tfMmPerLayer.toFixed(3)} mm` },
          { label: 'Hàm lượng sợi ρf', value: `${spec.rhoFPercent.toFixed(2)}%` },
          { label: 'Nối chồng / f\'cc', value: `${SPECIMEN_DIMENSIONS.overlapMm} mm · ${spec.fccMPa.toFixed(1)} MPa` },
          {
            label: phys.isPassiveConfinementActive ? 'Kéo vòng σ_h' : 'Tăng cường độ',
            value: phys.isPassiveConfinementActive
              ? `${phys.hoopStressMPa.toFixed(0)} MPa (Đang bó)`
              : `+${spec.deltaFccPct.toFixed(1)}% vs M0`,
          },
        ],
        technicalRole: isOverlapZone
          ? `Vùng nối chồng 150 mm đảm bảo truyền lực kéo vòng liên tục qua keo Sikadur-330, ngăn tuột mối nối khi áo ${spec.fiberType} chịu bó hông ở tải cao.`
          : `Sợi ${spec.fiberType} định hướng 90° vuông góc trục nén tạo ứng suất bó hông thụ động, nâng cường độ đạt ${spec.fccMPa.toFixed(1)} MPa và biến dạng cực hạn εccu = ${spec.eccuPermille.toFixed(2)}‰.`,
        assemblyHint: assembledHint,
      };
    }

    case 'topcoat': {
      return {
        key: 'topcoat',
        badge: 'LỚP 4 · PHỦ BẢO VỆ',
        title: 'Lớp 4 · Phủ bảo vệ Topcoat Epoxy',
        accentColor: '#fbbf24',
        isOverlapZone: false,
        metrics: [
          { label: 'Hệ số độ bền Kd', value: `${spec.kdPercent.toFixed(1)}%` },
          { label: 'Chu kỳ ngâm mẫu', value: '60 ngày (NaCl/Kiềm)' },
          { label: 'Cơ chế chống thấm', value: salineMode ? 'Đang chặn ion Cl⁻' : 'Kháng UV & Cl⁻' },
          { label: 'Tổ hợp bảo vệ', value: `${spec.id} · ${spec.layers} lớp ${spec.fiberType}` },
        ],
        technicalRole: `Màng phủ Epoxy ngoài cùng ngăn tia UV, độ ẩm và ion Cl⁻ xâm thực vào lõi bê tông và lớp sợi, giữ hệ số duy trì độ bền Kd = ${spec.kdPercent.toFixed(1)}%.`,
        assemblyHint: null,
      };
    }

    case 'platen': {
      return {
        key: 'platen',
        badge: 'THIẾT BỊ GIA TẢI',
        title: 'Mâm nén thủy lực 2.000 kN',
        accentColor: '#60a5fa',
        isOverlapZone: false,
        metrics: [
          { label: 'Tải định mức', value: `${SPECIMEN_DIMENSIONS.maxPlatenCapacityKN.toLocaleString('vi-VN')} kN` },
          { label: 'Tải đang đặt', value: `${phys.axialLoadKN.toFixed(0)} kN (${Math.round(loadRatio * 100)}%)` },
          { label: 'Độ lệch tâm', value: 'Khớp cầu tự lựa tâm' },
          { label: 'Đường kính mặt ép', value: 'D = 220 mm (Thép tôi)' },
        ],
        technicalRole:
          'Truyền lực nén dọc trục phân bố đều lên tiết diện trụ D = 150 mm thông qua khớp cầu tự lựa tâm, triệt tiêu mô-men uốn ký sinh khi gia tải.',
        assemblyHint: null,
      };
    }
  }
}

/**
 * Tính vị trí hiển thị tooltip thông minh sao cho không bị tràn mép màn hình,
 * không đè lên header trên cùng và né bảng điều khiển phía dưới.
 */
export function computeSmartTooltipPosition(params: {
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  tooltipWidth?: number;
  tooltipHeight?: number;
  dockCollapsed?: boolean;
}): TooltipPosition {
  const {
    pointerX,
    pointerY,
    viewportWidth,
    viewportHeight,
    tooltipWidth = 316,
    tooltipHeight = 205,
    dockCollapsed = false,
  } = params;

  const margin = 16;
  const topSafe = 78;
  const bottomSafe = dockCollapsed
    ? viewportHeight - 58
    : Math.max(topSafe + tooltipHeight + 16, viewportHeight - 305);

  let left = pointerX + 18;
  if (left + tooltipWidth > viewportWidth - margin) {
    left = pointerX - tooltipWidth - 18;
  }
  left = Math.max(margin, Math.min(left, viewportWidth - tooltipWidth - margin));

  let top = pointerY + 16;
  if (top + tooltipHeight > bottomSafe) {
    top = pointerY - tooltipHeight - 16;
  }
  top = Math.max(topSafe, Math.min(top, viewportHeight - tooltipHeight - margin));

  return {
    left: Math.round(left),
    top: Math.round(top),
  };
}
