import { isShipDefId } from '../../data/ShipDefinitions.core';
import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import { ShipType, type ShipDefId } from '../../types/ShipTypes.engine';
import type { AncientManualSolarCast } from './ancientChargeDeclaration';
import type { BoardDestroyTargetingViewModel, BoardFleetSummary } from './types';

export interface AncientSimulacrumTargetDescriptor {
  targetInstanceId: string;
  copiedShipDefId: ShipDefId;
  previewBlueCost: number;
  previewCapturedStartOfBattleCharges?: number;
  previewPermanentConfiguration: {
    selectedNumber?: number;
  };
}

export interface AncientSimulacrumTargetingState {
  eligibleTargetsByStackKey: Record<string, AncientSimulacrumTargetDescriptor[]>;
  selectedTargetInstanceIdsByStackKey: Record<string, string[]>;
  hasEligibleTarget: boolean;
}

function getShipInstanceId(ship: any): string | null {
  const instanceId = ship?.instanceId ?? ship?.id;
  return typeof instanceId === 'string' && instanceId.length > 0 ? instanceId : null;
}

function getValidSimulacrumTargetDescriptor(
  ship: any
): AncientSimulacrumTargetDescriptor | null {
  const targetInstanceId = getShipInstanceId(ship);
  const rawShipDefId = String(ship?.shipDefId ?? '');
  if (!targetInstanceId || !isShipDefId(rawShipDefId) || rawShipDefId === 'CUB') {
    return null;
  }

  const definition = getShipDefinitionById(rawShipDefId);
  const previewBlueCost = definition?.basicCost?.totalLines;
  if (
    definition?.type !== ShipType.BASIC ||
    !Number.isFinite(previewBlueCost) ||
    !Number.isInteger(previewBlueCost) ||
    (previewBlueCost ?? 0) <= 0
  ) {
    return null;
  }

  return {
    targetInstanceId,
    copiedShipDefId: rawShipDefId,
    previewBlueCost: previewBlueCost as number,
    previewPermanentConfiguration: {},
  };
}

function getStackPresentationSnapshot(
  stack: Pick<
    BoardFleetSummary,
    'shipDefId' | 'condition' | 'currentCharges' | 'caption'
  >,
  copiedShipDefId: ShipDefId
): Pick<
  AncientSimulacrumTargetDescriptor,
  'previewCapturedStartOfBattleCharges' | 'previewPermanentConfiguration'
> {
  const definition = getShipDefinitionById(copiedShipDefId);
  const maxCharges = definition?.maxCharges ?? 0;
  let previewCapturedStartOfBattleCharges: number | undefined;

  if (maxCharges <= 0) {
    previewCapturedStartOfBattleCharges = 0;
  } else if (maxCharges === 1) {
    if (stack.condition === 'charges_1') {
      previewCapturedStartOfBattleCharges = 1;
    } else if (stack.condition === 'charges_0') {
      previewCapturedStartOfBattleCharges = 0;
    }
  } else if (stack.condition === 'charges_0') {
    previewCapturedStartOfBattleCharges = 0;
  } else if (
    typeof stack.currentCharges === 'number' &&
    Number.isInteger(stack.currentCharges) &&
    stack.currentCharges >= 0
  ) {
    previewCapturedStartOfBattleCharges = stack.currentCharges;
  }

  const displayedSelectedNumber =
    copiedShipDefId === 'QUA' &&
    typeof stack.caption === 'string' &&
    /^[1-6]$/.test(stack.caption)
      ? Number(stack.caption)
      : undefined;
  const previewPermanentConfiguration =
    Number.isInteger(displayedSelectedNumber) &&
    (displayedSelectedNumber ?? 0) >= 1 &&
    (displayedSelectedNumber ?? 0) <= 6
      ? { selectedNumber: displayedSelectedNumber }
      : {};

  return {
    ...(previewCapturedStartOfBattleCharges !== undefined
      ? { previewCapturedStartOfBattleCharges }
      : {}),
    previewPermanentConfiguration,
  };
}

