import {
  getAllocatedTargetIdsForRenderableAction,
  getRenderableServerChoiceActions,
  getSelectedChoiceIdForRenderableAction,
  type RenderableServerAction,
} from './availableActions';
import { buildPowerAction } from './powerIntents';
import type { AncientEnergyPool } from './selectors';
import {
  ANCIENT_SIPHON_MINIMUM_SPEND,
  isValidAncientSiphonSpend,
} from '../../data/ancientSiphonRules';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import { ShipType, type ShipDefId } from '../../types/ShipTypes.engine';

export type { AncientEnergyPool } from './selectors';

export type AncientChargeDeclarationStage = 'charges' | 'powers';
export type AncientSolarSelectorMode = 'siphon' | 'blackHole' | 'simulacrum';

export type FixedAncientManualSolarPowerId =
  | 'SLIF'
  | 'SSTA'
  | 'SAST'
  | 'SSUP'
  | 'SCON'
  | 'SVOR';

export type ImplementedAncientManualSolarPowerId =
  | FixedAncientManualSolarPowerId
  | 'SSIP'
  | 'SBLA'
  | 'SSIM';

export type AncientCubeRepeatableManualSolarPowerId =
  | Exclude<FixedAncientManualSolarPowerId, 'SVOR'>
  | 'SSIM';

export type AncientManualSolarCast =
  | { solarPowerId: FixedAncientManualSolarPowerId }
  | { solarPowerId: 'SSIP'; lockedAmount: number }
  | { solarPowerId: 'SBLA'; targetInstanceIds: string[] }
  | {
      solarPowerId: 'SSIM';
      targetInstanceId: string;
      copiedShipDefId: ShipDefId;
      previewBlueCost: number;
      previewCapturedStartOfBattleCharges?: number;
      previewPermanentConfiguration: {
        selectedNumber?: number;
      };
    };

export type AncientChargeDeclarationSolarCastPayload =
  | { solarPowerId: FixedAncientManualSolarPowerId }
  | { solarPowerId: 'SSIP'; lockedAmount: number }
  | { solarPowerId: 'SBLA'; targetInstanceIds: string[] }
  | { solarPowerId: 'SSIM'; targetInstanceId: string };

export const ANCIENT_BLACK_HOLE_PREVIEW_COST: AncientEnergyPool = {
  green: 4,
  red: 4,
  blue: 4,
};

export const ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID = {
  SLIF: { green: 1, red: 0, blue: 0 },
  SSTA: { green: 3, red: 0, blue: 0 },
  SAST: { green: 0, red: 1, blue: 0 },
  SSUP: { green: 0, red: 3, blue: 0 },
  SCON: { green: 0, red: 0, blue: 1 },
  SVOR: { green: 2, red: 2, blue: 2 },
} as const satisfies Readonly<Record<FixedAncientManualSolarPowerId, AncientEnergyPool>>;

const FIXED_ANCIENT_MANUAL_SOLAR_POWER_IDS = new Set<string>(
  Object.keys(ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID)
);

const ANCIENT_CUBE_REPEATABLE_MANUAL_SOLAR_POWER_IDS = new Set<string>([
  'SLIF',
  'SSTA',
  'SAST',
  'SSUP',
  'SCON',
  'SSIM',
]);

export type AncientChargeDeclarationWorkflow = {
  key: string;
  stage: AncientChargeDeclarationStage;
  hadChargeStage: boolean;
  localManualSolarCasts: AncientManualSolarCast[];
  selectorMode: AncientSolarSelectorMode | null;
  blackHoleSelectedTargetInstanceIds: string[];
  rejectionRecoveryPending: boolean;
};

export type AncientChargeDeclarationPayload = {
  contractVersion: 1;
  declarationId: string;
  ordinaryChargeActions: ReturnType<typeof buildPowerAction>[];
  solarGridChoices: Array<{
    sourceInstanceId: string;
    choiceId: 'use' | 'hold';
  }>;
  solarCasts: AncientChargeDeclarationSolarCastPayload[];
  autocastEnabled: boolean;
};

export type FrozenAncientChargeDeclarationAttempt = {
  workflowKey: string;
  presentationSolarCasts: AncientManualSolarCast[];
  body: {
    gameId: string;
    intentType: 'CHARGE_DECLARATION_SUBMIT';
    turnNumber: number;
    payload: AncientChargeDeclarationPayload;
  };
  eventsHandled: boolean;
};

