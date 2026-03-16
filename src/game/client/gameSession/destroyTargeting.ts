import { useEffect, useRef, useState } from 'react';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { getRenderableServerChoiceActions } from './availableActions';
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
  const [selectedDestroyTargetLocatorKeyBySourceInstanceId, setSelectedDestroyTargetLocatorKeyBySourceInstanceId] = useState<Record<string, string>>({});
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
    setSelectedDestroyTargetLocatorKeyBySourceInstanceId((prev) =>
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
    const validTargetIds = new Set(
      Array.isArray(action.validTargets)
        ? action.validTargets
            .map((target: any) => target?.instanceId)
            .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
        : []
    );

    const locatorKeys = new Set<string>();
    for (const [instanceId, locator] of stackKeyByInstanceId.entries()) {
      if (!validTargetIds.has(instanceId)) continue;
      locatorKeys.add(makeLocatorKey(locator.side, locator.stackKey));
    }

    validDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] = Array.from(locatorKeys).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  const selectedDestroySourcesByLocatorKey: Record<string, string[]> = {};
  for (const [sourceInstanceId] of destroyTargetActionsBySourceInstanceId.entries()) {
    if (shipChoiceSelectionByInstanceId[sourceInstanceId] !== 'destroy') {
      continue;
    }

    const selectedLocatorKey = selectedDestroyTargetLocatorKeyBySourceInstanceId[sourceInstanceId];
    if (!selectedLocatorKey) continue;

    if (!selectedDestroySourcesByLocatorKey[selectedLocatorKey]) {
      selectedDestroySourcesByLocatorKey[selectedLocatorKey] = [];
    }

    selectedDestroySourcesByLocatorKey[selectedLocatorKey].push(sourceInstanceId);
  }

  const allocatedDestroyTargetIdBySourceInstanceId: Record<string, string> = {};
  for (const locatorKey of Object.keys(selectedDestroySourcesByLocatorKey).sort((a, b) => a.localeCompare(b))) {
    const sourceInstanceIds = [...selectedDestroySourcesByLocatorKey[locatorKey]].sort((a, b) => a.localeCompare(b));
    const visibleTargetIds = visibleTargetIdsByLocatorKey[locatorKey] ?? [];
    const usedTargetIds = new Set<string>();

    for (const sourceInstanceId of sourceInstanceIds) {
      const action = destroyTargetActionsBySourceInstanceId.get(sourceInstanceId);
      if (!action) continue;

      const validTargetIds = new Set(
        Array.isArray(action.validTargets)
          ? action.validTargets
              .map((target: any) => target?.instanceId)
              .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
          : []
      );

      const candidateTargetId = visibleTargetIds.find(
        (targetInstanceId) =>
          validTargetIds.has(targetInstanceId) &&
          !usedTargetIds.has(targetInstanceId)
      );

      if (!candidateTargetId) continue;

      usedTargetIds.add(candidateTargetId);
      allocatedDestroyTargetIdBySourceInstanceId[sourceInstanceId] = candidateTargetId;
    }
  }

  const activeDestroyValidTargetLocatorKeys = new Set(
    activeDestroyTargetSourceInstanceId != null
      ? validDestroyTargetLocatorKeysBySourceInstanceId[activeDestroyTargetSourceInstanceId] ?? []
      : []
  );

  const activeDestroySelectedLocatorKey =
    activeDestroyTargetSourceInstanceId != null
      ? selectedDestroyTargetLocatorKeyBySourceInstanceId[activeDestroyTargetSourceInstanceId] ?? null
      : null;

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

  const allocatedDestroySourceInstanceIdsByLocatorKey: Record<string, string[]> = {};
  for (const [sourceInstanceId, targetInstanceId] of Object.entries(allocatedDestroyTargetIdBySourceInstanceId).sort(
    ([a], [b]) => a.localeCompare(b)
  )) {
    const locator = stackKeyByInstanceId.get(targetInstanceId);
    if (!locator) continue;

    const locatorKey = makeLocatorKey(locator.side, locator.stackKey);
    if (!allocatedDestroySourceInstanceIdsByLocatorKey[locatorKey]) {
      allocatedDestroySourceInstanceIdsByLocatorKey[locatorKey] = [];
    }

    allocatedDestroySourceInstanceIdsByLocatorKey[locatorKey].push(sourceInstanceId);
  }

  const persistentlySelectedLocatorKeys = new Set(
    Object.keys(allocatedDestroySourceInstanceIdsByLocatorKey)
  );

  useEffect(() => {
    if (destroyTargetActionsBySourceInstanceId.size === 0) {
      setActiveDestroyTargetSourceInstanceId(null);
      setHoveredDestroyTargetLocatorKey(null);
      setSelectedDestroyTargetLocatorKeyBySourceInstanceId((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      return;
    }

    setSelectedDestroyTargetLocatorKeyBySourceInstanceId((prev) => {
      const next: Record<string, string> = {};
      let changed = false;

      for (const [sourceInstanceId] of destroyTargetActionsBySourceInstanceId.entries()) {
        const selectedLocatorKey = prev[sourceInstanceId];
        if (!selectedLocatorKey) continue;

        const validLocatorKeys = validDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] ?? [];
        if (validLocatorKeys.includes(selectedLocatorKey)) {
          next[sourceInstanceId] = selectedLocatorKey;
        } else {
          changed = true;
        }
      }

      if (!changed) {
        const prevKeys = Object.keys(prev);
        if (prevKeys.length !== Object.keys(next).length) {
          changed = true;
        } else {
          for (const key of prevKeys) {
            if (prev[key] !== next[key]) {
              changed = true;
              break;
            }
          }
        }
      }

      return changed ? next : prev;
    });

    setActiveDestroyTargetSourceInstanceId((prev) => {
      if (
        prev &&
        destroyTargetActionsBySourceInstanceId.has(prev) &&
        shipChoiceSelectionByInstanceId[prev] === 'destroy'
      ) {
        return prev;
      }

      return null;
    });
  }, [
    destroyTargetActionsBySourceInstanceId,
    shipChoiceSelectionByInstanceId,
    validDestroyTargetLocatorKeysBySourceInstanceId,
  ]);

  const targetStatesBySide: BoardDestroyTargetingViewModel['targetStatesBySide'] = {
    my: {},
    opponent: {},
  };

  for (const locatorKey of persistentlySelectedLocatorKeys) {
    const locator = splitLocatorKey(locatorKey);
    if (!locator) continue;

    targetStatesBySide[locator.side][locator.stackKey] = {
      isTargetable: false,
      isHovered: false,
      isSelected: true,
    };
  }

  for (const locatorKey of activeDestroyValidTargetLocatorKeys) {
    const locator = splitLocatorKey(locatorKey);
    if (!locator) continue;

    const existingState = targetStatesBySide[locator.side][locator.stackKey];
    targetStatesBySide[locator.side][locator.stackKey] = {
      isTargetable: true,
      isHovered: hoveredDestroyTargetLocatorKey === locatorKey,
      isSelected:
        existingState?.isSelected === true ||
        activeDestroySelectedLocatorKey === locatorKey,
    };
  }

  const previewShipDefIdBySide: BoardDestroyTargetingViewModel['previewShipDefIdBySide'] = {
    my: {},
    opponent: {},
  };

  for (const [locatorKey, sourceInstanceIds] of Object.entries(allocatedDestroySourceInstanceIdsByLocatorKey)) {
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
    if (hoveredDestroyTargetLocatorKey && activeDestroyValidTargetLocatorKeys.has(hoveredDestroyTargetLocatorKey)) {
      const hoveredLocator = splitLocatorKey(hoveredDestroyTargetLocatorKey);
      if (hoveredLocator) {
        previewShipDefIdBySide[hoveredLocator.side][hoveredLocator.stackKey] = activeDestroyPreviewShipDefId;
      }
    }

    if (activeDestroySelectedLocatorKey && activeDestroyValidTargetLocatorKeys.has(activeDestroySelectedLocatorKey)) {
      const selectedLocator = splitLocatorKey(activeDestroySelectedLocatorKey);
      if (selectedLocator) {
        previewShipDefIdBySide[selectedLocator.side][selectedLocator.stackKey] = activeDestroyPreviewShipDefId;
      }
    }
  }

  const applyDestroyTargetingChoiceSideEffects = (sourceInstanceId: string, choiceId: string) => {
    if (!destroyTargetActionsBySourceInstanceId.has(sourceInstanceId)) {
      return;
    }

    if (choiceId === 'destroy') {
      setActiveDestroyTargetSourceInstanceId(sourceInstanceId);
      return;
    }

    setHoveredDestroyTargetLocatorKey(null);
    setActiveDestroyTargetSourceInstanceId((prev) => (
      prev === sourceInstanceId ? null : prev
    ));
  };

  const onBoardBackgroundMouseDown = () => {
    setActiveDestroyTargetSourceInstanceId(null);
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
    if (!activeDestroyValidTargetLocatorKeys.has(locatorKey)) {
      return;
    }

    setHoveredDestroyTargetLocatorKey(locatorKey);
  };

  const onDestroyTargetStackMouseDown = (side: DestroyTargetSide, stackKey: string) => {
    if (activeDestroyTargetSourceInstanceId == null) {
      return;
    }

    const locatorKey = makeLocatorKey(side, stackKey);
    if (!activeDestroyValidTargetLocatorKeys.has(locatorKey)) {
      return;
    }

    setSelectedDestroyTargetLocatorKeyBySourceInstanceId((prev) => {
      if (prev[activeDestroyTargetSourceInstanceId] === locatorKey) {
        return prev;
      }

      return {
        ...prev,
        [activeDestroyTargetSourceInstanceId]: locatorKey,
      };
    });
    setHoveredDestroyTargetLocatorKey(locatorKey);
  };

  return {
    allocatedDestroyTargetIdBySourceInstanceId,
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
