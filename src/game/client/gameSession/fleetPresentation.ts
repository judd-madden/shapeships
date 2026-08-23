import type { ShipDefId } from '../../types/ShipTypes.engine';
import type {
  BoardDestroyTargetState,
  BoardFleetSummary,
  BoardTargetSelectedTone,
} from './types';

export interface ExactTargetPresentationEntry {
  instanceId: string;
  side: 'my' | 'opponent';
  selectedTone?: BoardTargetSelectedTone;
  previewShipDefId?: ShipDefId;
}

export interface AllocatedDestroyTargetPresentationSource {
  targetInstanceId: string;
  locatorKey: string;
  sourceInstanceId: string;
}

export function buildExactDestroyTargetPresentationEntries(args: {
  selections: readonly AllocatedDestroyTargetPresentationSource[];
  getPreviewShipDefIdForSource: (sourceInstanceId: string) => ShipDefId | null;
}): ExactTargetPresentationEntry[] {
  const selectionByTargetInstanceId = new Map<
    string,
    { locatorKey: string; sourceInstanceIds: string[] }
  >();

  for (const selection of args.selections) {
    const existing = selectionByTargetInstanceId.get(selection.targetInstanceId);
    if (existing) {
      if (
        existing.locatorKey === selection.locatorKey &&
        !existing.sourceInstanceIds.includes(selection.sourceInstanceId)
      ) {
        existing.sourceInstanceIds.push(selection.sourceInstanceId);
      }
      continue;
    }

    selectionByTargetInstanceId.set(selection.targetInstanceId, {
      locatorKey: selection.locatorKey,
      sourceInstanceIds: [selection.sourceInstanceId],
    });
  }

  return Array.from(selectionByTargetInstanceId.entries()).flatMap(
    ([instanceId, selection]) => {
      const [side, stackKey] = selection.locatorKey.split('::');
      if ((side !== 'my' && side !== 'opponent') || !stackKey) return [];

      const previewShipDefIds = Array.from(
        new Set(
          selection.sourceInstanceIds
            .map(args.getPreviewShipDefIdForSource)
            .filter((shipDefId): shipDefId is ShipDefId => shipDefId != null)
        )
      );
      const selectedTone: BoardTargetSelectedTone =
        selection.sourceInstanceIds.every(
          (sourceInstanceId) =>
            args.getPreviewShipDefIdForSource(sourceInstanceId) === 'DOM'
        )
          ? 'purple'
          : 'red';

      return [{
        instanceId,
        side,
        selectedTone,
        ...(previewShipDefIds.length === 1
          ? { previewShipDefId: previewShipDefIds[0] }
          : {}),
      }];
    }
  );
}

interface LocalAncientTargetCastLike {
  solarPowerId: string;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
}

export function buildLocalAncientExactTargetPresentationEntries(args: {
  blackHoleSelectedTargetInstanceIds: readonly string[];
  localPresentationCasts: readonly LocalAncientTargetCastLike[];
}): ExactTargetPresentationEntry[] {
  const entryByInstanceId = new Map<string, ExactTargetPresentationEntry>();

  for (const cast of args.localPresentationCasts) {
    const targetInstanceIds = cast.solarPowerId === 'SBLA'
      ? cast.targetInstanceIds ?? []
      : cast.solarPowerId === 'SSIM' && cast.targetInstanceId
        ? [cast.targetInstanceId]
        : [];
    for (const instanceId of targetInstanceIds) {
      if (typeof instanceId !== 'string' || instanceId.length === 0) continue;
      if (!entryByInstanceId.has(instanceId)) {
        // Local cast markers apply the established SBLA/SSIM tone after projection.
        entryByInstanceId.set(instanceId, { instanceId, side: 'opponent' });
      }
    }
  }

  for (const instanceId of args.blackHoleSelectedTargetInstanceIds) {
    if (typeof instanceId !== 'string' || instanceId.length === 0) continue;
    // The active Black Hole selector replaces ordinary board targeting today.
    entryByInstanceId.set(instanceId, {
      instanceId,
      side: 'opponent',
      selectedTone: 'red',
      previewShipDefId: 'SBLA',
    });
  }

  return Array.from(entryByInstanceId.values());
}