export function getAncientChargeDeclarationActions(
  availableActions: unknown
): RenderableServerAction[] {
  return getRenderableServerChoiceActions('battle.charge_declaration', availableActions as any[] | null | undefined);
}

export function partitionAncientChargeDeclarationActions(actions: readonly RenderableServerAction[]): {
  solarGridActions: RenderableServerAction[];
  ordinaryChargeActions: RenderableServerAction[];
} {
  return actions.reduce<{
    solarGridActions: RenderableServerAction[];
    ordinaryChargeActions: RenderableServerAction[];
  }>(
    (partitioned, action) => {
      if (action.actionId === 'SOL#0' || action.shipDefId === 'SOL') {
        partitioned.solarGridActions.push(action);
      } else {
        partitioned.ordinaryChargeActions.push(action);
      }
      return partitioned;
    },
    { solarGridActions: [], ordinaryChargeActions: [] }
  );
}

export function getAncientEnergyTotal(pool: AncientEnergyPool): number {
  return pool.green + pool.red + pool.blue;
}

export function isFixedAncientManualSolarPowerId(
  value: unknown
): value is FixedAncientManualSolarPowerId {
  return typeof value === 'string' && FIXED_ANCIENT_MANUAL_SOLAR_POWER_IDS.has(value);
}

export function isAncientCubeRepeatableManualSolarPowerId(
  value: unknown
): value is AncientCubeRepeatableManualSolarPowerId {
  return (
    typeof value === 'string' &&
    ANCIENT_CUBE_REPEATABLE_MANUAL_SOLAR_POWER_IDS.has(value)
  );
}

export function snapshotAncientManualSolarCastsForPresentation(
  casts: readonly AncientManualSolarCast[]
): AncientManualSolarCast[] {
  return casts.map((cast) => {
    if (cast.solarPowerId === 'SSIP') {
      return {
        solarPowerId: 'SSIP',
        lockedAmount: cast.lockedAmount,
      };
    }
    if (cast.solarPowerId === 'SBLA') {
      return {
        solarPowerId: 'SBLA',
        targetInstanceIds: [...cast.targetInstanceIds],
      };
    }
    if (cast.solarPowerId === 'SSIM') {
      return {
        solarPowerId: 'SSIM',
        targetInstanceId: cast.targetInstanceId,
        copiedShipDefId: cast.copiedShipDefId,
        previewBlueCost: cast.previewBlueCost,
        ...(cast.previewCapturedStartOfBattleCharges !== undefined
          ? {
              previewCapturedStartOfBattleCharges:
                cast.previewCapturedStartOfBattleCharges,
            }
          : {}),
        previewPermanentConfiguration: {
          ...(cast.previewPermanentConfiguration.selectedNumber !== undefined
            ? {
                selectedNumber:
                  cast.previewPermanentConfiguration.selectedNumber,
              }
            : {}),
        },
      };
    }
    return { solarPowerId: cast.solarPowerId };
  });
}

export function selectAncientSolarPresentationCasts(args: {
  currentWorkflowKey: string;
  workflow: AncientChargeDeclarationWorkflow | null;
  frozenAttempt: FrozenAncientChargeDeclarationAttempt | null;
}): readonly AncientManualSolarCast[] {
  if (args.frozenAttempt?.workflowKey === args.currentWorkflowKey) {
    return args.frozenAttempt.presentationSolarCasts;
  }
  if (args.workflow?.key === args.currentWorkflowKey) {
    return args.workflow.localManualSolarCasts;
  }
  return [];
}

export function canAffordAncientEnergyCost(
  pool: AncientEnergyPool,
  cost: AncientEnergyPool
): boolean {
  return pool.green >= cost.green && pool.red >= cost.red && pool.blue >= cost.blue;
}

