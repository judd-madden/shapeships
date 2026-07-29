import type { ShipInstance } from '../state/GameStateTypes.ts';

export type DiceManipulationStage = 'kno' | 'cube';
export type CubeDieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type CubeDiceChoiceId = 'main' | `cube:${string}`;

export type LockedCubeDieRoll = {
  sourceInstanceId: string;
  value: CubeDieValue;
};

export type CubeDiceActionChoice = {
  choiceId: CubeDiceChoiceId;
  projectedAmount: CubeDieValue;
};

export type CubeDiceAction = {
  kind: 'choice';
  actionId: 'CUB#0';
  shipDefId: 'CUB';
  sourceInstanceId: string;
  choices: CubeDiceActionChoice[];
};

function isCubeDieValue(value: unknown): value is CubeDieValue {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6;
}

export function getOrderedControlledCubeInstances(
  state: any,
  playerId: string,
): ShipInstance[] {
  const fleet = state?.gameData?.ships?.[playerId];
  if (!Array.isArray(fleet)) return [];

  return fleet
    .filter(
      (ship: any): ship is ShipInstance =>
        ship?.shipDefId === 'CUB' &&
        typeof ship?.instanceId === 'string' &&
        ship.instanceId.length > 0,
    )
    .slice()
    .sort((left, right) => left.instanceId.localeCompare(right.instanceId));
}

export function playerControlsLeviathan(state: any, playerId: string): boolean {
  const fleet = state?.gameData?.ships?.[playerId];
  return Array.isArray(fleet) &&
    fleet.some((ship: any) => ship?.shipDefId === 'LEV');
}

export function playerIsCubeEligible(state: any, playerId: string): boolean {
  if (playerControlsLeviathan(state, playerId)) return false;
  return getOrderedControlledCubeInstances(state, playerId).length > 0;
}

export function getCubeEligiblePlayerIds(state: any): string[] {
  return (state?.players ?? [])
    .filter((player: any) => player?.role === 'player')
    .map((player: any) => player.id)
    .filter((playerId: string) => playerIsCubeEligible(state, playerId));
}

export function anyPlayerIsCubeEligible(state: any): boolean {
  return getCubeEligiblePlayerIds(state).length > 0;
}

export function getRepresentativeCubeInstanceId(
  state: any,
  playerId: string,
): string | null {
  return getOrderedControlledCubeInstances(state, playerId)[0]?.instanceId ?? null;
}

export function rollLockedCubeDiceByPlayerId(
  state: any,
  rollDie: () => number,
): Record<string, LockedCubeDieRoll[]> {
  const result: Record<string, LockedCubeDieRoll[]> = {};

  for (const playerId of getCubeEligiblePlayerIds(state)) {
    result[playerId] = getOrderedControlledCubeInstances(state, playerId).map(
      (ship) => {
        const value = rollDie();
        if (!isCubeDieValue(value)) {
          throw new Error('INVALID_CUBE_DIE_ROLL');
        }
        return {
          sourceInstanceId: ship.instanceId,
          value,
        };
      },
    );
  }

  return result;
}

export function getLockedCubeRollsForPlayer(
  state: any,
  playerId: string,
): LockedCubeDieRoll[] {
  const rolls = state?.gameData?.turnData?.cubeDiceRollsByPlayerId?.[playerId];
  if (!Array.isArray(rolls)) return [];

  return rolls.filter(
    (roll: any): roll is LockedCubeDieRoll =>
      typeof roll?.sourceInstanceId === 'string' &&
      roll.sourceInstanceId.length > 0 &&
      isCubeDieValue(roll.value),
  );
}

export function getCubeDiceActionForPlayer(
  state: any,
  playerId: string,
): CubeDiceAction | null {
  if (state?.gameData?.turnData?.diceManipulationStage !== 'cube') return null;
  if (!playerIsCubeEligible(state, playerId)) return null;

  const sourceInstanceId = getRepresentativeCubeInstanceId(state, playerId);
  const mainValue =
    state?.gameData?.turnData?.baseDiceRoll ??
    state?.gameData?.turnData?.effectiveDiceRoll ??
    state?.gameData?.turnData?.diceRoll;
  const rolls = getLockedCubeRollsForPlayer(state, playerId);
  if (!sourceInstanceId || !isCubeDieValue(mainValue) || rolls.length === 0) {
    return null;
  }

  const seen = new Set<string>();
  for (const roll of rolls) {
    if (seen.has(roll.sourceInstanceId)) return null;
    seen.add(roll.sourceInstanceId);
  }

  return {
    kind: 'choice',
    actionId: 'CUB#0',
    shipDefId: 'CUB',
    sourceInstanceId,
    choices: [
      { choiceId: 'main', projectedAmount: mainValue },
      ...rolls.map((roll) => ({
        choiceId: `cube:${roll.sourceInstanceId}` as CubeDiceChoiceId,
        projectedAmount: roll.value,
      })),
    ],
  };
}

export function validateCubeDiceChoice(
  state: any,
  playerId: string,
  sourceInstanceId: string,
  actionId: string,
  choiceId: string,
): { choiceId: CubeDiceChoiceId; value: CubeDieValue; sourceInstanceId?: string } {
  if (state?.gameData?.turnData?.diceManipulationStage !== 'cube') {
    throw new Error('INVALID_CUBE_STAGE');
  }
  if (actionId !== 'CUB#0') throw new Error('INVALID_CUBE_ACTION');
  if (!playerIsCubeEligible(state, playerId)) {
    throw new Error('CUBE_DICE_CHOICE_NOT_AVAILABLE');
  }

  const action = getCubeDiceActionForPlayer(state, playerId);
  if (!action || action.sourceInstanceId !== sourceInstanceId) {
    throw new Error('INVALID_CUBE_SOURCE');
  }

  const matches = action.choices.filter((choice) => choice.choiceId === choiceId);
  if (matches.length !== 1) throw new Error('INVALID_CUBE_CHOICE');

  if (choiceId === 'main') {
    return { choiceId: 'main', value: matches[0].projectedAmount };
  }

  const lockedSourceInstanceId = choiceId.startsWith('cube:')
    ? choiceId.slice('cube:'.length)
    : '';
  const lockedMatches = getLockedCubeRollsForPlayer(state, playerId).filter(
    (roll) => roll.sourceInstanceId === lockedSourceInstanceId,
  );
  if (lockedMatches.length !== 1) throw new Error('INVALID_CUBE_CHOICE');

  return {
    choiceId: choiceId as CubeDiceChoiceId,
    value: lockedMatches[0].value,
    sourceInstanceId: lockedSourceInstanceId,
  };
}

export function playerHasValidPendingCubeChoice(
  state: any,
  playerId: string,
): boolean {
  const choiceId =
    state?.gameData?.turnData?.pendingCubeDiceChoiceByPlayerId?.[playerId];
  if (typeof choiceId !== 'string') return false;

  const sourceInstanceId = getRepresentativeCubeInstanceId(state, playerId);
  if (!sourceInstanceId) return false;

  try {
    validateCubeDiceChoice(
      state,
      playerId,
      sourceInstanceId,
      'CUB#0',
      choiceId,
    );
    return true;
  } catch {
    return false;
  }
}
