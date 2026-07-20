import type { SpeciesId } from '../../../../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { BoardViewModel } from '../../../../../client/useGameSession';

function isSpeciesId(value: unknown): value is SpeciesId {
  return value === 'human' || value === 'xenite' || value === 'centaur' || value === 'ancient';
}

/**
 * Selects the catalogue-only Simulacrum graphic for the current matchup.
 * Human is a presentation fallback only; this helper does not define game state or rules.
 */
export function resolveAncientSimulacrumSpecies(boardVm?: BoardViewModel): SpeciesId {
  if (!boardVm || boardVm.mode !== 'board') {
    return 'human';
  }

  const { mySpeciesId, opponentSpeciesId } = boardVm;

  if (!isSpeciesId(mySpeciesId) || !isSpeciesId(opponentSpeciesId)) {
    return 'human';
  }

  if (mySpeciesId === 'ancient' && opponentSpeciesId === 'ancient') {
    return 'ancient';
  }

  if (mySpeciesId === 'ancient') {
    return opponentSpeciesId;
  }

  if (opponentSpeciesId === 'ancient') {
    return mySpeciesId;
  }

  return 'human';
}
