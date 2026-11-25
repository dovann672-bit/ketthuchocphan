import {
  ChevronDown,
  ChevronUp,
  Droplets,
  FileText,
  Layers,
  Pause,
  Play,
  RotateCcw,
  Search,
  Smartphone,
  Table2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { CameraPreset, GroupId } from '../utils/frpData';
import {
  GROUP_ORDER,
  SPECIMEN_GROUPS,
  computeStressStrainPoint,
} from '../utils/frpData';
import { StressStrainChart } from './StressStrainChart';

interface EngineeringDockProps {
  groupId: GroupId;
  onSelectGroup: (id: GroupId) => void;
  explodeValue: number;
  onExplodeChange: (val: number) => void;
  loadRatio: number;
  onLoadChange: (val: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onResetSimulation: () => void;
  salineMode: boolean;
  onToggleSaline: () => void;
  cameraPreset: CameraPreset;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  scaleMode1to1: boolean;
  arActive: boolean;
  onOpenAr: () => void;
  onOpenPdfExport: () => void;
  crackAnalysisMode: boolean;
  onToggleCrackAnalysis: () => void;
}

const PRESET_LABELS: Array<{ id: CameraPreset; label: string }> = [
  { id: 'overview', label: 'Toàn cảnh' },
  { id: 'layers', label: 'Mặt cắt lớp' },
  { id: 'overlap', label: 'Nối chồng 150 mm' },
  { id: 'top_platen', label: 'Mâm nén trên' },
];

export function EngineeringDock({
  groupId,
  onSelectGroup,
  explodeValue,
  onExplodeChange,
  loadRatio,
  onLoadChange,
  isPlaying,
  onTogglePlay,
  onResetSimulation,
  salineMode,
  onToggleSaline,
  cameraPreset,
  onSelectCameraPreset,
  dockCollapsed,
  onToggleDock,
  scaleMode1to1,
  arActive,
  onOpenAr,
  onOpenPdfExport,
  crackAnalysisMode,
  onToggleCrackAnalysis,
}: EngineeringDockProps) {
  const [showCompareModal, setShowCompareModal] = useState(false);

  if (arActive) return null;

  const spec = SPECIMEN_GROUPS[groupId];
  const current = computeStressStrainPoint(groupId, loadRatio, salineMode);
  const effectiveFcc = salineMode
    ? spec.fccMPa * (spec.kdPercent / 100)
    : spec.fccMPa;

  return (
    <>
      {/* TOP-LEFT MINIMAL RESEARCH HEADER (giữ gọn trên 1 hàng ở desktop 1440px) */}
      <header className="pointer-events-none fixed top-3 left-4 right-4 z-20 flex flex-wrap xl:flex-nowrap items-start justify-between gap-2.5">
        <div className="pointer-events-auto bg-[#0b1019]/92 border border-slate-800/90 rounded-lg px-3.5 py-2 max-w-[430px] shadow-xl shrink-0">
          <h1 className="text-[13px] sm:text-[14px] font-semibold text-slate-100 leading-snug">
            Nghiên cứu thực nghiệm Bê tông B25 gia cường FRP
          </h1>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
            <span>D = 150 mm · H = 300 mm</span>
            <span aria-hidden="true">·</span>
            <span>Nối chồng 150 mm</span>
            <span aria-hidden="true">·</span>
            <span>Mâm nén 2.000 kN</span>
          </div>
        </div>

        {/* Góc nhìn camera & các chế độ phân tích / xuất báo cáo */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 bg-[#0b1019]/92 border border-slate-800/90 rounded-lg p-1.5 shadow-xl">
          {PRESET_LABELS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectCameraPreset(p.id)}
              className={`px-2 py-1.5 rounded-md text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                cameraPreset === p.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
              }`}
            >
              {p.label}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-800 mx-0.5" aria-hidden="true" />
          <button
            type="button"
            onClick={onToggleCrackAnalysis}
            aria-pressed={crackAnalysisMode}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              crackAnalysisMode
                ? 'bg-rose-500/20 text-rose-200 border-rose-400/70'
                : 'text-rose-300 hover:bg-rose-500/15 border-rose-500/35'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Phân tích vết nứt</span>
          </button>
          <button
            type="button"
            onClick={onOpenAr}
            aria-pressed={scaleMode1to1}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] font-medium border whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              scaleMode1to1
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/60'
                : 'text-sky-300 hover:bg-sky-500/15 border-sky-500/35'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{scaleMode1to1 ? 'AR · Thước 1:1 (Bật)' : 'Xem AR (1:1)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCompareModal(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] font-medium text-amber-300 hover:bg-amber-500/15 border border-amber-500/30 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Bảng so sánh 5 tổ hợp</span>
          </button>
          <button
            type="button"
            onClick={onOpenPdfExport}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] font-medium text-emerald-300 hover:bg-emerald-500/15 border border-emerald-500/35 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Xuất PDF</span>
          </button>
        </div>
      </header>

      {/* UNIFIED COLLAPSIBLE BOTTOM CONTROL & LIVE DATA DOCK */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(1160px,96vw)] transition-transform duration-300 ease-out ${
          dockCollapsed ? 'translate-y-[calc(100%-30px)]' : 'translate-y-0'
        }`}
      >
        {/* Thanh thu gọn / mở rộng gắn ở cạnh trên của Dock */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onToggleDock}
            aria-expanded={!dockCollapsed}
            className="flex items-center gap-1.5 px-4 py-1 rounded-t-lg bg-[#0c121c]/95 border border-b-0 border-slate-700/80 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-sky-400" />
                <span>Mở bảng điều khiển &amp; Dữ liệu (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Thu gọn bảng điều khiển (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Thân Dock chính (Solid rgba surface, KHÔNG dùng backdrop-filter trên WebGL) */}
        <div className="bg-[#0b1019]/94 border border-slate-800 rounded-xl shadow-2xl p-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* CỘT TRÁI (7/12): BỘ CHỌN TỔ HỢP & THANH TRƯỢT THÍ NGHIỆM */}
            <div className="lg:col-span-7 flex flex-col gap-2.5">
              {/* Chọn 5 tổ hợp đối chứng */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Chọn tổ hợp mẫu thí nghiệm">
                  {GROUP_ORDER.map((id) => {
                    const item = SPECIMEN_GROUPS[id];
                    const active = id === groupId;
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onSelectGroup(id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer border ${
                          active
                            ? 'bg-slate-800 text-white border-sky-400/70'
                            : 'bg-[#101724] text-slate-400 hover:text-slate-100 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className="inline-block w-2 h-2 rounded-xs mr-1.5"
                          style={{ backgroundColor: item.accentColor }}
                        />
                        {item.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Nút bật/tắt môi trường xâm thực NaCl 3.5% / Kiềm 60 ngày */}
                <button
                  type="button"
                  onClick={onToggleSaline}
                  aria-pressed={salineMode}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                    salineMode
                      ? 'bg-teal-500/20 text-teal-300 border-teal-400/60'
                      : 'bg-[#101724] text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Xâm thực NaCl 3.5% / Kiềm 60 ngày</span>
                </button>
              </div>

              {/* Hai thanh trượt chính: Bóc tách lớp & Mô phỏng nén */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-0.5">
                {/* Thanh trượt 1: Bóc tách lớp vật liệu */}
                <div className="bg-[#080c13] border border-slate-800/80 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <label
                      htmlFor="explode-slider"
                      className="flex items-center gap-1.5 font-medium text-slate-200"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Bóc tách lớp vật liệu</span>
                    </label>
                    <span className="font-mono text-amber-300 font-semibold">
                      {Math.round(explodeValue * 100)}%
                    </span>
                  </div>
                  <input
                    id="explode-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(explodeValue * 100)}
                    onChange={(e) => onExplodeChange(Number(e.target.value) / 100)}
                    className="w-full eng-slider"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 truncate">
                    {spec.fiberType === 'NONE'
                      ? 'Mẫu M0 chỉ có lõi bê tông B25 (không bọc FRP)'
                      : 'Primer · Sikadur-330 · Sợi FRP 90° · Topcoat'}
                  </p>
                </div>

                {/* Thanh trượt 2: Mô phỏng nén & Hiệu ứng bó hông */}
                <div className="bg-[#080c13] border border-slate-800/80 rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <label
                      htmlFor="load-slider"
                      className="font-medium text-slate-200 truncate"
                    >
                      Tải nén &amp; Bó hông
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`font-mono font-semibold ${
                          current.isRuptured
                            ? 'text-red-400'
                            : current.isPassiveConfinementActive
                              ? 'text-cyan-300'
                              : 'text-sky-300'
                        }`}
                      >
                        {Math.round(loadRatio * 100)}% · {current.axialLoadKN.toFixed(0)} kN
                      </span>
                      <button
                        type="button"
                        onClick={onTogglePlay}
                        aria-label={isPlaying ? 'Tạm dừng thí nghiệm nén' : 'Chạy thí nghiệm nén'}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={onResetSimulation}
                        aria-label="Đặt lại thí nghiệm"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    id="load-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(loadRatio * 100)}
                    onChange={(e) => onLoadChange(Number(e.target.value) / 100)}
                    className="w-full eng-slider"
                  />
                  <p className="text-[11px] mt-1.5 truncate text-slate-400">
                    {current.isRuptured
                      ? spec.fiberType === 'NONE'
                        ? 'Phá hoại cắt chéo 45° tại tải đỉnh M0'
                        : 'Nổ giòn đứt sợi theo phương ngang ở 100% tải'
                      : current.isPassiveConfinementActive
                        ? `Bó hông kích hoạt (>70%) · σ_vòng = ${current.hoopStressMPa.toFixed(0)} MPa`
                        : 'Giai đoạn nén đàn hồi (<70% tải)'}
                  </p>
                </div>
              </div>

              {/* Bảng chỉ tiêu cơ học trực tiếp của tổ hợp đang chọn */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-[#080c13] border border-slate-800/80 rounded-lg px-3 py-2">
                <div>
                  <div className="text-[10px] text-slate-400">Cường độ f&apos;cc</div>
                  <div className="font-mono text-xs font-semibold text-slate-100">
                    {effectiveFcc.toFixed(1)} MPa
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400">
                    {spec.deltaFccPct > 0 ? `+${spec.deltaFccPct.toFixed(1)}%` : 'Chuẩn M0'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Biến dạng εccu</div>
                  <div className="font-mono text-xs font-semibold text-slate-100">
                    {spec.eccuPermille.toFixed(2)} ‰
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {(spec.eccuPermille / 2.8).toFixed(1)}× M0
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Kéo gián tiếp fct</div>
                  <div className="font-mono text-xs font-semibold text-slate-100">
                    {spec.fctMPa.toFixed(2)} MPa
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {spec.id === 'M0'
                      ? '—'
                      : `+${(((spec.fctMPa - 2.45) / 2.45) * 100).toFixed(1)}%`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Mô đun Ec</div>
                  <div className="font-mono text-xs font-semibold text-slate-100">
                    {spec.ecGPa.toFixed(1)} GPa
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    ρf = {spec.rhoFPercent.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Bám dính τb</div>
                  <div className="font-mono text-xs font-semibold text-slate-100">
                    {spec.tauB_MPa !== null ? `${spec.tauB_MPa.toFixed(2)} MPa` : 'N/A'}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {spec.layers > 0 ? `${spec.layers} lớp (${spec.tfMmPerLayer} mm)` : '0 lớp'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Độ bền Kd</div>
                  <div
                    className={`font-mono text-xs font-semibold ${
                      spec.kdPercent >= 94 ? 'text-teal-300' : 'text-amber-400'
                    }`}
                  >
                    {spec.kdPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {salineMode ? (spec.layers > 0 ? 'Kháng Cl⁻ tốt' : 'Suy giảm mạnh') : 'Sau 60 ngày'}
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (5/12): BIỂU ĐỒ ỨNG SUẤT – BIẾN DẠNG ĐỒNG BỘ */}
            <div className="lg:col-span-5">
              <StressStrainChart
                groupId={groupId}
                loadRatio={loadRatio}
                salineMode={salineMode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL BẢNG SO SÁNH 5 TỔ HỢP */}
      {showCompareModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Bảng so sánh chỉ tiêu cơ học 5 tổ hợp đối chứng"
        >
          <div className="bg-[#0c121c] border border-slate-700 rounded-xl max-w-4xl w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Bảng tổng hợp chỉ tiêu cường độ và độ bền (5 tổ hợp đối chứng)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Mẫu trụ bê tông B25 (D = 150 mm, H = 300 mm), keo Sikadur-330 (1.2 mm), đoạn nối chồng 150 mm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCompareModal(false)}
                aria-label="Đóng bảng so sánh"
                className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto eng-scroll mt-3">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 pr-3 font-medium">Tổ hợp</th>
                    <th className="py-2 px-2 font-medium">Vật liệu &amp; Lớp</th>
                    <th className="py-2 px-2 font-medium text-right">ρf (%)</th>
                    <th className="py-2 px-2 font-medium text-right">f&apos;cc (MPa)</th>
                    <th className="py-2 px-2 font-medium text-right">Δf&apos;cc vs M0</th>
                    <th className="py-2 px-2 font-medium text-right">εccu (‰)</th>
                    <th className="py-2 px-2 font-medium text-right">fct (MPa)</th>
                    <th className="py-2 px-2 font-medium text-right">Ec (GPa)</th>
                    <th className="py-2 px-2 font-medium text-right">τb (MPa)</th>
                    <th className="py-2 pl-2 font-medium text-right">Kd (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {GROUP_ORDER.map((id) => {
                    const row = SPECIMEN_GROUPS[id];
                    const selected = id === groupId;
                    return (
                      <tr
                        key={id}
                        onClick={() => {
                          onSelectGroup(id);
                          setShowCompareModal(false);
                        }}
                        className={`cursor-pointer transition-colors ${
                          selected
                            ? 'bg-sky-500/12 text-white'
                            : 'text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-2.5 pr-3 font-sans font-semibold">
                          <span
                            className="inline-block w-2 h-2 rounded-xs mr-2"
                            style={{ backgroundColor: row.accentColor }}
                          />
                          {row.id}
                        </td>
                        <td className="py-2.5 px-2 font-sans text-slate-300">
                          {row.layers === 0
                            ? 'B25 đối chứng (0 lớp)'
                            : `${row.layers} lớp ${row.fiberType} (tf=${row.tfMmPerLayer})`}
                        </td>
                        <td className="py-2.5 px-2 text-right">{row.rhoFPercent.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right font-semibold text-white">
                          {row.fccMPa.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-emerald-400">
                          {row.deltaFccPct > 0 ? `+${row.deltaFccPct.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-right">{row.eccuPermille.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right">{row.fctMPa.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right">{row.ecGPa.toFixed(1)}</td>
                        <td className="py-2.5 px-2 text-right">
                          {row.tauB_MPa !== null ? row.tauB_MPa.toFixed(2) : 'N/A'}
                        </td>
                        <td className="py-2.5 pl-2 text-right text-teal-300">
                          {row.kdPercent.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
