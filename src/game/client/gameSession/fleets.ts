/**
 * FLEET DERIVATION
 *
 * Extract ship ownership, apply visibility rules, aggregate semantic fleet
 * summaries, and reconcile live render identity for board consumption.
 */

import { getShipDefinitionById } from '../../data/ShipDefinitions.engine';
import { isShipDefId } from '../../data/ShipDefinitions.core';
import type { ShipDefId } from '../../types/ShipTypes.engine';
import type { BoardFleetSummary } from './types';

type FleetSummarySortFields = Pick<BoardFleetSummary, 'shipDefId' | 'stackKey' | 'condition'>;

interface FleetBucket {
  shipDefId: ShipDefId;
  count: number;
  condition?: 'charges_1' | 'charges_0';
  currentCharges?: number | null;
  caption?: string | null;
  memberInstanceIds: string[];
}

export interface DerivedFleetStackInfo {
  shipDefId: ShipDefId;
  stackKey: string;
  condition?: 'charges_1' | 'charges_0';
  currentCharges?: number | null;
  caption?: string | null;
}

export function deriveFleetStackInfo(
  ship: any,
  frigateTriggerByInstanceId: Record<string, unknown> = {},
  overrideCurrentCharges?: number
): DerivedFleetStackInfo | null {
  const rawShipDefId = String(ship?.shipDefId ?? '');
  if (!isShipDefId(rawShipDefId)) {
    return null;
  }

  const shipDefId = rawShipDefId;
  const def = getShipDefinitionById(shipDefId);
  const maxCharges = def?.maxCharges ?? 0;
  const chargesCurrent = Number(overrideCurrentCharges ?? ship?.chargesCurrent ?? 0);
  const instanceId = ship?.instanceId ?? ship?.id ?? '';

  if (maxCharges === 1) {
    if (chargesCurrent >= 1) {
      return {
        shipDefId,
        stackKey: `${shipDefId}__charges_1`,
        condition: 'charges_1',
      };
    }

    return {
      shipDefId,
      stackKey: `${shipDefId}__charges_0`,
      condition: 'charges_0',
    };
  }

  if (maxCharges > 1) {
    if (chargesCurrent > 0) {
      return {
        shipDefId,
        stackKey: `${shipDefId}__inst_${instanceId}`,
        currentCharges: chargesCurrent,
      };
    }

    return {
      shipDefId,
      stackKey: `${shipDefId}__charges_0`,
      condition: 'charges_0',
    };
  }

  if (shipDefId === 'FRI') {
    const rawTrig = frigateTriggerByInstanceId?.[instanceId];
    let trig = Number(rawTrig ?? 1);

    if (!Number.isFinite(trig)) trig = 1;
    trig = Math.max(1, Math.min(6, Math.floor(trig)));

    const caption = String(trig);
    return {
      shipDefId,
      stackKey: `FRI__cap_${caption}`,
      caption,
    };
  }

  return {
    shipDefId,
    stackKey: shipDefId,
  };
}

function getShipInstanceId(ship: any): string | null {
  const instanceId = ship?.instanceId ?? ship?.id ?? null;
  return typeof instanceId === 'string' && instanceId.length > 0 ? instanceId : null;
}

function makeSeedRenderKey(stackKey: string): string {
  return `render__${stackKey}`;
}

function getSemanticCategoryRank(summary: FleetSummarySortFields): number {
  if (summary.stackKey.includes('__inst_')) return 0;
  if (summary.condition === 'charges_1') return 1;
  if (summary.condition === 'charges_0') return 2;
  return 3;
}

export function sortFleetSummariesBySemanticOrder<T extends FleetSummarySortFields>(fleet: T[]): T[] {
  return [...fleet].sort((a, b) => {
    if (a.shipDefId !== b.shipDefId) {
      return a.shipDefId.localeCompare(b.shipDefId);
    }

    const categoryDelta = getSemanticCategoryRank(a) - getSemanticCategoryRank(b);
    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    return a.stackKey.localeCompare(b.stackKey);
  });
}

function buildFleetSummaryFromBuckets(buckets: Map<string, FleetBucket>): BoardFleetSummary[] {
  return sortFleetSummariesBySemanticOrder(
    Array.from(buckets.entries()).map(([stackKey, bucket]) => ({
      shipDefId: bucket.shipDefId,
      count: bucket.count,
      stackKey,
      renderKey: makeSeedRenderKey(stackKey),
      memberInstanceIds: [...bucket.memberInstanceIds],
      condition: bucket.condition,
      currentCharges: bucket.currentCharges ?? null,
      caption: bucket.caption ?? null,
    }))
  );
}

