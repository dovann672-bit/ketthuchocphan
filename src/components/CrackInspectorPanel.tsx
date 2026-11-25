import { Crosshair, Maximize2, RotateCcw, Search, X } from 'lucide-react';
import type { CrackInspectionReport } from '../utils/crackAnalysis';

interface CrackInspectorPanelProps {
  active: boolean;
  report: CrackInspectionReport | null;
  loadRatio: number;
  onJumpToUltimateLoad: () => void;
  onResetZoom: () => void;
  onExitMode: () => void;
}

export function CrackInspectorPanel({
  active,
  report,
  loadRatio,
  onJumpToUltimateLoad,
  onResetZoom,
  onExitMode,
}: CrackInspectorPanelProps) {
  if (!active) return null;

  return (
    <aside
      aria-label="Bảng phân tích vết nứt chi tiết"
      className="fixed top-[84px] left-4 z-20 w-[min(340px,calc(100vw-2rem))] bg-[#0b1019]/95 border border-rose-500/45 rounded-xl p-3.5 shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-rose-500/15 border border-rose-500/35 text-rose-300">
            <Search className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-slate-100">
              Phân tích vết nứt chi tiết (Cận cảnh)
            </h2>
            <p className="text-[11px] text-slate-400">
              Click lên bề mặt mẫu trụ để zoom điểm phá hoại
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onExitMode}
          aria-label="Thoát phân tích vết nứt"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loadRatio < 0.995 && (
        <div className="mt-2.5 flex items-center justify-between gap-2 bg-amber-950/35 border border-amber-500/40 rounded-lg px-2.5 py-2">
          <span className="text-[11px] text-amber-200">
            Đang ở tải {Math.round(loadRatio * 100)}%
          </span>
          <button
            type="button"
            onClick={onJumpToUltimateLoad}
            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold cursor-pointer shrink-0"
          >
            Đưa về tải cực hạn 100%
          </button>
        </div>
      )}

      {!report ? (
        <div className="mt-3 bg-[#080c13] border border-slate-800 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5">
          <Crosshair className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Di chuyển con trỏ vào thân mẫu bê tông hoặc vùng đứt sợi FRP rồi click chuột để phóng to cận cảnh và đo thông số vết nứt tại điểm chọn.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          <div className="bg-[#080c13] border border-slate-800 rounded-lg p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="whitespace-nowrap">
                Cao độ y = {report.heightMm} mm · θ = {report.azimuthDeg}°
              </span>
              {report.inOverlapZone && (
                <span className="text-amber-300 font-sans font-semibold whitespace-nowrap">
                  Vùng nối chồng 150 mm
                </span>
              )}
            </div>
            <div
              className={`text-xs font-semibold mt-1.5 ${
                report.severity === 'rupture'
                  ? 'text-rose-300'
                  : report.severity === 'confinement'
                    ? 'text-cyan-300'
                    : 'text-slate-200'
              }`}
            >
              {report.failureTitle}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
              {report.mechanismDetail}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-[#080c13] border border-slate-800 rounded-lg p-2.5">
            <div>
              <div className="text-[10px] text-slate-400">Bề rộng khe nứt</div>
              <div className="font-mono text-xs font-semibold text-rose-300 mt-0.5">
                {report.estimatedCrackWidthMm.toFixed(2)} mm
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Biến dạng vòng</div>
              <div className="font-mono text-xs font-semibold text-cyan-300 mt-0.5">
                {report.hoopStrainPermille.toFixed(2)} ‰
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Ứng suất σ</div>
              <div className="font-mono text-xs font-semibold text-slate-100 mt-0.5">
                {report.localStressMPa.toFixed(1)} MPa
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 px-0.5">
            <span>Dạng nứt: {report.crackAngleLabel}</span>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={onResetZoom}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Thu hồi toàn cảnh</span>
            </button>
            <button
              type="button"
              onClick={onExitMode}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Thoát</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
