export function recordThirdSpiralFirstStrikeEligibility(args: {
  state: any;
  playerId: string;
  sourceInstanceId: string;
  turnNumber: number;
  controlledSpiralCountBeforeCreation: number;
}): void {
  if (args.controlledSpiralCountBeforeCreation !== 2) return;

  const gameData = args.state?.gameData ?? (args.state.gameData = {});
  const turnData = gameData.turnData ?? (gameData.turnData = {});
  const current = turnData.thirdSpiralFirstStrikeEligibilityByPlayerId ?? {};
  const existing = current[args.playerId];

  if (existing?.turnNumber === args.turnNumber) return;

  turnData.thirdSpiralFirstStrikeEligibilityByPlayerId = {
    ...current,
    [args.playerId]: {
      sourceInstanceId: args.sourceInstanceId,
      turnNumber: args.turnNumber,
    },
  };
}

export function isThirdSpiralFirstStrikeEligible(
  state: any,
  playerId: string,
  sourceInstanceId: string,
): boolean {
  const currentTurnNumber = state?.gameData?.turnNumber ?? state?.turnNumber ?? 1;
  const marker =
    state?.gameData?.turnData?.thirdSpiralFirstStrikeEligibilityByPlayerId?.[playerId];

  return marker?.sourceInstanceId === sourceInstanceId &&
    marker?.turnNumber === currentTurnNumber;
}