export function buildExactMembershipSelectedTargetStates(args: {
  fleet: readonly BoardFleetSummary[];
  toneByInstanceId: ReadonlyMap<string, BoardTargetSelectedTone>;
}): Record<string, BoardDestroyTargetState> {
  const states: Record<string, BoardDestroyTargetState> = {};

  for (const stack of args.fleet) {
    let selectedTone: BoardTargetSelectedTone | null = null;
    for (const instanceId of stack.memberInstanceIds) {
      const instanceTone = args.toneByInstanceId.get(instanceId);
      if (instanceTone === 'red') {
        selectedTone = 'red';
        break;
      }
      if (instanceTone === 'cyan') {
        selectedTone = 'cyan';
      }
    }

    if (selectedTone) {
      states[stack.stackKey] = {
        isTargetable: false,
        isHovered: false,
        isSelected: true,
        selectedTone,
      };
    }
  }

  return states;
}

export interface ExactTargetFleetPresentationProjection {
  fleet: BoardFleetSummary[];
  renderOrder: string[];
  targetStatesByStackKey: Record<string, BoardDestroyTargetState>;
  previewShipDefIdByStackKey: Partial<Record<string, ShipDefId>>;
}

function makeExactTargetStackKey(instanceId: string): string {
  return `presentation__target__inst_${instanceId}`;
}

function makeExactTargetRenderKey(instanceId: string): string {
  return `presentation__target__render_${instanceId}`;
}

export function projectExactTargetFleetPresentation(args: {
  side: 'my' | 'opponent';
  fleet: BoardFleetSummary[];
  renderOrder: string[];
  exactTargets: readonly ExactTargetPresentationEntry[];
  targetStatesByStackKey: Readonly<Record<string, BoardDestroyTargetState>>;
  previewShipDefIdByStackKey: Readonly<Partial<Record<string, ShipDefId>>>;
}): ExactTargetFleetPresentationProjection {
  const exactTargetByInstanceId = new Map(
    args.exactTargets
      .filter((target) => target.side === args.side)
      .map((target) => [target.instanceId, target] as const)
  );

  if (exactTargetByInstanceId.size === 0) {
    return {
      fleet: args.fleet,
      renderOrder: args.renderOrder,
      targetStatesByStackKey: args.targetStatesByStackKey,
      previewShipDefIdByStackKey: args.previewShipDefIdByStackKey,
    };
  }

  let changed = false;
  const projectedFleet: BoardFleetSummary[] = [];
  const projectedTargetStatesByStackKey = { ...args.targetStatesByStackKey };
  const projectedPreviewShipDefIdByStackKey = {
    ...args.previewShipDefIdByStackKey,
  };
  const projectedRenderKeysByBaseRenderKey = new Map<string, string[]>();

  for (const summary of args.fleet) {
    const selectedMemberInstanceIds = summary.count > 1
      ? summary.memberInstanceIds.filter((instanceId) =>
          exactTargetByInstanceId.has(instanceId)
        )
      : [];

    if (selectedMemberInstanceIds.length === 0) {
      projectedFleet.push(summary);
      continue;
    }

    changed = true;
    const selectedMemberInstanceIdSet = new Set(selectedMemberInstanceIds);
    const remainderMemberInstanceIds = summary.memberInstanceIds.filter(
      (instanceId) => !selectedMemberInstanceIdSet.has(instanceId)
    );
    const remainderCount = Math.max(0, summary.count - selectedMemberInstanceIds.length);
    const sourceTargetState = args.targetStatesByStackKey[summary.stackKey];
    const sourcePreviewShipDefId = args.previewShipDefIdByStackKey[summary.stackKey];
    const projectedRenderKeys: string[] = [];

    delete projectedTargetStatesByStackKey[summary.stackKey];
    delete projectedPreviewShipDefIdByStackKey[summary.stackKey];

    if (remainderCount > 0) {
      projectedFleet.push({
        ...summary,
        count: remainderCount,
        memberInstanceIds: remainderMemberInstanceIds,
      });
      projectedRenderKeys.push(summary.renderKey);

      if (sourceTargetState) {
        projectedTargetStatesByStackKey[summary.stackKey] = {
          isTargetable: sourceTargetState.isTargetable,
          isHovered: sourceTargetState.isHovered,
          isSelected: false,
        };
        if (sourceTargetState.isHovered && sourcePreviewShipDefId) {
          projectedPreviewShipDefIdByStackKey[summary.stackKey] = sourcePreviewShipDefId;
        }
      }
    }

    for (const instanceId of selectedMemberInstanceIds) {
      const exactTarget = exactTargetByInstanceId.get(instanceId)!;
      const stackKey = makeExactTargetStackKey(instanceId);
      const renderKey = makeExactTargetRenderKey(instanceId);
      projectedFleet.push({
        ...summary,
        count: 1,
        stackKey,
        renderKey,
        memberInstanceIds: [instanceId],
      });
      projectedRenderKeys.push(renderKey);
      projectedTargetStatesByStackKey[stackKey] = {
        isTargetable: false,
        isHovered: false,
        isSelected: true,
        ...(exactTarget.selectedTone ?? sourceTargetState?.selectedTone
          ? {
              selectedTone:
                exactTarget.selectedTone ?? sourceTargetState?.selectedTone,
            }
          : {}),
      };

      const previewShipDefId =
        exactTarget.previewShipDefId ?? sourcePreviewShipDefId;
      if (previewShipDefId) {
        projectedPreviewShipDefIdByStackKey[stackKey] = previewShipDefId;
      }
    }

    projectedRenderKeysByBaseRenderKey.set(summary.renderKey, projectedRenderKeys);
  }

  if (!changed) {
    return {
      fleet: args.fleet,
      renderOrder: args.renderOrder,
      targetStatesByStackKey: args.targetStatesByStackKey,
      previewShipDefIdByStackKey: args.previewShipDefIdByStackKey,
    };
  }

  const projectedRenderOrder = args.renderOrder.flatMap(
    (renderKey) => projectedRenderKeysByBaseRenderKey.get(renderKey) ?? [renderKey]
  );
  const orderedRenderKeys = new Set(projectedRenderOrder);
  for (const summary of projectedFleet) {
    if (!orderedRenderKeys.has(summary.renderKey)) {
      orderedRenderKeys.add(summary.renderKey);
      projectedRenderOrder.push(summary.renderKey);
    }
  }

  return {
    fleet: projectedFleet,
    renderOrder: projectedRenderOrder,
    targetStatesByStackKey: projectedTargetStatesByStackKey,
    previewShipDefIdByStackKey: projectedPreviewShipDefIdByStackKey,
  };
}

