import { useState, useRef, useEffect } from "react";
import { FractalCanvas, FractalCanvasRef } from "@/components/FractalCanvas";
import { ControlPanel } from "@/components/ControlPanel";
import { toast } from "@/components/ui/sonner";

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

// Blend mode mapping for URL encoding/decoding
const BLEND_MODES: GlobalCompositeOperation[] = [
  'source-over',
  'multiply',
  'screen',
  'overlay',
  'color-dodge',
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
  const [blendMode, setBlendMode] = useState<GlobalCompositeOperation>('source-over');
  const [offsetX, setOffsetX] = useState(0); // Pan offset in complex plane units
  const [offsetY, setOffsetY] = useState(0); // Pan offset in complex plane units
  const [zoom, setZoom] = useState(1); // Zoom level (1 = default, 2 = 2x zoomed in)
  const maxIterations = 100; // Fixed value
  const [coefficients, setCoefficients] = useState<Complex[]>([
    { re: 1, im: 0 },
    { re: -1, im: 0 },
    { re: 0, im: 0 },
  ]);

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
      // Add new coefficients
      for (let i = coefficients.length; i < count; i++) {
        const angle = (2 * Math.PI * i) / count;
        newCoeffs.push({ re: Math.cos(angle), im: Math.sin(angle) });
      }
    } else {
      // Remove coefficients
      newCoeffs.length = count;
    }
    setCoefficients(newCoeffs);
  };

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

    // Parse max roots (max)
    const maxParam = params.get('max');
    if (maxParam) {
      const parsedMax = Number(maxParam);
      if (!isNaN(parsedMax) && Number.isInteger(parsedMax) && parsedMax > 0) {
        setMaxRoots(parsedMax);
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

    params.set('max', maxRoots.toString());
    params.set('t', transparency.toFixed(6));
    params.set('cbw', colorBandWidth.toFixed(6));
    params.set('bm', blendModeToIndex(blendMode).toString());
    params.set('0x', offsetX.toFixed(6));
    params.set('0y', offsetY.toFixed(6));
    params.set('z', zoom.toFixed(6));

    // Update URL without reloading page or adding to history
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [degree, coefficients, maxRoots, transparency, colorBandWidth, blendMode, offsetX, offsetY, zoom]); // Update when any param changes

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Fullscreen Canvas */}
      <FractalCanvas
        ref={fractalCanvasRef}
        degree={degree}
        coefficients={coefficients}
        onCoefficientsChange={setCoefficients}
        maxRoots={maxRoots}
        maxIterations={maxIterations}
        transparency={transparency}
        colorBandWidth={colorBandWidth}
        blendMode={blendMode}
        offsetX={offsetX}
        offsetY={offsetY}
        zoom={zoom}
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
          transparency={transparency}
          onTransparencyChange={setTransparency}
          colorBandWidth={colorBandWidth}
          onColorBandWidthChange={setColorBandWidth}
          blendMode={blendMode}
          onBlendModeChange={setBlendMode}
          onExportPNG={handleExportPNG}
          onExportLink={handleExportLink}
        />
      </aside>
    </div>
  );
};

export default Index;
