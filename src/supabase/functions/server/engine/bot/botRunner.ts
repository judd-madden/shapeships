import { applyIntent, type IntentRequest } from '../intent/IntentReducer.ts';
import type {
  ActionsBatchPayload,
  BuildSubmitPayload,
  PowerActionPayload,
} from '../intent/IntentTypes.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import {
  getReservedFirstStrikeTargetInstanceIds,
  getValidDestroyTargets,
  getValidShipOfEqualityTargets,
  getValidTransferTargets,
} from '../../engine_shared/resolve/destroyRules.ts';
import { isThirdSpiralFirstStrikeEligible } from '../../engine_shared/resolve/thirdSpiralFirstStrikeEligibility.ts';
import { getCentaurBotPlanById } from './centaurPlans.ts';
import { getHumanBotPlanById } from './humanPlans.ts';
import { getXeniteBotPlanById } from './xenitePlans.ts';
import {
  chooseAncientOpeningStrategy,
  getAncientBotStrategyById,
} from './ancientPlans.ts';
import { planBotBuildSubmit } from './buildPlanner.ts';
import { completeAncientBuildSubmitPayload } from './ancientBuildPayload.ts';
import { planAncientChargeDeclaration } from './ancientBotPlanner.ts';
import type {
  AuthoredBotPlan,
  BotSpeciesId,
  CarrierChoiceId,
  FrigateTriggerPolicy,
} from './botTypes.ts';
import {
  getChargeSourceShipsForPhase,
  getRequiredTargetCountForTargetedEffect,
  getStructuredChoicePowerForShipDef,
  hasEnoughChargeForChoice,
  isStructuredChoicePowerAvailableForShip,
  planDamageHealChargeActions,
  shouldApplyOpponentSacProtectionForTargetedEffect,
} from './botPowerPlanning.ts';
import {
  compareTargetsHighestTactical,
  getLiveShipChargesCurrent,
} from './botTargeting.ts';
import {
  getCubeDiceActionForPlayer,
  playerHasValidPendingCubeChoice,
} from '../phase/cubeDiceManipulation.ts';
import { getChargeDeclarationLegalityState } from '../intent/chargeDeclarationEligibility.ts';
import {
  projectDrawingPreludeCarrierActions,
  projectDrawingPreludeRequesterSummary,
} from '../state/drawingPreludeProjection.ts';

export const MAX_BOT_STEPS_PER_REQUEST = 8;
const CARRIER_ACTION_ID = 'CAR#0';
const FIRST_STRIKE_PHASE_KEY = 'battle.first_strike';
const FIRST_STRIKE_TARGET_SHIP_DEF_IDS = ['GUA', 'SAC', 'DOM', 'SPI'] as const;

type FirstStrikeTargetShipDefId = (typeof FIRST_STRIKE_TARGET_SHIP_DEF_IDS)[number];
type KnoRerollPassIndex = 1 | 2 | 3;

function getPhaseKey(state: any): string | null {
  const major = state?.gameData?.currentPhase;
  const sub = state?.gameData?.currentSubPhase;
  if (!major || !sub) return null;
  return buildPhaseKey(major, sub);
}

function isPlayerReadyForPhase(state: any, playerId: string, phaseKey: string): boolean {
  const readiness = state?.gameData?.phaseReadiness ?? [];
  return readiness.some((entry: any) =>
    entry?.playerId === playerId &&
    entry?.currentStep === phaseKey &&
    entry?.isReady === true
  );
}

function buildBotNonce(args: {
  state: any;
  phaseKey: string;
  loopStep: number;
  playerId: string;
  intentType: IntentRequest['intentType'];
}): string {
  const turnNumber = args.state?.gameData?.turnNumber ?? 0;
  return `bot:${args.state?.gameId ?? 'unknown'}:${turnNumber}:${args.phaseKey}:${args.loopStep}:${args.playerId}:${args.intentType}`;
}

function buildPowerIntentFromActions(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  actions: PowerActionPayload[];
  batchWhenMultiple?: boolean;
  forceBatch?: boolean;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, actions } = args;
  if (actions.length === 0) {
    return null;
  }

  const turnNumber = state?.gameData?.turnNumber ?? 0;
  const batchWhenMultiple = args.batchWhenMultiple ?? true;
  const forceBatch = args.forceBatch === true;

  if (!forceBatch && (actions.length === 1 || !batchWhenMultiple)) {
    return {
      gameId: state.gameId,
      intentType: 'ACTION',
      turnNumber,
      payload: actions[0],
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'ACTION',
      }),
    };
  }

  const payload: ActionsBatchPayload = {
    actions,
  };

  return {
    gameId: state.gameId,
    intentType: 'ACTIONS_SUBMIT',
    turnNumber,
    payload,
    nonce: buildBotNonce({
      state,
      phaseKey,
      loopStep,
      playerId,
      intentType: 'ACTIONS_SUBMIT',
    }),
  };
}

function buildCubeDiceIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep } = args;
  if (
    phaseKey !== 'build.dice_roll' ||
    state?.gameData?.turnData?.diceManipulationStage !== 'cube' ||
    playerHasValidPendingCubeChoice(state, playerId)
  ) {
    return null;
  }

  const action = getCubeDiceActionForPlayer(state, playerId);
  if (!action || action.choices.length === 0) return null;

  let bestChoice = action.choices[0];
  for (const candidate of action.choices.slice(1)) {
    const isHigherValue =
      candidate.projectedAmount > bestChoice.projectedAmount;
    const isCubeTiedWithMain =
      candidate.projectedAmount === bestChoice.projectedAmount &&
      candidate.choiceId !== 'main' &&
      bestChoice.choiceId === 'main';
    if (isHigherValue || isCubeTiedWithMain) {
      bestChoice = candidate;
    }
  }

  return buildPowerIntentFromActions({
    state,
    playerId,
    phaseKey,
    loopStep,
    forceBatch: true,
    actions: [{
      actionType: 'power',
      actionId: 'CUB#0',
      sourceInstanceId: action.sourceInstanceId,
      choiceId: bestChoice.choiceId,
    }],
  });
}

function createRunnerDebugEvent(playerId: string, reason: string, phaseKey: string | null) {
  return {
    type: 'BOT_RUNNER_SKIPPED',
    playerId,
    reason,
    phaseKey,
  };
}

function createRejectedDebugEvent(
  playerId: string,
  phaseKey: string | null,
  intentType: IntentRequest['intentType'],
  rejected: { code: string; message: string } | undefined,
) {
  return {
    type: 'BOT_INTENT_REJECTED',
    playerId,
    phaseKey,
    intentType,
    rejectedCode: rejected?.code ?? 'UNKNOWN',
    rejectedMessage: rejected?.message ?? 'Unknown rejection',
  };
}

function getSpeciesPayloadFromBotSpeciesId(speciesId: BotSpeciesId | null | undefined):
  | 'human'
  | 'xenite'
  | 'centaur'
  | 'ancient'
  | null {
  switch (speciesId) {
    case 'HUM':
      return 'human';
    case 'XEN':
      return 'xenite';
    case 'CEN':
      return 'centaur';
    case 'ANC':
      return 'ancient';
    default:
      return null;
  }
}

function resolveBotPlan(controller: any): AuthoredBotPlan | { debugReason: string } {
  const speciesId = controller?.speciesId;
  if (speciesId == null) {
    return { debugReason: 'missing_bot_species_id' };
  }

  switch (speciesId) {
    case 'HUM': {
      if (typeof controller?.chosenPlanId !== 'string' || controller.chosenPlanId.length === 0) {
        return { debugReason: 'missing_chosen_plan_id' };
      }

      const plan = getHumanBotPlanById(controller.chosenPlanId);
      if (!plan) {
        return { debugReason: 'missing_matching_plan' };
      }

      return plan;
    }
    case 'XEN': {
      if (typeof controller?.chosenPlanId !== 'string' || controller.chosenPlanId.length === 0) {
        return { debugReason: 'missing_chosen_plan_id' };
      }

      const plan = getXeniteBotPlanById(controller.chosenPlanId);
      if (!plan) {
        return { debugReason: 'missing_matching_plan' };
      }

      return plan;
    }
    case 'CEN': {
      if (typeof controller?.chosenPlanId !== 'string' || controller.chosenPlanId.length === 0) {
        return { debugReason: 'missing_chosen_plan_id' };
      }

      const plan = getCentaurBotPlanById(controller.chosenPlanId);
      if (!plan) {
        return { debugReason: 'missing_matching_plan' };
      }

      return plan;
    }
    default:
      return { debugReason: 'invalid_bot_species_id' };
  }
}

function isAuthoredBotPlanRequiredPhase(phaseKey: string): boolean {
  return (
    phaseKey === 'build.dice_roll' ||
    phaseKey === 'build.drawing' ||
    phaseKey === 'battle.charge_declaration' ||
    phaseKey === FIRST_STRIKE_PHASE_KEY
  );
}

function countFleetShipsByDefId(state: any, playerId: string, shipDefId: string): number {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  if (!Array.isArray(fleet)) {
    return 0;
  }

  return fleet.filter((ship: any) => ship?.shipDefId === shipDefId).length;
}

function isCarrierChoiceId(value: unknown): value is CarrierChoiceId {
  return value === 'defender' || value === 'fighter' || value === 'hold';
}

function isFirstStrikeTargetShipDefId(value: string): value is FirstStrikeTargetShipDefId {
  return (FIRST_STRIKE_TARGET_SHIP_DEF_IDS as readonly string[]).includes(value);
}

function compareOwnEqualitySacrificeTargets(state: any, left: any, right: any): number {
  if (left.totalLineCost !== right.totalLineCost) {
    return right.totalLineCost - left.totalLineCost;
  }

  const leftCharges = getLiveShipChargesCurrent(
    state,
    left.ownerPlayerId,
    left.instanceId,
  );
  const rightCharges = getLiveShipChargesCurrent(
    state,
    right.ownerPlayerId,
    right.instanceId,
  );

  if (leftCharges !== rightCharges) {
    return leftCharges - rightCharges;
  }

  return left.instanceId.localeCompare(right.instanceId);
}