function getRenderTransitionPriority(previous: BoardFleetSummary, current: BoardFleetSummary): number {
  const previousIsActiveInstance = previous.stackKey.includes('__inst_');
  const currentIsDepleted = current.condition === 'charges_0';

  if (currentIsDepleted && previousIsActiveInstance) {
    return 2;
  }

  if (currentIsDepleted && previous.condition === 'charges_1') {
    return 1;
  }

  return 0;
}

function getMemberOverlapCount(previous: BoardFleetSummary, current: BoardFleetSummary): number {
  if (previous.memberInstanceIds.length === 0 || current.memberInstanceIds.length === 0) {
    return 0;
  }

  const currentMembers = new Set(current.memberInstanceIds);
  let overlapCount = 0;
  for (const memberId of previous.memberInstanceIds) {
    if (currentMembers.has(memberId)) {
      overlapCount += 1;
    }
  }

  return overlapCount;
}

function getOrderAnchor(summary: Pick<BoardFleetSummary, 'memberInstanceIds'>): string | null {
  return summary.memberInstanceIds[0] ?? null;
}

function hasAnchorContinuity(previous: BoardFleetSummary, current: BoardFleetSummary): boolean {
  const currentAnchor = getOrderAnchor(current);
  return currentAnchor != null && previous.memberInstanceIds.includes(currentAnchor);
}

function getStackPresentationFamily(
  summary: Pick<BoardFleetSummary, 'stackKey'>
): 'instance' | 'charges' | 'caption' | 'default' {
  if (summary.stackKey.includes('__inst_')) return 'instance';
  if (summary.stackKey.includes('__charges_')) return 'charges';
  if (summary.stackKey.includes('__cap_')) return 'caption';
  return 'default';
}

function getPreviewHandoffCompatibilityScore(
  previous: BoardFleetSummary,
  current: BoardFleetSummary
): number {
  if (previous.shipDefId !== current.shipDefId) {
    return Number.NEGATIVE_INFINITY;
  }

  if (getStackPresentationFamily(previous) !== getStackPresentationFamily(current)) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (previous.stackKey === current.stackKey) {
    score += 8;
  }

  if (previous.condition === current.condition) {
    score += 4;
  }

  if ((previous.caption ?? null) === (current.caption ?? null)) {
    score += 2;
  }

  if (previous.count === current.count) {
    score += 1;
  }

  return score;
}

type RenderMatchCandidate = {
  currentIndex: number;
  previousIndex: number;
  anchorContinuity: number;
  overlapCount: number;
  transitionPriority: number;
};

interface ReconcileFleetRenderKeysOptions {
  previewToAuthoritativeHandoffFleet?: BoardFleetSummary[];
}

