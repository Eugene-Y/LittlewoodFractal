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
  const [degree, setDegree] = useState(6);
  const [maxRoots, setMaxRoots] = useState(10000);
  const [transparency, setTransparency] = useState(0.9);
  const [colorBandWidth, setColorBandWidth] = useState(1.0); // 0.0 = batch size, 1.0 = total roots
  const [blendMode, setBlendMode] = useState<GlobalCompositeOperation>('source-over');
  const maxIterations = 100; // Fixed value
  const [coefficients, setCoefficients] = useState<Complex[]>([
    { re: 1, im: 0 },
    { re: -1, im: 0 },
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
    const params = new URLSearchParams();

    // d - degree (integer)
    params.set('d', degree.toString());

    // c - coefficient count (integer)
    params.set('c', coefficients.length.toString());

    // c1x, c1y, c2x, c2y... - coefficient coordinates (floats)
    coefficients.forEach((coeff, i) => {
      params.set(`c${i + 1}x`, coeff.re.toFixed(6));
      params.set(`c${i + 1}y`, coeff.im.toFixed(6));
    });

    // max - max roots to draw (integer)
    params.set('max', maxRoots.toString());

    // t - transparency (float)
    params.set('t', transparency.toFixed(6));

    // cbw - color band width (float)
    params.set('cbw', colorBandWidth.toFixed(6));

    // bm - blend mode (integer index)
    params.set('bm', blendModeToIndex(blendMode).toString());

    // Generate full URL
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

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

  // Parse URL parameters on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Parse degree (d)
    const degreeParam = params.get('d');
    if (degreeParam) {
      const parsedDegree = parseInt(degreeParam, 10);
      if (!isNaN(parsedDegree) && parsedDegree >= 2 && parsedDegree <= 10) {
        setDegree(parsedDegree);
      }
    }

    // Parse coefficient count and coordinates
    const coeffCountParam = params.get('c');
    if (coeffCountParam) {
      const parsedCount = parseInt(coeffCountParam, 10);
      if (!isNaN(parsedCount) && parsedCount >= 2 && parsedCount <= 10) {
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
      const parsedMax = parseInt(maxParam, 10);
      if (!isNaN(parsedMax) && parsedMax >= 1000 && parsedMax <= 5000000000) {
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
  }, []); // Empty dependency array - run only once on mount

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
