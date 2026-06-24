import { applyIntent, type IntentRequest } from '../intent/IntentReducer.ts';
import type {
  ActionsBatchPayload,
  BuildSubmitPayload,
  PowerActionPayload,
} from '../intent/IntentTypes.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import {
  getValidDestroyTargets,
  getValidShipOfEqualityTargets,
} from '../../engine_shared/resolve/destroyRules.ts';
import { getCentaurBotPlanById } from './centaurPlans.ts';
import { getHumanBotPlanById } from './humanPlans.ts';
import { getXeniteBotPlanById } from './xenitePlans.ts';
import { planBotBuildSubmit } from './buildPlanner.ts';
import type {
  AuthoredBotPlan,
  BotSpeciesId,
  CarrierChoiceId,
  DamageHealChargePhase,
  DamageHealChargePolicy,
  DamageHealChoiceId,
  FrigateTriggerPolicy,
} from './botTypes.ts';

const MAX_BOT_STEPS_PER_REQUEST = 8;
const CARRIER_ACTION_ID = 'CAR#0';
const FIRST_STRIKE_PHASE_KEY = 'battle.first_strike';
const DEFAULT_DAMAGE_HEAL_CHARGE_PHASES: DamageHealChargePhase[] = [
  'battle.charge_declaration',
];
const DEFAULT_MISSING_DAMAGE_HEAL_CHARGE_POLICY: DamageHealChargePolicy = {
  healSelfAtOrBelow: 14,
  damageOpponentAtOrBelow: 12,
  phases: ['battle.charge_declaration', 'battle.charge_response'],
};
const DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS = ['INT', 'ANT', 'WIS', 'FAM'] as const;
const FIRST_STRIKE_TARGET_SHIP_DEF_IDS = ['GUA', 'SAC', 'DOM'] as const;

type DamageHealChargeShipDefId = (typeof DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS)[number];
type FirstStrikeTargetShipDefId = (typeof FIRST_STRIKE_TARGET_SHIP_DEF_IDS)[number];
type KnoRerollPassIndex = 1 | 2 | 3;

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

