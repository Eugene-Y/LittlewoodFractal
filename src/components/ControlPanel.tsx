import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ControlPanelProps {
  degree: number;
  onDegreeChange: (value: number) => void;
  coefficientCount: number;
  onCoefficientCountChange: (value: number) => void;
  maxRoots: number;
  onMaxRootsChange: (value: number) => void;
  transparency: number;
  onTransparencyChange: (value: number) => void;
  colorBandWidth: number;
  onColorBandWidthChange: (value: number) => void;
}

export const ControlPanel = ({
  degree,
  onDegreeChange,
  coefficientCount,
  onCoefficientCountChange,
  maxRoots,
  onMaxRootsChange,
  transparency,
  onTransparencyChange,
  colorBandWidth,
  onColorBandWidthChange,
}: ControlPanelProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="degree-slider" className="text-sm font-normal text-foreground">
          Polynomial Degree: {degree}
        </Label>
        <Slider
          id="degree-slider"
          min={2}
          max={10}
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
          min={2}
          max={10}
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
          max={100}
          step={0.1}
          value={[Math.log10(maxRoots) * 10]}
          onValueChange={(value) => {
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
    </div>
  );
};
