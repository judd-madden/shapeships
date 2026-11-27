import { describe, expect, it } from 'vitest';
import { MUSIC_MANIFEST, musicTrackForSpecies } from '../../audio/music/musicManifest';
import { getMusicTrackRule, resolveMusicPlayback, type MusicGameInfo, type MusicScene } from '../../audio/music/musicTrackRule';

describe('music track rule', () => {
  it('keeps first Entry silent, including an unresolved invite game', () => {
    expect(getMusicTrackRule('menu', null, true, false)).toEqual({ kind: 'silent' });
    expect(getMusicTrackRule('game', null, true, false)).toEqual({ kind: 'silent' });
    expect(resolveMusicPlayback({ kind: 'silent' }, null)).toBeNull();
    expect(getMusicTrackRule('none', null, true, false)).toEqual({ kind: 'stop' });
  });

  it('keeps the audible track on later Entry visits and starts menu when first Entry ends', () => {
    expect(resolveMusicPlayback(getMusicTrackRule('menu', null, true, true), 'ancient'))
      .toEqual({ kind: 'loop', track: 'ancient' });
    expect(getMusicTrackRule('menu', null, false, false)).toEqual({ kind: 'loop', track: 'menu' });
    expect(resolveMusicPlayback(getMusicTrackRule('game', null, false, false), null))
      .toEqual({ kind: 'loop', track: 'menu' });
  });

  it.each([
    ['none', null, { kind: 'stop' }],
    ['none', { role: 'player', species: 'ancient' }, { kind: 'stop' }],
    ['menu', null, { kind: 'loop', track: 'menu' }],
    ['menu', { role: 'player', species: 'ancient' }, { kind: 'loop', track: 'menu' }],
    ['game', null, { kind: 'keep' }],
    ['game', { role: 'player', species: null }, { kind: 'keep' }],
    ['game', { role: 'player', species: 'human' }, { kind: 'loop', track: 'menu' }],
    ['game', { role: 'player', species: 'xenite' }, { kind: 'loop', track: 'xenite' }],
    ['game', { role: 'player', species: 'centaur' }, { kind: 'loop', track: 'centaur' }],
    ['game', { role: 'player', species: 'ancient' }, { kind: 'loop', track: 'ancient' }],
    ['game', { role: 'spectator', left: 'human', right: 'human' }, { kind: 'loop', track: 'menu' }],
    ['game', { role: 'spectator', left: 'xenite', right: 'xenite' }, { kind: 'loop', track: 'xenite' }],
    ['game', { role: 'spectator', left: 'centaur', right: 'centaur' }, { kind: 'loop', track: 'centaur' }],
    ['game', { role: 'spectator', left: 'ancient', right: 'ancient' }, { kind: 'loop', track: 'ancient' }],
    ['game', { role: 'spectator', left: 'human', right: 'centaur' }, { kind: 'alternate', left: 'menu', right: 'centaur' }],
    ['game', { role: 'spectator', left: 'ancient', right: 'xenite' }, { kind: 'alternate', left: 'ancient', right: 'xenite' }],
    ['game', { role: 'spectator', left: null, right: 'xenite' }, { kind: 'keep' }],
    ['game', { role: 'spectator', left: 'human', right: null }, { kind: 'keep' }],
    ['game', { role: 'spectator', left: null, right: null }, { kind: 'keep' }],
  ] as Array<[MusicScene, MusicGameInfo | null, object]>)('%s / %j → %j', (scene, game, expected) => {
    expect(getMusicTrackRule(scene, game)).toEqual(expected);
  });

  it('keeps the last audible track, falling back to menu before any success', () => {
    expect(resolveMusicPlayback({ kind: 'keep' }, null)).toEqual({ kind: 'loop', track: 'menu' });
    expect(resolveMusicPlayback({ kind: 'keep' }, 'ancient')).toEqual({ kind: 'loop', track: 'ancient' });
    expect(resolveMusicPlayback({ kind: 'stop' }, 'ancient')).toBeNull();
  });

  it('has the four final theme labels and maps Human to the menu asset', () => {
    expect(Object.values(MUSIC_MANIFEST).map((track) => track.label)).toEqual([
      'Human Theme', 'Xenite Theme', 'Centaur Theme', 'Ancient Theme',
    ]);
    expect(musicTrackForSpecies('human')).toBe('menu');
    expect(MUSIC_MANIFEST[musicTrackForSpecies('human')].src).toBe(MUSIC_MANIFEST.menu.src);
  });
});
