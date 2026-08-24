import { useEffect, useRef, useState } from 'react';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import {
  getRenderableActionRequiredTargetCount,
  getFirstStrikeFamilyForAction,
  getRenderableServerChoiceActions,
  isRenderableTargetedAction,
  isRenderableTargetedActionSelected,
  type RenderableServerAction,
} from './availableActions';
import { deriveFleetStackInfo } from './fleets';
import {
  buildExactDestroyTargetPresentationEntries,
  type AllocatedDestroyTargetPresentationSource,
  type ExactTargetPresentationEntry,
} from './fleetPresentation';
import type {
  BoardDestroyTargetingViewModel,
  BoardTargetSelectedTone,
  FirstStrikeActionFamily,
} from './types';
import {
  allocatePinnedTargetIdsForLocators as allocateConcreteTargetIdsForLocators,
  clearDestroyTargetDraftSource,
  deriveDestroyTargetSelectionEdit,
  resolveDestroyTargetFocus,
  type DestroyTargetDraftState,
  type DestroyTargetFocusState,
} from './destroyTargetingDraft';

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
  activeFirstStrikeFamily?: FirstStrikeActionFamily | null;
  firstStrikeFamilyRankByFamily?: Partial<Record<FirstStrikeActionFamily, number>>;
}

export interface UseDestroyTargetingRuntimeResult {
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>;
  allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]>;
  destroyTargetSatisfiedBySourceInstanceId: Record<string, boolean>;
  boardDestroyTargeting: BoardDestroyTargetingViewModel;
  exactTargetPresentationEntries: ExactTargetPresentationEntry[];
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

type DestroyTargetSourceAnalysis = {
  sourceInstanceId: string;
  requiredTargetCount: number;
  cleanedSelectedLocatorKeys: string[];
  allocatedTargetIds: string[];
  allocatableNextLocatorKeys: string[];
  hasAllocatableNextLocator: boolean;
  isFullyAllocated: boolean;
  isSatisfied: boolean;
};

function getAllocatableLocatorKeysForAction(args: {
  action: RenderableServerAction,
  selectedLocatorKeys: string[];
  selectedExactTargetIds: string[];
  validLocatorKeys: string[];
  visibleTargetIdsByLocatorKey: Record<string, string[]>;
  reservedTargetIds: ReadonlySet<string>;
}): string[] {
  const {
    action,
    selectedLocatorKeys,
    selectedExactTargetIds,
    validLocatorKeys,
    visibleTargetIdsByLocatorKey,
    reservedTargetIds,
  } = args;
  const requiredTargetCount = getRenderableActionRequiredTargetCount(action);
  const canReseedPair =
    action.kind === 'paired_destroy_target' &&
    selectedLocatorKeys.length >= requiredTargetCount;
  const canReplaceSingleTarget =
    action.kind !== 'paired_destroy_target' &&
    requiredTargetCount === 1 &&
    selectedLocatorKeys.length >= requiredTargetCount;

  if (
    !canReseedPair &&
    !canReplaceSingleTarget &&
    selectedLocatorKeys.length >= requiredTargetCount
  ) {
    return [];
  }

  const allocatableLocatorKeys: string[] = [];
  for (const locatorKey of validLocatorKeys) {
    const proposedSelection =
      canReseedPair || canReplaceSingleTarget
        ? [locatorKey]
        : [...selectedLocatorKeys, locatorKey];
    const replacementReservedTargetIds = canReplaceSingleTarget
      ? new Set([...reservedTargetIds, ...selectedExactTargetIds])
      : reservedTargetIds;
    const allocatedTargetIds = allocateConcreteTargetIdsForLocators({
      action,
      locatorKeys: proposedSelection,
      visibleTargetIdsByLocatorKey,
      reservedTargetIds: replacementReservedTargetIds,
      preferredTargetIds:
        canReseedPair || canReplaceSingleTarget
          ? []
          : selectedExactTargetIds,
    });

    if (allocatedTargetIds.length === proposedSelection.length) {
      allocatableLocatorKeys.push(locatorKey);
    }
  }

  return allocatableLocatorKeys;
}

