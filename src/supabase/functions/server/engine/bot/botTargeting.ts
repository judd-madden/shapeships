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

export function compareTargetsHighestTactical(
  state: any,
  left: any,
  right: any,
): number {
  if (left.totalLineCost !== right.totalLineCost) {
    return right.totalLineCost - left.totalLineCost;
  }

  const leftCharges = getLiveShipChargesCurrent(
    state,
    left.ownerPlayerId,
    left.instanceId,
  );
  const rightCharges = getLiveShipChargesCurrent(
    state,
    right.ownerPlayerId,
    right.instanceId,
  );

  if (leftCharges !== rightCharges) {
    return rightCharges - leftCharges;
  }

  return left.instanceId.localeCompare(right.instanceId);
}
