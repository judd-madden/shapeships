# Fluid Scaling Strategy for Shapeships

**Status:** Documented - To be implemented after Figma design import  
**Date:** November 21, 2025

## Problem Statement

We need a scaling solution that:
1. **Viewport Scaling:** Gracefully scales the entire app from mobile to desktop without breakpoints
2. **Content Scaling:** Dynamically scales game elements (ships) as they accumulate during gameplay
3. **Design Fidelity:** Preserves pixel-perfect Figma designs at the target viewport (1440px desktop)
4. **Minimum Readability:** Maintains readable text on small screens (down to ~320px)
5. **Maximum Size:** Caps scaling at design specs to prevent oversized UI on large displays

## Approach Overview

Use **CSS clamp()** for viewport-based fluid scaling + **dynamic font-size** for content-based scaling.

---

## Solution 1: Whole-App Viewport Scaling

### Implementation

Add to `/styles/globals.css`:

```css
:root {
  /* Base font size scales from minimum (small screens) to maximum (designs) */
  /* Figma designs are at 1440px viewport with 14px base font */
  font-size: clamp(10px, 0.97vw, 14px);
  
  /* Calculation breakdown:
     - 10px = minimum font size (at ~320px viewport, still readable)
     - 0.97vw = proportional scaling (14px ÷ 1440px × 100 = 0.97vw)
     - 14px = maximum font size (matches Figma design specs)
  */
}
```

### How It Works

| Viewport Width | Font Size | Scale % | Notes |
|----------------|-----------|---------|-------|
| 320px          | 10px      | 71%     | Minimum enforced |
| 768px          | 10px      | 71%     | Still at minimum (768 × 0.97% = 7.45px < 10px) |
| 1028px         | 10px      | 71%     | Crossover point (~1030px) |
| 1440px         | 14px      | 100%    | Design target - exact match |
| 1920px         | 14px      | 100%    | Maximum enforced |

### Usage with Figma Imports

1. **Import Figma code with px values intact** - Don't convert anything
2. **Wrap app in viewport scaler** (already done via :root)
3. **Use em/rem for scalable properties:**

```tsx
// Component from Figma import
<div 
  className=\"w-[400px]\"  // Keep Figma px value
  style={{
    fontSize: '1em'  // Inherits scaled font size
  }}
>
  <p>This text scales automatically</p>
</div>

// For dimensions that should scale with viewport:
<div className=\"w-[28.57em]\">  // 400px ÷ 14px = 28.57em
  {/* Scales with viewport */}
</div>
```

### Pros & Cons

✅ **Pros:**
- Smooth scaling across all viewport sizes
- No breakpoint management
- Preserves Figma designs at target size
- Works with existing Roboto font-size: 14px setup

❌ **Cons:**
- Some elements may need explicit px values if they shouldn't scale
- Need to test thoroughly at edge cases (very small/large screens)

---

## Solution 2: Dynamic Content Scaling (Fleet Area)

### Use Case

When ships accumulate during gameplay, the fleet area needs to scale down to fit all ships without overflow.

### Implementation

```tsx
// FleetArea.tsx or similar component
interface FleetAreaProps {
  ships: PlayerShip[];
  maxShips?: number; // Expected max for this game type
}

export function FleetArea({ ships, maxShips = 50 }: FleetAreaProps) {
  const shipCount = ships.length;
  const baseScale = 1.0; // 100% at low ship counts
  const minScale = 0.4;  // Don't go below 40% - still recognizable
  
  // Scale down progressively as ships approach max
  // Formula: Start at 100%, lose 0.6% per ship beyond threshold
  const scale = Math.max(
    minScale,
    baseScale - (Math.max(0, shipCount - 10) / 100) * 0.6
  );
  
  return (
    <div 
      className=\"fleet-area\"
      style={{ 
        fontSize: `${scale}em`, // Scales all em-based children
        '--ship-scale': scale   // CSS variable for other uses
      } as React.CSSProperties}
    >
      {ships.map(ship => (
        <ShipDisplay 
          key={ship.id}
          ship={ship}
          // Figma size preserved, but scales with parent font-size
          className=\"w-[93px] h-[51px]\"
        />
      ))}
    </div>
  );
}
```

### Scaling Progression

