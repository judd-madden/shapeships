import { isShipDefId } from '../../data/ShipDefinitions.core';
import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import { ShipType, type ShipDefId } from '../../types/ShipTypes.engine';
import type { AncientManualSolarCast } from './ancientChargeDeclaration';
import type {
  AncientSolarDisplayEntry,
  BoardDestroyTargetingViewModel,
  BoardFleetSummary,
  BoardTargetSelectedTone,
} from './types';

function getShipInstanceId(ship: any): string | null {
  const instanceId = ship?.instanceId ?? ship?.id;
  return typeof instanceId === 'string' && instanceId.length > 0 ? instanceId : null;
}

// ============================================================================
// BLACK HOLE
// ============================================================================

const PROTECTED_ANCIENT_CORE_IDS = new Set<ShipDefId>(['PLU', 'MER', 'NEP']);

export interface AncientBlackHoleTargetingState {
  legalTargetInstanceIds: string[];
  legalTargetInstanceIdsByStackKey: Record<string, string[]>;
  requiredTargetCount: number;
}

export function deriveAncientBlackHoleTargetingState(args: {
  opponentShipsVisible: readonly any[];
  opponentFleet: readonly Pick<BoardFleetSummary, 'stackKey' | 'memberInstanceIds'>[];
  reservedTargetInstanceIds: readonly string[];
}): AncientBlackHoleTargetingState {
  const seenInstanceIds = new Set<string>();
  const reservedTargetInstanceIds = new Set(args.reservedTargetInstanceIds);

  for (const ship of args.opponentShipsVisible) {
    const instanceId = getShipInstanceId(ship);
    const rawShipDefId = String(ship?.shipDefId ?? '');
    if (
      !instanceId ||
      reservedTargetInstanceIds.has(instanceId) ||
      seenInstanceIds.has(instanceId) ||
      !isShipDefId(rawShipDefId)
    ) {
      continue;
    }

    const definition = getShipDefinitionById(rawShipDefId);
    if (
      definition?.type !== ShipType.BASIC ||
      PROTECTED_ANCIENT_CORE_IDS.has(rawShipDefId)
    ) {
      continue;
    }

    seenInstanceIds.add(instanceId);
  }

  const legalTargetInstanceIdsByStackKey: Record<string, string[]> = {};
  for (const stack of args.opponentFleet) {
    const legalMemberInstanceIds = stack.memberInstanceIds
      .filter((instanceId) => seenInstanceIds.has(instanceId))
      .sort((a, b) => a.localeCompare(b));
    if (legalMemberInstanceIds.length > 0) {
      legalTargetInstanceIdsByStackKey[stack.stackKey] = legalMemberInstanceIds;
    }
  }

  const legalTargetInstanceIds = Array.from(
    new Set(Object.values(legalTargetInstanceIdsByStackKey).flat())
  ).sort((a, b) => a.localeCompare(b));

  return {
    legalTargetInstanceIds,
    legalTargetInstanceIdsByStackKey,
    requiredTargetCount: Math.min(2, legalTargetInstanceIds.length),
  };
}

export function deriveAncientBlackHoleDamagePreview(myShips: readonly any[]): number {
  return myShips.reduce((count, ship) => {
    const instanceId = getShipInstanceId(ship);
    const rawShipDefId = String(ship?.shipDefId ?? '');
    return instanceId && isShipDefId(rawShipDefId) && PROTECTED_ANCIENT_CORE_IDS.has(rawShipDefId)
      ? count + 1
      : count;
  }, 0);
}

export function allocateNextAncientBlackHoleTarget(args: {
  targeting: AncientBlackHoleTargetingState;
  selectedTargetInstanceIds: readonly string[];
  stackKey: string;
}): string | null {
  const selected = new Set(args.selectedTargetInstanceIds);
  return args.targeting.legalTargetInstanceIdsByStackKey[args.stackKey]
    ?.find((instanceId) => !selected.has(instanceId)) ?? null;
}

