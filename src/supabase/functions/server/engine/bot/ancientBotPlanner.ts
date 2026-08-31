import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import {
  getValidDestroyTargets,
  isCanonicalBasicOnlyTargetShip,
} from '../../engine_shared/resolve/destroyRules.ts';
import { BLACK_HOLE_SOLAR_COST } from '../ancient/blackHoleSolarPower.ts';
import { resolveSolarCastSequence } from '../ancient/manualSolarDeclaration.ts';
import { SIMULACRUM_SOLAR_RESOLVER } from '../ancient/simulacrumSolarPower.ts';
import {
  buildMonoColourAutocastCasts,
  PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
  SIPHON_MINIMUM_SPEND,
  SIPHON_SOLAR_RESOLVER,
  VORTEX_SOLAR_COST,
} from '../ancient/solarPowerResolvers.ts';
import {
  getAcceptedDeclarationForCurrentBattle,
  getChargeDeclarationBattleTurnNumber,
  getChargeDeclarationLegalityState,
  isAncientPlayer,
  playerRequiresChargeDeclarationInput,
} from '../intent/chargeDeclarationEligibility.ts';
import {
  CHARGE_DECLARATION_CONTRACT_VERSION,
  type ChargeDeclarationSubmitPayload,
  type SolarCastPayload,
} from '../intent/IntentTypes.ts';
import type { AncientEnergyPool } from '../state/GameStateTypes.ts';
import type {
  AncientBlackHoleBotPolicy,
  AncientSimulacrumActivationFleetGoal,
  AncientSimulacrumBotPolicy,
  AncientBotStrategy,
  AncientVortexBotPolicy,
} from './ancientPlans.ts';
import type { BotPlanProgress } from './botTypes.ts';
import { planDamageHealChargeActions } from './botPowerPlanning.ts';
import {
  compareTacticalTargetValues,
  compareTargetsHighestTactical,
} from './botTargeting.ts';

export type AncientChargeDeclarationNoInputReason =
  | 'invalid_phase'
  | 'invalid_strategy'
  | 'invalid_player'
  | 'invalid_game_id'
  | 'accepted_declaration_exists'
  | 'invalid_energy_state'
  | 'no_atomic_declaration_input'
  | 'invalid_legality_context'
  | 'invalid_solar_policy'
  | 'invalid_black_hole_policy'
  | 'invalid_vortex_policy'
  | 'invalid_simulacrum_policy'
  | 'invalid_simulacrum_progress'
  | 'invalid_player_health'
  | 'solar_evaluation_failed';

export type AncientChargeDeclarationPlanResult =
  | {
      kind: 'submit';
      payload: ChargeDeclarationSubmitPayload;
    }
  | {
      kind: 'no_input';
      reason: AncientChargeDeclarationNoInputReason;
    };

type ValidatedSolarPolicy = {
  blackHole?: AncientBlackHoleBotPolicy;
  vortex?: AncientVortexBotPolicy;
  simulacrum?: AncientSimulacrumBotPolicy;
};

type SimulacrumCandidate = {
  targetInstanceId: string;
  shipDefId: string;
  totalLineCost: number;
  chargesCurrent: number;
  hasChargeMechanic: boolean;
};

const ENERGY_COLOURS = ['green', 'red', 'blue'] as const;

function getPhaseKey(state: any): string | null {
  const major = state?.gameData?.currentPhase;
  const sub = state?.gameData?.currentSubPhase;
  return typeof major === 'string' && typeof sub === 'string'
    ? `${major}.${sub}`
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function validateSimulacrumActivationFleetGoal(
  value: unknown,
): AncientSimulacrumActivationFleetGoal | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['shipDefId', 'targetCount']) ||
    typeof value.shipDefId !== 'string' ||
    value.shipDefId.length === 0 ||
    !isPositiveSafeInteger(value.targetCount)
  ) {
    return null;
  }
  return {
    shipDefId: value.shipDefId,
    targetCount: value.targetCount,
  };
}