export function reconcileFleetRenderKeys(
  currentFleet: BoardFleetSummary[],
  previousFleet: BoardFleetSummary[],
  options: ReconcileFleetRenderKeysOptions = {}
): BoardFleetSummary[] {
  const { previewToAuthoritativeHandoffFleet } = options;
  const current = currentFleet.map((summary) => ({
    ...summary,
    renderKey: summary.renderKey || makeSeedRenderKey(summary.stackKey),
    memberInstanceIds: [...summary.memberInstanceIds],
  }));
  const previous = previousFleet.map((summary) => ({
    ...summary,
    renderKey: summary.renderKey || makeSeedRenderKey(summary.stackKey),
    memberInstanceIds: [...summary.memberInstanceIds],
  }));

  const matchedCurrentIndices = new Set<number>();
  const matchedPreviousIndices = new Set<number>();

  const overlapCandidates: RenderMatchCandidate[] = [];
  for (let currentIndex = 0; currentIndex < current.length; currentIndex += 1) {
    for (let previousIndex = 0; previousIndex < previous.length; previousIndex += 1) {
      if (previous[previousIndex].shipDefId !== current[currentIndex].shipDefId) {
        continue;
      }

      const overlapCount = getMemberOverlapCount(previous[previousIndex], current[currentIndex]);
      if (overlapCount <= 0) {
        continue;
      }

      overlapCandidates.push({
        currentIndex,
        previousIndex,
        anchorContinuity: hasAnchorContinuity(previous[previousIndex], current[currentIndex]) ? 1 : 0,
        overlapCount,
        transitionPriority: getRenderTransitionPriority(previous[previousIndex], current[currentIndex]),
      });
    }
  }

  overlapCandidates.sort((a, b) => {
    if (a.anchorContinuity !== b.anchorContinuity) {
      return b.anchorContinuity - a.anchorContinuity;
    }

    if (a.transitionPriority !== b.transitionPriority) {
      return b.transitionPriority - a.transitionPriority;
    }

    if (a.overlapCount !== b.overlapCount) {
      return b.overlapCount - a.overlapCount;
    }

    if (a.previousIndex !== b.previousIndex) {
      return a.previousIndex - b.previousIndex;
    }

    return a.currentIndex - b.currentIndex;
  });

  for (const candidate of overlapCandidates) {
    if (matchedCurrentIndices.has(candidate.currentIndex) || matchedPreviousIndices.has(candidate.previousIndex)) {
      continue;
    }

    current[candidate.currentIndex].renderKey = previous[candidate.previousIndex].renderKey;
    matchedCurrentIndices.add(candidate.currentIndex);
    matchedPreviousIndices.add(candidate.previousIndex);
  }

  const handoffFleet = previewToAuthoritativeHandoffFleet?.map((summary) => ({
    ...summary,
    renderKey: summary.renderKey || makeSeedRenderKey(summary.stackKey),
    memberInstanceIds: [...summary.memberInstanceIds],
  })) ?? [];
  const matchedHandoffPreviousIndices = new Set<number>();
  const renderKeysAlreadyClaimed = new Set(
    current
      .filter((_, index) => matchedCurrentIndices.has(index))
      .map((summary) => summary.renderKey)
  );

  for (let currentIndex = 0; currentIndex < current.length; currentIndex += 1) {
    if (matchedCurrentIndices.has(currentIndex)) {
      continue;
    }

    let bestHandoffPreviousIndex = -1;
    let bestHandoffScore = Number.NEGATIVE_INFINITY;

    for (let previousIndex = 0; previousIndex < handoffFleet.length; previousIndex += 1) {
      if (matchedHandoffPreviousIndices.has(previousIndex)) {
        continue;
      }

      const candidate = handoffFleet[previousIndex];
      if (renderKeysAlreadyClaimed.has(candidate.renderKey)) {
        continue;
      }

      const compatibilityScore = getPreviewHandoffCompatibilityScore(candidate, current[currentIndex]);
      if (compatibilityScore === Number.NEGATIVE_INFINITY) {
        continue;
      }

      if (compatibilityScore > bestHandoffScore) {
        bestHandoffScore = compatibilityScore;
        bestHandoffPreviousIndex = previousIndex;
      }
    }

    if (bestHandoffPreviousIndex < 0) {
      continue;
    }

    current[currentIndex].renderKey = handoffFleet[bestHandoffPreviousIndex].renderKey;
    matchedCurrentIndices.add(currentIndex);
    matchedHandoffPreviousIndices.add(bestHandoffPreviousIndex);
    renderKeysAlreadyClaimed.add(current[currentIndex].renderKey);
  }

  // Any newly visible semantic bucket receives a deterministic new render identity.
  const usedRenderKeys = new Set(
    current
      .filter((_, index) => matchedCurrentIndices.has(index))
      .map((summary) => summary.renderKey)
  );

  for (let currentIndex = 0; currentIndex < current.length; currentIndex += 1) {
    if (matchedCurrentIndices.has(currentIndex)) {
      continue;
    }

    const summary = current[currentIndex];
    const baseRenderKey = makeSeedRenderKey(summary.stackKey);
    let nextRenderKey = baseRenderKey;
    let suffix = 1;

    while (usedRenderKeys.has(nextRenderKey)) {
      nextRenderKey = `${baseRenderKey}__${suffix}`;
      suffix += 1;
    }

    current[currentIndex].renderKey = nextRenderKey;
    usedRenderKeys.add(nextRenderKey);
  }

  return current;
}

export function orderFleetSummariesByRenderKey<T extends Pick<BoardFleetSummary, 'renderKey'>>(
  fleet: T[],
  renderOrder: string[]
): T[] {
  const orderIndex = new Map<string, number>();
  renderOrder.forEach((renderKey, index) => orderIndex.set(renderKey, index));

  return [...fleet].sort((a, b) => {
    const aIndex = orderIndex.get(a.renderKey) ?? Number.POSITIVE_INFINITY;
    const bIndex = orderIndex.get(b.renderKey) ?? Number.POSITIVE_INFINITY;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.renderKey.localeCompare(b.renderKey);
  });
}

