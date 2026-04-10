import { applyIntent, type IntentRequest } from '../intent/IntentReducer.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getHumanBotPlanById } from './humanPlans.ts';
import { planHumanBuildSubmit } from './buildPlanner.ts';

const MAX_BOT_STEPS_PER_REQUEST = 8;

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
    if (typeof controller.chosenPlanId !== 'string' || controller.chosenPlanId.length === 0) {
      return { debugReason: 'missing_chosen_plan_id' };
    }

    const plan = getHumanBotPlanById(controller.chosenPlanId);
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
