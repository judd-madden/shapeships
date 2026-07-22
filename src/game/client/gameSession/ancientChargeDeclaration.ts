import {
  getAllocatedTargetIdsForRenderableAction,
  getRenderableServerChoiceActions,
  getSelectedChoiceIdForRenderableAction,
  type RenderableServerAction,
} from './availableActions';
import { buildPowerAction } from './powerIntents';
import type { AncientEnergyPool } from './selectors';

export type { AncientEnergyPool } from './selectors';

export type AncientChargeDeclarationStage = 'charges' | 'powers';

export type ImplementedAncientManualSolarPowerId =
  | 'SLIF'
  | 'SSTA'
  | 'SAST'
  | 'SSUP'
  | 'SCON';

export type AncientManualSolarCast = {
  solarPowerId: ImplementedAncientManualSolarPowerId;
};

export const ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID = {
  SLIF: { green: 1, red: 0, blue: 0 },
  SSTA: { green: 3, red: 0, blue: 0 },
  SAST: { green: 0, red: 1, blue: 0 },
  SSUP: { green: 0, red: 3, blue: 0 },
  SCON: { green: 0, red: 0, blue: 1 },
} as const satisfies Readonly<Record<ImplementedAncientManualSolarPowerId, AncientEnergyPool>>;

const IMPLEMENTED_ANCIENT_MANUAL_SOLAR_POWER_IDS = new Set<string>(
  Object.keys(ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID)
);

export type AncientChargeDeclarationWorkflow = {
  key: string;
  stage: AncientChargeDeclarationStage;
  hadChargeStage: boolean;
  localManualSolarCasts: AncientManualSolarCast[];
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
  solarCasts: AncientManualSolarCast[];
  autocastEnabled: boolean;
};

export type FrozenAncientChargeDeclarationAttempt = {
  workflowKey: string;
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

export function isImplementedAncientManualSolarPowerId(
  value: unknown
): value is ImplementedAncientManualSolarPowerId {
  return typeof value === 'string' && IMPLEMENTED_ANCIENT_MANUAL_SOLAR_POWER_IDS.has(value);
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

  for (const cast of args.localManualSolarCasts) {
    const cost = ANCIENT_MANUAL_SOLAR_POWER_PREVIEW_COST_BY_ID[cast.solarPowerId];
    remainingEnergy.green -= cost.green;
    remainingEnergy.red -= cost.red;
    remainingEnergy.blue -= cost.blue;
  }

  return {
    remainingEnergy,
    valid:
      remainingEnergy.green >= 0 &&
      remainingEnergy.red >= 0 &&
      remainingEnergy.blue >= 0,
  };
}

export function deriveAncientManualSolarCastability(args: {
  stage: AncientChargeDeclarationStage;
  remainingEnergy: AncientEnergyPool;
  energySequenceValid: boolean;
  attemptUnresolved: boolean;
  rejectionRecoveryPending: boolean;
}): Record<ImplementedAncientManualSolarPowerId, boolean> {
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
  ) as Record<ImplementedAncientManualSolarPowerId, boolean>;
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
    solarCasts: args.localManualSolarCasts.map(({ solarPowerId }) => ({ solarPowerId })),
    autocastEnabled: args.autocastEnabled,
  };
}