function hasPendingFirstStrikeSelectionForSource(
  state: any,
  playerId: string,
  sourceInstanceId: string,
): boolean {
  const playerPendingSelections =
    state?.gameData?.turnData?.pendingFirstStrikeSelectionsByPlayerId?.[playerId];

  if (!playerPendingSelections || typeof playerPendingSelections !== 'object') {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(
    playerPendingSelections,
    sourceInstanceId,
  );
}

function getKnoRerollPassIndex(state: any): KnoRerollPassIndex {
  const passIndex = state?.gameData?.turnData?.knoRerollPassIndex;
  return passIndex === 2 || passIndex === 3 ? passIndex : 1;
}

function getKnoMaxRerollPassCountForPlayer(state: any, playerId: string): KnoRerollPassIndex | 0 {
  return Math.min(3, countFleetShipsByDefId(state, playerId, 'KNO')) as KnoRerollPassIndex | 0;
}

function playerHasKnoRerollForPass(
  state: any,
  playerId: string,
  passIndex: KnoRerollPassIndex,
): boolean {
  return getKnoMaxRerollPassCountForPlayer(state, playerId) >= passIndex;
}

function playerIsKnoRerollStopped(state: any, playerId: string): boolean {
  return state?.gameData?.turnData?.knoRerollStoppedByPlayerId?.[playerId] === true;
}

function playerCanActInKnoRerollPass(
  state: any,
  playerId: string,
  passIndex: KnoRerollPassIndex,
): boolean {
  return playerHasKnoRerollForPass(state, playerId, passIndex) &&
    !playerIsKnoRerollStopped(state, playerId);
}

function playerHasPendingKnoRerollChoiceForPass(
  state: any,
  playerId: string,
  passIndex: KnoRerollPassIndex,
): boolean {
  const pendingByPass =
    state?.gameData?.turnData?.pendingKnoRerollChoiceByPassByPlayerId?.[playerId];
  return pendingByPass?.[passIndex] === 'reroll' || pendingByPass?.[passIndex] === 'hold';
}

function getRepresentativeKnoInstanceIdForPass(
  state: any,
  playerId: string,
  passIndex: KnoRerollPassIndex,
): string | null {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  const knoInstanceIds = Array.isArray(fleet)
    ? fleet
      .filter((ship: any) => ship?.shipDefId === 'KNO' && typeof ship?.instanceId === 'string')
      .map((ship: any) => ship.instanceId)
      .sort((a: string, b: string) => a.localeCompare(b))
    : [];

  if (knoInstanceIds.length === 0) return null;
  return knoInstanceIds[passIndex - 1] ?? knoInstanceIds[0];
}

export function chooseCarrierDrawingPreludeChoiceId(args: {
  state: any;
  playerId: string;
  plan: AuthoredBotPlan;
  legalChoiceIds: CarrierChoiceId[];
}): CarrierChoiceId | null {
  const { state, playerId, plan, legalChoiceIds } = args;
  if (legalChoiceIds.length === 0) {
    return null;
  }

  const legalChoiceIdSet = new Set<CarrierChoiceId>(legalChoiceIds);
  const carrierPolicy = plan?.drawingPrelude?.CAR;

  for (const goal of carrierPolicy?.priorityGoals ?? []) {
    if (!legalChoiceIdSet.has(goal.choiceId)) {
      continue;
    }

    const currentCount = countFleetShipsByDefId(state, playerId, goal.targetShipDefId);
    if (currentCount < goal.targetCount) {
      return goal.choiceId;
    }
  }

  const fallbackChoiceId = carrierPolicy?.fallbackChoiceId;
  if (fallbackChoiceId && legalChoiceIdSet.has(fallbackChoiceId)) {
    return fallbackChoiceId;
  }

  if (legalChoiceIdSet.has('hold')) return 'hold';
  return legalChoiceIds[0] ?? null;
}

function chooseDefaultCarrierChoiceId(args: {
  state: any;
  playerId: string;
  legalChoiceIds: CarrierChoiceId[];
}): CarrierChoiceId | null {
  const { state, playerId, legalChoiceIds } = args;
  if (legalChoiceIds.length === 0) {
    return null;
  }

  const player = (state?.players ?? []).find((entry: any) => entry?.id === playerId);
  const opponent = (state?.players ?? []).find(
    (entry: any) => entry?.role === 'player' && entry?.id !== playerId,
  );
  const playerHealth = Number(player?.health ?? 0);
  const opponentHealth = Number(opponent?.health ?? 0);
  const legalChoiceIdSet = new Set<CarrierChoiceId>(legalChoiceIds);
  const preferredChoiceId: Exclude<CarrierChoiceId, 'hold'> =
    playerHealth <= 14 || playerHealth < opponentHealth ? 'defender' : 'fighter';

  if (legalChoiceIdSet.has(preferredChoiceId)) {
    return preferredChoiceId;
  }

  for (const fallbackChoiceId of ['defender', 'fighter'] as const) {
    if (legalChoiceIdSet.has(fallbackChoiceId)) {
      return fallbackChoiceId;
    }
  }

  return legalChoiceIdSet.has('hold') ? 'hold' : null;
}

function clampFrigateTrigger(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(1, Math.min(6, Math.floor(numeric)));
}

function normalizeStrictFrigateTrigger(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 6) {
    return null;
  }

  return numeric;
}

