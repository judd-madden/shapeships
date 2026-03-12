import { useEffect, useRef, useState } from 'react';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import { getRenderableServerChoiceActions } from './availableActions';
import { deriveFleetStackInfo } from './fleets';
import type { BoardDestroyTargetingViewModel } from './types';

export interface UseDestroyTargetingRuntimeParams {
  phaseKey: string;
  phaseInstanceKey: string;
  availableActions: any[] | null | undefined;
  shipChoiceSelectionByInstanceId: Record<string, string>;
  myShips: any[];
  opponentShipsVisible: any[];
  frigateTriggerByInstanceId: Record<string, number>;
}

export interface UseDestroyTargetingRuntimeResult {
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>;
  boardDestroyTargeting: BoardDestroyTargetingViewModel;
  shouldResetFirstStrikeDestroyRows: boolean;
  consumePendingFirstStrikeDestroyReset: () => void;
  applyDestroyTargetingChoiceSideEffects: (sourceInstanceId: string, choiceId: string) => void;
  onBoardBackgroundMouseDown: () => void;
  onDestroyTargetStackHoverChange: (stackKey: string | null) => void;
  onDestroyTargetStackMouseDown: (stackKey: string) => void;
}

export function useDestroyTargetingRuntime(
  params: UseDestroyTargetingRuntimeParams
): UseDestroyTargetingRuntimeResult {
  const {
    phaseKey,
    phaseInstanceKey,
    availableActions,
    shipChoiceSelectionByInstanceId,
    myShips,
    opponentShipsVisible,
    frigateTriggerByInstanceId,
  } = params;

  const [activeDestroyTargetSourceInstanceId, setActiveDestroyTargetSourceInstanceId] = useState<string | null>(null);
  const [selectedDestroyTargetStackKeyBySourceInstanceId, setSelectedDestroyTargetStackKeyBySourceInstanceId] = useState<Record<string, string>>({});
  const [hoveredDestroyTargetStackKey, setHoveredDestroyTargetStackKey] = useState<string | null>(null);
  const pendingFirstStrikeDestroyResetPhaseInstanceKeyRef = useRef<string | null>(null);
  const lastFirstStrikePhaseInstanceKeyRef = useRef<string | null>(null);

  const destroyTargetActionsBySourceInstanceId = new Map(
    getRenderableServerChoiceActions(phaseKey, availableActions)
      .filter((action) => action.kind === 'destroy_target')
      .map((action) => [action.sourceInstanceId, action] as const)
  );

  const shouldResetFirstStrikeDestroyRows =
    phaseKey === 'battle.first_strike' &&
    pendingFirstStrikeDestroyResetPhaseInstanceKeyRef.current === phaseInstanceKey;

  const consumePendingFirstStrikeDestroyReset = () => {
    if (shouldResetFirstStrikeDestroyRows) {
      pendingFirstStrikeDestroyResetPhaseInstanceKeyRef.current = null;
    }
  };

  useEffect(() => {
    if (activeDestroyTargetSourceInstanceId == null) {
      setHoveredDestroyTargetStackKey(null);
    }
  }, [activeDestroyTargetSourceInstanceId]);

  useEffect(() => {
    if (phaseKey !== 'battle.first_strike') {
      lastFirstStrikePhaseInstanceKeyRef.current = null;
      pendingFirstStrikeDestroyResetPhaseInstanceKeyRef.current = null;
      return;
    }

    if (lastFirstStrikePhaseInstanceKeyRef.current === phaseInstanceKey) {
      return;
    }

    lastFirstStrikePhaseInstanceKeyRef.current = phaseInstanceKey;
    pendingFirstStrikeDestroyResetPhaseInstanceKeyRef.current = phaseInstanceKey;
    setActiveDestroyTargetSourceInstanceId(null);
    setHoveredDestroyTargetStackKey(null);
    setSelectedDestroyTargetStackKeyBySourceInstanceId((prev) =>
      Object.keys(prev).length === 0 ? prev : {}
    );
  }, [phaseKey, phaseInstanceKey]);

  const opponentVisibleStackKeyByInstanceId = new Map<string, string>();
  for (const ship of opponentShipsVisible) {
    const instanceId = ship?.instanceId ?? ship?.id;
    if (typeof instanceId !== 'string') {
      continue;
    }

    const stackInfo = deriveFleetStackInfo(ship, frigateTriggerByInstanceId);
    if (!stackInfo) {
      continue;
    }

    opponentVisibleStackKeyByInstanceId.set(instanceId, stackInfo.stackKey);
  }

  const visibleTargetIdsByStackKey: Record<string, string[]> = {};
  for (const [instanceId, stackKey] of opponentVisibleStackKeyByInstanceId.entries()) {
    if (!visibleTargetIdsByStackKey[stackKey]) {
      visibleTargetIdsByStackKey[stackKey] = [];
    }

    visibleTargetIdsByStackKey[stackKey].push(instanceId);
  }

  for (const targetIds of Object.values(visibleTargetIdsByStackKey)) {
    targetIds.sort((a, b) => a.localeCompare(b));
  }

  const validDestroyTargetStackKeysBySourceInstanceId: Record<string, string[]> = {};
  for (const [sourceInstanceId, action] of destroyTargetActionsBySourceInstanceId.entries()) {
    const validTargetIds = new Set(
      Array.isArray(action.validTargets)
        ? action.validTargets
            .map((target: any) => target?.instanceId)
            .filter((instanceId: unknown): instanceId is string => typeof instanceId === 'string')
        : []
    );

    const stackKeys = new Set<string>();
    for (const [instanceId, stackKey] of opponentVisibleStackKeyByInstanceId.entries()) {
      if (validTargetIds.has(instanceId)) {
        stackKeys.add(stackKey);
      }
    }

    validDestroyTargetStackKeysBySourceInstanceId[sourceInstanceId] = Array.from(stackKeys).sort((a, b) =>
      a.localeCompare(b)
    );
  }

  const selectedDestroySourcesByStackKey: Record<string, string[]> = {};
  for (const [sourceInstanceId] of destroyTargetActionsBySourceInstanceId.entries()) {
    if (shipChoiceSelectionByInstanceId[sourceInstanceId] !== 'destroy') {
      continue;
    }

    const selectedStackKey = selectedDestroyTargetStackKeyBySourceInstanceId[sourceInstanceId];
    if (!selectedStackKey) {
      continue;
    }

    if (!selectedDestroySourcesByStackKey[selectedStackKey]) {
      selectedDestroySourcesByStackKey[selectedStackKey] = [];
    }

    selectedDestroySourcesByStackKey[selectedStackKey].push(sourceInstanceId);
  }

  const allocatedDestroyTargetIdBySourceInstanceId: Record<string, string> = {};
  for (const stackKey of Object.keys(selectedDestroySourcesByStackKey).sort((a, b) => a.localeCompare(b))) {
    const sourceInstanceIds = [...selectedDestroySourcesByStackKey[stackKey]].sort((a, b) => a.localeCompare(b));
    const visibleTargetIds = visibleTargetIdsByStackKey[stackKey] ?? [];
    const usedTargetIds = new Set<string>();

    for (const sourceInstanceId of sourceInstanceIds) {
      const action = destroyTargetActionsBySourceInstanceId.get(sourceInstanceId);
      if (!action) {
        continue;
      }

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

      if (!candidateTargetId) {
        continue;
      }

      usedTargetIds.add(candidateTargetId);
      allocatedDestroyTargetIdBySourceInstanceId[sourceInstanceId] = candidateTargetId;
    }
  }

  const activeDestroyValidTargetStackKeys = new Set(
    activeDestroyTargetSourceInstanceId != null
      ? validDestroyTargetStackKeysBySourceInstanceId[activeDestroyTargetSourceInstanceId] ?? []
      : []
  );

  const activeDestroySelectedStackKey =
    activeDestroyTargetSourceInstanceId != null
      ? selectedDestroyTargetStackKeyBySourceInstanceId[activeDestroyTargetSourceInstanceId] ?? null
      : null;

  function getDestroyPreviewShipDefIdForSource(sourceInstanceId: string | null): ShipDefId | null {
    if (sourceInstanceId == null) {
      return null;
    }

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

  const allocatedDestroySourceInstanceIdsByStackKey: Record<string, string[]> = {};
  for (const [sourceInstanceId, targetInstanceId] of Object.entries(allocatedDestroyTargetIdBySourceInstanceId).sort(
    ([a], [b]) => a.localeCompare(b)
  )) {
    const stackKey = opponentVisibleStackKeyByInstanceId.get(targetInstanceId);
    if (!stackKey) {
      continue;
    }

    if (!allocatedDestroySourceInstanceIdsByStackKey[stackKey]) {
      allocatedDestroySourceInstanceIdsByStackKey[stackKey] = [];
    }

    allocatedDestroySourceInstanceIdsByStackKey[stackKey].push(sourceInstanceId);
  }

  const persistentlySelectedDestroyStackKeys = new Set(
    Object.keys(allocatedDestroySourceInstanceIdsByStackKey)
  );

  useEffect(() => {
    if (destroyTargetActionsBySourceInstanceId.size === 0) {
      setActiveDestroyTargetSourceInstanceId(null);
      setHoveredDestroyTargetStackKey(null);
      setSelectedDestroyTargetStackKeyBySourceInstanceId((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      return;
    }

    setSelectedDestroyTargetStackKeyBySourceInstanceId((prev) => {
      const next: Record<string, string> = {};
      let changed = false;

      for (const [sourceInstanceId] of destroyTargetActionsBySourceInstanceId.entries()) {
        const selectedStackKey = prev[sourceInstanceId];
        if (!selectedStackKey) {
          continue;
        }

        const validStackKeys = validDestroyTargetStackKeysBySourceInstanceId[sourceInstanceId] ?? [];
        if (validStackKeys.includes(selectedStackKey)) {
          next[sourceInstanceId] = selectedStackKey;
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
    phaseKey,
    availableActions,
    shipChoiceSelectionByInstanceId,
    validDestroyTargetStackKeysBySourceInstanceId,
  ]);

  const destroyTargetStatesByStackKey: BoardDestroyTargetingViewModel['targetStatesByStackKey'] = {};
  for (const stackKey of persistentlySelectedDestroyStackKeys) {
    destroyTargetStatesByStackKey[stackKey] = {
      isTargetable: false,
      isHovered: false,
      isSelected: true,
    };
  }

  for (const stackKey of activeDestroyValidTargetStackKeys) {
    const existingState = destroyTargetStatesByStackKey[stackKey];
    destroyTargetStatesByStackKey[stackKey] = {
      isTargetable: true,
      isHovered: hoveredDestroyTargetStackKey === stackKey,
      isSelected:
        existingState?.isSelected === true ||
        activeDestroySelectedStackKey === stackKey,
    };
  }

  const destroyTargetPreviewShipDefIdByStackKey: BoardDestroyTargetingViewModel['previewShipDefIdByStackKey'] = {};
  for (const [stackKey, sourceInstanceIds] of Object.entries(allocatedDestroySourceInstanceIdsByStackKey)) {
    const previewShipDefIds = Array.from(new Set(
      sourceInstanceIds
        .map((sourceInstanceId) => getDestroyPreviewShipDefIdForSource(sourceInstanceId))
        .filter((shipDefId): shipDefId is ShipDefId => shipDefId != null)
    ));

    if (previewShipDefIds.length === 1) {
      destroyTargetPreviewShipDefIdByStackKey[stackKey] = previewShipDefIds[0];
    }
  }

  if (activeDestroyPreviewShipDefId) {
    if (
      hoveredDestroyTargetStackKey &&
      activeDestroyValidTargetStackKeys.has(hoveredDestroyTargetStackKey)
    ) {
      destroyTargetPreviewShipDefIdByStackKey[hoveredDestroyTargetStackKey] = activeDestroyPreviewShipDefId;
    }

    if (
      activeDestroySelectedStackKey &&
      activeDestroyValidTargetStackKeys.has(activeDestroySelectedStackKey)
    ) {
      destroyTargetPreviewShipDefIdByStackKey[activeDestroySelectedStackKey] = activeDestroyPreviewShipDefId;
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

    setHoveredDestroyTargetStackKey(null);
    setActiveDestroyTargetSourceInstanceId((prev) => (
      prev === sourceInstanceId ? null : prev
    ));
  };

  const onBoardBackgroundMouseDown = () => {
    setActiveDestroyTargetSourceInstanceId(null);
    setHoveredDestroyTargetStackKey(null);
  };

  const onDestroyTargetStackHoverChange = (stackKey: string | null) => {
    if (activeDestroyTargetSourceInstanceId == null) {
      if (stackKey == null) {
        setHoveredDestroyTargetStackKey(null);
      }
      return;
    }

    if (stackKey == null) {
      setHoveredDestroyTargetStackKey(null);
      return;
    }

    if (!activeDestroyValidTargetStackKeys.has(stackKey)) {
      return;
    }

    setHoveredDestroyTargetStackKey(stackKey);
  };

  const onDestroyTargetStackMouseDown = (stackKey: string) => {
    if (activeDestroyTargetSourceInstanceId == null) {
      return;
    }

    setSelectedDestroyTargetStackKeyBySourceInstanceId((prev) => {
      if (prev[activeDestroyTargetSourceInstanceId] === stackKey) {
        return prev;
      }

      return {
        ...prev,
        [activeDestroyTargetSourceInstanceId]: stackKey,
      };
    });
    setHoveredDestroyTargetStackKey(stackKey);
  };

  return {
    allocatedDestroyTargetIdBySourceInstanceId,
    boardDestroyTargeting: {
      activeSourceInstanceId: activeDestroyTargetSourceInstanceId,
      targetStatesByStackKey: destroyTargetStatesByStackKey,
      previewShipDefIdByStackKey: destroyTargetPreviewShipDefIdByStackKey,
    },
    shouldResetFirstStrikeDestroyRows,
    consumePendingFirstStrikeDestroyReset,
    applyDestroyTargetingChoiceSideEffects,
    onBoardBackgroundMouseDown,
    onDestroyTargetStackHoverChange,
    onDestroyTargetStackMouseDown,
  };
}
