export function getLiveShipChargesCurrent(
  state: any,
  ownerPlayerId: string,
  instanceId: string,
): number {
  const fleet = state?.gameData?.ships?.[ownerPlayerId] ?? [];
  if (!Array.isArray(fleet)) {
    return 0;
  }

  const ship = fleet.find((candidate: any) =>
    candidate?.instanceId === instanceId
  );
  return Number(ship?.chargesCurrent ?? 0);
}

export type TacticalTargetValue = {
  totalLineCost: number;
  chargesCurrent: number;
  instanceId: string;
};

export function compareTacticalTargetValues(
  left: TacticalTargetValue,
  right: TacticalTargetValue,
): number {
  if (left.totalLineCost !== right.totalLineCost) {
    return right.totalLineCost - left.totalLineCost;
  }

  if (left.chargesCurrent !== right.chargesCurrent) {
    return right.chargesCurrent - left.chargesCurrent;
  }

  return left.instanceId.localeCompare(right.instanceId);
}

export function compareTargetsHighestTactical(
  state: any,
  left: any,
  right: any,
): number {
  return compareTacticalTargetValues(
    {
      totalLineCost: left.totalLineCost,
      chargesCurrent: getLiveShipChargesCurrent(
        state,
        left.ownerPlayerId,
        left.instanceId,
      ),
      instanceId: left.instanceId,
    },
    {
      totalLineCost: right.totalLineCost,
      chargesCurrent: getLiveShipChargesCurrent(
        state,
        right.ownerPlayerId,
        right.instanceId,
      ),
      instanceId: right.instanceId,
    },
  );
}
