import type { BuildSubmitPayload } from '../intent/IntentTypes.ts';
import type { ShipInstance } from '../state/GameStateTypes.ts';
import {
  getShipById,
  SHIP_DEFINITIONS_CORE_SERVER,
} from '../../engine_shared/defs/ShipDefinitions.core.ts';
import type {
  AncientSimulacrumBotProgress,
  AuthoredBotPlan,
  BotAdaptiveBuildRule,
  BotBuildGoal,
  BotPlanProgress,
  CommittedBotBuildGroupProgress,
  OrderedBotBuildPlan,
  OrderedBotBuildStep,
  OrderedBotCommittedHealthGroup,
  OrderedBotEndLoopStep,
  OrderedBotProgressGate,
} from './botTypes.ts';
import {
  evaluateForeignBuildLegality,
  getPlayerNativeSpeciesId,
} from '../intent/buildForeignLegality.ts';
import { getAncientBotStrategyById } from './ancientPlans.ts';

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

type NormalizedCommittedHealthGroupStep = {
  committedHealthGroup: OrderedBotCommittedHealthGroup;
};

type NormalizedProgressGateStep = OrderedBotProgressGate;

type NormalizedOrderedSequenceStep =
  | NormalizedOrderedBuildStep
  | NormalizedCommittedHealthGroupStep
  | NormalizedProgressGateStep;

type NormalizedFirstAffordableEndLoopStep = {
  firstAffordableShipDefIds: string[];
  targetCountByShipDefId?: Record<string, number>;
  fallbackShipDefIdWhenCandidatesComplete?: string;
};

type NormalizedOrderedEndLoopStep =
  | NormalizedOrderedSequenceStep
  | NormalizedFirstAffordableEndLoopStep;

export type BotPlanProgressUpdate =
  | { kind: 'set'; progress: BotPlanProgress }
  | { kind: 'clear' };

export type BotBuildDecision =
  | {
      ok: true;
      payload: BuildSubmitPayload;
      proposedPlanProgressUpdate?: BotPlanProgressUpdate;
    }
  | {
      ok: false;
      reason: 'invalid_committed_build_group_progress';
    };

type BuildPlanProgressContext = {
  current: CommittedBotBuildGroupProgress | null;
  simulacrum: AncientSimulacrumBotProgress | null;
  fullProgress: BotPlanProgress;
  proposedUpdate?: BotPlanProgressUpdate;
  invalid: boolean;
};

type EvolverTargetChoiceId = 'oxite' | 'asterite';

const ZENITH_SHIP_DEF_ID = 'ZEN';
const ZENITH_FREE_ANTLION_SHIP_DEF_ID = 'ANT';
const MAX_ORDERED_END_LOOP_PASSES_PER_SUBMIT = 256;
const MAX_ORDERED_FALLBACK_DRAFTS_PER_BLOCKED_STEP = 64;

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