export function replayAncientManualSolarCasts(args: {
  startingPool: AncientEnergyPool;
  localManualSolarCasts: readonly AncientManualSolarCast[];
}): { remainingEnergy: AncientEnergyPool; valid: boolean } {
  const remainingEnergy = { ...args.startingPool };
  const seenSimulacrumTargetInstanceIds = new Set<string>();

  for (const cast of args.localManualSolarCasts) {
    let cost: AncientEnergyPool | null;
    if (cast.solarPowerId === 'SSIP') {
      cost = isValidAncientSiphonSpend(cast.lockedAmount)
        ? { green: cast.lockedAmount, red: cast.lockedAmount, blue: 0 }
        : null;
    } else if (cast.solarPowerId === 'SBLA') {
      const targetInstanceIds = cast.targetInstanceIds;
      const validTargets =
        Array.isArray(targetInstanceIds) &&
        targetInstanceIds.length <= 2 &&
        targetInstanceIds.every((instanceId) =>
          typeof instanceId === 'string' && instanceId.length > 0
        ) &&
        new Set(targetInstanceIds).size === targetInstanceIds.length;
      cost = validTargets ? ANCIENT_BLACK_HOLE_PREVIEW_COST : null;
    } else if (cast.solarPowerId === 'SSIM') {
      const definition = isShipDefId(cast.copiedShipDefId)
        ? getShipDefinitionById(cast.copiedShipDefId)
        : undefined;
      const validTarget =
        typeof cast.targetInstanceId === 'string' &&
        cast.targetInstanceId.length > 0 &&
        !seenSimulacrumTargetInstanceIds.has(cast.targetInstanceId);
      const validPreviewCost =
        Number.isFinite(cast.previewBlueCost) &&
        Number.isInteger(cast.previewBlueCost) &&
        cast.previewBlueCost > 0 &&
        definition?.type === ShipType.BASIC &&
        cast.copiedShipDefId !== 'CUB' &&
        definition.basicCost?.totalLines === cast.previewBlueCost;
      cost = validTarget && validPreviewCost
        ? { green: 0, red: 0, blue: cast.previewBlueCost }
        : null;
      if (cost) {
        seenSimulacrumTargetInstanceIds.add(cast.targetInstanceId);
      }
    } else {
      cost = ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID[cast.solarPowerId];
    }
    if (!cost || !canAffordAncientEnergyCost(remainingEnergy, cost)) {
      return { remainingEnergy, valid: false };
    }
    remainingEnergy.green -= cost.green;
    remainingEnergy.red -= cost.red;
    remainingEnergy.blue -= cost.blue;
  }

  return { remainingEnergy, valid: true };
}

export function deriveAncientManualSolarCastability(args: {
  stage: AncientChargeDeclarationStage;
  remainingEnergy: AncientEnergyPool;
  energySequenceValid: boolean;
  attemptUnresolved: boolean;
  rejectionRecoveryPending: boolean;
}): Record<FixedAncientManualSolarPowerId, boolean> {
  const interactionAvailable =
    args.stage === 'powers' &&
    args.energySequenceValid &&
    !args.attemptUnresolved &&
    !args.rejectionRecoveryPending;

  return Object.fromEntries(
    Object.entries(ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID).map(([solarPowerId, cost]) => [
      solarPowerId,
      interactionAvailable && canAffordAncientEnergyCost(args.remainingEnergy, cost),
    ])
  ) as Record<FixedAncientManualSolarPowerId, boolean>;
}

export function deriveAncientSiphonSelectorState(args: {
  stage: AncientChargeDeclarationStage;
  remainingEnergy: AncientEnergyPool;
  energySequenceValid: boolean;
  attemptUnresolved: boolean;
  rejectionRecoveryPending: boolean;
}): { maxSpend: number; canOpen: boolean } {
  const maxSpend = args.energySequenceValid
    ? Math.min(args.remainingEnergy.green, args.remainingEnergy.red)
    : 0;

  return {
    maxSpend,
    canOpen:
      args.stage === 'powers' &&
      args.energySequenceValid &&
      !args.attemptUnresolved &&
      !args.rejectionRecoveryPending &&
      maxSpend >= ANCIENT_SIPHON_MINIMUM_SPEND,
  };
}

export function deriveAncientSimulacrumSelectorState(args: {
  stage: AncientChargeDeclarationStage;
  remainingEnergy: AncientEnergyPool;
  energySequenceValid: boolean;
  attemptUnresolved: boolean;
  rejectionRecoveryPending: boolean;
  hasEligibleTarget: boolean;
}): { blueAvailable: number; canOpen: boolean; canRemainOpen: boolean } {
  const blueAvailable = args.energySequenceValid ? args.remainingEnergy.blue : 0;
  const canRemainOpen =
    args.stage === 'powers' &&
    args.energySequenceValid &&
    !args.attemptUnresolved &&
    !args.rejectionRecoveryPending;

  return {
    blueAvailable,
    canOpen: canRemainOpen && args.hasEligibleTarget,
    canRemainOpen,
  };
}

