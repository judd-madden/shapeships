import type { SpeciesId } from '../../../../components/ui/primitives/buttons/SpeciesCardButton';
import { musicTrackForSpecies, type MusicTrackId } from './musicManifest';

export type MusicScene = 'none' | 'menu' | 'game';
export type MusicGameInfo =
  | { role: 'player'; species: SpeciesId | null }
  | { role: 'spectator'; left: SpeciesId | null; right: SpeciesId | null };
export type MusicPlayback =
  | { kind: 'loop'; track: MusicTrackId }
  | { kind: 'alternate'; left: MusicTrackId; right: MusicTrackId };
export type MusicTrackRule = MusicPlayback | { kind: 'stop' } | { kind: 'keep' };

export function getMusicTrackRule(scene: MusicScene, game: MusicGameInfo | null): MusicTrackRule {
  if (scene === 'none') return { kind: 'stop' };
  if (scene === 'menu') return { kind: 'loop', track: 'menu' };
  if (game?.role === 'player' && game.species) {
    return { kind: 'loop', track: musicTrackForSpecies(game.species) };
  }
  if (game?.role === 'spectator' && game.left && game.right) {
    const left = musicTrackForSpecies(game.left);
    const right = musicTrackForSpecies(game.right);
    return left === right ? { kind: 'loop', track: left } : { kind: 'alternate', left, right };
  }
  return { kind: 'keep' };
}

export function resolveMusicPlayback(rule: MusicTrackRule, lastPlayed: MusicTrackId | null): MusicPlayback | null {
  if (rule.kind === 'stop') return null;
  if (rule.kind === 'keep') return { kind: 'loop', track: lastPlayed ?? 'menu' };
  return rule;
}
