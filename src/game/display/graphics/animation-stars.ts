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
  maxStars: 14,

  starMinSizePx: 1,
  starMaxSizePx: 10,

  spawnMarginPx: 200,
  driftExtraPx: 300,

  // 10–50 minutes
  minDurationMs: 10 * 60 * 1000,
  maxDurationMs: 50 * 60 * 1000,

  maxDelayMs: 0,

  blackHoleChance: 1 / 7,
  saturnChance: 1 / 2,

  blackHoleSizePx: 60,
  saturnPlanetSizePx: 10,
  saturnRingWidthPx: 20,
  saturnRingHeightPx: 4,
  saturnRingRotationDeg: 20,
};

export type StarsViewport = { width: number; height: number };
export type StarKind = 'star' | 'shootingStar' | 'blackHole' | 'saturn';
export type ColouredStarCssVariable =
  | '--shapeships-pastel-red'
  | '--shapeships-pastel-green'
  | '--shapeships-pastel-blue';

export type StarSpec = {
  id: string;
  kind: StarKind;
  colourCssVariable?: ColouredStarCssVariable;

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
  opacity?: number;
};

export type RisingCelebrationStarsConfig = {
  starCount: number;
  totalMs: number;
  streamStartDelayMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  minSizePx: number;
  maxSizePx: number;
  minOpacity: number;
  maxOpacity: number;
  delayJitterMs: number;
  bottomMarginPx: number;
  topExitMarginPx: number;
};

const MAX_RISING_CELEBRATION_STAR_COUNT = 250;
const FALLBACK_CELEBRATION_SEED = 'shapeships-endgame-celebration';

export const RISING_CELEBRATION_STARS_CONFIG: RisingCelebrationStarsConfig = {
  starCount: MAX_RISING_CELEBRATION_STAR_COUNT,
  totalMs: 30_000,
  streamStartDelayMs: 0,
  minDurationMs: 1_400,
  maxDurationMs: 3_800,
  minSizePx: 1.5,
  maxSizePx: 5,
  minOpacity: 0.7,
  maxOpacity: 1,
  delayJitterMs: 220,
  bottomMarginPx: 80,
  topExitMarginPx: 160,
};

function rand01(): number {
  return Math.random();
}

function randFloat(min: number, max: number): number {
  return min + rand01() * (max - min);
}

function seededFloat(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
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

function hashStringToUint(seed: string): number {
  let hash = 2_166_136_261;

  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }

  return hash || 1;
}

function createSeededRandom(seed: string) {
  let state = hashStringToUint(seed || FALLBACK_CELEBRATION_SEED);

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
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

function createOrdinaryStarSpec(
  viewport: StarsViewport,
  cfg: StarsConfig,
  idPrefix: string,
  colourCssVariable?: ColouredStarCssVariable,
): StarSpec {
  const star = createDriftingStarSpec(viewport, cfg, {
    idPrefix,
    kind: 'star',
    sizePx: randFloat(cfg.starMinSizePx, cfg.starMaxSizePx),
    durationMs: randFloat(cfg.minDurationMs, cfg.maxDurationMs),
    delayMs: randFloat(0, cfg.maxDelayMs),
  });

  return colourCssVariable ? { ...star, colourCssVariable } : star;
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
    out.push(createOrdinaryStarSpec(viewport, cfg, `star_${i}`));
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

  const colouredStarVariants: ReadonlyArray<{
    idPrefix: string;
    colourCssVariable: ColouredStarCssVariable;
  }> = [
    { idPrefix: 'pastel_red_star', colourCssVariable: '--shapeships-pastel-red' },
    { idPrefix: 'pastel_green_star', colourCssVariable: '--shapeships-pastel-green' },
    { idPrefix: 'pastel_blue_star', colourCssVariable: '--shapeships-pastel-blue' },
  ];
  const selectedColouredStars = colouredStarVariants.filter(() => rand01() < 1 / 13);

  for (const variant of selectedColouredStars) {
    out.push(
      createOrdinaryStarSpec(
        viewport,
        cfg,
        variant.idPrefix,
        variant.colourCssVariable,
      ),
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

export function generateRisingCelebrationStars(
  viewport: StarsViewport,
  seed: string | undefined,
  config: Partial<RisingCelebrationStarsConfig> = {},
): StarSpec[] {
  const cfg = { ...RISING_CELEBRATION_STARS_CONFIG, ...config };
  const count = Math.min(
    MAX_RISING_CELEBRATION_STAR_COUNT,
    Math.max(0, Math.floor(cfg.starCount)),
  );

  if (count === 0) {
    return [];
  }

  const random = createSeededRandom(seed || FALLBACK_CELEBRATION_SEED);
  const startSpacingMs = cfg.totalMs / count;

  return Array.from({ length: count }, (_, index) => {
    const delayJitterMs = seededFloat(random, -cfg.delayJitterMs, cfg.delayJitterMs);
    const baseDelayMs = cfg.streamStartDelayMs + index * startSpacingMs;
    const delayMs = Math.max(0, baseDelayMs + delayJitterMs);
    const dyVariancePx = seededFloat(random, 0, cfg.topExitMarginPx);

    return {
      id: `endgame_celebration_star_${index}`,
      kind: 'shootingStar',
      x: seededFloat(random, 0, viewport.width),
      y: seededFloat(random, viewport.height + 20, viewport.height + cfg.bottomMarginPx),
      sizePx: Number(seededFloat(random, cfg.minSizePx, cfg.maxSizePx).toFixed(2)),
      dx: 0,
      dy: -(
        viewport.height +
        cfg.bottomMarginPx +
        cfg.topExitMarginPx +
        dyVariancePx
      ),
      durationMs: Math.round(seededFloat(random, cfg.minDurationMs, cfg.maxDurationMs)),
      delayMs: Math.round(delayMs),
      opacity: Number(seededFloat(random, cfg.minOpacity, cfg.maxOpacity).toFixed(2)),
    };
  });
}
