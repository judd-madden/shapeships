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

export type AncientChargeDeclarationWorkflow = {
  key: string;
  stage: AncientChargeDeclarationStage;
  hadChargeStage: boolean;
};

export type AncientChargeDeclarationPayload = {
  contractVersion: 1;
  declarationId: string;
  ordinaryChargeActions: ReturnType<typeof buildPowerAction>[];
  solarGridChoices: Array<{
    sourceInstanceId: string;
    choiceId: 'use' | 'hold';
  }>;
  solarCasts: [];
  autocastEnabled: false;
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
    solarCasts: [],
    autocastEnabled: false,
  };
}
