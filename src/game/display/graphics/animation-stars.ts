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

  blackHoleChance: 1 / 7,
  saturnChance: 1 / 2,

  blackHoleSizePx: 60,
  saturnPlanetSizePx: 8,
  saturnRingWidthPx: 16,
  saturnRingHeightPx: 3,
  saturnRingRotationDeg: 20,
};

export type StarsViewport = { width: number; height: number };
export type StarKind = 'star' | 'shootingStar' | 'blackHole' | 'saturn';

export type StarSpec = {
  id: string;
  kind: StarKind;

  // start position in px (relative to container)
  x: number;
  y: number;

  // Used for the rendered body size; saturn ring dimensions still come from config.
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

function createStarId(prefix: string): string {
  return `${prefix}_${Math.floor(rand01() * 1e9)}`;
}

function randomSpawnPosition(viewport: StarsViewport, cfg: StarsConfig) {
  const { width, height } = viewport;
  const m = cfg.spawnMarginPx;
  return {
    x: randFloat(-m, width + m),
    y: randFloat(-m, height + m),
  };
}

type CreateDriftingStarSpecOptions = {
  idPrefix: string;
  kind: StarKind;
  sizePx: number;
  durationMs: number;
  delayMs: number;
};

function createDriftingStarSpec(
  viewport: StarsViewport,
  cfg: StarsConfig,
  options: CreateDriftingStarSpecOptions,
): StarSpec {
  const { x, y } = randomSpawnPosition(viewport, cfg);
  const { dx, dy } = computeDriftVector(viewport, cfg);

  return {
    id: createStarId(options.idPrefix),
    kind: options.kind,
    x,
    y,
    sizePx: options.sizePx,
    dx,
    dy,
    durationMs: options.durationMs,
    delayMs: options.delayMs,
  };
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
  const count = randIntInclusive(cfg.minStars, cfg.maxStars);
  const out: StarSpec[] = [];

  for (let i = 0; i < count; i++) {
    out.push(
      createDriftingStarSpec(viewport, cfg, {
        idPrefix: `star_${i}`,
        kind: 'star',
        sizePx: randFloat(cfg.starMinSizePx, cfg.starMaxSizePx),
        durationMs: randFloat(cfg.minDurationMs, cfg.maxDurationMs),
        delayMs: randFloat(0, cfg.maxDelayMs),
      }),
    );
  }

  // Rare: black hole (independent roll)
  if (rand01() < cfg.blackHoleChance) {
    out.push(
      createDriftingStarSpec(viewport, cfg, {
        idPrefix: 'blackhole',
        kind: 'blackHole',
        sizePx: randFloat(cfg.blackHoleSizePx, cfg.blackHoleSizePx * 3),
        durationMs: randFloat(cfg.minDurationMs, cfg.maxDurationMs),
        delayMs: randFloat(0, cfg.maxDelayMs),
      }),
    );
  }

  // Rare: saturn (independent roll)
  if (rand01() < cfg.saturnChance) {
    out.push(
      createDriftingStarSpec(viewport, cfg, {
        idPrefix: 'saturn',
        kind: 'saturn',
        sizePx: cfg.saturnPlanetSizePx,
        durationMs: randFloat(cfg.minDurationMs, cfg.maxDurationMs),
        delayMs: randFloat(0, cfg.maxDelayMs),
      }),
    );
  }

  return out;
}

export function generateShootingStar(
  viewport: StarsViewport,
  cfg: StarsConfig = STARS_CONFIG,
): StarSpec {
  return createDriftingStarSpec(viewport, cfg, {
    idPrefix: 'shooting_star',
    kind: 'shootingStar',
    sizePx: randFloat(1, 3),
    durationMs: randFloat(1000, 3000),
    delayMs: 0,
  });
}
