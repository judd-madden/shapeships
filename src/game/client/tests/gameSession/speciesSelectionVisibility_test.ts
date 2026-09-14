declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

import {
  getRequesterSelectedSpecies,
  isPlayerReadyForPhase,
} from '../../gameSession/selectors';
import { deriveViewerSeats } from '../../gameSession/viewerSeats';
import { deriveMatchupIntroViewModel } from '../../gameSession/matchupIntro';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message = 'values differ'): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function unresolvedState() {
  return {
    publicState: {
      players: [
        { id: 'p1', name: 'Player One', role: 'player' },
        { id: 'p2', name: 'Player Two', role: 'player' },
        { id: 'spectator', name: 'Watcher', role: 'spectator' },
      ],
      phaseReadiness: [{
        playerId: 'p1',
        isReady: true,
        currentStep: 'setup.species_selection',
      }],
    },
    requester: {
      playerId: 'p1',
      speciesSelection: { selectedSpecies: 'xenite' },
    },
  };
}

Deno.test('requester species selector validates identity and supported values', () => {
  const state = unresolvedState();
  assertEqual(getRequesterSelectedSpecies(state, 'p1'), 'xenite');
  assertEqual(getRequesterSelectedSpecies(state, 'p2'), null);
  assertEqual(getRequesterSelectedSpecies(state, ''), null);
  assertEqual(getRequesterSelectedSpecies({
    requester: {
      playerId: 12,
      speciesSelection: { selectedSpecies: 'xenite' },
    },
  }, 'p1'), null);
  assertEqual(getRequesterSelectedSpecies({
    requester: {
      playerId: 'p1',
      speciesSelection: { selectedSpecies: 'unsupported' },
    },
  }, 'p1'), null);
});

Deno.test('private requester species overlays only me and preserves public seats', () => {
  const state = unresolvedState();
  const before = JSON.stringify(state);
  const seats = deriveViewerSeats(state, 'p1');

  assertEqual(seats.viewerMode, 'p1_player');
  assertEqual(seats.me?.faction, 'xenite');
  assert(seats.me !== seats.p1, 'private me must be a clone');
  assertEqual(seats.opponent, seats.p2);
  assertEqual('faction' in seats.p1, false);
  assertEqual('faction' in seats.p2, false);
  assertEqual(
    seats.allPlayers.some((player: any) => 'faction' in player),
    false,
  );
  assertEqual(JSON.stringify(state), before);
  assertEqual(isPlayerReadyForPhase(state, 'p1'), true);
});

Deno.test('mismatched or spectator requesters never receive a private seat overlay', () => {
  const state = unresolvedState();
  const mismatched = deriveViewerSeats(state, 'p2');
  assertEqual(mismatched.me, mismatched.p2);
  assertEqual('faction' in mismatched.me, false);

  const spectator = deriveViewerSeats(state, 'spectator');
  assertEqual(spectator.viewerMode, 'spectator');
  assertEqual('faction' in spectator.p1, false);
  assertEqual('faction' in spectator.p2, false);
  assertEqual('faction' in spectator.me, false);
});

Deno.test('resolved public species remain available to matchup intro presentation', () => {
  const state: any = unresolvedState();
  state.publicState.players[0].faction = 'human';
  state.publicState.players[1].faction = 'centaur';
  delete state.requester.speciesSelection;

  const seats = deriveViewerSeats(state, 'p1');
  const matchup = deriveMatchupIntroViewModel({
    gameId: 'species-visibility-game',
    isFinished: false,
    isPlayerViewer: true,
    phaseKey: 'setup.species_selection',
    phaseHold: {
      phaseKey: 'setup.species_selection',
      holdReason: 'matchup_intro',
      holdStartedAtMs: 100,
      holdUntilMs: 3_400,
    },
    localPlayer: seats.me,
    opponentPlayer: seats.opponent,
  });

  assert(matchup);
  assertEqual(matchup.localPlayer.speciesId, 'human');
  assertEqual(matchup.opponentPlayer.speciesId, 'centaur');
});