| Ship Count | Scale Factor | Visual Size | Notes |
|------------|--------------|-------------|-------|
| 0-10       | 100%         | Full size   | Early game |
| 20         | 94%          | Slight reduction | Mid game |
| 40         | 82%          | Noticeably smaller | Late game |
| 60         | 70%          | Compact | Very late game |
| 100+       | 40%          | Minimum | Safety floor |

### Alternative: Grid Auto-fit

For automatic reflow without explicit scaling:

```css
.fleet-area {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
  gap: 0.5em;
}
```

Ships automatically wrap and resize to fill available space.

---

## Solution 3: SVG Ship Graphics Scaling

### Em-based SVG Dimensions

Convert ship SVGs to use em units for proportional scaling:

```tsx
// /graphics/human/assets.tsx

// BEFORE (fixed px):
export const WedgeShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width=\"93\" 
    height=\"51\" 
    viewBox=\"0 0 93 51\"
    className={className}
  >
    <polygon points=\"46.5,5 88,46 5,46\" fill=\"black\" stroke=\"#9CFF84\" strokeWidth=\"3\" />
  </svg>
);

// AFTER (em-based):
export const WedgeShip: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    width=\"1em\"      // Relative to parent font-size
    height=\"0.548em\" // Maintains aspect ratio (51 ÷ 93 = 0.548)
    viewBox=\"0 0 93 51\"
    className={className}
  >
    <polygon points=\"46.5,5 88,46 5,46\" fill=\"black\" stroke=\"#9CFF84\" strokeWidth=\"3\" />
  </svg>
);

// Usage:
<div style={{ fontSize: '93px' }}> {/* Base size */}
  <WedgeShip />  {/* Renders at 93×51px */}
</div>

<div style={{ fontSize: '46.5px' }}> {/* 50% scale */}
  <WedgeShip />  {/* Renders at 46.5×25.5px */}
</div>

// With Tailwind arbitrary values:
<div className=\"text-[93px]\">
  <WedgeShip />
</div>
```

### Benefits

- Ships scale automatically with fleet area
- No need to recalculate dimensions
- Works with both viewport and content scaling
- SVG viewBox preserves vector quality at any size

---

## Solution 4: CSS Variables for Advanced Scaling

### Setup

```css
/* /styles/globals.css */

/* Scaling container utility */
.scale-container {
  /* Child elements inherit scaled font-size */
  font-size: var(--container-scale, 1em);
  
  /* Custom properties for non-font scaling */
  --gap-base: 1rem;
  --gap: calc(var(--gap-base) * var(--scale-factor, 1));
  gap: var(--gap);
}

.scale-container > * {
  /* Ensure transforms scale from consistent origin */
  transform-origin: top left;
}

/* Ship scaling specifically */
.ship-container {
  font-size: calc(1em * var(--ship-scale, 1));
}
```

### Usage

```tsx
<div 
  className=\"scale-container\"
  style={{ 
    '--container-scale': '0.8',
    '--scale-factor': 0.8 
  } as React.CSSProperties}
>
  {/* Everything inside scales to 80% */}
</div>
```

---

## Tailwind Integration

### Arbitrary Values with Em Units

Tailwind supports em-based arbitrary values:

```tsx
// Text scales with parent
<p className=\"text-[1em]\">Scales with container</p>

// Dimensions scale with parent font-size
<div className=\"w-[20em] h-[15em]\">Container</div>

// Spacing scales with parent
<div className=\"gap-[0.5em] p-[1em]\">Spaced content</div>

// Combine with Figma px values when needed
<div className=\"w-[400px]\">Fixed width from Figma</div>
```

### When to Use What

| Element Type | Unit | Reasoning |
|--------------|------|-----------|
| Figma import layouts | `px` | Preserve design fidelity |
| Text content | `em/rem` | Scale with viewport/container |
| Icons/graphics | `em` | Scale proportionally |
| Breakpoints | `px` | Absolute viewport thresholds (if needed) |
| Spacing in scaled areas | `em` | Maintain proportions |
| Fixed UI chrome | `px` | Buttons, borders that shouldn't scale |

---

## Implementation Checklist

### Phase 1: Figma Import (Do First)
- [ ] Import Figma screens with px values intact
- [ ] Test at 1440px viewport to verify design match
- [ ] Note which elements are at 14px base font

