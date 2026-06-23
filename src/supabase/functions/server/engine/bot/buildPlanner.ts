import type { BuildSubmitPayload } from '../intent/IntentTypes.ts';
import type { ShipInstance } from '../state/GameStateTypes.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import type {
  AuthoredBotPlan,
  BotBuildGoal,
  OrderedBotBuildPlan,
  OrderedBotBuildStep,
} from './botTypes.ts';
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
type DraftFailureReason =
  | 'missingDefinition'
  | 'disallowedForeignBuild'
  | 'maxQuantity'
  | 'insufficientOrdinaryLines'
  | 'insufficientJoiningLines'
  | 'missingComponents'
  | 'chargedDepletedComponents'
  | 'manualBridgeLimit';

type DraftAttemptResult = {
  ok: boolean;
  failureReason?: DraftFailureReason;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
};

type OrderedBuildStepResult = {
  blockedBySaveUntilAffordable: boolean;
  shouldStopOrderedSequence: boolean;
  didDraftPrimaryStep: boolean;
  didDraftFallbackOrBridge: boolean;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
};

type UpgradeComponentReservation =
  | { ok: true; reservedIndices: number[] }
  | { ok: false; failureReason: 'missingComponents' | 'chargedDepletedComponents' };

type NormalizedOrderedBuildStep = {
  shipDefId: string;
  saveUntilAffordable?: boolean;
  fallbackShipDefIds?: string[];
};

type EvolverTargetChoiceId = 'oxite' | 'asterite';

const ZENITH_SHIP_DEF_ID = 'ZEN';
const ZENITH_FREE_ANTLION_SHIP_DEF_ID = 'ANT';

function isEvolvedXeniteShipDefId(shipDefId: string): boolean {
  return shipDefId === 'OXI' || shipDefId === 'AST';
}

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

function countOrderedProgressShips(
  workingFleet: WorkingShipEntry[],
  shipDefId: string,
): number {
  let count = countWorkingFleetShips(workingFleet, shipDefId);

  for (const entry of workingFleet) {
    const shipDef = getShipById(entry.shipDefId);
    const componentTokens = Array.isArray(shipDef?.componentShips)
      ? shipDef.componentShips
      : [];

    for (const componentToken of componentTokens) {
      const requirement = parseComponentRequirement(componentToken);
      if (requirement.shipDefId === shipDefId) {
        count += 1;
      }
    }
  }

  return count;
}

function reserveUpgradeComponents(
  workingFleet: WorkingShipEntry[],
  shipDefId: string,
): UpgradeComponentReservation {
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
      if (requirement.mustBeDepleted) {
        const hasMatchingChargedComponent = workingFleet.some((entry, index) => {
          if (reservedIndices.has(index)) return false;
          return entry.shipDefId === requirement.shipDefId && entry.chargesCurrent > 0;
        });

        if (hasMatchingChargedComponent) {
          return { ok: false, failureReason: 'chargedDepletedComponents' };
        }
      }

      return { ok: false, failureReason: 'missingComponents' };
    }

    reservedIndices.add(reservedIndex);
  }

  return {
    ok: true,
    reservedIndices: Array.from(reservedIndices).sort((a, b) => b - a),
  };
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
  existingChoiceCount?: number;
}): EvolverBuildChoiceEntry[] {
  const { plan, workingFleet } = args;
  const existingChoiceCount = Math.max(0, Math.floor(args.existingChoiceCount ?? 0));
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
  const conversionCapacity = Math.min(availableEvolverCount, maxConversions);
  const conversionCount = Math.min(
    availableXenCount,
    Math.max(0, conversionCapacity - existingChoiceCount),
  );

  if (!Number.isFinite(conversionCount) || conversionCount <= 0) {
    return [];
  }

  return Array.from({ length: conversionCount }, (_entry, index) => {
    const sourceIndex = existingChoiceCount + index;

    return {
      sourceKey: `bot:evo:${sourceIndex}`,
      choiceId: choiceOrder[sourceIndex % choiceOrder.length] ?? 'oxite',
    };
  });
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
  return isUpgradedShipDefId(goal.shipDefId);
}