export interface ShipVisibilityClassificationArgs {
  ship: any;
  ownerPlayerId: string | undefined;
  turnNumber: number;
  majorPhase: string;
  isInBattlePhase: boolean;
  materializedSimulacrumFleetInstanceIdsByPlayerId: Record<string, string[]>;
}

function getShipInstanceId(ship: any): string | null {
  const instanceId = ship?.instanceId ?? ship?.id ?? null;
  return typeof instanceId === 'string' && instanceId.length > 0 ? instanceId : null;
}

interface ShipActivationCueBatchLike {
  key: string;
  turnNumber: number;
  phaseKey: string;
  sources: Array<{
    playerId: string;
    sourceInstanceId: string;
  }>;
}

interface FleetSummaryLike {
  shipDefId: string;
  count: number;
  stackKey: string;
  renderKey: string;
  memberInstanceIds: string[];
  condition?: 'charges_1' | 'charges_0';
  currentCharges?: number | null;
}

export function getCurrentTurnRegisteredSimulacrumInstanceIds(args: {
  ships: readonly any[];
  ownerPlayerId: string | null | undefined;
  turnNumber: number;
  materializedSimulacrumFleetInstanceIdsByPlayerId: Record<string, string[]>;
}): string[] {
  if (!args.ownerPlayerId) return [];

  const registeredIds = new Set(
    args.materializedSimulacrumFleetInstanceIdsByPlayerId[args.ownerPlayerId] ?? []
  );
  if (registeredIds.size === 0) return [];

  const currentTurnIds: string[] = [];
  const seenIds = new Set<string>();

  for (const ship of args.ships) {
    const instanceId = getShipInstanceId(ship);
    if (
      instanceId == null ||
      seenIds.has(instanceId) ||
      ship?.createdTurn !== args.turnNumber ||
      !registeredIds.has(instanceId)
    ) {
      continue;
    }

    seenIds.add(instanceId);
    currentTurnIds.push(instanceId);
  }

  return currentTurnIds;
}

