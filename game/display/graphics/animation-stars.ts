/**
 * Stars Background - Pure Generation Logic
 * =========================================
 * 
 * Computes random star positions, drift vectors, and timings for a one-shot
 * drifting stars background effect. No looping. No server seed.
 * 
 * Rarely includes "Black Hole" (radial gradient) or "Saturn" (planet + ring).
 */

export type StarsConfig = {
  // star count
  minStars: number;
  maxStars: number;

  // sizes (px)
  starMinSizePx: number;
  starMaxSizePx: number;

  // spawn margin around viewport (px)
  spawnMarginPx: number;

  // drift distance extra padding (px) beyond viewport diagonal + margins
  driftExtraPx: number;

  // duration range (ms)
  minDurationMs: number;
  maxDurationMs: number;

  // optional delay to desync (ms)
  maxDelayMs: number;

  // rare chance (0..1)
  blackHoleChance: number; // ~1/30
  saturnChance: number;    // ~1/30

  // visuals
  blackHoleSizePx: number;     // 30
  saturnPlanetSizePx: number;  // 6
  saturnRingWidthPx: number;   // 12
  saturnRingHeightPx: number;  // 2
  saturnRingRotationDeg: number; // 25
};

export const STARS_CONFIG: StarsConfig = {
  minStars: 8,
  maxStars: 11,

  starMinSizePx: 1,
  starMaxSizePx: 7,

  spawnMarginPx: 200,
  driftExtraPx: 300,

  // 10–50 minutes
  minDurationMs: 10 * 60 * 1000,
  maxDurationMs: 50 * 60 * 1000,

  maxDelayMs: 0,

  blackHoleChance: 1 / 5,
  saturnChance: 1 / 2,

  blackHoleSizePx: 60,
  saturnPlanetSizePx: 8,
  saturnRingWidthPx: 16,
  saturnRingHeightPx: 3,
  saturnRingRotationDeg: 20,
};

export type StarsViewport = { width: number; height: number };
export type StarKind = 'star' | 'blackHole' | 'saturn';

export type StarSpec = {
  id: string;
  kind: StarKind;

  // start position in px (relative to container)
  x: number;
  y: number;

  // only used for normal stars (blackHole/saturn use config sizes)
  sizePx: number;

  // drift vector in px
  dx: number;
  dy: number;

  durationMs: number;
  delayMs: number;
};

function rand01(): number {
  return Math.random();
}

function randFloat(min: number, max: number): number {
  return min + rand01() * (max - min);
}

function randIntInclusive(min: number, max: number): number {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(a + rand01() * (b - a + 1));
}

function hypot(a: number, b: number): number {
  return Math.sqrt(a * a + b * b);
}

export function computeDriftVector(viewport: StarsViewport, cfg: StarsConfig) {
  const angle = randFloat(0, Math.PI * 2);
  const diagonal = hypot(viewport.width, viewport.height);
  const distance = diagonal + cfg.spawnMarginPx * 2 + cfg.driftExtraPx;
  return {
    dx: Math.cos(angle) * distance,
    dy: Math.sin(angle) * distance,
  };
}

export function generateStars(viewport: StarsViewport, cfg: StarsConfig = STARS_CONFIG): StarSpec[] {
  const { width, height } = viewport;
  const m = cfg.spawnMarginPx;

  const count = randIntInclusive(cfg.minStars, cfg.maxStars);
  const out: StarSpec[] = [];

  for (let i = 0; i < count; i++) {
    const { dx, dy } = computeDriftVector(viewport, cfg);
    out.push({
      id: `star_${i}_${Math.floor(rand01() * 1e9)}`,
      kind: 'star',
      x: randFloat(-m, width + m),
      y: randFloat(-m, height + m),
      sizePx: randFloat(cfg.starMinSizePx, cfg.starMaxSizePx),
      dx,
      dy,
      durationMs: randFloat(cfg.minDurationMs, cfg.maxDurationMs),
      delayMs: randFloat(0, cfg.maxDelayMs),
    });
  }

  // Rare: black hole (independent roll)
  if (rand01() < cfg.blackHoleChance) {
    const { dx, dy } = computeDriftVector(viewport, cfg);
    out.push({
      id: `blackhole_${Math.floor(rand01() * 1e9)}`,
      kind: 'blackHole',
      x: randFloat(-m, width + m),
      y: randFloat(-m, height + m),
      sizePx: cfg.blackHoleSizePx,
      dx,
      dy,
      durationMs: randFloat(cfg.minDurationMs, cfg.maxDurationMs),
      delayMs: randFloat(0, cfg.maxDelayMs),
    });
  }

  // Rare: saturn (independent roll)
  if (rand01() < cfg.saturnChance) {
    const { dx, dy } = computeDriftVector(viewport, cfg);
    out.push({
      id: `saturn_${Math.floor(rand01() * 1e9)}`,
      kind: 'saturn',
      x: randFloat(-m, width + m),
      y: randFloat(-m, height + m),
      sizePx: cfg.saturnPlanetSizePx,
      dx,
      dy,
      durationMs: randFloat(cfg.minDurationMs, cfg.maxDurationMs),
      delayMs: randFloat(0, cfg.maxDelayMs),
    });
  }

  return out;
}
