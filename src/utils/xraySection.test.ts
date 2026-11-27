import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampXrayHeightMm,
  computeXrayCameraPose,
  computeXrayCrossSection,
} from './xraySection';

test('clampXrayHeightMm clamps cut height within 15..285 mm', () => {
  assert.equal(clampXrayHeightMm(0), 15);
  assert.equal(clampXrayHeightMm(300), 285);
  assert.equal(clampXrayHeightMm(150.4), 150);
  assert.equal(clampXrayHeightMm(Number.NaN), 150);
});

test('computeXrayCrossSection returns concrete-only band for M0 and full 6-band stack for C2', () => {
  const m0 = computeXrayCrossSection('M0', 150, 0, false);
  assert.equal(m0.bands.length, 1);
  assert.equal(m0.totalJacketThicknessMm, 0);
  assert.equal(m0.hasOverlapAtCut, false);
  assert.ok(Math.abs(m0.cutWorldY - 1.5) < 0.001);

  const c2 = computeXrayCrossSection('C2', 150, 0, false);
  assert.equal(c2.bands.length, 6);
  assert.equal(c2.hasOverlapAtCut, true);
  // 0.15 (primer) + 1.2 (epoxy) + 2 * 0.167 (CFRP) + 0.25 (topcoat) = 1.934 mm
  assert.ok(Math.abs(c2.totalJacketThicknessMm - 1.934) < 0.001);
  assert.equal(c2.bands[2].thicknessLabel, '1.20 mm');
  assert.equal(c2.bands[3].thicknessLabel, '0.167 mm');
});

test('computeXrayCrossSection reflects barrel bulge at mid-height under high load', () => {
  const unloaded = computeXrayCrossSection('G2', 150, 0, false);
  const loaded = computeXrayCrossSection('G2', 150, 0.9, false);
  assert.ok(loaded.radialBulgeScale > unloaded.radialBulgeScale);
  assert.ok(loaded.effectiveDiameterMm > unloaded.effectiveDiameterMm);
  assert.ok(loaded.totalJacketThicknessMm > 2.0); // GFRP tf = 0.35 * 2 + 1.2 + 0.15 + 0.25 = 2.30 mm
});

test('computeXrayCameraPose positions camera above the active cut plane', () => {
  const angled = computeXrayCameraPose(1.5, false);
  assert.ok(angled.pos[1] > 3.0);
  const topDown = computeXrayCameraPose(1.5, true);
  assert.ok(topDown.pos[1] > 4.0);
  assert.ok(topDown.pos[0] < angled.pos[0]);
});
