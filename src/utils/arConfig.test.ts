import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AR_PHYSICAL_SCALE,
  AR_BASE_PEDESTAL_OFFSET_M,
  computeArDimensionsMeters,
  getArCapabilitySummary,
} from './arConfig';

test('AR physical scale converts 100mm units accurately to 1:1 meters', () => {
  assert.equal(AR_PHYSICAL_SCALE, 0.1);
  assert.equal(AR_BASE_PEDESTAL_OFFSET_M, 0.07);

  const dimsC2 = computeArDimensionsMeters('C2');
  assert.equal(dimsC2.diameterM, 0.15);
  assert.equal(dimsC2.heightM, 0.3);
  assert.equal(dimsC2.overlapArcM, 0.15);
  assert.equal(dimsC2.reticleInnerRadiusM, 0.075);
  assert.ok(dimsC2.reticleOuterRadiusM > dimsC2.reticleInnerRadiusM);
  assert.equal(dimsC2.totalFrpThicknessMm, 0.334);

  const dimsM0 = computeArDimensionsMeters('M0');
  assert.equal(dimsM0.totalFrpThicknessMm, 0);
});

test('AR capability summary returns accurate Vietnamese diagnostics', () => {
  const supported = getArCapabilitySummary('supported');
  assert.equal(supported.canLaunchWebXR, true);
  assert.ok(supported.title.includes('WebXR AR'));

  const unsupported = getArCapabilitySummary('unsupported');
  assert.equal(unsupported.canLaunchWebXR, false);
  assert.ok(unsupported.detail.includes('ARCore'));

  const insecure = getArCapabilitySummary('insecure-context');
  assert.equal(insecure.canLaunchWebXR, false);
  assert.ok(insecure.title.includes('HTTPS'));
});
