import { isShipDefId } from '../../data/ShipDefinitions.core';
import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import { ShipType, type ShipDefId } from '../../types/ShipTypes.engine';
import type { BoardDestroyTargetingViewModel, BoardFleetSummary } from './types';

const PROTECTED_ANCIENT_CORE_IDS = new Set<ShipDefId>(['PLU', 'MER', 'NEP']);

export interface AncientBlackHoleTargetingState {
  legalTargetInstanceIds: string[];
  legalTargetInstanceIdsByStackKey: Record<string, string[]>;
  requiredTargetCount: number;
}

function getShipInstanceId(ship: any): string | null {
  const instanceId = ship?.instanceId ?? ship?.id;
  return typeof instanceId === 'string' && instanceId.length > 0 ? instanceId : null;
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
