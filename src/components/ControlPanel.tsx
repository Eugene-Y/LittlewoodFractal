import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, Link } from "lucide-react";

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
  blendMode: GlobalCompositeOperation;
  onBlendModeChange: (value: GlobalCompositeOperation) => void;
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
  blendMode,
  onBlendModeChange,
  onExportPNG,
  onExportLink,
}: ControlPanelProps) => {
  return (
    <div className="space-y-3">
      <Tabs defaultValue="polynomial" className="w-full">
        <div className="flex gap-2 items-center">
          <TabsList className="flex-1 bg-background/50 backdrop-blur-sm">
            <TabsTrigger value="polynomial" className="flex-1">POLYNOMIAL</TabsTrigger>
            <TabsTrigger value="style" className="flex-1">STYLE</TabsTrigger>
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
          Max Roots To Draw: {maxRoots.toLocaleString()}
        </Label>
        <Slider
          id="maxroots-slider"
          min={30}
          max={120}
          step={0.1}
          value={[Math.log10(maxRoots) * 10]}
          onValueChange={(value) => { // TODO wtf simplify this
            // Logarithmic scale: 10^3 (1k) to 10^9.7 (5B)
            const logValue = value[0] / 10;
            const rawValue = Math.pow(10, logValue);

            // Round to steps: 1k-10k step 1k, 10k-100k step 10k, etc.
            // Step is 10% of the order of magnitude
            const magnitude = Math.pow(10, Math.floor(Math.log10(rawValue)));
            const step = magnitude / 10;
            const actualValue = Math.round(rawValue / step) * step;

            onMaxRootsChange(actualValue);
          }}
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
            max={50}
            step={1}
            value={[polynomialNeighborRange]}
            onValueChange={(value) => onPolynomialNeighborRangeChange(value[0])}
            className="w-full"
          />
        </div>
      )}
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
          </SelectContent>
        </Select>
      </div>
      </TabsContent>
      </Tabs>
    </div>
  );
};
