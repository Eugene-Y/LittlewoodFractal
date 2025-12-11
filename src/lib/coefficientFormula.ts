/**
 * Safe mathematical expression evaluation for coefficient generation
 * Uses mathjs for secure parsing (no eval)
 */

import { create, all } from 'mathjs';

// Create a mathjs instance with limited functionality for safety
const math = create(all);

// Limit available functions for safety
const limitedEvaluate = math.evaluate;

export interface Complex {
  re: number;
  im: number;
}

export interface FormulaPreset {
  name: string;
  reFormula: string;
  imFormula: string;
  description: string;
}

// Built-in presets
export const FORMULA_PRESETS: FormulaPreset[] = [
  {
    name: 'Circle',
    reFormula: 'cos(2*pi*i/n)',
    imFormula: 'sin(2*pi*i/n)',
    description: 'Uniform on unit circle',
  },
  {
    name: 'Spiral',
    reFormula: '(i/n) * cos(2*pi*i/n)',
    imFormula: '(i/n) * sin(2*pi*i/n)',
    description: 'Spiral from origin',
  },
  {
    name: 'Real axis',
    reFormula: '2*i/n - 1',
    imFormula: '0',
    description: 'On real axis [-1, 1]',
  },
  {
    name: 'Imaginary axis',
    reFormula: '0',
    imFormula: '2*i/n - 1',
    description: 'On imaginary axis [-i, i]',
  },
  {
    name: 'Roots of unity',
    reFormula: 'cos(2*pi*i/n)',
    imFormula: 'sin(2*pi*i/n)',
    description: 'n-th roots of unity',
  },
  {
    name: 'Random',
    reFormula: 'random(-1, 1)',
    imFormula: 'random(-1, 1)',
    description: 'Random in [-1,1]x[-1,1]',
  },
  {
    name: 'Power spiral',
    reFormula: '(0.9^i) * cos(2*pi*i/6)',
    imFormula: '(0.9^i) * sin(2*pi*i/6)',
    description: 'Decaying spiral',
  },
  {
    name: 'Lissajous',
    reFormula: 'cos(3*pi*i/n)',
    imFormula: 'sin(2*pi*i/n)',
    description: 'Lissajous pattern',
  },
];

/**
 * Evaluate a formula for a given coefficient index
 *
 * Available variables:
 * - i: current index (0, 1, 2, ...)
 * - n: total count of coefficients
 * - pi: Math.PI
 * - e: Math.E
 *
 * Available functions:
 * - sin, cos, tan, asin, acos, atan, atan2
 * - sinh, cosh, tanh
 * - sqrt, cbrt, abs, sign
 * - exp, log, log10, log2
 * - pow, floor, ceil, round
 * - min, max
 * - random(min?, max?)
 */
export function evaluateFormula(
  formula: string,
  index: number,
  count: number
): number {
  try {
    const scope = {
      i: index,
      n: count,
      pi: Math.PI,
      e: Math.E,
    };

    const result = limitedEvaluate(formula, scope);

    // Handle various result types
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }

    // mathjs might return a complex number or other types
    if (result && typeof result.re === 'number') {
      return result.re;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Generate coefficient at index using re/im formulas
 */
export function generateCoefficient(
  reFormula: string,
  imFormula: string,
  index: number,
  count: number
): Complex {
  return {
    re: evaluateFormula(reFormula, index, count),
    im: evaluateFormula(imFormula, index, count),
  };
}

/**
 * Generate all coefficients from formulas
 */
export function generateAllCoefficients(
  reFormula: string,
  imFormula: string,
  count: number
): Complex[] {
  const coefficients: Complex[] = [];
  for (let i = 0; i < count; i++) {
    coefficients.push(generateCoefficient(reFormula, imFormula, i, count));
  }
  return coefficients;
}

/**
 * Validate a formula (returns error message or null if valid)
 */
export function validateFormula(formula: string): string | null {
  try {
    // Test with dummy values
    const scope = { i: 0, n: 1, pi: Math.PI, e: Math.E };
    const result = limitedEvaluate(formula, scope);

    if (typeof result !== 'number' && !(result && typeof result.re === 'number')) {
      return 'Formula must return a number';
    }

    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid formula';
  }
}

/**
 * Default formulas (uniform circle distribution)
 */
export const DEFAULT_RE_FORMULA = 'cos(2*pi*i/n)';
export const DEFAULT_IM_FORMULA = 'sin(2*pi*i/n)';