function validateSolarPolicy(
  strategy: AncientBotStrategy,
):
  | { ok: true; policy: ValidatedSolarPolicy }
  | { ok: false; reason: AncientChargeDeclarationNoInputReason } {
  const rawPolicy = strategy.solarPolicy;
  if (typeof rawPolicy === 'undefined') {
    return { ok: true, policy: {} };
  }
  if (
    !isRecord(rawPolicy) ||
    !hasOnlyKeys(rawPolicy, ['blackHole', 'vortex', 'simulacrum'])
  ) {
    return { ok: false, reason: 'invalid_solar_policy' };
  }

  let blackHole: AncientBlackHoleBotPolicy | undefined;
  if (typeof rawPolicy.blackHole !== 'undefined') {
    const candidate = rawPolicy.blackHole;
    if (
      !isRecord(candidate) ||
      !hasOnlyKeys(candidate, ['minSelfHealth', 'maxCastsPerDeclaration']) ||
      !isNonNegativeSafeInteger(candidate.minSelfHealth) ||
      !(
        candidate.maxCastsPerDeclaration === 'uncapped' ||
        isPositiveSafeInteger(candidate.maxCastsPerDeclaration)
      )
    ) {
      return { ok: false, reason: 'invalid_black_hole_policy' };
    }
    blackHole = {
      minSelfHealth: candidate.minSelfHealth,
      maxCastsPerDeclaration: candidate.maxCastsPerDeclaration,
    };
  }

  let vortex: AncientVortexBotPolicy | undefined;
  if (typeof rawPolicy.vortex !== 'undefined') {
    const candidate = rawPolicy.vortex;
    if (
      !isRecord(candidate) ||
      !hasOnlyKeys(candidate, ['maxCastsPerDeclaration']) ||
      !(
        candidate.maxCastsPerDeclaration === 'uncapped' ||
        isPositiveSafeInteger(candidate.maxCastsPerDeclaration)
      )
    ) {
      return { ok: false, reason: 'invalid_vortex_policy' };
    }
    vortex = {
      maxCastsPerDeclaration: candidate.maxCastsPerDeclaration,
    };
  }

  let simulacrum: AncientSimulacrumBotPolicy | undefined;
  if (typeof rawPolicy.simulacrum !== 'undefined') {
    const candidate = rawPolicy.simulacrum;
    if (!isRecord(candidate) || typeof candidate.mode !== 'string') {
      return { ok: false, reason: 'invalid_simulacrum_policy' };
    }
    const activationFleetGoal = typeof candidate.activationFleetGoal ===
        'undefined'
      ? undefined
      : validateSimulacrumActivationFleetGoal(
        candidate.activationFleetGoal,
      );
    if (
      typeof candidate.activationFleetGoal !== 'undefined' &&
      !activationFleetGoal
    ) {
      return { ok: false, reason: 'invalid_simulacrum_policy' };
    }

    if (candidate.mode === 'staged_cost_goals') {
      if (
        !hasOnlyKeys(candidate, [
          'mode',
          'costGoals',
          'activationFleetGoal',
        ]) ||
        !Array.isArray(candidate.costGoals) ||
        candidate.costGoals.length === 0 ||
        !candidate.costGoals.every(isPositiveSafeInteger)
      ) {
        return { ok: false, reason: 'invalid_simulacrum_policy' };
      }
      simulacrum = {
        mode: 'staged_cost_goals',
        costGoals: [...candidate.costGoals],
        ...(activationFleetGoal ? { activationFleetGoal } : {}),
      };
    } else if (candidate.mode === 'highest_value_highest_charge') {
      if (
        !hasOnlyKeys(candidate, [
          'mode',
          'maxCastsPerDeclaration',
          'excludeDepletedChargedTargets',
          'activationFleetGoal',
        ]) ||
        !(
          candidate.maxCastsPerDeclaration === 'while_legal_affordable' ||
          isPositiveSafeInteger(candidate.maxCastsPerDeclaration)
        ) ||
        candidate.excludeDepletedChargedTargets !== true
      ) {
        return { ok: false, reason: 'invalid_simulacrum_policy' };
      }
      simulacrum = {
        mode: 'highest_value_highest_charge',
        maxCastsPerDeclaration: candidate.maxCastsPerDeclaration,
        excludeDepletedChargedTargets: true,
        ...(activationFleetGoal ? { activationFleetGoal } : {}),
      };
    } else {
      return { ok: false, reason: 'invalid_simulacrum_policy' };
    }
  }

  return {
    ok: true,
    policy: {
      ...(blackHole ? { blackHole } : {}),
      ...(vortex ? { vortex } : {}),
      ...(simulacrum ? { simulacrum } : {}),
    },
  };
}

