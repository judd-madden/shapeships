import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { BattleLogPanelContent } from '../../../display/shared/BattleLogPanelContent';
import { downloadBattleLog } from '../../downloadBattleLog';
import { mapBattleLogTurns } from '../../gameSession/battleLog';
import { deriveWinStreakGameViewModel, projectAuthoritativeWinStreakGame } from '../../winStreak/authoritative';
import { formatWinStreakBattleLogMessage } from '../../winStreak/battleLog';
import { createEmptyWinStreakProfile } from '../../winStreak/profile';
import { publicGameState } from './fixtures';

const message = 'Computer receives +5 bonus lines on Turn 1 due to your win streak.';

function gameVm(state = publicGameState({ gameId: 'GAME', appliedCount: 5 }), currentCount = 0) {
  const profile = createEmptyWinStreakProfile();
  profile.currentCount = currentCount;
  return deriveWinStreakGameViewModel({
    profile,
    game: projectAuthoritativeWinStreakGame(state),
    resetBusy: false,
    resetError: null,
    resetRetryAvailable: false,
  });
}

function historyTurn(turnNumber: number) {
  return {
    turnNumber,
    diceValue: 3,
    players: ['human', 'bot'].map((playerId) => ({
      playerId, name: playerId, healthEnd: 25, healthDelta: 0, fleetValueEnd: 0,
    })),
    buildLinesByPlayerId: {},
    battleLinesByPlayerId: {},
  };
}

function logVm(withTurns = true, appliedBonus = gameVm().appliedBonus) {
  return mapBattleLogTurns({
    appliedBonus,
    battleLogHistory: {
      gameId: 'GAME', revision: 1, completedTurnCount: withTurns ? 2 : 0,
      turns: withTurns ? [historyTurn(1), historyTurn(2)] : [],
    },
    thisTurn: null,
    localPlayerId: 'human', localPlayerName: 'You',
    opponentPlayerId: 'bot', opponentName: 'Computer',
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('bonus wording uses the applied count and excludes absent, zero, and non-bot recipients', () => {
  const bonus = gameVm().appliedBonus;
  expect(formatWinStreakBattleLogMessage(bonus)).toBe(message);
  expect(formatWinStreakBattleLogMessage({ ...bonus, count: 1 })).toBe(
    'Computer receives +1 bonus line on Turn 1 due to your win streak.',
  );
  for (const value of [undefined, null, { ...bonus, count: 0 },
    { ...bonus, recipientSide: 'viewer' as const }, { ...bonus, recipientSide: null }]) {
    expect(formatWinStreakBattleLogMessage(value)).toBeNull();
  }
  const multiplayer = publicGameState({ gameId: 'GAME', appliedCount: 5 });
  multiplayer.publicState.controllersByPlayerId.bot = { kind: 'player' };
  expect(logVm(false, gameVm(multiplayer).appliedBonus).battleLogStartMessage).toBeNull();
});

test('finished wins, losses, and rejoined games retain the game bonus despite profile changes', () => {
  for (const winner of ['human', 'bot']) {
    const state = publicGameState({
      gameId: 'GAME', appliedCount: 5, status: 'finished', winner, turnNumber: 8,
    });
    for (const currentCount of [0, 6, 20]) {
      const vm = gameVm(structuredClone(state), currentCount);
      expect(vm.shouldShowContent).toBe(false);
      expect(vm.appliedBonus.turnOneHoverEligible).toBe(false);
      expect(logVm(true, vm.appliedBonus).battleLogStartMessage).toBe(message);
    }
  }
});

test.each(['desktop', 'mobile'] as const)('%s panel shows one bonus below newest-first turns', (layout) => {
  const vm = logVm();
  const text = renderToStaticMarkup(createElement(BattleLogPanelContent, {
    ...vm,
    layout,
    battleLogThisTurn: {
      turnNumber: 3, showBuildSection: false, showBattleSection: false,
      me: { buildLines: [], battleLines: [] }, opponent: { buildLines: [], battleLines: [] },
    },
  })).replace(/<[^>]*>/g, '');
  expect(text.split(message)).toHaveLength(2);
  expect(text.indexOf('This Turn')).toBeLessThan(text.indexOf('Turn 2'));
  expect(text.indexOf('Turn 2')).toBeLessThan(text.indexOf('Turn 1'));
  expect(text.indexOf('Turn 1')).toBeLessThan(text.indexOf(message));
});

test.each(['desktop', 'mobile'] as const)('%s panel keeps introduction and bonus before any turns', (layout) => {
  const html = renderToStaticMarkup(createElement(BattleLogPanelContent, { ...logVm(false), layout }));
  expect(html.split(message)).toHaveLength(2);
  expect(html).toContain('The battle is about to begin!');
  const noBonusHtml = renderToStaticMarkup(createElement(BattleLogPanelContent, {
    ...logVm(false, gameVm(publicGameState({ gameId: 'GAME' })).appliedBonus), layout,
  }));
  expect(noBonusHtml).not.toContain('due to your win streak');
});

test.each([message, null])('TXT includes the optional start message once before oldest-first turns: %s', async (battleLogStartMessage) => {
  vi.useFakeTimers();
  let captured: Blob | undefined;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    captured = blob as Blob;
    return 'blob:test';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const anchor = { style: {}, click: vi.fn(), remove: vi.fn(), href: '', download: '' };
  vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
  downloadBattleLog({
    battleLogStartMessage,
    battleLogHistory: { gameId: 'GAME', completedTurnCount: 2, turns: [historyTurn(2), historyTurn(1)] },
    gameId: 'GAME',
    me: { identityKey: 'human', name: 'You', species: 'human' },
    opponent: { identityKey: 'bot', name: 'Computer', species: 'human' },
    winnerPlayerId: 'human', resultReason: 'decisive',
  });
  expect(anchor.click).toHaveBeenCalledOnce();
  const text = await captured!.text();
  expect(text.indexOf('TURN 1')).toBeLessThan(text.indexOf('TURN 2'));
  if (battleLogStartMessage) {
    expect(text.split(message)).toHaveLength(2);
    expect(text.indexOf('Exported:')).toBeLessThan(text.indexOf(message));
    expect(text.indexOf(message)).toBeLessThan(text.indexOf('TURN 1'));
  } else {
    expect(text).not.toContain('due to your win streak');
  }
  vi.runAllTimers();
});
