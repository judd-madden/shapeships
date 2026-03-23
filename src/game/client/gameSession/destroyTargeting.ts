import { useEffect, useRef, useState } from 'react';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import {
  getRenderableActionChoiceIds,
  getRenderableActionRequiredTargetCount,
  getRenderableServerChoiceActions,
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
  return new Set(
    Array.isArray(action.validTargets)
      ? action.validTargets
          .map((target: any) => target?.instanceId)
          .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
      : []
  );
}

function allocateConcreteTargetIdsForLocators(args: {
  action: RenderableServerAction;
  locatorKeys: string[];
  visibleTargetIdsByLocatorKey: Record<string, string[]>;
}): string[] {
  const { action, locatorKeys, visibleTargetIdsByLocatorKey } = args;
  const validTargetIds = getActionValidTargetIds(action);
  const usedTargetIds = new Set<string>();
  const allocatedTargetIds: string[] = [];

  for (const locatorKey of locatorKeys) {
    const visibleTargetIds = visibleTargetIdsByLocatorKey[locatorKey] ?? [];
    const candidateTargetId = visibleTargetIds.find(
      (targetInstanceId) =>
        validTargetIds.has(targetInstanceId) &&
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
      .filter((action) => action.kind === 'destroy_target')
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
    const validTargetIds = getActionValidTargetIds(action);
    const locatorKeys = new Set<string>();

    for (const [instanceId, locator] of stackKeyByInstanceId.entries()) {
      if (!validTargetIds.has(instanceId)) continue;
      locatorKeys.add(makeLocatorKey(locator.side, locator.stackKey));
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

  for (const [sourceInstanceId, action] of destroyTargetActionsBySourceInstanceId.entries()) {
    if (!isRenderableTargetedActionSelected(action, shipChoiceSelectionByInstanceId)) {
      continue;
    }

    const selectedLocatorKeys = selectedDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] ?? [];
    const allocatedTargetIds = allocateConcreteTargetIdsForLocators({
      action,
      locatorKeys: selectedLocatorKeys,
      visibleTargetIdsByLocatorKey,
    });

    if (allocatedTargetIds.length > 0) {
      allocatedDestroyTargetIdsBySourceInstanceId[sourceInstanceId] = allocatedTargetIds;
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
    if (activeDestroySelectedLocatorKeys.length < requiredTargetCount) {
      for (const locatorKey of validDestroyTargetLocatorKeysBySourceInstanceId[activeDestroyAction.sourceInstanceId] ?? []) {
        const proposedSelection = [...activeDestroySelectedLocatorKeys, locatorKey];
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

      if (currentSelection.length >= requiredTargetCount) {
        return prev;
      }

      const nextSelection = [...currentSelection, locatorKey];
      if (
        allocateConcreteTargetIdsForLocators({
          action: activeDestroyAction,
          locatorKeys: nextSelection,
          visibleTargetIdsByLocatorKey,
        }).length !== nextSelection.length
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
