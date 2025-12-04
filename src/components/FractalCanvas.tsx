import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";

interface Complex {
  re: number;
  im: number;
}

interface FractalCanvasProps {
  degree: number;
  coefficients: Complex[];
  onCoefficientsChange: (coefficients: Complex[]) => void;
  onRenderComplete?: () => void;
  maxRoots: number;
  maxIterations: number;
  transparency: number;
  colorBandWidth: number;
  onConvergenceStats?: (stats: ConvergenceStats) => void;
}

interface ConvergenceStats {
  totalRoots: number;
  convergedRoots: number;
  convergenceRate: number;
  avgIterations: number;
}

export const FractalCanvas = ({ degree, coefficients, onCoefficientsChange, onRenderComplete, maxRoots, maxIterations, transparency, colorBandWidth, onConvergenceStats }: FractalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [rootCount, setRootCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 1200 });
  const [isMobile, setIsMobile] = useState(false);

  // Batch rendering state
  const [renderProgress, setRenderProgress] = useState(0);
  const renderingRef = useRef<{ id: number; animationId?: number }>({ id: 0 });
  const previousRenderParams = useRef<{ batchesToRender: number; degree: number; coefficients: Complex[]; transparency: number; colorBandWidth: number; canvasSize: { width: number; height: number } }>({
    batchesToRender: 0,
    degree: 0,
    coefficients: [],
    transparency: 0,
    colorBandWidth: 0,
    canvasSize: { width: 0, height: 0 }
  });
  const BATCH_SIZE = 2048; // Process 2048 polynomials per frame

  // Fixed viewport for consistent scaling
  const VIEWPORT_SIZE = 6; // Shows from -3 to 3 on both axes

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

  useEffect(() => {
    setErrorMessage(null);

    // For degree, coefficients, transparency, canvasSize changes: always re-render
    const prev = previousRenderParams.current;
    if (
      prev.degree !== degree ||
      prev.coefficients !== coefficients ||
      prev.transparency !== transparency ||
      prev.colorBandWidth !== colorBandWidth ||
      prev.canvasSize.width !== canvasSize.width ||
      prev.canvasSize.height !== canvasSize.height
    ) {
      previousRenderParams.current = {
        batchesToRender: 0, // Will be recalculated
        degree,
        coefficients,
        transparency,
        colorBandWidth,
        canvasSize: { ...canvasSize }
      };
      renderFractal();
      return;
    }

    // For maxRoots changes: only re-render if batchesToRender actually changed
    const totalPolynomials = getTotalPolynomials(degree, coefficients.length);
    const totalBatches = Math.ceil(totalPolynomials / BATCH_SIZE);
    const theoreticalTotalRoots = totalPolynomials * degree;
    const batchSkipRatio = theoreticalTotalRoots > maxRoots
      ? theoreticalTotalRoots / maxRoots
      : 1;
    const skipInterval = Math.ceil(batchSkipRatio);
    const batchesToRender = batchSkipRatio > 1
      ? Math.ceil(totalBatches / skipInterval)
      : totalBatches;

    if (prev.batchesToRender !== batchesToRender) {
      previousRenderParams.current = {
        batchesToRender,
        degree,
        coefficients,
        transparency,
        colorBandWidth,
        canvasSize: { ...canvasSize }
      };
      renderFractal();
    } else {
      // Update ref even if not re-rendering
      previousRenderParams.current = {
        batchesToRender,
        degree,
        coefficients,
        transparency,
        colorBandWidth,
        canvasSize: { ...canvasSize }
      };
    }
  }, [degree, coefficients, maxRoots, maxIterations, transparency, colorBandWidth, canvasSize]);


  // Generate a single polynomial by index (on-the-fly, no memory allocation for all polynomials)
  const generatePolynomialByIndex = (index: number, degree: number, coeffs: Complex[]): Complex[] => {
    const poly: Complex[] = [];
    let temp = index;
    for (let j = 0; j <= degree; j++) {
      poly.push(coeffs[temp % coeffs.length]);
      temp = Math.floor(temp / coeffs.length);
    }
    return poly;
  };

  // Calculate total number of polynomials without generating them
  const getTotalPolynomials = (degree: number, coeffsLength: number): number => {
    return Math.pow(coeffsLength, degree + 1);
  };

  const evaluatePolynomial = (coeffs: Complex[], z: Complex): Complex => {
    let result = { re: 0, im: 0 };
    let power = { re: 1, im: 0 };

    for (let i = 0; i < coeffs.length; i++) {
      // result += coeffs[i] * power
      const term = complexMultiply(coeffs[i], power);
      result = complexAdd(result, term);

      // power *= z
      power = complexMultiply(power, z);
    }

    return result;
  };

  const complexAdd = (a: Complex, b: Complex): Complex => ({
    re: a.re + b.re,
    im: a.im + b.im,
  });

  const complexSubtract = (a: Complex, b: Complex): Complex => ({
    re: a.re - b.re,
    im: a.im - b.im,
  });

  const complexMultiply = (a: Complex, b: Complex): Complex => ({
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  });

  const complexDivide = (a: Complex, b: Complex): Complex => {
    const denom = b.re * b.re + b.im * b.im;
    return {
      re: (a.re * b.re + a.im * b.im) / denom,
      im: (a.im * b.re - a.re * b.im) / denom,
    };
  };

  const complexAbs = (z: Complex): number => Math.sqrt(z.re * z.re + z.im * z.im);

  const evaluateDerivative = (coeffs: Complex[], z: Complex): Complex => {
    let result = { re: 0, im: 0 };
    let power = { re: 1, im: 0 };

    for (let i = 1; i < coeffs.length; i++) {
      const coeff = complexMultiply(coeffs[i], { re: i, im: 0 });
      const term = complexMultiply(coeff, power);
      result = complexAdd(result, term);
      power = complexMultiply(power, z);
    }

    return result;
  };

  const findRootsDurandKerner = (coeffs: Complex[], maxIter: number): { roots: Complex[], converged: boolean, iterations: number } => {
    const degree = coeffs.length - 1;
    if (degree <= 0) return { roots: [], converged: true, iterations: 0 };

    // Make monic: divide all coefficients by leading coefficient
    const leading = coeffs[degree];
    const leadingAbs = complexAbs(leading);
    if (leadingAbs === 0) {
      return { roots: Array(degree).fill({ re: 0, im: 0 }), converged: true, iterations: 0 };
    }
    
    const monicCoeffs = coeffs.map(c => complexDivide(c, leading));

    // Compute adaptive radius: 1 + max|a_i| for i=0..degree-1
    let maxCoeffAbs = 0;
    for (let i = 0; i < degree; i++) {
      const abs = complexAbs(monicCoeffs[i]);
      if (abs > maxCoeffAbs) maxCoeffAbs = abs;
    }
    const radius = 1.0 + maxCoeffAbs;

    // Initialize roots on a circle with adaptive radius
    const roots: Complex[] = [];
    for (let i = 0; i < degree; i++) {
      const angle = (2 * Math.PI * i) / degree;
      roots.push({
        re: radius * Math.cos(angle),
        im: radius * Math.sin(angle),
      });
    }

    // Durand-Kerner iterations
    let finalIter = 0;
    let converged = false;
    const tolerance = 1e-6;
    
    for (let iter = 0; iter < maxIter; iter++) {
      let maxChange = 0;

      for (let i = 0; i < degree; i++) {
        const xi = roots[i];
        
        // Evaluate polynomial using Horner's method
        let p = monicCoeffs[degree];
        for (let k = degree - 1; k >= 0; k--) {
          p = complexAdd(complexMultiply(p, xi), monicCoeffs[k]);
        }

        // Compute denominator: product of (xi - xj) for all j != i
        let denom: Complex = { re: 1, im: 0 };
        for (let j = 0; j < degree; j++) {
          if (j === i) continue;
          let diff = complexSubtract(xi, roots[j]);
          
          // Perturb slightly if roots are too close
          if (complexAbs(diff) < 1e-10) {
            diff = complexAdd(diff, { re: 1e-6, im: 1e-6 });
          }
          denom = complexMultiply(denom, diff);
        }

        // Skip if denominator is zero
        if (complexAbs(denom) < 1e-15) {
          continue;
        }

        const correction = complexDivide(p, denom);
        const newXi = complexSubtract(xi, correction);
        const change = complexAbs(complexSubtract(newXi, xi));
        
        if (change > maxChange) maxChange = change;
        roots[i] = newXi;
      }

      finalIter = iter + 1;

      // Check for convergence
      if (maxChange < tolerance) {
        converged = true;
        break;
      }
    }

    return { roots, converged, iterations: finalIter };
  };

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

    const ctx = canvas.getContext("2d");
    const offscreenCtx = offscreenCanvas.getContext("2d", { alpha: true });
    if (!ctx || !offscreenCtx) return;

    // Clear offscreen canvas (transparent background for roots accumulation)
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Set composite operation to properly blend semi-transparent pixels
    offscreenCtx.globalCompositeOperation = 'source-over';

    // Disable antialiasing for better performance
    offscreenCtx.imageSmoothingEnabled = false;

    // Calculate total polynomials without allocating memory for them
    const totalPolynomials = getTotalPolynomials(degree, coefficients.length);
    const totalBatches = Math.ceil(totalPolynomials / BATCH_SIZE);

    // Calculate theoretical total roots for consistent hue calculation
    const theoreticalTotalRoots = totalPolynomials * degree;

    // Adaptive max iterations based on polynomial degree
    const adaptiveMaxIterations = Math.min(100, Math.max(20, degree * 10));

    // Calculate batch skip ratio to limit total rendered roots
    const batchSkipRatio = theoreticalTotalRoots > maxRoots
      ? theoreticalTotalRoots / maxRoots
      : 1;

    // Calculate skip interval (render every Nth batch)
    const skipInterval = Math.ceil(batchSkipRatio);

    // Calculate how many batches will actually be rendered (not skipped)
    const batchesToRender = batchSkipRatio > 1
      ? Math.ceil(totalBatches / skipInterval)
      : totalBatches;

    // Calculate effective roots for color distribution
    // If rendering fewer than 256 batches, normalize to 256 batches for better color coverage
    const MIN_BATCHES_FOR_COLOR = 256;
    const effectiveRootsForColor = batchesToRender < MIN_BATCHES_FOR_COLOR
      ? Math.min(MIN_BATCHES_FOR_COLOR * BATCH_SIZE, totalPolynomials) * degree
      : theoreticalTotalRoots;

    // Estimate rendering time (assuming 60 FPS, each frame processes one batch)
    const estimatedSeconds = batchesToRender / 60;
    const estimatedTime = estimatedSeconds < 60
      ? `${estimatedSeconds.toFixed(1)}s`
      : `${(estimatedSeconds / 60).toFixed(1)}m`;

    // Log rendering info once at the start
    console.log(`[Fractal Render Start]
  Batch size: ${BATCH_SIZE.toLocaleString()} polynomials
  Total polynomials: ${totalPolynomials.toLocaleString()}
  Total batches: ${totalBatches.toLocaleString()}
  Theoretical max roots: ${theoreticalTotalRoots.toLocaleString()}
  Max roots to draw: ${maxRoots.toLocaleString()}
  Skip interval: every ${skipInterval} batches
  Batches to render: ${batchesToRender.toLocaleString()} (${((batchesToRender / totalBatches) * 100).toFixed(1)}%)
  Adaptive max iterations: ${adaptiveMaxIterations} (degree ${degree})
  Estimated time: ${estimatedTime} @ 60 FPS`);

    // Shared rendering state
    let currentBatch = 0;
    let totalConverged = 0;
    let totalIterations = 0;
    let processedRoots = 0;
    let frameNumber = 0;

    // Equal scale for both axes
    const scale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const toCanvasX = (re: number) => canvas.width / 2 + re * scale;
    const toCanvasY = (im: number) => canvas.height / 2 - im * scale;

    // Batch processing function
    const processBatch = () => {
      // Check if this render has been cancelled (ID changed)
      if (renderingRef.current.id !== currentRenderId) return;

      // Skip batches based on ratio to evenly distribute across all polynomials
      const shouldSkipBatch = batchSkipRatio > 1 && (currentBatch % skipInterval !== 0);

      // If skipping, jump directly to next non-skipped batch
      if (shouldSkipBatch) {
        currentBatch = Math.ceil(currentBatch / skipInterval) * skipInterval;
        if (currentBatch < totalBatches) {
          renderingRef.current.animationId = requestAnimationFrame(processBatch);
        } else {
          setIsRendering(false);
          setRenderProgress(100);
        }
        return;
      }

      const batchStart = currentBatch * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalPolynomials);

      // Update progress
      currentBatch++;
      const progress = (currentBatch / totalBatches) * 100;
      setRenderProgress(progress);

      // Process batch of polynomials
      for (let i = batchStart; i < batchEnd; i++) {
          const poly = generatePolynomialByIndex(i, degree, coefficients);
          const result = findRootsDurandKerner(poly, adaptiveMaxIterations);

          if (result.converged) {
            totalConverged++;
            totalIterations += result.iterations;

            // Draw roots immediately on offscreen canvas
            result.roots.forEach((root, rootIndex) => {
              // Calculate hue with interpolation between batch-local and global indexing
              // colorBandWidth: 0.0 = batch size, 1.0 = total roots
              const theoreticalRootIndex = i * degree + rootIndex;
              const indexWithinBatch = (i - batchStart) * degree + rootIndex;
              const batchSize = (batchEnd - batchStart) * degree;

              // Interpolate between two hue calculations
              const hueLocal = (indexWithinBatch / batchSize) * 360; // Repeats per batch
              const hueGlobal = (theoreticalRootIndex / effectiveRootsForColor) * 360; // Spans all roots
              const hue = hueLocal * (1 - colorBandWidth) + hueGlobal * colorBandWidth;

              const x = toCanvasX(root.re);
              const y = toCanvasY(root.im);

              // Simple solid color rendering (most performant)
              offscreenCtx.fillStyle = `hsla(${hue}, 100%, 60%, ${transparency})`;
              offscreenCtx.fillRect(x - 1, y - 1, 2, 2);

              processedRoots++;
            });
          }
        }

      // Update root count and composite to main canvas only after processing
      setRootCount(processedRoots);
      compositeFrame(progress, frameNumber);
      frameNumber++;

      // Continue or finish
      if (currentBatch < totalBatches) {
        renderingRef.current.animationId = requestAnimationFrame(processBatch);
      } else {
        // Rendering complete
        setIsRendering(false);
        setRenderProgress(100);

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

    // Helper to composite offscreen canvas + UI to main canvas
    const compositeFrame = (currentProgress: number, frame: number) => {
      if (!ctx || !canvas) return;

      // Integer ticks only, extended range
      const tickSpacing = 1;
      const startRe = -10;
      const endRe = 10;
      const startIm = -10;
      const endIm = 10;

      // Composite: Clear main canvas and draw background
      ctx.fillStyle = "#0a0a14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw accumulated roots from offscreen canvas
      ctx.drawImage(offscreenCanvas, 0, 0);

      // Draw axes on main canvas
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(0), 0);
      ctx.lineTo(toCanvasX(0), canvas.height);
      ctx.moveTo(0, toCanvasY(0));
      ctx.lineTo(canvas.width, toCanvasY(0));
      ctx.stroke();

      // Draw tickmarks and labels on main canvas
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";

      // X-axis tickmarks
      for (let re = startRe; re <= endRe; re += tickSpacing) {
        if (Math.abs(re) < tickSpacing / 2) continue; // Skip zero
        const x = toCanvasX(re);
        const y0 = toCanvasY(0);
        if (x >= 0 && x <= canvas.width) {
          // Tick mark
          ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y0 - 5);
          ctx.lineTo(x, y0 + 5);
          ctx.stroke();

          // Label
          const label = re.toString();
          const labelY = y0 > canvas.height - 30 ? y0 - 20 : y0 + 15;
          ctx.fillText(label, x, labelY);
        }
      }

      // Y-axis tickmarks
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (let im = startIm; im <= endIm; im += tickSpacing) {
        if (Math.abs(im) < tickSpacing / 2) continue; // Skip zero
        const y = toCanvasY(im);
        const x0 = toCanvasX(0);
        if (y >= 0 && y <= canvas.height) {
          // Tick mark
          ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x0 - 5, y);
          ctx.lineTo(x0 + 5, y);
          ctx.stroke();

          // Label
          const label = im.toString() + "i";
          const labelX = x0 > canvas.width - 50 ? x0 - 55 : x0 + 10;
          ctx.fillText(label, labelX, y);
        }
      }

      // Draw coefficient dots as white rings on main canvas (responsive sizing)
      const baseRadius = isMobile ? Math.min(canvas.width, canvas.height) * 0.025 : 8;

      coefficients.forEach((coeff, index) => {
        const x = toCanvasX(coeff.re);
        const y = toCanvasY(coeff.im);

        // Highlight if hovered or dragged
        const isActive = index === hoveredIndex || index === draggedIndex;
        const radius = isActive ? baseRadius * 1.4 : baseRadius;
        const lineWidth = isActive ? 4 : 3;

        // Simple white ring - no glow
        ctx.strokeStyle = 'white';
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      });

      // Draw progress indicator in bottom-right corner
      if (currentProgress > 0 && currentProgress < 100) {
        const dpr = window.devicePixelRatio || 1;
        const padding = 20 * dpr; // Scale padding with device pixel ratio

        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.font = `${14 * dpr}px monospace`;
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(`Frame ${frame} - ${currentProgress.toFixed(3)}%`, canvas.width - padding, canvas.height - padding);
      }
    };

    // Start batch processing
    processBatch();
  };

  const toComplexCoord = (canvasX: number, canvasY: number): Complex => {
    const canvas = canvasRef.current;
    if (!canvas) return { re: 0, im: 0 };
    
    const scale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const re = (canvasX - canvas.width / 2) / scale;
    const im = -(canvasY - canvas.height / 2) / scale;
    return { re, im };
  };

  const getCoeffAtPoint = (canvasX: number, canvasY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const scale = Math.min(canvas.width / VIEWPORT_SIZE, canvas.height / VIEWPORT_SIZE);
    const hitRadius = isMobile ? Math.min(canvas.width, canvas.height) * 0.04 : 15;
    
    for (let i = 0; i < coefficients.length; i++) {
      const x = canvas.width / 2 + coefficients[i].re * scale;
      const y = canvas.height / 2 - coefficients[i].im * scale;
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
      setDraggedIndex(index);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (draggedIndex !== null) {
      const newCoord = toComplexCoord(x, y);
      const newCoeffs = [...coefficients];
      newCoeffs[draggedIndex] = newCoord;
      onCoefficientsChange(newCoeffs);
    } else {
      const hoveredCoeff = getCoeffAtPoint(x, y);
      setHoveredIndex(hoveredCoeff);
    }
  };

  const handleMouseUp = () => {
    setDraggedIndex(null);
  };

  const handleMouseLeave = () => {
    setDraggedIndex(null);
    setHoveredIndex(null);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;

    const index = getCoeffAtPoint(x, y);
    if (index !== null) {
      setDraggedIndex(index);
      e.preventDefault(); // Prevent scrolling
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || draggedIndex === null) return;

    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((touch.clientY - rect.top) / rect.height) * canvas.height;

    const newCoord = toComplexCoord(x, y);
    const newCoeffs = [...coefficients];
    newCoeffs[draggedIndex] = newCoord;
    onCoefficientsChange(newCoeffs);
    e.preventDefault(); // Prevent scrolling
  };

  const handleTouchEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full bg-gradient-canvas">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="w-full h-full cursor-pointer touch-none"
        style={{ imageRendering: 'crisp-edges' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
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
};