export function getDeferredBugDrawingSpendCountByInstanceId(args: {
  activationCueBatches: readonly ShipActivationCueBatchLike[] | null | undefined;
  localPlayerId: string | null | undefined;
  turnNumber: number;
  ships: readonly any[];
}): Record<string, number> {
  if (!args.localPlayerId || !args.activationCueBatches) return {};

  const bugInstanceIds = new Set(
    args.ships
      .filter((ship) => ship?.shipDefId === 'BUG')
      .map(getShipInstanceId)
      .filter((instanceId): instanceId is string => instanceId != null)
  );
  if (bugInstanceIds.size === 0) return {};

  const spendCountByInstanceId: Record<string, number> = {};
  const seenCueIdentities = new Set<string>();

  for (const batch of args.activationCueBatches) {
    if (
      batch.turnNumber !== args.turnNumber ||
      batch.phaseKey !== 'build.drawing'
    ) {
      continue;
    }

    for (const source of batch.sources) {
      if (
        source.playerId !== args.localPlayerId ||
        !bugInstanceIds.has(source.sourceInstanceId)
      ) {
        continue;
      }

      const cueIdentity =
        `${batch.key}\0${source.playerId}\0${source.sourceInstanceId}`;
      if (seenCueIdentities.has(cueIdentity)) continue;

      seenCueIdentities.add(cueIdentity);
      spendCountByInstanceId[source.sourceInstanceId] =
        (spendCountByInstanceId[source.sourceInstanceId] ?? 0) + 1;
    }
  }

  return spendCountByInstanceId;
}

export function projectDeferredBugChargePresentation<
  TFleetSummary extends FleetSummaryLike
>(args: {
  fleet: TFleetSummary[];
  ships: readonly any[];
  deferredSpendCountByInstanceId: Readonly<Record<string, number>>;
  bugMaxCharges: number;
}): TFleetSummary[] {
  const displayedChargesByInstanceId = new Map<string, number>();

  for (const ship of args.ships) {
    if (ship?.shipDefId !== 'BUG') continue;

    const instanceId = getShipInstanceId(ship);
    const deferredSpendCount = instanceId == null
      ? 0
      : args.deferredSpendCountByInstanceId[instanceId] ?? 0;
    const authoritativeCharges = Number(ship?.chargesCurrent);

    if (
      instanceId == null ||
      deferredSpendCount <= 0 ||
      !Number.isFinite(authoritativeCharges)
    ) {
      continue;
    }

    displayedChargesByInstanceId.set(
      instanceId,
      Math.min(
        args.bugMaxCharges,
        Math.max(0, authoritativeCharges) + deferredSpendCount
      )
    );
  }

  if (displayedChargesByInstanceId.size === 0) return args.fleet;

  let changed = false;
  const projectedFleet: TFleetSummary[] = [];

  for (const summary of args.fleet) {
    if (summary.shipDefId !== 'BUG') {
      projectedFleet.push(summary);
      continue;
    }

    const deferredSourceIds = summary.memberInstanceIds.filter(
      (instanceId) => displayedChargesByInstanceId.has(instanceId)
    );
    if (deferredSourceIds.length === 0) {
      projectedFleet.push(summary);
      continue;
    }

    changed = true;
    const deferredSourceIdSet = new Set(deferredSourceIds);
    const remainingMemberInstanceIds = summary.memberInstanceIds.filter(
      (instanceId) => !deferredSourceIdSet.has(instanceId)
    );
    const remainingCount = Math.max(0, summary.count - deferredSourceIds.length);

    if (remainingCount > 0) {
      projectedFleet.push({
        ...summary,
        count: remainingCount,
        memberInstanceIds: remainingMemberInstanceIds,
      });
    }

    for (const instanceId of deferredSourceIds) {
      const isOnlySummaryMember =
        summary.count === 1 && summary.memberInstanceIds.length === 1;
      projectedFleet.push({
        ...summary,
        count: 1,
        stackKey: `BUG__inst_${instanceId}`,
        renderKey: isOnlySummaryMember
          ? summary.renderKey
          : `presentation__BUG__inst_${instanceId}`,
        memberInstanceIds: [instanceId],
        condition: undefined,
        currentCharges: displayedChargesByInstanceId.get(instanceId)!,
      });
    }
  }

  return changed ? projectedFleet : args.fleet;
}

