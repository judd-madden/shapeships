import assert from 'node:assert/strict';
import { runBotsUntilSettled } from '../../../engine/bot/botRunner.ts';
import { applyIntent } from '../../../engine/intent/IntentReducer.ts';
import { getAncientBotStrategyById } from '../../../engine/bot/ancientPlans.ts';

export type AncientAcceptedIntentTrace = {
  phaseBefore: string;
  acceptedCount: number;
  eventTypes: string[];
};

export type AncientHarnessResult = {
  state: any;
  events: any[];
  debugEvents: any[];
  acceptedIntentTrace: AncientAcceptedIntentTrace[];
  botStepsByInvocation: number[];
  maxBotStepsObserved: number;
  phaseTrace: string[];
  repeatedPhaseSignatures: string[];
};

function phaseKey(state: any): string {
  return `${state?.gameData?.currentPhase ?? 'unknown'}.${
    state?.gameData?.currentSubPhase ?? 'unknown'
  }`;
}

function playerIsReady(state: any, playerId: string): boolean {
  const current = phaseKey(state);
  return (state?.gameData?.phaseReadiness ?? []).some((entry: any) =>
    entry?.playerId === playerId &&
    entry?.currentStep === current &&
    entry?.isReady === true
  );
}

async function drivePlayerControlledSeat(args: {
  state: any;
  playerId: string;
  nowMs: number;
}): Promise<any> {
  const { state, playerId, nowMs } = args;
  const current = phaseKey(state);
  const phaseHold = state?.gameData?.turnData?.phaseHold;
  if (phaseHold?.phaseKey === current) {
    const holdUntilMs = Number.isFinite(phaseHold.holdUntilMs)
      ? phaseHold.holdUntilMs
      : nowMs;
    const continued = await applyIntent(state, playerId, {
      gameId: state.gameId,
      intentType: 'CONTINUE_PHASE_HOLD',
      turnNumber: state.gameData.turnNumber,
      nonce: `harness:${state.gameId}:${state.gameData.turnNumber}:${current}:${playerId}:continue`,
    }, Math.max(nowMs, holdUntilMs));
    assert.equal(
      continued.ok,
      true,
      `Player-controlled phase continuation rejected in ${current}`,
    );
    return continued.state;
  }
  if (playerIsReady(state, playerId)) return state;

  const intent = current === 'build.drawing'
    ? {
      gameId: state.gameId,
      intentType: 'BUILD_SUBMIT' as const,
      turnNumber: state.gameData.turnNumber,
      payload: { builds: [] },
      nonce: `harness:${state.gameId}:${state.gameData.turnNumber}:${current}:${playerId}:build`,
    }
    : {
      gameId: state.gameId,
      intentType: 'DECLARE_READY' as const,
      turnNumber: state.gameData.turnNumber,
      nonce: `harness:${state.gameId}:${state.gameData.turnNumber}:${current}:${playerId}:ready`,
    };
  const applied = await applyIntent(state, playerId, intent, nowMs);
  assert.equal(
    applied.ok,
    true,
    `Player-controlled harness intent rejected in ${current}: ${applied.rejected?.code} ${applied.rejected?.message}`,
  );
  return applied.state;
}

