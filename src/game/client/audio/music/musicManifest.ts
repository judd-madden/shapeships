import menuSrc from './menu.mp3';
import xeniteSrc from './xenite.mp3';
import centaurSrc from './centaur.mp3';
import ancientSrc from './ancient.mp3';
import type { SpeciesId } from '../../../../components/ui/primitives/buttons/SpeciesCardButton';

export type MusicTrackId = 'menu' | 'xenite' | 'centaur' | 'ancient';

export const MUSIC_MANIFEST: Record<MusicTrackId, { src: string; label: string }> = {
  menu: { src: menuSrc, label: 'Human Theme' },
  xenite: { src: xeniteSrc, label: 'Xenite Theme' },
  centaur: { src: centaurSrc, label: 'Centaur Theme' },
  ancient: { src: ancientSrc, label: 'Ancient Theme' },
};

export function musicTrackForSpecies(species: SpeciesId): MusicTrackId {
  return species === 'human' ? 'menu' : species;
}
