import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ControlPanelProps {
  degree: number;
  onDegreeChange: (value: number) => void;
  coefficientCount: number;
  onCoefficientCountChange: (value: number) => void;
  maxRoots: number;
  onMaxRootsChange: (value: number) => void;
}

export const ControlPanel = ({
  degree,
  onDegreeChange,
  coefficientCount,
  onCoefficientCountChange,
  maxRoots,
  onMaxRootsChange,
}: ControlPanelProps) => {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="degree-slider" className="text-sm font-medium text-foreground">
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

      <div className="space-y-3">
        <Label htmlFor="coefficient-slider" className="text-sm font-medium text-foreground">
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

      <div className="space-y-3">
        <Label htmlFor="maxroots-slider" className="text-sm font-medium text-foreground">
          Max Roots To Draw: {maxRoots.toLocaleString()}
        </Label>
        <Slider
          id="maxroots-slider"
          min={0}
          max={100}
          step={1}
          value={[Math.log10(maxRoots) * 10]}
          onValueChange={(value) => {
            // Logarithmic scale: 10^4 (10k) to 10^9.7 (5B)
            const logValue = value[0] / 10;
            const actualValue = Math.round(Math.pow(10, logValue));
            onMaxRootsChange(actualValue);
          }}
          className="w-full"
        />
      </div>
    </div>
  );
};