function getEffectiveDiceRollForBot(state: any, playerId: string): number | null {
  const turnData = state?.gameData?.turnData;
  const perPlayerRoll = turnData?.effectiveDiceRollByPlayerId?.[playerId];
  return (
    clampFrigateTrigger(perPlayerRoll) ??
    clampFrigateTrigger(turnData?.effectiveDiceRoll) ??
    clampFrigateTrigger(turnData?.baseDiceRoll) ??
    clampFrigateTrigger(turnData?.diceRoll) ??
    clampFrigateTrigger(state?.gameData?.diceRoll)
  );
}

function getKnownFrigateTriggersForPlayer(state: any, playerId: string): number[] {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  if (!Array.isArray(fleet)) {
    return [];
  }

  const frigateTriggerByInstanceId = state?.gameData?.powerMemory?.frigateTriggerByInstanceId ?? {};

  return fleet
    .filter((ship: any) =>
      ship?.shipDefId === 'FRI' &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0
    )
    .sort((left: any, right: any) => left.instanceId.localeCompare(right.instanceId))
    .map((ship: any) => normalizeStrictFrigateTrigger(frigateTriggerByInstanceId[ship.instanceId]))
    .filter((trigger: number | null): trigger is number => trigger !== null);
}

function derivePlannedFrigateTriggerSlots(payload: BuildSubmitPayload): number[] | null {
  if (!Array.isArray(payload?.builds)) {
    return null;
  }

  const plannedTriggerSlots: number[] = [];

  for (const build of payload.builds) {
    if (!build || typeof build.shipDefId !== 'string' || build.shipDefId.length === 0) {
      return null;
    }

    if (!Number.isInteger(build.count) || build.count < 0) {
      return null;
    }

    if (build.shipDefId === 'FRI') {
      for (let index = 0; index < build.count; index += 1) {
        plannedTriggerSlots.push(index);
      }
    }
  }

  return plannedTriggerSlots;
}

function chooseFrigateTriggerFromPolicy(args: {
  currentRoll: number;
  knownTriggers: number[];
  policy: FrigateTriggerPolicy;
}): number {
  const { currentRoll, knownTriggers, policy } = args;

  if (knownTriggers.length === 0) {
    if (policy.firstChoiceMode === 'fixed') {
      return normalizeStrictFrigateTrigger(policy.fixedTrigger) ?? currentRoll;
    }

    if (policy.firstChoiceMode === 'match_current_roll') {
      return currentRoll;
    }
  }

  const additionalChoiceMode = policy.additionalChoiceMode ?? 'stack_existing';
  if (additionalChoiceMode === 'stack_existing') {
    return knownTriggers[0] ?? currentRoll;
  }

  const occupiedTriggers = new Set(knownTriggers);
  for (const value of policy.spreadSequence ?? []) {
    const trigger = normalizeStrictFrigateTrigger(value);
    if (trigger === null || occupiedTriggers.has(trigger)) {
      continue;
    }

    return trigger;
  }

  return currentRoll;
}

function appendFrigateTriggersToBuildSubmit(args: {
  state: any;
  playerId: string;
  plan: AuthoredBotPlan;
  payload: BuildSubmitPayload;
}): BuildSubmitPayload {
  const { state, playerId, plan, payload } = args;
  const frigatePolicy = plan?.frigatePolicy?.FRI;
  if (!frigatePolicy) {
    return payload;
  }

  // The build resolver consumes frigateTriggers in payload.builds order, so only author
  // them when that order is represented directly and unambiguously in the submit payload.
  const plannedTriggerSlots = derivePlannedFrigateTriggerSlots(payload);
  if (plannedTriggerSlots === null || plannedTriggerSlots.length === 0) {
    return payload;
  }

  const currentRoll = getEffectiveDiceRollForBot(state, playerId);
  if (currentRoll === null) {
    return payload;
  }

  const knownTriggers = getKnownFrigateTriggersForPlayer(state, playerId);
  const frigateTriggers: number[] = [];

  for (let index = 0; index < plannedTriggerSlots.length; index += 1) {
    const nextTrigger = chooseFrigateTriggerFromPolicy({
      currentRoll,
      knownTriggers,
      policy: frigatePolicy,
    });
    frigateTriggers.push(nextTrigger);
    knownTriggers.push(nextTrigger);
  }

  return {
    ...payload,
    frigateTriggers,
  };
}

function buildDamageHealChargeIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  if (phaseKey !== 'battle.charge_declaration') {
    return null;
  }

  const actions = planDamageHealChargeActions({
    state,
    playerId,
    chargePolicy: plan.chargePolicy,
  });

  const legacyHumanIntOnly =
    phaseKey === 'battle.charge_declaration' &&
    actions.length > 0 &&
    actions.every((action) => action.actionId === 'INT#0') &&
    plan.chargePolicy?.INT !== undefined &&
    Object.keys(plan?.chargePolicy ?? {}).every((shipDefId) => shipDefId === 'INT');

  return buildPowerIntentFromActions({
    state,
    playerId,
    phaseKey,
    loopStep,
    actions,
    batchWhenMultiple: !legacyHumanIntOnly,
  });
}

