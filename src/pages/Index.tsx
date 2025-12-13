import { useState, useRef, useEffect, useCallback } from "react";
import { FractalCanvas, FractalCanvasRef } from "@/components/FractalCanvas";
import { ControlPanel } from "@/components/ControlPanel";
import { toast } from "@/components/ui/sonner";
import { GridConfig, DEFAULT_GRID_CONFIG } from "@/lib/grid";
import { SamplingConfig, DEFAULT_SAMPLING_CONFIG } from "@/lib/sampling";
import {
  generateCoefficient,
  generateAllCoefficients,
  DEFAULT_RE_FORMULA,
  DEFAULT_IM_FORMULA,
} from "@/lib/coefficientFormula";

interface Complex {
  re: number;
  im: number;
}

interface ConvergenceStats {
  totalRoots: number;
  convergedRoots: number;
  convergenceRate: number;
  avgIterations: number;
}

export type ColorMode = 'by_index' | 'by_leading_coeff';

// Blend mode mapping for URL encoding/decoding
const BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'color-dodge',
  'hue',
  'difference',
  'xor'
];

const blendModeToIndex = (mode: GlobalCompositeOperation): number => {
  const index = BLEND_MODES.indexOf(mode);
  return index >= 0 ? index : 0;
};

const indexToBlendMode = (index: number): GlobalCompositeOperation => {
  return BLEND_MODES[index] || 'source-over';
};