export function deriveAncientSimulacrumTargetingState(args: {
  opponentShipsVisible: readonly any[];
  opponentFleet: readonly Pick<
    BoardFleetSummary,
    | 'shipDefId'
    | 'stackKey'
    | 'memberInstanceIds'
    | 'condition'
    | 'currentCharges'
    | 'caption'
  >[];
  myShips: readonly any[];
  localManualSolarCasts: readonly AncientManualSolarCast[];
  remainingBlue: number;
}): AncientSimulacrumTargetingState {
  const selectedTargetInstanceIds = new Set(
    args.localManualSolarCasts.flatMap((cast) =>
      cast.solarPowerId === 'SSIM' &&
      typeof cast.targetInstanceId === 'string' &&
      cast.targetInstanceId.length > 0
        ? [cast.targetInstanceId]
        : []
    )
  );
  const selectedCopiesByShipDefId = args.localManualSolarCasts.reduce<
    Partial<Record<ShipDefId, number>>
  >((counts, cast) => {
    if (cast.solarPowerId === 'SSIM' && isShipDefId(cast.copiedShipDefId)) {
      counts[cast.copiedShipDefId] = (counts[cast.copiedShipDefId] ?? 0) + 1;
    }
    return counts;
  }, {});
  const ownedCountByShipDefId = args.myShips.reduce<Partial<Record<ShipDefId, number>>>(
    (counts, ship) => {
      const rawShipDefId = String(ship?.shipDefId ?? '');
      if (getShipInstanceId(ship) && isShipDefId(rawShipDefId)) {
        counts[rawShipDefId] = (counts[rawShipDefId] ?? 0) + 1;
      }
      return counts;
    },
    {}
  );

  const descriptorByInstanceId = new Map<string, AncientSimulacrumTargetDescriptor>();
  for (const ship of args.opponentShipsVisible) {
    const descriptor = getValidSimulacrumTargetDescriptor(ship);
    if (!descriptor || descriptorByInstanceId.has(descriptor.targetInstanceId)) {
      continue;
    }
    descriptorByInstanceId.set(descriptor.targetInstanceId, descriptor);
  }

  const eligibleTargetsByStackKey: Record<string, AncientSimulacrumTargetDescriptor[]> = {};
  const selectedTargetInstanceIdsByStackKey: Record<string, string[]> = {};
  for (const stack of args.opponentFleet) {
    const memberInstanceIds = Array.from(new Set(stack.memberInstanceIds))
      .sort((a, b) => a.localeCompare(b));
    const selectedIds = memberInstanceIds.filter((instanceId) =>
      selectedTargetInstanceIds.has(instanceId)
    );
    if (selectedIds.length > 0) {
      selectedTargetInstanceIdsByStackKey[stack.stackKey] = selectedIds;
    }

    const eligibleDescriptors = memberInstanceIds.flatMap((instanceId) => {
      if (selectedTargetInstanceIds.has(instanceId)) return [];
      const descriptor = descriptorByInstanceId.get(instanceId);
      if (!descriptor || descriptor.previewBlueCost > args.remainingBlue) return [];

      const definition = getShipDefinitionById(descriptor.copiedShipDefId);
      if (
        typeof definition?.maxQuantity === 'number' &&
        (ownedCountByShipDefId[descriptor.copiedShipDefId] ?? 0) +
          (selectedCopiesByShipDefId[descriptor.copiedShipDefId] ?? 0) +
          1 >
          definition.maxQuantity
      ) {
        return [];
      }
      const presentation = getStackPresentationSnapshot(
        stack,
        descriptor.copiedShipDefId
      );
      return [{
        ...descriptor,
        ...presentation,
        previewPermanentConfiguration: {
          ...presentation.previewPermanentConfiguration,
        },
      }];
    });
    if (eligibleDescriptors.length > 0) {
      eligibleTargetsByStackKey[stack.stackKey] = eligibleDescriptors;
    }
  }

  return {
    eligibleTargetsByStackKey,
    selectedTargetInstanceIdsByStackKey,
    hasEligibleTarget: Object.keys(eligibleTargetsByStackKey).length > 0,
  };
}

export function allocateNextAncientSimulacrumTarget(args: {
  targeting: AncientSimulacrumTargetingState;
  stackKey: string;
}): AncientSimulacrumTargetDescriptor | null {
  return args.targeting.eligibleTargetsByStackKey[args.stackKey]?.[0] ?? null;
}

export function buildAncientSimulacrumBoardTargeting(args: {
  active: boolean;
  targeting: AncientSimulacrumTargetingState;
  hoveredStackKey: string | null;
}): BoardDestroyTargetingViewModel {
  const targetStatesBySide: BoardDestroyTargetingViewModel['targetStatesBySide'] = {
    my: {},
    opponent: {},
  };
  const previewShipDefIdBySide: BoardDestroyTargetingViewModel['previewShipDefIdBySide'] = {
    my: {},
    opponent: {},
  };

  if (!args.active) {
    return {
      activeSourceInstanceId: null,
      targetStatesBySide,
      previewShipDefIdBySide,
    };
  }

  const stackKeys = new Set([
    ...Object.keys(args.targeting.selectedTargetInstanceIdsByStackKey),
    ...Object.keys(args.targeting.eligibleTargetsByStackKey),
  ]);
  for (const stackKey of stackKeys) {
    const isSelected =
      (args.targeting.selectedTargetInstanceIdsByStackKey[stackKey]?.length ?? 0) > 0;
    const isTargetable =
      (args.targeting.eligibleTargetsByStackKey[stackKey]?.length ?? 0) > 0;
    targetStatesBySide.opponent[stackKey] = {
      isTargetable,
      isHovered: isTargetable && args.hoveredStackKey === stackKey,
      isSelected,
      ...(isSelected ? { selectedTone: 'cyan' as const } : {}),
    };
  }

  return {
    activeSourceInstanceId: 'ancient-local-simulacrum',
    targetStatesBySide,
    previewShipDefIdBySide,
  };
}
