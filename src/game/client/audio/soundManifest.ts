import diceSrc from './dice.mp3';
import destroySrc from './destroy.mp3';

export type SoundCueId =
  | 'dice'
  | 'destroy'
  | 'human_me'
  | 'human_opp'
  | 'xenite_me'
  | 'xenite_opp'
  | 'centaur_me'
  | 'centaur_opp';

export interface SoundCueManifestEntry {
  id: SoundCueId;
  src: string | null;
}

export const SOUND_MANIFEST: Record<SoundCueId, SoundCueManifestEntry> = {
  dice: {
    id: 'dice',
    src: diceSrc,
  },
  destroy: {
    id: 'destroy',
    src: destroySrc,
  },
  human_me: {
    id: 'human_me',
    src: null,
  },
  human_opp: {
    id: 'human_opp',
    src: null,
  },
  xenite_me: {
    id: 'xenite_me',
    src: null,
  },
  xenite_opp: {
    id: 'xenite_opp',
    src: null,
  },
  centaur_me: {
    id: 'centaur_me',
    src: null,
  },
  centaur_opp: {
    id: 'centaur_opp',
    src: null,
  },
};

export function getSoundManifestEntry(cueId: SoundCueId): SoundCueManifestEntry {
  return SOUND_MANIFEST[cueId];
}
