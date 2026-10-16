export interface WinStreakStateFixtureArgs {
  gameId: string;
  status?: 'active' | 'finished';
  winner?: string | null;
  reason?: string | null;
  appliedCount?: number;
  humanPlayerId?: string;
  botPlayerId?: string;
  requesterPlayerId?: string;
  canRestart?: boolean;
  turnNumber?: number;
  restartLifecycle?: {
    kind: 'source' | 'replacement';
    status: 'pending' | 'completed';
    sourceGameId: string;
    replacementGameId: string;
  } | null;
}

function fixturePlayers(humanPlayerId: string, botPlayerId: string) {
  return [
    { id: humanPlayerId, role: 'player' },
    { id: botPlayerId, role: 'player' },
  ];
}

function publicControllers(humanPlayerId: string, botPlayerId: string) {
  return {
    [humanPlayerId]: { kind: 'player' },
    [botPlayerId]: {
      kind: 'bot',
      speciesId: 'HUM',
      chosenPlanId: 'hum_guardian_tactical_control',
    },
  };
}

export function publicGameState(args: WinStreakStateFixtureArgs): any {
  const humanPlayerId = args.humanPlayerId ?? 'human';
  const botPlayerId = args.botPlayerId ?? 'bot';
  const turnNumber = args.turnNumber ?? 1;
  const players = fixturePlayers(humanPlayerId, botPlayerId);
  const controllersByPlayerId = publicControllers(humanPlayerId, botPlayerId);
  const winStreakBonus = {
    appliedCount: args.appliedCount ?? 0,
    recipientPlayerId: botPlayerId,
  };

  return {
    gameId: args.gameId,
    status: args.status ?? 'active',
    turnNumber,
    players: structuredClone(players),
    controllersByPlayerId: structuredClone(controllersByPlayerId),
    gameData: {
      turnNumber,
      winStreakBonus: structuredClone(winStreakBonus),
    },
    meta: {
      turnNumber,
      phaseKey: 'build.drawing',
      subPhaseKey: 'drawing',
    },
    publicState: {
      players,
      controllersByPlayerId,
      winStreakBonus,
    },
    requester: {
      playerId: args.requesterPlayerId ?? humanPlayerId,
      winStreakReset: {
        canRestart: args.canRestart === true,
        lifecycle: args.restartLifecycle ?? null,
      },
    },
    result: {
      winnerPlayerId: args.winner ?? null,
      resultReason: args.reason ?? null,
    },
  };
}

export function acceptedIntentState(args: WinStreakStateFixtureArgs): any {
  const humanPlayerId = args.humanPlayerId ?? 'human';
  const botPlayerId = args.botPlayerId ?? 'bot';
  const turnNumber = args.turnNumber ?? 1;

  return {
    gameId: args.gameId,
    status: args.status ?? 'active',
    turnNumber,
    players: fixturePlayers(humanPlayerId, botPlayerId),
    controllersByPlayerId: publicControllers(humanPlayerId, botPlayerId),
    gameData: {
      turnNumber,
      winStreakBonus: {
        appliedCount: args.appliedCount ?? 0,
        recipientPlayerId: botPlayerId,
      },
    },
    winnerPlayerId: args.winner ?? null,
    resultReason: args.reason ?? null,
  };
}

export function legacyInternalGameState(args: WinStreakStateFixtureArgs): any {
  const state = acceptedIntentState(args);
  const humanPlayerId = args.humanPlayerId ?? 'human';
  state.controllersByPlayerId[humanPlayerId] = { kind: 'human' };
  state.requester = { playerId: args.requesterPlayerId ?? humanPlayerId };
  return state;
}
