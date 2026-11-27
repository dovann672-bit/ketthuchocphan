import { ArrowDownToLine, Eye, Layers, ScanLine, X } from 'lucide-react';
import { useMemo } from 'react';
import type { GroupId } from '../utils/frpData';
import {
  XRAY_MAX_HEIGHT_MM,
  XRAY_MIN_HEIGHT_MM,
  computeXrayCrossSection,
} from '../utils/xraySection';

interface XraySectionPanelProps {
  active: boolean;
  groupId: GroupId;
  cutHeightMm: number;
  loadRatio: number;
  salineMode: boolean;
  onChangeCutHeight: (heightMm: number) => void;
  onFocusCamera: (topDown: boolean) => void;
  onExitMode: () => void;
}

const HEIGHT_PRESETS = [
  { label: '50 mm (Đáy)', value: 50 },
  { label: '150 mm (Giữa)', value: 150 },
  { label: '250 mm (Đỉnh)', value: 250 },
];

export function XraySectionPanel({
  active,
  groupId,
  cutHeightMm,
  loadRatio,
  salineMode,
  onChangeCutHeight,
  onFocusCamera,
  onExitMode,
}: XraySectionPanelProps) {
  const summary = useMemo(
    () => computeXrayCrossSection(groupId, cutHeightMm, loadRatio, salineMode),
    [groupId, cutHeightMm, loadRatio, salineMode],
  );

  if (!active) return null;

  return (
    <aside
      aria-label="Bảng điều khiển X-Ray mặt cắt ngang"
      data-testid="xray-section-panel"
      className="fixed top-[74px] left-4 z-20 w-[min(352px,calc(100vw-2rem))] max-h-[calc(100vh-375px)] overflow-y-auto eng-scroll bg-[#0b1019]/95 border border-cyan-500/45 rounded-xl p-2.5 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-cyan-300">
            <ScanLine className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-slate-100 leading-tight">
              X-Ray Cross-Section (Mặt cắt ngang)
            </h2>
            <p className="text-[10.5px] text-slate-400 leading-tight mt-0.5">
              Soi độ dày từng lớp vật liệu tại cao độ tùy chọn
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onExitMode}
          aria-label="Thoát chế độ X-Ray"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thanh trượt cao độ cắt ngang */}
      <div className="mt-2 bg-[#080c13] border border-slate-800 rounded-lg p-2">
        <div className="flex items-center justify-between text-[11.5px] mb-1">
          <label htmlFor="xray-height-slider" className="font-medium text-slate-200">
            Cao độ mặt cắt (H = 300 mm)
          </label>
          <span className="font-mono font-semibold text-cyan-300">
            {summary.cutHeightMm} mm
          </span>
        </div>
        <input
          id="xray-height-slider"
          type="range"
          min={XRAY_MIN_HEIGHT_MM}
          max={XRAY_MAX_HEIGHT_MM}
          step={1}
          aria-label="Cao độ mặt cắt X-Ray"
          value={summary.cutHeightMm}
          onChange={(e) => onChangeCutHeight(Number(e.target.value))}
          className="w-full eng-slider"
        />
        <div className="flex items-center gap-1.5 mt-1.5">
          {HEIGHT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChangeCutHeight(p.value)}
              className={`flex-1 py-0.5 px-1.5 rounded text-[10.5px] font-medium border transition-colors cursor-pointer ${
                Math.abs(summary.cutHeightMm - p.value) <= 3
                  ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bảng độ dày các lớp vật liệu trên mặt cắt */}
      <div className="mt-2 bg-[#080c13] border border-slate-800 rounded-lg p-2">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Cấu trúc &amp; độ dày lớp tại z = {summary.cutHeightMm} mm</span>
          </div>
        </div>

        <div className="space-y-1">
          {summary.bands.map((band) => (
            <div
              key={band.key}
              title={band.roleSummary}
              className="flex items-center justify-between gap-2 text-[11px] py-1 px-2 rounded bg-[#0d1420] border border-slate-800/80"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: band.color }}
                />
                <span className="text-slate-200 font-medium truncate">{band.label}</span>
              </div>
              <span className="font-mono font-semibold text-cyan-300 whitespace-nowrap shrink-0">
                {band.thicknessLabel}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1.5 pt-1.5 border-t border-slate-800/80 text-[11px]">
          <div className="flex items-center justify-between gap-1 bg-[#0b111b] rounded px-2 py-1">
            <span className="text-[10px] text-slate-400">Tổng lớp bọc</span>
            <span className="font-mono font-semibold text-emerald-300">
              {summary.totalJacketThicknessMm > 0
                ? `${summary.totalJacketThicknessMm.toFixed(3)} mm`
                : '0.000 mm'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 bg-[#0b111b] rounded px-2 py-1">
            <span className="text-[10px] text-slate-400">Ø mặt cắt</span>
            <span className="font-mono font-semibold text-slate-100">
              {summary.effectiveDiameterMm.toFixed(2)} mm
            </span>
          </div>
        </div>

        {summary.hasOverlapAtCut && (
          <div className="mt-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-400/35 text-[10px] text-amber-300 leading-snug">
            Vùng nối chồng 150 mm (cung 114.6° vàng hổ phách) tăng gấp đôi chiều dày sợi ở mặt trước-phải.
          </div>
        )}
      </div>

      {/* Nút điều chỉnh góc camera soi mặt cắt */}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => onFocusCamera(false)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-medium cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-cyan-400" />
          <span>Góc 3/4</span>
        </button>
        <button
          type="button"
          onClick={() => onFocusCamera(true)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/45 text-cyan-200 text-[11px] font-medium cursor-pointer"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>Nhìn từ trên</span>
        </button>
      </div>
    </aside>
  );
}
