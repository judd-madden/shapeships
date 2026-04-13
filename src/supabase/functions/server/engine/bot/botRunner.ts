import { applyIntent, type IntentRequest } from '../intent/IntentReducer.ts';
import type { BuildSubmitPayload } from '../intent/IntentTypes.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import { getValidDestroyTargets } from '../../engine_shared/resolve/destroyRules.ts';
import { getHumanBotPlanById } from './humanPlans.ts';
import { planHumanBuildSubmit } from './buildPlanner.ts';
import type {
  AuthoredBotPlan,
  CarrierChoiceId,
  FrigateTriggerPolicy,
  InterceptorChoiceId,
} from './botTypes.ts';

const MAX_BOT_STEPS_PER_REQUEST = 8;
const CARRIER_ACTION_ID = 'CAR#0';
const INTERCEPTOR_ACTION_ID = 'INT#0';
const GUARDIAN_SHIP_DEF_ID = 'GUA';
const GUARDIAN_PHASE_KEY = 'battle.first_strike';

function getShipsThatBuildPassIndex(state: any): 1 | 2 {
  return state?.gameData?.turnData?.shipsThatBuildPassIndex === 2 ? 2 : 1;
}

function getChronoswarmCountForPlayer(state: any, playerId: string): number {
  const raw = state?.gameData?.turnData?.chronoswarmCountByPlayerId?.[playerId];
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
}

function playerParticipatesInShipsThatBuildPass(state: any, playerId: string): boolean {
  const passIndex = getShipsThatBuildPassIndex(state);
  return passIndex === 1 || getChronoswarmCountForPlayer(state, playerId) > 0;
}

function shipAlreadyUsedInShipsThatBuildPass(state: any, sourceInstanceId: string): boolean {
  const passIndex = getShipsThatBuildPassIndex(state);
  return state?.gameData?.turnData?.shipsThatBuildPassUsageByInstanceId?.[sourceInstanceId]?.[passIndex] === true;
}

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

