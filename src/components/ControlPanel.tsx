import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Download, Link, RotateCcw } from "lucide-react";
import { GridConfig } from "@/lib/grid";
import { SamplingConfig, SamplingMode } from "@/lib/sampling";
import { FORMULA_PRESETS, validateFormula } from "@/lib/coefficientFormula";
import { ColorMode } from "@/pages/Index";

type TransformTarget = 'all' | 'even' | 'odd' | 'selected';

interface ControlPanelProps {
  degree: number;
  onDegreeChange: (value: number) => void;
  coefficientCount: number;
  onCoefficientCountChange: (value: number) => void;
  maxRoots: number;
  onMaxRootsChange: (value: number) => void;
  polynomialNeighborRange: number;
  onPolynomialNeighborRangeChange: (value: number) => void;
  isLandscape: boolean;
  transparency: number;
  onTransparencyChange: (value: number) => void;
  colorBandWidth: number;
  onColorBandWidthChange: (value: number) => void;
  colorMode: ColorMode;
  onColorModeChange: (value: ColorMode) => void;
  blendMode: GlobalCompositeOperation;
  onBlendModeChange: (value: GlobalCompositeOperation) => void;
  gammaCorrection: number;
  onGammaCorrectionChange: (value: number) => void;
  gridConfig: GridConfig;
  onGridConfigChange: (config: GridConfig) => void;
  samplingConfig: SamplingConfig;
  onSamplingConfigChange: (config: SamplingConfig) => void;
  zoom: number;
  reFormula: string;
  imFormula: string;
  onReFormulaChange: (value: string) => void;
  onImFormulaChange: (value: string) => void;
  onApplyFormula: () => void;
  transformTarget: TransformTarget;
  onTransformTargetChange: (value: TransformTarget) => void;
  lastSelectedIndex: number | null;
  onTransformStart: () => void;
  onTransformEnd: () => void;
  onScaleCoefficients: (scaleFactor: number) => void;
  onRotateCoefficients: (angleDegrees: number) => void;
  onTranslateCoefficients: (dx: number, dy: number) => void;
  onRandomizeCoefficients: (amount: number) => void;
  onExportPNG: () => void;
  onExportLink: () => void;
}