export function buildPresentationFleetCountsByLiveRenderKey<
  TFleetSummary extends Pick<FleetSummaryLike, 'count' | 'renderKey' | 'memberInstanceIds'>
>(args: {
  presentedFleet: readonly TFleetSummary[];
  liveFleet: readonly TFleetSummary[];
}): Record<string, number> {
  const liveRenderKeyByInstanceId = new Map<string, string>();
  for (const summary of args.liveFleet) {
    for (const instanceId of summary.memberInstanceIds) {
      liveRenderKeyByInstanceId.set(instanceId, summary.renderKey);
    }
  }

  const countsByRenderKey: Record<string, number> = {};
  for (const summary of args.presentedFleet) {
    for (const instanceId of summary.memberInstanceIds) {
      const renderKey = liveRenderKeyByInstanceId.get(instanceId) ?? summary.renderKey;
      countsByRenderKey[renderKey] = (countsByRenderKey[renderKey] ?? 0) + 1;
    }

    const unidentifiedCount = Math.max(
      0,
      summary.count - summary.memberInstanceIds.length
    );
    if (unidentifiedCount > 0) {
      countsByRenderKey[summary.renderKey] =
        (countsByRenderKey[summary.renderKey] ?? 0) + unidentifiedCount;
    }
  }

  return countsByRenderKey;
}

export function classifyShipVisibilityToViewer(
  args: ShipVisibilityClassificationArgs
): boolean {
  const {
    ship,
    ownerPlayerId,
    turnNumber,
    majorPhase,
    isInBattlePhase,
    materializedSimulacrumFleetInstanceIdsByPlayerId,
  } = args;
  const createdTurn = ship?.createdTurn;
  if (typeof createdTurn !== 'number') return true;
  if (createdTurn < turnNumber) return true;
  if (isInBattlePhase) return true;
  if (majorPhase !== 'build' || !ownerPlayerId) return false;
  const instanceId = getShipInstanceId(ship);
  return instanceId != null &&
    materializedSimulacrumFleetInstanceIdsByPlayerId[ownerPlayerId]
      ?.includes(instanceId) === true;
}

export function getCurrentTurnHiddenShipInstanceIds(args: {
  ships: any[];
  ownerPlayerId: string | undefined;
  turnNumber: number;
  majorPhase: string;
  isInBattlePhase: boolean;
  materializedSimulacrumFleetInstanceIdsByPlayerId: Record<string, string[]>;
}): string[] {
  return args.ships
    .filter(
      (ship) =>
        ship?.createdTurn === args.turnNumber &&
        !classifyShipVisibilityToViewer({ ...args, ship })
    )
    .map(getShipInstanceId)
    .filter((instanceId): instanceId is string => instanceId != null);
}

export function filterFleetSummariesBySuppressedMemberIds<
  TFleetSummary extends { count: number; memberInstanceIds: string[] }
>(
  fleet: TFleetSummary[],
  suppressedMemberInstanceIds: readonly string[]
): TFleetSummary[] {
  if (suppressedMemberInstanceIds.length === 0) {
    return fleet;
  }

  const suppressedIds = new Set(suppressedMemberInstanceIds);
  const presentedFleet: TFleetSummary[] = [];

  for (const summary of fleet) {
    const memberInstanceIds = summary.memberInstanceIds.filter(
      (instanceId) => !suppressedIds.has(instanceId)
    );
    const suppressedCount = summary.memberInstanceIds.length - memberInstanceIds.length;

    if (suppressedCount === 0) {
      presentedFleet.push(summary);
      continue;
    }

    const count = Math.max(0, summary.count - suppressedCount);
    if (count === 0) {
      continue;
    }

    presentedFleet.push({
      ...summary,
      count,
      memberInstanceIds,
    });
  }

  return presentedFleet;
}
