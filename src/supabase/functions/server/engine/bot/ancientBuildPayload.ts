import { getEffectiveDiceRollForPlayer } from '../../engine_shared/resolve/phaseComputedEffects.ts';
import type { BuildSubmitPayload } from '../intent/IntentTypes.ts';
import type { GameState } from '../state/GameStateTypes.ts';
import type { AuthoredBotPlan } from './botTypes.ts';

export type AncientBuildPayloadCompletionFailureReason =
  | 'invalid_build_payload'
  | 'invalid_quantum_mystic_build_count'
  | 'missing_quantum_mystic_policy'
  | 'invalid_effective_dice';

export type AncientBuildPayloadCompletionResult =
  | { ok: true; payload: BuildSubmitPayload }
  | { ok: false; reason: AncientBuildPayloadCompletionFailureReason };

function withoutQuantumMysticSelections(
  payload: BuildSubmitPayload,
): BuildSubmitPayload {
  if (!Object.prototype.hasOwnProperty.call(payload, 'quantumMysticSelections')) {
    return payload;
  }

  const nextPayload = { ...payload };
  delete nextPayload.quantumMysticSelections;
  return nextPayload;
}

export function completeAncientBuildSubmitPayload(args: {
  state: GameState;
  playerId: string;
  plan: AuthoredBotPlan;
  payload: BuildSubmitPayload;
}): AncientBuildPayloadCompletionResult {
  const { state, playerId, plan, payload } = args;
  if (!Array.isArray(payload?.builds)) {
    return { ok: false, reason: 'invalid_build_payload' };
  }

  let requestedQuantumMysticCount = 0;
  for (const build of payload.builds) {
    if (build?.shipDefId !== 'QUA') {
      continue;
    }
    if (!Number.isInteger(build.count) || build.count < 0) {
      return { ok: false, reason: 'invalid_quantum_mystic_build_count' };
    }

    requestedQuantumMysticCount += build.count;
  }

  if (requestedQuantumMysticCount === 0) {
    return {
      ok: true,
      payload: withoutQuantumMysticSelections(payload),
    };
  }

  const mode = plan?.quantumMysticPolicy?.QUA?.mode;
  if (mode !== 'fixed_6' && mode !== 'match_effective_dice') {
    return { ok: false, reason: 'missing_quantum_mystic_policy' };
  }

  let selectedNumber = 6;
  if (mode === 'match_effective_dice') {
    const effectiveDice = getEffectiveDiceRollForPlayer(state, playerId);
    if (
      typeof effectiveDice !== 'number' ||
      !Number.isInteger(effectiveDice) ||
      effectiveDice < 1 ||
      effectiveDice > 6
    ) {
      return { ok: false, reason: 'invalid_effective_dice' };
    }
    selectedNumber = effectiveDice;
  }

  return {
    ok: true,
    payload: {
      ...payload,
      quantumMysticSelections: Array.from(
        { length: requestedQuantumMysticCount },
        () => selectedNumber,
      ),
    },
  };
}
