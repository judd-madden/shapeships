import type { BuildSubmitPayload } from '../intent/IntentTypes.ts';
import type { ShipInstance } from '../state/GameStateTypes.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import type { AuthoredBotPlan, BotBuildGoal } from './botTypes.ts';

type WorkingShipEntry = {
  shipDefId: string;
  chargesCurrent: number;
};

type ComponentRequirement = {
  shipDefId: string;
  mustBeDepleted: boolean;
};

type GoalMode = 'opening' | 'loop';

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

function buildWorkingFleet(ships: ShipInstance[]): WorkingShipEntry[] {
  const workingFleet: WorkingShipEntry[] = [];

  for (const ship of ships) {
    if (!ship || typeof ship.shipDefId !== 'string') continue;

    workingFleet.push({
      shipDefId: ship.shipDefId,
      chargesCurrent: normalizeChargesCurrent(ship),
    });
  }

  return workingFleet;
}

function countWorkingFleetShips(workingFleet: WorkingShipEntry[], shipDefId: string): number {
  let count = 0;

  for (const ship of workingFleet) {
    if (ship.shipDefId === shipDefId) {
      count += 1;
    }
  }

  return count;
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

function reserveUpgradeComponents(
  workingFleet: WorkingShipEntry[],
  shipDefId: string,
): number[] | null {
  const shipDef = getShipById(shipDefId);
  const componentTokens = Array.isArray(shipDef?.componentShips)
    ? shipDef.componentShips
    : [];
  const reservedIndices = new Set<number>();

  for (const componentToken of componentTokens) {
    const requirement = parseComponentRequirement(componentToken);
    const reservedIndex = workingFleet.findIndex((entry, index) => {
      if (reservedIndices.has(index)) return false;
      if (entry.shipDefId !== requirement.shipDefId) return false;
      if (requirement.mustBeDepleted && entry.chargesCurrent > 0) return false;
      return true;
    });

    if (reservedIndex < 0) {
      return null;
    }

    reservedIndices.add(reservedIndex);
  }

  return Array.from(reservedIndices).sort((a, b) => b - a);
}

function ensureDraftOrder(order: string[], shipDefId: string) {
  if (!order.includes(shipDefId)) {
    order.push(shipDefId);
  }
}

function buildSubmitFromDraft(
  draftOrder: string[],
  draftCounts: Map<string, number>,
): BuildSubmitPayload {
  return {
    builds: draftOrder
      .map((shipDefId) => ({
        shipDefId,
        count: draftCounts.get(shipDefId) ?? 0,
      }))
      .filter((build) => build.count > 0),
  };
}

function isOpeningSatisfied(
  plan: AuthoredBotPlan,
  authoritativeFleet: WorkingShipEntry[],
): boolean {
  for (const goal of plan.buildGoals) {
    if (!goal || typeof goal.shipDefId !== 'string') continue;
    if (!Number.isInteger(goal.targetCount) || goal.targetCount < 0) continue;

    if (countWorkingFleetShips(authoritativeFleet, goal.shipDefId) < goal.targetCount) {
      return false;
    }
  }

  return true;
}

function getGoalProgressCount(args: {
  goal: BotBuildGoal;
  goalMode: GoalMode;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
}): number {
  const { goal, goalMode, workingFleet, draftCounts } = args;

  if (goalMode === 'loop') {
    return draftCounts.get(goal.shipDefId) ?? 0;
  }

  return countWorkingFleetShips(workingFleet, goal.shipDefId);
}

function tryAddShipToDraft(args: {
  workingFleet: WorkingShipEntry[];
  shipDefId: string;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): {
  ok: boolean;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
} {
  const {
    workingFleet,
    shipDefId,
  } = args;
  let {
    remainingOrdinaryLines,
    remainingJoiningLines,
  } = args;

  const shipDef = getShipById(shipDefId);
  if (!shipDef) {
    return {
      ok: false,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const currentShipCount = countWorkingFleetShips(workingFleet, shipDefId);
  if (
    typeof shipDef.maxQuantity === 'number' &&
    currentShipCount >= shipDef.maxQuantity
  ) {
    return {
      ok: false,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const isUpgraded =
    Array.isArray(shipDef.componentShips) &&
    shipDef.componentShips.length > 0 &&
    typeof shipDef.joiningLineCost === 'number';

  if (!isUpgraded) {
    const ordinaryCost = normalizeResource(shipDef.totalLineCost);
    if (remainingOrdinaryLines < ordinaryCost) {
      return {
        ok: false,
        remainingOrdinaryLines,
        remainingJoiningLines,
      };
    }

    remainingOrdinaryLines -= ordinaryCost;
    workingFleet.push({
      shipDefId,
      chargesCurrent:
        typeof shipDef.charges === 'number'
          ? normalizeResource(shipDef.charges)
          : 0,
    });

    return {
      ok: true,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const reservedIndices = reserveUpgradeComponents(workingFleet, shipDefId);
  if (!reservedIndices) {
    return {
      ok: false,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  const joiningCost = normalizeResource(shipDef.joiningLineCost);
  const joiningSpend = Math.min(remainingJoiningLines, joiningCost);
  const ordinaryShortfall = joiningCost - joiningSpend;

  if (remainingOrdinaryLines < ordinaryShortfall) {
    return {
      ok: false,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  remainingJoiningLines -= joiningSpend;
  remainingOrdinaryLines -= ordinaryShortfall;

  for (const reservedIndex of reservedIndices) {
    workingFleet.splice(reservedIndex, 1);
  }

  workingFleet.push({
    shipDefId,
    chargesCurrent:
      typeof shipDef.charges === 'number'
        ? normalizeResource(shipDef.charges)
        : 0,
  });

  return {
    ok: true,
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

export function planHumanBuildSubmit(
  state: any,
  botPlayerId: string,
  plan: AuthoredBotPlan,
): BuildSubmitPayload {
  const player = (state?.players ?? []).find((entry: any) => entry?.id === botPlayerId);
  if (!player) {
    return { builds: [] };
  }

  let remainingOrdinaryLines = normalizeResource(player.lines);
  let remainingJoiningLines = normalizeResource(player.joiningLines);
  const authoritativeFleet = buildWorkingFleet(state?.gameData?.ships?.[botPlayerId] ?? []);
  const workingFleet = buildWorkingFleet(state?.gameData?.ships?.[botPlayerId] ?? []);
  const draftCounts = new Map<string, number>();
  const draftOrder: string[] = [];
  const goalMode: GoalMode = isOpeningSatisfied(plan, authoritativeFleet)
    ? 'loop'
    : 'opening';
  const activeGoals = goalMode === 'loop'
    ? (plan.loopGoals ?? [])
    : plan.buildGoals;

  for (const goal of activeGoals) {
    if (!goal || typeof goal.shipDefId !== 'string') continue;
    if (!Number.isInteger(goal.targetCount) || goal.targetCount < 0) continue;

    while (
      getGoalProgressCount({
        goal,
        goalMode,
        workingFleet,
        draftCounts,
      }) < goal.targetCount
    ) {
      const attempt = tryAddShipToDraft({
        workingFleet,
        shipDefId: goal.shipDefId,
        remainingOrdinaryLines,
        remainingJoiningLines,
      });

      if (!attempt.ok) {
        if (goal.saveUntilAffordable) {
          return buildSubmitFromDraft(draftOrder, draftCounts);
        }
        break;
      }

      remainingOrdinaryLines = attempt.remainingOrdinaryLines;
      remainingJoiningLines = attempt.remainingJoiningLines;
      draftCounts.set(goal.shipDefId, (draftCounts.get(goal.shipDefId) ?? 0) + 1);
      ensureDraftOrder(draftOrder, goal.shipDefId);
    }
  }

  return buildSubmitFromDraft(draftOrder, draftCounts);
}
