import { CheckCircle2, Download, FileText, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GROUP_ORDER, type GroupId } from '../utils/frpData';
import { exportReportPdf, renderReportToCanvas } from '../utils/pdfCanvasRenderer';
import { buildPdfReportData } from '../utils/pdfReport';

interface PdfExportModalProps {
  open: boolean;
  onClose: () => void;
  groupId: GroupId;
  onSelectGroup: (id: GroupId) => void;
  loadRatio: number;
  salineMode: boolean;
}

export function PdfExportModal({
  open,
  onClose,
  groupId,
  onSelectGroup,
  loadRatio,
  salineMode,
}: PdfExportModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [includeBenchmarkTable, setIncludeBenchmarkTable] = useState(true);
  const [exportedFile, setExportedFile] = useState<string | null>(null);

  const reportData = useMemo(
    () => buildPdfReportData(groupId, loadRatio, salineMode, new Date()),
    [groupId, loadRatio, salineMode, open],
  );

  useEffect(() => {
    if (!open) {
      setExportedFile(null);
      return;
    }
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    renderReportToCanvas(canvas, reportData, { includeBenchmarkTable });
  }, [open, reportData, includeBenchmarkTable]);

  if (!open) return null;

  const handleDownloadPdf = () => {
    const filename = exportReportPdf(reportData, { includeBenchmarkTable });
    setExportedFile(filename);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Xuất báo cáo kỹ thuật và biểu đồ ứng suất biến dạng sang PDF"
    >
      <div className="bg-[#0c121c] border border-slate-700 rounded-xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header modal */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Xuất báo cáo kỹ thuật &amp; Biểu đồ σ–ε (PDF)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Khổ giấy A4 tiêu chuẩn · Tổng hợp thông số cơ học, độ bền và đường cong ứng suất – biến dạng
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại xuất PDF"
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thân modal: Điều khiển tùy chọn bên trái + Bản xem trước A4 bên phải */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-5 overflow-y-auto eng-scroll">
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              {/* Chọn tổ hợp xuất báo cáo */}
              <div className="bg-[#080c13] border border-slate-800 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-200 mb-2">
                  Tổ hợp mẫu xuất báo cáo
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn tổ hợp xuất PDF">
                  {GROUP_ORDER.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={id === groupId}
                      onClick={() => {
                        setExportedFile(null);
                        onSelectGroup(id);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer transition-colors ${
                        id === groupId
                          ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200'
                          : 'bg-[#101724] border-slate-800 text-slate-400 hover:text-slate-100'
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  {reportData.spec.name} · {reportData.environmentLabel}
                </p>
              </div>

              {/* Tóm tắt số liệu sẽ in */}
              <div className="bg-[#080c13] border border-slate-800 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="font-semibold text-slate-200">Nội dung trong tệp PDF</div>
                <div className="flex justify-between text-slate-400">
                  <span>Cường độ hiệu dụng f&apos;cc:</span>
                  <span className="font-mono text-slate-100">
                    {reportData.effectiveFccMPa.toFixed(1)} MPa
                    {reportData.deltaEffectiveFccPct > 0
                      ? ` (+${reportData.deltaEffectiveFccPct.toFixed(1)}%)`
                      : ''}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Biến dạng cực hạn εccu:</span>
                  <span className="font-mono text-slate-100">
                    {reportData.spec.eccuPermille.toFixed(2)} ‰
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Điểm tải hiện tại trên biểu đồ:</span>
                  <span className="font-mono text-slate-100">
                    {Math.round(loadRatio * 100)}% ({reportData.liveState.axialLoadKN.toFixed(0)} kN)
                  </span>
                </div>
              </div>

              {/* Tùy chọn bảng đối chiếu 5 tổ hợp */}
              <label className="flex items-start gap-2.5 bg-[#080c13] border border-slate-800 rounded-lg p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBenchmarkTable}
                  onChange={(e) => {
                    setExportedFile(null);
                    setIncludeBenchmarkTable(e.target.checked);
                  }}
                  className="mt-0.5 accent-emerald-500 cursor-pointer"
                />
                <span className="text-xs text-slate-300 leading-snug">
                  Kèm bảng đối chiếu 5 tổ hợp (M0–C2) ở cuối trang báo cáo
                </span>
              </label>

              {exportedFile && (
                <div className="flex items-start gap-2 bg-emerald-950/50 border border-emerald-500/40 rounded-lg p-3 text-xs text-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Đã tạo và tải xuống báo cáo PDF</div>
                    <div className="font-mono text-[11px] text-emerald-300/90 mt-0.5 break-all">
                      {exportedFile}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Tải tệp PDF (.pdf)</span>
            </button>
          </div>

          {/* Bản xem trước trang A4 */}
          <div className="lg:col-span-7 bg-[#080c13] border border-slate-800 rounded-lg p-3 flex flex-col items-center">
            <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mb-2">
              <span>Bản xem trước trang A4 (210 × 297 mm)</span>
              <span className="font-mono">Tổ hợp {groupId}</span>
            </div>
            <div className="w-full max-w-[360px] aspect-[1240/1754] bg-white rounded shadow-xl overflow-hidden border border-slate-700">
              <canvas
                ref={previewCanvasRef}
                data-testid="pdf-preview-canvas"
                className="w-full h-full block"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
