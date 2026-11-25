import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPdfFilename, buildPdfReportData } from './pdfReport';

test('buildPdfFilename formats clean deterministic PDF file names', () => {
  const date = new Date(2026, 10, 24, 15, 30);
  assert.equal(buildPdfFilename('C2', false, date), 'Bao_cao_FRP_C2_2026-11-24.pdf');
  assert.equal(buildPdfFilename('M0', true, date), 'Bao_cao_FRP_M0_NaCl60d_2026-11-24.pdf');
});

test('buildPdfReportData computes accurate dry and saline metrics for selected group', () => {
  const fixedDate = new Date(2026, 10, 24, 9, 5);
  const dryC2 = buildPdfReportData('C2', 0.85, false, fixedDate);
  assert.equal(dryC2.spec.id, 'C2');
  assert.equal(dryC2.effectiveFccMPa, 48.6);
  assert.equal(dryC2.deltaEffectiveFccPct, 91.3);
  assert.equal(dryC2.liveState.isPassiveConfinementActive, true);
  assert.equal(dryC2.comparisonRows.length, 5);
  assert.equal(dryC2.comparisonRows.filter((r) => r.isSelected).length, 1);

  const salineM0 = buildPdfReportData('M0', 1.0, true, fixedDate);
  assert.equal(salineM0.salineMode, true);
  assert.equal(salineM0.effectiveFccMPa, 20.7);
  assert.equal(salineM0.deltaEffectiveFccPct, 0);
  assert.equal(salineM0.liveState.isRuptured, true);
});