export function buildDrawingPreludeCarrierIntentForBot(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  const projectedActions = projectDrawingPreludeCarrierActions(state, playerId);
  if (projectedActions.length === 0) return null;

  const actions: PowerActionPayload[] = [];
  for (const projected of projectedActions) {
    const legalChoiceIds = projected.choices.map((choice) => choice.choiceId);
    const choiceId = plan.drawingPrelude?.CAR
      ? chooseCarrierDrawingPreludeChoiceId({
          state,
          playerId,
          plan,
          legalChoiceIds,
        })
      : chooseDefaultCarrierChoiceId({ state, playerId, legalChoiceIds });
    if (!choiceId || !legalChoiceIds.includes(choiceId)) return null;
    actions.push({
      actionType: 'power',
      actionId: projected.actionId,
      sourceInstanceId: projected.sourceInstanceId,
      choiceId,
      passIndex: projected.passIndex,
    });
  }

  return buildPowerIntentFromActions({
    state,
    playerId,
    phaseKey,
    loopStep,
    actions,
    forceBatch: true,
  });
}

export function buildFirstStrikeTargetIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  if (phaseKey !== FIRST_STRIKE_PHASE_KEY) {
    return null;
  }

  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  if (!Array.isArray(fleet)) {
    return null;
  }

  const sourceShips = fleet
    .filter((ship: any) =>
      typeof ship?.shipDefId === 'string' &&
      isFirstStrikeTargetShipDefId(ship.shipDefId) &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0
    )
    .sort((left: any, right: any) => {
      const leftOrder = FIRST_STRIKE_TARGET_SHIP_DEF_IDS.indexOf(left.shipDefId);
      const rightOrder = FIRST_STRIKE_TARGET_SHIP_DEF_IDS.indexOf(right.shipDefId);
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.instanceId.localeCompare(right.instanceId);
    });

  const actions: PowerActionPayload[] = [];
  const reservedTargetIds = new Set(
    getReservedFirstStrikeTargetInstanceIds(state, playerId),
  );

  for (const ship of sourceShips) {
    if (
      ship.shipDefId === 'SPI' &&
      !isThirdSpiralFirstStrikeEligible(state, playerId, ship.instanceId)
    ) {
      continue;
    }

    const policy = plan?.targetPolicy?.[ship.shipDefId as FirstStrikeTargetShipDefId];
    if (policy?.mode !== 'highest_cost_basic') {
      continue;
    }

    const targetedEffectKind = ship.shipDefId === 'DOM'
      ? EffectKind.TransferShip
      : EffectKind.Destroy;
    const choiceIds = ship.shipDefId === 'DOM' ? ['steal'] : ['destroy'];
    const choicePower = getStructuredChoicePowerForShipDef({
      shipDefId: ship.shipDefId,
      phaseKey,
      choiceIds,
      targetedEffectKind,
    });
    if (!choicePower?.targetedEffect) {
      continue;
    }

    if (hasPendingFirstStrikeSelectionForSource(state, playerId, ship.instanceId)) {
      continue;
    }

    if (!isStructuredChoicePowerAvailableForShip(
      state,
      ship,
      choicePower.actionId,
      choicePower.power,
    )) {
      continue;
    }

    if (!hasEnoughChargeForChoice(ship, choicePower.power, choicePower.choiceId)) {
      continue;
    }

    const targetArgs = {
      sourcePlayerId: playerId,
      targetScope:
        choicePower.targetedEffect.targetPlayer === 'self' ? 'self' : 'opponent',
      restriction: choicePower.targetedEffect.restriction ?? 'any',
      applyOpponentSacProtection:
        shouldApplyOpponentSacProtectionForTargetedEffect(choicePower.targetedEffect),
    } as const;
    const powerSpecificValidTargets =
      choicePower.targetedEffect.kind === EffectKind.TransferShip
        ? getValidTransferTargets(state, targetArgs)
        : getValidDestroyTargets(state, targetArgs);
    const validTargets = powerSpecificValidTargets.filter(
      (target) => !reservedTargetIds.has(target.instanceId),
    );
    if (validTargets.length === 0) {
      continue;
    }
    const requiredTargetCount = Math.min(
      getRequiredTargetCountForTargetedEffect(choicePower.targetedEffect),
      validTargets.length,
    );

    if (validTargets.length < requiredTargetCount) {
      continue;
    }

    const chosenTargetIds = [...validTargets]
      .sort((left, right) => compareTargetsHighestTactical(state, left, right))
      .slice(0, requiredTargetCount)
      .map((target) => target.instanceId);

    if (chosenTargetIds.length !== requiredTargetCount) {
      continue;
    }

    for (const targetId of chosenTargetIds) {
      reservedTargetIds.add(targetId);
    }

    actions.push({
      actionType: 'power',
      actionId: choicePower.actionId,
      sourceInstanceId: ship.instanceId,
      choiceId: choicePower.choiceId,
      targetInstanceId: chosenTargetIds[0],
      targetInstanceIds: requiredTargetCount > 1 ? chosenTargetIds : undefined,
    });
  }

  const legacyHumanGuaOnly =
    actions.length > 0 &&
    actions.every((action) => action.actionId === 'GUA#0') &&
    Object.keys(plan?.targetPolicy ?? {}).every((shipDefId) => shipDefId === 'GUA');

  return buildPowerIntentFromActions({
    state,
    playerId,
    phaseKey,
    loopStep,
    actions,
    batchWhenMultiple: !legacyHumanGuaOnly,
  });
}

function buildEqualityChargeIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  const equalityTargetMode = plan?.targetPolicy?.EQU?.mode;
  if (
    phaseKey !== 'battle.charge_declaration' ||
    (
      equalityTargetMode !== 'highest_shared_cost_pair' &&
      equalityTargetMode !== 'lowest_shared_cost_pair'
    )
  ) {
    return null;
  }

  const sourceShips = getChargeSourceShipsForPhase(state, playerId)
    .filter((ship: any) =>
      ship?.shipDefId === 'EQU' &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0
    )
    .sort((left: any, right: any) => left.instanceId.localeCompare(right.instanceId));

  if (sourceShips.length === 0) {
    return null;
  }

  const choicePower = getStructuredChoicePowerForShipDef({
    shipDefId: 'EQU',
    phaseKey,
    choiceIds: ['damage'],
  });
  if (!choicePower) {
    return null;
  }

  for (const ship of sourceShips) {
    if (!isStructuredChoicePowerAvailableForShip(
      state,
      ship,
      choicePower.actionId,
      choicePower.power,
    )) {
      continue;
    }

    if (!hasEnoughChargeForChoice(ship, choicePower.power, choicePower.choiceId)) {
      continue;
    }

    const targetState = phaseKey === 'battle.charge_declaration'
      ? getChargeDeclarationLegalityState(state)
      : state;
    const { validOwnTargets, validOpponentTargets } = getValidShipOfEqualityTargets(
      targetState,
      playerId,
    );
    if (validOwnTargets.length === 0 || validOpponentTargets.length === 0) {
      continue;
    }

    const sharedCosts = new Set(validOwnTargets.map((target) => target.totalLineCost));
    const selectedSharedCost = [...validOpponentTargets]
      .map((target) => target.totalLineCost)
      .filter((cost) => sharedCosts.has(cost))
      .sort((left, right) =>
        equalityTargetMode === 'lowest_shared_cost_pair'
          ? left - right
          : right - left
      )[0];

    if (typeof selectedSharedCost !== 'number') {
      continue;
    }

    const ownTarget = validOwnTargets
      .filter((target) => target.totalLineCost === selectedSharedCost)
      .sort((left, right) => compareOwnEqualitySacrificeTargets(targetState, left, right))[0];
    const opponentTarget = validOpponentTargets
      .filter((target) => target.totalLineCost === selectedSharedCost)
      .sort((left, right) => compareTargetsHighestTactical(targetState, left, right))[0];

    if (!ownTarget || !opponentTarget) {
      continue;
    }

    return buildPowerIntentFromActions({
      state,
      playerId,
      phaseKey,
      loopStep,
      actions: [
        {
          actionType: 'power',
          actionId: choicePower.actionId,
          sourceInstanceId: ship.instanceId,
          choiceId: choicePower.choiceId,
          targetInstanceIds: [ownTarget.instanceId, opponentTarget.instanceId],
        },
      ],
    });
  }

  return null;
}

function buildKnowledgeDiceIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  if (
    phaseKey !== 'build.dice_roll' ||
    state?.gameData?.turnData?.diceManipulationStage !== 'kno' ||
    plan?.dicePolicy?.KNO?.mode !== 'reroll_odd_hold_even'
  ) {
    return null;
  }

  const passIndex = getKnoRerollPassIndex(state);
  if (
    !playerCanActInKnoRerollPass(state, playerId, passIndex) ||
    playerHasPendingKnoRerollChoiceForPass(state, playerId, passIndex)
  ) {
    return null;
  }

  const sourceInstanceId = getRepresentativeKnoInstanceIdForPass(state, playerId, passIndex);
  const currentRoll = getEffectiveDiceRollForBot(state, playerId);
  if (!sourceInstanceId || currentRoll === null) {
    return null;
  }

  return buildPowerIntentFromActions({
    state,
    playerId,
    phaseKey,
    loopStep,
    actions: [
      {
        actionType: 'power',
        actionId: 'KNO#0',
        sourceInstanceId,
        choiceId: currentRoll % 2 === 1 ? 'reroll' : 'hold',
      },
    ],
  });
}