function areStringArrayMapsEqual(
  a: Record<string, string[]>,
  b: Record<string, string[]>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    const aSelection = a[key] ?? [];
    const bSelection = b[key] ?? [];
    if (
      aSelection.length !== bSelection.length ||
      aSelection.some((locatorKey, index) => locatorKey !== bSelection[index])
    ) {
      return false;
    }
  }

  return true;
}

function areDestroyTargetDraftStatesEqual(
  a: DestroyTargetDraftState,
  b: DestroyTargetDraftState
): boolean {
  return (
    areStringArrayMapsEqual(
      a.locatorKeysBySourceInstanceId,
      b.locatorKeysBySourceInstanceId
    ) &&
    areStringArrayMapsEqual(
      a.exactTargetIdsBySourceInstanceId,
      b.exactTargetIdsBySourceInstanceId
    )
  );
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
    activeFirstStrikeFamily,
    firstStrikeFamilyRankByFamily,
  } = params;

  const [destroyTargetFocus, setDestroyTargetFocus] =
    useState<DestroyTargetFocusState>(null);
  const activeDestroyTargetSourceInstanceId =
    destroyTargetFocus?.sourceInstanceId ?? null;
  const [destroyTargetDraft, setDestroyTargetDraft] =
    useState<DestroyTargetDraftState>({
      locatorKeysBySourceInstanceId: {},
      exactTargetIdsBySourceInstanceId: {},
    });
  const [hoveredDestroyTargetLocatorKey, setHoveredDestroyTargetLocatorKey] = useState<string | null>(null);
  const pendingDestroyTargetResetPhaseInstanceKeyRef = useRef<string | null>(null);
  const lastDestroyTargetPhaseInstanceKeyRef = useRef<string | null>(null);

  const destroyTargetActionEntries = getRenderableServerChoiceActions(phaseKey, availableActions)
    .filter((action) => isRenderableTargetedAction(action))
    .map((action) => [action.sourceInstanceId, action] as const);
  const isMixedFirstStrikeTargeting =
    phaseKey === 'battle.first_strike' &&
    firstStrikeFamilyRankByFamily != null;
  const orderedDestroyTargetActionEntries = isMixedFirstStrikeTargeting
    ? destroyTargetActionEntries
        .map((entry, projectedIndex) => ({ entry, projectedIndex }))
        .sort((a, b) => {
          const aFamily = getFirstStrikeFamilyForAction(a.entry[1]);
          const bFamily = getFirstStrikeFamilyForAction(b.entry[1]);
          const aRank =
            aFamily == null
              ? Number.POSITIVE_INFINITY
              : firstStrikeFamilyRankByFamily[aFamily] ?? Number.POSITIVE_INFINITY;
          const bRank =
            bFamily == null
              ? Number.POSITIVE_INFINITY
              : firstStrikeFamilyRankByFamily[bFamily] ?? Number.POSITIVE_INFINITY;

          return aRank !== bRank
            ? aRank - bRank
            : a.projectedIndex - b.projectedIndex;
        })
        .map(({ entry }) => entry)
    : destroyTargetActionEntries;
  const destroyTargetActionsBySourceInstanceId = new Map(
    destroyTargetActionEntries
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
      setDestroyTargetFocus(null);
      setHoveredDestroyTargetLocatorKey(null);
      setDestroyTargetDraft((prev) =>
        Object.keys(prev.locatorKeysBySourceInstanceId).length === 0 &&
        Object.keys(prev.exactTargetIdsBySourceInstanceId).length === 0
          ? prev
          : {
              locatorKeysBySourceInstanceId: {},
              exactTargetIdsBySourceInstanceId: {},
            }
      );
      return;
    }

    if (lastDestroyTargetPhaseInstanceKeyRef.current === phaseInstanceKey) {
      return;
    }

    lastDestroyTargetPhaseInstanceKeyRef.current = phaseInstanceKey;
    pendingDestroyTargetResetPhaseInstanceKeyRef.current = phaseInstanceKey;
    setDestroyTargetFocus(null);
    setHoveredDestroyTargetLocatorKey(null);
    setDestroyTargetDraft((prev) =>
      Object.keys(prev.locatorKeysBySourceInstanceId).length === 0 &&
      Object.keys(prev.exactTargetIdsBySourceInstanceId).length === 0
        ? prev
        : {
            locatorKeysBySourceInstanceId: {},
            exactTargetIdsBySourceInstanceId: {},
          }
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

  const allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]> = {};
  const destroyTargetSatisfiedBySourceInstanceId: Record<string, boolean> = {};
  const cleanedDestroyTargetLocatorKeysBySourceInstanceId: Record<string, string[]> = {};
  const destroyTargetSourceAnalysisBySourceInstanceId: Record<string, DestroyTargetSourceAnalysis> = {};
  const selectedDestroySourcesByLocatorKey: Record<string, string[]> = {};
  const allocatedDestroyTargetPresentationSources: AllocatedDestroyTargetPresentationSource[] = [];
  const reservedConcreteTargetIds = new Set<string>();
  const stablePinnedTargetIdsBySourceInstanceId: Record<string, string[]> = {};
  const claimedPinnedTargetIds = new Set<string>();

  for (const [sourceInstanceId, action] of orderedDestroyTargetActionEntries) {
    if (!isRenderableTargetedActionSelected(action, shipChoiceSelectionByInstanceId)) {
      continue;
    }

    const locatorKeys =
      destroyTargetDraft.locatorKeysBySourceInstanceId[sourceInstanceId] ?? [];
    const pinnedTargetIds =
      destroyTargetDraft.exactTargetIdsBySourceInstanceId[sourceInstanceId] ?? [];
    const validLocatorKeys = new Set(
      validDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] ?? []
    );
    const actionValidTargetIds = getActionValidTargetIds(action);
    const stablePins: string[] = [];

    for (let index = 0; index < locatorKeys.length; index += 1) {
      const locatorKey = locatorKeys[index];
      const pinnedTargetId = pinnedTargetIds[index];
      if (
        pinnedTargetId == null ||
        !validLocatorKeys.has(locatorKey) ||
        !(visibleTargetIdsByLocatorKey[locatorKey] ?? []).includes(pinnedTargetId) ||
        !actionValidTargetIds.has(pinnedTargetId) ||
        claimedPinnedTargetIds.has(pinnedTargetId)
      ) {
        continue;
      }

      stablePins[index] = pinnedTargetId;
      claimedPinnedTargetIds.add(pinnedTargetId);
    }

    if (stablePins.some((targetId) => targetId != null)) {
      stablePinnedTargetIdsBySourceInstanceId[sourceInstanceId] = stablePins;
    }
  }

  for (const [sourceInstanceId, action] of orderedDestroyTargetActionEntries) {
    if (!isRenderableTargetedActionSelected(action, shipChoiceSelectionByInstanceId)) {
      destroyTargetSatisfiedBySourceInstanceId[sourceInstanceId] = true;
      continue;
    }

    const validLocatorKeys = validDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] ?? [];
    const validLocatorKeySet = new Set(validLocatorKeys);
    const requiredTargetCount = getRenderableActionRequiredTargetCount(action);
    const rawSelectedLocatorKeys =
      destroyTargetDraft.locatorKeysBySourceInstanceId[sourceInstanceId] ?? [];
    const rawPinnedTargetIds =
      stablePinnedTargetIdsBySourceInstanceId[sourceInstanceId] ?? [];
    const cleanedSelectedLocatorKeys: string[] = [];
    const cleanedPreferredTargetIds: string[] = [];
    const sourceReservedTargetIds = new Set(reservedConcreteTargetIds);

    for (const [otherSourceInstanceId, targetIds] of Object.entries(
      stablePinnedTargetIdsBySourceInstanceId
    )) {
      if (otherSourceInstanceId === sourceInstanceId) continue;
      for (const targetId of targetIds) {
        if (targetId != null) sourceReservedTargetIds.add(targetId);
      }
    }

    for (let index = 0; index < rawSelectedLocatorKeys.length; index += 1) {
      const locatorKey = rawSelectedLocatorKeys[index];
      if (cleanedSelectedLocatorKeys.length >= requiredTargetCount) {
        continue;
      }

      if (!validLocatorKeySet.has(locatorKey)) {
        continue;
      }

      const proposedSelection = [...cleanedSelectedLocatorKeys, locatorKey];
      const proposedPreferredTargetIds = [
        ...cleanedPreferredTargetIds,
        rawPinnedTargetIds[index],
      ];
      const allocatedTargetIds = allocateConcreteTargetIdsForLocators({
        action,
        locatorKeys: proposedSelection,
        visibleTargetIdsByLocatorKey,
        reservedTargetIds: sourceReservedTargetIds,
        preferredTargetIds: proposedPreferredTargetIds,
      });
      if (allocatedTargetIds.length !== proposedSelection.length) {
        continue;
      }

      cleanedSelectedLocatorKeys.push(locatorKey);
      cleanedPreferredTargetIds.push(
        allocatedTargetIds[allocatedTargetIds.length - 1]
      );
    }

    const allocatedTargetIds = allocateConcreteTargetIdsForLocators({
      action,
      locatorKeys: cleanedSelectedLocatorKeys,
      visibleTargetIdsByLocatorKey,
      reservedTargetIds: sourceReservedTargetIds,
      preferredTargetIds: cleanedPreferredTargetIds,
    });
    const isFullyAllocated = allocatedTargetIds.length >= requiredTargetCount;

    if (cleanedSelectedLocatorKeys.length > 0) {
      cleanedDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] = cleanedSelectedLocatorKeys;
      for (const locatorKey of cleanedSelectedLocatorKeys) {
        if (!selectedDestroySourcesByLocatorKey[locatorKey]) {
          selectedDestroySourcesByLocatorKey[locatorKey] = [];
        }

        selectedDestroySourcesByLocatorKey[locatorKey].push(sourceInstanceId);
      }
    }

    if (allocatedTargetIds.length > 0) {
      allocatedDestroyTargetIdsBySourceInstanceId[sourceInstanceId] = allocatedTargetIds;
      for (let index = 0; index < allocatedTargetIds.length; index += 1) {
        const locatorKey = cleanedSelectedLocatorKeys[index];
        if (!locatorKey) continue;
        allocatedDestroyTargetPresentationSources.push({
          targetInstanceId: allocatedTargetIds[index],
          locatorKey,
          sourceInstanceId,
        });
      }
    }

    destroyTargetSourceAnalysisBySourceInstanceId[sourceInstanceId] = {
      sourceInstanceId,
      requiredTargetCount,
      cleanedSelectedLocatorKeys,
      allocatedTargetIds,
      allocatableNextLocatorKeys: [],
      hasAllocatableNextLocator: false,
      isFullyAllocated,
      isSatisfied: isFullyAllocated,
    };

    if (isFullyAllocated) {
      for (const allocatedTargetId of allocatedTargetIds) {
        reservedConcreteTargetIds.add(allocatedTargetId);
      }
    }
  }

  for (const [sourceInstanceId, action] of orderedDestroyTargetActionEntries) {
    const analysis = destroyTargetSourceAnalysisBySourceInstanceId[sourceInstanceId];
    if (!analysis) continue;

    const otherSourceReservedTargetIds = new Set<string>();
    for (const [otherSourceInstanceId, targetIds] of Object.entries(
      allocatedDestroyTargetIdsBySourceInstanceId
    )) {
      if (otherSourceInstanceId === sourceInstanceId) continue;
      for (const targetId of targetIds) {
        otherSourceReservedTargetIds.add(targetId);
      }
    }

    const allocatableNextLocatorKeys = getAllocatableLocatorKeysForAction({
      action,
      selectedLocatorKeys: analysis.cleanedSelectedLocatorKeys,
      selectedExactTargetIds: analysis.allocatedTargetIds,
      validLocatorKeys:
        validDestroyTargetLocatorKeysBySourceInstanceId[sourceInstanceId] ?? [],
      visibleTargetIdsByLocatorKey,
      reservedTargetIds: otherSourceReservedTargetIds,
    });
    const isSkippableEmpty =
      analysis.allocatedTargetIds.length === 0 &&
      allocatableNextLocatorKeys.length === 0;
    const isSatisfied = analysis.isFullyAllocated || isSkippableEmpty;

    analysis.allocatableNextLocatorKeys = allocatableNextLocatorKeys;
    analysis.hasAllocatableNextLocator = allocatableNextLocatorKeys.length > 0;
    analysis.isSatisfied = isSatisfied;
    destroyTargetSatisfiedBySourceInstanceId[sourceInstanceId] = isSatisfied;
  }

  const allocatedDestroyTargetIdBySourceInstanceId: Record<string, string> = {};
  for (const [sourceInstanceId, allocatedTargetIds] of Object.entries(allocatedDestroyTargetIdsBySourceInstanceId)) {
    if (allocatedTargetIds.length > 0) {
      allocatedDestroyTargetIdBySourceInstanceId[sourceInstanceId] = allocatedTargetIds[0];
    }
  }

  useEffect(() => {
    const reconciledDraft: DestroyTargetDraftState = {
      locatorKeysBySourceInstanceId:
        cleanedDestroyTargetLocatorKeysBySourceInstanceId,
      exactTargetIdsBySourceInstanceId:
        allocatedDestroyTargetIdsBySourceInstanceId,
    };
    setDestroyTargetDraft((prev) =>
      areDestroyTargetDraftStatesEqual(prev, reconciledDraft)
        ? prev
        : reconciledDraft
    );
  }, [
    allocatedDestroyTargetIdsBySourceInstanceId,
    cleanedDestroyTargetLocatorKeysBySourceInstanceId,
  ]);

  useEffect(() => {
    if (destroyTargetActionsBySourceInstanceId.size === 0) {
      return;
    }

    const autoArmSourceInstanceId =
      orderedDestroyTargetActionEntries.find(([sourceInstanceId, action]) => {
        if (
          isMixedFirstStrikeTargeting &&
          getFirstStrikeFamilyForAction(action) !== activeFirstStrikeFamily
        ) {
          return false;
        }

        const analysis = destroyTargetSourceAnalysisBySourceInstanceId[sourceInstanceId];
        return analysis != null && !analysis.isSatisfied && analysis.hasAllocatableNextLocator;
      })?.[0] ?? null;

    setDestroyTargetFocus((prev) => {
      const previousSourceInstanceId = prev?.sourceInstanceId ?? null;
      if (previousSourceInstanceId != null) {
        const previousAnalysis =
          destroyTargetSourceAnalysisBySourceInstanceId[previousSourceInstanceId];
        const previousAction = destroyTargetActionsBySourceInstanceId.get(
          previousSourceInstanceId
        );
        const previousFamilyIsActive =
          !isMixedFirstStrikeTargeting ||
          (
            previousAction != null &&
            getFirstStrikeFamilyForAction(previousAction) === activeFirstStrikeFamily
          );
        return resolveDestroyTargetFocus({
          current: prev,
          currentAvailable:
            previousFamilyIsActive && previousAnalysis != null,
          currentSatisfied: previousAnalysis?.isSatisfied ?? true,
          currentHasAllocatableTarget:
            previousAnalysis?.hasAllocatableNextLocator ?? false,
          autoArmSourceInstanceId,
        });
      }

      return autoArmSourceInstanceId == null
        ? null
        : {
            sourceInstanceId: autoArmSourceInstanceId,
            origin: 'automatic',
          };
    });
  }, [
    activeFirstStrikeFamily,
    destroyTargetActionsBySourceInstanceId.size,
    destroyTargetSourceAnalysisBySourceInstanceId,
    isMixedFirstStrikeTargeting,
    orderedDestroyTargetActionEntries,
  ]);

  const activeDestroyAction =
    activeDestroyTargetSourceInstanceId != null
      ? destroyTargetActionsBySourceInstanceId.get(activeDestroyTargetSourceInstanceId) ?? null
      : null;
  const activeDestroySourceAnalysis =
    activeDestroyTargetSourceInstanceId != null
      ? destroyTargetSourceAnalysisBySourceInstanceId[activeDestroyTargetSourceInstanceId] ?? null
      : null;
  const activeDestroySelectedLocatorKeys =
    activeDestroySourceAnalysis?.cleanedSelectedLocatorKeys ?? [];
  const activeDestroySelectableLocatorKeys = new Set(
    activeDestroySourceAnalysis?.allocatableNextLocatorKeys ?? []
  );

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
  const exactTargetPresentationEntries =
    buildExactDestroyTargetPresentationEntries({
      selections: allocatedDestroyTargetPresentationSources,
      getPreviewShipDefIdForSource: (sourceInstanceId) =>
        getDestroyPreviewShipDefIdForSource(sourceInstanceId),
    });

  const targetStatesBySide: BoardDestroyTargetingViewModel['targetStatesBySide'] = {
    my: {},
    opponent: {},
  };

  for (const [locatorKey, sourceInstanceIds] of Object.entries(
    selectedDestroySourcesByLocatorKey
  )) {
    const locator = splitLocatorKey(locatorKey);
    if (!locator) continue;

    const selectedTone: BoardTargetSelectedTone = sourceInstanceIds.every(
      (sourceInstanceId) => getDestroyPreviewShipDefIdForSource(sourceInstanceId) === 'DOM'
    )
      ? 'purple'
      : 'red';

    targetStatesBySide[locator.side][locator.stackKey] = {
      isTargetable: false,
      isHovered: false,
      isSelected: true,
      selectedTone,
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
      ...(existingState?.selectedTone
        ? { selectedTone: existingState.selectedTone }
        : {}),
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
      const currentAnalysis =
        destroyTargetSourceAnalysisBySourceInstanceId[sourceInstanceId];
      setDestroyTargetFocus({
        sourceInstanceId,
        origin: currentAnalysis?.isFullyAllocated ? 'explicit' : 'automatic',
      });
      return;
    }

    setDestroyTargetDraft((prev) =>
      clearDestroyTargetDraftSource(prev, sourceInstanceId)
    );
    setHoveredDestroyTargetLocatorKey(null);
    setDestroyTargetFocus((prev) =>
      prev?.sourceInstanceId === sourceInstanceId ? null : prev
    );
  };

  const onBoardBackgroundMouseDown = () => {
    if (activeDestroyTargetSourceInstanceId == null) {
      return;
    }

    setDestroyTargetDraft((prev) =>
      clearDestroyTargetDraftSource(
        prev,
        activeDestroyTargetSourceInstanceId
      )
    );
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

    const otherSourceReservedTargetIds = new Set<string>();
    for (const [sourceInstanceId, targetIds] of Object.entries(
      allocatedDestroyTargetIdsBySourceInstanceId
    )) {
      if (sourceInstanceId === activeDestroyTargetSourceInstanceId) continue;
      for (const targetId of targetIds) {
        otherSourceReservedTargetIds.add(targetId);
      }
    }
    const edit = deriveDestroyTargetSelectionEdit({
      action: activeDestroyAction,
      currentLocatorKeys: activeDestroySelectedLocatorKeys,
      currentExactTargetIds:
        activeDestroySourceAnalysis?.allocatedTargetIds ?? [],
      clickedLocatorKey: locatorKey,
      visibleTargetIdsByLocatorKey,
      reservedTargetIds: otherSourceReservedTargetIds,
    });
    if (!edit) return;

    setDestroyTargetDraft((prev) => ({
      locatorKeysBySourceInstanceId: {
        ...prev.locatorKeysBySourceInstanceId,
        [activeDestroyTargetSourceInstanceId]: edit.locatorKeys,
      },
      exactTargetIdsBySourceInstanceId: {
        ...prev.exactTargetIdsBySourceInstanceId,
        [activeDestroyTargetSourceInstanceId]: edit.exactTargetIds,
      },
    }));
    setHoveredDestroyTargetLocatorKey(locatorKey);
  };

  return {
    allocatedDestroyTargetIdBySourceInstanceId,
    allocatedDestroyTargetIdsBySourceInstanceId,
    destroyTargetSatisfiedBySourceInstanceId,
    boardDestroyTargeting:
      myPlayerId || opponentPlayerId
        ? {
            activeSourceInstanceId: activeDestroyTargetSourceInstanceId,
            targetStatesBySide,
            previewShipDefIdBySide,
          }
        : makeEmptyBoardDestroyTargeting(),
    exactTargetPresentationEntries,
    shouldResetDestroyTargetRows,
    consumePendingDestroyTargetReset,
    applyDestroyTargetingChoiceSideEffects,
    onBoardBackgroundMouseDown,
    onDestroyTargetStackHoverChange,
    onDestroyTargetStackMouseDown,
  };
}
