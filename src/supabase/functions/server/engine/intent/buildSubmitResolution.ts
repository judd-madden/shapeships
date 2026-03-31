import { getCommitRecord } from './CommitStore.ts';
import { getBuildCommitKey, type BuildSubmitPayload } from './IntentTypes.ts';
import {
  SHIP_DEFINITIONS_CORE_SERVER,
  getShipById,
} from '../../engine_shared/defs/ShipDefinitions.core.ts';
import type { ShipInstance } from '../state/GameStateTypes.ts';

type BuildAttemptSkipReason =
  | 'unknown_ship'
  | 'insufficient_ordinary_lines'
  | 'insufficient_joining_lines'
  | 'missing_components'
  | 'component_not_depleted'
  | 'max_quantity_reached';

type ExpandedBuildAttempt = {
  shipDefId: string;
  attemptIndex: number;
  freeReason?: 'zenith_antlion';
  frigateTrigger?: number;
};

type WorkingFleetEntry = {
  instanceId: string;
  shipDefId: string;
  chargesCurrent: number;
  createdTurn?: number;
};

type EvolverBuildChoiceEntry = NonNullable<BuildSubmitPayload['evolverChoices']>[number];

type FutureDemandContext = {
  upgradedAttempts: ExpandedBuildAttempt[];
  evolverChoices: EvolverBuildChoiceEntry[];
};

type ComponentRequirement = {
  shipDefId: string;
  mustBeDepleted: boolean;
};

type BuildSubmitResolutionArgs = {
  state: any;
  turnNumber: number;
  nowMs: number;
};

export type BuildSubmitResolutionResult = {
  state: any;
  events: any[];
  alreadyApplied: boolean;
};

// Mirrors the Pass 2 preview evaluator order in provisionalBuild.ts:
// ENGINE_SHIP_DEFINITIONS.map((shipDef) => shipDef.id)
const PREVIEW_PARITY_BUILD_ORDER = SHIP_DEFINITIONS_CORE_SERVER.map((shipDef) => shipDef.id);
const SAVED_LINE_CAP = 12;

