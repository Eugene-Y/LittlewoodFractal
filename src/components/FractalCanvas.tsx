import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Complex,
  generatePolynomialByIndex,
  getTotalPolynomials,
  findRootsDurandKerner,
} from "@/lib/math";
import { GridConfig, snapToGrid } from "@/lib/grid";

interface FractalCanvasProps {
  degree: number;
  coefficients: Complex[];
  onCoefficientsChange: (coefficients: Complex[]) => void;
  onCoefficientSelect?: (index: number) => void;
  onRenderComplete?: () => void;
  maxRoots: number;
  maxIterations: number;
  transparency: number;
  colorBandWidth: number;
  blendMode: GlobalCompositeOperation;
  offsetX: number;
  offsetY: number;
  zoom: number;
  polynomialNeighborRange: number;
  gridConfig: GridConfig;
  onOffsetChange: (x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
  onResetView: () => void;
  onConvergenceStats?: (stats: ConvergenceStats) => void;
  onExportRequest?: () => void;
}

export interface FractalCanvasRef {
  exportToCanvas: () => HTMLCanvasElement | null;
}

interface ConvergenceStats {
  totalRoots: number;
  convergedRoots: number;
  convergenceRate: number;
  avgIterations: number;
}

export const FractalCanvas = forwardRef<FractalCanvasRef, FractalCanvasProps>(({ degree, coefficients, onCoefficientsChange, onCoefficientSelect, onRenderComplete, maxRoots, maxIterations, transparency, colorBandWidth, blendMode, offsetX, offsetY, zoom, polynomialNeighborRange, gridConfig, onOffsetChange, onZoomChange, onResetView, onConvergenceStats }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [rootCount, setRootCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 1200 });
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredPolynomialIndex, setHoveredPolynomialIndex] = useState<number | null>(null);

  // Pan gesture state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  // Pinch gesture state
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [lastDoubleTapTime, setLastDoubleTapTime] = useState(0);

  // Interactive transform state - snapshot of offscreen canvas before gesture
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotParamsRef = useRef<{ offsetX: number; offsetY: number; zoom: number } | null>(null);
  const [isInteractiveTransform, setIsInteractiveTransform] = useState(false);

  // Batch rendering state
  const [renderProgress, setRenderProgress] = useState(0);
  const [currentRenderFrame, setCurrentRenderFrame] = useState(0);
  const [totalFramesToRender, setTotalFramesToRender] = useState(0); // Used for info only, not for render control
  const [theoreticalMaxRoots, setTheoreticalMaxRoots] = useState(0); // Used for progress display
  const renderingRef = useRef<{ id: number; animationId?: number }>({ id: 0 });

  // Overlay rendering state (async)
  const overlayRenderingRef = useRef<{ id: number; animationId?: number }>({ id: 0 });
  const [overlayRenderProgress, setOverlayRenderProgress] = useState(0);
  const previousRenderParams = useRef<{
    framesToRender: number;
    degree: number;
    coefficients: Complex[];
    transparency: number;
    colorBandWidth: number;
    blendMode: GlobalCompositeOperation;
    canvasSize: { width: number; height: number };
    offsetX: number;
    offsetY: number;
    zoom: number;
  }>({
    framesToRender: 0,
    degree: 0,
    coefficients: [],
    transparency: 0,
    colorBandWidth: 0,
    blendMode: 'source-over',
    canvasSize: { width: 0, height: 0 },
    offsetX: 0,
    offsetY: 0,
    zoom: 1
  });
  // Dynamic batch size based on polynomial complexity
  // Root finding is O(degree²) - degree has quadratic impact on cost
  // Polynomial generation is O(coeffCount) - linear impact
  // Higher complexity → smaller batch size (more expensive per polynomial)
  const getBatchSize = (deg: number, coeffCount: number): number => {
    // Complexity: degree² × coeffCount
    // Calibrated so deg=31 with few coefficients still gives ~128 batch
    // deg=31, coeffs=2  → 961×2  = 1922  → batch 128
    // deg=31, coeffs=30 → 961×30 = 28830 → batch 128
    // deg=2,  coeffs=30 → 4×30   = 120   → batch 2048
    // deg=2,  coeffs=1  → 4×1    = 4     → batch 16384
    const complexity = (deg * deg) * Math.max(coeffCount, 1);
    // Calibrated: complexity ~1900 (deg=31, coeffs=2) gives batch 128
    const baseBatch = Math.round((128 * 1900) / complexity);
    // Round to nearest power of 2
    const power = Math.round(Math.log2(baseBatch));
    const clamped = Math.max(7, Math.min(14, power)); // 128 to 16384
    return Math.pow(2, clamped);
  };
  const BATCH_SIZE = getBatchSize(degree, coefficients.length);

  // Fixed viewport for consistent scaling
  const VIEWPORT_SIZE = 6; // Shows from -3 to 3 on both axes

  // Expose export method via ref
  useImperativeHandle(ref, () => ({
    exportToCanvas: () => {
      const offscreenCanvas = offscreenCanvasRef.current;
      const canvas = canvasRef.current;
      if (!offscreenCanvas || !canvas) return null;

      // Create a new canvas for export
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const exportCtx = exportCanvas.getContext('2d');
      if (!exportCtx) return null;

      // Clear with dark background
      exportCtx.fillStyle = "#0a0a14";
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

      // Draw accumulated roots from offscreen canvas
      exportCtx.drawImage(offscreenCanvas, 0, 0);

      // Draw coefficient dots as double rings (black + white)
      // Export uses current view (with pan/zoom applied)
      const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
      const scale = baseScale * zoom;
      const toCanvasX = (re: number) => canvas.width / 2 + (re - offsetX) * scale;
      const toCanvasY = (im: number) => canvas.height / 2 - (im - offsetY) * scale;
      const baseRadius = isMobile ? Math.min(canvas.width, canvas.height) * 0.025 : 8;

      coefficients.forEach((coeff) => {
        const x = toCanvasX(coeff.re);
        const y = toCanvasY(coeff.im);

        // Draw black ring (outer)
        exportCtx.strokeStyle = 'black';
        exportCtx.lineWidth = 5;
        exportCtx.beginPath();
        exportCtx.arc(x, y, baseRadius, 0, 2 * Math.PI);
        exportCtx.stroke();

        // Draw white ring (inner)
        exportCtx.strokeStyle = 'white';
        exportCtx.lineWidth = 3;
        exportCtx.beginPath();
        exportCtx.arc(x, y, baseRadius, 0, 2 * Math.PI);
        exportCtx.stroke();
      });

      return exportCanvas;
    }
  }));