### Phase 2: Viewport Scaling (After Import)
- [ ] Add `clamp()` to `:root` font-size in globals.css
- [ ] Calculate exact vw value based on Figma design viewport
- [ ] Test at 320px, 768px, 1440px, 1920px viewports
- [ ] Identify any elements that break (should remain px)
- [ ] Adjust min/max clamp values if needed

### Phase 3: Fleet Area Scaling (During Game Board Build)
- [ ] Implement dynamic fontSize calculation
- [ ] Convert ship SVGs to em-based dimensions
- [ ] Test with 10, 30, 50, 100+ ships
- [ ] Fine-tune scale formula and minimum threshold
- [ ] Add visual indicators if ships become too small

### Phase 4: Testing & Refinement
- [ ] Test on actual mobile devices (320px-768px)
- [ ] Test on tablets (768px-1024px)
- [ ] Test on desktop (1440px-1920px)
- [ ] Test on ultra-wide (2560px+)
- [ ] Verify text remains readable at all scales
- [ ] Check ship graphics remain recognizable at minimum scale

---

## Edge Cases to Consider

### 1. **Very Small Screens (< 320px)**
- May need absolute minimum breakpoint
- Consider horizontal scroll as fallback
- Or disable scaling below threshold

### 2. **Very Large Screens (> 2560px)**
- UI may feel too large even at 14px cap
- Could add second tier: `clamp(14px, 0.7vw, 18px)` for ultra-wide
- Or center content with max-width container

### 3. **Late-Game Ship Overflow**
- If 50+ ships exceed capacity even at min scale
- Options: Pagination, scrolling, stacking, or ship icons instead of full graphics
- Alert player when approaching scale minimum

### 4. **Mixed Scaling Elements**
- Some UI (health bars, timers) shouldn't scale with fleet
- Use absolute `px` units or separate scaling contexts
- Test interaction between scaled and non-scaled areas

---

## Testing Strategy

### Manual Testing Viewports

```bash
# Chrome DevTools Responsive Mode
320×568   # iPhone SE (small mobile)
375×667   # iPhone 8 (standard mobile)
768×1024  # iPad Portrait (tablet)
1024×768  # iPad Landscape (tablet)
1440×900  # Design target (desktop)
1920×1080 # Full HD (desktop)
2560×1440 # 2K (large desktop)
```

### Visual Regression Tests

1. **Capture screenshots at each viewport** (before/after scaling implementation)
2. **Compare 1440px design** - Should match Figma exactly
3. **Check 320px minimum** - Text still readable, UI functional
4. **Verify proportions** - Elements maintain aspect ratios

### Functional Tests

- [ ] All buttons clickable at all sizes
- [ ] Ship selection works with scaled graphics
- [ ] Text inputs remain usable on mobile
- [ ] Modal dialogs fit in viewport
- [ ] No horizontal scroll (except intentional game board pan)

---

## Future Enhancements

### Zoom Controls (Optional)

Allow players to manually adjust scale:

```tsx
const [userZoom, setUserZoom] = useState(1.0);

<div style={{ fontSize: `${userZoom}em` }}>
  {/* Game board */}
</div>

<Button onClick={() => setUserZoom(z => Math.min(1.5, z + 0.1))}>
  Zoom In
</Button>
```

### Accessibility Considerations

- Respect user's browser font-size preferences
- Test with browser zoom at 150%, 200%
- Ensure minimum touch target sizes (44×44px) maintained
- Keyboard navigation works at all scales

---

## Decision Log

**Chosen Approach:**
- Start with viewport clamp() scaling (:root font-size)
- Add content-based scaling for fleet area when needed
- Convert ship SVGs to em units during graphics system build
- Preserve Figma px values in initial imports

**Deferred Decisions:**
- Exact clamp() values (wait for Figma designs to calibrate)
- Fleet area scale formula (wait to see actual ship accumulation)
- Need for manual zoom controls (wait for user feedback)

**Rejected Approaches:**
- ❌ Traditional breakpoints (contradicts \"no breakpoints\" requirement)
- ❌ Transform scale() (causes blurry text, layout issues)
- ❌ Viewport units everywhere (too aggressive, hard to control)

---

**Status:** Ready to implement after Figma design import
**Next Step:** Import first Figma screen (Login Screen) and calibrate scaling values