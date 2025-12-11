/**
 * Complex number arithmetic operations
 */

export interface Complex {
  re: number;
  im: number;
}

export const complexAdd = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
});

export const complexSubtract = (a: Complex, b: Complex): Complex => ({
  re: a.re - b.re,
  im: a.im - b.im,
});

export const complexMultiply = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});

export const complexDivide = (a: Complex, b: Complex): Complex => {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
};

export const complexAbs = (z: Complex): number =>
  Math.sqrt(z.re * z.re + z.im * z.im);

export const complexFromPolar = (r: number, theta: number): Complex => ({
  re: r * Math.cos(theta),
  im: r * Math.sin(theta),
});

export const COMPLEX_ZERO: Complex = { re: 0, im: 0 };
export const COMPLEX_ONE: Complex = { re: 1, im: 0 };
