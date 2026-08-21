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