function normalizeResource(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

function normalizeChargesCurrent(ship: ShipInstance): number {
  if (typeof ship?.chargesCurrent === 'number' && Number.isFinite(ship.chargesCurrent)) {
    return Math.max(0, Math.floor(ship.chargesCurrent));
  }

  const shipDef = getShipById(ship.shipDefId);
  if (typeof shipDef?.charges === 'number' && Number.isFinite(shipDef.charges)) {
    return Math.max(0, Math.floor(shipDef.charges));
  }

  return 0;
}

function buildWorkingFleetEntries(ships: ShipInstance[]): WorkingFleetEntry[] {
  const entries: WorkingFleetEntry[] = [];

  for (const ship of ships) {
    if (!ship || typeof ship.instanceId !== 'string' || typeof ship.shipDefId !== 'string') {
      continue;
    }

    entries.push({
      instanceId: ship.instanceId,
      shipDefId: ship.shipDefId,
      chargesCurrent: normalizeChargesCurrent(ship),
      createdTurn: ship.createdTurn,
    });
  }

  return entries;
}

function parseComponentRequirement(componentToken: string): ComponentRequirement {
  const depletedMatch = componentToken.match(/^([A-Z0-9]+)\(0\)$/);
  if (depletedMatch) {
    return {
      shipDefId: depletedMatch[1],
      mustBeDepleted: true,
    };
  }

  return {
    shipDefId: componentToken.trim(),
    mustBeDepleted: false,
  };
}

function expandBuildAttempts(payload: BuildSubmitPayload): ExpandedBuildAttempt[] {
  const countsByShipDefId = new Map<string, number>();

  for (const build of payload.builds ?? []) {
    if (!build || typeof build.shipDefId !== 'string') continue;
    const count = normalizeResource(build.count);
    if (count <= 0) continue;
    countsByShipDefId.set(build.shipDefId, (countsByShipDefId.get(build.shipDefId) ?? 0) + count);
  }

  const zenCount = countsByShipDefId.get('ZEN') ?? 0;
  const antCount = countsByShipDefId.get('ANT') ?? 0;
  const freeAntCount = Math.min(antCount, zenCount);
  const paidAntCount = Math.max(0, antCount - freeAntCount);

  const attempts: ExpandedBuildAttempt[] = [];
  let nextAttemptIndex = 0;
  let frigateTriggerCursor = 0;

  for (const shipDefId of PREVIEW_PARITY_BUILD_ORDER) {
    const totalCount = countsByShipDefId.get(shipDefId) ?? 0;
    if (totalCount <= 0) continue;

    if (shipDefId === 'ANT') {
      for (let i = 0; i < paidAntCount; i++) {
        attempts.push({
          shipDefId,
          attemptIndex: nextAttemptIndex++,
        });
      }
      continue;
    }

    if (shipDefId === 'ZEN') {
      for (let i = 0; i < totalCount; i++) {
        attempts.push({
          shipDefId,
          attemptIndex: nextAttemptIndex++,
        });

        if (i < freeAntCount) {
          attempts.push({
            shipDefId: 'ANT',
            attemptIndex: nextAttemptIndex++,
            freeReason: 'zenith_antlion',
          });
        }
      }
      continue;
    }

    if (shipDefId === 'FRI') {
      for (let i = 0; i < totalCount; i++) {
        const triggerRaw = payload.frigateTriggers?.[frigateTriggerCursor] ?? 1;
        let frigateTrigger = Number(triggerRaw);
        if (!Number.isFinite(frigateTrigger)) frigateTrigger = 1;
        frigateTrigger = Math.max(1, Math.min(6, Math.floor(frigateTrigger)));
        frigateTriggerCursor += 1;

        attempts.push({
          shipDefId,
          attemptIndex: nextAttemptIndex++,
          frigateTrigger,
        });
      }
      continue;
    }

    for (let i = 0; i < totalCount; i++) {
      attempts.push({
        shipDefId,
        attemptIndex: nextAttemptIndex++,
      });
    }
  }

  return attempts;
}

function countWorkingFleetShips(entries: WorkingFleetEntry[], shipDefId: string): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.shipDefId === shipDefId) count++;
  }
  return count;
}

function reserveUpgradeComponents(
  entries: WorkingFleetEntry[],
  shipDefId: string,
): { ok: true; reservedIndices: number[] } | { ok: false; reason: BuildAttemptSkipReason } {
  const shipDef = getShipById(shipDefId);
  const componentTokens = Array.isArray(shipDef?.componentShips) ? shipDef.componentShips : [];
  const reservedIndices = new Set<number>();

  for (const componentToken of componentTokens) {
    const requirement = parseComponentRequirement(componentToken);
    const reservedIndex = entries.findIndex((entry, index) => {
      if (reservedIndices.has(index)) return false;
      if (entry.shipDefId !== requirement.shipDefId) return false;
      if (requirement.mustBeDepleted && entry.chargesCurrent > 0) return false;
      return true;
    });

    if (reservedIndex >= 0) {
      reservedIndices.add(reservedIndex);
      continue;
    }

    if (requirement.mustBeDepleted) {
      const hasMatchingNonDepleted = entries.some((entry, index) => {
        if (reservedIndices.has(index)) return false;
        return entry.shipDefId === requirement.shipDefId;
      });

      if (hasMatchingNonDepleted) {
        return { ok: false, reason: 'component_not_depleted' };
      }
    }

    return { ok: false, reason: 'missing_components' };
  }

  return {
    ok: true,
    reservedIndices: Array.from(reservedIndices).sort((a, b) => a - b),
  };
}

function ensureShipsContainer(state: any, playerId: string): ShipInstance[] {
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.ships) state.gameData.ships = {};
  if (!Array.isArray(state.gameData.ships[playerId])) {
    state.gameData.ships[playerId] = [];
  }
  return state.gameData.ships[playerId];
}

function ensureFrigateMemory(state: any) {
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.powerMemory) state.gameData.powerMemory = {};
  if (!state.gameData.powerMemory.frigateTriggerByInstanceId) {
    state.gameData.powerMemory.frigateTriggerByInstanceId = {};
  }
}

