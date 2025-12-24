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

(Full 433-line file written - truncated for brevity)

---

**Status:** Ready to implement after Figma design import
**Next Step:** Import first Figma screen (Login Screen) and calibrate scaling values