function isUpgradedShipDefId(shipDefId: string): boolean {
  const shipDef = getShipById(shipDefId);
  return Array.isArray(shipDef?.componentShips) && shipDef.componentShips.length > 0;
}

function hasUsableEvolverPolicy(plan: AuthoredBotPlan): boolean {
  const choiceOrder = plan?.evolverPolicy?.EVO?.choiceOrder;
  return Array.isArray(choiceOrder) &&
    choiceOrder.some((choiceId) => choiceId === 'oxite' || choiceId === 'asterite');
}

function getUsableEvolverChoiceOrder(plan: AuthoredBotPlan): EvolverTargetChoiceId[] {
  const choiceOrder = plan?.evolverPolicy?.EVO?.choiceOrder;
  return Array.isArray(choiceOrder)
    ? choiceOrder.filter((choiceId): choiceId is EvolverTargetChoiceId =>
      choiceId === 'oxite' || choiceId === 'asterite'
    )
    : [];
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
}): DraftAttemptResult {
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
      failureReason: 'missingDefinition',
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  if (isEvolvedXeniteShipDefId(shipDefId)) {
    return {
      ok: false,
      failureReason: 'disallowedForeignBuild',
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
      failureReason: 'disallowedForeignBuild',
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
        failureReason: 'insufficientOrdinaryLines',
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
  if (!reservedIndices.ok) {
    return {
      ok: false,
      failureReason: reservedIndices.failureReason,
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
      failureReason:
        remainingJoiningLines < joiningCost && remainingOrdinaryLines <= 0
          ? 'insufficientJoiningLines'
          : 'insufficientOrdinaryLines',
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  remainingJoiningLines -= joiningSpend;
  remainingOrdinaryLines -= ordinaryShortfall;

  for (const reservedIndex of reservedIndices.reservedIndices) {
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

function isResourceFailureReason(failureReason: DraftFailureReason | undefined): boolean {
  return failureReason === 'insufficientOrdinaryLines' ||
    failureReason === 'insufficientJoiningLines';
}

function normalizeOrderedBuildStep(
  step: OrderedBotBuildStep,
): NormalizedOrderedBuildStep | null {
  if (typeof step === 'string') {
    return step.trim().length > 0 ? { shipDefId: step.trim() } : null;
  }

  if (!step || typeof step.shipDefId !== 'string' || step.shipDefId.trim().length === 0) {
    return null;
  }

  return {
    shipDefId: step.shipDefId.trim(),
    saveUntilAffordable: step.saveUntilAffordable,
    fallbackShipDefIds: Array.isArray(step.fallbackShipDefIds)
      ? step.fallbackShipDefIds.filter((shipDefId) =>
        typeof shipDefId === 'string' && shipDefId.trim().length > 0
      )
      : undefined,
  };
}

function normalizeOrderedBuildSteps(
  steps: OrderedBotBuildStep[] | undefined,
): NormalizedOrderedBuildStep[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map(normalizeOrderedBuildStep)
    .filter((step): step is NormalizedOrderedBuildStep => step !== null);
}

function isOrderedBuildOrderSatisfied(
  steps: NormalizedOrderedBuildStep[],
  workingFleet: WorkingShipEntry[],
): boolean {
  const requiredCounts = new Map<string, number>();

  for (const step of steps) {
    const requiredCount = (requiredCounts.get(step.shipDefId) ?? 0) + 1;
    requiredCounts.set(step.shipDefId, requiredCount);

    if (countOrderedProgressShips(workingFleet, step.shipDefId) < requiredCount) {
      return false;
    }
  }

  return true;
}

function recordDraftedShip(args: {
  shipDefId: string;
  draftCounts: Map<string, number>;
  draftOrder: string[];
}) {
  args.draftCounts.set(args.shipDefId, (args.draftCounts.get(args.shipDefId) ?? 0) + 1);
  ensureDraftOrder(args.draftOrder, args.shipDefId);
}

function tryDraftShip(args: {
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  shipDefId: string;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): DraftAttemptResult {
  const attempt = tryAddShipToDraft({
    workingFleet: args.workingFleet,
    nativeSpecies: args.nativeSpecies,
    shipDefId: args.shipDefId,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  });

  if (attempt.ok) {
    recordDraftedShip({
      shipDefId: args.shipDefId,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
    });
  }

  return attempt;
}

function findFirstMissingComponentRequirement(args: {
  workingFleet: WorkingShipEntry[];
  shipDefId: string;
}): ComponentRequirement | null {
  const shipDef = getShipById(args.shipDefId);
  const componentTokens = Array.isArray(shipDef?.componentShips)
    ? shipDef.componentShips
    : [];
  const reservedIndices = new Set<number>();

  for (const componentToken of componentTokens) {
    const requirement = parseComponentRequirement(componentToken);
    const reservedIndex = args.workingFleet.findIndex((entry, index) => {
      if (reservedIndices.has(index)) return false;
      if (entry.shipDefId !== requirement.shipDefId) return false;
      if (requirement.mustBeDepleted && entry.chargesCurrent > 0) return false;
      return true;
    });

    if (reservedIndex < 0) {
      return requirement;
    }

    reservedIndices.add(reservedIndex);
  }

  return null;
}

function getManualBridgeLimit(args: {
  orderedPlan: OrderedBotBuildPlan;
  shipDefId: string;
}): number | null {
  const rawLimit = args.orderedPlan.manualBridgeLimits?.[args.shipDefId];
  if (!Number.isInteger(rawLimit) || Number(rawLimit) < 0) {
    return null;
  }

  return Number(rawLimit);
}

function tryDraftSingleBridgeComponent(args: {
  orderedPlan: OrderedBotBuildPlan;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  manualBridgeDraftCounts: Map<string, number>;
  nativeSpecies: unknown;
  shipDefId: string;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): DraftAttemptResult {
  const missingRequirement = findFirstMissingComponentRequirement({
    workingFleet: args.workingFleet,
    shipDefId: args.shipDefId,
  });
  if (!missingRequirement) {
    return {
      ok: false,
      failureReason: 'missingComponents',
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    };
  }

  if (isEvolvedXeniteShipDefId(missingRequirement.shipDefId)) {
    if (countWorkingFleetShips(args.workingFleet, 'EVO') > 0) {
      return {
        ok: false,
        failureReason: 'missingComponents',
        remainingOrdinaryLines: args.remainingOrdinaryLines,
        remainingJoiningLines: args.remainingJoiningLines,
      };
    }

    return tryDraftShip({
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      shipDefId: 'EVO',
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    });
  }

  const componentDef = getShipById(missingRequirement.shipDefId);
  if (!componentDef) {
    return {
      ok: false,
      failureReason: 'missingDefinition',
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    };
  }

  if (isUpgradedShipDefId(missingRequirement.shipDefId)) {
    return {
      ok: false,
      failureReason: 'missingComponents',
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    };
  }

  const manualBridgeLimit = getManualBridgeLimit({
    orderedPlan: args.orderedPlan,
    shipDefId: missingRequirement.shipDefId,
  });
  if (
    manualBridgeLimit !== null &&
    (args.manualBridgeDraftCounts.get(missingRequirement.shipDefId) ?? 0) >= manualBridgeLimit
  ) {
    return {
      ok: false,
      failureReason: 'manualBridgeLimit',
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    };
  }

  const attempt = tryDraftShip({
    workingFleet: args.workingFleet,
    draftCounts: args.draftCounts,
    draftOrder: args.draftOrder,
    nativeSpecies: args.nativeSpecies,
    shipDefId: missingRequirement.shipDefId,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  });

  if (attempt.ok) {
    args.manualBridgeDraftCounts.set(
      missingRequirement.shipDefId,
      (args.manualBridgeDraftCounts.get(missingRequirement.shipDefId) ?? 0) + 1,
    );
  }

  return attempt;
}

function selectOrderedFallbackShipDefIds(args: {
  orderedPlan: OrderedBotBuildPlan;
  step: NormalizedOrderedBuildStep;
  player: any;
  opponent: any;
}): string[] {
  if (Array.isArray(args.step.fallbackShipDefIds) && args.step.fallbackShipDefIds.length > 0) {
    return args.step.fallbackShipDefIds;
  }

  const fallbacks = args.orderedPlan.fallbacks;
  if (!fallbacks) {
    return [];
  }

  const botHealth = Number(args.player?.health);
  const opponentHealth = Number(args.opponent?.health);
  if (Number.isFinite(botHealth) && Number.isFinite(opponentHealth)) {
    if (opponentHealth <= 10 && Array.isArray(fallbacks.aggressive)) {
      return fallbacks.aggressive;
    }

    if (
      (botHealth <= 12 || botHealth <= opponentHealth - 6) &&
      Array.isArray(fallbacks.defensive)
    ) {
      return fallbacks.defensive;
    }
  }

  // Some server fixtures omit player health; default fallback keeps ordered mode deterministic.
  return Array.isArray(fallbacks.default) ? fallbacks.default : [];
}

function getMissingEvolvedComponentCounts(args: {
  targetShipDefId: string;
  workingFleet: WorkingShipEntry[];
}): Map<EvolverTargetChoiceId, number> {
  const missingCounts = new Map<EvolverTargetChoiceId, number>();
  const shipDef = getShipById(args.targetShipDefId);
  const componentTokens = Array.isArray(shipDef?.componentShips)
    ? shipDef.componentShips
    : [];
  const reservedIndices = new Set<number>();

  for (const componentToken of componentTokens) {
    const requirement = parseComponentRequirement(componentToken);
    const reservedIndex = args.workingFleet.findIndex((entry, index) => {
      if (reservedIndices.has(index)) return false;
      if (entry.shipDefId !== requirement.shipDefId) return false;
      if (requirement.mustBeDepleted && entry.chargesCurrent > 0) return false;
      return true;
    });

    if (reservedIndex >= 0) {
      reservedIndices.add(reservedIndex);
      continue;
    }

    if (requirement.shipDefId === 'AST') {
      missingCounts.set('asterite', (missingCounts.get('asterite') ?? 0) + 1);
    } else if (requirement.shipDefId === 'OXI') {
      missingCounts.set('oxite', (missingCounts.get('oxite') ?? 0) + 1);
    }
  }

  return missingCounts;
}

function emitTargetedOrderedEvolverChoices(args: {
  plan: AuthoredBotPlan;
  targetShipDefId: string;
  workingFleet: WorkingShipEntry[];
  evolverChoices: EvolverBuildChoiceEntry[];
}) {
  const choiceOrder = getUsableEvolverChoiceOrder(args.plan);
  if (choiceOrder.length === 0) {
    return;
  }

  const missingCounts = getMissingEvolvedComponentCounts({
    targetShipDefId: args.targetShipDefId,
    workingFleet: args.workingFleet,
  });
  const totalMissingEvolvedComponents =
    (missingCounts.get('asterite') ?? 0) + (missingCounts.get('oxite') ?? 0);
  if (totalMissingEvolvedComponents <= 0) {
    return;
  }

  const evolverPolicy = args.plan.evolverPolicy?.EVO;
  const maxConversions =
    Number.isInteger(evolverPolicy?.maxConversionsPerTurn) &&
    Number(evolverPolicy?.maxConversionsPerTurn) >= 0
      ? Number(evolverPolicy?.maxConversionsPerTurn)
      : Number.POSITIVE_INFINITY;
  const existingChoiceCount = args.evolverChoices.length;
  const conversionCapacity = Math.min(
    countWorkingFleetShips(args.workingFleet, 'EVO'),
    maxConversions,
  );
  const conversionCount = Math.min(
    countWorkingFleetShips(args.workingFleet, 'XEN'),
    Math.max(0, conversionCapacity - existingChoiceCount),
    totalMissingEvolvedComponents,
  );
  if (!Number.isFinite(conversionCount) || conversionCount <= 0) {
    return;
  }

  const pendingChoices: EvolverBuildChoiceEntry[] = [];
  while (pendingChoices.length < conversionCount) {
    let emittedInPass = false;

    for (const choiceId of choiceOrder) {
      if (pendingChoices.length >= conversionCount) break;
      const remainingNeeded = missingCounts.get(choiceId) ?? 0;
      if (remainingNeeded <= 0) continue;

      const sourceIndex = existingChoiceCount + pendingChoices.length;
      pendingChoices.push({
        sourceKey: `bot:evo:${sourceIndex}`,
        choiceId,
      });
      missingCounts.set(choiceId, remainingNeeded - 1);
      emittedInPass = true;
    }

    if (!emittedInPass) {
      break;
    }
  }

  if (pendingChoices.length === 0) {
    return;
  }

  args.evolverChoices.push(...pendingChoices);
  applyEvolverConversionsToWorkingFleet(args.workingFleet, pendingChoices);
}

function emitPassiveOrderedEvolverChoices(args: {
  orderedPlan: OrderedBotBuildPlan;
  workingFleet: WorkingShipEntry[];
  evolverChoices: EvolverBuildChoiceEntry[];
}) {
  const evolverConversions = args.orderedPlan.evolverConversions;
  if (evolverConversions?.mode !== 'when_available') {
    return;
  }

  const choiceOrder = Array.isArray(evolverConversions.choiceOrder)
    ? evolverConversions.choiceOrder.filter((choiceId): choiceId is EvolverTargetChoiceId =>
      choiceId === 'oxite' || choiceId === 'asterite'
    )
    : [];
  if (choiceOrder.length === 0) {
    return;
  }

  const maxConversions =
    Number.isInteger(evolverConversions.maxConversionsPerTurn) &&
    Number(evolverConversions.maxConversionsPerTurn) >= 0
      ? Number(evolverConversions.maxConversionsPerTurn)
      : Number.POSITIVE_INFINITY;
  const existingChoiceCount = args.evolverChoices.length;
  const availableEvolverCount = countWorkingFleetShips(args.workingFleet, 'EVO');
  const remainingCapacity = Math.min(availableEvolverCount, maxConversions) - existingChoiceCount;
  if (remainingCapacity <= 0) {
    return;
  }

  const conversionCount = Math.min(
    countWorkingFleetShips(args.workingFleet, 'XEN'),
    remainingCapacity,
  );
  if (!Number.isFinite(conversionCount) || conversionCount <= 0) {
    return;
  }

  const pendingChoices = Array.from({ length: conversionCount }, (_entry, index) => {
    const sourceIndex = existingChoiceCount + index;

    return {
      sourceKey: `bot:evo:${sourceIndex}`,
      choiceId: choiceOrder[sourceIndex % choiceOrder.length] ?? 'oxite',
    };
  });

  args.evolverChoices.push(...pendingChoices);
  applyEvolverConversionsToWorkingFleet(args.workingFleet, pendingChoices);
}

function tryDraftOrderedFallback(args: {
  plan: AuthoredBotPlan;
  orderedPlan: OrderedBotBuildPlan;
  step: NormalizedOrderedBuildStep;
  player: any;
  opponent: any;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  evolverChoices: EvolverBuildChoiceEntry[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): DraftAttemptResult | null {
  const fallbackShipDefIds = selectOrderedFallbackShipDefIds({
    orderedPlan: args.orderedPlan,
    step: args.step,
    player: args.player,
    opponent: args.opponent,
  });

  for (const fallbackShipDefId of fallbackShipDefIds) {
    if (isUpgradedShipDefId(fallbackShipDefId)) {
      emitTargetedOrderedEvolverChoices({
        plan: args.plan,
        targetShipDefId: fallbackShipDefId,
        workingFleet: args.workingFleet,
        evolverChoices: args.evolverChoices,
      });
    }

    const attempt = tryDraftShip({
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      shipDefId: fallbackShipDefId,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    });

    if (attempt.ok) {
      return attempt;
    }
  }

  return null;
}

function processOrderedBuildStep(args: {
  plan: AuthoredBotPlan;
  orderedPlan: OrderedBotBuildPlan;
  step: NormalizedOrderedBuildStep;
  player: any;
  opponent: any;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  evolverChoices: EvolverBuildChoiceEntry[];
  manualBridgeDraftCounts: Map<string, number>;
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): OrderedBuildStepResult {
  let {
    remainingOrdinaryLines,
    remainingJoiningLines,
  } = args;

  const isUpgradedStep = isUpgradedShipDefId(args.step.shipDefId);
  if (isUpgradedStep) {
    emitTargetedOrderedEvolverChoices({
      plan: args.plan,
      targetShipDefId: args.step.shipDefId,
      workingFleet: args.workingFleet,
      evolverChoices: args.evolverChoices,
    });
  }

  const attempt = tryDraftShip({
    workingFleet: args.workingFleet,
    draftCounts: args.draftCounts,
    draftOrder: args.draftOrder,
    nativeSpecies: args.nativeSpecies,
    shipDefId: args.step.shipDefId,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });

  if (attempt.ok) {
    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: false,
      didDraftPrimaryStep: true,
      didDraftFallbackOrBridge: false,
      remainingOrdinaryLines: attempt.remainingOrdinaryLines,
      remainingJoiningLines: attempt.remainingJoiningLines,
    };
  }

  if (attempt.failureReason === 'maxQuantity') {
    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: false,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: false,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  if (isUpgradedStep && attempt.failureReason === 'missingComponents') {
    const bridgeAttempt = tryDraftSingleBridgeComponent({
      orderedPlan: args.orderedPlan,
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      manualBridgeDraftCounts: args.manualBridgeDraftCounts,
      nativeSpecies: args.nativeSpecies,
      shipDefId: args.step.shipDefId,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });

    if (bridgeAttempt.ok) {
      return {
        blockedBySaveUntilAffordable: false,
        shouldStopOrderedSequence: true,
        didDraftPrimaryStep: false,
        didDraftFallbackOrBridge: true,
        remainingOrdinaryLines: bridgeAttempt.remainingOrdinaryLines,
        remainingJoiningLines: bridgeAttempt.remainingJoiningLines,
      };
    }

    if (args.step.saveUntilAffordable && isResourceFailureReason(bridgeAttempt.failureReason)) {
      return {
        blockedBySaveUntilAffordable: true,
        shouldStopOrderedSequence: true,
        didDraftPrimaryStep: false,
        didDraftFallbackOrBridge: false,
        remainingOrdinaryLines,
        remainingJoiningLines,
      };
    }

    const fallbackAttempt = tryDraftOrderedFallback({
      plan: args.plan,
      orderedPlan: args.orderedPlan,
      step: args.step,
      player: args.player,
      opponent: args.opponent,
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      evolverChoices: args.evolverChoices,
      nativeSpecies: args.nativeSpecies,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });

    if (fallbackAttempt?.ok) {
      remainingOrdinaryLines = fallbackAttempt.remainingOrdinaryLines;
      remainingJoiningLines = fallbackAttempt.remainingJoiningLines;
    }

    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: true,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: fallbackAttempt?.ok === true,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  if (isUpgradedStep && attempt.failureReason === 'chargedDepletedComponents') {
    const fallbackAttempt = tryDraftOrderedFallback({
      plan: args.plan,
      orderedPlan: args.orderedPlan,
      step: args.step,
      player: args.player,
      opponent: args.opponent,
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      evolverChoices: args.evolverChoices,
      nativeSpecies: args.nativeSpecies,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });

    if (fallbackAttempt?.ok) {
      remainingOrdinaryLines = fallbackAttempt.remainingOrdinaryLines;
      remainingJoiningLines = fallbackAttempt.remainingJoiningLines;
    }

    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: true,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: fallbackAttempt?.ok === true,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  if (isResourceFailureReason(attempt.failureReason)) {
    return {
      blockedBySaveUntilAffordable: true,
      shouldStopOrderedSequence: true,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: false,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  return {
    blockedBySaveUntilAffordable: false,
    shouldStopOrderedSequence: true,
    didDraftPrimaryStep: false,
    didDraftFallbackOrBridge: false,
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

function planOrderedBuildSubmit(args: {
  plan: AuthoredBotPlan;
  orderedPlan: OrderedBotBuildPlan;
  player: any;
  opponent: any;
  authoritativeFleet: WorkingShipEntry[];
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): BuildSubmitPayload {
  const buildOrderSteps = normalizeOrderedBuildSteps(args.orderedPlan.buildOrder);
  const endLoopSteps = normalizeOrderedBuildSteps(args.orderedPlan.endLoop);
  const shouldUseEndLoop = isOrderedBuildOrderSatisfied(
    buildOrderSteps,
    args.authoritativeFleet,
  );
  const activeSteps = shouldUseEndLoop ? endLoopSteps : buildOrderSteps;
  const openingRequiredCounts = new Map<string, number>();
  const evolverChoices: EvolverBuildChoiceEntry[] = [];
  const manualBridgeDraftCounts = new Map<string, number>();
  let {
    remainingOrdinaryLines,
    remainingJoiningLines,
  } = args;

  for (const step of activeSteps) {
    if (!shouldUseEndLoop) {
      const requiredCount = (openingRequiredCounts.get(step.shipDefId) ?? 0) + 1;
      openingRequiredCounts.set(step.shipDefId, requiredCount);

      if (countOrderedProgressShips(args.workingFleet, step.shipDefId) >= requiredCount) {
        continue;
      }
    }

    const result = processOrderedBuildStep({
      plan: args.plan,
      orderedPlan: args.orderedPlan,
      step,
      player: args.player,
      opponent: args.opponent,
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      evolverChoices,
      manualBridgeDraftCounts,
      nativeSpecies: args.nativeSpecies,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });

    remainingOrdinaryLines = result.remainingOrdinaryLines;
    remainingJoiningLines = result.remainingJoiningLines;

    if (result.blockedBySaveUntilAffordable || result.shouldStopOrderedSequence) {
      break;
    }
  }

  emitPassiveOrderedEvolverChoices({
    orderedPlan: args.orderedPlan,
    workingFleet: args.workingFleet,
    evolverChoices,
  });

  return buildSubmitFromDraft(args.draftOrder, args.draftCounts, evolverChoices);
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
  const players = state?.players ?? [];
  const player = players.find((entry: any) => entry?.id === botPlayerId);
  if (!player) {
    return { builds: [] };
  }
  const opponent = players.find((entry: any) => entry?.id !== botPlayerId) ?? null;

  let remainingOrdinaryLines = normalizeResource(player.lines);
  let remainingJoiningLines = normalizeResource(player.joiningLines);
  const nativeSpecies = getPlayerNativeSpeciesId(player);
  const authoritativeFleet = buildWorkingFleet(state?.gameData?.ships?.[botPlayerId] ?? []);
  const workingFleet = buildWorkingFleet(state?.gameData?.ships?.[botPlayerId] ?? []);
  const draftCounts = new Map<string, number>();
  const draftOrder: string[] = [];

  if (plan.orderedBuildPlan) {
    return planOrderedBuildSubmit({
      plan,
      orderedPlan: plan.orderedBuildPlan,
      player,
      opponent,
      authoritativeFleet,
      workingFleet,
      draftCounts,
      draftOrder,
      nativeSpecies,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });
  }

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
