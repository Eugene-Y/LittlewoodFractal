/**
 * Polynomial generation and evaluation
 */

import {
  Complex,
  complexAdd,
  complexMultiply,
  COMPLEX_ZERO,
  COMPLEX_ONE,
} from './complex';

/**
 * Generate a single polynomial by index (on-the-fly, no memory allocation for all polynomials).
 * Each polynomial is defined by choosing coefficients from a set, where the index
 * encodes which coefficient to use at each power (like a number in base `coeffs.length`).
 */
export const generatePolynomialByIndex = (
  index: number,
  degree: number,
  coeffs: Complex[]
): Complex[] => {
  const poly: Complex[] = [];
  let temp = index;
  for (let j = 0; j <= degree; j++) {
    poly.push(coeffs[temp % coeffs.length]);
    temp = Math.floor(temp / coeffs.length);
  }
  return poly;
};

/**
 * Calculate total number of polynomials without generating them.
 * For a given degree and number of coefficient choices, returns coeffsLength^(degree+1).
 */
export const getTotalPolynomials = (degree: number, coeffsLength: number): number => {
  return Math.pow(coeffsLength, degree + 1);
};

/**
 * Evaluate polynomial at point z using direct summation.
 * P(z) = sum_{i=0}^{n} coeffs[i] * z^i
 */
export const evaluatePolynomial = (coeffs: Complex[], z: Complex): Complex => {
  let result = COMPLEX_ZERO;
  let power = COMPLEX_ONE;

  for (let i = 0; i < coeffs.length; i++) {
    const term = complexMultiply(coeffs[i], power);
    result = complexAdd(result, term);
    power = complexMultiply(power, z);
  }

  return result;
};

/**
 * Evaluate polynomial derivative at point z.
 * P'(z) = sum_{i=1}^{n} i * coeffs[i] * z^{i-1}
 */
export const evaluateDerivative = (coeffs: Complex[], z: Complex): Complex => {
  let result = COMPLEX_ZERO;
  let power = COMPLEX_ONE;

  for (let i = 1; i < coeffs.length; i++) {
    const coeff = complexMultiply(coeffs[i], { re: i, im: 0 });
    const term = complexMultiply(coeff, power);
    result = complexAdd(result, term);
    power = complexMultiply(power, z);
  }

  return result;
};
