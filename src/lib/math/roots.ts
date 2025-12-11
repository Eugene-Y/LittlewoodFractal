/**
 * Root-finding algorithms for polynomials
 */

import {
  Complex,
  complexAdd,
  complexSubtract,
  complexMultiply,
  complexDivide,
  complexAbs,
  COMPLEX_ONE,
} from './complex';

export interface RootFindingResult {
  roots: Complex[];
  converged: boolean;
  iterations: number;
}

const DEFAULT_TOLERANCE = 1e-6;
const MIN_DENOMINATOR = 1e-15;
const PERTURBATION_THRESHOLD = 1e-10;
const PERTURBATION = { re: 1e-6, im: 1e-6 };

/**
 * Find all roots of a polynomial using the Durand-Kerner method.
 *
 * The algorithm simultaneously refines all roots by iterating:
 *   x_i := x_i - P(x_i) / prod_{j≠i}(x_i - x_j)
 *
 * @param coeffs - Polynomial coefficients [a_0, a_1, ..., a_n] for a_0 + a_1*z + ... + a_n*z^n
 * @param maxIter - Maximum number of iterations
 * @param tolerance - Convergence tolerance (default 1e-6)
 */
export const findRootsDurandKerner = (
  coeffs: Complex[],
  maxIter: number,
  tolerance: number = DEFAULT_TOLERANCE
): RootFindingResult => {
  const degree = coeffs.length - 1;
  if (degree <= 0) {
    return { roots: [], converged: true, iterations: 0 };
  }

  // Make polynomial monic by dividing by leading coefficient
  const leading = coeffs[degree];
  const leadingAbs = complexAbs(leading);
  if (leadingAbs === 0) {
    return {
      roots: Array(degree).fill({ re: 0, im: 0 }),
      converged: true,
      iterations: 0,
    };
  }

  const monicCoeffs = coeffs.map((c) => complexDivide(c, leading));

  // Compute adaptive radius: 1 + max|a_i| for i=0..degree-1
  // This ensures initial guesses are outside all roots
  const radius = computeInitialRadius(monicCoeffs, degree);

  // Initialize roots uniformly on a circle
  const roots = initializeRootsOnCircle(degree, radius);

  // Durand-Kerner iterations
  return iterateUntilConvergence(roots, monicCoeffs, degree, maxIter, tolerance);
};

/**
 * Compute initial radius for root placement.
 * Uses the Cauchy bound: all roots lie within |z| < 1 + max|a_i|
 */
function computeInitialRadius(monicCoeffs: Complex[], degree: number): number {
  let maxCoeffAbs = 0;
  for (let i = 0; i < degree; i++) {
    const abs = complexAbs(monicCoeffs[i]);
    if (abs > maxCoeffAbs) maxCoeffAbs = abs;
  }
  return 1.0 + maxCoeffAbs;
}

/**
 * Initialize roots uniformly distributed on a circle of given radius.
 */
function initializeRootsOnCircle(degree: number, radius: number): Complex[] {
  const roots: Complex[] = [];
  for (let i = 0; i < degree; i++) {
    const angle = (2 * Math.PI * i) / degree;
    roots.push({
      re: radius * Math.cos(angle),
      im: radius * Math.sin(angle),
    });
  }
  return roots;
}

/**
 * Main iteration loop for Durand-Kerner method.
 */
function iterateUntilConvergence(
  roots: Complex[],
  monicCoeffs: Complex[],
  degree: number,
  maxIter: number,
  tolerance: number
): RootFindingResult {
  let finalIter = 0;
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    let maxChange = 0;

    for (let i = 0; i < degree; i++) {
      const xi = roots[i];

      // Evaluate polynomial at xi using Horner's method
      const p = evaluateHorner(monicCoeffs, xi, degree);

      // Compute denominator: product of (xi - xj) for all j != i
      const denom = computeDenominator(roots, i, degree);

      // Skip if denominator is too small
      if (complexAbs(denom) < MIN_DENOMINATOR) {
        continue;
      }

      // Apply correction: x_i := x_i - P(x_i) / denom
      const correction = complexDivide(p, denom);
      const newXi = complexSubtract(xi, correction);
      const change = complexAbs(complexSubtract(newXi, xi));

      if (change > maxChange) maxChange = change;
      roots[i] = newXi;
    }

    finalIter = iter + 1;

    if (maxChange < tolerance) {
      converged = true;
      break;
    }
  }

  return { roots, converged, iterations: finalIter };
}

/**
 * Evaluate polynomial using Horner's method for numerical stability.
 * P(z) = a_n * z^n + ... + a_1 * z + a_0
 *      = (...((a_n * z + a_{n-1}) * z + a_{n-2}) * z + ...) * z + a_0
 */
function evaluateHorner(coeffs: Complex[], z: Complex, degree: number): Complex {
  let p = coeffs[degree];
  for (let k = degree - 1; k >= 0; k--) {
    p = complexAdd(complexMultiply(p, z), coeffs[k]);
  }
  return p;
}

/**
 * Compute product of (xi - xj) for all j != i.
 * Applies small perturbation if roots are too close to avoid division by zero.
 */
function computeDenominator(roots: Complex[], i: number, degree: number): Complex {
  let denom: Complex = COMPLEX_ONE;

  for (let j = 0; j < degree; j++) {
    if (j === i) continue;

    let diff = complexSubtract(roots[i], roots[j]);

    // Perturb slightly if roots are too close
    if (complexAbs(diff) < PERTURBATION_THRESHOLD) {
      diff = complexAdd(diff, PERTURBATION);
    }

    denom = complexMultiply(denom, diff);
  }

  return denom;
}