function resolveHumanBotPlan(controller: any): AuthoredBotPlan | null | { debugReason: string } {
  if (typeof controller?.chosenPlanId !== 'string' || controller.chosenPlanId.length === 0) {
    return { debugReason: 'missing_chosen_plan_id' };
  }

  const plan = getHumanBotPlanById(controller.chosenPlanId);
  if (!plan) {
    return { debugReason: 'missing_matching_plan' };
  }

  return plan;
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

function isInterceptorChoiceId(value: unknown): value is InterceptorChoiceId {
  return value === 'damage' || value === 'heal';
}

function getTargetedChoiceEffect(option: any): any | null {
  return option?.effects?.find(
    (effect: any) =>
      effect?.kind === EffectKind.Destroy ||
      effect?.kind === EffectKind.TransferShip
  ) ?? null;
}

function shouldApplyOpponentSacProtectionForTargetedEffect(effect: any): boolean {
  return effect?.kind !== EffectKind.TransferShip;
}

function isStructuredChoicePowerAvailableForShip(
  state: any,
  ship: any,
  actionId: string,
  power: any,
): boolean {
  if (power?.onceOnly === 'on_build_turn') {
    const currentTurnNumber: number = state?.gameData?.turnNumber ?? 1;
    if (ship?.createdTurn !== currentTurnNumber) {
      return false;
    }
  }

  if (power?.onceOnly) {
    const onceOnlyFired = state?.gameData?.powerMemory?.onceOnlyFired ?? {};
    if (onceOnlyFired[`${ship.instanceId}::${actionId}`] === true) {
      return false;
    }
  }

  const actionRequiresCharge =
    (power?.requiresCharge ?? false) ||
    (Array.isArray(power?.options) &&
      power.options.some((option: any) => (option?.requiresCharge ?? false) === true));

  if (!actionRequiresCharge) {
    return true;
  }

  const turnNumber: number = state?.gameData?.turnNumber ?? 1;
  const usedMap: Record<string, number> =
    state?.gameData?.turnData?.chargePowerUsedByInstanceId ?? {};

  return usedMap[ship.instanceId] !== turnNumber;
}

function hasEnoughChargeForChoice(ship: any, power: any, choiceId: string): boolean {
  const option = power?.options?.find((candidate: any) => candidate?.choiceId === choiceId);
  if (!option) {
    return false;
  }

  const requiresCharge = (option?.requiresCharge ?? false) || (power?.requiresCharge ?? false);
  if (!requiresCharge) {
    return true;
  }

  const chargeCost = option?.chargeCost ?? power?.chargeCost ?? 1;
  return Number(ship?.chargesCurrent ?? 0) >= chargeCost;
}

function getGuardianFirstStrikePower():
  | {
      actionId: string;
      choiceId: string;
      power: any;
      targetedEffect: any;
    }
  | null {
  const guardianDef = getShipDefinition(GUARDIAN_SHIP_DEF_ID);
  const structuredPowers = guardianDef?.structuredPowers;
  if (!Array.isArray(structuredPowers)) {
    return null;
  }

  for (let powerIndex = 0; powerIndex < structuredPowers.length; powerIndex += 1) {
    const power = structuredPowers[powerIndex];
    if (power?.type !== 'choice') {
      continue;
    }

    if (!Array.isArray(power?.options) || !power.timings?.includes(GUARDIAN_PHASE_KEY)) {
      continue;
    }

    const targetedOption = power.options.find((option: any) => {
      const targetedEffect = getTargetedChoiceEffect(option);
      return targetedEffect?.kind === EffectKind.Destroy;
    });
    const choiceId = targetedOption?.choiceId;
    const targetedEffect = getTargetedChoiceEffect(targetedOption);

    if (typeof choiceId !== 'string' || choiceId.length === 0 || !targetedEffect) {
      continue;
    }

    return {
      actionId: `${GUARDIAN_SHIP_DEF_ID}#${powerIndex}`,
      choiceId,
      power,
      targetedEffect,
    };
  }

  return null;
}

function getLiveShipChargesCurrent(
  state: any,
  ownerPlayerId: string,
  instanceId: string,
): number {
  const fleet = state?.gameData?.ships?.[ownerPlayerId] ?? [];
  if (!Array.isArray(fleet)) {
    return 0;
  }

  const ship = fleet.find((candidate: any) => candidate?.instanceId === instanceId);
  return Number(ship?.chargesCurrent ?? 0);
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

function getCarrierShipsThatBuildPower(): any | null {
  const [, powerIndexRaw] = CARRIER_ACTION_ID.split('#');
  const powerIndex = Number(powerIndexRaw);
  if (!Number.isInteger(powerIndex) || powerIndex < 0) {
    return null;
  }

  const carrierDef = getShipDefinition('CAR');
  const power = carrierDef?.structuredPowers?.[powerIndex];

  if (!power || power.type !== 'choice') {
    return null;
  }

  if (!Array.isArray(power.options) || !power.timings?.includes('build.ships_that_build')) {
    return null;
  }

  return power;
}

function getInterceptorChargeDeclarationPower(): any | null {
  const [, powerIndexRaw] = INTERCEPTOR_ACTION_ID.split('#');
  const powerIndex = Number(powerIndexRaw);
  if (!Number.isInteger(powerIndex) || powerIndex < 0) {
    return null;
  }

  const interceptorDef = getShipDefinition('INT');
  const power = interceptorDef?.structuredPowers?.[powerIndex];

  if (!power || power.type !== 'choice') {
    return null;
  }

  if (!Array.isArray(power.options) || !power.timings?.includes('battle.charge_declaration')) {
    return null;
  }

  return power;
}

function getLegalCarrierChoiceIdsForShip(ship: any): Array<Exclude<CarrierChoiceId, 'hold'>> {
  const carrierPower = getCarrierShipsThatBuildPower();
  if (!carrierPower) {
    return [];
  }

  const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
  const legalChoiceIds: Array<Exclude<CarrierChoiceId, 'hold'>> = [];

  for (const option of carrierPower.options) {
    const choiceId = option?.choiceId;
    if (!isCarrierChoiceId(choiceId) || choiceId === 'hold') {
      continue;
    }

    const requiresCharge = (option?.requiresCharge ?? false) || (carrierPower.requiresCharge ?? false);
    if (!requiresCharge) {
      legalChoiceIds.push(choiceId);
      continue;
    }

    const chargeCost = option?.chargeCost ?? carrierPower.chargeCost ?? 1;
    if (chargesCurrent >= chargeCost) {
      legalChoiceIds.push(choiceId);
    }
  }

  return legalChoiceIds;
}

function getChargeDeclarationEligibleSourceIds(state: any, playerId: string): string[] {
  const rawSourceIds = state?.gameData?.turnData?.chargeDeclarationEligibleSourceIdsByPlayerId?.[playerId];
  if (!Array.isArray(rawSourceIds)) {
    return [];
  }

  const sourceIds: string[] = [];
  const seen = new Set<string>();

  for (const sourceId of rawSourceIds) {
    if (typeof sourceId !== 'string' || sourceId.length === 0 || seen.has(sourceId)) {
      continue;
    }

    seen.add(sourceId);
    sourceIds.push(sourceId);
  }

  return sourceIds;
}

function getLegalInterceptorChoiceIdsForShip(ship: any): InterceptorChoiceId[] {
  const interceptorPower = getInterceptorChargeDeclarationPower();
  if (!interceptorPower) {
    return [];
  }

  const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
  const legalChoiceIds: InterceptorChoiceId[] = [];

  for (const option of interceptorPower.options) {
    const choiceId = option?.choiceId;
    if (!isInterceptorChoiceId(choiceId)) {
      continue;
    }

    const requiresCharge = (option?.requiresCharge ?? false) || (interceptorPower.requiresCharge ?? false);
    if (!requiresCharge) {
      legalChoiceIds.push(choiceId);
      continue;
    }

    const chargeCost = option?.chargeCost ?? interceptorPower.chargeCost ?? 1;
    if (chargesCurrent >= chargeCost) {
      legalChoiceIds.push(choiceId);
    }
  }

  return legalChoiceIds;
}

function chooseInterceptorChoiceId(args: {
  state: any;
  playerId: string;
  plan: AuthoredBotPlan;
  legalChoiceIds: InterceptorChoiceId[];
}): InterceptorChoiceId | null {
  const { state, playerId, plan, legalChoiceIds } = args;
  const interceptorPolicy = plan?.chargePolicy?.INT;
  if (!interceptorPolicy || legalChoiceIds.length === 0) {
    return null;
  }

  const player = (state?.players ?? []).find((entry: any) => entry?.id === playerId);
  const opponent = (state?.players ?? []).find(
    (entry: any) => entry?.role === 'player' && entry?.id !== playerId,
  );
  const playerHealth = Number(player?.health ?? 0);
  const opponentHealth = Number(opponent?.health ?? 0);
  const legalChoiceIdSet = new Set<InterceptorChoiceId>(legalChoiceIds);

  if (
    typeof interceptorPolicy.healSelfAtOrBelow === 'number' &&
    playerHealth <= interceptorPolicy.healSelfAtOrBelow &&
    legalChoiceIdSet.has('heal')
  ) {
    return 'heal';
  }

  if (
    typeof interceptorPolicy.damageOpponentAtOrBelow === 'number' &&
    opponentHealth <= interceptorPolicy.damageOpponentAtOrBelow &&
    legalChoiceIdSet.has('damage')
  ) {
    return 'damage';
  }

  if (legalChoiceIdSet.has('damage')) {
    return 'damage';
  }

  if (legalChoiceIdSet.has('heal')) {
    return 'heal';
  }

  return null;
}

function chooseCarrierChoiceId(args: {
  state: any;
  playerId: string;
  plan: AuthoredBotPlan;
  legalChoiceIds: Array<Exclude<CarrierChoiceId, 'hold'>>;
}): Exclude<CarrierChoiceId, 'hold'> | null {
  const { state, playerId, plan, legalChoiceIds } = args;
  if (legalChoiceIds.length === 0) {
    return null;
  }

  const legalChoiceIdSet = new Set<Exclude<CarrierChoiceId, 'hold'>>(legalChoiceIds);
  const carrierPolicy = plan?.shipsThatBuild?.CAR;

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
  if (
    fallbackChoiceId &&
    fallbackChoiceId !== 'hold' &&
    legalChoiceIdSet.has(fallbackChoiceId)
  ) {
    return fallbackChoiceId;
  }

  return legalChoiceIds[0] ?? null;
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
  if (knownTriggers.length === 0 && policy.firstChoiceMode === 'match_current_roll') {
    return currentRoll;
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

function buildInterceptorIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  if (phaseKey !== 'battle.charge_declaration' || !plan?.chargePolicy?.INT) {
    return null;
  }

  if (!getInterceptorChargeDeclarationPower()) {
    return null;
  }

  const eligibleSourceIds = getChargeDeclarationEligibleSourceIds(state, playerId);
  if (eligibleSourceIds.length === 0) {
    return null;
  }

  const eligibleSourceIdSet = new Set(eligibleSourceIds);
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  if (!Array.isArray(fleet)) {
    return null;
  }

  const interceptorShips = fleet
    .filter((ship: any) =>
      ship?.shipDefId === 'INT' &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0 &&
      eligibleSourceIdSet.has(ship.instanceId)
    )
    .sort((a: any, b: any) => a.instanceId.localeCompare(b.instanceId));

  for (const interceptorShip of interceptorShips) {
    const legalChoiceIds = getLegalInterceptorChoiceIdsForShip(interceptorShip);
    const choiceId = chooseInterceptorChoiceId({
      state,
      playerId,
      plan,
      legalChoiceIds,
    });

    if (!choiceId) {
      continue;
    }

    return {
      gameId: state.gameId,
      intentType: 'ACTION',
      turnNumber: state?.gameData?.turnNumber ?? 0,
      payload: {
        actionType: 'power',
        actionId: INTERCEPTOR_ACTION_ID,
        sourceInstanceId: interceptorShip.instanceId,
        choiceId,
      },
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'ACTION',
      }),
    };
  }

  return null;
}

function buildCarrierIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  if (!plan?.shipsThatBuild?.CAR) {
    return null;
  }

  if (!playerParticipatesInShipsThatBuildPass(state, playerId)) {
    return null;
  }

  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  if (!Array.isArray(fleet)) {
    return null;
  }

  const carrierShips = fleet
    .filter((ship: any) =>
      ship?.shipDefId === 'CAR' &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0 &&
      !shipAlreadyUsedInShipsThatBuildPass(state, ship.instanceId)
    )
    .sort((a: any, b: any) => a.instanceId.localeCompare(b.instanceId));

  for (const carrierShip of carrierShips) {
    const legalChoiceIds = getLegalCarrierChoiceIdsForShip(carrierShip);
    const choiceId = chooseCarrierChoiceId({
      state,
      playerId,
      plan,
      legalChoiceIds,
    });

    if (!choiceId) {
      continue;
    }

    return {
      gameId: state.gameId,
      intentType: 'ACTION',
      turnNumber: state?.gameData?.turnNumber ?? 0,
      payload: {
        actionType: 'power',
        actionId: CARRIER_ACTION_ID,
        sourceInstanceId: carrierShip.instanceId,
        choiceId,
      },
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'ACTION',
      }),
    };
  }

  return null;
}

function buildGuardianIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  if (phaseKey !== GUARDIAN_PHASE_KEY || plan?.targetPolicy?.GUA?.mode !== 'highest_cost_basic') {
    return null;
  }

  const guardianPower = getGuardianFirstStrikePower();
  if (!guardianPower) {
    return null;
  }

  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  if (!Array.isArray(fleet)) {
    return null;
  }

  const guardianShips = fleet
    .filter((ship: any) =>
      ship?.shipDefId === GUARDIAN_SHIP_DEF_ID &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0
    )
    .sort((a: any, b: any) => a.instanceId.localeCompare(b.instanceId));

  for (const guardianShip of guardianShips) {
    if (hasPendingFirstStrikeSelectionForSource(state, playerId, guardianShip.instanceId)) {
      continue;
    }

    if (!isStructuredChoicePowerAvailableForShip(
      state,
      guardianShip,
      guardianPower.actionId,
      guardianPower.power,
    )) {
      continue;
    }

    if (!hasEnoughChargeForChoice(guardianShip, guardianPower.power, guardianPower.choiceId)) {
      continue;
    }

    const validTargets = getValidDestroyTargets(state, {
      sourcePlayerId: playerId,
      targetScope:
        guardianPower.targetedEffect.targetPlayer === 'self' ? 'self' : 'opponent',
      restriction: guardianPower.targetedEffect.restriction ?? 'any',
      applyOpponentSacProtection:
        shouldApplyOpponentSacProtectionForTargetedEffect(guardianPower.targetedEffect),
    });

    if (validTargets.length === 0) {
      continue;
    }

    const rankedTargets = [...validTargets].sort((left, right) => {
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
        return rightCharges - leftCharges;
      }

      return left.instanceId.localeCompare(right.instanceId);
    });

    const chosenTarget = rankedTargets[0];
    if (!chosenTarget) {
      continue;
    }

    return {
      gameId: state.gameId,
      intentType: 'ACTION',
      turnNumber: state?.gameData?.turnNumber ?? 0,
      payload: {
        actionType: 'power',
        actionId: guardianPower.actionId,
        sourceInstanceId: guardianShip.instanceId,
        choiceId: guardianPower.choiceId,
        targetInstanceId: chosenTarget.instanceId,
      },
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'ACTION',
      }),
    };
  }

  return null;
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

  let plan: AuthoredBotPlan | null = null;
  if (
    phaseKey === 'build.drawing' ||
    phaseKey === 'build.ships_that_build' ||
    phaseKey === 'battle.charge_declaration' ||
    phaseKey === GUARDIAN_PHASE_KEY
  ) {
    const resolvedPlan = resolveHumanBotPlan(controller);
    if (!resolvedPlan) {
      return { debugReason: 'missing_matching_plan' };
    }
    if ('debugReason' in resolvedPlan) {
      return resolvedPlan;
    }
    plan = resolvedPlan;
  }

  if (phaseKey === 'setup.species_selection') {
    if (player.faction) {
      return null;
    }

    return {
      gameId: state.gameId,
      intentType: 'SPECIES_SUBMIT',
      turnNumber,
      payload: { species: 'human' },
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'SPECIES_SUBMIT',
      }),
    };
  }

  if (phaseKey === 'build.drawing') {
    if (!plan) {
      return { debugReason: 'missing_matching_plan' };
    }

    const buildSubmitPayload = appendFrigateTriggersToBuildSubmit({
      state,
      playerId,
      plan,
      payload: planHumanBuildSubmit(state, playerId, plan),
    });

    return {
      gameId: state.gameId,
      intentType: 'BUILD_SUBMIT',
      turnNumber,
      payload: buildSubmitPayload,
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'BUILD_SUBMIT',
      }),
    };
  }

  if (phaseKey === GUARDIAN_PHASE_KEY && plan) {
    const guardianIntent = buildGuardianIntentForCurrentPhase({
      state,
      playerId,
      phaseKey,
      loopStep,
      plan,
    });

    if (guardianIntent) {
      return guardianIntent;
    }
  }

  if (phaseKey === 'battle.charge_declaration' && plan) {
    const interceptorIntent = buildInterceptorIntentForCurrentPhase({
      state,
      playerId,
      phaseKey,
      loopStep,
      plan,
    });

    if (interceptorIntent) {
      return interceptorIntent;
    }
  }

  if (phaseKey === 'build.ships_that_build' && plan) {
    const carrierIntent = buildCarrierIntentForCurrentPhase({
      state,
      playerId,
      phaseKey,
      loopStep,
      plan,
    });

    if (carrierIntent) {
      return carrierIntent;
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

    let actionAppliedThisPass = false;

    for (const player of state?.players ?? []) {
      const controller = state?.controllersByPlayerId?.[player?.id];
      if (controller?.kind !== 'bot') continue;

      if (isPlayerReadyForPhase(state, player.id, phaseKey)) {
        continue;
      }

      const botIntent = buildBotIntent({
        state,
        playerId: player.id,
        phaseKey,
        loopStep: botStepsApplied,
      });

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
