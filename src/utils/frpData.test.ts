import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIMEN_GROUPS,
  SPECIMEN_DIMENSIONS,
  computeStressStrainPoint,
  generateStressStrainCurve,
  computeExplodedLayerOffsets,
} from './frpData';

test('experimental group constants match specification', () => {
  assert.equal(SPECIMEN_DIMENSIONS.diameterMm, 150);
  assert.equal(SPECIMEN_DIMENSIONS.heightMm, 300);
  assert.equal(SPECIMEN_DIMENSIONS.overlapMm, 150);
  assert.equal(SPECIMEN_DIMENSIONS.epoxyBaseMm, 1.2);

  assert.equal(SPECIMEN_GROUPS.M0.fccMPa, 25.4);
  assert.equal(SPECIMEN_GROUPS.M0.eccuPermille, 2.8);
  assert.equal(SPECIMEN_GROUPS.M0.tauB_MPa, null);
  assert.equal(SPECIMEN_GROUPS.M0.kdPercent, 81.5);

  assert.equal(SPECIMEN_GROUPS.G1.fccMPa, 33.5);
  assert.equal(SPECIMEN_GROUPS.G1.deltaFccPct, 31.9);
  assert.equal(SPECIMEN_GROUPS.G1.tfMmPerLayer, 0.35);

  assert.equal(SPECIMEN_GROUPS.G2.fccMPa, 40.2);
  assert.equal(SPECIMEN_GROUPS.G2.eccuPermille, 9.2);
  assert.equal(SPECIMEN_GROUPS.G2.kdPercent, 96.0);

  assert.equal(SPECIMEN_GROUPS.C1.fccMPa, 39.8);
  assert.equal(SPECIMEN_GROUPS.C1.tfMmPerLayer, 0.167);
  assert.equal(SPECIMEN_GROUPS.C1.tauB_MPa, 2.42);

  assert.equal(SPECIMEN_GROUPS.C2.fccMPa, 48.6);
  assert.equal(SPECIMEN_GROUPS.C2.deltaFccPct, 91.3);
  assert.equal(SPECIMEN_GROUPS.C2.kdPercent, 97.5);
});

test('stress-strain model reaches target peak strength and rupture at 100% load', () => {
  const c2Zero = computeStressStrainPoint('C2', 0, false);
  assert.equal(c2Zero.stressMPa, 0);
  assert.equal(c2Zero.strainPermille, 0);
  assert.equal(c2Zero.isPassiveConfinementActive, false);
  assert.equal(c2Zero.isRuptured, false);

  const c2Peak = computeStressStrainPoint('C2', 1.0, false);
  assert.ok(Math.abs(c2Peak.stressMPa - 48.6) < 0.05);
  assert.equal(c2Peak.strainPermille, 7.8);
  assert.equal(c2Peak.isPassiveConfinementActive, true);
  assert.equal(c2Peak.isRuptured, true);
  assert.ok(c2Peak.hoopStressMPa > 1000);
});

test('passive confinement activates only above 70% load for FRP groups and never for M0', () => {
  const g1At65 = computeStressStrainPoint('G1', 0.65, false);
  const g1At75 = computeStressStrainPoint('G1', 0.75, false);
  const m0At85 = computeStressStrainPoint('M0', 0.85, false);

  assert.equal(g1At65.isPassiveConfinementActive, false);
  assert.equal(g1At75.isPassiveConfinementActive, true);
  assert.equal(m0At85.isPassiveConfinementActive, false);
  assert.equal(m0At85.hoopStressMPa, 0);
});

test('saline environment reduces residual strength proportionally to Kd', () => {
  const m0Dry = computeStressStrainPoint('M0', 0.72, false);
  const m0Saline = computeStressStrainPoint('M0', 0.72, true);
  assert.ok(m0Saline.stressMPa < m0Dry.stressMPa);

  const c2Dry = computeStressStrainPoint('C2', 1.0, false);
  const c2Saline = computeStressStrainPoint('C2', 1.0, true);
  // C2 giữ 97.5% cường độ so với M0 chỉ giữ 81.5%
  const c2Retention = c2Saline.stressMPa / c2Dry.stressMPa;
  assert.ok(c2Retention > 0.97 && c2Retention < 0.98);
});

test('exploded view layers match specimen composition', () => {
  const m0Layers = computeExplodedLayerOffsets('M0', 1.0);
  assert.equal(m0Layers.length, 1);

  const g1Layers = computeExplodedLayerOffsets('G1', 1.0);
  assert.equal(g1Layers.length, 5);

  const c2Layers = computeExplodedLayerOffsets('C2', 1.0);
  assert.equal(c2Layers.length, 6);
  assert.ok(c2Layers[5].radialOffset > c2Layers[1].radialOffset);

  const curve = generateStressStrainCurve('G2', 40, false);
  assert.equal(curve.length, 41);
  assert.equal(curve[0].stressMPa, 0);
  assert.ok(curve[40].stressMPa > 39.5);
});