export function deriveAncientBlackHoleCastability(args: {
  stage: AncientChargeDeclarationStage;
  remainingEnergy: AncientEnergyPool;
  energySequenceValid: boolean;
  attemptUnresolved: boolean;
  rejectionRecoveryPending: boolean;
}): boolean {
  return (
    args.stage === 'powers' &&
    args.energySequenceValid &&
    !args.attemptUnresolved &&
    !args.rejectionRecoveryPending &&
    canAffordAncientEnergyCost(args.remainingEnergy, ANCIENT_BLACK_HOLE_PREVIEW_COST)
  );
}

export function getUsableAncientEnergyPoolForPlayer(
  state: any,
  playerId: string | null | undefined
): AncientEnergyPool | null {
  if (!playerId) return null;

  const pool = state?.publicState?.ancient?.energyByPlayerId?.[playerId]?.pool;
  if (
    !pool ||
    !Number.isInteger(pool.green) || pool.green < 0 ||
    !Number.isInteger(pool.red) || pool.red < 0 ||
    !Number.isInteger(pool.blue) || pool.blue < 0
  ) {
    return null;
  }

  return { green: pool.green, red: pool.red, blue: pool.blue };
}

export function deriveProvisionalAncientEnergy(args: {
  authoritativePool: AncientEnergyPool;
  solarGridActions: readonly RenderableServerAction[];
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
}): AncientEnergyPool {
  const useCount = args.solarGridActions.reduce((count, action) => {
    const choiceId = getSelectedChoiceIdForRenderableAction(
      action,
      args.selectedChoiceIdBySourceInstanceId
    );
    return count + (choiceId === 'use' ? 1 : 0);
  }, 0);

  return {
    green: args.authoritativePool.green + useCount,
    red: args.authoritativePool.red + useCount,
    blue: args.authoritativePool.blue + useCount,
  };
}

export function buildAncientChargeDeclarationPayload(args: {
  declarationId: string;
  actions: readonly RenderableServerAction[];
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
  allocatedTargetIdsBySourceInstanceId: Record<string, string[]>;
  allocatedTargetIdBySourceInstanceId: Record<string, string>;
  localManualSolarCasts: readonly AncientManualSolarCast[];
  autocastEnabled: boolean;
}): AncientChargeDeclarationPayload {
  const { solarGridActions, ordinaryChargeActions } = partitionAncientChargeDeclarationActions(args.actions);

  const ordinaryActions = ordinaryChargeActions.flatMap((action) => {
    const choiceId = getSelectedChoiceIdForRenderableAction(
      action,
      args.selectedChoiceIdBySourceInstanceId
    );
    if (!choiceId || choiceId === 'hold') return [];

    if (action.kind === 'destroy_target' || action.kind === 'paired_destroy_target') {
      const targetInstanceIds = getAllocatedTargetIdsForRenderableAction(
        action,
        args.allocatedTargetIdsBySourceInstanceId,
        args.allocatedTargetIdBySourceInstanceId
      );
      if (targetInstanceIds.length === 0) return [];
      return [buildPowerAction({
        actionId: action.actionId,
        sourceInstanceId: action.sourceInstanceId,
        choiceId,
        targetInstanceId: targetInstanceIds[0],
        targetInstanceIds,
      })];
    }

    return [buildPowerAction({
      actionId: action.actionId,
      sourceInstanceId: action.sourceInstanceId,
      choiceId,
    })];
  });

  const solarGridChoices = solarGridActions
    .map((action) => ({
      sourceInstanceId: action.sourceInstanceId,
      choiceId: getSelectedChoiceIdForRenderableAction(
        action,
        args.selectedChoiceIdBySourceInstanceId
      ) === 'use' ? 'use' as const : 'hold' as const,
    }))
    .sort((a, b) => a.sourceInstanceId.localeCompare(b.sourceInstanceId));

  return {
    contractVersion: 1,
    declarationId: args.declarationId,
    ordinaryChargeActions: ordinaryActions,
    solarGridChoices,
    solarCasts: args.localManualSolarCasts.map((cast) => {
      if (cast.solarPowerId === 'SSIP') {
        return { solarPowerId: 'SSIP', lockedAmount: cast.lockedAmount };
      }
      if (cast.solarPowerId === 'SBLA') {
        return {
          solarPowerId: 'SBLA',
          targetInstanceIds: [...cast.targetInstanceIds].sort((a, b) => a.localeCompare(b)),
        };
      }
      if (cast.solarPowerId === 'SSIM') {
        return {
          solarPowerId: 'SSIM',
          targetInstanceId: cast.targetInstanceId,
        };
      }
      return { solarPowerId: cast.solarPowerId };
    }),
    autocastEnabled: args.autocastEnabled,
  };
}
