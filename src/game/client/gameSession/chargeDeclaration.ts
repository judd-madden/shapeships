import {
  getAllocatedTargetIdsForRenderableAction,
  getRenderableActionRequiredTargetCount,
  getSelectedChoiceIdForRenderableAction,
  isRenderableTargetedAction,
  type RenderableServerAction,
} from './availableActions';

export type NormalizedOrdinaryChargeAction = {
  actionType: 'power';
  actionId: string;
  sourceInstanceId: string;
  choiceId: string;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
};

export type NormalizedSolarCast = {
  solarPowerId: string;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
  lockedAmount?: number;
};

export type ChargeDeclarationSolarCastInput =
  | { solarPowerId: string; lockedAmount?: undefined; targetInstanceId?: undefined; targetInstanceIds?: undefined }
  | { solarPowerId: 'SSIP'; lockedAmount: number }
  | { solarPowerId: 'SBLA'; targetInstanceIds: string[] }
  | { solarPowerId: 'SSIM'; targetInstanceId: string };

export type ChargeDeclarationPayload = {
  contractVersion: 1;
  declarationId: string;
  ordinaryChargeActions: NormalizedOrdinaryChargeAction[];
  solarCasts: NormalizedSolarCast[];
  autocastEnabled: boolean;
};

export type OrdinaryChargeSerializationResult =
  | { ok: true; actions: NormalizedOrdinaryChargeAction[] }
  | {
      ok: false;
      reason: 'missing_choice' | 'incomplete_targeting';
      sourceInstanceId: string;
    };

export function serializeOrdinaryChargeActions(args: {
  actions: readonly RenderableServerAction[];
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
  allocatedTargetIdsBySourceInstanceId: Record<string, string[]>;
  allocatedTargetIdBySourceInstanceId: Record<string, string>;
}): OrdinaryChargeSerializationResult {
  const actions: NormalizedOrdinaryChargeAction[] = [];

  for (const action of args.actions) {
    const choiceId = getSelectedChoiceIdForRenderableAction(
      action,
      args.selectedChoiceIdBySourceInstanceId,
    );
    if (!choiceId) {
      return {
        ok: false,
        reason: 'missing_choice',
        sourceInstanceId: action.sourceInstanceId,
      };
    }
    if (choiceId === 'hold') continue;

    const common = {
      actionType: 'power' as const,
      actionId: action.actionId,
      sourceInstanceId: action.sourceInstanceId,
      choiceId,
    };
    if (!isRenderableTargetedAction(action)) {
      actions.push(common);
      continue;
    }

    const requiredTargetCount = getRenderableActionRequiredTargetCount(action);
    const targetInstanceIds = getAllocatedTargetIdsForRenderableAction(
      action,
      args.allocatedTargetIdsBySourceInstanceId,
      args.allocatedTargetIdBySourceInstanceId,
    );
    if (targetInstanceIds.length !== requiredTargetCount) {
      return {
        ok: false,
        reason: 'incomplete_targeting',
        sourceInstanceId: action.sourceInstanceId,
      };
    }

    if (requiredTargetCount === 1) {
      actions.push({ ...common, targetInstanceId: targetInstanceIds[0] });
    } else {
      actions.push({
        ...common,
        targetInstanceIds: [...targetInstanceIds].sort((left, right) =>
          left.localeCompare(right)
        ),
      });
    }
  }

  return { ok: true, actions };
}

export function getChargeDeclarationFingerprint(
  declaration: ChargeDeclarationPayload,
): string {
  return JSON.stringify({
    contractVersion: declaration.contractVersion,
    ordinaryChargeActions: declaration.ordinaryChargeActions,
    solarCasts: declaration.solarCasts,
    autocastEnabled: declaration.autocastEnabled,
  });
}

export function serializeChargeDeclarationSolarCasts(
  casts: readonly ChargeDeclarationSolarCastInput[],
): NormalizedSolarCast[] {
  return casts.map((cast) => {
    if (cast.solarPowerId === 'SSIP' && typeof cast.lockedAmount === 'number') {
      return { solarPowerId: 'SSIP', lockedAmount: cast.lockedAmount };
    }
    if (cast.solarPowerId === 'SBLA' && Array.isArray(cast.targetInstanceIds)) {
      return {
        solarPowerId: 'SBLA',
        targetInstanceIds: [...cast.targetInstanceIds].sort((left, right) =>
          left.localeCompare(right)
        ),
      };
    }
    if (cast.solarPowerId === 'SSIM' && typeof cast.targetInstanceId === 'string') {
      return { solarPowerId: 'SSIM', targetInstanceId: cast.targetInstanceId };
    }
    return { solarPowerId: cast.solarPowerId };
  });
}
