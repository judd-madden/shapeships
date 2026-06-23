import type { BuildSubmitPayload } from '../intent/IntentTypes.ts';
import type { ShipInstance } from '../state/GameStateTypes.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import type { AuthoredBotPlan, BotBuildGoal } from './botTypes.ts';
import {
  evaluateForeignBuildLegality,
  getPlayerNativeSpeciesId,
} from '../intent/buildForeignLegality.ts';

type WorkingShipEntry = {
  shipDefId: string;
  chargesCurrent: number;
};

type EvolverBuildChoiceEntry = NonNullable<BuildSubmitPayload['evolverChoices']>[number];

type ComponentRequirement = {
  shipDefId: string;
  mustBeDepleted: boolean;
};

type GoalMode = 'opening' | 'loop';
type DraftFailureReason = 'maxQuantity';

const ZENITH_SHIP_DEF_ID = 'ZEN';
const ZENITH_FREE_ANTLION_SHIP_DEF_ID = 'ANT';

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

function getStartingChargesForShipDefId(shipDefId: string): number {
  const shipDef = getShipById(shipDefId);
  if (typeof shipDef?.charges === 'number' && Number.isFinite(shipDef.charges)) {
    return normalizeResource(shipDef.charges);
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

function getBuildPayloadCount(shipDefId: string, draftCounts: Map<string, number>): number {
  const draftedCount = draftCounts.get(shipDefId) ?? 0;
  if (shipDefId !== ZENITH_FREE_ANTLION_SHIP_DEF_ID) {
    return draftedCount;
  }

  return draftedCount + (draftCounts.get(ZENITH_SHIP_DEF_ID) ?? 0);
}

function getBuildPayloadOrder(draftOrder: string[], draftCounts: Map<string, number>): string[] {
  const payloadOrder = [...draftOrder];
  if (
    (draftCounts.get(ZENITH_SHIP_DEF_ID) ?? 0) > 0 &&
    !payloadOrder.includes(ZENITH_FREE_ANTLION_SHIP_DEF_ID)
  ) {
    payloadOrder.push(ZENITH_FREE_ANTLION_SHIP_DEF_ID);
  }

  return payloadOrder;
}

function buildSubmitFromDraft(
  draftOrder: string[],
  draftCounts: Map<string, number>,
  evolverChoices: EvolverBuildChoiceEntry[] = [],
): BuildSubmitPayload {
  const payload: BuildSubmitPayload = {
    builds: getBuildPayloadOrder(draftOrder, draftCounts)
      .map((shipDefId) => ({
        shipDefId,
        count: getBuildPayloadCount(shipDefId, draftCounts),
      }))
      .filter((build) => build.count > 0),
  };

  if (evolverChoices.length > 0) {
    payload.evolverChoices = evolverChoices;
  }

  return payload;
}

function deriveEvolverChoices(args: {
  plan: AuthoredBotPlan;
  workingFleet: WorkingShipEntry[];
}): EvolverBuildChoiceEntry[] {
  const { plan, workingFleet } = args;
  const evolverPolicy = plan?.evolverPolicy?.EVO;
  if (!evolverPolicy) {
    return [];
  }

  const choiceOrder = Array.isArray(evolverPolicy.choiceOrder)
    ? evolverPolicy.choiceOrder.filter((choiceId) =>
      choiceId === 'oxite' || choiceId === 'asterite'
    )
    : [];
  if (choiceOrder.length === 0) {
    return [];
  }

  const availableEvolverCount = countWorkingFleetShips(workingFleet, 'EVO');
  const availableXenCount = countWorkingFleetShips(workingFleet, 'XEN');
  const maxConversions =
    Number.isInteger(evolverPolicy.maxConversionsPerTurn) &&
    Number(evolverPolicy.maxConversionsPerTurn) >= 0
      ? Number(evolverPolicy.maxConversionsPerTurn)
      : Number.POSITIVE_INFINITY;
  const conversionCount = Math.min(
    availableEvolverCount,
    availableXenCount,
    maxConversions,
  );

  if (!Number.isFinite(conversionCount) || conversionCount <= 0) {
    return [];
  }

  return Array.from({ length: conversionCount }, (_entry, index) => ({
    sourceKey: `bot:evo:${index}`,
    choiceId: choiceOrder[index % choiceOrder.length] ?? 'oxite',
  }));
}

function applyEvolverConversionsToWorkingFleet(
  workingFleet: WorkingShipEntry[],
  evolverChoices: EvolverBuildChoiceEntry[],
) {
  for (const evolverChoice of evolverChoices) {
    if (evolverChoice.choiceId !== 'oxite' && evolverChoice.choiceId !== 'asterite') {
      continue;
    }

    const xeniteIndex = workingFleet.findIndex((entry) => entry.shipDefId === 'XEN');
    if (xeniteIndex < 0) {
      continue;
    }

    workingFleet.splice(xeniteIndex, 1);
    const createdShipDefId = evolverChoice.choiceId === 'oxite' ? 'OXI' : 'AST';
    workingFleet.push({
      shipDefId: createdShipDefId,
      chargesCurrent: getStartingChargesForShipDefId(createdShipDefId),
    });
  }
}

function isUpgradedGoal(goal: BotBuildGoal): boolean {
  const shipDef = getShipById(goal.shipDefId);
  return Array.isArray(shipDef?.componentShips) && shipDef.componentShips.length > 0;
}

function hasUsableEvolverPolicy(plan: AuthoredBotPlan): boolean {
  const choiceOrder = plan?.evolverPolicy?.EVO?.choiceOrder;
  return Array.isArray(choiceOrder) &&
    choiceOrder.some((choiceId) => choiceId === 'oxite' || choiceId === 'asterite');
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
  nativeSpecies: unknown;
  shipDefId: string;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): {
  ok: boolean;
  failureReason?: DraftFailureReason;
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

  const legality = evaluateForeignBuildLegality({
    nativeSpecies: args.nativeSpecies,
    shipDefId,
    shipSpecies: shipDef.species,
    shipType: shipDef.shipType,
  });
  if (!legality.allowed) {
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
      failureReason: 'maxQuantity',
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
    if (shipDefId === ZENITH_SHIP_DEF_ID) {
      workingFleet.push({
        shipDefId: ZENITH_FREE_ANTLION_SHIP_DEF_ID,
        chargesCurrent: getStartingChargesForShipDefId(ZENITH_FREE_ANTLION_SHIP_DEF_ID),
      });
    }

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

function draftGoals(args: {
  goals: BotBuildGoal[];
  goalMode: GoalMode;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): {
  blockedBySaveUntilAffordable: boolean;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
} {
  const {
    goals,
    goalMode,
    workingFleet,
    draftCounts,
    draftOrder,
    nativeSpecies,
  } = args;
  let {
    remainingOrdinaryLines,
    remainingJoiningLines,
  } = args;

  for (const goal of goals) {
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
        nativeSpecies,
        shipDefId: goal.shipDefId,
        remainingOrdinaryLines,
        remainingJoiningLines,
      });

      if (!attempt.ok) {
        if (goal.saveUntilAffordable && attempt.failureReason !== 'maxQuantity') {
          return {
            blockedBySaveUntilAffordable: true,
            remainingOrdinaryLines,
            remainingJoiningLines,
          };
        }

        break;
      }

      remainingOrdinaryLines = attempt.remainingOrdinaryLines;
      remainingJoiningLines = attempt.remainingJoiningLines;
      draftCounts.set(goal.shipDefId, (draftCounts.get(goal.shipDefId) ?? 0) + 1);
      ensureDraftOrder(draftOrder, goal.shipDefId);
    }
  }

  return {
    blockedBySaveUntilAffordable: false,
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

export function planBotBuildSubmit(
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
  const nativeSpecies = getPlayerNativeSpeciesId(player);
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

  if (!hasUsableEvolverPolicy(plan)) {
    draftGoals({
      goals: activeGoals,
      goalMode,
      workingFleet,
      draftCounts,
      draftOrder,
      nativeSpecies,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });

    return buildSubmitFromDraft(draftOrder, draftCounts);
  }

  const nonUpgradedGoals = activeGoals.filter((goal) => !isUpgradedGoal(goal));
  const upgradedGoals = activeGoals.filter(isUpgradedGoal);
  const nonUpgradedDraft = draftGoals({
    goals: nonUpgradedGoals,
    goalMode,
    workingFleet,
    draftOrder,
    draftCounts,
    nativeSpecies,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });
  remainingOrdinaryLines = nonUpgradedDraft.remainingOrdinaryLines;
  remainingJoiningLines = nonUpgradedDraft.remainingJoiningLines;

  const evolverChoices = deriveEvolverChoices({
    plan,
    workingFleet,
  });
  if (!nonUpgradedDraft.blockedBySaveUntilAffordable) {
    applyEvolverConversionsToWorkingFleet(workingFleet, evolverChoices);
  }

  if (nonUpgradedDraft.blockedBySaveUntilAffordable) {
    return buildSubmitFromDraft(draftOrder, draftCounts, evolverChoices);
  }

  draftGoals({
    goals: upgradedGoals,
    goalMode,
    workingFleet,
    draftOrder,
    draftCounts,
    nativeSpecies,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });

  return buildSubmitFromDraft(
    draftOrder,
    draftCounts,
    evolverChoices,
  );
}

export function planHumanBuildSubmit(
  state: any,
  botPlayerId: string,
  plan: AuthoredBotPlan,
): BuildSubmitPayload {
  return planBotBuildSubmit(state, botPlayerId, plan);
}