function getStagedCompletedGoalCount(args: {
  strategy: AncientBotStrategy;
  policy: Extract<AncientSimulacrumBotPolicy, { mode: 'staged_cost_goals' }>;
  planProgress?: BotPlanProgress;
}): number | null {
  const progress = args.planProgress?.simulacrum;
  if (typeof progress === 'undefined') return 0;
  if (
    !isRecord(progress) ||
    !hasOnlyKeys(progress, [
      'strategyId',
      'completedGoalCount',
      'openingComplete',
    ]) ||
    progress.strategyId !== args.strategy.id ||
    !isNonNegativeSafeInteger(progress.completedGoalCount) ||
    progress.completedGoalCount > args.policy.costGoals.length ||
    progress.openingComplete !==
      (progress.completedGoalCount === args.policy.costGoals.length)
  ) {
    return null;
  }
  return progress.completedGoalCount;
}

function getOpponentSnapshotCandidates(args: {
  state: any;
  playerId: string;
}): SimulacrumCandidate[] {
  const opponent = (args.state?.players ?? []).find((candidate: any) =>
    candidate?.role === 'player' && candidate?.id !== args.playerId
  );
  if (typeof opponent?.id !== 'string') return [];
  const snapshot = args.state?.gameData?.turnData
    ?.chargeDeclarationFleetSnapshotByPlayerId?.[opponent.id];
  if (!Array.isArray(snapshot)) return [];

  const candidates: SimulacrumCandidate[] = [];
  for (const ship of snapshot) {
    if (
      typeof ship?.instanceId !== 'string' ||
      typeof ship?.shipDefId !== 'string' ||
      !isCanonicalBasicOnlyTargetShip(ship.shipDefId)
    ) {
      continue;
    }
    const definition = getShipById(ship.shipDefId);
    if (
      !definition ||
      !isPositiveSafeInteger(definition.totalLineCost)
    ) {
      continue;
    }
    const hasChargeMechanic = typeof definition.charges === 'number' &&
      Number.isFinite(definition.charges);
    candidates.push({
      targetInstanceId: ship.instanceId,
      shipDefId: ship.shipDefId,
      totalLineCost: definition.totalLineCost,
      chargesCurrent: isNonNegativeSafeInteger(ship.chargesCurrent)
        ? ship.chargesCurrent
        : 0,
      hasChargeMechanic,
    });
  }
  return candidates;
}

function isSimulacrumActivationFleetGoalSatisfied(args: {
  state: any;
  playerId: string;
  policy: AncientSimulacrumBotPolicy;
}): boolean {
  const goal = args.policy.activationFleetGoal;
  if (!goal) return true;
  const snapshot = args.state?.gameData?.turnData
    ?.chargeDeclarationFleetSnapshotByPlayerId?.[args.playerId];
  if (!Array.isArray(snapshot)) return false;
  let matchingCount = 0;
  for (const ship of snapshot) {
    if (ship?.shipDefId !== goal.shipDefId) continue;
    matchingCount += 1;
    if (matchingCount >= goal.targetCount) return true;
  }
  return false;
}

function compareSimulacrumCandidates(
  left: SimulacrumCandidate,
  right: SimulacrumCandidate,
): number {
  return compareTacticalTargetValues(
    {
      totalLineCost: left.totalLineCost,
      chargesCurrent: left.chargesCurrent,
      instanceId: left.targetInstanceId,
    },
    {
      totalLineCost: right.totalLineCost,
      chargesCurrent: right.chargesCurrent,
      instanceId: right.targetInstanceId,
    },
  );
}

function trialSimulacrumCandidate(args: {
  state: any;
  playerId: string;
  declarationId: string;
  battleTurnNumber: number;
  energy: AncientEnergyPool;
  candidate: SimulacrumCandidate;
  castIndex: number;
}): ReturnType<typeof resolveSolarCastSequence> | null {
  try {
    return resolveSolarCastSequence({
      state: args.state,
      playerId: args.playerId,
      declarationId: args.declarationId,
      battleTurnNumber: args.battleTurnNumber,
      initialEnergy: args.energy,
      casts: [{
        solarPowerId: 'SSIM',
        targetInstanceId: args.candidate.targetInstanceId,
      }],
      resolvers: { SSIM: SIMULACRUM_SOLAR_RESOLVER },
      sourceMode: 'manual',
      initialLedgerOrder: args.castIndex,
      initialCastIndex: args.castIndex,
    });
  } catch {
    return null;
  }
}

