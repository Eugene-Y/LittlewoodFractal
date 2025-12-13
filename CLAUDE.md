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

## TODO: Future Improvements

### HDR Accumulation Buffer (High Priority)

**Problem:** When rendering many overlapping roots with low transparency, Canvas API clamps RGB values to [0, 255] on each pixel write. This causes saturation/clipping when accumulating many transparent pixels in the same location, limiting the dynamic range of the visualization.

**Current Behavior:**
- Each root drawn with `transparency = 0.001` adds ~0.25 to pixel value
- After ~1000 overlapping roots, pixel saturates at 255
- Gamma correction applied post-render cannot recover lost detail in saturated regions
- Result: Dense root clusters lose fine detail and appear uniformly white

**Solution Options:**

#### Option 1: Float32Array Accumulation Buffer (Recommended)
Store raw accumulated color values in a Float32Array, apply gamma/clamp only when displaying.

**Implementation:**
```typescript
// In FractalCanvas.tsx
const accumulationBuffer = useRef<Float32Array | null>(null);

// Initialize buffer (once)
accumulationBuffer.current = new Float32Array(width * height * 4); // RGBA

// When drawing a root (in hot loop):
const idx = (y * width + x) * 4;
accumulationBuffer.current[idx + 0] += r * alpha; // R
accumulationBuffer.current[idx + 1] += g * alpha; // G
accumulationBuffer.current[idx + 2] += b * alpha; // B
accumulationBuffer.current[idx + 3] += alpha;     // A

// In redrawCoordinateOverlay() - convert to displayable image:
const imageData = ctx.createImageData(width, height);
for (let i = 0; i < buffer.length; i += 4) {
  const r = accumulationBuffer.current[i + 0];
  const g = accumulationBuffer.current[i + 1];
  const b = accumulationBuffer.current[i + 2];
  const a = accumulationBuffer.current[i + 3];

  // Apply gamma correction to alpha
  const gamma = Math.pow(10, -gammaCorrection);
  const correctedAlpha = Math.pow(a / maxAlpha, gamma);

  // Tonemap/clamp for display
  imageData.data[i + 0] = Math.min(255, r);
  imageData.data[i + 1] = Math.min(255, g);
  imageData.data[i + 2] = Math.min(255, b);
  imageData.data[i + 3] = Math.min(255, correctedAlpha * 255);
}
ctx.putImageData(imageData, 0, 0);
```

**Pros:**
- ✅ No clamping during accumulation - full floating-point precision
- ✅ Minimal code changes - replaces offscreen canvas with typed array
- ✅ Canvas blend modes still work (applied during final composition)
- ✅ Memory overhead: 4x width × height × 4 bytes (manageable for 1200×1200 = ~23MB)
- ✅ Can add tonemapping operators (Reinhard, ACES, etc.) for artistic control

**Cons:**
- ❌ Doubles memory usage (accumulation buffer + display canvas)
- ❌ Slightly more complex rendering pipeline
- ❌ Need to clear buffer when restarting render

**Changes Required:**
1. Replace `offscreenCanvasRef` with `accumulationBufferRef: Float32Array`
2. Modify hot loop in `renderFractal()` to write to buffer instead of canvas
3. Add buffer-to-canvas conversion in `redrawCoordinateOverlay()`
4. Handle buffer resize when canvas size changes
5. Clear buffer when starting new render

#### Option 2: WebGL with Float Textures
Use WebGL to render to floating-point texture, apply gamma as fragment shader.

**Implementation Sketch:**
```glsl
// Fragment shader for accumulation
precision highp float;
varying vec2 vUv;
uniform sampler2D uAccumTexture;
uniform vec4 uColor; // RGBA of current root
void main() {
  vec4 prev = texture2D(uAccumTexture, vUv);
  gl_FragColor = prev + uColor; // HDR accumulation
}

// Fragment shader for display (with gamma)
precision highp float;
varying vec2 vUv;
uniform sampler2D uAccumTexture;
uniform float uGamma;
void main() {
  vec4 hdr = texture2D(uAccumTexture, vUv);
  float gamma = pow(10.0, -uGamma);
  float alpha = pow(hdr.a / maxAlpha, gamma);
  gl_FragColor = vec4(min(hdr.rgb, 1.0), min(alpha, 1.0));
}
```

**Pros:**
- ✅ True HDR rendering (float32 textures)
- ✅ GPU-accelerated gamma correction
- ✅ Can add advanced post-processing (bloom, color grading, etc.)
- ✅ Scales better for large canvases

**Cons:**
- ❌ Major rewrite - entire rendering pipeline moves to WebGL
- ❌ Blend modes need reimplementation as shaders
- ❌ Canvas2D features (text, lines) harder to integrate
- ❌ Browser compatibility concerns (though widely supported now)
- ❌ Debugging more complex

**Changes Required:**
1. Create WebGL context instead of 2D context
2. Write vertex/fragment shaders for root rendering
3. Implement ping-pong render targets for accumulation
4. Port all Canvas2D drawing to WebGL
5. Reimplement blend modes as shader variants

#### Recommendation
Start with **Option 1 (Float32Array)** because:
- Minimal disruption to existing codebase
- Immediate benefit for dense fractals
- Reversible - can migrate to WebGL later if needed
- Performance should be acceptable (hot loop already optimized)

**Estimated Effort:** ~4-6 hours for Option 1, ~20+ hours for Option 2

**Testing Strategy:**
- Render degree=10, coefficients=3, maxRoots=1M with transparency=0.001
- Compare saturated regions before/after HDR accumulation
- Verify gamma adjustment works smoothly during rendering
- Profile memory usage and frame time