const Index = () => {
  const fractalCanvasRef = useRef<FractalCanvasRef>(null);
  const [degree, setDegree] = useState(7);
  const [maxRoots, setMaxRoots] = useState(20000);
  const [transparency, setTransparency] = useState(0.9);
  const [colorBandWidth, setColorBandWidth] = useState(1.0); // 0.0 = batch size, 1.0 = total roots
  const [colorMode, setColorMode] = useState<ColorMode>('by_index');
  const [blendMode, setBlendMode] = useState<GlobalCompositeOperation>('source-over');
  const [offsetX, setOffsetX] = useState(0); // Pan offset in complex plane units
  const [offsetY, setOffsetY] = useState(0); // Pan offset in complex plane units
  const [zoom, setZoom] = useState(1); // Zoom level (1 = default, 2 = 2x zoomed in)
  const [polynomialNeighborRange, setPolynomialNeighborRange] = useState(5); // ±N polynomials around hovered one
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const maxIterations = 100; // Fixed value
  const [gridConfig, setGridConfig] = useState<GridConfig>(DEFAULT_GRID_CONFIG);
  const [samplingConfig, setSamplingConfig] = useState<SamplingConfig>(DEFAULT_SAMPLING_CONFIG);
  const [coefficients, setCoefficients] = useState<Complex[]>([
    { re: 1, im: 0 },
    { re: -1, im: 0 },
    { re: 0, im: 0 },
  ]);

  // Transform target state
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [transformTarget, setTransformTarget] = useState<'all' | 'even' | 'odd' | 'selected'>('all');

  // Coefficient formula state
  const [reFormula, setReFormula] = useState(DEFAULT_RE_FORMULA);
  const [imFormula, setImFormula] = useState(DEFAULT_IM_FORMULA);

  const handleExportPNG = () => {
    const exportCanvas = fractalCanvasRef.current?.exportToCanvas();
    if (!exportCanvas) return;

    // Generate timestamp: ГГГГММДД_ЧЧММСС_ММС
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}_${milliseconds}`;
    const filename = `littlewood_${timestamp}.png`;

    // Convert canvas to blob and download
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleExportLink = () => {
    // Simply copy current URL (which is auto-updated by the useEffect)
    const url = window.location.href;

    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      toast('Link copied to clipboard', {
        duration: 2000,
      });
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  const handleCoefficientCountChange = (count: number) => {
    const newCoeffs = [...coefficients];
    if (count > coefficients.length) {
      // Add new coefficients using formula
      for (let i = coefficients.length; i < count; i++) {
        newCoeffs.push(generateCoefficient(reFormula, imFormula, i, count));
      }
    } else {
      // Remove coefficients
      newCoeffs.length = count;
    }
    setCoefficients(newCoeffs);
  };

  // Apply formula to coefficients based on transformTarget
  const handleApplyFormula = useCallback(() => {
    const generated = generateAllCoefficients(reFormula, imFormula, coefficients.length);
    setCoefficients(coefficients.map((c, i) => {
      switch (transformTarget) {
        case 'all': return generated[i];
        case 'even': return i % 2 === 0 ? generated[i] : c;
        case 'odd': return i % 2 === 1 ? generated[i] : c;
        case 'selected': return i === lastSelectedIndex ? generated[i] : c;
      }
    }));
  }, [reFormula, imFormula, coefficients, transformTarget, lastSelectedIndex]);

  // Coefficient transform state - use ref for immediate access (no async delay)
  const transformBaseCoeffsRef = useRef<Complex[] | null>(null);
  const randomOffsetsRef = useRef<{re: number, im: number}[] | null>(null);

  // Start transform - capture current coefficients immediately and reset random offsets
  const handleTransformStart = useCallback(() => {
    transformBaseCoeffsRef.current = [...coefficients];
    randomOffsetsRef.current = null; // Reset so new random offsets are generated each drag
  }, [coefficients]);

  // End transform - commit and reset base
  const handleTransformEnd = useCallback(() => {
    transformBaseCoeffsRef.current = null;
  }, []);

  // Helper: check if coefficient at index should be transformed
  const shouldTransform = useCallback((index: number): boolean => {
    switch (transformTarget) {
      case 'all': return true;
      case 'even': return index % 2 === 0;
      case 'odd': return index % 2 === 1;
      case 'selected': return index === lastSelectedIndex;
    }
  }, [transformTarget, lastSelectedIndex]);

  // Get indices that will be transformed (for center of mass calculation)
  const getTransformIndices = useCallback((length: number): number[] => {
    const indices: number[] = [];
    for (let i = 0; i < length; i++) {
      if (shouldTransform(i)) indices.push(i);
    }
    return indices;
  }, [shouldTransform]);

  // Transform: scale around center of mass (relative to base)
  // scaleFactor: 0.25 to 4 (1 = no change)
  const handleScaleCoefficients = useCallback((scaleFactor: number) => {
    const base = transformBaseCoeffsRef.current || coefficients;
    const indices = getTransformIndices(base.length);
    if (indices.length === 0) return;

    // Calculate center of mass of affected coefficients only
    const centerRe = indices.reduce((sum, i) => sum + base[i].re, 0) / indices.length;
    const centerIm = indices.reduce((sum, i) => sum + base[i].im, 0) / indices.length;

    // Scale around center of mass (only affected coefficients)
    setCoefficients(base.map((c, i) => {
      if (!shouldTransform(i)) return c;
      return {
        re: centerRe + (c.re - centerRe) * scaleFactor,
        im: centerIm + (c.im - centerIm) * scaleFactor,
      };
    }));
  }, [coefficients, shouldTransform, getTransformIndices]);

  // Transform: rotate around center of mass (relative to base)
  // angleDegrees: -180 to 180
  const handleRotateCoefficients = useCallback((angleDegrees: number) => {
    const base = transformBaseCoeffsRef.current || coefficients;
    const indices = getTransformIndices(base.length);
    if (indices.length === 0) return;

    // Calculate center of mass of affected coefficients only
    const centerRe = indices.reduce((sum, i) => sum + base[i].re, 0) / indices.length;
    const centerIm = indices.reduce((sum, i) => sum + base[i].im, 0) / indices.length;
    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    // Rotate around center of mass (only affected coefficients)
    setCoefficients(base.map((c, i) => {
      if (!shouldTransform(i)) return c;
      const dx = c.re - centerRe;
      const dy = c.im - centerIm;
      return {
        re: centerRe + dx * cos - dy * sin,
        im: centerIm + dx * sin + dy * cos,
      };
    }));
  }, [coefficients, shouldTransform, getTransformIndices]);

  // Transform: translate (relative to base)
  // dx, dy: offset in complex plane (viewport is 6 units wide, so ±1.5 is quarter screen)
  const handleTranslateCoefficients = useCallback((dx: number, dy: number) => {
    const base = transformBaseCoeffsRef.current || coefficients;
    setCoefficients(base.map((c, i) => {
      if (!shouldTransform(i)) return c;
      return {
        re: c.re + dx,
        im: c.im + dy,
      };
    }));
  }, [coefficients, shouldTransform]);

  // Transform: randomize coefficients
  // amount: 0 to 0.05 (5% of magnitude)
  // Randomly perturbs a random subset of coefficients
  const handleRandomizeCoefficients = useCallback((amount: number) => {
    const base = transformBaseCoeffsRef.current || coefficients;

    // Generate random offsets once at the start of drag
    if (!randomOffsetsRef.current) {
      randomOffsetsRef.current = base.map((c, i) => {
        if (!shouldTransform(i)) return { re: 0, im: 0 };
        const magnitude = Math.sqrt(c.re * c.re + c.im * c.im) || 1;
        // Random angle for perturbation
        const angle = Math.random() * 2 * Math.PI;
        // If targeting a single selected coefficient, always perturb it
        // Otherwise 50% chance to perturb each coefficient
        const shouldPerturb = transformTarget === 'selected' || Math.random() > 0.5;
        return shouldPerturb ? {
          re: Math.cos(angle) * magnitude,
          im: Math.sin(angle) * magnitude,
        } : { re: 0, im: 0 };
      });
    }

    const offsets = randomOffsetsRef.current;
    setCoefficients(base.map((c, i) => ({
      re: c.re + offsets[i].re * amount,
      im: c.im + offsets[i].im * amount,
    })));
  }, [coefficients, shouldTransform, transformTarget]);

  // Override handleTransformEnd to also clear random offsets
  const handleTransformEndWithReset = useCallback(() => {
    transformBaseCoeffsRef.current = null;
    randomOffsetsRef.current = null;
  }, []);

  const handleResetView = () => {
    setOffsetX(0);
    setOffsetY(0);
    setZoom(1);
  };

  // Parse URL parameters on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Parse degree (d)
    const degreeParam = params.get('d');
    if (degreeParam) {
      const parsedDegree = parseInt(degreeParam, 10);
      if (!isNaN(parsedDegree) && parsedDegree >= 1) {
        setDegree(parsedDegree);
      }
    }

    // TODO no magic constants, limits should be explicitly named
    // Parse coefficient count and coordinates
    const coeffCountParam = params.get('c');
    if (coeffCountParam) {
      const parsedCount = parseInt(coeffCountParam, 10);
      if (!isNaN(parsedCount) && parsedCount >= 1) {
        const newCoeffs: Complex[] = [];

        // Try to parse coordinates for each coefficient
        for (let i = 1; i <= parsedCount; i++) {
          const xParam = params.get(`c${i}x`);
          const yParam = params.get(`c${i}y`);

          if (xParam && yParam) {
            const x = parseFloat(xParam);
            const y = parseFloat(yParam);

            if (!isNaN(x) && !isNaN(y)) {
              newCoeffs.push({ re: x, im: y });
            } else {
              // If parsing fails, use default value
              const angle = (2 * Math.PI * (i - 1)) / parsedCount;
              newCoeffs.push({ re: Math.cos(angle), im: Math.sin(angle) });
            }
          } else {
            // If coordinate not found, use default value
            const angle = (2 * Math.PI * (i - 1)) / parsedCount;
            newCoeffs.push({ re: Math.cos(angle), im: Math.sin(angle) });
          }
        }

        if (newCoeffs.length === parsedCount) {
          setCoefficients(newCoeffs);
        }
      }
    }

    // Parse max roots (max) - "inf" means Infinity
    const maxParam = params.get('max');
    if (maxParam) {
      if (maxParam === 'inf') {
        setMaxRoots(Infinity);
      } else {
        const parsedMax = Number(maxParam);
        if (!isNaN(parsedMax) && parsedMax > 0) {
          setMaxRoots(parsedMax);
        }
      }
    }

    // Parse transparency (t)
    const tParam = params.get('t');
    if (tParam) {
      const parsedT = parseFloat(tParam);
      if (!isNaN(parsedT) && parsedT >= 0.001 && parsedT <= 1.0) {
        setTransparency(parsedT);
      }
    }

    // Parse color band width (cbw)
    const cbwParam = params.get('cbw');
    if (cbwParam) {
      const parsedCbw = parseFloat(cbwParam);
      if (!isNaN(parsedCbw) && parsedCbw >= 0.0 && parsedCbw <= 1.0) {
        setColorBandWidth(parsedCbw);
      }
    }

    // Parse color mode (cm)
    const cmParam = params.get('cm');
    if (cmParam) {
      if (cmParam === 'by_index' || cmParam === 'by_leading_coeff') {
        setColorMode(cmParam);
      }
    }

    // Parse blend mode (bm)
    const bmParam = params.get('bm');
    if (bmParam) {
      const parsedBm = parseInt(bmParam, 10);
      if (!isNaN(parsedBm) && parsedBm >= 0 && parsedBm < BLEND_MODES.length) {
        setBlendMode(indexToBlendMode(parsedBm));
      }
    }

    // Parse pan offset (0x, 0y)
    const oxParam = params.get('0x');
    if (oxParam) {
      const parsedOx = parseFloat(oxParam);
      if (!isNaN(parsedOx)) {
        setOffsetX(parsedOx);
      }
    }

    const oyParam = params.get('0y');
    if (oyParam) {
      const parsedOy = parseFloat(oyParam);
      if (!isNaN(parsedOy)) {
        setOffsetY(parsedOy);
      }
    }

    // Parse zoom (z)
    const zParam = params.get('z');
    if (zParam) {
      const parsedZ = parseFloat(zParam);
      if (!isNaN(parsedZ) && parsedZ > 0 && parsedZ <= 100) {
        setZoom(parsedZ);
      }
    }

    // Parse hover overlay range (hor)
    const horParam = params.get('hor');
    if (horParam) {
      const parsedHor = parseInt(horParam, 10);
      if (!isNaN(parsedHor) && parsedHor >= 0) {
        setPolynomialNeighborRange(parsedHor);
      }
    }

    // Parse grid config
    const newGridConfig = { ...DEFAULT_GRID_CONFIG };
    let hasGridParams = false;

    // Rectangular grid
    const grParam = params.get('gr');
    if (grParam !== null) {
      newGridConfig.rectangular.enabled = grParam === '1';
      hasGridParams = true;
    }
    const grsParam = params.get('grs');
    if (grsParam) {
      const step = parseFloat(grsParam);
      if (!isNaN(step) && step > 0) {
        newGridConfig.rectangular.step = step;
        hasGridParams = true;
      }
    }

    // Circles
    const gcParam = params.get('gc');
    if (gcParam !== null) {
      newGridConfig.circles.enabled = gcParam === '1';
      hasGridParams = true;
    }
    const gcsParam = params.get('gcs');
    if (gcsParam) {
      const step = parseFloat(gcsParam);
      if (!isNaN(step) && step > 0) {
        newGridConfig.circles.step = step;
        hasGridParams = true;
      }
    }

    // Rays
    const gryParam = params.get('gry');
    if (gryParam !== null) {
      newGridConfig.rays.enabled = gryParam === '1';
      hasGridParams = true;
    }
    const grcParam = params.get('grc');
    if (grcParam) {
      const count = parseInt(grcParam, 10);
      if (!isNaN(count) && count > 0) {
        newGridConfig.rays.count = count;
        hasGridParams = true;
      }
    }

    // Snap settings
    const gsParam = params.get('gs');
    if (gsParam !== null) {
      newGridConfig.snapEnabled = gsParam === '1';
      hasGridParams = true;
    }
    const gstParam = params.get('gst');
    if (gstParam) {
      let threshold = parseFloat(gstParam);
      if (!isNaN(threshold) && threshold > 0) {
        // Backward compatibility: old values were in complex plane units (e.g., 0.05)
        if (threshold < 1) {
          threshold = 20;
        }
        newGridConfig.snapThresholdPx = threshold;
        hasGridParams = true;
      }
    }

    if (hasGridParams) {
      setGridConfig(newGridConfig);
    }

    // Parse sampling config
    const samplingModeParam = params.get('sm');
    const samplingFilterParam = params.get('sf');
    const samplingOffsetParam = params.get('so');
    if (samplingModeParam) {
      const validModes = ['uniform', 'first', 'random', 'by_a0', 'by_an'];
      if (validModes.includes(samplingModeParam)) {
        const offset = samplingOffsetParam ? Math.max(0, Math.min(1, parseFloat(samplingOffsetParam))) : 0;
        setSamplingConfig({
          mode: samplingModeParam as SamplingConfig['mode'],
          filterCoeffIndex: samplingFilterParam ? Math.max(0, parseInt(samplingFilterParam, 10) - 1) : 0,
          offset: isNaN(offset) ? 0 : offset,
        });
      }
    }

    // Parse coefficient formulas
    const reFormulaParam = params.get('fre');
    if (reFormulaParam) {
      setReFormula(decodeURIComponent(reFormulaParam));
    }
    const imFormulaParam = params.get('fim');
    if (imFormulaParam) {
      setImFormula(decodeURIComponent(imFormulaParam));
    }

    // Show navigation hint on page load
    toast('use +/- and dragging for navigation, double-click to reset view', {
      duration: 2000,
    });
  }, []); // Empty dependency array - run only once on mount

  // Update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();

    // Add all parameters
    params.set('d', degree.toString());
    params.set('c', coefficients.length.toString());

    coefficients.forEach((coeff, i) => {
      params.set(`c${i + 1}x`, coeff.re.toFixed(6));
      params.set(`c${i + 1}y`, coeff.im.toFixed(6));
    });

    params.set('max', maxRoots === Infinity ? 'inf' : maxRoots.toString());
    params.set('t', transparency.toFixed(6));
    params.set('cbw', colorBandWidth.toFixed(6));
    params.set('cm', colorMode);
    params.set('bm', blendModeToIndex(blendMode).toString());
    params.set('0x', offsetX.toFixed(6));
    params.set('0y', offsetY.toFixed(6));
    params.set('z', zoom.toFixed(6));
    params.set('hor', polynomialNeighborRange.toString());

    // Grid config
    params.set('gr', gridConfig.rectangular.enabled ? '1' : '0');
    params.set('grs', gridConfig.rectangular.step.toString());
    params.set('gc', gridConfig.circles.enabled ? '1' : '0');
    params.set('gcs', gridConfig.circles.step.toString());
    params.set('gry', gridConfig.rays.enabled ? '1' : '0');
    params.set('grc', gridConfig.rays.count.toString());
    params.set('gs', gridConfig.snapEnabled ? '1' : '0');
    params.set('gst', gridConfig.snapThresholdPx.toString());

    // Sampling config (only save if not default)
    if (samplingConfig.mode !== 'uniform') {
      params.set('sm', samplingConfig.mode);
      if (samplingConfig.mode === 'by_a0' || samplingConfig.mode === 'by_an') {
        params.set('sf', (samplingConfig.filterCoeffIndex + 1).toString()); // 1-based in URL
      }
    }
    if (samplingConfig.offset > 0) {
      params.set('so', samplingConfig.offset.toFixed(4));
    }

    // Coefficient formulas (only save if not default)
    if (reFormula !== DEFAULT_RE_FORMULA) {
      params.set('fre', encodeURIComponent(reFormula));
    }
    if (imFormula !== DEFAULT_IM_FORMULA) {
      params.set('fim', encodeURIComponent(imFormula));
    }

    // Update URL without reloading page or adding to history
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [degree, coefficients, maxRoots, transparency, colorBandWidth, colorMode, blendMode, offsetX, offsetY, zoom, polynomialNeighborRange, gridConfig, samplingConfig, reFormula, imFormula]); // Update when any param changes

  // Track landscape/portrait mode
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Fullscreen Canvas */}
      <FractalCanvas
        ref={fractalCanvasRef}
        degree={degree}
        coefficients={coefficients}
        onCoefficientsChange={setCoefficients}
        onCoefficientSelect={setLastSelectedIndex}
        maxRoots={maxRoots}
        maxIterations={maxIterations}
        transparency={transparency}
        colorBandWidth={colorBandWidth}
        colorMode={colorMode}
        blendMode={blendMode}
        offsetX={offsetX}
        offsetY={offsetY}
        zoom={zoom}
        polynomialNeighborRange={polynomialNeighborRange}
        gridConfig={gridConfig}
        samplingConfig={samplingConfig}
        onOffsetChange={(x, y) => { setOffsetX(x); setOffsetY(y); }}
        onZoomChange={setZoom}
        onResetView={handleResetView}
      />

      {/* Overlaid Control Panel */}
      <aside className="absolute top-4 left-4 w-[350px] max-h-[calc(100vh-2rem)] overflow-y-auto overflow-x-hidden p-6">
        <ControlPanel
          degree={degree}
          onDegreeChange={setDegree}
          coefficientCount={coefficients.length}
          onCoefficientCountChange={handleCoefficientCountChange}
          maxRoots={maxRoots}
          onMaxRootsChange={setMaxRoots}
          polynomialNeighborRange={polynomialNeighborRange}
          onPolynomialNeighborRangeChange={setPolynomialNeighborRange}
          isLandscape={isLandscape}
          transparency={transparency}
          onTransparencyChange={setTransparency}
          colorBandWidth={colorBandWidth}
          onColorBandWidthChange={setColorBandWidth}
          colorMode={colorMode}
          onColorModeChange={setColorMode}
          blendMode={blendMode}
          onBlendModeChange={setBlendMode}
          gridConfig={gridConfig}
          onGridConfigChange={setGridConfig}
          samplingConfig={samplingConfig}
          onSamplingConfigChange={setSamplingConfig}
          zoom={zoom}
          reFormula={reFormula}
          imFormula={imFormula}
          onReFormulaChange={setReFormula}
          onImFormulaChange={setImFormula}
          onApplyFormula={handleApplyFormula}
          transformTarget={transformTarget}
          onTransformTargetChange={setTransformTarget}
          lastSelectedIndex={lastSelectedIndex}
          onTransformStart={handleTransformStart}
          onTransformEnd={handleTransformEndWithReset}
          onScaleCoefficients={handleScaleCoefficients}
          onRotateCoefficients={handleRotateCoefficients}
          onTranslateCoefficients={handleTranslateCoefficients}
          onRandomizeCoefficients={handleRandomizeCoefficients}
          onExportPNG={handleExportPNG}
          onExportLink={handleExportLink}
        />
      </aside>
    </div>
  );
};

export default Index;