export async function runAncientHarness(args: {
  state: any;
  strategyId: string;
  playerId?: string;
  maxIterations?: number;
  deterministicD6Bytes?: readonly number[];
  stopWhen: (state: any) => boolean;
}): Promise<AncientHarnessResult> {
  if (args.deterministicD6Bytes) {
    return await withDeterministicD6Bytes(
      args.deterministicD6Bytes,
      () => runAncientHarness({ ...args, deterministicD6Bytes: undefined }),
    );
  }
  assert.ok(
    getAncientBotStrategyById(args.strategyId),
    `Harness strategy is not registered: ${args.strategyId}`,
  );
  assert.equal(
    args.state?.controllersByPlayerId?.bot?.chosenPlanId,
    args.strategyId,
    'Harness checkpoint must already contain the chosen production strategy',
  );
  const playerId = args.playerId ?? 'player';
  const maxIterations = args.maxIterations ?? 40;
  let state = args.state;
  const events: any[] = [];
  const acceptedIntentTrace: AncientAcceptedIntentTrace[] = [];
  const botStepsByInvocation: number[] = [];
  const phaseTrace: string[] = [];
  const repeatedPhaseSignatures: string[] = [];
  const repeatedSignatures = new Map<string, number>();

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (state?.status === 'finished' || args.stopWhen(state)) {
      return {
        state,
        events,
        debugEvents: events.filter((event: any) =>
          typeof event?.type === 'string' && event.type.startsWith('BOT_')
        ),
        acceptedIntentTrace,
        botStepsByInvocation,
        maxBotStepsObserved: Math.max(0, ...botStepsByInvocation),
        phaseTrace,
        repeatedPhaseSignatures,
      };
    }

    const beforeSignature = JSON.stringify({
      turn: state?.gameData?.turnNumber,
      phase: phaseKey(state),
      readiness: state?.gameData?.phaseReadiness,
      commitments: state?.gameData?.turnData?.commitments,
      chosenPlanId: state?.controllersByPlayerId?.bot?.chosenPlanId,
    });
    phaseTrace.push(phaseKey(state));

    const botResult = await runBotsUntilSettled({
      state,
      nowMs: 10_000 + iteration * 2,
    });
    state = botResult.state;
    events.push(...botResult.events);
    botStepsByInvocation.push(botResult.botStepsApplied);
    acceptedIntentTrace.push({
      phaseBefore: phaseTrace.at(-1)!,
      acceptedCount: botResult.botStepsApplied,
      eventTypes: botResult.events.map((event: any) => String(event?.type)),
    });
    assert.equal(
      botResult.events.some((event: any) => event.type === 'BOT_INTENT_REJECTED'),
      false,
    );

    if (state?.status === 'finished' || args.stopWhen(state)) continue;

    const afterBotSignature = JSON.stringify({
      turn: state?.gameData?.turnNumber,
      phase: phaseKey(state),
      readiness: state?.gameData?.phaseReadiness,
      commitments: state?.gameData?.turnData?.commitments,
      chosenPlanId: state?.controllersByPlayerId?.bot?.chosenPlanId,
    });
    state = await drivePlayerControlledSeat({
      state,
      playerId,
      nowMs: 10_001 + iteration * 2,
    });
    const afterPlayerSignature = JSON.stringify({
      turn: state?.gameData?.turnNumber,
      phase: phaseKey(state),
      readiness: state?.gameData?.phaseReadiness,
      commitments: state?.gameData?.turnData?.commitments,
      chosenPlanId: state?.controllersByPlayerId?.bot?.chosenPlanId,
    });

    const signature = `${beforeSignature}|${afterBotSignature}|${afterPlayerSignature}`;
    repeatedPhaseSignatures.push(signature);
    const seen = (repeatedSignatures.get(signature) ?? 0) + 1;
    repeatedSignatures.set(signature, seen);
    assert.equal(
      seen < 3,
      true,
      `Harness repeated without settlement in ${phaseKey(state)}: ${JSON.stringify({
        phaseHold: state?.gameData?.turnData?.phaseHold,
        readiness: state?.gameData?.phaseReadiness,
      })}`,
    );
  }

  assert.fail(`Ancient harness exceeded ${maxIterations} iterations in ${phaseKey(state)}`);
}

export async function withDeterministicD6Bytes<T>(
  bytes: readonly number[],
  run: () => Promise<T>,
): Promise<T> {
  const queue = [...bytes];
  const originalFunction = crypto.getRandomValues;
  const originalOwnDescriptor = Object.getOwnPropertyDescriptor(
    crypto,
    'getRandomValues',
  );
  Object.defineProperty(crypto, 'getRandomValues', {
    configurable: true,
    value: (array: ArrayBufferView): ArrayBufferView => {
      if (
        array instanceof Uint8Array &&
        array.byteLength === 1 &&
        queue.length > 0
      ) {
        array[0] = queue.shift()!;
        return array;
      }
      return originalFunction.call(crypto, array) as ArrayBufferView;
    },
  });
  try {
    const result = await run();
    assert.deepEqual(queue, [], 'Not all deterministic D6 bytes were consumed');
    return result;
  } finally {
    if (originalOwnDescriptor) {
      Object.defineProperty(crypto, 'getRandomValues', originalOwnDescriptor);
    } else {
      Reflect.deleteProperty(crypto, 'getRandomValues');
    }
    assert.equal(crypto.getRandomValues, originalFunction);
  }
}