function readCurrentEnergy(args: {
  state: any;
  playerId: string;
  battleTurnNumber: number;
}): AncientEnergyPool | null {
  const energyState =
    args.state?.gameData?.ancient?.energyByPlayerId?.[args.playerId];
  if (
    !isRecord(energyState) ||
    energyState.battleTurnNumber !== args.battleTurnNumber ||
    !isRecord(energyState.pool)
  ) {
    return null;
  }

  for (const colour of ENERGY_COLOURS) {
    if (!isNonNegativeSafeInteger(energyState.pool[colour])) {
      return null;
    }
  }

  return {
    green: energyState.pool.green as number,
    red: energyState.pool.red as number,
    blue: energyState.pool.blue as number,
  };
}

function canAfford(
  pool: Readonly<AncientEnergyPool>,
  cost: Readonly<AncientEnergyPool>,
): boolean {
  return ENERGY_COLOURS.every((colour) => pool[colour] >= cost[colour]);
}

function spendEnergy(
  pool: AncientEnergyPool,
  cost: Readonly<AncientEnergyPool>,
): void {
  for (const colour of ENERGY_COLOURS) {
    pool[colour] -= cost[colour];
  }
}

function scoreDamageAndHealing(effects: readonly any[]): number {
  return effects.reduce((score, effect) => {
    if (effect?.kind !== EffectKind.Damage && effect?.kind !== EffectKind.Heal) {
      return score;
    }
    return score + (typeof effect?.amount === 'number' ? effect.amount : 0);
  }, 0);
}

function evaluateAutocast(args: {
  state: any;
  playerId: string;
  declarationId: string;
  battleTurnNumber: number;
  energy: AncientEnergyPool;
  initialLedgerOrder?: number;
}): { state: any; remainingEnergy: AncientEnergyPool; score: number } {
  const result = resolveSolarCastSequence({
    state: args.state,
    playerId: args.playerId,
    declarationId: args.declarationId,
    battleTurnNumber: args.battleTurnNumber,
    initialEnergy: args.energy,
    casts: buildMonoColourAutocastCasts(args.energy),
    resolvers: PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
    sourceMode: 'autocast',
    initialLedgerOrder: args.initialLedgerOrder ?? 0,
  });
  return {
    state: result.state,
    remainingEnergy: result.remainingEnergy,
    score: scoreDamageAndHealing(result.effects),
  };
}

function chooseSiphonSpend(args: {
  state: any;
  playerId: string;
  declarationId: string;
  battleTurnNumber: number;
  energy: AncientEnergyPool;
}): number | null {
  const baselineScore = evaluateAutocast(args).score;
  const maximumSpend = Math.min(args.energy.green, args.energy.red);
  let bestSpend: number | null = null;
  let bestScore = baselineScore;

  for (
    let spend = SIPHON_MINIMUM_SPEND;
    spend <= maximumSpend;
    spend += 1
  ) {
    const siphon = resolveSolarCastSequence({
      state: args.state,
      playerId: args.playerId,
      declarationId: args.declarationId,
      battleTurnNumber: args.battleTurnNumber,
      initialEnergy: args.energy,
      casts: [{ solarPowerId: 'SSIP', lockedAmount: spend }],
      resolvers: { SSIP: SIPHON_SOLAR_RESOLVER },
      sourceMode: 'manual',
      initialLedgerOrder: 0,
    });
    const autocast = evaluateAutocast({
      state: siphon.state,
      playerId: args.playerId,
      declarationId: args.declarationId,
      battleTurnNumber: args.battleTurnNumber,
      energy: siphon.remainingEnergy,
      initialLedgerOrder: siphon.ledgerEntries.length,
    });
    const candidateScore = scoreDamageAndHealing(siphon.effects) +
      autocast.score;
    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestSpend = spend;
    }
  }

  return bestSpend;
}