function buildPowerIntentFromActions(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  actions: PowerActionPayload[];
  batchWhenMultiple?: boolean;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, actions } = args;
  if (actions.length === 0) {
    return null;
  }

  const turnNumber = state?.gameData?.turnNumber ?? 0;
  const batchWhenMultiple = args.batchWhenMultiple ?? true;

  if (actions.length === 1 || !batchWhenMultiple) {
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
  | null {
  switch (speciesId) {
    case 'HUM':
      return 'human';
    case 'XEN':
      return 'xenite';
    case 'CEN':
      return 'centaur';
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
    phaseKey === 'build.ships_that_build' ||
    phaseKey === 'battle.charge_declaration' ||
    phaseKey === 'battle.charge_response' ||
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

function isDamageHealChoiceId(value: unknown): value is DamageHealChoiceId {
  return value === 'damage' || value === 'heal';
}

function isDamageHealChargePhase(phaseKey: string): phaseKey is DamageHealChargePhase {
  return phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response';
}

function isDamageHealChargeShipDefId(value: string): value is DamageHealChargeShipDefId {
  return (DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS as readonly string[]).includes(value);
}

function isFirstStrikeTargetShipDefId(value: string): value is FirstStrikeTargetShipDefId {
  return (FIRST_STRIKE_TARGET_SHIP_DEF_IDS as readonly string[]).includes(value);
}

function getDamageHealChargePolicy(
  plan: AuthoredBotPlan,
  shipDefId: DamageHealChargeShipDefId,
): DamageHealChargePolicy | undefined {
  return plan?.chargePolicy?.[shipDefId];
}

function getDamageHealChargePolicyForOwnedShip(
  plan: AuthoredBotPlan,
  shipDefId: DamageHealChargeShipDefId,
): { policy: DamageHealChargePolicy; isDefaultPolicy: boolean } {
  const authoredPolicy = getDamageHealChargePolicy(plan, shipDefId);
  if (authoredPolicy) {
    return { policy: authoredPolicy, isDefaultPolicy: false };
  }

  return {
    policy: DEFAULT_MISSING_DAMAGE_HEAL_CHARGE_POLICY,
    isDefaultPolicy: true,
  };
}

function getEffectiveDamageHealChargePhases(
  policy: DamageHealChargePolicy,
): DamageHealChargePhase[] {
  if (!Array.isArray(policy.phases)) {
    return DEFAULT_DAMAGE_HEAL_CHARGE_PHASES;
  }

  return policy.phases.filter(isDamageHealChargePhase);
}

function damageHealChargePolicyAllowsPhase(
  policy: DamageHealChargePolicy,
  phaseKey: DamageHealChargePhase,
): boolean {
  return getEffectiveDamageHealChargePhases(policy).includes(phaseKey);
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

function getRequiredTargetCountForTargetedEffect(effect: any): number {
  const rawRequiredTargetCount =
    typeof effect?.requiredTargetCount === 'number'
      ? effect.requiredTargetCount
      : effect?.count;

  if (
    Number.isInteger(rawRequiredTargetCount) &&
    rawRequiredTargetCount > 0
  ) {
    return rawRequiredTargetCount;
  }

  return 1;
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

function getStructuredChoicePowerForShipDef(args: {
  shipDefId: string;
  phaseKey: string;
  choiceIds?: string[];
  targetedEffectKind?: EffectKind.Destroy | EffectKind.TransferShip;
}):
  | {
      actionId: string;
      choiceId: string;
      power: any;
      option: any;
      targetedEffect: any | null;
    }
  | null {
  const { shipDefId, phaseKey, choiceIds, targetedEffectKind } = args;
  const shipDef = getShipDefinition(shipDefId);
  const structuredPowers = shipDef?.structuredPowers;
  if (!Array.isArray(structuredPowers)) {
    return null;
  }

  for (let powerIndex = 0; powerIndex < structuredPowers.length; powerIndex += 1) {
    const power = structuredPowers[powerIndex];
    if (power?.type !== 'choice') {
      continue;
    }

    if (
      !Array.isArray(power?.options) ||
      !(power.timings as readonly string[] | undefined)?.includes(phaseKey)
    ) {
      continue;
    }

    const option = power.options.find((candidate: any) => {
      const choiceId = candidate?.choiceId;
      if (typeof choiceId !== 'string' || choiceId.length === 0) {
        return false;
      }

      if (Array.isArray(choiceIds) && !choiceIds.includes(choiceId)) {
        return false;
      }

      const targetedEffect = getTargetedChoiceEffect(candidate);
      if (targetedEffectKind && targetedEffect?.kind !== targetedEffectKind) {
        return false;
      }

      return true;
    });
    const choiceId = option?.choiceId;
    const targetedEffect = getTargetedChoiceEffect(option);

    if (typeof choiceId !== 'string' || choiceId.length === 0) {
      continue;
    }

    return {
      actionId: `${shipDefId}#${powerIndex}`,
      choiceId,
      power,
      option,
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

function compareTargetsHighestTactical(state: any, left: any, right: any): number {
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

function getSnappedChargeSourceIds(state: any, playerId: string): string[] {
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

function resolveSnappedChargeSource(state: any, playerId: string, sourceInstanceId: string): any | null {
  const liveFleet = state?.gameData?.ships?.[playerId] ?? [];
  if (Array.isArray(liveFleet)) {
    const liveShip = liveFleet.find((ship: any) => ship?.instanceId === sourceInstanceId);
    if (liveShip) {
      return liveShip;
    }
  }

  const voidFleet = state?.gameData?.voidShipsByPlayerId?.[playerId] ?? [];
  if (Array.isArray(voidFleet)) {
    return voidFleet.find((ship: any) => ship?.instanceId === sourceInstanceId) ?? null;
  }

  return null;
}

function getChargeSourceShipsForPhase(
  state: any,
  playerId: string,
  phaseKey: DamageHealChargePhase,
): any[] {
  const sourceShips: any[] = [];

  for (const sourceInstanceId of getSnappedChargeSourceIds(state, playerId)) {
    const ship = resolveSnappedChargeSource(state, playerId, sourceInstanceId);
    if (!ship) {
      continue;
    }

    sourceShips.push(ship);
  }

  return sourceShips;
}

function getLegalDamageHealChoiceIdsForShip(ship: any, power: any): DamageHealChoiceId[] {
  if (!power) {
    return [];
  }

  const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
  const legalChoiceIds: DamageHealChoiceId[] = [];

  for (const option of power.options) {
    const choiceId = option?.choiceId;
    if (!isDamageHealChoiceId(choiceId)) {
      continue;
    }

    const requiresCharge = (option?.requiresCharge ?? false) || (power.requiresCharge ?? false);
    if (!requiresCharge) {
      legalChoiceIds.push(choiceId);
      continue;
    }

    const chargeCost = option?.chargeCost ?? power.chargeCost ?? 1;
    if (chargesCurrent >= chargeCost) {
      legalChoiceIds.push(choiceId);
    }
  }

  return legalChoiceIds;
}

function chooseDamageHealChoiceId(args: {
  state: any;
  playerId: string;
  policy: DamageHealChargePolicy;
  legalChoiceIds: DamageHealChoiceId[];
}): DamageHealChoiceId | null {
  const { state, playerId, policy, legalChoiceIds } = args;
  if (legalChoiceIds.length === 0) {
    return null;
  }

  const player = (state?.players ?? []).find((entry: any) => entry?.id === playerId);
  const opponent = (state?.players ?? []).find(
    (entry: any) => entry?.role === 'player' && entry?.id !== playerId,
  );
  const playerHealth = Number(player?.health ?? 0);
  const opponentHealth = Number(opponent?.health ?? 0);
  const legalChoiceIdSet = new Set<DamageHealChoiceId>(legalChoiceIds);

  if (
    typeof policy.healSelfAtOrBelow === 'number' &&
    playerHealth <= policy.healSelfAtOrBelow &&
    legalChoiceIdSet.has('heal')
  ) {
    return 'heal';
  }

  if (
    typeof policy.damageOpponentAtOrBelow === 'number' &&
    opponentHealth <= policy.damageOpponentAtOrBelow &&
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

function chooseDefaultCarrierChoiceId(args: {
  state: any;
  playerId: string;
  legalChoiceIds: Array<Exclude<CarrierChoiceId, 'hold'>>;
}): Exclude<CarrierChoiceId, 'hold'> | null {
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
  const legalChoiceIdSet = new Set<Exclude<CarrierChoiceId, 'hold'>>(legalChoiceIds);
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

  return null;
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

function buildDamageHealChargeIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;
  if (!isDamageHealChargePhase(phaseKey)) {
    return null;
  }

  const sourceShips = getChargeSourceShipsForPhase(state, playerId, phaseKey);
  if (sourceShips.length === 0) {
    return null;
  }

  const chargeShips = sourceShips
    .filter((ship: any) =>
      typeof ship?.shipDefId === 'string' &&
      isDamageHealChargeShipDefId(ship.shipDefId) &&
      typeof ship?.instanceId === 'string' &&
      ship.instanceId.length > 0
    )
    .sort((left: any, right: any) => {
      const leftOrder = DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS.indexOf(left.shipDefId);
      const rightOrder = DAMAGE_HEAL_CHARGE_SHIP_DEF_IDS.indexOf(right.shipDefId);
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.instanceId.localeCompare(right.instanceId);
    });

  const actions: PowerActionPayload[] = [];
  let usedDefaultDamageHealChargePolicy = false;

  for (const ship of chargeShips) {
    const { policy, isDefaultPolicy } = getDamageHealChargePolicyForOwnedShip(
      plan,
      ship.shipDefId,
    );
    if (!damageHealChargePolicyAllowsPhase(policy, phaseKey)) {
      continue;
    }

    const choicePower = getStructuredChoicePowerForShipDef({
      shipDefId: ship.shipDefId,
      phaseKey,
      choiceIds: ['damage', 'heal'],
    });
    if (!choicePower) {
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

    const legalChoiceIds = getLegalDamageHealChoiceIdsForShip(ship, choicePower.power);
    const choiceId = chooseDamageHealChoiceId({
      state,
      playerId,
      policy,
      legalChoiceIds,
    });

    if (!choiceId) {
      continue;
    }

    usedDefaultDamageHealChargePolicy ||= isDefaultPolicy;

    actions.push({
      actionType: 'power',
      actionId: choicePower.actionId,
      sourceInstanceId: ship.instanceId,
      choiceId,
    });
  }

  const legacyHumanIntOnly =
    phaseKey === 'battle.charge_declaration' &&
    actions.length > 0 &&
    actions.every((action) => action.actionId === 'INT#0') &&
    !usedDefaultDamageHealChargePolicy &&
    Object.keys(plan?.chargePolicy ?? {}).every((shipDefId) => shipDefId === 'INT') &&
    !Array.isArray(plan?.chargePolicy?.INT?.phases);

  return buildPowerIntentFromActions({
    state,
    playerId,
    phaseKey,
    loopStep,
    actions,
    batchWhenMultiple: !legacyHumanIntOnly,
  });
}

function buildCarrierIntentForCurrentPhase(args: {
  state: any;
  playerId: string;
  phaseKey: string;
  loopStep: number;
  plan: AuthoredBotPlan;
}): IntentRequest | null {
  const { state, playerId, phaseKey, loopStep, plan } = args;

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
    const choiceId = plan?.shipsThatBuild?.CAR
      ? chooseCarrierChoiceId({
          state,
          playerId,
          plan,
          legalChoiceIds,
        })
      : chooseDefaultCarrierChoiceId({
          state,
          playerId,
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

function buildFirstStrikeTargetIntentForCurrentPhase(args: {
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
  const reservedTargetIds = new Set<string>();

  for (const ship of sourceShips) {
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

    const validTargets = getValidDestroyTargets(state, {
      sourcePlayerId: playerId,
      targetScope:
        choicePower.targetedEffect.targetPlayer === 'self' ? 'self' : 'opponent',
      restriction: choicePower.targetedEffect.restriction ?? 'any',
      applyOpponentSacProtection:
        shouldApplyOpponentSacProtectionForTargetedEffect(choicePower.targetedEffect),
    }).filter((target) => !reservedTargetIds.has(target.instanceId));
    const requiredTargetCount = getRequiredTargetCountForTargetedEffect(
      choicePower.targetedEffect,
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
  if (
    !isDamageHealChargePhase(phaseKey) ||
    plan?.targetPolicy?.EQU?.mode !== 'highest_shared_cost_pair'
  ) {
    return null;
  }

  const sourceShips = getChargeSourceShipsForPhase(state, playerId, phaseKey)
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

    const { validOwnTargets, validOpponentTargets } = getValidShipOfEqualityTargets(
      state,
      playerId,
    );
    if (validOwnTargets.length === 0 || validOpponentTargets.length === 0) {
      continue;
    }

    const sharedCosts = new Set(validOwnTargets.map((target) => target.totalLineCost));
    const highestSharedCost = [...validOpponentTargets]
      .map((target) => target.totalLineCost)
      .filter((cost) => sharedCosts.has(cost))
      .sort((left, right) => right - left)[0];

    if (typeof highestSharedCost !== 'number') {
      continue;
    }

    const ownTarget = validOwnTargets
      .filter((target) => target.totalLineCost === highestSharedCost)
      .sort((left, right) => compareOwnEqualitySacrificeTargets(state, left, right))[0];
    const opponentTarget = validOpponentTargets
      .filter((target) => target.totalLineCost === highestSharedCost)
      .sort((left, right) => compareTargetsHighestTactical(state, left, right))[0];

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
  if (phaseKey !== 'build.dice_roll' || plan?.dicePolicy?.KNO?.mode !== 'reroll_odd_hold_even') {
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

  let plan: AuthoredBotPlan | null = null;
  if (isAuthoredBotPlanRequiredPhase(phaseKey)) {
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

  if (phaseKey === 'build.drawing') {
    if (!plan) {
      return { debugReason: 'missing_matching_plan' };
    }

    const buildSubmitPayload = appendFrigateTriggersToBuildSubmit({
      state,
      playerId,
      plan,
      payload: planBotBuildSubmit(state, playerId, plan),
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

  if (phaseKey === 'build.dice_roll' && plan) {
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

  if (
    (phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response') &&
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
