/**
 * Grid configuration and snap-to-grid logic
 */

export interface GridConfig {
  // Rectangular grid
  rectangular: {
    enabled: boolean;
    step: number; // Step size (e.g., 0.5 means grid lines at 0, 0.5, 1, 1.5, ...)
  };
  // Concentric circles around origin
  circles: {
    enabled: boolean;
    step: number; // Radius step (e.g., 0.5 means circles at r=0.5, 1, 1.5, ...)
  };
  // Rays from origin
  rays: {
    enabled: boolean;
    count: number; // Number of rays (e.g., 8 means rays every 45°)
  };
  // Snap behavior
  snapEnabled: boolean;
  snapThresholdPx: number;
}

export const DEFAULT_GRID_CONFIG: GridConfig = {
  rectangular: {
    enabled: true,
    step: 0.5,
  },
  circles: {
    enabled: true,
    step: 0.5,
  },
  rays: {
    enabled: true,
    count: 6,
  },
  snapEnabled: false,
  snapThresholdPx: 20,
};

export interface SnapResult {
  re: number;
  im: number;
  snappedTo: 'rectangular' | 'circle' | 'ray' | 'intersection' | null;
}

// Priority for snap types: higher number = higher priority
const SNAP_PRIORITY: Record<NonNullable<SnapResult['snappedTo']>, number> = {
  rectangular: 1,
  circle: 1,
  ray: 1,
  intersection: 2, // Intersections have higher priority
};

/**
 * Snap a complex coordinate to the nearest grid point based on config.
 * Priority: intersections > grid lines/circles/rays
 * When distances are similar (within 50%), prefer higher priority types.
 */