function incrementShipsMadeThisTurnCounter(state: any, playerId: string, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) return;

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const currentMap = state.gameData.turnData.shipsMadeThisTurnByPlayerId || {};
  const currentCount = currentMap[playerId] || 0;

  state.gameData.turnData.shipsMadeThisTurnByPlayerId = {
    ...currentMap,
    [playerId]: currentCount + amount,
  };
}

function snapshotBuildPhaseNonDestroyRemovedShips(
  state: any,
  playerId: string,
  instanceIds: string[],
) {
  if (instanceIds.length === 0) return;

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const currentFleet = ensureShipsContainer(state, playerId);
  const currentLedger = state.gameData.turnData.buildPhaseNonDestroyRemovedShipsByPlayerId || {};
  const currentPlayerLedger = currentLedger[playerId] || {};
  const pendingIds = new Set(
    instanceIds.filter((instanceId): instanceId is string => typeof instanceId === 'string')
  );

  if (pendingIds.size === 0) return;

  const nextPlayerLedger: Record<string, ShipInstance> = { ...currentPlayerLedger };
  let hasNewSnapshot = false;

  for (const ship of currentFleet) {
    if (!pendingIds.has(ship.instanceId)) continue;
    if (currentPlayerLedger[ship.instanceId]) continue;

    nextPlayerLedger[ship.instanceId] = ship;
    hasNewSnapshot = true;
  }

  if (!hasNewSnapshot) return;

  state.gameData.turnData.buildPhaseNonDestroyRemovedShipsByPlayerId = {
    ...currentLedger,
    [playerId]: nextPlayerLedger,
  };
}

function appendCreatedShip(args: {
  state: any;
  playerId: string;
  shipDefId: string;
  turnNumber: number;
  workingFleet: WorkingFleetEntry[];
  frigateTrigger?: number;
  countAsCreatedShip?: boolean;
}): ShipInstance {
  const { state, playerId, shipDefId, turnNumber, workingFleet, frigateTrigger } = args;
  const shipDef = getShipById(shipDefId);

  const shipInstance: ShipInstance = {
    instanceId: crypto.randomUUID(),
    shipDefId,
    createdTurn: turnNumber,
  };

  if (typeof shipDef?.charges === 'number' && Number.isFinite(shipDef.charges)) {
    shipInstance.chargesCurrent = shipDef.charges;
  }

  ensureShipsContainer(state, playerId).push(shipInstance);
  workingFleet.push({
    instanceId: shipInstance.instanceId,
    shipDefId: shipInstance.shipDefId,
    chargesCurrent: normalizeChargesCurrent(shipInstance),
    createdTurn: shipInstance.createdTurn,
  });

  if (shipDefId === 'FRI') {
    ensureFrigateMemory(state);
    state.gameData.powerMemory.frigateTriggerByInstanceId[shipInstance.instanceId] = frigateTrigger ?? 1;
  }

  if (args.countAsCreatedShip !== false) {
    incrementShipsMadeThisTurnCounter(state, playerId, 1);
  }

  return shipInstance;
}

function removeWorkingFleetEntries(
  state: any,
  playerId: string,
  workingFleet: WorkingFleetEntry[],
  reservedIndices: number[],
) {
  const reservedInstanceIds = new Set(
    reservedIndices
      .map((index) => workingFleet[index]?.instanceId)
      .filter((instanceId): instanceId is string => typeof instanceId === 'string')
  );

  if (reservedInstanceIds.size === 0) return;

  state.gameData.ships[playerId] = ensureShipsContainer(state, playerId).filter(
    (ship: ShipInstance) => !reservedInstanceIds.has(ship.instanceId)
  );

  for (let i = reservedIndices.length - 1; i >= 0; i--) {
    workingFleet.splice(reservedIndices[i], 1);
  }
}

