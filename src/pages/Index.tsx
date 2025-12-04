import { useState, useRef } from "react";
import { FractalCanvas, FractalCanvasRef } from "@/components/FractalCanvas";
import { ControlPanel } from "@/components/ControlPanel";

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
    // TODO: Implement link export with URL parameters
    console.log('Export link not yet implemented');
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