export function buildAncientBlackHoleBoardTargeting(args: {
  active: boolean;
  targeting: AncientBlackHoleTargetingState;
  selectedTargetInstanceIds: readonly string[];
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

  const selectedIds = new Set(args.selectedTargetInstanceIds);
  for (const [stackKey, instanceIds] of Object.entries(
    args.targeting.legalTargetInstanceIdsByStackKey
  )) {
    const isSelected = instanceIds.some((instanceId) => selectedIds.has(instanceId));
    const hasUnselectedInstance = instanceIds.some((instanceId) => !selectedIds.has(instanceId));
    const isTargetable =
      args.selectedTargetInstanceIds.length < args.targeting.requiredTargetCount &&
      hasUnselectedInstance;
    const isHovered = isTargetable && args.hoveredStackKey === stackKey;

    targetStatesBySide.opponent[stackKey] = {
      isTargetable,
      isHovered,
      isSelected,
    };
    if (isSelected || isHovered) {
      previewShipDefIdBySide.opponent[stackKey] = 'SBLA';
    }
  }

  return {
    activeSourceInstanceId: 'ancient-local-black-hole',
    targetStatesBySide,
    previewShipDefIdBySide,
  };
}

// ============================================================================
// SIMULACRUM
// ============================================================================

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

function getValidSimulacrumTargetDescriptor(
  ship: any
): AncientSimulacrumTargetDescriptor | null {
  const targetInstanceId = getShipInstanceId(ship);
  const rawShipDefId = String(ship?.shipDefId ?? '');
  if (!targetInstanceId || !isShipDefId(rawShipDefId)) {
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

// ============================================================================
// SHARED MARKERS
// ============================================================================

function makeEmptyTargetingViewModel(): BoardDestroyTargetingViewModel {
  return {
    activeSourceInstanceId: null,
    targetStatesBySide: {
      my: {},
      opponent: {},
    },
    previewShipDefIdBySide: {
      my: {},
      opponent: {},
    },
  };
}

export function buildPersistentAncientSolarTargetMarkers(args: {
  active: boolean;
  solarEntries: readonly AncientSolarDisplayEntry[];
  myFleet: readonly BoardFleetSummary[];
  opponentFleet: readonly BoardFleetSummary[];
}): BoardDestroyTargetingViewModel {
  const targeting = makeEmptyTargetingViewModel();
  if (!args.active) {
    return targeting;
  }

  const toneByInstanceId = new Map<string, BoardTargetSelectedTone>();
  for (const entry of args.solarEntries) {
    const marker = entry.targetMarker;
    if (!marker) continue;

    for (const instanceId of marker.targetInstanceIds) {
      const existingTone = toneByInstanceId.get(instanceId);
      if (marker.tone === 'red' || existingTone == null) {
        toneByInstanceId.set(instanceId, marker.tone);
      }
    }
  }

  const addFleetMarkers = (
    side: keyof BoardDestroyTargetingViewModel['targetStatesBySide'],
    fleet: readonly BoardFleetSummary[]
  ) => {
    for (const stack of fleet) {
      let selectedTone: BoardTargetSelectedTone | null = null;
      for (const instanceId of stack.memberInstanceIds) {
        const instanceTone = toneByInstanceId.get(instanceId);
        if (instanceTone === 'red') {
          selectedTone = 'red';
          break;
        }
        if (instanceTone === 'cyan') {
          selectedTone = 'cyan';
        }
      }

      if (selectedTone) {
        targeting.targetStatesBySide[side][stack.stackKey] = {
          isTargetable: false,
          isHovered: false,
          isSelected: true,
          selectedTone,
        };
      }
    }
  };

  addFleetMarkers('my', args.myFleet);
  addFleetMarkers('opponent', args.opponentFleet);
  return targeting;
}

export function overlayAncientSolarTargetMarkers(args: {
  activeTargeting: BoardDestroyTargetingViewModel;
  persistentMarkers: BoardDestroyTargetingViewModel;
}): BoardDestroyTargetingViewModel {
  const mergeSide = (
    side: keyof BoardDestroyTargetingViewModel['targetStatesBySide']
  ): BoardDestroyTargetingViewModel['targetStatesBySide'][typeof side] => {
    const activeStates = args.activeTargeting.targetStatesBySide[side];
    const persistentStates = args.persistentMarkers.targetStatesBySide[side];
    const stackKeys = new Set([
      ...Object.keys(persistentStates),
      ...Object.keys(activeStates),
    ]);
    const mergedStates: BoardDestroyTargetingViewModel['targetStatesBySide'][typeof side] = {};

    for (const stackKey of stackKeys) {
      const active = activeStates[stackKey];
      const persistent = persistentStates[stackKey];
      const selectedTone = persistent?.selectedTone ?? active?.selectedTone;
      mergedStates[stackKey] = {
        isSelected:
          persistent?.isSelected === true || active?.isSelected === true,
        isTargetable:
          active?.isTargetable ?? persistent?.isTargetable ?? false,
        isHovered: active?.isHovered ?? persistent?.isHovered ?? false,
        ...(selectedTone ? { selectedTone } : {}),
      };
    }

    return mergedStates;
  };

  return {
    activeSourceInstanceId: args.activeTargeting.activeSourceInstanceId,
    targetStatesBySide: {
      my: mergeSide('my'),
      opponent: mergeSide('opponent'),
    },
    previewShipDefIdBySide: {
      my: { ...args.activeTargeting.previewShipDefIdBySide.my },
      opponent: { ...args.activeTargeting.previewShipDefIdBySide.opponent },
    },
  };
}
