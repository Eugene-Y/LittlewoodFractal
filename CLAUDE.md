# Littlewood Fractal Visualizer

Interactive visualization of roots of Littlewood polynomials - polynomials with coefficients constrained to a finite set of complex numbers.

## **CRITICAL: Git Workflow Rules**

**NEVER commit changes without explicit user approval.** This is a strict requirement.

- ❌ **FORBIDDEN**: Running `git commit` on your own initiative
- ❌ **FORBIDDEN**: Preparing commits "for the user to review"
- ✅ **ALLOWED**: Running `git add` and `git status` to show what changed
- ✅ **REQUIRED**: Wait for explicit user instruction like "commit this" or "make a commit"

When the user asks you to commit:
1. Follow the Git Safety Protocol in your system instructions
2. Review changes with `git status` and `git diff`
3. Draft a commit message following the repository's style
4. Execute the commit only after user confirmation

## What This Project Does

Renders the roots of polynomials of the form:
```
P(z) = c₀ + c₁z + c₂z² + ... + cₙzⁿ
```
where each coefficient cᵢ is chosen from a user-defined set of complex numbers (the "coefficient palette").

The visualization shows where roots cluster in the complex plane, creating fractal-like patterns. Users can:
- Define custom coefficient sets by dragging points on the complex plane
- Adjust polynomial degree and number of roots to render
- Apply transforms (scale, rotate, translate, randomize) to coefficients
- Use formulas to generate coefficient distributions
- Sample polynomials in different ways (uniform, first N, random, filter by coefficient)

## Tech Stack

- **React 18** + TypeScript
- **Vite** for bundling
- **Tailwind CSS** + shadcn/ui components
- **Canvas API** for rendering (no WebGL)

## Project Structure

```
src/
├── components/
│   ├── FractalCanvas.tsx   # Main canvas - renders roots, handles pan/zoom/drag
│   ├── ControlPanel.tsx    # UI controls (tabs: POLY, COEF, VIS, GRID)
│   └── ui/                  # shadcn components
├── lib/
│   ├── math.ts             # Polynomial math, Durand-Kerner root finding
│   ├── grid.ts             # Grid overlay (rectangular, circles, rays)
│   ├── sampling.ts         # Polynomial sampling strategies
│   └── coefficientFormula.ts # Formula parsing for coefficient generation
├── pages/
│   └── Index.tsx           # Main page, state management, URL persistence
```

## Key Files

### `src/lib/math.ts`
- `Complex` type: `{ re: number, im: number }`
- `generatePolynomialByIndex(index, degree, coefficients)` - generates polynomial by treating index as base-N number
- `findRootsDurandKerner(poly, maxIterations)` - finds all roots simultaneously
- `getTotalPolynomials(degree, coeffCount)` - returns `coeffCount^(degree+1)`

### `src/lib/sampling.ts`
- `SamplingMode`: 'uniform' | 'first' | 'random' | 'by_a0' | 'by_an'
- `getPolynomialIndex(localIndex, skipInterval, config, ...)` - maps iteration to polynomial index
- Uses pre-computed prime table (997 primes across 7 orders of magnitude) for pseudo-random mode

### `src/components/FractalCanvas.tsx`
- Double-buffered rendering (offscreen canvas + visible canvas)
- Batch processing with `requestAnimationFrame` for smooth UI
- Dynamic batch size based on polynomial complexity: `O(degree² × coeffCount)`
- Overlay canvas for hover highlighting (shows roots of neighboring polynomials)
- Coefficient dragging with grid snap support
- Pan (drag), zoom (+/-), reset (double-click)

### `src/components/ControlPanel.tsx`
- Collapsible tabs (click active tab to collapse, collapsed by default)
- **POLY tab**: degree, coefficient count, max roots, sampling mode/offset
- **COEF tab**: formula editor, transform sliders (scale/rotate/translate/randomize)
- **VIS tab**: transparency, color band width, color mode (by index / by leading coeff), blend mode
- **GRID tab**: rectangular grid, circles, rays, snap settings

### `src/pages/Index.tsx`
- All state lives here, passed down as props
- URL persistence: all settings saved to URL params (shareable links)
- Coefficient transforms use refs for immediate updates during drag

## Important Patterns

### Polynomial Index Encoding
Polynomials are enumerated by treating the index as a base-N number where N = coefficient count:
```
index = c₀ + c₁×N + c₂×N² + ... + cₙ×Nⁿ
```

