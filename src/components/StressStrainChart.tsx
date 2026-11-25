import type { GroupId } from '../utils/frpData';
import {
  SPECIMEN_GROUPS,
  computeStressStrainPoint,
  generateStressStrainCurve,
} from '../utils/frpData';

interface StressStrainChartProps {
  groupId: GroupId;
  loadRatio: number;
  salineMode: boolean;
}

export function StressStrainChart({
  groupId,
  loadRatio,
  salineMode,
}: StressStrainChartProps) {
  const spec = SPECIMEN_GROUPS[groupId];
  const width = 330;
  const height = 132;
  const padL = 38;
  const padR = 14;
  const padT = 16;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxStrain = 10.0; // ‰
  const maxStress = 54.0; // MPa

  const toX = (eps: number) => padL + (eps / maxStrain) * plotW;
  const toY = (sig: number) => padT + plotH - (sig / maxStress) * plotH;

  const m0Pts = generateStressStrainCurve('M0', 32, salineMode);
  const dryPts = generateStressStrainCurve(groupId, 44, false);
  const activePts = generateStressStrainCurve(groupId, 44, salineMode);

  const toPath = (pts: Array<{ strainPermille: number; stressMPa: number }>) =>
    pts
      .map(
        (p, idx) =>
          `${idx === 0 ? 'M' : 'L'}${toX(p.strainPermille).toFixed(1)},${toY(p.stressMPa).toFixed(1)}`,
      )
      .join(' ');

  const current = computeStressStrainPoint(groupId, loadRatio, salineMode);
  const curX = toX(current.strainPermille);
  const curY = toY(current.stressMPa);

  // Vùng hiệu ứng bó hông (Passive confinement > 70% tải)
  const confinementStartStrain = 0.7 * spec.eccuPermille;
  const confX1 = toX(confinementStartStrain);
  const confX2 = toX(spec.eccuPermille);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-semibold text-slate-200">
          Biểu đồ Ứng suất – Biến dạng (σ – ε)
        </span>
        <span className="font-mono text-slate-400">
          σ={current.stressMPa.toFixed(1)} MPa · ε={current.strainPermille.toFixed(2)}‰
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-[126px] bg-[#080c13] border border-slate-800/90 rounded-md"
        role="img"
        aria-label={`Đường cong ứng suất biến dạng của tổ hợp ${groupId}`}
      >
        {/* Vùng bó hông thụ động (Load > 70%) cho nhóm FRP */}
        {spec.fiberType !== 'NONE' && (
          <rect
            x={confX1}
            y={padT}
            width={Math.max(0, confX2 - confX1)}
            height={plotH}
            fill="rgba(34, 211, 238, 0.08)"
          />
        )}

        {/* Lưới tọa độ ngang & dọc */}
        {[10, 20, 30, 40, 50].map((sVal) => (
          <g key={sVal}>
            <line
              x1={padL}
              y1={toY(sVal)}
              x2={width - padR}
              y2={toY(sVal)}
              stroke="rgba(148, 163, 184, 0.12)"
              strokeWidth="1"
            />
            <text
              x={padL - 5}
              y={toY(sVal) + 3}
              textAnchor="end"
              className="fill-slate-500 text-[9px] font-mono"
            >
              {sVal}
            </text>
          </g>
        ))}

        {[2, 4, 6, 8, 10].map((eVal) => (
          <g key={eVal}>
            <line
              x1={toX(eVal)}
              y1={padT}
              x2={toX(eVal)}
              y2={height - padB}
              stroke="rgba(148, 163, 184, 0.1)"
              strokeWidth="1"
            />
            <text
              x={toX(eVal)}
              y={height - padB + 11}
              textAnchor="middle"
              className="fill-slate-500 text-[9px] font-mono"
            >
              {eVal}
            </text>
          </g>
        ))}

        {/* Trục X và Y */}
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={height - padB}
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth="1"
        />
        <line
          x1={padL}
          y1={height - padB}
          x2={width - padR}
          y2={height - padB}
          stroke="rgba(148, 163, 184, 0.4)"
          strokeWidth="1"
        />

        {/* Nhãn trục (không chồng lấn với giá trị 50) */}
        <text x={padL} y={10} textAnchor="middle" className="fill-slate-400 text-[8.5px] font-mono">
          MPa
        </text>
        <text
          x={width - padR}
          y={height - 3}
          textAnchor="end"
          className="fill-slate-400 text-[8.5px] font-mono"
        >
          ε (‰)
        </text>

        {/* Đường đối chứng M0 nét đứt */}
        {groupId !== 'M0' && (
          <path
            d={toPath(m0Pts)}
            fill="none"
            stroke="#64748b"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
        )}

        {/* Đường trước xâm thực (nét mờ khi đang bật môi trường xâm thực) */}
        {salineMode && (
          <path
            d={toPath(dryPts)}
            fill="none"
            stroke={spec.curveColor}
            strokeOpacity="0.3"
            strokeWidth="1.4"
            strokeDasharray="3 3"
          />
        )}

        {/* Đường cong chính của tổ hợp đang chọn */}
        <path
          d={toPath(activePts)}
          fill="none"
          stroke={spec.curveColor}
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Đường gióng tọa độ hiện tại */}
        <line
          x1={padL}
          y1={curY}
          x2={curX}
          y2={curY}
          stroke={spec.curveColor}
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
        <line
          x1={curX}
          y1={curY}
          x2={curX}
          y2={height - padB}
          stroke={spec.curveColor}
          strokeOpacity="0.45"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {/* Điểm làm việc hiện tại */}
        <circle
          cx={curX}
          cy={curY}
          r={current.isRuptured ? 5.2 : 4}
          fill={current.isRuptured ? '#ef4444' : spec.curveColor}
          stroke="#090d14"
          strokeWidth="1.5"
        />

        {/* Chú thích đặt gọn góc dưới phải (khoảng trống dưới đường cong) */}
        {groupId !== 'M0' && (
          <g transform={`translate(${width - padR - 86}, ${height - padB - 10})`}>
            <line x1="0" y1="0" x2="14" y2="0" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x="18" y="3" className="fill-slate-400 text-[8.5px]">
              Đối chứng M0
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
