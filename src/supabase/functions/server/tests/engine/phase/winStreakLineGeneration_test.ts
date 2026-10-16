import assert from 'node:assert/strict';
import { onEnterPhase } from '../../../engine/phase/onEnterPhase.ts';

function createState(): any {
  return {
    gameId: 'win-streak-lines',
    status: 'finished',
    players: [
      {
        id: 'human',
        role: 'player',
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
      {
        id: 'bot',
        role: 'player',
        health: 25,
        lines: 3,
        joiningLines: 0,
      },
    ],
    gameData: {
      turnNumber: 1,
      ships: { human: [], bot: [] },
      winStreakBonus: { appliedCount: 5, recipientPlayerId: 'bot' },
      turnData: {
        turnNumber: 1,
        diceRoll: 4,
        baseDiceRoll: 4,
        effectiveDiceRoll: 4,
        effectiveDiceRollByPlayerId: { human: 4, bot: 4 },
        diceRolled: true,
        diceFinalized: true,
        linesDistributed: false,
      },
      phaseReadiness: [],
    },
  };
}

Deno.test('turn-1 line generation grants Win Streak once without changing starting saves', () => {
  const entered = onEnterPhase(
    createState(),
    'build.dice_roll',
    'build.line_generation',
    1_000,
  );
  assert.equal(entered.state.players[0].lines, 7);
  assert.equal(entered.state.players[1].lines, 12);

  const humanGrant = entered.events.find((event: any) =>
    event.type === 'LINES_GRANTED' && event.playerId === 'human'
  );
  const botGrant = entered.events.find((event: any) =>
    event.type === 'LINES_GRANTED' && event.playerId === 'bot'
  );
  assert.equal(humanGrant.bonusLines, 0);
  assert.equal(botGrant.bonusLines, 5);
  assert.equal(botGrant.totalGranted, 9);

  const repeated = onEnterPhase(
    entered.state,
    'build.dice_roll',
    'build.line_generation',
    1_001,
  );
  assert.equal(repeated.state.players[1].lines, 12);
  assert.equal(
    repeated.events.some((event: any) => event.type === 'LINES_GRANTED'),
    false,
  );
});
