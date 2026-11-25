import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArCompatModal, ArDomOverlay } from './components/ArOverlayAndModal';
import { CrackInspectorPanel } from './components/CrackInspectorPanel';
import { EngineeringDock } from './components/EngineeringDock';
import { PdfExportModal } from './components/PdfExportModal';
import { SpecimenHoverTooltip } from './components/SpecimenHoverTooltip';
import { FrpViewport, type FrpViewportHandle, type HoverSpecimenPayload } from './three/FrpViewport';
import type { ArSupportState } from './utils/arConfig';
import type { CrackInspectionReport } from './utils/crackAnalysis';
import type { CameraPreset, GroupId } from './utils/frpData';
import { buildSpecimenTooltipData } from './utils/specimenTooltip';

export default function App() {
  const [groupId, setGroupId] = useState<GroupId>('C2');
  const [explodeValue, setExplodeValue] = useState<number>(0);
  const [loadRatio, setLoadRatio] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [salineMode, setSalineMode] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [presetNonce, setPresetNonce] = useState<number>(0);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Trạng thái AR WebXR (1:1) & Chế độ thước chuẩn 1:1 trên màn hình
  const viewportRef = useRef<FrpViewportHandle | null>(null);
  const arOverlayRef = useRef<HTMLDivElement | null>(null);
  const [arSupport, setArSupport] = useState<ArSupportState>('checking');
  const [arModalOpen, setArModalOpen] = useState<boolean>(false);
  const [arActive, setArActive] = useState<boolean>(false);
  const [arPlaced, setArPlaced] = useState<boolean>(false);
  const [arStatusMessage, setArStatusMessage] = useState<string>(
    'Hướng camera xuống mặt bàn hoặc sàn phẳng để quét vị trí đặt mẫu 1:1.',
  );
  const [arShowFrame, setArShowFrame] = useState<boolean>(false);
  const [arError, setArError] = useState<string | null>(null);
  const [scaleMode1to1, setScaleMode1to1] = useState<boolean>(false);
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [crackAnalysisMode, setCrackAnalysisMode] = useState<boolean>(false);
  const [inspectionReport, setInspectionReport] = useState<CrackInspectionReport | null>(null);
  const [hoverPayload, setHoverPayload] = useState<HoverSpecimenPayload | null>(null);
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    const onResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const hoverTooltipData = useMemo(() => {
    if (!hoverPayload || arActive || crackAnalysisMode || pdfModalOpen || arModalOpen) {
      return null;
    }
    return buildSpecimenTooltipData({
      componentKey: hoverPayload.componentKey,
      groupId,
      loadRatio,
      salineMode,
      explodeValue,
      isOverlapZone: hoverPayload.isOverlapZone,
    });
  }, [hoverPayload, arActive, crackAnalysisMode, pdfModalOpen, arModalOpen, groupId, loadRatio, salineMode, explodeValue]);

  // Tự động tăng tải thí nghiệm nén khi bật Play
  useEffect(() => {
    if (!isPlaying) return;
    let last = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setLoadRatio((prev) => {
        const next = prev + dt * 0.16; // ~6.2 giây từ 0% lên 100%
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  // Phím tắt H để thu gọn / mở bảng điều khiển
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (loadRatio >= 0.995) {
      setLoadRatio(0);
    }
    setIsPlaying((prev) => !prev);
  }, [loadRatio]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setLoadRatio(0);
    setExplodeValue(0);
  }, []);

  const handleSelectCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
    setPresetNonce((n) => n + 1);
  }, []);

  const handleLaunchWebXR = useCallback(async () => {
    setArError(null);
    try {
      await viewportRef.current?.startArSession();
      setArModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Thiết bị từ chối hoặc không hỗ trợ hit-test.';
      setArError(msg);
      setArModalOpen(true);
    }
  }, []);

  const handleOpenAr = useCallback(() => {
    setArError(null);
    setArModalOpen(true);
  }, []);

  const handleArStatusChange = useCallback((placed: boolean, message: string) => {
    setArPlaced(placed);
    setArStatusMessage(message);
  }, []);

  const handleToggleCrackAnalysis = useCallback(() => {
    setCrackAnalysisMode((prev) => {
      const next = !prev;
      if (next) {
        setIsPlaying(false);
        setExplodeValue(0);
        setLoadRatio((cur) => (cur < 0.72 ? 1.0 : cur));
      } else {
        setInspectionReport(null);
        viewportRef.current?.clearInspectionMarker();
        setCameraPreset('overview');
        setPresetNonce((n) => n + 1);
      }
      return next;
    });
  }, []);

  const handleResetCrackZoom = useCallback(() => {
    setInspectionReport(null);
    viewportRef.current?.clearInspectionMarker();
    setCameraPreset('overview');
    setPresetNonce((n) => n + 1);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#090d14]">
      <FrpViewport
        ref={viewportRef}
        groupId={groupId}
        explodeValue={explodeValue}
        loadRatio={loadRatio}
        salineMode={salineMode}
        cameraPreset={cameraPreset}
        presetNonce={presetNonce}
        scaleMode1to1={scaleMode1to1}
        arActive={arActive}
        arShowFrame={arShowFrame}
        arOverlayRef={arOverlayRef}
        onArSupportChange={setArSupport}
        onArSessionChange={(active) => {
          setArActive(active);
          if (!active) setArPlaced(false);
        }}
        onArStatusChange={handleArStatusChange}
        crackAnalysisMode={crackAnalysisMode}
        onSurfaceInspect={setInspectionReport}
        onHoverComponentChange={setHoverPayload}
      />

      <EngineeringDock
        groupId={groupId}
        onSelectGroup={(id) => {
          setGroupId(id);
          setInspectionReport(null);
          viewportRef.current?.clearInspectionMarker();
        }}
        explodeValue={explodeValue}
        onExplodeChange={setExplodeValue}
        loadRatio={loadRatio}
        onLoadChange={(val) => {
          setIsPlaying(false);
          setLoadRatio(val);
        }}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onResetSimulation={handleReset}
        salineMode={salineMode}
        onToggleSaline={() => setSalineMode((prev) => !prev)}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={handleSelectCameraPreset}
        dockCollapsed={dockCollapsed}
        onToggleDock={() => setDockCollapsed((prev) => !prev)}
        scaleMode1to1={scaleMode1to1}
        arActive={arActive}
        onOpenAr={handleOpenAr}
        onOpenPdfExport={() => setPdfModalOpen(true)}
        crackAnalysisMode={crackAnalysisMode}
        onToggleCrackAnalysis={handleToggleCrackAnalysis}
      />

      <CrackInspectorPanel
        active={crackAnalysisMode && !arActive}
        report={inspectionReport}
        loadRatio={loadRatio}
        onJumpToUltimateLoad={() => {
          setIsPlaying(false);
          setLoadRatio(1.0);
        }}
        onResetZoom={handleResetCrackZoom}
        onExitMode={handleToggleCrackAnalysis}
      />

      <SpecimenHoverTooltip
        data={hoverTooltipData}
        pointerX={hoverPayload?.clientX ?? 0}
        pointerY={hoverPayload?.clientY ?? 0}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        dockCollapsed={dockCollapsed}
      />

      <PdfExportModal
        open={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        groupId={groupId}
        onSelectGroup={setGroupId}
        loadRatio={loadRatio}
        salineMode={salineMode}
      />

      <ArCompatModal
        open={arModalOpen}
        onClose={() => setArModalOpen(false)}
        arSupport={arSupport}
        arError={arError}
        groupId={groupId}
        scaleMode1to1={scaleMode1to1}
        onToggleScaleMode={() => setScaleMode1to1((prev) => !prev)}
        onLaunchWebXR={handleLaunchWebXR}
      />

      <ArDomOverlay
        overlayRef={arOverlayRef}
        arActive={arActive}
        arPlaced={arPlaced}
        arStatusMessage={arStatusMessage}
        groupId={groupId}
        explodeValue={explodeValue}
        arShowFrame={arShowFrame}
        onSelectGroup={setGroupId}
        onExplodeChange={setExplodeValue}
        onToggleShowFrame={() => setArShowFrame((prev) => !prev)}
        onPlaceAtReticle={() => viewportRef.current?.placeArAtReticle()}
        onResetPlacement={() => viewportRef.current?.resetArPlacement()}
        onExitAr={() => {
          viewportRef.current?.endArSession().catch(() => {});
        }}
      />
    </main>
  );
}