export const ControlPanel = ({
  degree,
  onDegreeChange,
  coefficientCount,
  onCoefficientCountChange,
  maxRoots,
  onMaxRootsChange,
  polynomialNeighborRange,
  onPolynomialNeighborRangeChange,
  isLandscape,
  transparency,
  onTransparencyChange,
  colorBandWidth,
  onColorBandWidthChange,
  colorMode,
  onColorModeChange,
  blendMode,
  onBlendModeChange,
  gammaCorrection,
  onGammaCorrectionChange,
  gridConfig,
  onGridConfigChange,
  samplingConfig,
  onSamplingConfigChange,
  zoom,
  reFormula,
  imFormula,
  onReFormulaChange,
  onImFormulaChange,
  onApplyFormula,
  transformTarget,
  onTransformTargetChange,
  lastSelectedIndex,
  onTransformStart,
  onTransformEnd,
  onScaleCoefficients,
  onRotateCoefficients,
  onTranslateCoefficients,
  onRandomizeCoefficients,
  onExportPNG,
  onExportLink,
}: ControlPanelProps) => {
  // Local state for transform sliders (spring back to 0 on release)
  const [scaleSlider, setScaleSlider] = useState(0);
  const [rotateSlider, setRotateSlider] = useState(0);
  const [hOffsetSlider, setHOffsetSlider] = useState(0);
  const [vOffsetSlider, setVOffsetSlider] = useState(0);
  const [randomizeSlider, setRandomizeSlider] = useState(0);
  const [activeSlider, setActiveSlider] = useState<string | null>(null);

  // Global pointerup listener to reliably reset sliders
  useEffect(() => {
    const handlePointerUp = () => {
      if (activeSlider) {
        onTransformEnd();
        setScaleSlider(0);
        setRotateSlider(0);
        setHOffsetSlider(0);
        setVOffsetSlider(0);
        setRandomizeSlider(0);
        setActiveSlider(null);
      }
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [activeSlider, onTransformEnd]);

  // Validate formulas
  const reError = validateFormula(reFormula);
  const imError = validateFormula(imFormula);
  const hasFormulaError = reError !== null || imError !== null;

  // Collapsible tabs state - collapsed by default
  const [activeTab, setActiveTab] = useState<string | null>(null);
  // Helper to update nested grid config
  const updateGridConfig = (
    section: 'rectangular' | 'circles' | 'rays',
    field: string,
    value: boolean | number
  ) => {
    onGridConfigChange({
      ...gridConfig,
      [section]: {
        ...gridConfig[section],
        [field]: value,
      },
    });
  };
  // Handle tab click - toggle if clicking active tab
  const handleTabClick = (value: string) => {
    setActiveTab(prev => prev === value ? null : value);
  };

  return (
    <div className="space-y-3">
      <Tabs value={activeTab || ""} className="w-full">
        <div className="flex gap-2 items-center">
          <TabsList className="flex-1 bg-background/50 backdrop-blur-sm">
            <TabsTrigger value="polynomial" className="flex-1 text-xs px-2" onClick={() => handleTabClick("polynomial")}>POLY</TabsTrigger>
            <TabsTrigger value="coeffs" className="flex-1 text-xs px-2" onClick={() => handleTabClick("coeffs")}>COEF</TabsTrigger>
            <TabsTrigger value="style" className="flex-1 text-xs px-2" onClick={() => handleTabClick("style")}>VIS</TabsTrigger>
            <TabsTrigger value="grids" className="flex-1 text-xs px-2" onClick={() => handleTabClick("grids")}>GRID</TabsTrigger>
          </TabsList>
          <Button
            onClick={onExportPNG}
            size="icon"
            variant="outline"
            className="bg-background/50 backdrop-blur-sm h-10 w-10"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            onClick={onExportLink}
            size="icon"
            variant="outline"
            className="bg-background/50 backdrop-blur-sm h-10 w-10"
          >
            <Link className="w-4 h-4" />
          </Button>
        </div>

      <TabsContent value="polynomial" className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="degree-slider" className="text-sm font-normal text-foreground">
          Degree: {degree}
        </Label>
        <Slider
          id="degree-slider"
          min={2}
          max={31}
          step={1}
          value={[degree]}
          onValueChange={(value) => onDegreeChange(value[0])}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="coefficient-slider" className="text-sm font-normal text-foreground">
          Number of Coefficients: {coefficientCount}
        </Label>
        <Slider
          id="coefficient-slider"
          min={1}
          max={30}
          step={1}
          value={[coefficientCount]}
          onValueChange={(value) => onCoefficientCountChange(value[0])}
          className="w-full"
        />
      </div>
      

      <div className="space-y-2">
        <Label htmlFor="maxroots-slider" className="text-sm font-normal text-foreground">
          Max Roots To Draw: {maxRoots === Infinity ? '∞' : maxRoots.toLocaleString()}
        </Label>
        <Slider
          id="maxroots-slider"
          min={0}
          max={(() => {
            // Slider parameters
            const NUM_ORDERS = 10; // From 10^3 to 10^12
            const STEPS_PER_ORDER = 9; // 1k, 2k, ..., 9k within each order
            return NUM_ORDERS * STEPS_PER_ORDER; // Last position = infinity
          })()}
          step={1}
          value={[maxRoots === Infinity ? (() => {
            const NUM_ORDERS = 10;
            const STEPS_PER_ORDER = 9;
            return NUM_ORDERS * STEPS_PER_ORDER; // Last position = infinity
          })() : (() => {
            // Reverse mapping: find slider position from maxRoots
            const STEPS_PER_ORDER = 9;
            const START_ORDER = 3; // Start from 10^3 = 1000

            const order = Math.floor(Math.log10(maxRoots)); // e.g., 3 for 1000-9999
            const orderBase = Math.pow(10, order); // 1000
            const stepSize = orderBase; // 1000 within this order
            const stepWithinOrder = Math.floor(maxRoots / stepSize) - 1; // 0-8 for 1k-9k

            return (order - START_ORDER) * STEPS_PER_ORDER + stepWithinOrder;
          })()]}
          onValueChange={(value) => {
            // Slider parameters
            const NUM_ORDERS = 10;
            const STEPS_PER_ORDER = 9;
            const START_ORDER = 3; // 10^3 = 1000
            const MAX_POSITION = NUM_ORDERS * STEPS_PER_ORDER;

            const sliderValue = value[0];

            // Last position = infinity
            if (sliderValue >= MAX_POSITION) {
              onMaxRootsChange(Infinity);
              return;
            }

            // Calculate which order we're in (0-9)
            const orderIndex = Math.floor(sliderValue / STEPS_PER_ORDER);
            // Calculate step within order (0-8)
            const stepWithinOrder = sliderValue % STEPS_PER_ORDER;

            // Actual order of magnitude (3-12)
            const order = START_ORDER + orderIndex;
            const orderBase = Math.pow(10, order);

            // Result: (stepWithinOrder + 1) * orderBase
            // e.g., step 0 → 1×1000 = 1000, step 1 → 2×1000 = 2000, ..., step 8 → 9×1000 = 9000
            const result = (stepWithinOrder + 1) * orderBase;

            onMaxRootsChange(result);
          }}
          className="w-full"
        />
      </div>

      {/* Sampling Mode Section - only show when maxRoots is finite */}
      {maxRoots !== Infinity && (
        <div className="space-y-3 pt-3 border-t border-border/50">
          <Label className="text-sm font-medium text-foreground">Sampling</Label>

          <div className="space-y-2">
            <Select
              value={samplingConfig.mode}
              onValueChange={(v) => onSamplingConfigChange({ ...samplingConfig, mode: v as SamplingMode })}
            >
              <SelectTrigger id="sampling-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uniform">Uniform (default)</SelectItem>
                <SelectItem value="first">First N</SelectItem>
                <SelectItem value="random">Random</SelectItem>
                <SelectItem value="by_a0">By a₀ (free coeff)</SelectItem>
                <SelectItem value="by_an">By aₙ (leading coeff)</SelectItem>
              </SelectContent>
            </Select>
          </div>

        {/* Filter coefficient index - only show for by_a0 and by_an modes */}
        {(samplingConfig.mode === 'by_a0' || samplingConfig.mode === 'by_an') && (
          <div className="space-y-2">
            <Label htmlFor="filter-coeff" className="text-xs font-normal text-muted-foreground">
              Filter by coefficient #{samplingConfig.filterCoeffIndex + 1}
            </Label>
            <Slider
              id="filter-coeff"
              min={1}
              max={coefficientCount}
              step={1}
              value={[samplingConfig.filterCoeffIndex + 1]}
              onValueChange={(value) => onSamplingConfigChange({ ...samplingConfig, filterCoeffIndex: value[0] - 1 })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>{coefficientCount}</span>
            </div>
          </div>
        )}

        {/* Offset slider - only show for uniform and first modes when maxRoots is finite */}
        {(samplingConfig.mode === 'uniform' || samplingConfig.mode === 'first') && maxRoots !== Infinity && (
          <div className="space-y-2">
            <Label htmlFor="sampling-offset" className="text-xs font-normal text-muted-foreground">
              Offset: {(samplingConfig.offset * 100).toFixed(0)}%
            </Label>
            <Slider
              id="sampling-offset"
              min={0}
              max={100}
              step={1}
              value={[samplingConfig.offset * 100]}
              onValueChange={(value) => onSamplingConfigChange({ ...samplingConfig, offset: value[0] / 100 })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {samplingConfig.mode === 'uniform' && 'Evenly distributed polynomial indices'}
          {samplingConfig.mode === 'first' && 'First N polynomials without skipping'}
          {samplingConfig.mode === 'random' && 'Pseudo-random step sizes for varied sampling'}
          {samplingConfig.mode === 'by_a0' && 'Only polynomials with specific free coefficient (index % coeffsLength)'}
          {samplingConfig.mode === 'by_an' && 'Only polynomials with specific leading coefficient'}
        </p>
        </div>
      )}

      </TabsContent>

      <TabsContent value="coeffs" className="space-y-4 mt-4">
        {/* Coefficient Formula Section */}
        <div className="space-y-2 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground">
              Distribution Formula
            </Label>
            <Select
              value=""
              onValueChange={(presetName) => {
                const preset = FORMULA_PRESETS.find(p => p.name === presetName);
                if (preset) {
                  onReFormulaChange(preset.reFormula);
                  onImFormulaChange(preset.imFormula);
                }
              }}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Presets..." />
              </SelectTrigger>
              <SelectContent>
                {FORMULA_PRESETS.map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    <span className="text-xs">{preset.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="re-formula" className="text-xs font-normal text-muted-foreground">
              Re(z) =
            </Label>
            <Input
              id="re-formula"
              type="text"
              value={reFormula}
              onChange={(e) => onReFormulaChange(e.target.value)}
              className={`bg-background/50 text-xs font-mono h-8 ${reError ? 'border-red-500' : ''}`}
              placeholder="cos(2*pi*i/n)"
            />
            {reError && (
              <p className="text-xs text-red-500">{reError}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="im-formula" className="text-xs font-normal text-muted-foreground">
              Im(z) =
            </Label>
            <Input
              id="im-formula"
              type="text"
              value={imFormula}
              onChange={(e) => onImFormulaChange(e.target.value)}
              className={`bg-background/50 text-xs font-mono h-8 ${imError ? 'border-red-500' : ''}`}
              placeholder="sin(2*pi*i/n)"
            />
            {imError && (
              <p className="text-xs text-red-500">{imError}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onApplyFormula}
              disabled={hasFormulaError}
              size="sm"
              variant="secondary"
              className="flex-1 h-8 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Apply
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Variables: i (index), n (count), pi, e
          </p>
        </div>

        {/* Transform Sliders - spring back to center on release */}
        <div className="space-y-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm font-medium text-foreground whitespace-nowrap">
              Transform
            </Label>
            <Select value={transformTarget} onValueChange={(v) => onTransformTargetChange(v as TransformTarget)}>
              <SelectTrigger className="h-7 text-xs w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="even">Even</SelectItem>
                <SelectItem value="odd">Odd</SelectItem>
                <SelectItem value="selected" disabled={lastSelectedIndex === null}>
                  #{lastSelectedIndex !== null ? lastSelectedIndex : '?'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scale slider */}
          <div className="space-y-1">
            <Label htmlFor="scale-slider" className="text-xs font-normal text-muted-foreground">
              Scale around center of mass
            </Label>
            <Slider
              id="scale-slider"
              min={-100}
              max={100}
              step={0.25}
              value={[scaleSlider]}
              onPointerDown={() => { setActiveSlider('scale'); onTransformStart(); }}
              onValueChange={(value) => {
                setScaleSlider(value[0]);
                // Map -100..100 to 0.25..4 (log scale, center=1)
                const scaleFactor = Math.pow(4, value[0] / 100);
                onScaleCoefficients(scaleFactor);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>÷4</span>
              <span className="font-medium text-foreground">×{Math.pow(4, scaleSlider / 100).toFixed(2)}</span>
              <span>×4</span>
            </div>
          </div>

          {/* Rotation slider */}
          <div className="space-y-1">
            <Label htmlFor="rotate-slider" className="text-xs font-normal text-muted-foreground">
              Rotate around center of mass
            </Label>
            <Slider
              id="rotate-slider"
              min={-100}
              max={100}
              step={0.25}
              value={[rotateSlider]}
              onPointerDown={() => { setActiveSlider('rotate'); onTransformStart(); }}
              onValueChange={(value) => {
                setRotateSlider(value[0]);
                // Map -100..100 to -180..180 degrees
                const angle = (value[0] / 100) * 180;
                onRotateCoefficients(angle);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-180°</span>
              <span className="font-medium text-foreground">{((rotateSlider / 100) * 180).toFixed(1)}°</span>
              <span>+180°</span>
            </div>
          </div>

          {/* Horizontal offset slider */}
          <div className="space-y-1">
            <Label htmlFor="hoffset-slider" className="text-xs font-normal text-muted-foreground">
              Horizontal Shift
            </Label>
            <Slider
              id="hoffset-slider"
              min={-100}
              max={100}
              step={0.25}
              value={[hOffsetSlider]}
              onPointerDown={() => { setActiveSlider('hoffset'); onTransformStart(); }}
              onValueChange={(value) => {
                setHOffsetSlider(value[0]);
                // Map -100..100 to half of visible viewport width (3/zoom on each side)
                const halfViewport = 3 / zoom;
                const dx = (value[0] / 100) * halfViewport;
                onTranslateCoefficients(dx, 0);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>←</span>
              <span className="font-medium text-foreground">{((hOffsetSlider / 100) * (3 / zoom)).toFixed(3)}</span>
              <span>→</span>
            </div>
          </div>

          {/* Vertical offset slider */}
          <div className="space-y-1">
            <Label htmlFor="voffset-slider" className="text-xs font-normal text-muted-foreground">
              Vertical Shift
            </Label>
            <Slider
              id="voffset-slider"
              min={-100}
              max={100}
              step={0.25}
              value={[vOffsetSlider]}
              onPointerDown={() => { setActiveSlider('voffset'); onTransformStart(); }}
              onValueChange={(value) => {
                setVOffsetSlider(value[0]);
                // Map -100..100 to half of visible viewport height (3/zoom on each side)
                const halfViewport = 3 / zoom;
                const dy = (value[0] / 100) * halfViewport;
                onTranslateCoefficients(0, dy);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>↓</span>
              <span className="font-medium text-foreground">{((vOffsetSlider / 100) * (3 / zoom)).toFixed(3)}</span>
              <span>↑</span>
            </div>
          </div>

          {/* Randomize slider */}
          <div className="space-y-1">
            <Label htmlFor="randomize-slider" className="text-xs font-normal text-muted-foreground">
              Randomize
            </Label>
            <Slider
              id="randomize-slider"
              min={0}
              max={100}
              step={0.25}
              value={[randomizeSlider]}
              onPointerDown={() => { setActiveSlider('randomize'); onTransformStart(); }}
              onValueChange={(value) => {
                setRandomizeSlider(value[0]);
                // Map 0..100 to 0..5% of magnitude
                const amount = value[0] / 100 * 0.05;
                onRandomizeCoefficients(amount);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className="font-medium text-foreground">{(randomizeSlider / 100 * 5).toFixed(2)}%</span>
              <span>5%</span>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="style" className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label htmlFor="transparency-slider" className="text-sm font-normal text-foreground">
          Transparency: {transparency < 0.01 ? transparency.toFixed(3) : transparency.toFixed(2)}
        </Label>
        <Slider
          id="transparency-slider"
          min={0}
          max={100}
          step={1}
          value={[
            transparency <= 0.125
              ? (Math.log(transparency / 0.001) / Math.log(125)) * 50
              : 50 + (Math.log(transparency / 0.125) / Math.log(8)) * 50
          ]}
          onValueChange={(value) => {
            // Two-segment logarithmic scale: 0.001→0.125 at 0→50, 0.125→1.0 at 50→100
            let actualValue: number;
            if (value[0] <= 50) {
              actualValue = 0.001 * Math.pow(125, value[0] / 50);
            } else {
              actualValue = 0.125 * Math.pow(8, (value[0] - 50) / 50);
            }
            onTransparencyChange(Math.max(0.001, Math.min(1, actualValue)));
          }}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="color-band-width-slider" className="text-sm font-normal text-foreground">
          Color Band Width: {colorBandWidth.toFixed(2)}
        </Label>
        <Slider
          id="color-band-width-slider"
          min={0}
          max={1}
          step={0.01}
          value={[colorBandWidth]}
          onValueChange={(value) => onColorBandWidthChange(value[0])}
          className="w-full"
        />
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="color-mode-select" className="text-sm font-normal text-foreground whitespace-nowrap">
          Color Mode
        </Label>
        <Select value={colorMode} onValueChange={(value) => onColorModeChange(value as ColorMode)}>
          <SelectTrigger id="color-mode-select" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="by_index">By Index</SelectItem>
            <SelectItem value="by_leading_coeff">By Leading Coeff</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="blend-mode-select" className="text-sm font-normal text-foreground whitespace-nowrap">
          Blend Mode
        </Label>
        <Select value={blendMode} onValueChange={(value) => onBlendModeChange(value as GlobalCompositeOperation)}>
          <SelectTrigger id="blend-mode-select" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="source-over">Source Over</SelectItem>
            <SelectItem value="multiply">Multiply</SelectItem>
            <SelectItem value="screen">Screen</SelectItem>
            <SelectItem value="overlay">Overlay</SelectItem>
            <SelectItem value="color-dodge">Color Dodge</SelectItem>
            <SelectItem value="hue">Hue</SelectItem>
            <SelectItem value="difference">Difference</SelectItem>
            <SelectItem value="xor">XOR</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="gamma-slider" className="text-sm font-normal text-foreground">
          Gamma: {Math.pow(10, gammaCorrection).toFixed(3)}
        </Label>
        <Slider
          id="gamma-slider"
          min={-3}
          max={3}
          step={0.01}
          value={[gammaCorrection]}
          onValueChange={(value) => onGammaCorrectionChange(value[0])}
          className="w-full"
        />
      </div>

      {isLandscape && (
        <div className="space-y-2">
          <Label htmlFor="neighbor-range-slider" className="text-sm font-normal text-foreground">
            Hover Overlay Range: ±{polynomialNeighborRange}
          </Label>
          <Slider
            id="neighbor-range-slider"
            min={0}
            max={100}
            step={1}
            value={[polynomialNeighborRange]}
            onValueChange={(value) => onPolynomialNeighborRangeChange(value[0])}
            className="w-full"
          />
        </div>
      )}
      </TabsContent>

      <TabsContent value="grids" className="space-y-3 mt-4">
        {/* Snap toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="snap-enabled" className="text-sm font-normal text-foreground">
            Snap to Grid
          </Label>
          <Switch
            id="snap-enabled"
            checked={gridConfig.snapEnabled}
            onCheckedChange={(checked) =>
              onGridConfigChange({ ...gridConfig, snapEnabled: checked })
            }
          />
        </div>

        {/* Snap threshold */}
        <div className="flex items-center gap-3">
          <Label htmlFor="snap-threshold" className="text-sm font-normal text-foreground whitespace-nowrap">
            Snap Threshold (px)
          </Label>
          <Input
            id="snap-threshold"
            type="number"
            step="1"
            min="5"
            max="100"
            value={gridConfig.snapThresholdPx}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val > 0) {
                onGridConfigChange({ ...gridConfig, snapThresholdPx: val });
              }
            }}
            className="bg-background/50 flex-1"
          />
        </div>

        {/* Rectangular Grid */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label htmlFor="rect-enabled" className="text-sm font-medium text-foreground">
              Rectangular Grid
            </Label>
            <Switch
              id="rect-enabled"
              checked={gridConfig.rectangular.enabled}
              onCheckedChange={(checked) => updateGridConfig('rectangular', 'enabled', checked)}
            />
          </div>
          {gridConfig.rectangular.enabled && (
            <div className="flex items-center gap-3 pl-2">
              <Label htmlFor="rect-step" className="text-sm font-normal text-foreground whitespace-nowrap">
                Step Size
              </Label>
              <Input
                id="rect-step"
                type="number"
                step="0.1"
                min="0.1"
                value={gridConfig.rectangular.step}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    updateGridConfig('rectangular', 'step', val);
                  }
                }}
                className="bg-background/50 flex-1"
              />
            </div>
          )}
        </div>

        {/* Concentric Circles */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label htmlFor="circles-enabled" className="text-sm font-medium text-foreground">
              Concentric Circles
            </Label>
            <Switch
              id="circles-enabled"
              checked={gridConfig.circles.enabled}
              onCheckedChange={(checked) => updateGridConfig('circles', 'enabled', checked)}
            />
          </div>
          {gridConfig.circles.enabled && (
            <div className="flex items-center gap-3 pl-2">
              <Label htmlFor="circles-step" className="text-sm font-normal text-foreground whitespace-nowrap">
                Radius Step
              </Label>
              <Input
                id="circles-step"
                type="number"
                step="0.1"
                min="0.1"
                value={gridConfig.circles.step}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    updateGridConfig('circles', 'step', val);
                  }
                }}
                className="bg-background/50 flex-1"
              />
            </div>
          )}
        </div>

        {/* Rays */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between">
            <Label htmlFor="rays-enabled" className="text-sm font-medium text-foreground">
              Rays from Origin
            </Label>
            <Switch
              id="rays-enabled"
              checked={gridConfig.rays.enabled}
              onCheckedChange={(checked) => updateGridConfig('rays', 'enabled', checked)}
            />
          </div>
          {gridConfig.rays.enabled && (
            <div className="flex items-center gap-3 pl-2">
              <Label htmlFor="rays-count" className="text-sm font-normal text-foreground whitespace-nowrap">
                Ray Count
              </Label>
              <Input
                id="rays-count"
                type="number"
                step="1"
                min="2"
                max="36"
                value={gridConfig.rays.count}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 2) {
                    updateGridConfig('rays', 'count', val);
                  }
                }}
                className="bg-background/50 flex-1"
              />
            </div>
          )}
        </div>
      </TabsContent>
      </Tabs>
    </div>
  );
};
