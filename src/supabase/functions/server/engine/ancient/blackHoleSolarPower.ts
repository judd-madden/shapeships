import type {
  AncientPendingBlackHoleDestruction,
  AncientSolarTargetReference,
  GameState,
} from '../state/GameStateTypes.ts';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
  type Effect,
} from '../../engine_shared/effects/Effect.ts';
import {
  applyEffects,
  type EffectEvent,
} from '../../engine_shared/effects/applyEffects.ts';
import { getValidDestroyTargets } from '../../engine_shared/resolve/destroyRules.ts';
import type { ManualSolarResolverDescriptor } from './manualSolarDeclaration.ts';
import {
  buildSolarHealthEffect,
  requireSolarOpponentPlayerId,
} from './solarHealthEffects.ts';

const BLACK_HOLE_CORE_IDS = new Set(['PLU', 'MER', 'NEP']);

function requireBlackHoleTargets(args: {
  state: Readonly<any>;
  playerId: string;
  submittedTargetInstanceIds: readonly string[];
}): { targetPlayerId: string; targetInstanceIds: string[] } {
  const targetPlayerId = requireSolarOpponentPlayerId(args.state, args.playerId);
  const legalTargets = getValidDestroyTargets(args.state, {
    sourcePlayerId: args.playerId,
    targetScope: 'opponent',
    restriction: 'basic_only',
  });
  const requiredTargetCount = Math.min(2, legalTargets.length);
  const targetInstanceIds = [...args.submittedTargetInstanceIds].sort((a, b) =>
    a.localeCompare(b)
  );

  if (new Set(targetInstanceIds).size !== targetInstanceIds.length) {
    throw new Error('Black Hole targetInstanceIds must be distinct');
  }
  if (targetInstanceIds.length !== requiredTargetCount) {
    throw new Error(
      `Black Hole requires exactly ${requiredTargetCount} targetInstanceIds`,
    );
  }

  const legalTargetIds = new Set(legalTargets.map((target) => target.instanceId));
  const illegalTargetId = targetInstanceIds.find((targetId) =>
    !legalTargetIds.has(targetId)
  );
  if (illegalTargetId) {
    throw new Error(`Illegal Black Hole target: ${illegalTargetId}`);
  }

  return { targetPlayerId, targetInstanceIds };
}

function countLiveOwnedCores(state: Readonly<any>, playerId: string): number {
  const fleet = state?.gameData?.ships?.[playerId];
  if (!Array.isArray(fleet)) return 0;
  return fleet.filter((ship: any) =>
    typeof ship?.shipDefId === 'string' &&
    BLACK_HOLE_CORE_IDS.has(ship.shipDefId)
  ).length;
}

export const BLACK_HOLE_SOLAR_RESOLVER: ManualSolarResolverDescriptor = {
  acceptedFields: { targetInstanceIds: true },
  resolve(context) {
    if (context.sourceMode !== 'manual') {
      throw new Error('Black Hole may only be resolved from a manual Solar cast');
    }

    const { targetPlayerId, targetInstanceIds } = requireBlackHoleTargets({
      state: context.state,
      playerId: context.playerId,
      submittedTargetInstanceIds: context.cast.targetInstanceIds ?? [],
    });
    const lockedDamage = countLiveOwnedCores(context.state, context.playerId);
    const candidateState = structuredClone(context.state);
    const ancient = candidateState?.gameData?.ancient;
    if (!ancient || !Array.isArray(ancient.pendingBlackHoleDestructions)) {
      throw new Error('Black Hole requires initialized Ancient pending state');
    }

    const pendingDestruction: AncientPendingBlackHoleDestruction = {
      pendingDestructionId:
        `${context.castIdentity}:black-hole-destruction`,
      declarationId: context.declarationId,
      ownerPlayerId: context.playerId,
      targetPlayerId,
      targetInstanceIds,
      battleTurnNumber: context.battleTurnNumber,
      lockedDamage,
      status: 'committed',
    };
    ancient.pendingBlackHoleDestructions = [
      ...ancient.pendingBlackHoleDestructions,
      pendingDestruction,
    ];

    const ledgerTargets: AncientSolarTargetReference[] = targetInstanceIds.map(
      (shipInstanceId) => ({ playerId: targetPlayerId, shipInstanceId }),
    );

    return {
      candidateState,
      paidEnergy: { green: 4, red: 4, blue: 4 },
      effects: [buildSolarHealthEffect({
        castIdentity: context.castIdentity,
        ownerPlayerId: context.playerId,
        powerId: 'SBLA',
        targetPlayerId,
        kind: EffectKind.Damage,
        amount: lockedDamage,
        idSuffix: 'damage',
      })],
      ledgerMetadata: {
        lockedAmount: lockedDamage,
        ...(ledgerTargets.length > 0 ? { targets: ledgerTargets } : {}),
      },
    };
  },
};

export function resolveCommittedBlackHoleDestructions(
  state: GameState,
  battleTurnNumber: number,
): { state: GameState; events: EffectEvent[] } {
  const pendingDestructions =
    state.gameData.ancient?.pendingBlackHoleDestructions ?? [];
  const selectedRecords = pendingDestructions
    .filter((record) =>
      record.status === 'committed' &&
      record.battleTurnNumber === battleTurnNumber
    )
    .sort((a, b) =>
      a.pendingDestructionId.localeCompare(b.pendingDestructionId)
    );

  if (selectedRecords.length === 0) {
    return { state, events: [] };
  }

  const effects: Effect[] = selectedRecords.flatMap((record) =>
    [...record.targetInstanceIds]
      .sort((a, b) => a.localeCompare(b))
      .map((targetInstanceId): Effect => ({
        id:
          `${record.pendingDestructionId}:destroy:${targetInstanceId}`,
        ownerPlayerId: record.ownerPlayerId,
        source: { type: 'system', reason: 'ancient-solar:SBLA' },
        timing: 'battle.end_of_turn_resolution',
        activationTag: EffectTiming.Charge,
        survivability: SurvivabilityRule.ResolvesIfDestroyed,
        target: {
          playerId: record.targetPlayerId,
          shipInstanceId: targetInstanceId,
        },
        kind: EffectKind.Destroy,
        restriction: 'basic_only',
        count: 1,
      }))
  );
  const applied = applyEffects(state, effects);
  const appliedAncient = applied.state.gameData.ancient;
  if (!appliedAncient) {
    throw new Error('Black Hole resolution requires initialized Ancient state');
  }
  const selectedRecordIds = new Set(
    selectedRecords.map((record) => record.pendingDestructionId),
  );
  const nextPendingDestructions = pendingDestructions.map((record) =>
    selectedRecordIds.has(record.pendingDestructionId)
      ? { ...record, status: 'resolved' as const }
      : record
  );

  return {
    state: {
      ...applied.state,
      gameData: {
        ...applied.state.gameData,
        ancient: {
          ...appliedAncient,
          pendingBlackHoleDestructions: nextPendingDestructions,
        },
      },
    },
    events: applied.events,
  };
}
