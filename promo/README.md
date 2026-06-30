# Shapeships Promo Scenes

This folder contains a dev-only React renderer for building and previewing promo scenes at a fixed 1920 x 1080 resolution.

The promo renderer is not imported by production application code, is not a production route, and is not included as a production Vite build input.

Dependency direction is intentionally one-way:

- Promo scenes may import selected presentation-only assets from `src`, especially ship graphics and the space background.
- The text-only centered scene imports the existing space background directly from `src/graphics/global/space-background.jpg`.
- Files under `src` must never import from `promo`.

## Local usage

Start the existing development server:

```sh
npm run dev
```

Then open either:

- `/promo/index.html` for the scene index
- `/promo/index.html?scene=text-only-centered` for the text-only centered scene

Generated captures, renders, videos, and After Effects files should be kept outside this folder unless a later pass explicitly adds local export handling.