### Rendering Pipeline
1. Calculate total polynomials and skip interval based on maxRoots
2. For each batch, get polynomial index via sampling strategy
3. Generate polynomial coefficients from index
4. Find roots using Durand-Kerner iteration
5. Draw each root as a colored pixel (HSL color based on color mode):
   - **by_index**: Hue varies smoothly across all polynomials (rainbow gradient)
   - **by_leading_coeff**: Roots grouped by leading coefficient (aₙ), each group gets distinct hue band (~10°) with gaps between groups for visual separation

### Transform System
- Base coefficients captured on `pointerdown`
- Slider values are relative to base (spring back to 0 on release)
- Transform target: all / even / odd / selected coefficient
- Center of mass calculated only from affected coefficients

### Grid Snap
- Snap threshold is in pixels (zoom-independent)
- Snaps to: rectangular grid intersections, circle intersections, ray intersections

## URL Parameters

| Param | Description |
|-------|-------------|
| `d` | Polynomial degree |
| `c` | Coefficient count |
| `c1x`, `c1y`, ... | Coefficient coordinates |
| `max` | Max roots ('inf' for unlimited) |
| `t` | Transparency (0.001-1.0) |
| `cbw` | Color band width (0-1) |
| `cm` | Color mode ('by_index' / 'by_leading_coeff') |
| `bm` | Blend mode index |
| `0x`, `0y` | Pan offset |
| `z` | Zoom level |
| `sm` | Sampling mode |
| `sf` | Sampling filter coefficient (1-based) |
| `so` | Sampling offset (0-1) |
| `gr`, `grs` | Rectangular grid enabled/step |
| `gc`, `gcs` | Circles enabled/step |
| `gry`, `grc` | Rays enabled/count |
| `gs`, `gst` | Snap enabled/threshold |
| `fre`, `fim` | Re/Im formulas (URL encoded) |

## Performance Considerations

- Batch size adapts to complexity: 128-16384 polynomials per frame
- Adaptive max iterations for root finding: `50 + degree × 3`
- Viewport culling: roots outside visible area not drawn
- When `maxRoots = Infinity`, sampling settings bypassed (simple iteration)

### **CRITICAL: Hot Loop Optimization**

The rendering loop processes millions of roots and must be kept as fast as possible. **Always follow these rules:**

1. **NO branching in hot loops** - Avoid `if/else` statements inside loops that process roots or polynomials
   - ❌ BAD: `if (colorMode === 'by_leading_coeff') { ... } else { ... }` inside root rendering loop
   - ✅ GOOD: Choose function pointer once before loop, call through pointer inside loop

2. **Precompute constants** - Calculate invariant values outside the loop
   - ❌ BAD: `const bandWidth = 1 / (coeffCount * 2)` recalculated for every root
   - ✅ GOOD: Calculate once before loop, capture in closure or pass as parameter

3. **Support auto-vectorization** - Write loops that compilers can parallelize
   - Use simple arithmetic operations
   - Avoid complex control flow
   - Keep loop bodies small and focused
   - Minimize function calls inside loops

4. **Example pattern:**
```typescript
// BEFORE (slow - branching in hot loop)
result.roots.forEach((root) => {
  if (colorMode === 'by_leading_coeff') {
    const bandWidth = 1 / (coeffCount * 2); // recalculated!
    hue = calculateLeadingCoeff(...);
  } else {
    hue = calculateIndex(...);
  }
});

// AFTER (fast - precomputed function pointer)
const bandWidth = 1 / (coeffCount * 2); // once!
const calculateHue = colorMode === 'by_leading_coeff'
  ? (p, i) => { /* uses bandWidth from closure */ }
  : (p, i) => { /* ... */ };

result.roots.forEach((root) => {
  hue = calculateHue(poly, index); // no branching!
});
```

This applies to ALL hot loops: root rendering, polynomial generation, coordinate transformations, etc.

## Common Tasks

### Adding a new control
1. Add state to `Index.tsx`
2. Add prop to `ControlPanel.tsx` interface
3. Add UI element in appropriate tab
4. Add URL param parsing/saving if needed
5. Pass to `FractalCanvas.tsx` if it affects rendering

### Adding a new sampling mode
1. Add to `SamplingMode` type in `sampling.ts`
2. Add case in `getPolynomialIndex` switch
3. Add case in `getEffectivePolynomialCount` if count differs
4. Add UI option in ControlPanel sampling select

### Modifying render behavior
- Check `renderFractal()` in FractalCanvas.tsx
- `shouldRender` check in useEffect determines when to re-render
- Add new params to `previousRenderParams` if they should trigger re-render
