import assert from 'node:assert/strict';
import test from 'node:test';
import { computeCrackCameraPose, computeCrackInspectionReport } from './crackAnalysis';

test('computeCrackInspectionReport detects M0 45-degree shear crack at ultimate load', () => {
  const report = computeCrackInspectionReport({
    groupId: 'M0',
    loadRatio: 1.0,
    salineMode: false,
    hitPoint: { x: 0.45, y: 1.5, z: 0.6 },
  });

  assert.equal(report.heightMm, 150);
  assert.equal(report.severity, 'rupture');
  assert.equal(report.inOverlapZone, false);
  assert.ok(report.estimatedCrackWidthMm >= 3.0);
  assert.match(report.failureTitle, /45°/);
});

test('computeCrackInspectionReport detects C2 brittle fiber rupture and overlap zone', () => {
  // Angle atan2(0.55, 0.55) = 0.785 rad which lies in [-0.35 .. 1.65] overlap zone
  const report = computeCrackInspectionReport({
    groupId: 'C2',
    loadRatio: 1.0,
    salineMode: false,
    hitPoint: { x: 0.55, y: 1.48, z: 0.55 },
  });

  assert.equal(report.inOverlapZone, true);
  assert.equal(report.severity, 'rupture');
  assert.ok(report.hoopStrainPermille > 10);
  assert.match(report.failureTitle, /CFRP/);
  assert.match(report.failureTitle, /nối chồng 150 mm/);
});

test('computeCrackCameraPose places camera outward from clicked surface point', () => {
  const pose = computeCrackCameraPose(
    { x: 0.75, y: 1.5, z: 0 },
    { x: 1, y: 0, z: 0 },
    1.5,
  );
  assert.ok(pose.pos.x > 2.1);
  assert.equal(pose.target.y, 1.5);
});