function buildBotIntent(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
}): IntentRequest | null | { debugReason: string } {
  const { state, playerId, phaseKey, loopStep } = args;
  const player = (state?.players ?? []).find((entry: any) => entry?.id === playerId);
  const controller = state?.controllersByPlayerId?.[playerId];
  const turnNumber = state?.gameData?.turnNumber ?? 0;

  if (!player) {
    return { debugReason: 'missing_player' };
  }

  if (!controller || controller.kind !== 'bot') {
    return { debugReason: 'missing_bot_controller' };
  }

  const isAncientBot = controller.speciesId === 'ANC';
  let ancientStrategy = null;
  if (isAncientBot && controller.chosenPlanId !== null) {
    ancientStrategy = typeof controller.chosenPlanId === 'string'
      ? getAncientBotStrategyById(controller.chosenPlanId)
      : null;
    if (
      typeof controller.chosenPlanId !== 'string' ||
      controller.chosenPlanId.length === 0 ||
      !ancientStrategy
    ) {
      return { debugReason: 'missing_matching_ancient_strategy' };
    }
  }

  let plan: AuthoredBotPlan | null = null;
  if (!isAncientBot && isAuthoredBotPlanRequiredPhase(phaseKey)) {
    const resolvedPlan = resolveBotPlan(controller);
    if ('debugReason' in resolvedPlan) {
      return resolvedPlan;
    }
    plan = resolvedPlan;
  }

  if (phaseKey === 'setup.species_selection') {
    if (player.faction) {
      return null;
    }

    const species = getSpeciesPayloadFromBotSpeciesId(controller.speciesId);
    if (!species) {
      return null;
    }

    return {
      gameId: state.gameId,
      intentType: 'SPECIES_SUBMIT',
      turnNumber,
      payload: { species },
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'SPECIES_SUBMIT',
      }),
    };
  }

  if (
    isAncientBot &&
    isAuthoredBotPlanRequiredPhase(phaseKey) &&
    phaseKey !== 'build.dice_roll' &&
    !(phaseKey === 'battle.charge_declaration' && ancientStrategy)
  ) {
    return {
      debugReason: controller.chosenPlanId === null
        ? 'unresolved_ancient_strategy_outside_drawing'
        : 'ancient_gameplay_deferred_after_phase_17a',
    };
  }

  if (phaseKey === 'build.drawing') {
    if (!plan) {
      return { debugReason: 'missing_matching_plan' };
    }

    const requesterPrelude = projectDrawingPreludeRequesterSummary(
      state,
      playerId,
    );
    if (!requesterPrelude) {
      return { debugReason: 'invalid_drawing_prelude_state' };
    }
    if (requesterPrelude.status === 'awaiting_actions') {
      const preludeIntent = buildDrawingPreludeCarrierIntentForBot({
        state,
        playerId,
        phaseKey,
        loopStep,
        plan,
      });
      return preludeIntent ?? {
        debugReason: 'unprojectable_drawing_prelude_actions',
      };
    }

    const buildSubmitPayloadWithFrigateTriggers = appendFrigateTriggersToBuildSubmit({
      state,
      playerId,
      plan,
      payload: planBotBuildSubmit(state, playerId, plan),
    });
    const completedBuildSubmitPayload = completeAncientBuildSubmitPayload({
      state,
      playerId,
      plan,
      payload: buildSubmitPayloadWithFrigateTriggers,
    });
    if (!completedBuildSubmitPayload.ok) {
      return {
        debugReason: `ancient_build_payload_completion_failed:${completedBuildSubmitPayload.reason}`,
      };
    }

    return {
      gameId: state.gameId,
      intentType: 'BUILD_SUBMIT',
      turnNumber,
      payload: completedBuildSubmitPayload.payload,
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'BUILD_SUBMIT',
      }),
    };
  }

  if (phaseKey === 'build.dice_roll' && (plan || isAncientBot)) {
    const cubeIntent = buildCubeDiceIntentForCurrentPhase({
      state,
      playerId,
      phaseKey,
      loopStep,
    });
    if (cubeIntent) {
      return cubeIntent;
    }

    if (plan) {
      const knowledgeIntent = buildKnowledgeDiceIntentForCurrentPhase({
        state,
        playerId,
        phaseKey,
        loopStep,
        plan,
      });

      if (knowledgeIntent) {
        return knowledgeIntent;
      }
    }
  }

  if (phaseKey === FIRST_STRIKE_PHASE_KEY && plan) {
    const firstStrikeIntent = buildFirstStrikeTargetIntentForCurrentPhase({
      state,
      playerId,
      phaseKey,
      loopStep,
      plan,
    });

    if (firstStrikeIntent) {
      return firstStrikeIntent;
    }
  }

  if (phaseKey === 'battle.charge_declaration' && ancientStrategy) {
    const declarationPlan = planAncientChargeDeclaration({
      state,
      playerId,
      strategy: ancientStrategy,
    });
    if (declarationPlan.kind === 'no_input') {
      return {
        debugReason: `ancient_charge_declaration_${declarationPlan.reason}`,
      };
    }

    return {
      gameId: state.gameId,
      intentType: 'CHARGE_DECLARATION_SUBMIT',
      turnNumber,
      payload: declarationPlan.payload,
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'CHARGE_DECLARATION_SUBMIT',
      }),
    };
  }

  if (
    phaseKey === 'battle.charge_declaration' &&
    plan
  ) {
    const equalityIntent = buildEqualityChargeIntentForCurrentPhase({
      state,
      playerId,
      phaseKey,
      loopStep,
      plan,
    });

    if (equalityIntent) {
      return equalityIntent;
    }

    const damageHealIntent = buildDamageHealChargeIntentForCurrentPhase({
      state,
      playerId,
      phaseKey,
      loopStep,
      plan,
    });

    if (damageHealIntent) {
      return damageHealIntent;
    }
  }

  return {
    gameId: state.gameId,
    intentType: 'DECLARE_READY',
    turnNumber,
    nonce: buildBotNonce({
      state,
      phaseKey,
      loopStep,
      playerId,
      intentType: 'DECLARE_READY',
    }),
  };
}

