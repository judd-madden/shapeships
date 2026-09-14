import assert from 'node:assert/strict';
import {
  hasCompletedSpeciesSelection,
  projectPlayerSpeciesForClient,
  projectSpeciesSelectionForRequester,
} from '../../../engine/state/speciesSelection.ts';
import {
  projectPublicPlayersForClient,
  sanitizeAncientStateForClient,
} from '../../../engine/state/ancientState.ts';

function player(
  id: string,
  faction: string | null,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    name: id.toUpperCase(),
    role: 'player',
    faction,
    species: faction,
    isActive: true,
    health: 25,
    lines: 0,
    joiningLines: 0,
    ...overrides,
  };
}

function unresolvedState() {
  return {
    players: [
      player('p1', 'xenite'),
      player('p2', null),
      {
        id: 'spectator',
        name: 'Watcher',
        role: 'spectator',
        faction: 'ancient',
        species: 'ancient',
      },
    ],
  };
}

Deno.test('species completion requires exactly two player-role seats with factions', () => {
  assert.equal(hasCompletedSpeciesSelection({ players: [] }), false);
  assert.equal(
    hasCompletedSpeciesSelection({ players: [player('p1', 'human')] }),
    false,
  );
  assert.equal(
    hasCompletedSpeciesSelection({
      players: [player('p1', 'human'), player('p2', null)],
    }),
    false,
  );
  assert.equal(
    hasCompletedSpeciesSelection({
      players: [
        player('p1', 'human', { isActive: false }),
        player('p2', 'centaur', { isActive: false }),
        { id: 'spectator', role: 'spectator', faction: null },
      ],
    }),
    true,
  );
  assert.equal(
    hasCompletedSpeciesSelection({
      players: [player('p1', 'human'), player('p2', 'unsupported')],
    }),
    true,
    'completion intentionally preserves the existing non-null-only rule',
  );
  assert.equal(
    hasCompletedSpeciesSelection({
      players: [
        player('p1', 'human'),
        player('p2', 'centaur'),
        player('p3', 'xenite'),
      ],
    }),
    false,
  );
});

Deno.test('requester species summary is strict, private, and omitted after resolution', () => {
  const state = unresolvedState();
  assert.deepEqual(projectSpeciesSelectionForRequester(state, 'p1'), {
    selectedSpecies: 'xenite',
  });
  assert.equal(projectSpeciesSelectionForRequester(state, 'p2'), null);
  assert.equal(projectSpeciesSelectionForRequester(state, 'spectator'), null);
  assert.equal(projectSpeciesSelectionForRequester(state, ''), null);

  state.players[0].faction = 'unsupported';
  assert.equal(projectSpeciesSelectionForRequester(state, 'p1'), null);

  state.players[0].faction = 'xenite';
  state.players[1].faction = 'human';
  assert.equal(projectSpeciesSelectionForRequester(state, 'p1'), null);
});

Deno.test('public and requester-aware player projections hide unresolved choices without mutation', () => {
  const state = unresolvedState();
  const before = structuredClone(state);
  const publicPlayers = projectPublicPlayersForClient(state) as any[];

  for (const projectedPlayer of publicPlayers) {
    assert.equal('faction' in projectedPlayer, false);
    assert.equal('species' in projectedPlayer, false);
  }

  const requesterSafe = sanitizeAncientStateForClient(state, 'p1');
  const requesterP1 = requesterSafe.players.find((entry: any) => entry.id === 'p1');
  const requesterP2 = requesterSafe.players.find((entry: any) => entry.id === 'p2');
  assert.ok(requesterP1);
  assert.ok(requesterP2);
  assert.equal(requesterP1.faction, 'xenite');
  assert.equal(requesterP1.species, 'xenite');
  assert.equal('faction' in requesterP2, false);
  assert.equal('species' in requesterP2, false);

  const spectatorSafe = sanitizeAncientStateForClient(state, 'spectator');
  for (const projectedPlayer of spectatorSafe.players) {
    assert.equal('faction' in projectedPlayer, false);
    assert.equal('species' in projectedPlayer, false);
  }

  const directPublic = projectPlayerSpeciesForClient(
    state.players[0],
    state,
    'p1',
    true,
  );
  assert.equal('faction' in directPublic, false);
  assert.deepEqual(state, before);
});

Deno.test('resolved player projections reveal both species and remain non-mutating', () => {
  const state = unresolvedState();
  state.players[1].faction = 'human';
  state.players[1].species = 'human';
  const before = structuredClone(state);

  const publicPlayers = projectPublicPlayersForClient(state) as any[];
  assert.equal(publicPlayers.find((entry) => entry.id === 'p1').faction, 'xenite');
  assert.equal(publicPlayers.find((entry) => entry.id === 'p2').faction, 'human');

  const spectatorSafe = sanitizeAncientStateForClient(state, 'spectator');
  const spectatorP1 = spectatorSafe.players.find((entry: any) => entry.id === 'p1');
  const spectatorP2 = spectatorSafe.players.find((entry: any) => entry.id === 'p2');
  assert.ok(spectatorP1);
  assert.ok(spectatorP2);
  assert.equal(spectatorP1.species, 'xenite');
  assert.equal(spectatorP2.species, 'human');
  assert.deepEqual(state, before);
});