  // Update canvas size to fill screen
  useEffect(() => {
    const updateCanvasSize = () => {
      if (containerRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const newWidth = window.innerWidth * dpr;
        const newHeight = window.innerHeight * dpr;

        setCanvasSize({
          width: newWidth,
          height: newHeight
        });

        // Create or resize offscreen canvas for roots accumulation
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement('canvas');
        }
        offscreenCanvasRef.current.width = newWidth;
        offscreenCanvasRef.current.height = newHeight;

        // Detect mobile based on screen size
        setIsMobile(window.innerWidth < 768);
      }
    };

    // Initial update with small delay to ensure container is rendered
    setTimeout(updateCanvasSize, 0);
    window.addEventListener('resize', updateCanvasSize);
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      // Cancel any ongoing animation on unmount
      if (renderingRef.current.animationId) {
        cancelAnimationFrame(renderingRef.current.animationId);
      }
    };
  }, []);

  // Keyboard controls for zoom (desktop only)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only on desktop (not mobile)
      if (isMobile) return;

      // Ignore when focus is in input fields (e.g., formula inputs)
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      // + or = key (with or without shift) - zoom in 2x
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        if (!isInteractiveTransform) {
          createSnapshot();
        }
        const newZoom = zoom * (2 ** 0.25);
        onZoomChange(newZoom);
      }
      // - or _ key - zoom out 2x
      else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        if (!isInteractiveTransform) {
          createSnapshot();
        }
        const newZoom = zoom / (2 ** 0.25);
        onZoomChange(newZoom);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isMobile) return;
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        endInteractiveTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoom, onZoomChange, isMobile, isInteractiveTransform]);

  // Handle polynomial overlay rendering when hoveredPolynomialIndex changes
  useEffect(() => {
    if (hoveredPolynomialIndex !== null) {
      startOverlayRendering(hoveredPolynomialIndex);
    } else {
      stopOverlayRendering();
    }

    // Cleanup on unmount or when index changes
    return () => {
      if (overlayRenderingRef.current.animationId) {
        cancelAnimationFrame(overlayRenderingRef.current.animationId);
      }
    };
  }, [hoveredPolynomialIndex, degree, coefficients, polynomialNeighborRange, zoom, offsetX, offsetY]);

  // Store gridConfig in ref so renderFractal loop always uses latest value
  const gridConfigRef = useRef(gridConfig);
  useEffect(() => {
    gridConfigRef.current = gridConfig;
    // Redraw overlay immediately with new grid config
    redrawCoordinateOverlay(renderProgress, currentRenderFrame, isRendering, rootCount, theoreticalMaxRoots);
  }, [gridConfig]);

  useEffect(() => {
    setErrorMessage(null);

    // Calculate how many frames we would render with current parameters
    const totalPolynomials = getTotalPolynomials(degree, coefficients.length);
    const theoreticalTotalRoots = totalPolynomials * degree;
    const skipRatio = theoreticalTotalRoots > maxRoots ? theoreticalTotalRoots / maxRoots : 1;
    const skipInterval = Math.ceil(skipRatio);
    const polynomialsToRender = skipRatio > 1 ? Math.ceil(totalPolynomials / skipInterval) : totalPolynomials;
    const framesToRender = Math.ceil(polynomialsToRender / BATCH_SIZE);

    // Update theoretical max immediately for display (even before render starts)
    setTheoreticalMaxRoots(theoreticalTotalRoots);
    setTotalFramesToRender(framesToRender);

    const prev = previousRenderParams.current;

    // Check each parameter independently - any change triggers re-render
    // Exception: maxRoots only triggers if framesToRender actually changed
    const shouldRender = (
      prev.degree !== degree ||
      prev.coefficients.length !== coefficients.length ||
      prev.coefficients.some((c, i) => c.re !== coefficients[i]?.re || c.im !== coefficients[i]?.im) ||
      prev.transparency !== transparency ||
      prev.colorBandWidth !== colorBandWidth ||
      prev.blendMode !== blendMode ||
      prev.canvasSize.width !== canvasSize.width ||
      prev.canvasSize.height !== canvasSize.height ||
      prev.offsetX !== offsetX ||
      prev.offsetY !== offsetY ||
      prev.zoom !== zoom ||
      prev.framesToRender !== framesToRender
    );

    if (shouldRender) {
      // Update previous render params
      previousRenderParams.current = {
        framesToRender,
        degree,
        coefficients: [...coefficients],
        transparency,
        colorBandWidth,
        blendMode,
        canvasSize: { ...canvasSize },
        offsetX,
        offsetY,
        zoom
      };

      // Always render in background, even during interactive transforms
      // Snapshot will be shown to user for instant feedback, but offscreen canvas
      // will be updated in background and displayed when gesture ends
      renderFractal();
    }
  }, [degree, coefficients, maxRoots, maxIterations, transparency, colorBandWidth, blendMode, canvasSize, offsetX, offsetY, zoom]);

  const renderFractal = async () => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    if (!canvas || !offscreenCanvas) return;

    // Cancel any ongoing render by incrementing ID
    if (renderingRef.current.animationId) {
      cancelAnimationFrame(renderingRef.current.animationId);
    }

    // Start new render with unique ID
    const currentRenderId = renderingRef.current.id + 1;
    renderingRef.current = { id: currentRenderId };
    setIsRendering(true);
    setRenderProgress(0);
    setCurrentRenderFrame(0);

    const ctx = canvas.getContext("2d");
    const offscreenCtx = offscreenCanvas.getContext("2d", {
      alpha: true,
      desynchronized: true,  // Allow desync for better performance
      willReadFrequently: false  // We only write, never read pixels
    });
    if (!ctx || !offscreenCtx) return;

    // Clear offscreen canvas (transparent background for roots accumulation)
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Set composite operation to blend semi-transparent pixels
    offscreenCtx.globalCompositeOperation = blendMode;

    // Disable antialiasing for better performance
    offscreenCtx.imageSmoothingEnabled = false;

    // Calculate total polynomials without allocating memory for them
    const totalPolynomials = getTotalPolynomials(degree, coefficients.length);

    // Calculate theoretical total roots for consistent hue calculation
    const theoreticalTotalRoots = totalPolynomials * degree;

    // Adaptive max iterations based on polynomial degree (2x increase for better convergence)
    const adaptiveMaxIterations = Math.min(200, Math.max(40, degree * 20));

    // Calculate polynomial skip interval to limit total rendered roots
    //
    // OBSERVED PHENOMENON: Changing maxRoots causes skipInterval to change, which results in
    // rendering completely different polynomial indices (e.g., skipInterval=60 renders 0,60,120...
    // while skipInterval=57 renders 0,57,114...). This creates a visual "jumping" effect where
    // groups of roots appear/disappear as the slider changes. This is NOT a bug, but reveals
    // an interesting property: polynomial indices are correlated with the geometric distribution
    // of their roots, suggesting that Littlewood polynomials have an inherent structure where
    // nearby indices produce geometrically related roots.
    //
    // FUTURE RESEARCH: This could be explored by rendering polynomials grouped by modulo classes
    // (e.g., all polynomials where index % 100 = 0) on separate canvas layers, allowing users
    // to visualize and toggle different "families" of polynomials and their geometric structures.
    const skipRatio = theoreticalTotalRoots > maxRoots
      ? theoreticalTotalRoots / maxRoots
      : 1;
    const skipInterval = Math.ceil(skipRatio);

    // Calculate actual polynomials to render (evenly distributed)
    const polynomialsToRender = skipRatio > 1
      ? Math.ceil(totalPolynomials / skipInterval)
      : totalPolynomials;

    // Calculate number of frames needed (each frame processes BATCH_SIZE polynomials)
    const framesToRender = Math.ceil(polynomialsToRender / BATCH_SIZE);

    // Calculate effective roots for color distribution
    // If rendering fewer than 256 frames, normalize to 256 frames for better color coverage
    const MIN_FRAMES_FOR_COLOR = 256;
    const effectiveRootsForColor = framesToRender < MIN_FRAMES_FOR_COLOR
      ? Math.min(MIN_FRAMES_FOR_COLOR * BATCH_SIZE, totalPolynomials) * degree
      : theoreticalTotalRoots;

    // Estimate rendering time (assuming 60 FPS)
    const estimatedSeconds = framesToRender / 60;
    const estimatedTime = estimatedSeconds < 60
      ? `${estimatedSeconds.toFixed(1)}s`
      : `${(estimatedSeconds / 60).toFixed(1)}m`;

    // Log rendering info once at the start
    console.log(`[Fractal Render Start]
  Batch size: ${BATCH_SIZE.toLocaleString()} polynomials per frame
  Total polynomials: ${totalPolynomials.toLocaleString()}
  Theoretical max roots: ${theoreticalTotalRoots.toLocaleString()}
  Max roots to draw: ${maxRoots === Infinity ? '∞' : maxRoots.toLocaleString()}
  Skip interval: every ${skipInterval} polynomials
  Polynomials to render: ${polynomialsToRender.toLocaleString()} (${((polynomialsToRender / totalPolynomials) * 100).toFixed(1)}%)
  Frames to render: ${framesToRender.toLocaleString()}
  Adaptive max iterations: ${adaptiveMaxIterations} (degree ${degree})
  Estimated time: ${estimatedTime} @ 60 FPS`);

    // Shared rendering state
    let currentFrame = 0;
    let totalConverged = 0;
    let totalIterations = 0;
    let processedRoots = 0;
    let currentPolynomialIndex = 0; // Track which polynomial we're processing (0-indexed)

    // Equal scale for both axes with zoom applied
    const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const scale = baseScale * zoom;
    const toCanvasX = (re: number) => canvas.width / 2 + (re - offsetX) * scale;
    const toCanvasY = (im: number) => canvas.height / 2 - (im - offsetY) * scale;

    // Viewport culling bounds (skip rendering roots outside visible area)
    const margin = 2;
    const minX = -margin;
    const maxX = canvas.width + margin;
    const minY = -margin;
    const maxY = canvas.height + margin;

    // Frame processing function (processes BATCH_SIZE polynomials per frame)
    const processFrame = () => {
      // Check if this render has been cancelled (ID changed)
      if (renderingRef.current.id !== currentRenderId) return;

      // Update progress
      currentFrame++;
      const progress = (currentFrame / framesToRender) * 100;

      // Process BATCH_SIZE polynomials with sparse indices (every skipInterval-th polynomial)
      let processedInThisFrame = 0;
      while (processedInThisFrame < BATCH_SIZE && currentPolynomialIndex < polynomialsToRender) {
          // Calculate the actual polynomial index (with skip interval)
          const polynomialIndex = currentPolynomialIndex * skipInterval;

          // Skip if we've gone past total polynomials
          if (polynomialIndex >= totalPolynomials) break;

          const poly = generatePolynomialByIndex(polynomialIndex, degree, coefficients);
          const result = findRootsDurandKerner(poly, adaptiveMaxIterations);

          if (result.converged) {
            totalConverged++;
            totalIterations += result.iterations;

            // Draw roots immediately on offscreen canvas
            result.roots.forEach((root, rootIndex) => {
              const x = toCanvasX(root.re);
              const y = toCanvasY(root.im);

              // Viewport culling: skip roots outside visible area
              if (x < minX || x > maxX || y < minY || y > maxY) return;

              // Calculate hue with interpolation between frame-local and global indexing
              // colorBandWidth: 0.0 = per frame, 1.0 = across all roots
              const theoreticalRootIndex = polynomialIndex * degree + rootIndex;
              const indexWithinFrame = processedInThisFrame * degree + rootIndex;
              const frameSize = BATCH_SIZE * degree;

              // Interpolate between two hue calculations
              const hueLocal = (indexWithinFrame / frameSize) * 360; // Repeats per frame
              const hueGlobal = (theoreticalRootIndex / effectiveRootsForColor) * 360; // Spans all roots
              const hue = hueLocal * (1 - colorBandWidth) + hueGlobal * colorBandWidth;

              // Simple solid color rendering (most performant)
              // Round coordinates to integer pixels for faster rendering
              offscreenCtx.fillStyle = `hsla(${hue}, 100%, 60%, ${transparency})`;
              offscreenCtx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);

              processedRoots++;
            });
          }

          processedInThisFrame++;
          currentPolynomialIndex++;
        }

      // Update root count and progress
      setRootCount(processedRoots);
      setRenderProgress(progress);
      setCurrentRenderFrame(currentFrame);

      // Redraw overlay with current values (will use snapshot if interactive transform is active)
      redrawCoordinateOverlay(progress, currentFrame, true, processedRoots, theoreticalTotalRoots);

      // Continue or finish
      if (currentPolynomialIndex < polynomialsToRender) {
        renderingRef.current.animationId = requestAnimationFrame(processFrame);
      } else {
        // Rendering complete
        setRenderProgress(100);

        // Final redraw without progress indicator (pass false for isRendering)
        redrawCoordinateOverlay(100, currentFrame, false, processedRoots, theoreticalTotalRoots);

        // Clear rendering flag after final redraw
        setIsRendering(false);

        // Report final convergence stats
        if (onConvergenceStats) {
          onConvergenceStats({
            totalRoots: processedRoots,
            convergedRoots: totalConverged,
            convergenceRate: totalPolynomials > 0 ? (totalConverged / totalPolynomials) * 100 : 0,
            avgIterations: totalPolynomials > 0 ? totalIterations / totalPolynomials : 0,
          });
        }

        onRenderComplete?.();
      }
    };

    // Start frame processing
    processFrame();
  };

  const toComplexCoord = (canvasX: number, canvasY: number): Complex => {
    const canvas = canvasRef.current;
    if (!canvas) return { re: 0, im: 0 };

    const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const scale = baseScale * zoom;
    const re = (canvasX - canvas.width / 2) / scale + offsetX;
    const im = -(canvasY - canvas.height / 2) / scale + offsetY;
    return { re, im };
  };

  const getCoeffAtPoint = (canvasX: number, canvasY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const scale = baseScale * zoom;
    const hitRadius = isMobile ? Math.min(canvas.width, canvas.height) * 0.04 : 15;

    for (let i = 0; i < coefficients.length; i++) {
      const x = canvas.width / 2 + (coefficients[i].re - offsetX) * scale;
      const y = canvas.height / 2 - (coefficients[i].im - offsetY) * scale;
      const dist = Math.sqrt((canvasX - x) ** 2 + (canvasY - y) ** 2);
      if (dist < hitRadius) return i;
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const index = getCoeffAtPoint(x, y);
    if (index !== null) {
      // Dragging a coefficient
      setDraggedIndex(index);
      onCoefficientSelect?.(index);
    } else {
      // Start panning - create snapshot for interactive preview
      createSnapshot();
      setIsPanning(true);
      setPanStart({ x, y, offsetX, offsetY });
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Reset view on double-click
    onResetView();
  };

  // Helper function to create snapshot of offscreen canvas before interactive transform
  const createSnapshot = () => {
    const offscreenCanvas = offscreenCanvasRef.current;
    if (!offscreenCanvas) {
      console.log('[Snapshot] No offscreen canvas');
      return;
    }

    // Create snapshot canvas if it doesn't exist
    if (!snapshotCanvasRef.current) {
      snapshotCanvasRef.current = document.createElement('canvas');
    }

    snapshotCanvasRef.current.width = offscreenCanvas.width;
    snapshotCanvasRef.current.height = offscreenCanvas.height;

    const snapshotCtx = snapshotCanvasRef.current.getContext('2d');
    if (!snapshotCtx) {
      console.log('[Snapshot] No snapshot context');
      return;
    }

    // Disable antialiasing for better performance
    snapshotCtx.imageSmoothingEnabled = false;

    // Copy current offscreen canvas to snapshot
    snapshotCtx.clearRect(0, 0, snapshotCanvasRef.current.width, snapshotCanvasRef.current.height);
    snapshotCtx.drawImage(offscreenCanvas, 0, 0);

    // Save current transform params
    snapshotParamsRef.current = { offsetX, offsetY, zoom };
    setIsInteractiveTransform(true);

    console.log('[Snapshot] Created snapshot:', {
      width: snapshotCanvasRef.current.width,
      height: snapshotCanvasRef.current.height,
      transform: { offsetX, offsetY, zoom }
    });
  };

  // Helper function to end interactive transform
  const endInteractiveTransform = () => {
    console.log('[Snapshot] Ending interactive transform');
    setIsInteractiveTransform(false);
    snapshotParamsRef.current = null;
    // Trigger immediate redraw to show updated offscreen canvas
    redrawCoordinateOverlay();
  };


  // Start async overlay rendering when hoveredPolynomialIndex changes
  const startOverlayRendering = (polynomialIndex: number) => {
    // Cancel any previous overlay rendering
    overlayRenderingRef.current.id++;
    if (overlayRenderingRef.current.animationId) {
      cancelAnimationFrame(overlayRenderingRef.current.animationId);
    }

    const currentRenderId = overlayRenderingRef.current.id;

    const overlayCanvas = overlayCanvasRef.current;
    const canvas = canvasRef.current;
    if (!overlayCanvas || !canvas) return;

    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const isLandscape = canvas.width > canvas.height;

    if (!isLandscape) {
      // Clear and return for portrait mode
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      return;
    }

    const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const scale = baseScale * zoom;
    const toCanvasX = (re: number) => canvas.width / 2 + (re - offsetX) * scale;
    const toCanvasY = (im: number) => canvas.height / 2 - (im - offsetY) * scale;

    // Calculate polynomial range to render
    const totalPolynomials = getTotalPolynomials(degree, coefficients.length);
    const startIndex = Math.max(0, polynomialIndex - polynomialNeighborRange);
    const endIndex = Math.min(totalPolynomials - 1, polynomialIndex + polynomialNeighborRange);
    const totalToRender = endIndex - startIndex + 1;

    const adaptiveMaxIterations = Math.min(200, Math.max(40, degree * 20));
    const OVERLAY_BATCH_SIZE = 8; // Process 8 polynomials per frame

    let currentPolyIdx = startIndex;

    // Clear and draw initial overlay
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    overlayCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
    overlayCtx.fillRect(0, 0, canvas.width, canvas.height);

    const processOverlayFrame = () => {
      // Check if cancelled
      if (overlayRenderingRef.current.id !== currentRenderId) return;

      // Process batch
      let processedInThisFrame = 0;
      while (processedInThisFrame < OVERLAY_BATCH_SIZE && currentPolyIdx <= endIndex) {
        const poly = generatePolynomialByIndex(currentPolyIdx, degree, coefficients);
        const result = findRootsDurandKerner(poly, adaptiveMaxIterations);

        if (result.converged) {
          result.roots.forEach((root) => {
            const x = toCanvasX(root.re);
            const y = toCanvasY(root.im);

            // Draw white opaque dots
            overlayCtx.fillStyle = "rgba(255, 255, 255, 1.0)";
            overlayCtx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
          });
        }

        currentPolyIdx++;
        processedInThisFrame++;
      }

      // Update progress
      const progress = ((currentPolyIdx - startIndex) / totalToRender) * 100;
      setOverlayRenderProgress(progress);

      // Continue or finish
      if (currentPolyIdx <= endIndex) {
        overlayRenderingRef.current.animationId = requestAnimationFrame(processOverlayFrame);
      }
    };

    // Start processing
    overlayRenderingRef.current.animationId = requestAnimationFrame(processOverlayFrame);
  };

  // Stop overlay rendering and clear
  const stopOverlayRendering = () => {
    overlayRenderingRef.current.id++;
    if (overlayRenderingRef.current.animationId) {
      cancelAnimationFrame(overlayRenderingRef.current.animationId);
    }
    setOverlayRenderProgress(0);

    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  };

  // Tooltip state for showing coordinates
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Update tooltip with coordinates
  const updateTooltip = (screenX: number, screenY: number, re: number, im: number) => {
    const text = `${re.toFixed(3)} ${im >= 0 ? '+' : ''}${im.toFixed(3)}i`;
    setTooltip({ x: screenX, y: screenY, text });
  };

  // Clear tooltip
  const clearTooltip = () => {
    setTooltip(null);
  };

  // Helper function to redraw the coordinate overlay
  const redrawCoordinateOverlay = (currentProgress?: number, currentFrame?: number, currentIsRendering?: boolean, currentRootCount?: number, currentTheoreticalMax?: number) => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    if (!canvas || !offscreenCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable antialiasing for better performance
    ctx.imageSmoothingEnabled = false;

    const dpr = window.devicePixelRatio || 1;
    const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const scale = baseScale * zoom;

    // Clear and redraw the entire canvas from scratch
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Use snapshot only during interactive transform
    const useSnapshot = isInteractiveTransform && snapshotCanvasRef.current && snapshotParamsRef.current;

    if (useSnapshot) {
      const snapshot = snapshotCanvasRef.current;
      const snapshotParams = snapshotParamsRef.current;

      console.log('[Redraw] Using snapshot + offscreen, isInteractive:', isInteractiveTransform);

      // FIRST: Draw transformed snapshot for instant feedback
      const snapshotBaseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
      const snapshotScale = snapshotBaseScale * snapshotParams.zoom;
      const currentScale = baseScale * zoom;

      // Calculate offset in canvas pixels
      const deltaOffsetX = (offsetX - snapshotParams.offsetX) * currentScale;
      const deltaOffsetY = (offsetY - snapshotParams.offsetY) * currentScale;
      const scaleRatio = currentScale / snapshotScale;

      // Apply transformation and draw snapshot
      ctx.save();
      ctx.translate(canvas.width / 2 - deltaOffsetX, canvas.height / 2 + deltaOffsetY);
      ctx.scale(scaleRatio, scaleRatio);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.drawImage(snapshot, 0, 0);
      ctx.restore();

      // SECOND: Draw current offscreen canvas on top to show rendering progress
      // This shows new roots being added in real-time during the gesture
      // Both canvases have transparent backgrounds, so they blend naturally
      ctx.drawImage(offscreenCanvas, 0, 0);
    } else {
      console.log('[Redraw] Using offscreen canvas only, isInteractive:', isInteractiveTransform);
      // Normal rendering: draw accumulated roots from offscreen canvas
      ctx.drawImage(offscreenCanvas, 0, 0);
    }

    // Helper functions for coordinate transformation
    const toCanvasX = (re: number) => canvas.width / 2 + (re - offsetX) * scale;
    const toCanvasY = (im: number) => canvas.height / 2 - (im - offsetY) * scale;

    // Calculate visible range
    const viewportWidth = VIEWPORT_SIZE / zoom;
    const viewportHeight = VIEWPORT_SIZE / zoom;
    const minRe = offsetX - viewportWidth / 2;
    const maxRe = offsetX + viewportWidth / 2;
    const minIm = offsetY - viewportHeight / 2;
    const maxIm = offsetY + viewportHeight / 2;

    // Draw grid lines (before axes so axes appear on top)
    ctx.lineWidth = 1;

    // Use ref for grid config so we always get latest value during render loop
    const currentGridConfig = gridConfigRef.current;

    // Rectangular grid
    if (currentGridConfig.rectangular.enabled && currentGridConfig.rectangular.step > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      const step = currentGridConfig.rectangular.step;

      // Vertical lines
      const startX = Math.floor(minRe / step) * step;
      for (let re = startX; re <= maxRe; re += step) {
        if (Math.abs(re) < step * 0.01) continue; // Skip origin (will be drawn as axis)
        const x = toCanvasX(re);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
      }

      // Horizontal lines
      const startY = Math.floor(minIm / step) * step;
      for (let im = startY; im <= maxIm; im += step) {
        if (Math.abs(im) < step * 0.01) continue; // Skip origin
        const y = toCanvasY(im);
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
      }
      ctx.stroke();
    }

    // Concentric circles
    if (currentGridConfig.circles.enabled && currentGridConfig.circles.step > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      const step = currentGridConfig.circles.step;
      // Calculate max radius as distance from origin (0,0) to the farthest viewport corner
      const cornerDistances = [
        Math.sqrt(minRe * minRe + minIm * minIm), // bottom-left
        Math.sqrt(maxRe * maxRe + minIm * minIm), // bottom-right
        Math.sqrt(minRe * minRe + maxIm * maxIm), // top-left
        Math.sqrt(maxRe * maxRe + maxIm * maxIm), // top-right
      ];
      const maxRadius = Math.max(...cornerDistances) + step;

      for (let r = step; r <= maxRadius; r += step) {
        const centerX = toCanvasX(0);
        const centerY = toCanvasY(0);
        const radiusPixels = r * scale;
        ctx.moveTo(centerX + radiusPixels, centerY);
        ctx.arc(centerX, centerY, radiusPixels, 0, 2 * Math.PI);
      }
      ctx.stroke();
    }

    // Rays from origin
    if (currentGridConfig.rays.enabled && currentGridConfig.rays.count > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      const count = currentGridConfig.rays.count;
      // Calculate max radius as distance from origin to farthest viewport corner
      const cornerDistances = [
        Math.sqrt(minRe * minRe + minIm * minIm),
        Math.sqrt(maxRe * maxRe + minIm * minIm),
        Math.sqrt(minRe * minRe + maxIm * maxIm),
        Math.sqrt(maxRe * maxRe + maxIm * maxIm),
      ];
      const maxRadius = Math.max(...cornerDistances) * 1.2;
      const centerX = toCanvasX(0);
      const centerY = toCanvasY(0);

      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        const endX = toCanvasX(maxRadius * Math.cos(angle));
        const endY = toCanvasY(maxRadius * Math.sin(angle));
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(endX, endY);
      }
      ctx.stroke();
    }

    // Draw axes (on top of grid)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(toCanvasX(0), 0);
    ctx.lineTo(toCanvasX(0), canvas.height);
    ctx.moveTo(0, toCanvasY(0));
    ctx.lineTo(canvas.width, toCanvasY(0));
    ctx.stroke();

    // Draw tickmarks and labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    // Calculate appropriate tick spacing
    // If rectangular grid is enabled, use its step (or a multiple of it)
    // Otherwise, use "nice" numbers (1, 2, 5) × 10^n aiming for ~4-6 ticks
    let tickSpacing: number;

    if (currentGridConfig.rectangular.enabled && currentGridConfig.rectangular.step > 0) {
      // Use grid step, but ensure we don't have too many ticks
      const gridStep = currentGridConfig.rectangular.step;
      const ticksWithGridStep = viewportWidth / gridStep;

      if (ticksWithGridStep <= 8) {
        tickSpacing = gridStep;
      } else if (ticksWithGridStep <= 16) {
        tickSpacing = gridStep * 2;
      } else if (ticksWithGridStep <= 40) {
        tickSpacing = gridStep * 5;
      } else {
        tickSpacing = gridStep * 10;
      }
    } else {
      // Use "nice" numbers: 1, 2, 5 × 10^n
      const rawSpacing = viewportWidth / 5;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawSpacing)));
      const normalized = rawSpacing / magnitude;

      if (normalized < 1.5) {
        tickSpacing = magnitude;
      } else if (normalized < 3.5) {
        tickSpacing = magnitude * 2;
      } else if (normalized < 7.5) {
        tickSpacing = magnitude * 5;
      } else {
        tickSpacing = magnitude * 10;
      }
    }

    // Calculate visible range with padding
    const startRe = Math.floor((offsetX - viewportWidth / 2) / tickSpacing) * tickSpacing;
    const endRe = Math.ceil((offsetX + viewportWidth / 2) / tickSpacing) * tickSpacing;
    const startIm = Math.floor((offsetY - viewportHeight / 2) / tickSpacing) * tickSpacing;
    const endIm = Math.ceil((offsetY + viewportHeight / 2) / tickSpacing) * tickSpacing;

    // Helper to format tick label - show decimals only when needed
    const formatTickLabel = (value: number): string => {
      // Round to avoid floating point errors
      const rounded = Math.round(value * 1e10) / 1e10;
      if (Number.isInteger(rounded)) {
        return rounded.toString();
      }
      // Determine decimal places needed based on tickSpacing
      const decimals = Math.max(0, Math.ceil(-Math.log10(tickSpacing)));
      return rounded.toFixed(decimals);
    };

    // X-axis tickmarks
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let re = startRe; re <= endRe; re += tickSpacing) {
      if (Math.abs(re) < tickSpacing / 10) continue;
      const x = toCanvasX(re);
      const y0 = toCanvasY(0);
      if (x >= 0 && x <= canvas.width) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y0 - 5);
        ctx.lineTo(x, y0 + 5);
        ctx.stroke();

        const label = formatTickLabel(re);
        const labelY = y0 > canvas.height - 30 ? y0 - 20 : y0 + 15;
        ctx.fillText(label, x, labelY);
      }
    }

    // Y-axis tickmarks
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (let im = startIm; im <= endIm; im += tickSpacing) {
      if (Math.abs(im) < tickSpacing / 10) continue;
      const y = toCanvasY(im);
      const x0 = toCanvasX(0);
      if (y >= 0 && y <= canvas.height) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 - 5, y);
        ctx.lineTo(x0 + 5, y);
        ctx.stroke();

        const label = formatTickLabel(im) + "i";
        const labelX = x0 > canvas.width - 50 ? x0 - 55 : x0 + 10;
        ctx.fillText(label, labelX, y);
      }
    }

    // Draw coefficient dots as double rings
    const baseRadius = isMobile ? Math.min(canvas.width, canvas.height) * 0.025 : 8;

    coefficients.forEach((coeff, index) => {
      const x = toCanvasX(coeff.re);
      const y = toCanvasY(coeff.im);

      const isActive = index === hoveredIndex || index === draggedIndex;
      const radius = isActive ? baseRadius * 1.4 : baseRadius;
      const lineWidth = isActive ? 4 : 3;

      // Black ring (outer)
      ctx.strokeStyle = 'black';
      ctx.lineWidth = lineWidth + 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // White ring (inner)
      ctx.strokeStyle = 'white';
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    });

    // Mouse coordinates are now drawn on overlay canvas via drawMouseCoordinates()

    // Draw polynomial strip border (thin vertical line) - only for landscape
    const isLandscape = canvas.width > canvas.height;
    const STRIP_WIDTH_CM = 2;
    const stripWidth = STRIP_WIDTH_CM * dpr * 37.8; // ~2cm in pixels (96 DPI)

    if (isLandscape) {
      const stripX = canvas.width - stripWidth;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(stripX, 0);
      ctx.lineTo(stripX, canvas.height);
      ctx.stroke();
    }

    // Draw progress indicator in bottom-right corner
    const displayProgress = currentProgress !== undefined ? currentProgress : renderProgress;
    const displayIsRendering = currentIsRendering !== undefined ? currentIsRendering : isRendering;

    if (displayIsRendering && displayProgress > 0 && displayProgress < 100) {
      const padding = 20 * dpr;

      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = `${14 * dpr}px monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";

      // Format numbers with K/M/B suffixes or scientific notation for very large numbers
      const formatNumber = (n: number): string => {
        if (n >= 1e15) return n.toExponential(2); // 1.0e+15 and above
        if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(1) + 'T';
        if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toString();
      };

      // Format percentage - use scientific notation for very small increments
      const formatPercent = (p: number): string => {
        if (p < 0.01) return p.toExponential(2) + '%';
        if (p < 1) return p.toFixed(2) + '%';
        return p.toFixed(1) + '%';
      };

      const displayRootCount = currentRootCount !== undefined ? currentRootCount : rootCount;
      const displayTheoreticalMax = currentTheoreticalMax !== undefined ? currentTheoreticalMax : theoreticalMaxRoots;
      const progressText = `${formatPercent(displayProgress)} • ${formatNumber(displayRootCount)}/${formatNumber(displayTheoreticalMax)}`;
      ctx.fillText(progressText, canvas.width - padding, canvas.height - padding);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    // Screen coordinates for tooltip positioning
    const screenX = e.clientX;
    const screenY = e.clientY;

    // Check if hovering over polynomial strip
    const dpr = window.devicePixelRatio || 1;
    const isLandscape = canvas.width > canvas.height;
    const STRIP_WIDTH_CM = 2;
    const stripWidth = STRIP_WIDTH_CM * dpr * 37.8;
    const stripX = canvas.width - stripWidth;

    if (isLandscape && x >= stripX && !draggedIndex && !isPanning) {
      // Hovering over polynomial strip - calculate which polynomial
      const totalPolynomials = getTotalPolynomials(degree, coefficients.length);

      // Map Y position to polynomial index
      const polynomialIndex = Math.min(
        totalPolynomials - 1,
        Math.floor((y / canvas.height) * totalPolynomials)
      );

      if (polynomialIndex !== hoveredPolynomialIndex) {
        setHoveredPolynomialIndex(polynomialIndex);
      }
      setMousePos({ x, y });
      // Show mouse coordinates over strip
      const coord = toComplexCoord(x, y);
      updateTooltip(screenX, screenY, coord.re, coord.im);
      return;
    }

    // Not hovering over strip - clear polynomial hover if set
    if (hoveredPolynomialIndex !== null) {
      setHoveredPolynomialIndex(null);
    }

    if (draggedIndex !== null) {
      // Dragging a coefficient - show coefficient coordinates (snapped)
      const rawCoord = toComplexCoord(x, y);
      const minCanvasSize = Math.min(canvasSize.width, canvasSize.height);
      const snapped = snapToGrid(rawCoord.re, rawCoord.im, gridConfig, zoom, minCanvasSize);
      const newCoord = { re: snapped.re, im: snapped.im };
      const newCoeffs = [...coefficients];
      newCoeffs[draggedIndex] = newCoord;

      setMousePos({ x, y });
      // Show the snapped coefficient coordinates
      updateTooltip(screenX, screenY, snapped.re, snapped.im);

      onCoefficientsChange(newCoeffs);
    } else if (isPanning && panStart) {
      // Panning the view - show mouse coordinates
      const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
      const scale = baseScale * zoom;

      const dx = (x - panStart.x) / scale;
      const dy = (y - panStart.y) / scale;

      onOffsetChange(panStart.offsetX - dx, panStart.offsetY + dy);

      setMousePos({ x, y });
      const coord = toComplexCoord(x, y);
      updateTooltip(screenX, screenY, coord.re, coord.im);
    } else {
      // Check if hovering over a coefficient
      const hoveredCoeff = getCoeffAtPoint(x, y);
      setHoveredIndex(hoveredCoeff);

      setMousePos({ x, y });

      // Show coefficient coordinates if hovering over one, otherwise mouse coordinates
      if (hoveredCoeff !== null) {
        const coeff = coefficients[hoveredCoeff];
        updateTooltip(screenX, screenY, coeff.re, coeff.im);
      } else {
        const coord = toComplexCoord(x, y);
        updateTooltip(screenX, screenY, coord.re, coord.im);
      }
    }
  };

  const handleMouseUp = () => {
    setDraggedIndex(null);
    setIsPanning(false);
    setPanStart(null);
    endInteractiveTransform();
  };

  const handleMouseLeave = () => {
    setDraggedIndex(null);
    setHoveredIndex(null);
    setMousePos(null);
    setIsPanning(false);
    setPanStart(null);
    setHoveredPolynomialIndex(null);
    clearTooltip();
    endInteractiveTransform();
  };

  const wheelTimeoutRef = useRef<number | null>(null);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    // Only respond to mouse wheel (not trackpad gestures)
    // Trackpad typically has deltaMode 0 (pixels) and smaller deltaY values
    // Mouse wheel has larger discrete deltaY values
    const isMouseWheel = Math.abs(e.deltaY) > 10;

    if (isMouseWheel) {
      e.preventDefault();

      // Create snapshot before first zoom
      if (!isInteractiveTransform) {
        createSnapshot();
      }

      // Clear existing timeout
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }

      // Zoom factor: smaller deltaY = zoom in, larger = zoom out
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = zoom * zoomFactor;

      onZoomChange(newZoom);

      // End transform after 100ms of no wheel events
      wheelTimeoutRef.current = window.setTimeout(() => {
        endInteractiveTransform();
      }, 100);
    }
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check for double-tap
    const now = Date.now();
    if (e.touches.length === 1 && now - lastDoubleTapTime < 300) {
      // Double-tap detected
      onResetView();
      setLastDoubleTapTime(0);
      e.preventDefault();
      return;
    }
    setLastDoubleTapTime(now);

    if (e.touches.length === 2) {
      // Two-finger pinch gesture - create snapshot
      createSnapshot();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setLastTouchDistance(distance);
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;

      const index = getCoeffAtPoint(x, y);
      if (index !== null) {
        // Dragging a coefficient
        setDraggedIndex(index);
        onCoefficientSelect?.(index);
        e.preventDefault();
      } else {
        // Start panning - create snapshot
        createSnapshot();
        setIsPanning(true);
        setPanStart({ x, y, offsetX, offsetY });
        e.preventDefault();
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches.length === 2 && lastTouchDistance !== null) {
      // Two-finger pinch gesture
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const zoomFactor = distance / lastTouchDistance;
      const newZoom = zoom * zoomFactor;

      onZoomChange(newZoom);
      setLastTouchDistance(distance);
      e.preventDefault();
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;
      const screenX = touch.clientX;
      const screenY = touch.clientY;

      if (draggedIndex !== null) {
        // Dragging a coefficient
        setMousePos({ x, y });

        const rawCoord = toComplexCoord(x, y);
        const minCanvasSize = Math.min(canvasSize.width, canvasSize.height);
        const snapped = snapToGrid(rawCoord.re, rawCoord.im, gridConfig, zoom, minCanvasSize);
        const newCoord = { re: snapped.re, im: snapped.im };
        const newCoeffs = [...coefficients];
        newCoeffs[draggedIndex] = newCoord;

        updateTooltip(screenX, screenY, snapped.re, snapped.im);
        onCoefficientsChange(newCoeffs);
        e.preventDefault();
      } else if (isPanning && panStart) {
        // Panning the view
        const baseScale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
        const scale = baseScale * zoom;

        const dx = (x - panStart.x) / scale;
        const dy = (y - panStart.y) / scale;

        onOffsetChange(panStart.offsetX - dx, panStart.offsetY + dy);

        setMousePos({ x, y });
        const coord = toComplexCoord(x, y);
        updateTooltip(screenX, screenY, coord.re, coord.im);
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    setDraggedIndex(null);
    setMousePos(null);
    setIsPanning(false);
    setPanStart(null);
    setLastTouchDistance(null);
    clearTooltip();
    endInteractiveTransform();
  };

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full bg-gradient-canvas">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'crisp-edges' }}
      />
      <canvas
        ref={overlayCanvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="absolute inset-0 w-full h-full cursor-pointer touch-none pointer-events-auto"
        style={{ imageRendering: 'crisp-edges' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {/* Coordinate tooltip */}
      {tooltip && (
        <div
          className="fixed pointer-events-none z-50 px-2 py-1 bg-black/80 text-white text-sm font-mono rounded"
          style={{
            left: tooltip.x + 15,
            top: tooltip.y + 15,
          }}
        >
          {tooltip.text}
        </div>
      )}
      {errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm p-8">
          <div className="bg-destructive/10 border border-destructive rounded-lg p-6 max-w-md">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-destructive mb-2">Cannot Render</h3>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FractalCanvas.displayName = 'FractalCanvas';