export function snapToGrid(
  re: number,
  im: number,
  config: GridConfig,
  zoom: number,
  canvasSize: number
): SnapResult {
  if (!config.snapEnabled) {
    return { re, im, snappedTo: null };
  }

  // Convert pixel threshold to complex plane units
  // canvasSize pixels = 6/zoom units, so 1 pixel = 6/(zoom*canvasSize) units
  const threshold = config.snapThresholdPx * 6 / (zoom * canvasSize);
  let bestRe = re;
  let bestIm = im;
  let bestDistance = threshold;
  let bestPriority = 0;
  let snappedTo: SnapResult['snappedTo'] = null;

  // Helper to update best snap
  // Intersections have higher priority - they win unless a line is MUCH closer
  const trySnap = (
    newRe: number,
    newIm: number,
    type: NonNullable<SnapResult['snappedTo']>
  ) => {
    const dist = Math.sqrt((newRe - re) ** 2 + (newIm - im) ** 2);
    if (dist >= threshold) return;

    const priority = SNAP_PRIORITY[type];

    // Accept if:
    // 1. No snap yet (first valid candidate)
    // 2. Same priority and closer
    // 3. Higher priority and within reasonable range (2x threshold)
    // 4. Lower priority but MUCH closer (at least 3x closer)
    let shouldAccept = false;

    if (snappedTo === null) {
      // First valid snap
      shouldAccept = true;
    } else if (priority > bestPriority) {
      // Higher priority wins if within 2x of best distance
      shouldAccept = dist < bestDistance * 2;
    } else if (priority === bestPriority) {
      // Same priority - closer wins
      shouldAccept = dist < bestDistance;
    } else {
      // Lower priority must be MUCH closer (3x) to win
      shouldAccept = dist * 3 < bestDistance;
    }

    if (shouldAccept) {
      bestRe = newRe;
      bestIm = newIm;
      bestDistance = dist;
      bestPriority = priority;
      snappedTo = type;
    }
  };

  // Current point in polar coordinates
  const r = Math.sqrt(re * re + im * im);
  const theta = Math.atan2(im, re);

  // 1. Check rectangular grid
  if (config.rectangular.enabled && config.rectangular.step > 0) {
    const step = config.rectangular.step;
    const nearestX = Math.round(re / step) * step;
    const nearestY = Math.round(im / step) * step;

    // Grid intersection points (where lines cross) are high priority
    trySnap(nearestX, nearestY, 'intersection');

    // Snap to grid lines (not intersections - lower priority)
    // Snap to vertical grid line (keep Y)
    trySnap(nearestX, im, 'rectangular');
    // Snap to horizontal grid line (keep X)
    trySnap(re, nearestY, 'rectangular');
  }

  // 2. Check concentric circles
  if (config.circles.enabled && config.circles.step > 0 && r > 0.001) {
    const step = config.circles.step;
    const nearestR = Math.round(r / step) * step;
    if (nearestR > 0) {
      // Snap to circle at same angle
      const snapRe = nearestR * Math.cos(theta);
      const snapIm = nearestR * Math.sin(theta);
      trySnap(snapRe, snapIm, 'circle');
    }
  }

  // 3. Check rays from origin
  if (config.rays.enabled && config.rays.count > 0 && r > 0.001) {
    const angleStep = (2 * Math.PI) / config.rays.count;
    const nearestAngleIndex = Math.round(theta / angleStep);
    const nearestAngle = nearestAngleIndex * angleStep;

    // Snap to ray at same radius
    const snapRe = r * Math.cos(nearestAngle);
    const snapIm = r * Math.sin(nearestAngle);
    trySnap(snapRe, snapIm, 'ray');
  }

  // 4. Check intersections between different grid types
  // Circle + Ray intersections
  if (
    config.circles.enabled &&
    config.rays.enabled &&
    config.circles.step > 0 &&
    config.rays.count > 0
  ) {
    const rStep = config.circles.step;
    const angleStep = (2 * Math.PI) / config.rays.count;

    const nearestR = Math.round(r / rStep) * rStep;
    const nearestAngleIndex = Math.round(theta / angleStep);
    const nearestAngle = nearestAngleIndex * angleStep;

    if (nearestR > 0) {
      const snapRe = nearestR * Math.cos(nearestAngle);
      const snapIm = nearestR * Math.sin(nearestAngle);
      trySnap(snapRe, snapIm, 'intersection');
    }
  }

  // Rectangular + Circle intersections
  if (
    config.rectangular.enabled &&
    config.circles.enabled &&
    config.rectangular.step > 0 &&
    config.circles.step > 0
  ) {
    const rectStep = config.rectangular.step;
    const circleStep = config.circles.step;

    // Check nearby rectangular grid points that lie on circles
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const gridX = (Math.round(re / rectStep) + dx) * rectStep;
        const gridY = (Math.round(im / rectStep) + dy) * rectStep;
        const gridR = Math.sqrt(gridX * gridX + gridY * gridY);

        // Check if this grid point is close to a circle
        const nearestCircleR = Math.round(gridR / circleStep) * circleStep;
        if (Math.abs(gridR - nearestCircleR) < threshold * 0.5) {
          trySnap(gridX, gridY, 'intersection');
        }
      }
    }
  }

  // Rectangular + Ray intersections
  if (
    config.rectangular.enabled &&
    config.rays.enabled &&
    config.rectangular.step > 0 &&
    config.rays.count > 0
  ) {
    const rectStep = config.rectangular.step;
    const angleStep = (2 * Math.PI) / config.rays.count;

    // For each nearby ray, find intersection with grid lines
    for (let i = -1; i <= 1; i++) {
      const angleIndex = Math.round(theta / angleStep) + i;
      const rayAngle = angleIndex * angleStep;
      const cos = Math.cos(rayAngle);
      const sin = Math.sin(rayAngle);

      // Intersection with vertical grid lines (x = n * step)
      if (Math.abs(cos) > 0.001) {
        const nearestX = Math.round(re / rectStep) * rectStep;
        const t = nearestX / cos;
        if (t > 0) {
          const snapRe = nearestX;
          const snapIm = t * sin;
          // Check if this Im is close to a horizontal grid line too
          const nearestY = Math.round(snapIm / rectStep) * rectStep;
          if (Math.abs(snapIm - nearestY) < threshold) {
            trySnap(snapRe, nearestY, 'intersection');
          } else {
            trySnap(snapRe, snapIm, 'intersection');
          }
        }
      }

      // Intersection with horizontal grid lines (y = n * step)
      if (Math.abs(sin) > 0.001) {
        const nearestY = Math.round(im / rectStep) * rectStep;
        const t = nearestY / sin;
        if (t > 0) {
          const snapRe = t * cos;
          const snapIm = nearestY;
          trySnap(snapRe, snapIm, 'intersection');
        }
      }
    }
  }

  // Special case: snap to origin if very close
  if (Math.sqrt(re * re + im * im) < threshold) {
    trySnap(0, 0, 'intersection');
  }

  return { re: bestRe, im: bestIm, snappedTo };
}
