import { Check, Copy, Crosshair, Layers, RotateCcw, Ruler, Smartphone, X } from 'lucide-react';
import { useState, type RefObject } from 'react';
import {
  computeArDimensionsMeters,
  getArCapabilitySummary,
  type ArSupportState,
} from '../utils/arConfig';
import { GROUP_ORDER, SPECIMEN_GROUPS, type GroupId } from '../utils/frpData';

interface ArCompatModalProps {
  open: boolean;
  onClose: () => void;
  arSupport: ArSupportState;
  arError: string | null;
  groupId: GroupId;
  scaleMode1to1: boolean;
  onToggleScaleMode: () => void;
  onLaunchWebXR: () => void;
}

export function ArCompatModal({
  open,
  onClose,
  arSupport,
  arError,
  groupId,
  scaleMode1to1,
  onToggleScaleMode,
  onLaunchWebXR,
}: ArCompatModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const summary = getArCapabilitySummary(arSupport);
  const dims = computeArDimensionsMeters(groupId);
  const spec = SPECIMEN_GROUPS[groupId];

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trình xem thực tế tăng cường WebXR AR tỷ lệ 1:1"
    >
      <div className="bg-[#0c121c] border border-slate-700 rounded-xl max-w-lg w-full p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Thực tế tăng cường (WebXR AR · Tỷ lệ 1:1)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Đặt mẫu trụ bê tông B25 trên mặt bàn thực tế đúng kích thước vật lý
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại AR"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* Thông số kích thước vật lý 1:1 */}
          <div className="grid grid-cols-3 gap-2 bg-[#080c13] border border-slate-800 rounded-lg p-3">
            <div>
              <div className="text-[11px] text-slate-400">Đường kính D</div>
              <div className="font-mono text-sm font-semibold text-sky-300">
                {(dims.diameterM * 1000).toFixed(0)} mm
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                {dims.diameterM.toFixed(2)} m thực tế
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Chiều cao H</div>
              <div className="font-mono text-sm font-semibold text-sky-300">
                {(dims.heightM * 1000).toFixed(0)} mm
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                {dims.heightM.toFixed(2)} m thực tế
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Nối chồng · Lớp {spec.id}</div>
              <div className="font-mono text-sm font-semibold text-amber-300">
                {(dims.overlapArcM * 1000).toFixed(0)} mm
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                {spec.layers > 0
                  ? `${spec.layers} lớp (Σtf = ${dims.totalFrpThicknessMm} mm)`
                  : '0 lớp (Đối chứng)'}
              </div>
            </div>
          </div>

          {/* Trạng thái tương thích WebXR */}
          <div
            className={`rounded-lg border p-3 ${
              summary.canLaunchWebXR
                ? 'bg-emerald-950/35 border-emerald-500/40'
                : 'bg-slate-900/90 border-slate-700/80'
            }`}
          >
            <div className="text-xs font-semibold text-slate-100">{summary.title}</div>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">{summary.detail}</p>
            {arError && (
              <p className="text-xs text-red-400 mt-2 font-medium">
                Không thể khởi động phiên AR: {arError}
              </p>
            )}
          </div>

          {/* Hành động chính */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            {summary.canLaunchWebXR && (
              <button
                type="button"
                onClick={onLaunchWebXR}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                <span>Khởi động camera WebXR AR (1:1)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onToggleScaleMode();
                onClose();
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                scaleMode1to1
                  ? 'bg-sky-500/20 border-sky-400/70 text-sky-200 hover:bg-sky-500/30'
                  : 'bg-[#111927] border-slate-700 text-slate-100 hover:bg-slate-800'
              }`}
            >
              <Ruler className="w-4 h-4 text-sky-400" />
              <span>
                {scaleMode1to1
                  ? 'Tắt thước chuẩn 1:1 trên 3D'
                  : 'Bật thước chuẩn 1:1 trên mô hình 3D'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#111927] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Đã sao chép</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Sao chép link mobile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ArDomOverlayProps {
  overlayRef: RefObject<HTMLDivElement | null>;
  arActive: boolean;
  arPlaced: boolean;
  arStatusMessage: string;
  groupId: GroupId;
  explodeValue: number;
  arShowFrame: boolean;
  onSelectGroup: (id: GroupId) => void;
  onExplodeChange: (val: number) => void;
  onToggleShowFrame: () => void;
  onPlaceAtReticle: () => void;
  onResetPlacement: () => void;
  onExitAr: () => void;
}

export function ArDomOverlay({
  overlayRef,
  arActive,
  arPlaced,
  arStatusMessage,
  groupId,
  explodeValue,
  arShowFrame,
  onSelectGroup,
  onExplodeChange,
  onToggleShowFrame,
  onPlaceAtReticle,
  onResetPlacement,
  onExitAr,
}: ArDomOverlayProps) {
  const spec = SPECIMEN_GROUPS[groupId];

  return (
    <div
      ref={overlayRef}
      className={
        arActive
          ? 'fixed inset-0 z-50 pointer-events-none flex flex-col justify-between p-4'
          : 'hidden'
      }
    >
      {/* Thanh trên trong WebXR DOM Overlay */}
      <div className="pointer-events-auto flex items-start justify-between gap-3">
        <div className="bg-[#0b1019]/92 border border-slate-700 rounded-lg px-3.5 py-2 max-w-sm">
          <div className="text-xs font-semibold text-slate-100">
            AR Tỷ lệ 1:1 · {spec.shortLabel} (D = 150 mm × H = 300 mm)
          </div>
          <p className="text-[11px] text-sky-300 mt-0.5 leading-snug">{arStatusMessage}</p>
        </div>

        <button
          type="button"
          onClick={onExitAr}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/90 hover:bg-red-900 border border-red-500/50 text-red-100 text-xs font-semibold cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Thoát AR</span>
        </button>
      </div>

      {/* Thanh điều khiển nhanh ở đáy khi ở chế độ AR */}
      <div className="pointer-events-auto bg-[#0b1019]/94 border border-slate-700 rounded-xl p-3 space-y-2.5 max-w-lg mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {GROUP_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectGroup(id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                  id === groupId
                    ? 'bg-sky-500/20 border-sky-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleShowFrame}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border cursor-pointer ${
              arShowFrame
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-900 border-slate-700 text-slate-300'
            }`}
          >
            {arShowFrame ? 'Ẩn khung máy nén' : 'Hiện khung 2.000 kN'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-amber-400" />
                Bóc tách lớp FRP
              </span>
              <span className="font-mono text-amber-300">
                {Math.round(explodeValue * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(explodeValue * 100)}
              onChange={(e) => onExplodeChange(Number(e.target.value) / 100)}
              className="w-full eng-slider"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onPlaceAtReticle}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{arPlaced ? 'Đặt lại tại tâm' : 'Đặt mẫu 1:1'}</span>
            </button>
            {arPlaced && (
              <button
                type="button"
                onClick={onResetPlacement}
                aria-label="Xóa vị trí đã đặt"
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
