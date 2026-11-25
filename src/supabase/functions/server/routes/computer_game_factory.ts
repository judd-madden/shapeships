import { initializeClocks } from '../engine/clock/clock.ts';
import type { TimeControlConfig } from '../engine/clock/clock.ts';
import { syncPhaseFields } from '../engine/phase/syncPhaseFields.ts';
import { normalizeAncientGameState } from '../engine/state/ancientState.ts';

export const INITIAL_SAVED_LINES = 3;

export function createFreshComputerGameData(
  gameId: string,
  playerId: string,
  playerName: string,
  timeControl?: TimeControlConfig | null,
  winStreakCount = 0,
  accountId?: string,
): any {
  const nowIso = new Date().toISOString();
  const botPlayerId = `bot_${gameId}`;

  // Only the human name is resolved at the HTTP boundary. Computer and System
  // are trusted server identities and never enter name/ban enforcement.

  let gameData = {
    gameId,
    players: [
      {
        id: playerId,
        name: playerName,
        ...(accountId ? { accountId } : {}),
        faction: null,
        isReady: false,
        isActive: true,
        role: 'player',
        joinedAt: nowIso,
        health: 25,
        lines: INITIAL_SAVED_LINES,
        joiningLines: 0,
      },
      {
        id: botPlayerId,
        name: 'Computer',
        faction: null,
        isReady: false,
        isActive: true,
        role: 'player',
        joinedAt: nowIso,
        health: 25,
        lines: INITIAL_SAVED_LINES,
        joiningLines: 0,
      },
    ],
    controllersByPlayerId: {
      [playerId]: { kind: 'human' },
      [botPlayerId]: {
        kind: 'bot',
        speciesId: null,
        chosenPlanId: null,
      },
    },
    gameData: {
      ships: {
        [playerId]: [],
        [botPlayerId]: [],
      },
      winStreakBonus: {
        appliedCount: winStreakCount,
        recipientPlayerId: botPlayerId,
      },
      currentPhase: 'setup',
      currentSubPhase: 'species_selection',
      turnNumber: 0,
      diceRoll: null,
      turnData: {
        turnNumber: 0,
        currentMajorPhase: 'setup',
        currentSubPhase: 'species_selection',
        requiredSubPhases: [],
        accumulatedDamage: {},
        accumulatedHealing: {},
        healthAtTurnStart: {},
        diceRoll: null,
        linesDistributed: false,
      },
      phaseReadiness: [],
      phaseStartTime: nowIso,
    },
    currentPhase: 'setup',
    currentSubPhase: 'species_selection',
    turnNumber: 0,
    actions: [
      {
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: `${playerName} created the game`,
        timestamp: nowIso,
      },
      {
        playerId: "system",
        playerName: "System",
        actionType: "system",
        content: "Game started! Players select species.",
        timestamp: nowIso,
      },
    ],
    status: "active",
    createdAt: nowIso,
    stateRevision: 1,
  };

  gameData = initializeClocks(gameData, timeControl);
  gameData = syncPhaseFields(gameData);
  gameData = normalizeAncientGameState(gameData).state;

  return gameData;
}

