import type { BotPlanId } from './botTypes.ts';

export type AncientBotStrategyFamily = 'CUB' | 'NEP' | 'SPI' | 'MER';

export type AncientBotStrategy = {
  id: BotPlanId;
  workingName: string;
  speciesId: 'ANC';
  family: AncientBotStrategyFamily;
};

export type AncientOpeningChooserInput = {
  gameId: string;
  turnNumber: number;
  availableOrdinaryLines: number;
};

export type AncientOpeningChooserDecision =
  | {
      kind: 'selected';
      family: AncientBotStrategyFamily;
      strategyId: BotPlanId;
    }
  | { kind: 'save'; thresholdClass: 'six' | 'low' }
  | {
      kind: 'invalid';
      reason: 'invalid_game_id' | 'invalid_turn_number' | 'invalid_available_ordinary_lines';
    };

function strategy(
  id: BotPlanId,
  workingName: string,
  family: AncientBotStrategyFamily,
): AncientBotStrategy {
  return { id, workingName, speciesId: 'ANC', family };
}

export const ANCIENT_CUB_BOT_STRATEGIES: readonly AncientBotStrategy[] = [
  strategy('anc_cube_red_green', 'Simple Cube Red/Green', 'CUB'),
  strategy('anc_big_standard_econ', 'Big Standard Econ', 'CUB'),
  strategy(
    'anc_cube_quantum_solar_snowball',
    'Cube Quantum Solar Snowball',
    'CUB',
  ),
  strategy('anc_vortex_no_simulacrum', 'Vortex — No Simulacrum', 'CUB'),
];

export const ANCIENT_NEP_BOT_STRATEGIES: readonly AncientBotStrategy[] = [
  strategy('anc_small_econ_siphon', 'Small Econ Siphon', 'NEP'),
  strategy('anc_sol_reach_black_hole', 'Sol Reach Black Hole', 'NEP'),
  strategy('anc_sol_blue_snowball', 'Sol Blue Snowball', 'NEP'),
  strategy('anc_vortex_simulacrum', 'Vortex + Simulacrum', 'NEP'),
  strategy('anc_silly_simulacrum', 'Silly Simulacrum', 'NEP'),
];

export const ANCIENT_SPI_BOT_STRATEGIES: readonly AncientBotStrategy[] = [
  strategy('anc_spiral_aggro', 'Spiral Into Aggro', 'SPI'),
];

export const ANCIENT_MER_BOT_STRATEGIES: readonly AncientBotStrategy[] = [
  strategy('anc_mer_aggro', 'Simple Aggro', 'MER'),
];

export const ANCIENT_BOT_STRATEGIES_BY_FAMILY: Readonly<
  Record<AncientBotStrategyFamily, readonly AncientBotStrategy[]>
> = {
  CUB: ANCIENT_CUB_BOT_STRATEGIES,
  NEP: ANCIENT_NEP_BOT_STRATEGIES,
  SPI: ANCIENT_SPI_BOT_STRATEGIES,
  MER: ANCIENT_MER_BOT_STRATEGIES,
};

export const ACTIVE_ANCIENT_BOT_STRATEGIES: readonly AncientBotStrategy[] = [
  ...ANCIENT_CUB_BOT_STRATEGIES,
  ...ANCIENT_NEP_BOT_STRATEGIES,
  ...ANCIENT_SPI_BOT_STRATEGIES,
  ...ANCIENT_MER_BOT_STRATEGIES,
];

function hashSeed(seed: string): number {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function selectFamilyStrategy(
  gameId: string,
  family: AncientBotStrategyFamily,
): AncientBotStrategy {
  const strategies = ANCIENT_BOT_STRATEGIES_BY_FAMILY[family];
  const strategyIndex = hashSeed(`${gameId}:ancient-family:${family}`) % strategies.length;
  return strategies[strategyIndex];
}

export function getAncientBotStrategyById(
  strategyId: string,
): AncientBotStrategy | null {
  return ACTIVE_ANCIENT_BOT_STRATEGIES.find((entry) => entry.id === strategyId) ?? null;
}

export function chooseAncientOpeningStrategy(
  input: AncientOpeningChooserInput,
): AncientOpeningChooserDecision {
  if (typeof input.gameId !== 'string' || input.gameId.length === 0) {
    return { kind: 'invalid', reason: 'invalid_game_id' };
  }
  if (!Number.isInteger(input.turnNumber) || input.turnNumber < 0) {
    return { kind: 'invalid', reason: 'invalid_turn_number' };
  }
  if (
    !Number.isInteger(input.availableOrdinaryLines) ||
    input.availableOrdinaryLines < 0
  ) {
    return { kind: 'invalid', reason: 'invalid_available_ordinary_lines' };
  }

  if (input.availableOrdinaryLines >= 9) {
    const selected = selectFamilyStrategy(input.gameId, 'CUB');
    return { kind: 'selected', family: 'CUB', strategyId: selected.id };
  }

  if (input.availableOrdinaryLines >= 7) {
    const selected = selectFamilyStrategy(input.gameId, 'NEP');
    return { kind: 'selected', family: 'NEP', strategyId: selected.id };
  }

  if (input.availableOrdinaryLines === 6) {
    const bucket = hashSeed(
      `${input.gameId}:ancient-opening:six:${input.turnNumber}`,
    ) % 100;
    if (bucket < 33) {
      return {
        kind: 'selected',
        family: 'SPI',
        strategyId: ANCIENT_SPI_BOT_STRATEGIES[0].id,
      };
    }
    return { kind: 'save', thresholdClass: 'six' };
  }

  const bucket = hashSeed(
    `${input.gameId}:ancient-opening:low:${input.turnNumber}`,
  ) % 100;
  if (bucket < 20) {
    return {
      kind: 'selected',
      family: 'MER',
      strategyId: ANCIENT_MER_BOT_STRATEGIES[0].id,
    };
  }
  return { kind: 'save', thresholdClass: 'low' };
}
