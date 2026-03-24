import { useEffect, useRef, useState } from 'react';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import {
  getRenderableActionChoiceIds,
  getRenderableActionRequiredTargetCount,
  getRenderableServerChoiceActions,
  isRenderableTargetedAction,
  isRenderableTargetedActionSelected,
  type RenderableServerAction,
} from './availableActions';
import { deriveFleetStackInfo } from './fleets';
import type { BoardDestroyTargetingViewModel } from './types';

type DestroyTargetSide = 'my' | 'opponent';
type DestroyTargetLocator = {
  side: DestroyTargetSide;
  stackKey: string;
};

export interface UseDestroyTargetingRuntimeParams {
  phaseKey: string;
  phaseInstanceKey: string;
  availableActions: any[] | null | undefined;
  shipChoiceSelectionByInstanceId: Record<string, string>;
  myPlayerId?: string | null;
  opponentPlayerId?: string | null;
  myShips: any[];
  opponentShipsVisible: any[];
  frigateTriggerByInstanceId: Record<string, number>;
}

export interface UseDestroyTargetingRuntimeResult {
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>;
  allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]>;
  boardDestroyTargeting: BoardDestroyTargetingViewModel;
  shouldResetDestroyTargetRows: boolean;
  consumePendingDestroyTargetReset: () => void;
  applyDestroyTargetingChoiceSideEffects: (sourceInstanceId: string, choiceId: string) => void;
  onBoardBackgroundMouseDown: () => void;
  onDestroyTargetStackHoverChange: (side: DestroyTargetSide, stackKey: string | null) => void;
  onDestroyTargetStackMouseDown: (side: DestroyTargetSide, stackKey: string) => void;
}

function makeLocatorKey(side: DestroyTargetSide, stackKey: string): string {
  return `${side}::${stackKey}`;
}

function splitLocatorKey(locatorKey: string): DestroyTargetLocator | null {
  const [side, stackKey] = locatorKey.split('::');
  if ((side !== 'my' && side !== 'opponent') || !stackKey) return null;
  return { side, stackKey };
}

