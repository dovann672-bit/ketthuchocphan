import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSpecimenTooltipData,
  computeSmartTooltipPosition,
  selectHoveredComponent,
} from './specimenTooltip';

test('selectHoveredComponent prioritizes FRP wrap underneath transparent topcoat when assembled', () => {
  const hit = selectHoveredComponent(
    [
      { componentKey: 'topcoat', isOverlapZone: false, distance: 4.1 },
      { componentKey: 'frp2', isOverlapZone: true, distance: 4.13 },
      { componentKey: 'epoxy', isOverlapZone: false, distance: 4.17 },
      { componentKey: 'concrete', isOverlapZone: false, distance: 4.21 },
    ],
    0,
    'C2',
  );

  assert.ok(hit);
  assert.equal(hit.componentKey, 'frp2');
  assert.equal(hit.isOverlapZone, true);
});

test('selectHoveredComponent selects exact outer layer when exploded view is active', () => {
  const hitTopcoat = selectHoveredComponent(
    [
      { componentKey: 'topcoat', isOverlapZone: false, distance: 3.5 },
      { componentKey: 'frp2', isOverlapZone: false, distance: 3.85 },
    ],
    0.6,
    'C2',
  );
  assert.equal(hitTopcoat?.componentKey, 'topcoat');

  const hitEpoxy = selectHoveredComponent(
    [
      { componentKey: 'epoxy', isOverlapZone: false, distance: 3.9 },
      { componentKey: 'primer', isOverlapZone: false, distance: 4.15 },
    ],
    0.6,
    'G1',
  );
  assert.equal(hitEpoxy?.componentKey, 'epoxy');
});

test('buildSpecimenTooltipData returns accurate Vietnamese material specs and roles for concrete, epoxy, and FRP', () => {
  const m0Conc = buildSpecimenTooltipData({
    componentKey: 'concrete',
    groupId: 'M0',
    loadRatio: 0,
    salineMode: true,
    explodeValue: 0,
  });
  assert.match(m0Conc.title, /Lõi Bê tông B25/);
  assert.match(m0Conc.technicalRole, /81\.5%/);

  const epoxy = buildSpecimenTooltipData({
    componentKey: 'epoxy',
    groupId: 'G2',
    loadRatio: 0.5,
    salineMode: false,
    explodeValue: 0.5,
  });
  assert.match(epoxy.title, /Sikadur-330/);
  assert.equal(epoxy.metrics.find((m) => m.label === 'Chiều dày lớp')?.value, '1.2 mm');
  assert.equal(epoxy.metrics.find((m) => m.label === 'Ứng suất cắt τb')?.value, '2.28 MPa');

  const c2Overlap = buildSpecimenTooltipData({
    componentKey: 'frp2',
    groupId: 'C2',
    loadRatio: 0.85,
    salineMode: false,
    explodeValue: 0,
    isOverlapZone: true,
  });
  assert.equal(c2Overlap.isOverlapZone, true);
  assert.match(c2Overlap.title, /CFRP.*Lớp 2\/2/);
  assert.equal(c2Overlap.metrics.find((m) => m.label === 'Chiều dày tf / lớp')?.value, '0.167 mm');
  assert.match(c2Overlap.technicalRole, /nối chồng 150 mm/i);
  assert.ok(c2Overlap.assemblyHint !== null);
});

test('computeSmartTooltipPosition flips left and upward to stay within safe viewport bounds', () => {
  const bottomRight = computeSmartTooltipPosition({
    pointerX: 1380,
    pointerY: 720,
    viewportWidth: 1440,
    viewportHeight: 900,
    tooltipWidth: 320,
    tooltipHeight: 210,
    dockCollapsed: false,
  });
  assert.ok(bottomRight.left + 320 <= 1440 - 16);
  assert.ok(bottomRight.top >= 78);
  assert.ok(bottomRight.top + 210 <= 900 - 16);

  const nearDock = computeSmartTooltipPosition({
    pointerX: 720,
    pointerY: 410,
    viewportWidth: 1440,
    viewportHeight: 900,
    tooltipWidth: 320,
    tooltipHeight: 196,
    dockCollapsed: false,
  });
  assert.ok(nearDock.top + 196 <= 900 - 305);

  const topLeft = computeSmartTooltipPosition({
    pointerX: 10,
    pointerY: 20,
    viewportWidth: 1440,
    viewportHeight: 900,
  });
  assert.ok(topLeft.left >= 16);
  assert.ok(topLeft.top >= 78);
});
