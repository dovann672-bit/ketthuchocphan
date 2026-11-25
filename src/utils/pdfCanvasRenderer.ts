import { jsPDF } from 'jspdf';
import type { GroupId } from './frpData';
import { buildPdfFilename, type PdfReportData } from './pdfReport';

export interface PdfRenderOptions {
  includeBenchmarkTable: boolean;
}

export const A4_CANVAS_WIDTH = 1240;
export const A4_CANVAS_HEIGHT = 1754;

const PRINT_CURVE_COLORS: Record<GroupId, string> = {
  M0: '#475569',
  G1: '#0284c7',
  G2: '#0891b2',
  C1: '#d97706',
  C2: '#059669',
};

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function renderReportToCanvas(
  canvas: HTMLCanvasElement,
  data: PdfReportData,
  options: PdfRenderOptions,
): void {
  canvas.width = A4_CANVAS_WIDTH;
  canvas.height = A4_CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = A4_CANVAS_WIDTH;
  const H = A4_CANVAS_HEIGHT;
  const marginX = 68;
  const contentW = W - marginX * 2;
  const sans = '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif';
  const mono = '"JetBrains Mono", "Consolas", monospace';
  const curveHex = PRINT_CURVE_COLORS[data.spec.id];

  // Nền giấy trắng chuẩn in ấn kỹ thuật
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // --- HEADER BANNER ---
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, W, 186);

  ctx.fillStyle = curveHex;
  ctx.fillRect(0, 0, 14, 186);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 16px ${sans}`;
  ctx.fillText('BÁO CÁO TÓM TẮT KẾT QUẢ THỰC NGHIỆM KẾT CẤU FRP', marginX, 42);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 22px ${sans}`;
  const titleLines = wrapLines(ctx, data.researchTitle, contentW - 250);
  titleLines.slice(0, 3).forEach((line, idx) => {
    ctx.fillText(line, marginX, 78 + idx * 30);
  });

  // Hộp mã tổ hợp bên phải header
  const badgeW = 220;
  const badgeX = W - marginX - badgeW;
  drawRoundedRect(ctx, badgeX, 32, badgeW, 118, 10);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = curveHex;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `600 14px ${sans}`;
  ctx.textAlign = 'center';
  ctx.fillText('TỔ HỢP ĐƯỢC CHỌN', badgeX + badgeW / 2, 58);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 32px ${mono}`;
  ctx.fillText(data.spec.id, badgeX + badgeW / 2, 98);

  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 14px ${mono}`;
  ctx.fillText(data.generatedAtDisplay, badgeX + badgeW / 2, 130);
  ctx.textAlign = 'left';

  // --- SECTION 1: THÔNG SỐ MẪU THỬ & TRẠNG THÁI THÍ NGHIỆM ---
  let curY = 218;
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 19px ${sans}`;
  ctx.fillText('1. THÔNG SỐ MẪU THỬ & ĐIỀU KIỆN THÍ NGHIỆM', marginX, curY);

  curY += 16;
  const boxH = 128;
  const halfW = (contentW - 20) / 2;

  // Khung trái: Hình học & Vật liệu
  drawRoundedRect(ctx, marginX, curY, halfW, boxH, 8);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = `700 15px ${sans}`;
  ctx.fillText('Cấu tạo mẫu trụ B25 & Gia cường', marginX + 18, curY + 28);

  ctx.fillStyle = '#0f172a';
  ctx.font = `500 15px ${sans}`;
  ctx.fillText(data.spec.name, marginX + 18, curY + 56);
  ctx.fillStyle = '#475569';
  ctx.font = `400 14px ${sans}`;
  ctx.fillText(
    `Kích thước: D = ${data.dimensions.diameterMm} mm · H = ${data.dimensions.heightMm} mm`,
    marginX + 18,
    curY + 82,
  );
  ctx.fillText(
    `Nối chồng: ${data.dimensions.overlapMm} mm · Keo Sikadur-330: ${data.dimensions.epoxyBaseMm} mm`,
    marginX + 18,
    curY + 106,
  );

  // Khung phải: Trạng thái tải & Môi trường
  const rightX = marginX + halfW + 20;
  drawRoundedRect(ctx, rightX, curY, halfW, boxH, 8);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = `700 15px ${sans}`;
  ctx.fillText('Trạng thái mô phỏng tại thời điểm xuất', rightX + 18, curY + 28);

  ctx.fillStyle = data.salineMode ? '#0f766e' : '#0f172a';
  ctx.font = `600 15px ${sans}`;
  ctx.fillText(`Môi trường: ${data.environmentLabel}`, rightX + 18, curY + 56);

  ctx.fillStyle = '#475569';
  ctx.font = `500 14px ${mono}`;
  ctx.fillText(
    `Tải nén: ${Math.round(data.liveState.loadRatio * 100)}% (${data.liveState.axialLoadKN.toFixed(1)} / ${data.dimensions.maxPlatenCapacityKN} kN)`,
    rightX + 18,
    curY + 82,
  );
  ctx.fillText(
    `σ = ${data.liveState.stressMPa.toFixed(1)} MPa · ε = ${data.liveState.strainPermille.toFixed(2)}‰ · σ_vòng = ${data.liveState.hoopStressMPa.toFixed(0)} MPa`,
    rightX + 18,
    curY + 106,
  );

  // --- SECTION 2: CHỈ TIÊU CƠ HỌC & ĐỘ BỀN ---
  curY += boxH + 38;
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 19px ${sans}`;
  ctx.fillText('2. CHỈ TIÊU CƠ HỌC & ĐỘ BỀN CỦA TỔ HỢP ĐƯỢC CHỌN', marginX, curY);

  curY += 16;
  const cols = 4;
  const gap = 14;
  const cardW = (contentW - gap * (cols - 1)) / cols;
  const cardH = 88;

  const cards: Array<{ label: string; value: string; sub: string; accent?: string }> = [
    {
      label: data.salineMode ? "Cường độ còn lại f'cc" : "Cường độ nén f'cc",
      value: `${data.effectiveFccMPa.toFixed(1)} MPa`,
      sub:
        data.deltaEffectiveFccPct > 0
          ? `+${data.deltaEffectiveFccPct.toFixed(1)}% so với M0`
          : 'Mẫu đối chứng M0',
      accent: data.deltaEffectiveFccPct > 0 ? '#059669' : '#475569',
    },
    {
      label: 'Biến dạng cực hạn εccu',
      value: `${data.spec.eccuPermille.toFixed(2)} ‰`,
      sub: `${data.strainMultiplierVsM0.toFixed(1)}× so với M0`,
    },
    {
      label: 'Kéo gián tiếp fct',
      value: `${data.spec.fctMPa.toFixed(2)} MPa`,
      sub: data.fctIncreasePct > 0 ? `+${data.fctIncreasePct.toFixed(1)}% so với M0` : 'Chuẩn B25',
    },
    {
      label: 'Mô đun đàn hồi Ec',
      value: `${data.spec.ecGPa.toFixed(1)} GPa`,
      sub: `Bọc hướng 90°`,
    },
    {
      label: 'Hàm lượng sợi ρf',
      value: `${data.spec.rhoFPercent.toFixed(2)}%`,
      sub:
        data.spec.layers > 0
          ? `${data.spec.layers} lớp ${data.spec.fiberType} (tf = ${data.spec.tfMmPerLayer} mm)`
          : 'Không bọc FRP',
    },
    {
      label: 'Ứng suất bám dính τb',
      value: data.spec.tauB_MPa !== null ? `${data.spec.tauB_MPa.toFixed(2)} MPa` : 'N/A',
      sub: 'Lớp keo nền Sikadur-330',
    },
    {
      label: 'Hệ số độ bền Kd (60d)',
      value: `${data.spec.kdPercent.toFixed(1)}%`,
      sub: data.spec.kdPercent >= 94 ? 'Kháng ion Cl⁻ tốt' : 'Suy giảm bề mặt M0',
      accent: data.spec.kdPercent >= 94 ? '#0f766e' : '#d97706',
    },
    {
      label: 'Trạng thái bó hông',
      value: data.liveState.isRuptured
        ? data.spec.fiberType === 'NONE'
          ? 'Nứt cắt 45°'
          : 'Đứt sợi 100%'
        : data.liveState.isPassiveConfinementActive
          ? 'Đang bó hông'
          : 'Đàn hồi',
      sub:
        data.spec.fiberType === 'NONE'
          ? 'Không có áo bó FRP'
          : 'Kích hoạt bó hông >70% tải',
    },
  ];

  cards.forEach((c, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = marginX + col * (cardW + gap);
    const cy = curY + row * (cardH + gap);

    drawRoundedRect(ctx, cx, cy, cardW, cardH, 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = `600 13px ${sans}`;
    ctx.fillText(c.label, cx + 14, cy + 24);

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 21px ${mono}`;
    ctx.fillText(c.value, cx + 14, cy + 54);

    ctx.fillStyle = c.accent || '#64748b';
    ctx.font = `600 12.5px ${sans}`;
    ctx.fillText(c.sub, cx + 14, cy + 75);
  });

  // --- SECTION 3: BIỂU ĐỒ ỨNG SUẤT – BIẾN DẠNG (σ – ε) ---
  curY += cardH * 2 + gap + 42;
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 19px ${sans}`;
  ctx.fillText('3. BIỂU ĐỒ QUAN HỆ ỨNG SUẤT – BIẾN DẠNG (σ – ε)', marginX, curY);

  curY += 16;
  const chartBoxW = contentW;
  const chartBoxH = 448;
  drawRoundedRect(ctx, marginX, curY, chartBoxW, chartBoxH, 10);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const padL = 82;
  const padR = 36;
  const padT = 54;
  const padB = 56;
  const plotX = marginX + padL;
  const plotY = curY + padT;
  const plotW = chartBoxW - padL - padR;
  const plotH = chartBoxH - padT - padB;

  const maxStrain = 10.0;
  const maxStress = 55.0;
  const toX = (eps: number) => plotX + (eps / maxStrain) * plotW;
  const toY = (sig: number) => plotY + plotH - (sig / maxStress) * plotH;

  // Vùng bó hông thụ động (Tải > 70%) cho nhóm FRP
  if (data.spec.fiberType !== 'NONE') {
    const cx1 = toX(0.7 * data.spec.eccuPermille);
    const cx2 = toX(data.spec.eccuPermille);
    ctx.fillStyle = 'rgba(14, 165, 233, 0.11)';
    ctx.fillRect(cx1, plotY, Math.max(0, cx2 - cx1), plotH);

    ctx.fillStyle = '#0369a1';
    ctx.font = `600 13px ${sans}`;
    ctx.textAlign = 'center';
    ctx.fillText('Vùng bó hông (>70% tải)', (cx1 + cx2) / 2, plotY + plotH - 14);
    ctx.textAlign = 'left';
  }

  // Lưới tọa độ ngang (MPa)
  ctx.lineWidth = 1;
  [0, 10, 20, 30, 40, 50].forEach((sVal) => {
    const y = toY(sVal);
    ctx.strokeStyle = sVal === 0 ? '#64748b' : '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(plotX + plotW, y);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = `500 13px ${mono}`;
    ctx.textAlign = 'right';
    ctx.fillText(String(sVal), plotX - 12, y + 4);
  });

  // Lưới tọa độ dọc (‰)
  [0, 2, 4, 6, 8, 10].forEach((eVal) => {
    const x = toX(eVal);
    ctx.strokeStyle = eVal === 0 ? '#64748b' : '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(x, plotY);
    ctx.lineTo(x, plotY + plotH);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = `500 13px ${mono}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(eVal), x, plotY + plotH + 22);
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = `700 14px ${sans}`;
  ctx.fillText('Ứng suất σ (MPa)', marginX + 18, curY + 30);
  ctx.textAlign = 'right';
  ctx.fillText('Biến dạng dọc trục ε (‰)', plotX + plotW, curY + chartBoxH - 12);
  ctx.textAlign = 'left';

  // Đường đối chứng M0 nét đứt
  if (data.spec.id !== 'M0') {
    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    data.m0Curve.forEach((pt, idx) => {
      const px = toX(pt.strainPermille);
      const py = toY(pt.stressMPa);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Đường trước xâm thực (nếu đang bật chế độ xâm thực)
  if (data.salineMode) {
    ctx.save();
    ctx.strokeStyle = curveHex;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    data.dryCurve.forEach((pt, idx) => {
      const px = toX(pt.strainPermille);
      const py = toY(pt.stressMPa);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Đường cong chính của tổ hợp được chọn
  ctx.save();
  ctx.strokeStyle = curveHex;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  data.activeCurve.forEach((pt, idx) => {
    const px = toX(pt.strainPermille);
    const py = toY(pt.stressMPa);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.restore();

  // Điểm cực hạn (εccu, f'cc)
  const lastPt = data.activeCurve[data.activeCurve.length - 1];
  if (lastPt) {
    const pkX = toX(lastPt.strainPermille);
    const pkY = toY(lastPt.stressMPa);
    ctx.fillStyle = curveHex;
    ctx.beginPath();
    ctx.arc(pkX, pkY, 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 13px ${mono}`;
    ctx.textAlign = pkX > plotX + plotW - 180 ? 'right' : 'left';
    ctx.fillText(
      `Đỉnh: ${lastPt.stressMPa.toFixed(1)} MPa @ ${lastPt.strainPermille.toFixed(2)}‰`,
      pkX + (pkX > plotX + plotW - 180 ? -10 : 10),
      pkY - 12,
    );
    ctx.textAlign = 'left';
  }

  // Điểm làm việc hiện tại
  if (data.liveState.loadRatio > 0) {
    const curX = toX(data.liveState.strainPermille);
    const curY = toY(data.liveState.stressMPa);
    ctx.save();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(plotX, curY);
    ctx.lineTo(curX, curY);
    ctx.lineTo(curX, plotY + plotH);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(curX, curY, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Chú thích góc trên phải của khung biểu đồ
  let legendX = plotX + plotW;
  ctx.textAlign = 'right';
  ctx.font = `600 13px ${sans}`;
  if (data.spec.id !== 'M0') {
    ctx.fillStyle = '#475569';
    ctx.fillText('--- Đối chứng M0', legendX, curY + 30);
    legendX -= 145;
  }
  ctx.fillStyle = curveHex;
  ctx.fillText(`━━ Tổ hợp ${data.spec.id}`, legendX, curY + 30);
  ctx.textAlign = 'left';

  // --- SECTION 4: BẢNG ĐỐI CHIẾU 5 TỔ HỢP HOẶC TÓM TẮT KỸ THUẬT ---
  curY += chartBoxH + 40;
  if (options.includeBenchmarkTable) {
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 19px ${sans}`;
    ctx.fillText('4. BẢNG ĐỐI CHIẾU 5 TỔ HỢP ĐỐI CHỨNG (M0 – C2)', marginX, curY);

    curY += 16;
    const tableHeaders = [
      { label: 'Tổ hợp', x: marginX + 14, align: 'left' as const },
      { label: 'Cấu tạo lớp', x: marginX + 110, align: 'left' as const },
      { label: 'ρf (%)', x: marginX + 410, align: 'right' as const },
      { label: "f'cc (MPa)", x: marginX + 525, align: 'right' as const },
      { label: 'Δ vs M0', x: marginX + 640, align: 'right' as const },
      { label: 'εccu (‰)', x: marginX + 755, align: 'right' as const },
      { label: 'fct (MPa)', x: marginX + 865, align: 'right' as const },
      { label: 'τb (MPa)', x: marginX + 975, align: 'right' as const },
      { label: 'Kd (%)', x: marginX + contentW - 16, align: 'right' as const },
    ];

    // Header row
    drawRoundedRect(ctx, marginX, curY, contentW, 42, 6);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 13.5px ${sans}`;
    tableHeaders.forEach((h) => {
      ctx.textAlign = h.align;
      ctx.fillText(h.label, h.x, curY + 26);
    });
    ctx.textAlign = 'left';

    const rowH = 44;
    data.comparisonRows.forEach((row, rIdx) => {
      const ry = curY + 44 + rIdx * rowH;
      ctx.fillStyle = row.isSelected ? '#e0f2fe' : rIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(marginX, ry, contentW, rowH);

      ctx.strokeStyle = row.isSelected ? '#0284c7' : '#e2e8f0';
      ctx.lineWidth = row.isSelected ? 1.8 : 1;
      ctx.strokeRect(marginX, ry, contentW, rowH);

      const s = row.spec;
      const layerDesc =
        s.layers === 0
          ? 'Bê tông B25 đối chứng (0 lớp)'
          : `${s.layers} lớp ${s.fiberType} (tf = ${s.tfMmPerLayer} mm)`;

      ctx.fillStyle = row.isSelected ? '#0369a1' : '#0f172a';
      ctx.font = `${row.isSelected ? '700' : '600'} 14px ${sans}`;
      ctx.textAlign = 'left';
      ctx.fillText(row.isSelected ? `▶ ${s.id}` : s.id, marginX + 14, ry + 27);

      ctx.fillStyle = '#334155';
      ctx.font = `400 13.5px ${sans}`;
      ctx.fillText(layerDesc, marginX + 110, ry + 27);

      ctx.font = `${row.isSelected ? '700' : '500'} 13.5px ${mono}`;
      ctx.textAlign = 'right';
      ctx.fillText(s.rhoFPercent.toFixed(2), marginX + 410, ry + 27);
      ctx.fillText(row.effectiveFccMPa.toFixed(1), marginX + 525, ry + 27);

      ctx.fillStyle = s.deltaFccPct > 0 ? '#059669' : '#64748b';
      ctx.fillText(
        s.deltaFccPct > 0 ? `+${s.deltaFccPct.toFixed(1)}%` : '—',
        marginX + 640,
        ry + 27,
      );

      ctx.fillStyle = '#0f172a';
      ctx.fillText(s.eccuPermille.toFixed(2), marginX + 755, ry + 27);
      ctx.fillText(s.fctMPa.toFixed(2), marginX + 865, ry + 27);
      ctx.fillText(s.tauB_MPa !== null ? s.tauB_MPa.toFixed(2) : 'N/A', marginX + 975, ry + 27);

      ctx.fillStyle = s.kdPercent >= 94 ? '#0f766e' : '#d97706';
      ctx.fillText(s.kdPercent.toFixed(1), marginX + contentW - 16, ry + 27);
      ctx.textAlign = 'left';
    });
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 19px ${sans}`;
    ctx.fillText('4. NHẬN XÉT KỸ THUẬT & CƠ CHẾ LÀM VIỆC', marginX, curY);

    curY += 18;
    drawRoundedRect(ctx, marginX, curY, contentW, 132, 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.fillStyle = '#1e293b';
    ctx.font = `400 15px ${sans}`;
    const noteLines = wrapLines(ctx, data.spec.description, contentW - 36);
    noteLines.forEach((line, idx) => {
      ctx.fillText(line, marginX + 18, curY + 34 + idx * 24);
    });

    ctx.fillStyle = '#475569';
    ctx.font = `500 14px ${sans}`;
    ctx.fillText(
      data.spec.fiberType === 'NONE'
        ? '• Cơ chế phá hoại: Nứt cắt nghiêng 45° giòn tại vùng đỉnh; độ bền giảm còn Kd = 81.5% khi ngâm NaCl 3.5%.'
        : `• Cơ chế bó hông: Áo sợi ${data.spec.fiberType} định hướng 90° kích hoạt lực kéo vòng khi tải >70%, duy trì Kd = ${data.spec.kdPercent.toFixed(1)}%.`,
      marginX + 18,
      curY + 96,
    );
  }

  // --- FOOTER ---
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(marginX, H - 78);
  ctx.lineTo(W - marginX, H - 78);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = `400 13px ${sans}`;
  ctx.fillText(
    'Mô hình phân tích: Lam & Teng (2003) cho bê tông bọc FRP · Popovics cho B25 đối chứng · Tải nén 2.000 kN',
    marginX,
    H - 46,
  );
  ctx.textAlign = 'right';
  ctx.font = `600 13px ${mono}`;
  ctx.fillText('A4 · Trang 1 / 1', W - marginX, H - 46);
  ctx.textAlign = 'left';
}

export function exportReportPdf(
  data: PdfReportData,
  options: PdfRenderOptions,
): string {
  const offscreen = document.createElement('canvas');
  renderReportToCanvas(offscreen, data, options);

  const imgData = offscreen.toDataURL('image/png');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  doc.setProperties({
    title: `Báo cáo kỹ thuật FRP - Tổ hợp ${data.spec.id}`,
    subject: data.researchTitle,
  });

  doc.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');

  const filename = buildPdfFilename(
    data.spec.id,
    data.salineMode,
    new Date(data.generatedAtIso),
  );
  doc.save(filename);
  return filename;
}