export function deriveFleets(args: {
  rawState: any;
  me: any;
  opponent: any;
  turnNumber: number;
  majorPhase: string;
  opponentPublicCurrentChargesByInstanceId?: Record<string, number>;
}) {
  const {
    rawState,
    me,
    opponent,
    turnNumber,
    majorPhase,
    opponentPublicCurrentChargesByInstanceId = {},
  } = args;

  const frigateTriggerByInstanceId =
    rawState?.gameData?.powerMemory?.frigateTriggerByInstanceId ?? {};

  const shipsData = rawState?.gameData?.ships || rawState?.ships || {};
  const voidShipsData = rawState?.gameData?.voidShipsByPlayerId ?? {};

  const myShips = me?.id ? (shipsData[me.id] || []) : [];
  const opponentShips = opponent?.id ? (shipsData[opponent.id] || []) : [];
  const myVoidShips = me?.id ? (voidShipsData[me.id] || []) : [];
  const opponentVoidShips = opponent?.id ? (voidShipsData[opponent.id] || []) : [];

  const isInBattlePhase = majorPhase === 'battle';

  function isShipVisibleToViewer(ship: any): boolean {
    const createdTurn = ship?.createdTurn;
    if (typeof createdTurn !== 'number') return true;
    if (createdTurn < turnNumber) return true;
    return isInBattlePhase;
  }

  const opponentShipsVisible = opponentShips.filter(isShipVisibleToViewer);
  const myVoidShipsVisible = myVoidShips;
  const opponentVoidShipsVisible = opponentVoidShips.filter(isShipVisibleToViewer);

  function aggregateFleet(
    ships: any[],
    stackKeyPrefix = '',
    options?: { useOpponentPublicMultiChargeOverrides?: boolean }
  ): BoardFleetSummary[] {
    const buckets = new Map<string, FleetBucket>();

    for (const ship of ships) {
      let overrideCurrentCharges: number | undefined;

      if (options?.useOpponentPublicMultiChargeOverrides === true) {
        const instanceId = getShipInstanceId(ship);
        const rawShipDefId = String(ship?.shipDefId ?? '');
        const def = isShipDefId(rawShipDefId) ? getShipDefinitionById(rawShipDefId) : null;

        if (
          instanceId &&
          (def?.maxCharges ?? 0) > 1 &&
          Object.prototype.hasOwnProperty.call(opponentPublicCurrentChargesByInstanceId, instanceId)
        ) {
          overrideCurrentCharges = opponentPublicCurrentChargesByInstanceId[instanceId];
        }
      }

      const stackInfo = deriveFleetStackInfo(
        ship,
        frigateTriggerByInstanceId,
        overrideCurrentCharges
      );
      if (!stackInfo) {
        continue;
      }

      const { shipDefId, stackKey, condition, currentCharges, caption } = stackInfo;
      const bucketKey = stackKeyPrefix ? `${stackKeyPrefix}${stackKey}` : stackKey;
      const instanceId = getShipInstanceId(ship);
      const existing = buckets.get(bucketKey);

      if (existing) {
        existing.count += 1;
        if (caption != null) {
          existing.caption = caption;
        }
        if (instanceId) {
          existing.memberInstanceIds.push(instanceId);
        }
        continue;
      }

      buckets.set(bucketKey, {
        shipDefId,
        count: 1,
        condition,
        currentCharges,
        caption,
        memberInstanceIds: instanceId ? [instanceId] : [],
      });
    }

    return buildFleetSummaryFromBuckets(buckets);
  }

  const myFleet = aggregateFleet(myShips);
  const opponentFleet = aggregateFleet(opponentShipsVisible, '', {
    useOpponentPublicMultiChargeOverrides: majorPhase === 'build',
  });
  const myVoidFleet = aggregateFleet(myVoidShipsVisible, 'void__');
  const opponentVoidFleet = aggregateFleet(opponentVoidShipsVisible, 'void__');

  return {
    myShips,
    opponentShips,
    opponentShipsVisible,
    myVoidShips,
    opponentVoidShips,
    myVoidShipsVisible,
    opponentVoidShipsVisible,
    myFleet,
    opponentFleet,
    myVoidFleet,
    opponentVoidFleet,
  };
}