function canReserveUpgradeComponents(
  workingFleet: WorkingShipEntry[],
  shipDefId: string,
): boolean {
  return reserveUpgradeComponents(workingFleet, shipDefId).ok;
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
): NormalizedOrderedSequenceStep | null {
  if (typeof step === 'string') {
    return step.trim().length > 0 ? { shipDefId: step.trim() } : null;
  }

  if (!step || typeof step !== 'object') {
    return null;
  }

  if ('progressGate' in step) {
    return step.progressGate === 'simulacrum_opening_complete'
      ? { progressGate: step.progressGate }
      : null;
  }

  if ('committedHealthGroup' in step) {
    const candidate = step.committedHealthGroup;
    if (
      !candidate ||
      typeof candidate.groupKey !== 'string' ||
      candidate.groupKey.trim().length === 0 ||
      !Number.isFinite(candidate.selfHealthBelow) ||
      !candidate.below ||
      !candidate.atOrAbove ||
      candidate.below.branchId === candidate.atOrAbove.branchId ||
      ![candidate.below, candidate.atOrAbove].every((branch) =>
        typeof branch.branchId === 'string' &&
        branch.branchId.trim().length > 0 &&
        typeof branch.shipDefId === 'string' &&
        branch.shipDefId.trim().length > 0 &&
        Number.isSafeInteger(branch.count) &&
        branch.count > 0
      ) ||
      (
        typeof candidate.completionWitnessShipDefId !== 'undefined' &&
        (
          typeof candidate.completionWitnessShipDefId !== 'string' ||
          candidate.completionWitnessShipDefId.trim().length === 0
        )
      )
    ) {
      return null;
    }

    return {
      committedHealthGroup: {
        ...candidate,
        groupKey: candidate.groupKey.trim(),
        below: {
          ...candidate.below,
          branchId: candidate.below.branchId.trim(),
          shipDefId: candidate.below.shipDefId.trim(),
        },
        atOrAbove: {
          ...candidate.atOrAbove,
          branchId: candidate.atOrAbove.branchId.trim(),
          shipDefId: candidate.atOrAbove.shipDefId.trim(),
        },
        ...(candidate.completionWitnessShipDefId
          ? {
            completionWitnessShipDefId:
              candidate.completionWitnessShipDefId.trim(),
          }
          : {}),
      },
    };
  }

  if (
    !('shipDefId' in step) ||
    typeof step.shipDefId !== 'string' ||
    step.shipDefId.trim().length === 0
  ) {
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
): NormalizedOrderedSequenceStep[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map(normalizeOrderedBuildStep)
    .filter((step): step is NormalizedOrderedSequenceStep => step !== null);
}

function normalizeOrderedEndLoopStep(
  step: OrderedBotEndLoopStep,
): NormalizedOrderedEndLoopStep | null {
  if (
    typeof step === 'object' &&
    step !== null &&
    'firstAffordableShipDefIds' in step
  ) {
    const firstAffordableShipDefIds = Array.isArray(step.firstAffordableShipDefIds)
      ? step.firstAffordableShipDefIds
        .filter((shipDefId) =>
          typeof shipDefId === 'string' && shipDefId.trim().length > 0
        )
        .map((shipDefId) => shipDefId.trim())
      : [];

    if (firstAffordableShipDefIds.length === 0) {
      return null;
    }

    const targetCountByShipDefId = Object.fromEntries(
      Object.entries(step.targetCountByShipDefId ?? {})
        .filter(([shipDefId, targetCount]) =>
          firstAffordableShipDefIds.includes(shipDefId) &&
          Number.isSafeInteger(targetCount) &&
          targetCount > 0
        ),
    );
    const fallbackShipDefIdWhenCandidatesComplete =
      typeof step.fallbackShipDefIdWhenCandidatesComplete === 'string' &&
        step.fallbackShipDefIdWhenCandidatesComplete.trim().length > 0
        ? step.fallbackShipDefIdWhenCandidatesComplete.trim()
        : undefined;

    return {
      firstAffordableShipDefIds,
      ...(Object.keys(targetCountByShipDefId).length > 0
        ? { targetCountByShipDefId }
        : {}),
      ...(fallbackShipDefIdWhenCandidatesComplete
        ? { fallbackShipDefIdWhenCandidatesComplete }
        : {}),
    };
  }

  return normalizeOrderedBuildStep(step);
}

function normalizeOrderedEndLoopSteps(
  steps: OrderedBotEndLoopStep[] | undefined,
): NormalizedOrderedEndLoopStep[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map(normalizeOrderedEndLoopStep)
    .filter((step): step is NormalizedOrderedEndLoopStep => step !== null);
}

function isNormalizedOrderedBuildStep(
  step: NormalizedOrderedSequenceStep | NormalizedOrderedEndLoopStep,
): step is NormalizedOrderedBuildStep {
  return 'shipDefId' in step;
}

function isNormalizedCommittedHealthGroupStep(
  step: NormalizedOrderedSequenceStep | NormalizedOrderedEndLoopStep,
): step is NormalizedCommittedHealthGroupStep {
  return 'committedHealthGroup' in step;
}

function isNormalizedProgressGateStep(
  step: NormalizedOrderedSequenceStep | NormalizedOrderedEndLoopStep,
): step is NormalizedProgressGateStep {
  return 'progressGate' in step;
}

function isNormalizedFirstAffordableEndLoopStep(
  step: NormalizedOrderedEndLoopStep,
): step is NormalizedFirstAffordableEndLoopStep {
  return 'firstAffordableShipDefIds' in step;
}

function getCommittedGroupSteps(
  plan: AuthoredBotPlan,
): NormalizedCommittedHealthGroupStep[] {
  return [
    ...normalizeOrderedBuildSteps(plan.orderedBuildPlan?.buildOrder),
    ...normalizeOrderedEndLoopSteps(plan.orderedBuildPlan?.endLoop),
  ].filter(isNormalizedCommittedHealthGroupStep);
}

function getCommittedGroupBranch(
  group: OrderedBotCommittedHealthGroup,
  branchId: string,
) {
  if (group.below.branchId === branchId) return group.below;
  if (group.atOrAbove.branchId === branchId) return group.atOrAbove;
  return null;
}

function isCommittedProgressValid(args: {
  plan: AuthoredBotPlan;
  progress: CommittedBotBuildGroupProgress;
}): boolean {
  const { progress } = args;
  if (
    progress.planId !== args.plan.id ||
    typeof progress.groupKey !== 'string' ||
    typeof progress.branchId !== 'string' ||
    typeof progress.shipDefId !== 'string' ||
    !Number.isSafeInteger(progress.startingCount) ||
    progress.startingCount < 0 ||
    !Number.isSafeInteger(progress.targetCount) ||
    progress.targetCount <= progress.startingCount
  ) {
    return false;
  }

  const step = getCommittedGroupSteps(args.plan).find((candidate) =>
    candidate.committedHealthGroup.groupKey === progress.groupKey
  );
  if (!step) return false;

  const branch = getCommittedGroupBranch(
    step.committedHealthGroup,
    progress.branchId,
  );
  if (
    !branch ||
    branch.shipDefId !== progress.shipDefId ||
    progress.targetCount !== progress.startingCount + branch.count
  ) {
    return false;
  }

  return true;
}

function isSimulacrumProgressValid(args: {
  plan: AuthoredBotPlan;
  progress: AncientSimulacrumBotProgress;
}): boolean {
  if (
    args.progress?.strategyId !== args.plan.id ||
    !Number.isSafeInteger(args.progress.completedGoalCount) ||
    args.progress.completedGoalCount < 0 ||
    typeof args.progress.openingComplete !== 'boolean'
  ) {
    return false;
  }
  const strategy = getAncientBotStrategyById(args.plan.id);
  const policy = strategy?.solarPolicy?.simulacrum;
  return policy?.mode === 'staged_cost_goals' &&
    args.progress.completedGoalCount <= policy.costGoals.length &&
    args.progress.openingComplete ===
      (args.progress.completedGoalCount === policy.costGoals.length);
}

function committedGroupHasCompletionWitness(
  group: OrderedBotCommittedHealthGroup,
  authoritativeFleet: WorkingShipEntry[],
): boolean {
  return typeof group.completionWitnessShipDefId === 'string' &&
    countOrderedProgressShips(
      authoritativeFleet,
      group.completionWitnessShipDefId,
    ) > 0;
}

function isOrderedBuildOrderSatisfied(
  steps: NormalizedOrderedSequenceStep[],
  authoritativeFleet: WorkingShipEntry[],
  committedProgress: CommittedBotBuildGroupProgress | null,
  simulacrumProgress: AncientSimulacrumBotProgress | null,
): boolean {
  const requiredCounts = new Map<string, number>();

  for (const step of steps) {
    if (isNormalizedProgressGateStep(step)) {
      if (!simulacrumProgress?.openingComplete) return false;
      continue;
    }
    if (isNormalizedCommittedHealthGroupStep(step)) {
      const group = step.committedHealthGroup;
      if (committedGroupHasCompletionWitness(group, authoritativeFleet)) {
        continue;
      }
      if (
        !committedProgress ||
        committedProgress.groupKey !== group.groupKey ||
        countWorkingFleetShips(
          authoritativeFleet,
          committedProgress.shipDefId,
        ) < committedProgress.targetCount
      ) {
        return false;
      }
      continue;
    }

    const requiredCount = (requiredCounts.get(step.shipDefId) ?? 0) + 1;
    requiredCounts.set(step.shipDefId, requiredCount);

    if (countOrderedProgressShips(authoritativeFleet, step.shipDefId) < requiredCount) {
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

function normalizeSpeciesValue(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function tryDraftOpportunisticForeignUpgrade(args: {
  plan: AuthoredBotPlan;
  opponent: any;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): DraftAttemptResult | null {
  if (
    args.plan.opportunisticForeignUpgrades?.mode !==
      'highest_total_line_cost'
  ) {
    return null;
  }
  const opponentSpecies = normalizeSpeciesValue(
    args.opponent?.faction ?? args.opponent?.species,
  );
  const nativeSpecies = normalizeSpeciesValue(args.nativeSpecies);
  if (!opponentSpecies || opponentSpecies === nativeSpecies) return null;

  const candidates = SHIP_DEFINITIONS_CORE_SERVER
    .filter((definition) =>
      normalizeSpeciesValue(definition.species) === opponentSpecies &&
      Array.isArray(definition.componentShips) &&
      definition.componentShips.length > 0 &&
      typeof definition.joiningLineCost === 'number' &&
      typeof definition.totalLineCost === 'number' &&
      Number.isFinite(definition.totalLineCost)
    )
    .sort((left, right) =>
      (right.totalLineCost as number) - (left.totalLineCost as number) ||
      left.id.localeCompare(right.id)
    );

  for (const candidate of candidates) {
    const attempt = tryDraftShip({
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      shipDefId: candidate.id,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    });
    if (attempt.ok) return attempt;
  }
  return null;
}

function passesAdaptiveBuildRuleHealthThresholds(args: {
  rule: BotAdaptiveBuildRule;
  player: any;
  opponent: any;
}): boolean {
  const selfThreshold =
    typeof args.rule.selfHealthAtOrBelow === 'number' &&
    Number.isFinite(args.rule.selfHealthAtOrBelow)
      ? args.rule.selfHealthAtOrBelow
      : null;
  const opponentThreshold =
    typeof args.rule.opponentHealthAtOrBelow === 'number' &&
    Number.isFinite(args.rule.opponentHealthAtOrBelow)
      ? args.rule.opponentHealthAtOrBelow
      : null;

  if (selfThreshold === null && opponentThreshold === null) {
    return false;
  }

  if (selfThreshold !== null) {
    const selfHealth = Number(args.player?.health);
    if (!Number.isFinite(selfHealth) || selfHealth > selfThreshold) {
      return false;
    }
  }

  if (opponentThreshold !== null) {
    const opponentHealth = Number(args.opponent?.health);
    if (!Number.isFinite(opponentHealth) || opponentHealth > opponentThreshold) {
      return false;
    }
  }

  return true;
}

function draftAdaptiveBuildRules(args: {
  plan: AuthoredBotPlan;
  placement: 'before_plan' | 'after_ordered_opening';
  player: any;
  opponent: any;
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
  let {
    remainingOrdinaryLines,
    remainingJoiningLines,
  } = args;

  if (!Array.isArray(args.plan.adaptiveBuildRules)) {
    return {
      blockedBySaveUntilAffordable: false,
      remainingOrdinaryLines,
      remainingJoiningLines,
    };
  }

  for (const rule of args.plan.adaptiveBuildRules) {
    if (!rule || typeof rule.shipDefId !== 'string') continue;

    const placement = rule.placement ?? 'before_plan';
    if (placement !== args.placement) continue;

    const shipDefId = rule.shipDefId.trim();
    if (shipDefId.length === 0) continue;
    if (!Number.isInteger(rule.targetCount) || rule.targetCount < 0) continue;
    if (
      !passesAdaptiveBuildRuleHealthThresholds({
        rule,
        player: args.player,
        opponent: args.opponent,
      })
    ) {
      continue;
    }

    while (countWorkingFleetShips(args.workingFleet, shipDefId) < rule.targetCount) {
      const attempt = tryDraftShip({
        workingFleet: args.workingFleet,
        draftCounts: args.draftCounts,
        draftOrder: args.draftOrder,
        nativeSpecies: args.nativeSpecies,
        shipDefId,
        remainingOrdinaryLines,
        remainingJoiningLines,
      });

      if (!attempt.ok) {
        if (rule.saveUntilAffordable && isResourceFailureReason(attempt.failureReason)) {
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
    }
  }

  return {
    blockedBySaveUntilAffordable: false,
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
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
    const attempt = tryDraftOrderedFallbackShipDefId({
      plan: args.plan,
      shipDefId: fallbackShipDefId,
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      evolverChoices: args.evolverChoices,
      nativeSpecies: args.nativeSpecies,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    });

    if (attempt.ok) {
      return attempt;
    }
  }

  return null;
}

function tryDraftOrderedFallbackShipDefId(args: {
  plan: AuthoredBotPlan;
  shipDefId: string;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  evolverChoices: EvolverBuildChoiceEntry[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): DraftAttemptResult {
  if (isUpgradedShipDefId(args.shipDefId)) {
    emitTargetedOrderedEvolverChoices({
      plan: args.plan,
      targetShipDefId: args.shipDefId,
      workingFleet: args.workingFleet,
      evolverChoices: args.evolverChoices,
    });
  }

  return tryDraftShip({
    workingFleet: args.workingFleet,
    draftCounts: args.draftCounts,
    draftOrder: args.draftOrder,
    nativeSpecies: args.nativeSpecies,
    shipDefId: args.shipDefId,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  });
}

function canDraftOrderedFallbackShipDefId(args: {
  plan: AuthoredBotPlan;
  shipDefId: string;
  workingFleet: WorkingShipEntry[];
  evolverChoices: EvolverBuildChoiceEntry[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): boolean {
  const scratchWorkingFleet = args.workingFleet.map((entry) => ({ ...entry }));
  const scratchEvolverChoices = [...args.evolverChoices];

  if (isUpgradedShipDefId(args.shipDefId)) {
    emitTargetedOrderedEvolverChoices({
      plan: args.plan,
      targetShipDefId: args.shipDefId,
      workingFleet: scratchWorkingFleet,
      evolverChoices: scratchEvolverChoices,
    });
  }

  return tryAddShipToDraft({
    workingFleet: scratchWorkingFleet,
    nativeSpecies: args.nativeSpecies,
    shipDefId: args.shipDefId,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  }).ok;
}

function tryDraftLargestAffordableOrderedFallback(args: {
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
  let selectedShipDefId: string | null = null;
  let selectedLineCost = -1;

  for (const fallbackShipDefId of fallbackShipDefIds) {
    if (!canDraftOrderedFallbackShipDefId({
      plan: args.plan,
      shipDefId: fallbackShipDefId,
      workingFleet: args.workingFleet,
      evolverChoices: args.evolverChoices,
      nativeSpecies: args.nativeSpecies,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    })) {
      continue;
    }

    const lineCost = normalizeResource(getShipById(fallbackShipDefId)?.totalLineCost);
    if (lineCost > selectedLineCost) {
      selectedShipDefId = fallbackShipDefId;
      selectedLineCost = lineCost;
    }
  }

  if (!selectedShipDefId) {
    return null;
  }

  const attempt = tryDraftOrderedFallbackShipDefId({
    plan: args.plan,
    shipDefId: selectedShipDefId,
    workingFleet: args.workingFleet,
    draftCounts: args.draftCounts,
    draftOrder: args.draftOrder,
    evolverChoices: args.evolverChoices,
    nativeSpecies: args.nativeSpecies,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  });

  return attempt.ok ? attempt : null;
}

function tryDraftOrderedFallbacksUntilBlocked(args: {
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
}): {
  didDraftFallback: boolean;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
} {
  let {
    remainingOrdinaryLines,
    remainingJoiningLines,
  } = args;
  let didDraftFallback = false;

  for (
    let draftIndex = 0;
    draftIndex < MAX_ORDERED_FALLBACK_DRAFTS_PER_BLOCKED_STEP;
    draftIndex += 1
  ) {
    if (canReserveUpgradeComponents(args.workingFleet, args.step.shipDefId)) {
      break;
    }

    const fallbackAttempt = tryDraftLargestAffordableOrderedFallback({
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

    if (!fallbackAttempt?.ok) {
      break;
    }

    didDraftFallback = true;
    remainingOrdinaryLines = fallbackAttempt.remainingOrdinaryLines;
    remainingJoiningLines = fallbackAttempt.remainingJoiningLines;
  }

  return {
    didDraftFallback,
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

function tryDraftComponentReadyOrderedPrimary(args: {
  step: NormalizedOrderedBuildStep;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  didDraftFallbackOrBridge: boolean;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): OrderedBuildStepResult | null {
  if (!canReserveUpgradeComponents(args.workingFleet, args.step.shipDefId)) {
    return null;
  }

  const attempt = tryDraftShip({
    workingFleet: args.workingFleet,
    draftCounts: args.draftCounts,
    draftOrder: args.draftOrder,
    nativeSpecies: args.nativeSpecies,
    shipDefId: args.step.shipDefId,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  });

  if (attempt.ok) {
    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: false,
      didDraftPrimaryStep: true,
      didDraftFallbackOrBridge: args.didDraftFallbackOrBridge,
      remainingOrdinaryLines: attempt.remainingOrdinaryLines,
      remainingJoiningLines: attempt.remainingJoiningLines,
    };
  }

  if (isResourceFailureReason(attempt.failureReason)) {
    return {
      blockedBySaveUntilAffordable: true,
      shouldStopOrderedSequence: true,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: args.didDraftFallbackOrBridge,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    };
  }

  return {
    blockedBySaveUntilAffordable: false,
    shouldStopOrderedSequence: true,
    didDraftPrimaryStep: false,
    didDraftFallbackOrBridge: args.didDraftFallbackOrBridge,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  };
}

function tryDraftLaterComponentReadyEndLoopUpgrade(args: {
  endLoopSteps: NormalizedOrderedEndLoopStep[];
  currentStepIndex: number;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): OrderedBuildStepResult | null {
  for (const candidate of args.endLoopSteps.slice(args.currentStepIndex + 1)) {
    if (!isNormalizedOrderedBuildStep(candidate)) {
      continue;
    }

    if (!isUpgradedShipDefId(candidate.shipDefId)) {
      continue;
    }

    if (!canReserveUpgradeComponents(args.workingFleet, candidate.shipDefId)) {
      continue;
    }

    const attempt = tryDraftShip({
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      shipDefId: candidate.shipDefId,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
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

    if (candidate.saveUntilAffordable && isResourceFailureReason(attempt.failureReason)) {
      return {
        blockedBySaveUntilAffordable: true,
        shouldStopOrderedSequence: true,
        didDraftPrimaryStep: false,
        didDraftFallbackOrBridge: false,
        remainingOrdinaryLines: args.remainingOrdinaryLines,
        remainingJoiningLines: args.remainingJoiningLines,
      };
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
      remainingOrdinaryLines = bridgeAttempt.remainingOrdinaryLines;
      remainingJoiningLines = bridgeAttempt.remainingJoiningLines;

      const primaryRetry = tryDraftComponentReadyOrderedPrimary({
        step: args.step,
        workingFleet: args.workingFleet,
        draftCounts: args.draftCounts,
        draftOrder: args.draftOrder,
        nativeSpecies: args.nativeSpecies,
        didDraftFallbackOrBridge: true,
        remainingOrdinaryLines,
        remainingJoiningLines,
      });
      if (primaryRetry) {
        return primaryRetry;
      }

      const fallbackDraft = tryDraftOrderedFallbacksUntilBlocked({
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

      return {
        blockedBySaveUntilAffordable: false,
        shouldStopOrderedSequence: true,
        didDraftPrimaryStep: false,
        didDraftFallbackOrBridge: true,
        remainingOrdinaryLines: fallbackDraft.remainingOrdinaryLines,
        remainingJoiningLines: fallbackDraft.remainingJoiningLines,
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

    const fallbackDraft = tryDraftOrderedFallbacksUntilBlocked({
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

    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: true,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: fallbackDraft.didDraftFallback,
      remainingOrdinaryLines: fallbackDraft.remainingOrdinaryLines,
      remainingJoiningLines: fallbackDraft.remainingJoiningLines,
    };
  }

  if (isUpgradedStep && attempt.failureReason === 'chargedDepletedComponents') {
    const fallbackDraft = tryDraftOrderedFallbacksUntilBlocked({
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

    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: true,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: fallbackDraft.didDraftFallback,
      remainingOrdinaryLines: fallbackDraft.remainingOrdinaryLines,
      remainingJoiningLines: fallbackDraft.remainingJoiningLines,
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

function proposeCommittedProgress(
  context: BuildPlanProgressContext,
  progress: CommittedBotBuildGroupProgress,
) {
  context.current = progress;
  context.fullProgress = {
    ...context.fullProgress,
    committedBuildGroup: progress,
  };
  context.proposedUpdate = {
    kind: 'set',
    progress: context.fullProgress,
  };
}

function processCommittedHealthGroupStep(args: {
  plan: AuthoredBotPlan;
  step: NormalizedCommittedHealthGroupStep;
  player: any;
  authoritativeFleet: WorkingShipEntry[];
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  progressContext: BuildPlanProgressContext;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): OrderedBuildStepResult {
  const group = args.step.committedHealthGroup;
  const current = args.progressContext.current;

  if (committedGroupHasCompletionWitness(group, args.authoritativeFleet)) {
    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: false,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: false,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    };
  }

  let activeProgress = current?.groupKey === group.groupKey ? current : null;
  const activeAuthoritativeCount = activeProgress
    ? countWorkingFleetShips(args.authoritativeFleet, activeProgress.shipDefId)
    : 0;

  if (
    activeProgress &&
    activeAuthoritativeCount >= activeProgress.targetCount &&
    group.repeat !== true
  ) {
    return {
      blockedBySaveUntilAffordable: false,
      shouldStopOrderedSequence: false,
      didDraftPrimaryStep: false,
      didDraftFallbackOrBridge: false,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
    };
  }

  if (
    !activeProgress ||
    (
      group.repeat === true &&
      activeAuthoritativeCount >= activeProgress.targetCount
    )
  ) {
    const selfHealth = Number(args.player?.health);
    if (!Number.isFinite(selfHealth)) {
      args.progressContext.invalid = true;
      return {
        blockedBySaveUntilAffordable: false,
        shouldStopOrderedSequence: true,
        didDraftPrimaryStep: false,
        didDraftFallbackOrBridge: false,
        remainingOrdinaryLines: args.remainingOrdinaryLines,
        remainingJoiningLines: args.remainingJoiningLines,
      };
    }
    const branch = selfHealth < group.selfHealthBelow
      ? group.below
      : group.atOrAbove;
    const startingCount = countWorkingFleetShips(
      args.authoritativeFleet,
      branch.shipDefId,
    );
    activeProgress = {
      planId: args.plan.id,
      groupKey: group.groupKey,
      branchId: branch.branchId,
      shipDefId: branch.shipDefId,
      startingCount,
      targetCount: startingCount + branch.count,
    };
    proposeCommittedProgress(args.progressContext, activeProgress);
  }

  let remainingOrdinaryLines = args.remainingOrdinaryLines;
  let remainingJoiningLines = args.remainingJoiningLines;
  let drafted = false;
  while (
    countWorkingFleetShips(args.workingFleet, activeProgress.shipDefId) <
      activeProgress.targetCount
  ) {
    const attempt = tryDraftShip({
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      shipDefId: activeProgress.shipDefId,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });
    if (!attempt.ok) break;

    drafted = true;
    remainingOrdinaryLines = attempt.remainingOrdinaryLines;
    remainingJoiningLines = attempt.remainingJoiningLines;
  }

  return {
    blockedBySaveUntilAffordable: false,
    shouldStopOrderedSequence: true,
    didDraftPrimaryStep: drafted,
    didDraftFallbackOrBridge: false,
    remainingOrdinaryLines,
    remainingJoiningLines,
  };
}

function isFirstAffordableCandidateComplete(args: {
  step: NormalizedFirstAffordableEndLoopStep;
  workingFleet: WorkingShipEntry[];
  shipDefId: string;
}): boolean {
  const count = countWorkingFleetShips(args.workingFleet, args.shipDefId);
  const authoredTarget = args.step.targetCountByShipDefId?.[args.shipDefId];
  if (typeof authoredTarget === 'number' && count >= authoredTarget) {
    return true;
  }

  const canonicalMaximum = getShipById(args.shipDefId)?.maxQuantity;
  return typeof canonicalMaximum === 'number' && count >= canonicalMaximum;
}

function processFirstAffordableEndLoopStep(args: {
  step: NormalizedFirstAffordableEndLoopStep;
  workingFleet: WorkingShipEntry[];
  draftCounts: Map<string, number>;
  draftOrder: string[];
  nativeSpecies: unknown;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): OrderedBuildStepResult {
  const eligibleShipDefIds = args.step.firstAffordableShipDefIds.filter((shipDefId) =>
    !isFirstAffordableCandidateComplete({
      step: args.step,
      workingFleet: args.workingFleet,
      shipDefId,
    })
  );

  for (const shipDefId of eligibleShipDefIds) {
    const attempt = tryDraftShip({
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      shipDefId,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
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
  }

  if (
    eligibleShipDefIds.length === 0 &&
    args.step.fallbackShipDefIdWhenCandidatesComplete
  ) {
    const attempt = tryDraftShip({
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      shipDefId: args.step.fallbackShipDefIdWhenCandidatesComplete,
      remainingOrdinaryLines: args.remainingOrdinaryLines,
      remainingJoiningLines: args.remainingJoiningLines,
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
  }

  return {
    blockedBySaveUntilAffordable: false,
    shouldStopOrderedSequence: true,
    didDraftPrimaryStep: false,
    didDraftFallbackOrBridge: false,
    remainingOrdinaryLines: args.remainingOrdinaryLines,
    remainingJoiningLines: args.remainingJoiningLines,
  };
}

function getFleetProgressEndLoopStartIndex(args: {
  buildOrderSteps: NormalizedOrderedSequenceStep[];
  endLoopSteps: NormalizedOrderedEndLoopStep[];
  authoritativeFleet: WorkingShipEntry[];
}): number {
  if (
    args.endLoopSteps.length === 0 ||
    args.endLoopSteps.some((step) => !isNormalizedOrderedBuildStep(step))
  ) {
    return 0;
  }

  const openingCounts = new Map<string, number>();
  for (const step of args.buildOrderSteps) {
    if (!isNormalizedOrderedBuildStep(step)) continue;
    openingCounts.set(
      step.shipDefId,
      (openingCounts.get(step.shipDefId) ?? 0) + 1,
    );
  }

  const occurrencesPerCycle = new Map<string, number>();
  for (const step of args.endLoopSteps) {
    if (!isNormalizedOrderedBuildStep(step)) continue;
    occurrencesPerCycle.set(
      step.shipDefId,
      (occurrencesPerCycle.get(step.shipDefId) ?? 0) + 1,
    );
  }

  const loopCounts = new Map<string, number>();
  for (const [shipDefId] of occurrencesPerCycle) {
    loopCounts.set(
      shipDefId,
      Math.max(
        0,
        countOrderedProgressShips(args.authoritativeFleet, shipDefId) -
          (openingCounts.get(shipDefId) ?? 0),
      ),
    );
  }

  const completedCycles = Math.min(
    ...[...occurrencesPerCycle.entries()].map(([shipDefId, occurrences]) =>
      Math.floor((loopCounts.get(shipDefId) ?? 0) / occurrences)
    ),
  );
  const residualCounts = new Map<string, number>();
  for (const [shipDefId, occurrences] of occurrencesPerCycle) {
    residualCounts.set(
      shipDefId,
      (loopCounts.get(shipDefId) ?? 0) - completedCycles * occurrences,
    );
  }

  const requiredResidualCounts = new Map<string, number>();
  for (let index = 0; index < args.endLoopSteps.length; index += 1) {
    const step = args.endLoopSteps[index];
    if (!isNormalizedOrderedBuildStep(step)) return 0;
    const required = (requiredResidualCounts.get(step.shipDefId) ?? 0) + 1;
    requiredResidualCounts.set(step.shipDefId, required);
    if ((residualCounts.get(step.shipDefId) ?? 0) < required) {
      return index;
    }
  }

  return 0;
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
  progressContext: BuildPlanProgressContext;
  remainingOrdinaryLines: number;
  remainingJoiningLines: number;
}): BuildSubmitPayload {
  const buildOrderSteps = normalizeOrderedBuildSteps(args.orderedPlan.buildOrder);
  const endLoopSteps = normalizeOrderedEndLoopSteps(args.orderedPlan.endLoop);
  const shouldUseEndLoop = isOrderedBuildOrderSatisfied(
    buildOrderSteps,
    args.authoritativeFleet,
    args.progressContext.current,
    args.progressContext.simulacrum,
  );
  const openingRequiredCounts = new Map<string, number>();
  const evolverChoices: EvolverBuildChoiceEntry[] = [];
  const manualBridgeDraftCounts = new Map<string, number>();
  let {
    remainingOrdinaryLines,
    remainingJoiningLines,
  } = args;

  if (!shouldUseEndLoop) {
    for (const step of buildOrderSteps) {
      if (isNormalizedProgressGateStep(step)) {
        if (!args.progressContext.simulacrum?.openingComplete) break;
        continue;
      }
      if (isNormalizedCommittedHealthGroupStep(step)) {
        const result = processCommittedHealthGroupStep({
          plan: args.plan,
          step,
          player: args.player,
          authoritativeFleet: args.authoritativeFleet,
          workingFleet: args.workingFleet,
          draftCounts: args.draftCounts,
          draftOrder: args.draftOrder,
          nativeSpecies: args.nativeSpecies,
          progressContext: args.progressContext,
          remainingOrdinaryLines,
          remainingJoiningLines,
        });
        remainingOrdinaryLines = result.remainingOrdinaryLines;
        remainingJoiningLines = result.remainingJoiningLines;
        if (
          args.progressContext.invalid ||
          result.blockedBySaveUntilAffordable ||
          result.shouldStopOrderedSequence
        ) {
          break;
        }
        continue;
      }

      const requiredCount = (openingRequiredCounts.get(step.shipDefId) ?? 0) + 1;
      openingRequiredCounts.set(step.shipDefId, requiredCount);

      if (countOrderedProgressShips(args.workingFleet, step.shipDefId) >= requiredCount) {
        continue;
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
  } else {
    const adaptiveDraft = draftAdaptiveBuildRules({
      plan: args.plan,
      placement: 'after_ordered_opening',
      player: args.player,
      opponent: args.opponent,
      workingFleet: args.workingFleet,
      draftCounts: args.draftCounts,
      draftOrder: args.draftOrder,
      nativeSpecies: args.nativeSpecies,
      remainingOrdinaryLines,
      remainingJoiningLines,
    });
    remainingOrdinaryLines = adaptiveDraft.remainingOrdinaryLines;
    remainingJoiningLines = adaptiveDraft.remainingJoiningLines;
    if (adaptiveDraft.blockedBySaveUntilAffordable) {
      return buildSubmitFromDraft(
        args.draftOrder,
        args.draftCounts,
        evolverChoices,
      );
    }

    const fleetProgressStartIndex =
      args.orderedPlan.endLoopProgress === 'fleet_counts'
        ? getFleetProgressEndLoopStartIndex({
          buildOrderSteps,
          endLoopSteps,
          authoritativeFleet: args.authoritativeFleet,
        })
        : 0;
    for (
      let passIndex = 0;
      passIndex < MAX_ORDERED_END_LOOP_PASSES_PER_SUBMIT;
      passIndex += 1
    ) {
      let draftedInPass = false;
      let stoppedByBlock = false;

      for (
        let stepIndex = passIndex === 0 ? fleetProgressStartIndex : 0;
        stepIndex < endLoopSteps.length;
        stepIndex += 1
      ) {
        const step = endLoopSteps[stepIndex];
        const ordinaryStep = isNormalizedOrderedBuildStep(step) ? step : null;
        const opportunisticUpgradeResult =
          ordinaryStep && !isUpgradedShipDefId(ordinaryStep.shipDefId)
          ? tryDraftLaterComponentReadyEndLoopUpgrade({
            endLoopSteps,
            currentStepIndex: stepIndex,
            workingFleet: args.workingFleet,
            draftCounts: args.draftCounts,
            draftOrder: args.draftOrder,
            nativeSpecies: args.nativeSpecies,
            remainingOrdinaryLines,
            remainingJoiningLines,
          })
          : null;

        let result: OrderedBuildStepResult;
        if (opportunisticUpgradeResult) {
          result = opportunisticUpgradeResult;
        } else if (ordinaryStep) {
          result = processOrderedBuildStep({
            plan: args.plan,
            orderedPlan: args.orderedPlan,
            step: ordinaryStep,
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
        } else if (isNormalizedCommittedHealthGroupStep(step)) {
          result = processCommittedHealthGroupStep({
            plan: args.plan,
            step,
            player: args.player,
            authoritativeFleet: args.authoritativeFleet,
            workingFleet: args.workingFleet,
            draftCounts: args.draftCounts,
            draftOrder: args.draftOrder,
            nativeSpecies: args.nativeSpecies,
            progressContext: args.progressContext,
            remainingOrdinaryLines,
            remainingJoiningLines,
          });
        } else if (isNormalizedFirstAffordableEndLoopStep(step)) {
          result = processFirstAffordableEndLoopStep({
            step,
            workingFleet: args.workingFleet,
            draftCounts: args.draftCounts,
            draftOrder: args.draftOrder,
            nativeSpecies: args.nativeSpecies,
            remainingOrdinaryLines,
            remainingJoiningLines,
          });
        } else {
          result = {
            blockedBySaveUntilAffordable: false,
            shouldStopOrderedSequence: true,
            didDraftPrimaryStep: false,
            didDraftFallbackOrBridge: false,
            remainingOrdinaryLines,
            remainingJoiningLines,
          };
        }

        remainingOrdinaryLines = result.remainingOrdinaryLines;
        remainingJoiningLines = result.remainingJoiningLines;
        draftedInPass = draftedInPass ||
          result.didDraftPrimaryStep ||
          result.didDraftFallbackOrBridge;

        if (result.blockedBySaveUntilAffordable || result.shouldStopOrderedSequence) {
          stoppedByBlock = true;
          break;
        }
      }

      if (!draftedInPass || stoppedByBlock) {
        break;
      }
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

function planBotBuildPayload(
  state: any,
  botPlayerId: string,
  plan: AuthoredBotPlan,
  progressContext: BuildPlanProgressContext,
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

  const adaptiveDraft = draftAdaptiveBuildRules({
    plan,
    placement: 'before_plan',
    player,
    opponent,
    workingFleet,
    draftCounts,
    draftOrder,
    nativeSpecies,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });
  remainingOrdinaryLines = adaptiveDraft.remainingOrdinaryLines;
  remainingJoiningLines = adaptiveDraft.remainingJoiningLines;

  if (adaptiveDraft.blockedBySaveUntilAffordable) {
    return buildSubmitFromDraft(draftOrder, draftCounts);
  }

  const opportunisticForeignUpgrade = tryDraftOpportunisticForeignUpgrade({
    plan,
    opponent,
    workingFleet,
    draftCounts,
    draftOrder,
    nativeSpecies,
    remainingOrdinaryLines,
    remainingJoiningLines,
  });
  if (opportunisticForeignUpgrade?.ok) {
    remainingOrdinaryLines =
      opportunisticForeignUpgrade.remainingOrdinaryLines;
    remainingJoiningLines =
      opportunisticForeignUpgrade.remainingJoiningLines;
  }

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
      progressContext,
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

export function planBotBuildDecision(
  state: any,
  botPlayerId: string,
  plan: AuthoredBotPlan,
  currentPlanProgress?: BotPlanProgress,
): BotBuildDecision {
  const authoritativeFleet = buildWorkingFleet(
    state?.gameData?.ships?.[botPlayerId] ?? [],
  );
  let current: CommittedBotBuildGroupProgress | null = null;
  let simulacrum: AncientSimulacrumBotProgress | null = null;
  let fullProgress: BotPlanProgress = {};
  if (typeof currentPlanProgress !== 'undefined') {
    if (
      !currentPlanProgress ||
      typeof currentPlanProgress !== 'object'
    ) {
      return {
        ok: false,
        reason: 'invalid_committed_build_group_progress',
      };
    }
    if (
      currentPlanProgress.committedBuildGroup &&
      !isCommittedProgressValid({
        plan,
        progress: currentPlanProgress.committedBuildGroup,
      })
    ) {
      return {
        ok: false,
        reason: 'invalid_committed_build_group_progress',
      };
    }
    if (
      currentPlanProgress.simulacrum &&
      !isSimulacrumProgressValid({
        plan,
        progress: currentPlanProgress.simulacrum,
      })
    ) {
      return {
        ok: false,
        reason: 'invalid_committed_build_group_progress',
      };
    }
    current = currentPlanProgress.committedBuildGroup ?? null;
    simulacrum = currentPlanProgress.simulacrum ?? null;
    fullProgress = structuredClone(currentPlanProgress);
  }

  const progressContext: BuildPlanProgressContext = {
    current,
    simulacrum,
    fullProgress,
    invalid: false,
  };
  const payload = planBotBuildPayload(
    state,
    botPlayerId,
    plan,
    progressContext,
  );
  if (progressContext.invalid) {
    return {
      ok: false,
      reason: 'invalid_committed_build_group_progress',
    };
  }

  return {
    ok: true,
    payload,
    ...(progressContext.proposedUpdate
      ? { proposedPlanProgressUpdate: progressContext.proposedUpdate }
      : {}),
  };
}

export function planBotBuildSubmit(
  state: any,
  botPlayerId: string,
  plan: AuthoredBotPlan,
): BuildSubmitPayload {
  const decision = planBotBuildDecision(state, botPlayerId, plan);
  return decision.ok ? decision.payload : { builds: [] };
}

export function planHumanBuildSubmit(
  state: any,
  botPlayerId: string,
  plan: AuthoredBotPlan,
): BuildSubmitPayload {
  return planBotBuildSubmit(state, botPlayerId, plan);
}