function persistSavedResources(
  state: any,
  playerId: string,
  remainingOrdinaryLines: number,
  remainingJoiningLines: number,
) {
  const playerIndex = state.players.findIndex((player: any) => player.id === playerId);
  if (playerIndex < 0) return;

  const clampedOrdinaryLines = Math.max(0, Math.min(remainingOrdinaryLines, SAVED_LINE_CAP));
  const remainingCapacity = Math.max(0, SAVED_LINE_CAP - clampedOrdinaryLines);
  const clampedJoiningLines = Math.max(0, Math.min(remainingJoiningLines, remainingCapacity));

  state.players[playerIndex] = {
    ...state.players[playerIndex],
    lines: clampedOrdinaryLines,
    joiningLines: clampedJoiningLines,
  };
}

function pushSkippedAttemptEvent(args: {
  events: any[];
  playerId: string;
  shipDefId: string;
  attemptIndex: number;
  reason: BuildAttemptSkipReason;
  nowMs: number;
}) {
  args.events.push({
    type: 'BUILD_ATTEMPT_SKIPPED',
    playerId: args.playerId,
    shipDefId: args.shipDefId,
    attemptIndex: args.attemptIndex,
    reason: args.reason,
    atMs: args.nowMs,
  });
}

function isUpgradedBuildAttempt(attempt: ExpandedBuildAttempt): boolean {
  const shipDef = getShipById(attempt.shipDefId);
  return Boolean(
    Array.isArray(shipDef?.componentShips) &&
    shipDef.componentShips.length > 0 &&
    typeof shipDef.joiningLineCost === 'number'
  );
}

function partitionBuildAttempts(buildAttempts: ExpandedBuildAttempt[]): {
  nonUpgradedAttempts: ExpandedBuildAttempt[];
  upgradedAttempts: ExpandedBuildAttempt[];
} {
  const nonUpgradedAttempts: ExpandedBuildAttempt[] = [];
  const upgradedAttempts: ExpandedBuildAttempt[] = [];

  for (const attempt of buildAttempts) {
    if (isUpgradedBuildAttempt(attempt)) {
      upgradedAttempts.push(attempt);
      continue;
    }

    nonUpgradedAttempts.push(attempt);
  }

  return {
    nonUpgradedAttempts,
    upgradedAttempts,
  };
}

function cloneWorkingFleetEntries(entries: WorkingFleetEntry[]): WorkingFleetEntry[] {
  return entries.map((entry) => ({ ...entry }));
}

function applyBasicBuildAttemptSimulation(args: {
  attempt: ExpandedBuildAttempt;
  workingFleet: WorkingFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): {
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  didApply: boolean;
} {
  const { attempt, workingFleet } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;
  const shipDef = getShipById(attempt.shipDefId);

  if (!shipDef || isUpgradedBuildAttempt(attempt)) {
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
      didApply: false,
    };
  }

  const ordinaryCost = attempt.freeReason === 'zenith_antlion'
    ? 0
    : normalizeResource(shipDef.totalLineCost);

  if (remainingOrdinaryLines < ordinaryCost) {
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
      didApply: false,
    };
  }

  remainingOrdinaryLines -= ordinaryCost;
  workingFleet.push({
    instanceId: `sim_${attempt.shipDefId}_${workingFleet.length}`,
    shipDefId: attempt.shipDefId,
    chargesCurrent: typeof shipDef.charges === 'number' ? normalizeResource(shipDef.charges) : 0,
  });

  if (attempt.shipDefId === 'LEG') {
    remainingJoiningLines += 4;
  }

  return {
    remainingOrdinaryLines,
    remainingJoiningLines,
    didApply: true,
  };
}

function applySimulatedEvolverConversions(
  workingFleet: WorkingFleetEntry[],
  evolverChoices: EvolverBuildChoiceEntry[],
) {
  for (const evolverChoice of evolverChoices) {
    if (evolverChoice?.choiceId !== 'oxite' && evolverChoice?.choiceId !== 'asterite') {
      continue;
    }

    const xeniteIndex = workingFleet.findIndex((entry) => entry.shipDefId === 'XEN');
    if (xeniteIndex < 0) {
      continue;
    }

    workingFleet.splice(xeniteIndex, 1);
    const createdShipDefId = evolverChoice.choiceId === 'oxite' ? 'OXI' : 'AST';
    const createdShipDef = getShipById(createdShipDefId);
    workingFleet.push({
      instanceId: `sim_${createdShipDefId}_${workingFleet.length}`,
      shipDefId: createdShipDefId,
      chargesCurrent: typeof createdShipDef?.charges === 'number'
        ? normalizeResource(createdShipDef.charges)
        : 0,
    });
  }
}

