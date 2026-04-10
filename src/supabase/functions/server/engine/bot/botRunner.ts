import { applyIntent, type IntentRequest } from '../intent/IntentReducer.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import { getHumanBotPlanById } from './humanPlans.ts';
import { planHumanBuildSubmit } from './buildPlanner.ts';
import type { AuthoredBotPlan, CarrierChoiceId } from './botTypes.ts';

const MAX_BOT_STEPS_PER_REQUEST = 8;
const CARRIER_ACTION_ID = 'CAR#0';

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
  if (phaseKey === 'build.drawing' || phaseKey === 'build.ships_that_build') {
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

    return {
      gameId: state.gameId,
      intentType: 'BUILD_SUBMIT',
      turnNumber,
      payload: planHumanBuildSubmit(state, playerId, plan),
      nonce: buildBotNonce({
        state,
        phaseKey,
        loopStep,
        playerId,
        intentType: 'BUILD_SUBMIT',
      }),
    };
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