export async function runBotsUntilSettled(args: {
  state: any;
  nowMs: number;
}): Promise<{ state: any; events: any[]; botStepsApplied: number }> {
  let state = args.state;
  const events: any[] = [];
  let botStepsApplied = 0;

  while (botStepsApplied < MAX_BOT_STEPS_PER_REQUEST) {
    if (!state || state?.status === 'finished') {
      break;
    }

    const phaseKey = getPhaseKey(state);
    if (!phaseKey) {
      break;
    }
    if (state?.gameData?.turnData?.phaseHold?.phaseKey === phaseKey) {
      break;
    }

    let actionAppliedThisPass = false;

    for (const player of state?.players ?? []) {
      const controller = state?.controllersByPlayerId?.[player?.id];
      if (controller?.kind !== 'bot') continue;

      if (isPlayerReadyForPhase(state, player.id, phaseKey)) {
        continue;
      }

      let botIntent: IntentRequest | null | { debugReason: string };

      if (
        controller.speciesId === 'ANC' &&
        controller.chosenPlanId === null &&
        phaseKey === 'build.drawing'
      ) {
        const openingDecision = chooseAncientOpeningStrategy({
          gameId: state?.gameId,
          turnNumber: state?.gameData?.turnNumber,
          availableOrdinaryLines: player?.lines,
        });

        if (openingDecision.kind === 'invalid') {
          const reason = `invalid_ancient_opening_chooser_input:${openingDecision.reason}`;
          console.warn('[BotRunner] Ancient opening chooser input is invalid', {
            gameId: state?.gameId,
            playerId: player.id,
            phaseKey,
            reason: openingDecision.reason,
          });
          events.push(createRunnerDebugEvent(player.id, reason, phaseKey));
          continue;
        }

        if (openingDecision.kind === 'selected') {
          controller.chosenPlanId = openingDecision.strategyId;
          console.info('[BotRunner] Ancient strategy metadata resolved', {
            gameId: state?.gameId,
            playerId: player.id,
            phaseKey,
            family: openingDecision.family,
            strategyId: openingDecision.strategyId,
          });
          events.push(createRunnerDebugEvent(
            player.id,
            'ancient_strategy_resolved_phase_17a_stop',
            phaseKey,
          ));
          continue;
        }

        const requesterPrelude = projectDrawingPreludeRequesterSummary(
          state,
          player.id,
        );
        if (!requesterPrelude) {
          botIntent = { debugReason: 'invalid_drawing_prelude_state' };
        } else if (requesterPrelude.status !== 'complete') {
          botIntent = {
            debugReason: 'ancient_strategy_save_waiting_for_drawing_prelude',
          };
        } else {
          botIntent = {
            gameId: state.gameId,
            intentType: 'BUILD_SUBMIT',
            turnNumber: state?.gameData?.turnNumber ?? 0,
            payload: { builds: [] },
            nonce: buildBotNonce({
              state,
              phaseKey,
              loopStep: botStepsApplied,
              playerId: player.id,
              intentType: 'BUILD_SUBMIT',
            }),
          };
        }
      } else {
        botIntent = buildBotIntent({
          state,
          playerId: player.id,
          phaseKey,
          loopStep: botStepsApplied,
        });
      }

      if (!botIntent) {
        continue;
      }

      if ('debugReason' in botIntent) {
        console.warn('[BotRunner] Skipping bot seat', {
          gameId: state?.gameId,
          playerId: player.id,
          phaseKey,
          reason: botIntent.debugReason,
        });
        events.push(createRunnerDebugEvent(player.id, botIntent.debugReason, phaseKey));
        continue;
      }

      const result = await applyIntent(state, player.id, botIntent, args.nowMs);

      if (!result.ok) {
        console.warn('[BotRunner] Bot intent rejected', {
          gameId: state?.gameId,
          playerId: player.id,
          phaseKey,
          intentType: botIntent.intentType,
          rejected: result.rejected,
        });
        events.push(
          createRejectedDebugEvent(
            player.id,
            phaseKey,
            botIntent.intentType,
            result.rejected,
          ),
        );
        continue;
      }

      state = result.state;
      events.push(...result.events);
      botStepsApplied += 1;
      actionAppliedThisPass = true;
      break;
    }

    if (!actionAppliedThisPass) {
      break;
    }
  }

  if (botStepsApplied >= MAX_BOT_STEPS_PER_REQUEST) {
    events.push({
      type: 'BOT_RUNNER_LIMIT_REACHED',
      maxBotSteps: MAX_BOT_STEPS_PER_REQUEST,
      phaseKey: getPhaseKey(state),
    });
  }

  return {
    state,
    events,
    botStepsApplied,
  };
}