export function planAncientChargeDeclaration(args: {
  state: any;
  playerId: string;
  strategy: AncientBotStrategy;
  planProgress?: BotPlanProgress;
}): AncientChargeDeclarationPlanResult {
  const { state, playerId, strategy } = args;
  if (getPhaseKey(state) !== 'battle.charge_declaration') {
    return { kind: 'no_input', reason: 'invalid_phase' };
  }
  if (
    !strategy || strategy.speciesId !== 'ANC' ||
    typeof strategy.id !== 'string' || strategy.id.length === 0
  ) {
    return { kind: 'no_input', reason: 'invalid_strategy' };
  }
  if (!isAncientPlayer(state, playerId)) {
    return { kind: 'no_input', reason: 'invalid_player' };
  }
  if (typeof state?.gameId !== 'string' || state.gameId.length === 0) {
    return { kind: 'no_input', reason: 'invalid_game_id' };
  }
  if (getAcceptedDeclarationForCurrentBattle(state, playerId)) {
    return { kind: 'no_input', reason: 'accepted_declaration_exists' };
  }

  const validatedPolicy = validateSolarPolicy(strategy);
  if (!validatedPolicy.ok) {
    return { kind: 'no_input', reason: validatedPolicy.reason };
  }

  const battleTurnNumber = getChargeDeclarationBattleTurnNumber(state);
  const initialEnergy = readCurrentEnergy({
    state,
    playerId,
    battleTurnNumber,
  });
  if (!initialEnergy) {
    return { kind: 'no_input', reason: 'invalid_energy_state' };
  }

  let requiresDeclarationInput: boolean;
  try {
    requiresDeclarationInput = playerRequiresChargeDeclarationInput(
      state,
      playerId,
    );
  } catch {
    return { kind: 'no_input', reason: 'invalid_legality_context' };
  }
  if (!requiresDeclarationInput) {
    return { kind: 'no_input', reason: 'no_atomic_declaration_input' };
  }

  let legalityState: any;
  try {
    legalityState = getChargeDeclarationLegalityState(state);
  } catch {
    return { kind: 'no_input', reason: 'invalid_legality_context' };
  }

  const declarationId =
    `bot:${state.gameId}:${battleTurnNumber}:${playerId}:ancient-charge:v1`;
  const remainingEnergy = { ...initialEnergy };
  const solarCasts: SolarCastPayload[] = [];
  let solarEvaluationState = legalityState;

  const simulacrumPolicy = validatedPolicy.policy.simulacrum;
  let stagedCompletedGoalCount = 0;
  if (simulacrumPolicy?.mode === 'staged_cost_goals') {
    const completedGoalCount = getStagedCompletedGoalCount({
      strategy,
      policy: simulacrumPolicy,
      planProgress: args.planProgress,
    });
    if (completedGoalCount === null) {
      return { kind: 'no_input', reason: 'invalid_simulacrum_progress' };
    }
    stagedCompletedGoalCount = completedGoalCount;
  }
  if (
    simulacrumPolicy &&
    isSimulacrumActivationFleetGoalSatisfied({
      state: legalityState,
      playerId,
      policy: simulacrumPolicy,
    })
  ) {
    const snapshotCandidates = getOpponentSnapshotCandidates({
      state: legalityState,
      playerId,
    });

    if (simulacrumPolicy.mode === 'staged_cost_goals') {
      for (
        let goalIndex = stagedCompletedGoalCount;
        goalIndex < simulacrumPolicy.costGoals.length;
        goalIndex += 1
      ) {
        const goalCost = simulacrumPolicy.costGoals[goalIndex];
        const orderedCandidates = snapshotCandidates
          .filter((candidate) =>
            candidate.totalLineCost === goalCost &&
            candidate.totalLineCost <= remainingEnergy.blue
          )
          .sort(compareSimulacrumCandidates);
        let accepted = false;
        for (const candidate of orderedCandidates) {
          const trial = trialSimulacrumCandidate({
            state: solarEvaluationState,
            playerId,
            declarationId,
            battleTurnNumber,
            energy: remainingEnergy,
            candidate,
            castIndex: solarCasts.length,
          });
          if (!trial) continue;
          solarCasts.push({
            solarPowerId: 'SSIM',
            targetInstanceId: candidate.targetInstanceId,
          });
          solarEvaluationState = trial.state;
          Object.assign(remainingEnergy, trial.remainingEnergy);
          accepted = true;
          break;
        }
        if (!accepted) break;
      }
    } else {
      const orderedCandidates = snapshotCandidates
        .filter((candidate) =>
          candidate.totalLineCost <= remainingEnergy.blue &&
          !(
            simulacrumPolicy.excludeDepletedChargedTargets &&
            candidate.hasChargeMechanic &&
            candidate.chargesCurrent === 0
          )
        )
        .sort(compareSimulacrumCandidates);
      const maximumCasts =
        simulacrumPolicy.maxCastsPerDeclaration === 'while_legal_affordable'
          ? Number.POSITIVE_INFINITY
          : simulacrumPolicy.maxCastsPerDeclaration;

      for (let castCount = 0; castCount < maximumCasts; castCount += 1) {
        let accepted = false;
        for (const candidate of orderedCandidates) {
          if (candidate.totalLineCost > remainingEnergy.blue) continue;
          const trial = trialSimulacrumCandidate({
            state: solarEvaluationState,
            playerId,
            declarationId,
            battleTurnNumber,
            energy: remainingEnergy,
            candidate,
            castIndex: solarCasts.length,
          });
          if (!trial) continue;
          solarCasts.push({
            solarPowerId: 'SSIM',
            targetInstanceId: candidate.targetInstanceId,
          });
          solarEvaluationState = trial.state;
          Object.assign(remainingEnergy, trial.remainingEnergy);
          accepted = true;
          break;
        }
        if (!accepted) break;
      }
    }
  }

  const vortexPolicy = validatedPolicy.policy.vortex;
  if (vortexPolicy) {
    for (
      let castCount = 0;
      (
        vortexPolicy.maxCastsPerDeclaration === 'uncapped' ||
        castCount < vortexPolicy.maxCastsPerDeclaration
      ) &&
      canAfford(remainingEnergy, VORTEX_SOLAR_COST);
      castCount += 1
    ) {
      solarCasts.push({ solarPowerId: 'SVOR' });
      spendEnergy(remainingEnergy, VORTEX_SOLAR_COST);
    }
  }

  const blackHolePolicy = validatedPolicy.policy.blackHole;
  if (blackHolePolicy) {
    const player = (state?.players ?? []).find((candidate: any) =>
      candidate?.id === playerId && candidate?.role === 'player'
    );
    if (!isNonNegativeSafeInteger(player?.health)) {
      return { kind: 'no_input', reason: 'invalid_player_health' };
    }

    if (player.health >= blackHolePolicy.minSelfHealth) {
      let legalTargets;
      try {
        legalTargets = getValidDestroyTargets(legalityState, {
          sourcePlayerId: playerId,
          targetScope: 'opponent',
          restriction: 'basic_only',
        });
      } catch {
        return { kind: 'no_input', reason: 'invalid_legality_context' };
      }
      const reservedTargetIds = new Set<string>();

      for (
        let castCount = 0;
        (
          blackHolePolicy.maxCastsPerDeclaration === 'uncapped' ||
          castCount < blackHolePolicy.maxCastsPerDeclaration
        ) &&
        canAfford(remainingEnergy, BLACK_HOLE_SOLAR_COST);
        castCount += 1
      ) {
        const targetInstanceIds = [...legalTargets]
          .filter((target) => !reservedTargetIds.has(target.instanceId))
          .sort((left, right) =>
            compareTargetsHighestTactical(legalityState, left, right)
          )
          .slice(0, 2)
          .map((target) => target.instanceId);
        for (const targetInstanceId of targetInstanceIds) {
          reservedTargetIds.add(targetInstanceId);
        }
        solarCasts.push({ solarPowerId: 'SBLA', targetInstanceIds });
        spendEnergy(remainingEnergy, BLACK_HOLE_SOLAR_COST);
      }
    }
  }

  try {
    const siphonSpend = chooseSiphonSpend({
      state: solarEvaluationState,
      playerId,
      declarationId,
      battleTurnNumber,
      energy: remainingEnergy,
    });
    if (siphonSpend !== null) {
      solarCasts.push({ solarPowerId: 'SSIP', lockedAmount: siphonSpend });
      spendEnergy(remainingEnergy, {
        green: siphonSpend,
        red: siphonSpend,
        blue: 0,
      });
    }
  } catch {
    return { kind: 'no_input', reason: 'solar_evaluation_failed' };
  }

  return {
    kind: 'submit',
    payload: {
      contractVersion: CHARGE_DECLARATION_CONTRACT_VERSION,
      declarationId,
      ordinaryChargeActions: planDamageHealChargeActions({ state, playerId }),
      solarCasts,
      autocastEnabled: true,
    },
  };
}
