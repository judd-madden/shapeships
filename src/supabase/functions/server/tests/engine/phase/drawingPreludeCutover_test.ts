import assert from 'node:assert/strict';
import { PHASE_SEQUENCE } from '../../../engine_shared/phase/PhaseTable.ts';

Deno.test('canonical phase topology contains no global Ships That Build or End of Build phases', () => {
  assert.deepEqual(PHASE_SEQUENCE, [
    'setup.species_selection',
    'build.dice_roll',
    'build.line_generation',
    'build.drawing',
    'battle.reveal',
    'battle.first_strike',
    'battle.charge_declaration',
    'battle.end_of_turn_resolution',
  ]);
  assert.equal((PHASE_SEQUENCE as readonly string[]).includes('build.ships_that_build'), false);
  assert.equal((PHASE_SEQUENCE as readonly string[]).includes('build.end_of_build'), false);
});