function simulateResolvedUpgradedDemand(args: {
  targetShipDefId: string;
  upgradedAttempts: ExpandedBuildAttempt[];
  workingFleet: WorkingFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): number {
  const {
    targetShipDefId,
    upgradedAttempts,
    workingFleet,
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;
  let freeingDemand = 0;

  for (const attempt of upgradedAttempts) {
    const shipDef = getShipById(attempt.shipDefId);
    if (!shipDef || !isUpgradedBuildAttempt(attempt)) {
      continue;
    }

    const maxQuantity = shipDef.maxQuantity;
    const currentShipCount = countWorkingFleetShips(workingFleet, attempt.shipDefId);
    if (typeof maxQuantity === 'number' && currentShipCount >= maxQuantity) {
      continue;
    }

    const reservation = reserveUpgradeComponents(workingFleet, attempt.shipDefId);
    if (!reservation.ok) {
      continue;
    }

    const joiningCost = normalizeResource(shipDef.joiningLineCost);
    const joiningSpend = Math.min(remainingJoiningLines, joiningCost);
    const ordinaryShortfall = joiningCost - joiningSpend;
    if (remainingOrdinaryLines < ordinaryShortfall) {
      continue;
    }

    freeingDemand += reservation.reservedIndices.reduce((count, reservedIndex) => {
      return count + (workingFleet[reservedIndex]?.shipDefId === targetShipDefId ? 1 : 0);
    }, 0);

    for (let i = reservation.reservedIndices.length - 1; i >= 0; i--) {
      workingFleet.splice(reservation.reservedIndices[i], 1);
    }

    remainingJoiningLines -= joiningSpend;
    remainingOrdinaryLines -= ordinaryShortfall;
    workingFleet.push({
      instanceId: `sim_${attempt.shipDefId}_${workingFleet.length}`,
      shipDefId: attempt.shipDefId,
      chargesCurrent: typeof shipDef.charges === 'number' ? normalizeResource(shipDef.charges) : 0,
    });
  }

  return freeingDemand;
}

function simulateNonUpgradedAttempts(args: {
  buildAttempts: ExpandedBuildAttempt[];
  workingFleet: WorkingFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  futureDemandContext: FutureDemandContext;
}): {
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
} {
  const {
    buildAttempts,
    workingFleet,
    futureDemandContext,
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;

  for (let attemptIndex = 0; attemptIndex < buildAttempts.length; attemptIndex += 1) {
    const attempt = buildAttempts[attemptIndex];
    const shipDef = getShipById(attempt.shipDefId);
    if (!shipDef || isUpgradedBuildAttempt(attempt)) {
      continue;
    }

    const maxQuantity = shipDef.maxQuantity;
    const currentShipCount = countWorkingFleetShips(workingFleet, attempt.shipDefId);
    let maxQuantityReached =
      typeof maxQuantity === 'number' &&
      currentShipCount >= maxQuantity;

    if (maxQuantityReached) {
      const freeingDemand = simulateFutureResolvedUpgradedDemandForBasicAttempt({
        targetShipDefId: attempt.shipDefId,
        currentAttempt: attempt,
        remainingNonUpgradedAttempts: buildAttempts.slice(attemptIndex + 1),
        futureDemandContext,
        workingFleet,
        remainingOrdinaryLines,
        remainingJoiningLines,
      });
      maxQuantityReached = currentShipCount - freeingDemand >= maxQuantity!;
    }

    if (maxQuantityReached) {
      continue;
    }

    const resolution = applyBasicBuildAttemptSimulation({
      attempt,
      workingFleet,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });

    if (!resolution.didApply) {
      continue;
    }

    remainingOrdinaryLines = resolution.remainingOrdinaryLines;
    remainingJoiningLines = resolution.remainingJoiningLines;
  }

  return {
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

function simulateFutureResolvedUpgradedDemandForBasicAttempt(args: {
  targetShipDefId: string;
  currentAttempt: ExpandedBuildAttempt;
  remainingNonUpgradedAttempts: ExpandedBuildAttempt[];
  futureDemandContext: FutureDemandContext;
  workingFleet: WorkingFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): number {
  const {
    targetShipDefId,
    currentAttempt,
    remainingNonUpgradedAttempts,
    futureDemandContext,
    workingFleet,
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;
  const simulatedWorkingFleet = cloneWorkingFleetEntries(workingFleet);

  const currentAttemptResolution = applyBasicBuildAttemptSimulation({
    attempt: currentAttempt,
    workingFleet: simulatedWorkingFleet,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });

  if (!currentAttemptResolution.didApply) {
    return 0;
  }

  remainingOrdinaryLines = currentAttemptResolution.remainingOrdinaryLines;
  remainingJoiningLines = currentAttemptResolution.remainingJoiningLines;

  const remainingBasicResolution = simulateNonUpgradedAttempts({
    buildAttempts: remainingNonUpgradedAttempts,
    workingFleet: simulatedWorkingFleet,
    remainingOrdinaryLines,
    remainingJoiningLines,
    futureDemandContext,
  });

  applySimulatedEvolverConversions(
    simulatedWorkingFleet,
    futureDemandContext.evolverChoices,
  );

  return simulateResolvedUpgradedDemand({
    targetShipDefId,
    upgradedAttempts: futureDemandContext.upgradedAttempts,
    workingFleet: simulatedWorkingFleet,
    remainingOrdinaryLines: remainingBasicResolution.remainingOrdinaryLines,
    remainingJoiningLines: remainingBasicResolution.remainingJoiningLines,
  });
}

function resolveBuildAttempt(args: {
  state: any;
  events: any[];
  playerId: string;
  turnNumber: number;
  nowMs: number;
  attempt: ExpandedBuildAttempt;
  workingFleet: WorkingFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  futureDemandContext?: FutureDemandContext;
  remainingNonUpgradedAttempts?: ExpandedBuildAttempt[];
}): {
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
} {
  const {
    state,
    events,
    playerId,
    turnNumber,
    nowMs,
    attempt,
    workingFleet,
    futureDemandContext,
    remainingNonUpgradedAttempts = [],
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;

  const shipDef = getShipById(attempt.shipDefId);
  if (!shipDef) {
    pushSkippedAttemptEvent({
      events,
      playerId,
      shipDefId: attempt.shipDefId,
      attemptIndex: attempt.attemptIndex,
      reason: 'unknown_ship',
      nowMs,
    });
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const maxQuantity = shipDef.maxQuantity;
  const currentShipCount = countWorkingFleetShips(workingFleet, attempt.shipDefId);
  let maxQuantityReached =
    typeof maxQuantity === 'number' &&
    currentShipCount >= maxQuantity;

  if (maxQuantityReached && !isUpgradedBuildAttempt(attempt) && futureDemandContext && typeof maxQuantity === 'number') {
    const freeingDemand = simulateFutureResolvedUpgradedDemandForBasicAttempt({
      targetShipDefId: attempt.shipDefId,
      currentAttempt: attempt,
      remainingNonUpgradedAttempts,
      futureDemandContext,
      workingFleet,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });
    maxQuantityReached = currentShipCount - freeingDemand >= maxQuantity!;
  }

  if (maxQuantityReached) {
    pushSkippedAttemptEvent({
      events,
      playerId,
      shipDefId: attempt.shipDefId,
      attemptIndex: attempt.attemptIndex,
      reason: 'max_quantity_reached',
      nowMs,
    });
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  if (!isUpgradedBuildAttempt(attempt)) {
    const ordinaryCost = attempt.freeReason === 'zenith_antlion'
      ? 0
      : normalizeResource(shipDef.totalLineCost);

    if (remainingOrdinaryLines < ordinaryCost) {
      pushSkippedAttemptEvent({
        events,
        playerId,
        shipDefId: attempt.shipDefId,
        attemptIndex: attempt.attemptIndex,
        reason: 'insufficient_ordinary_lines',
        nowMs,
      });
      return {
        remainingOrdinaryLines,
        remainingJoiningLines,
      };
    }

    remainingOrdinaryLines -= ordinaryCost;
    appendCreatedShip({
      state,
      playerId,
      shipDefId: attempt.shipDefId,
      turnNumber,
      workingFleet,
      frigateTrigger: attempt.frigateTrigger,
    });

    if (attempt.shipDefId === 'LEG') {
      remainingJoiningLines += 4;
    }

    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const reservation = reserveUpgradeComponents(workingFleet, attempt.shipDefId);
  if (!reservation.ok) {
    pushSkippedAttemptEvent({
      events,
      playerId,
      shipDefId: attempt.shipDefId,
      attemptIndex: attempt.attemptIndex,
      reason: reservation.reason,
      nowMs,
    });
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const joiningCost = normalizeResource(shipDef.joiningLineCost);
  const joiningSpend = Math.min(remainingJoiningLines, joiningCost);
  const ordinaryShortfall = joiningCost - joiningSpend;

  if (remainingOrdinaryLines < ordinaryShortfall) {
    pushSkippedAttemptEvent({
      events,
      playerId,
      shipDefId: attempt.shipDefId,
      attemptIndex: attempt.attemptIndex,
      reason: 'insufficient_joining_lines',
      nowMs,
    });
    return {
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const consumedInstanceIds = reservation.reservedIndices
    .map((index) => workingFleet[index]?.instanceId)
    .filter((instanceId): instanceId is string => typeof instanceId === 'string');
  snapshotBuildPhaseNonDestroyRemovedShips(state, playerId, consumedInstanceIds);
  removeWorkingFleetEntries(state, playerId, workingFleet, reservation.reservedIndices);
  remainingJoiningLines -= joiningSpend;
  remainingOrdinaryLines -= ordinaryShortfall;

  appendCreatedShip({
    state,
    playerId,
    shipDefId: attempt.shipDefId,
    turnNumber,
    workingFleet,
    frigateTrigger: attempt.frigateTrigger,
  });

  return {
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

function resolveBuildAttemptsStage(args: {
  state: any;
  events: any[];
  playerId: string;
  turnNumber: number;
  nowMs: number;
  buildAttempts: ExpandedBuildAttempt[];
  workingFleet: WorkingFleetEntry[];
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
  futureDemandContext?: FutureDemandContext;
}): {
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
} {
  const {
    buildAttempts,
    futureDemandContext,
  } = args;
  let { remainingOrdinaryLines, remainingJoiningLines } = args;

  for (let attemptIndex = 0; attemptIndex < buildAttempts.length; attemptIndex += 1) {
    const attempt = buildAttempts[attemptIndex];
    const result = resolveBuildAttempt({
      ...args,
      attempt,
      remainingOrdinaryLines,
      remainingJoiningLines,
      futureDemandContext,
      remainingNonUpgradedAttempts: futureDemandContext
        ? buildAttempts.slice(attemptIndex + 1)
        : [],
    });
    remainingOrdinaryLines = result.remainingOrdinaryLines;
    remainingJoiningLines = result.remainingJoiningLines;
  }

  return {
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

function resolvePlayerBuildSubmit(args: {
  state: any;
  playerId: string;
  turnNumber: number;
  nowMs: number;
  payload: BuildSubmitPayload | null;
}): any[] {
  const { state, playerId, turnNumber, nowMs, payload } = args;
  const events: any[] = [];

  ensureShipsContainer(state, playerId);

  const player = state.players.find((entry: any) => entry.id === playerId);
  if (!player) return events;

  let remainingOrdinaryLines = normalizeResource(player.lines);
  let remainingJoiningLines = normalizeResource(player.joiningLines);

  const workingFleet = buildWorkingFleetEntries(state.gameData.ships[playerId] ?? []);
  const buildAttempts = payload ? expandBuildAttempts(payload) : [];
  const { nonUpgradedAttempts, upgradedAttempts } = partitionBuildAttempts(buildAttempts);
  const futureDemandContext: FutureDemandContext = {
    upgradedAttempts,
    evolverChoices: payload?.evolverChoices ?? [],
  };
  const nonUpgradedStageResolution = resolveBuildAttemptsStage({
    state,
    events,
    playerId,
    turnNumber,
    nowMs,
    buildAttempts: nonUpgradedAttempts,
    workingFleet,
    remainingOrdinaryLines,
    remainingJoiningLines,
    futureDemandContext,
  });
  remainingOrdinaryLines = nonUpgradedStageResolution.remainingOrdinaryLines;
  remainingJoiningLines = nonUpgradedStageResolution.remainingJoiningLines;

  for (const evolverChoice of payload?.evolverChoices ?? []) {
    if (evolverChoice?.choiceId !== 'oxite' && evolverChoice?.choiceId !== 'asterite') {
      continue;
    }

    const xeniteIndex = workingFleet.findIndex((entry) => entry.shipDefId === 'XEN');
    if (xeniteIndex < 0) {
      events.push({
        type: 'BUILD_EVOLVER_SKIPPED',
        playerId,
        sourceKey: evolverChoice?.sourceKey,
        reason: 'missing_xenite',
        atMs: nowMs,
      });
      continue;
    }

    const xeniteInstanceId = workingFleet[xeniteIndex]?.instanceId;
    if (typeof xeniteInstanceId === 'string') {
      snapshotBuildPhaseNonDestroyRemovedShips(state, playerId, [xeniteInstanceId]);
    }
    removeWorkingFleetEntries(state, playerId, workingFleet, [xeniteIndex]);
    const createdShipDefId = evolverChoice.choiceId === 'oxite' ? 'OXI' : 'AST';
    appendCreatedShip({
      state,
      playerId,
      shipDefId: createdShipDefId,
      turnNumber,
      workingFleet,
    });

    events.push({
      type: 'BUILD_EVOLVER_CONVERTED',
      playerId,
      sourceKey: evolverChoice.sourceKey,
      createdShipDefId,
      atMs: nowMs,
    });
  }

  const upgradedStageResolution = resolveBuildAttemptsStage({
    state,
    events,
    playerId,
    turnNumber,
    nowMs,
    buildAttempts: upgradedAttempts,
    workingFleet,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });
  remainingOrdinaryLines = upgradedStageResolution.remainingOrdinaryLines;
  remainingJoiningLines = upgradedStageResolution.remainingJoiningLines;

  persistSavedResources(
    state,
    playerId,
    remainingOrdinaryLines,
    remainingJoiningLines,
  );

  events.push({
    type: 'BUILD_RESOURCES_PERSISTED',
    playerId,
    ordinaryLines: state.players.find((entry: any) => entry.id === playerId)?.lines ?? 0,
    joiningLines: state.players.find((entry: any) => entry.id === playerId)?.joiningLines ?? 0,
    atMs: nowMs,
  });

  return events;
}

export function resolveBuildSubmitAuthoritatively(
  args: BuildSubmitResolutionArgs,
): BuildSubmitResolutionResult {
  const { state, turnNumber, nowMs } = args;
  const events: any[] = [];

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};
  if (!state.gameData.ships) state.gameData.ships = {};

  if (state.gameData.turnData.buildAppliedTurnNumber === turnNumber) {
    return {
      state,
      events,
      alreadyApplied: true,
    };
  }

  const commitKey = getBuildCommitKey(turnNumber);
  const activePlayers = (state.players || []).filter((player: any) => player.role === 'player');

  for (const player of activePlayers) {
    const record = getCommitRecord(state, commitKey, player.id);
    const payload = record?.revealPayload as BuildSubmitPayload | undefined;
    events.push(
      ...resolvePlayerBuildSubmit({
        state,
        playerId: player.id,
        turnNumber,
        nowMs,
        payload: payload ?? null,
      }),
    );
  }

  state.gameData.turnData.buildAppliedTurnNumber = turnNumber;

  return {
    state,
    events,
    alreadyApplied: false,
  };
}
