import { Layers, ShieldCheck } from 'lucide-react';
import {
  computeSmartTooltipPosition,
  type SpecimenTooltipData,
} from '../utils/specimenTooltip';

interface SpecimenHoverTooltipProps {
  data: SpecimenTooltipData | null;
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  dockCollapsed: boolean;
}

export function SpecimenHoverTooltip({
  data,
  pointerX,
  pointerY,
  viewportWidth,
  viewportHeight,
  dockCollapsed,
}: SpecimenHoverTooltipProps) {
  if (!data) return null;

  const pos = computeSmartTooltipPosition({
    pointerX,
    pointerY,
    viewportWidth,
    viewportHeight,
    tooltipWidth: 320,
    tooltipHeight: data.assemblyHint ? 228 : 196,
    dockCollapsed,
  });

  return (
    <div
      role="tooltip"
      data-testid="specimen-hover-tooltip"
      data-component-key={data.key}
      style={{
        transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
      }}
      className="pointer-events-none fixed top-0 left-0 z-30 w-[320px] bg-[#0b1019]/96 border border-slate-700/90 rounded-xl p-3 shadow-2xl"
    >
      {/* Header: badge + vùng nối chồng */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-xs shrink-0"
            style={{ backgroundColor: data.accentColor }}
          />
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase truncate">
            {data.badge}
          </span>
        </div>
        {data.isOverlapZone && (
          <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-400/40 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0">
            Nối chồng 150 mm
          </span>
        )}
      </div>

      {/* Tên lớp / thành phần */}
      <div className="text-xs font-semibold text-slate-100 leading-snug">
        {data.title}
      </div>

      {/* Thông số vật liệu (2x2) */}
      <div className="grid grid-cols-2 gap-1.5 mt-2 bg-[#080c13] border border-slate-800/90 rounded-lg p-2">
        {data.metrics.map((m) => (
          <div key={m.label} className="min-w-0">
            <div className="text-[10px] text-slate-400 truncate">{m.label}</div>
            <div className="font-mono text-[11px] font-semibold text-slate-100 truncate mt-0.5">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Vai trò kỹ thuật */}
      <div className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-300 leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
        <p>
          <span className="font-semibold text-slate-200">Vai trò kỹ thuật: </span>
          {data.technicalRole}
        </p>
      </div>

      {data.assemblyHint && (
        <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center gap-1.5 text-[10px] text-amber-300/90">
          <Layers className="w-3 h-3 shrink-0" />
          <span>{data.assemblyHint}</span>
        </div>
      )}
    </div>
  );
}