function makeEmptyBoardDestroyTargeting(): BoardDestroyTargetingViewModel {
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

function getActionValidTargetIds(action: RenderableServerAction): Set<string> {
  if (action.kind === 'paired_destroy_target') {
    return new Set(
      [...(Array.isArray(action.validOwnTargets) ? action.validOwnTargets : []), ...(Array.isArray(action.validOpponentTargets) ? action.validOpponentTargets : [])]
        .map((target: any) => target?.instanceId)
        .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
    );
  }

  return new Set(
    Array.isArray(action.validTargets)
      ? action.validTargets
          .map((target: any) => target?.instanceId)
          .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
      : []
  );
}

function getPairedTargetDescriptorsByLocatorKey(args: {
  action: RenderableServerAction;
  visibleTargetIdsByLocatorKey: Record<string, string[]>;
}) {
  const { action, visibleTargetIdsByLocatorKey } = args;
  const ownById = new Map(
    (Array.isArray(action.validOwnTargets) ? action.validOwnTargets : [])
      .map((target: any) => [target.instanceId, target] as const)
  );
  const opponentById = new Map(
    (Array.isArray(action.validOpponentTargets) ? action.validOpponentTargets : [])
      .map((target: any) => [target.instanceId, target] as const)
  );

  const ownDescriptorsByLocatorKey = new Map<string, any[]>();
  const opponentDescriptorsByLocatorKey = new Map<string, any[]>();

  for (const [locatorKey, visibleTargetIds] of Object.entries(visibleTargetIdsByLocatorKey)) {
    const ownMatches = visibleTargetIds
      .map((instanceId) => ownById.get(instanceId) ?? null)
      .filter((target): target is NonNullable<typeof target> => target != null);
    const opponentMatches = visibleTargetIds
      .map((instanceId) => opponentById.get(instanceId) ?? null)
      .filter((target): target is NonNullable<typeof target> => target != null);

    if (ownMatches.length > 0) {
      ownDescriptorsByLocatorKey.set(locatorKey, ownMatches);
    }
    if (opponentMatches.length > 0) {
      opponentDescriptorsByLocatorKey.set(locatorKey, opponentMatches);
    }
  }

  return { ownDescriptorsByLocatorKey, opponentDescriptorsByLocatorKey };
}

function allocateConcreteTargetIdsForLocators(args: {
  action: RenderableServerAction;
  locatorKeys: string[];
  visibleTargetIdsByLocatorKey: Record<string, string[]>;
  reservedTargetIds?: ReadonlySet<string>;
}): string[] {
  const { action, locatorKeys, visibleTargetIdsByLocatorKey, reservedTargetIds } = args;
  const globallyReservedTargetIds = reservedTargetIds ?? new Set<string>();

  if (action.kind === 'paired_destroy_target') {
    const { ownDescriptorsByLocatorKey, opponentDescriptorsByLocatorKey } =
      getPairedTargetDescriptorsByLocatorKey({ action, visibleTargetIdsByLocatorKey });

    if (locatorKeys.length === 0) {
      return [];
    }

    const firstLocatorKey = locatorKeys[0];
    const firstLocator = splitLocatorKey(firstLocatorKey);
    if (!firstLocator) return [];

    const firstCandidates =
      firstLocator.side === 'my'
        ? ownDescriptorsByLocatorKey.get(firstLocatorKey) ?? []
        : opponentDescriptorsByLocatorKey.get(firstLocatorKey) ?? [];
    const firstTarget = firstCandidates.find(
      (target) => !globallyReservedTargetIds.has(target.instanceId)
    );
    if (!firstTarget) return [];

    if (locatorKeys.length === 1) {
      return [firstTarget.instanceId];
    }

    const secondLocatorKey = locatorKeys[1];
    const secondLocator = splitLocatorKey(secondLocatorKey);
    if (!secondLocator || secondLocator.side === firstLocator.side) {
      return [firstTarget.instanceId];
    }

    const secondCandidates =
      secondLocator.side === 'my'
        ? ownDescriptorsByLocatorKey.get(secondLocatorKey) ?? []
        : opponentDescriptorsByLocatorKey.get(secondLocatorKey) ?? [];
    const secondTarget = secondCandidates.find(
      (target) =>
        target.totalLineCost === firstTarget.totalLineCost &&
        target.instanceId !== firstTarget.instanceId &&
        !globallyReservedTargetIds.has(target.instanceId)
    );

    return secondTarget
      ? [firstTarget.instanceId, secondTarget.instanceId]
      : [firstTarget.instanceId];
  }

  const validTargetIds = getActionValidTargetIds(action);
  const usedTargetIds = new Set<string>();
  const allocatedTargetIds: string[] = [];

  for (const locatorKey of locatorKeys) {
    const visibleTargetIds = visibleTargetIdsByLocatorKey[locatorKey] ?? [];
    const candidateTargetId = visibleTargetIds.find(
      (targetInstanceId) =>
        validTargetIds.has(targetInstanceId) &&
        !globallyReservedTargetIds.has(targetInstanceId) &&
        !usedTargetIds.has(targetInstanceId)
    );

    if (!candidateTargetId) {
      break;
    }

    usedTargetIds.add(candidateTargetId);
    allocatedTargetIds.push(candidateTargetId);
  }

  return allocatedTargetIds;
}

function actionShouldAutoArm(
  action: RenderableServerAction,
  shipChoiceSelectionByInstanceId: Record<string, string>,
  selectedLocatorKeys: string[]
): boolean {
  if (!isRenderableTargetedActionSelected(action, shipChoiceSelectionByInstanceId)) {
    return false;
  }

  if (getRenderableActionChoiceIds(action).includes('hold')) {
    return false;
  }

  return selectedLocatorKeys.length < getRenderableActionRequiredTargetCount(action);
}

export function useDestroyTargetingRuntime(
  params: UseDestroyTargetingRuntimeParams
): UseDestroyTargetingRuntimeResult {
  const {
    phaseKey,
    phaseInstanceKey,
    availableActions,
    shipChoiceSelectionByInstanceId,
    myPlayerId,
    opponentPlayerId,
    myShips,
    opponentShipsVisible,
    frigateTriggerByInstanceId,
  } = params;

  const [activeDestroyTargetSourceInstanceId, setActiveDestroyTargetSourceInstanceId] = useState<string | null>(null);
  const [selectedDestroyTargetLocatorKeysBySourceInstanceId, setSelectedDestroyTargetLocatorKeysBySourceInstanceId] =
    useState<Record<string, string[]>>({});
  const [hoveredDestroyTargetLocatorKey, setHoveredDestroyTargetLocatorKey] = useState<string | null>(null);
  const pendingDestroyTargetResetPhaseInstanceKeyRef = useRef<string | null>(null);
  const lastDestroyTargetPhaseInstanceKeyRef = useRef<string | null>(null);

  const destroyTargetActionsBySourceInstanceId = new Map(
    getRenderableServerChoiceActions(phaseKey, availableActions)
      .filter((action) => isRenderableTargetedAction(action))
      .map((action) => [action.sourceInstanceId, action] as const)
  );

  const shouldResetDestroyTargetRows =
    destroyTargetActionsBySourceInstanceId.size > 0 &&
    pendingDestroyTargetResetPhaseInstanceKeyRef.current === phaseInstanceKey;

  const consumePendingDestroyTargetReset = () => {
    if (shouldResetDestroyTargetRows) {
      pendingDestroyTargetResetPhaseInstanceKeyRef.current = null;
    }
  };

  useEffect(() => {
    if (activeDestroyTargetSourceInstanceId == null) {
      setHoveredDestroyTargetLocatorKey(null);
    }
  }, [activeDestroyTargetSourceInstanceId]);

  useEffect(() => {
    if (destroyTargetActionsBySourceInstanceId.size === 0) {
      lastDestroyTargetPhaseInstanceKeyRef.current = null;
      pendingDestroyTargetResetPhaseInstanceKeyRef.current = null;
      return;
    }

    if (lastDestroyTargetPhaseInstanceKeyRef.current === phaseInstanceKey) {
      return;
    }

    lastDestroyTargetPhaseInstanceKeyRef.current = phaseInstanceKey;
    pendingDestroyTargetResetPhaseInstanceKeyRef.current = phaseInstanceKey;
    setActiveDestroyTargetSourceInstanceId(null);
    setHoveredDestroyTargetLocatorKey(null);
    setSelectedDestroyTargetLocatorKeysBySourceInstanceId((prev) =>
      Object.keys(prev).length === 0 ? prev : {}
    );
  }, [destroyTargetActionsBySourceInstanceId.size, phaseInstanceKey]);

  const stackKeyByInstanceId = new Map<string, DestroyTargetLocator>();

  for (const ship of myShips) {
    const instanceId = ship?.instanceId ?? ship?.id;
    if (typeof instanceId !== 'string') continue;

    const stackInfo = deriveFleetStackInfo(ship, frigateTriggerByInstanceId);
    if (!stackInfo) continue;

    stackKeyByInstanceId.set(instanceId, {
      side: 'my',
      stackKey: stackInfo.stackKey,
    });
  }

  for (const ship of opponentShipsVisible) {
    const instanceId = ship?.instanceId ?? ship?.id;
    if (typeof instanceId !== 'string') continue;

    const stackInfo = deriveFleetStackInfo(ship, frigateTriggerByInstanceId);
    if (!stackInfo) continue;

    stackKeyByInstanceId.set(instanceId, {
      side: 'opponent',
      stackKey: stackInfo.stackKey,
    });
  }

  const visibleTargetIdsByLocatorKey: Record<string, string[]> = {};
  for (const [instanceId, locator] of stackKeyByInstanceId.entries()) {
    const locatorKey = makeLocatorKey(locator.side, locator.stackKey);
    if (!visibleTargetIdsByLocatorKey[locatorKey]) {
      visibleTargetIdsByLocatorKey[locatorKey] = [];
    }

    visibleTargetIdsByLocatorKey[locatorKey].push(instanceId);
  }

  for (const targetIds of Object.values(visibleTargetIdsByLocatorKey)) {
    targetIds.sort((a, b) => a.localeCompare(b));
  }

  const validDestroyTargetLocatorKeysBySourceInstanceId: Record<string, string[]> = {};
  for (const [sourceInstanceId, action] of destroyTargetActionsBySourceInstanceId.entries()) {
    const locatorKeys = new Set<string>();

    if (action.kind === 'paired_destroy_target') {
      const ownTargetIds = new Set(
        (Array.isArray(action.validOwnTargets) ? action.validOwnTargets : [])
          .map((target: any) => target?.instanceId)
          .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
      );
      const opponentTargetIds = new Set(
        (Array.isArray(action.validOpponentTargets) ? action.validOpponentTargets : [])
          .map((target: any) => target?.instanceId)
          .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
      );

      for (const [instanceId, locator] of stackKeyByInstanceId.entries()) {
        if (locator.side === 'my' && ownTargetIds.has(instanceId)) {
          locatorKeys.add(makeLocatorKey(locator.side, locator.stackKey));
        }

        if (locator.side === 'opponent' && opponentTargetIds.has(instanceId)) {
          locatorKeys.add(makeLocatorKey(locator.side, locator.stackKey));
        }
      }
    } else {
      const validTargetIds = getActionValidTargetIds(action);

      for (const [instanceId, locator] of stackKeyByInstanceId.entries()) {
        if (!validTargetIds.has(instanceId)) continue;
        locatorKeys.add(makeLocatorKey(locator.side, locator.stackKey));
      }
    }

    validDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] = Array.from(locatorKeys).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  useEffect(() => {
    if (destroyTargetActionsBySourceInstanceId.size === 0) {
      setActiveDestroyTargetSourceInstanceId(null);
      setHoveredDestroyTargetLocatorKey(null);
      setSelectedDestroyTargetLocatorKeysBySourceInstanceId((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      return;
    }

    setSelectedDestroyTargetLocatorKeysBySourceInstanceId((prev) => {
      const next: Record<string, string[]> = {};
      let changed = false;

      for (const [sourceInstanceId, action] of destroyTargetActionsBySourceInstanceId.entries()) {
        if (!isRenderableTargetedActionSelected(action, shipChoiceSelectionByInstanceId)) {
          if ((prev[sourceInstanceId] ?? []).length > 0) {
            changed = true;
          }
          continue;
        }

        const validLocatorKeys = new Set(
          validDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] ?? []
        );
        const requiredTargetCount = getRenderableActionRequiredTargetCount(action);
        const previousSelection = prev[sourceInstanceId] ?? [];
        const cleanedSelection: string[] = [];

        for (const locatorKey of previousSelection) {
          if (cleanedSelection.length >= requiredTargetCount) {
            changed = true;
            continue;
          }

          if (!validLocatorKeys.has(locatorKey)) {
            changed = true;
            continue;
          }

          const proposedSelection = [...cleanedSelection, locatorKey];
          if (
            allocateConcreteTargetIdsForLocators({
              action,
              locatorKeys: proposedSelection,
              visibleTargetIdsByLocatorKey,
            }).length !== proposedSelection.length
          ) {
            changed = true;
            continue;
          }

          cleanedSelection.push(locatorKey);
        }

        if (cleanedSelection.length > 0) {
          next[sourceInstanceId] = cleanedSelection;
        }

        if (
          previousSelection.length !== cleanedSelection.length ||
          previousSelection.some((locatorKey, index) => locatorKey !== cleanedSelection[index])
        ) {
          changed = true;
        }
      }

      if (!changed) {
        const prevKeys = Object.keys(prev);
        if (prevKeys.length !== Object.keys(next).length) {
          changed = true;
        } else {
          for (const key of prevKeys) {
            const prevSelection = prev[key] ?? [];
            const nextSelection = next[key] ?? [];
            if (
              prevSelection.length !== nextSelection.length ||
              prevSelection.some((locatorKey, index) => locatorKey !== nextSelection[index])
            ) {
              changed = true;
              break;
            }
          }
        }
      }

      return changed ? next : prev;
    });

    setActiveDestroyTargetSourceInstanceId((prev) => {
      if (prev == null) return prev;
      const action = destroyTargetActionsBySourceInstanceId.get(prev);
      if (!action) return null;

      return isRenderableTargetedActionSelected(action, shipChoiceSelectionByInstanceId)
        ? prev
        : null;
    });
  }, [
    destroyTargetActionsBySourceInstanceId,
    shipChoiceSelectionByInstanceId,
    validDestroyTargetLocatorKeysBySourceInstanceId,
    visibleTargetIdsByLocatorKey,
  ]);

  useEffect(() => {
    const autoArmSourceInstanceId = Array.from(destroyTargetActionsBySourceInstanceId.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .find(([, action]) =>
        actionShouldAutoArm(
          action,
          shipChoiceSelectionByInstanceId,
          selectedDestroyTargetLocatorKeysBySourceInstanceId[action.sourceInstanceId] ?? []
        )
      )?.[0] ?? null;

    if (!autoArmSourceInstanceId) {
      return;
    }

    setActiveDestroyTargetSourceInstanceId((prev) => {
      if (prev && destroyTargetActionsBySourceInstanceId.has(prev)) {
        return prev;
      }

      return autoArmSourceInstanceId;
    });
  }, [
    destroyTargetActionsBySourceInstanceId,
    shipChoiceSelectionByInstanceId,
    selectedDestroyTargetLocatorKeysBySourceInstanceId,
  ]);

  const allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]> = {};
  const selectedDestroySourcesByLocatorKey: Record<string, string[]> = {};
  const reservedConcreteTargetIds = new Set<string>();

  for (const [sourceInstanceId, action] of destroyTargetActionsBySourceInstanceId.entries()) {
    if (!isRenderableTargetedActionSelected(action, shipChoiceSelectionByInstanceId)) {
      continue;
    }

    const selectedLocatorKeys = selectedDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] ?? [];
    const allocatedTargetIds = allocateConcreteTargetIdsForLocators({
      action,
      locatorKeys: selectedLocatorKeys,
      visibleTargetIdsByLocatorKey,
      reservedTargetIds: reservedConcreteTargetIds,
    });

    if (allocatedTargetIds.length > 0) {
      allocatedDestroyTargetIdsBySourceInstanceId[sourceInstanceId] = allocatedTargetIds;
    }

    if (allocatedTargetIds.length === getRenderableActionRequiredTargetCount(action)) {
      for (const allocatedTargetId of allocatedTargetIds) {
        reservedConcreteTargetIds.add(allocatedTargetId);
      }
    }

    for (const locatorKey of selectedLocatorKeys) {
      if (!selectedDestroySourcesByLocatorKey[locatorKey]) {
        selectedDestroySourcesByLocatorKey[locatorKey] = [];
      }

      selectedDestroySourcesByLocatorKey[locatorKey].push(sourceInstanceId);
    }
  }

  const allocatedDestroyTargetIdBySourceInstanceId: Record<string, string> = {};
  for (const [sourceInstanceId, allocatedTargetIds] of Object.entries(allocatedDestroyTargetIdsBySourceInstanceId)) {
    if (allocatedTargetIds.length > 0) {
      allocatedDestroyTargetIdBySourceInstanceId[sourceInstanceId] = allocatedTargetIds[0];
    }
  }

  const activeDestroyAction =
    activeDestroyTargetSourceInstanceId != null
      ? destroyTargetActionsBySourceInstanceId.get(activeDestroyTargetSourceInstanceId) ?? null
      : null;
  const activeDestroySelectedLocatorKeys =
    activeDestroyTargetSourceInstanceId != null
      ? selectedDestroyTargetLocatorKeysBySourceInstanceId[activeDestroyTargetSourceInstanceId] ?? []
      : [];
  const activeDestroySelectableLocatorKeys = new Set<string>();

  if (activeDestroyAction) {
    const requiredTargetCount = getRenderableActionRequiredTargetCount(activeDestroyAction);
    const canReseedPair =
      activeDestroyAction.kind === 'paired_destroy_target' &&
      activeDestroySelectedLocatorKeys.length >= requiredTargetCount;

    if (activeDestroySelectedLocatorKeys.length < requiredTargetCount || canReseedPair) {
      for (const locatorKey of validDestroyTargetLocatorKeysBySourceInstanceId[activeDestroyAction.sourceInstanceId] ?? []) {
        const proposedSelection =
          canReseedPair ? [locatorKey] : [...activeDestroySelectedLocatorKeys, locatorKey];
        const allocatedTargetIds = allocateConcreteTargetIdsForLocators({
          action: activeDestroyAction,
          locatorKeys: proposedSelection,
          visibleTargetIdsByLocatorKey,
        });

        if (allocatedTargetIds.length === proposedSelection.length) {
          activeDestroySelectableLocatorKeys.add(locatorKey);
        }
      }
    }
  }

  function getDestroyPreviewShipDefIdForSource(sourceInstanceId: string | null): ShipDefId | null {
    if (sourceInstanceId == null) return null;

    const rawActionShipDefId = String(
      destroyTargetActionsBySourceInstanceId.get(sourceInstanceId)?.shipDefId ?? ''
    );
    if (isShipDefId(rawActionShipDefId)) {
      return rawActionShipDefId;
    }

    const sourceShip = myShips.find((ship: any) => {
      const instanceId = ship?.instanceId ?? ship?.id;
      return typeof instanceId === 'string' && instanceId === sourceInstanceId;
    });
    const rawSourceShipDefId = String(sourceShip?.shipDefId ?? '');

    return isShipDefId(rawSourceShipDefId) ? rawSourceShipDefId : null;
  }

  const activeDestroyPreviewShipDefId = getDestroyPreviewShipDefIdForSource(activeDestroyTargetSourceInstanceId);

  const targetStatesBySide: BoardDestroyTargetingViewModel['targetStatesBySide'] = {
    my: {},
    opponent: {},
  };

  const persistentlySelectedLocatorKeys = new Set(
    Object.keys(selectedDestroySourcesByLocatorKey)
  );

  for (const locatorKey of persistentlySelectedLocatorKeys) {
    const locator = splitLocatorKey(locatorKey);
    if (!locator) continue;

    targetStatesBySide[locator.side][locator.stackKey] = {
      isTargetable: false,
      isHovered: false,
      isSelected: true,
    };
  }

  for (const locatorKey of activeDestroySelectableLocatorKeys) {
    const locator = splitLocatorKey(locatorKey);
    if (!locator) continue;

    const existingState = targetStatesBySide[locator.side][locator.stackKey];
    targetStatesBySide[locator.side][locator.stackKey] = {
      isTargetable: true,
      isHovered: hoveredDestroyTargetLocatorKey === locatorKey,
      isSelected:
        existingState?.isSelected === true ||
        activeDestroySelectedLocatorKeys.includes(locatorKey),
    };
  }

  const previewShipDefIdBySide: BoardDestroyTargetingViewModel['previewShipDefIdBySide'] = {
    my: {},
    opponent: {},
  };

  for (const [locatorKey, sourceInstanceIds] of Object.entries(selectedDestroySourcesByLocatorKey)) {
    const locator = splitLocatorKey(locatorKey);
    if (!locator) continue;

    const previewShipDefIds = Array.from(new Set(
      sourceInstanceIds
        .map((sourceInstanceId) => getDestroyPreviewShipDefIdForSource(sourceInstanceId))
        .filter((shipDefId): shipDefId is ShipDefId => shipDefId != null)
    ));

    if (previewShipDefIds.length === 1) {
      previewShipDefIdBySide[locator.side][locator.stackKey] = previewShipDefIds[0];
    }
  }

  if (activeDestroyPreviewShipDefId) {
    if (hoveredDestroyTargetLocatorKey && activeDestroySelectableLocatorKeys.has(hoveredDestroyTargetLocatorKey)) {
      const hoveredLocator = splitLocatorKey(hoveredDestroyTargetLocatorKey);
      if (hoveredLocator) {
        previewShipDefIdBySide[hoveredLocator.side][hoveredLocator.stackKey] = activeDestroyPreviewShipDefId;
      }
    }

    for (const locatorKey of activeDestroySelectedLocatorKeys) {
      const selectedLocator = splitLocatorKey(locatorKey);
      if (!selectedLocator) continue;
      previewShipDefIdBySide[selectedLocator.side][selectedLocator.stackKey] = activeDestroyPreviewShipDefId;
    }
  }

  const applyDestroyTargetingChoiceSideEffects = (sourceInstanceId: string, choiceId: string) => {
    if (!destroyTargetActionsBySourceInstanceId.has(sourceInstanceId)) {
      return;
    }

    if (choiceId !== 'hold') {
      setActiveDestroyTargetSourceInstanceId(sourceInstanceId);
      return;
    }

    setSelectedDestroyTargetLocatorKeysBySourceInstanceId((prev) => {
      if (!(sourceInstanceId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[sourceInstanceId];
      return next;
    });
    setHoveredDestroyTargetLocatorKey(null);
    setActiveDestroyTargetSourceInstanceId((prev) => (
      prev === sourceInstanceId ? null : prev
    ));
  };

  const onBoardBackgroundMouseDown = () => {
    if (activeDestroyTargetSourceInstanceId == null) {
      return;
    }

    const currentSelection =
      selectedDestroyTargetLocatorKeysBySourceInstanceId[activeDestroyTargetSourceInstanceId] ?? [];

    if (currentSelection.length === 0) {
      setActiveDestroyTargetSourceInstanceId(null);
      setHoveredDestroyTargetLocatorKey(null);
      return;
    }

    if (activeDestroyAction?.kind === 'paired_destroy_target') {
      setSelectedDestroyTargetLocatorKeysBySourceInstanceId((prev) => {
        if (!(activeDestroyTargetSourceInstanceId in prev)) {
          return prev;
        }

        const next = { ...prev };
        delete next[activeDestroyTargetSourceInstanceId];
        return next;
      });
      setActiveDestroyTargetSourceInstanceId(null);
      setHoveredDestroyTargetLocatorKey(null);
      return;
    }

    setSelectedDestroyTargetLocatorKeysBySourceInstanceId((prev) => {
      const next = { ...prev };
      const nextSelection = [...(next[activeDestroyTargetSourceInstanceId] ?? [])];
      nextSelection.pop();

      if (nextSelection.length > 0) {
        next[activeDestroyTargetSourceInstanceId] = nextSelection;
      } else {
        delete next[activeDestroyTargetSourceInstanceId];
      }

      return next;
    });

    if (currentSelection.length <= 1) {
      setActiveDestroyTargetSourceInstanceId(null);
    }

    setHoveredDestroyTargetLocatorKey(null);
  };

  const onDestroyTargetStackHoverChange = (side: DestroyTargetSide, stackKey: string | null) => {
    if (activeDestroyTargetSourceInstanceId == null) {
      if (stackKey == null) {
        setHoveredDestroyTargetLocatorKey(null);
      }
      return;
    }

    if (stackKey == null) {
      setHoveredDestroyTargetLocatorKey(null);
      return;
    }

    const locatorKey = makeLocatorKey(side, stackKey);
    if (!activeDestroySelectableLocatorKeys.has(locatorKey)) {
      return;
    }

    setHoveredDestroyTargetLocatorKey(locatorKey);
  };

  const onDestroyTargetStackMouseDown = (side: DestroyTargetSide, stackKey: string) => {
    if (activeDestroyTargetSourceInstanceId == null || !activeDestroyAction) {
      return;
    }

    const locatorKey = makeLocatorKey(side, stackKey);
    if (!activeDestroySelectableLocatorKeys.has(locatorKey)) {
      return;
    }

    setSelectedDestroyTargetLocatorKeysBySourceInstanceId((prev) => {
      const currentSelection = prev[activeDestroyTargetSourceInstanceId] ?? [];
      const requiredTargetCount = getRenderableActionRequiredTargetCount(activeDestroyAction);
      let nextSelection: string[];

      if (activeDestroyAction.kind === 'paired_destroy_target' && currentSelection.length >= requiredTargetCount) {
        nextSelection = [locatorKey];
      } else {
        if (currentSelection.length >= requiredTargetCount) {
          return prev;
        }

        nextSelection = [...currentSelection, locatorKey];
      }

      if (
        allocateConcreteTargetIdsForLocators({
          action: activeDestroyAction,
          locatorKeys: nextSelection,
          visibleTargetIdsByLocatorKey,
        }).length !== nextSelection.length
      ) {
        return prev;
      }

      const previousSelection = prev[activeDestroyTargetSourceInstanceId] ?? [];
      if (
        previousSelection.length === nextSelection.length &&
        previousSelection.every((candidate, index) => candidate === nextSelection[index])
      ) {
        return prev;
      }

      return {
        ...prev,
        [activeDestroyTargetSourceInstanceId]: nextSelection,
      };
    });
    setHoveredDestroyTargetLocatorKey(locatorKey);
  };

  return {
    allocatedDestroyTargetIdBySourceInstanceId,
    allocatedDestroyTargetIdsBySourceInstanceId,
    boardDestroyTargeting:
      myPlayerId || opponentPlayerId
        ? {
            activeSourceInstanceId: activeDestroyTargetSourceInstanceId,
            targetStatesBySide,
            previewShipDefIdBySide,
          }
        : makeEmptyBoardDestroyTargeting(),
    shouldResetDestroyTargetRows,
    consumePendingDestroyTargetReset,
    applyDestroyTargetingChoiceSideEffects,
    onBoardBackgroundMouseDown,
    onDestroyTargetStackHoverChange,
    onDestroyTargetStackMouseDown,
  };
}
