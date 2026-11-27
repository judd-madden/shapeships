# Phase 23 — Music

## Planning baseline

- **Owner:** Judd Madden
- **Prepared:** 27 November 2026
- **Status:** Product behaviour agreed (Judd, 26–27 Nov). Audio files final (27 Nov, §3).
- **Audience:** Codex working in the live Shapeships repository.
- **Repository location:** `src/documentation/plans/Phase 23 Music.md`
- **Pass type:** Client only. No server, SQL, account API or game-state changes.

> This is the phase roadmap. Each pass is briefed separately; the approved brief may refine it. Phase 9 Sound and its technical addendum still govern sound effects and remain the house style for client audio (presentation only, quiet failure, cancellable timers, no autoplay errors shown to players).

## 1. Scope

**In:** four background music tracks (menu + one per non-Human species); playback on the menu screens and in games; start on the first user interaction; species-based switching for players; matchup-based playback for spectators; pause in the background; the existing Music on/off preference, plus a Music toggle in the in-game menu.

**Out:** volume sliders or a mixer; crossfades; playlists beyond the spectator rule; music on the dev dashboard; new preferences; server-side music state; changes to sound-effect cues or code (the two sound-effect files are re-levelled in 23.0; one conditional code exception in §7).

## 2. Locked decisions

| # | Decision |
|---|---|
| D1 | Tracks: `menu` (also the Human track), `xenite`, `centaur`, `ancient`. |
| D2 | Plays on Entry, menu screens and in games. |
| D3 | Starts on the first user activation anywhere (including focusing the Entry name field). Never attempts playback before that, even where the browser would allow it. |
| D4 | One fixed level, set in the files (§3): music −18 LUFS, sound effects raised 3 dB. Element volume stays 1 except during fades. On/off only, using the existing `musicEnabled` preference (default on, local + account sync). |
| D5 | Plays on mobile; pauses whenever the page is hidden (desktop included) and resumes when visible. |
| D6 | In-game Music toggle beside Sound and Health Flash, desktop panel and mobile takeover. |
| D7 | Switching: ~1 s fade-out, then the new track from the top. iOS cannot change element volume, so there it is an instant cut. |
| D8 | iOS: set `navigator.audioSession.type = 'ambient'` where supported so game audio mixes with the player's own audio and obeys the silent switch (affects sound effects too). |
| D9 | Spectators hear the matchup: mirror → loop that species' track; asymmetric → alternate the two tracks at each track's end. Human counts as `menu`. |

## 3. Music files

- Source: 44.1 kHz 16-bit stereo masters (WAV/FLAC), mastered loud (−7 to −9 LUFS, peaks ≈ 0 dBFS).
- Final format (owner, 27 Nov): MP3, 44.1 kHz stereo, CBR 128 kbps, **−18 LUFS integrated** (the mobile game norm), linear gain only, no ID3 tags or cover art, Xing/LAME header kept (Chromium reports exact durations).

| File | Length | Size | Edits |
|---|---|---|---|
| `music/menu.mp3` (Human) | 2:31 | 2.4 MB | — |
| `music/centaur.mp3` | 2:35 | 2.5 MB | — |
| `music/xenite.mp3` | 4:08 | 4.0 MB | trailing silence trimmed from 2.8 s to 0.5 s |
| `music/ancient.mp3` | 3:45 | 3.6 MB | stops at 3:45; eased (half-sine S-curve) fade-out from 3:30 (owner) |

- All tracks end in silence, so a plain loop restart is acceptable. Total 12.5 MB in the build; a Human player streams 2.4 MB, other players up to 6.4 MB, spectators up to two tracks.
- Sound effects re-levelled +3 dB (owner): `dice.mp3` I −26.0 → −23.1 LUFS through a limiter (true peak −3.3 dBFS), `destroy.mp3` I −18.9 → −15.9 LUFS (true peak −4.9). Same format as before (24 kHz stereo, 160 kbps). Simulated dice/destroy hits over every track at −18 produce no samples above 0 dBFS. Re-export from the original SFX sources if they turn up (current files are 24 kHz).
- Location (placed in the repo by Judd, 27 Nov): `src/game/client/audio/music/{menu,xenite,centaur,ancient}.mp3` (new) and `src/game/client/audio/{dice,destroy}.mp3` (replaced; no code change). Music is imported like the sound effects, so Vite emits separate hashed files under `build/assets/`; nothing enters the JS bundle and nothing downloads until played.

## 4. Behaviour

### 4.1 Desired track

A pure function decides the desired track from the current context:

| Context | Desired track |
|---|---|
| Dev dashboard (`mode === 'dev'`) | none (silent) |
| Entry, menu shell, player loading screens | `menu` |
| In a game, viewer is a player with a confirmed species | that species' track (`human` → `menu`) |
| In a game, viewer is a player without a confirmed species (species selection, including after a rematch) | keep current |
| In a game, viewer is a spectator and both species are revealed | mirror: that track, looping; asymmetric: the pair, alternating |
| In a game, spectator before both species are revealed, or game still loading | keep current |

"Keep current" means: whatever is playing continues; if nothing has played yet, `menu`.

Rules:

- If the desired track is already playing, it never restarts or fades. A Human player hears one unbroken track from first interaction, through game launch and back to the menu.
- Card clicks during species selection never change music. The signal is the authoritative species the server returns once the player confirms (it is also present after a mid-game reload).
- Spectator alternation: if the current track is one of the pair, it continues and the other follows at its end; otherwise start with the left-hand displayed player's track. Alternation uses the track's natural end (no fade). Mirror matchups and players use `loop`.
- Returning to the menu after a Xenite/Centaur/Ancient game starts `menu` from the top. A finished game keeps its music until the player leaves.

### 4.2 Playback mechanics

- One module-level controller outside React, owning **one** `HTMLAudioElement` reused for every track (swap `src`). An element started by a user gesture stays playable later on iOS, so later switches (species confirm after a server round trip, spectator alternation, resume from background) aren't blocked.
- First activation: capture-phase, passive listeners for `keydown`, `pointerup` and `touchend` (plus `pointerdown` for mouse). On touch screens `pointerdown` is not a user activation. `play()` is called synchronously inside the handler. Listeners stay armed until playback actually starts.
- If `play()` is ever refused (`NotAllowedError`), stay quiet and re-arm the activation listeners.
- Preference: the controller subscribes to the preferences store directly (not through a React effect), so turning Music on inside a click starts playback within that gesture. Off → fade/pause, clear `src` (stop downloading). Account-synced changes apply the same way.
- Loading: `preload="none"` until a track is wanted; nothing downloads before the first activation or while Music is off. A species track is fetched only when it becomes the desired track.
- Fades use element volume where it is writable; a short fade-in (~0.5 s) on start and after a switch. On iOS (volume read-only) cut instantly.
- Background: `visibilitychange` hidden → pause and remember position; visible → resume if Music is on and the desired track is unchanged; otherwise start the desired track.
- Media Session metadata (where supported): title = the track's label ("Human Theme" etc.), artist "Shapeships", so phone media cards don't show a hashed file name. No action handlers.
- Every timer and listener is cancellable; nothing plays after the controller is disposed (tests).

### 4.3 In-game toggle

Add a "Music" checkbox before "Sound" in `MenuActionPanel` and `MobileMenuTakeover` (order: Music, Sound, Health Flash), wired to `musicEnabled` exactly like Sound. The menu rail toggle is unchanged.

## 5. Integration points (verify in the live repo)

- `src/game/client/preferences/playerPreferences.ts` — `musicEnabled`, `subscribe`, synchronous `setPreference`.
- `src/App.tsx` — `mode` (`player` / `game` / `dev`); `launchGame` is in-app (pushState), so the controller survives menu → game.
- `src/game/display/GameScreen.tsx` / `useGameSession` — viewer role, authoritative `mySpecies` (`me.faction`), `displayLeftSpeciesId` / `displayRightSpeciesId` for spectators. Confirm spectators receive no species before selection completes.
- `src/game/client/audio/` — existing `soundManifest.ts` / `useGameSound.ts` (sound effects; unchanged apart from §7).
- Suggested new files: `audio/music/musicManifest.ts`, `musicTrackRule.ts` (pure), `musicController.ts` (injectable audio factory, document and store for tests), and a small hook through which App and GameScreen report context.

## 6. Tests

Pure-logic tests only (no UI/layout tests): the desired-track table (§4.1) including keep-current and dev; spectator alternation order; controller with a fake element/document/store: no play before activation; activation plays the desired track; same track never restarts; switch = fade then swap; Music off clears `src` and never loads; Music on inside a handler plays synchronously; hidden pauses and visible resumes; refused play re-arms listeners; disposal cancels timers.

## 7. Passes

- **23.0 — Files (Judd + Claude, no Codex). Done 27 Nov.** Level −18 LUFS, 128 kbps, SFX +3 dB, Ancient cut at 3:45; files placed in the repo by Judd (§3).
- **23.1 — Client implementation (Codex).** §4–§6, plus this document and its `INDEX.md` entry. Briefed 27 Nov.
- **Conditional refinement:** if the owner check finds the first dice sound silent on a phone, switch the sound-effect unlock listeners to the same activation events as §4.2.
- **23.2 — Fixes** after Claude's browser run and Judd's phone check, if needed.

## 8. Owner checks (desktop, iPhone, Android)

1. First tap/click on Entry starts the menu track; Music off from a fresh load downloads no music files (Network tab).
2. Menu → create game → species selection: menu track uninterrupted.
3. Confirm Xenite/Centaur/Ancient: fade to that track. Confirm Human: no change.
4. Rematch: track continues through selection; a new confirm switches as in 3.
5. Return to Main Menu: menu track.
6. Spectate a mirror match (loops) and an asymmetric match (alternates at track end).
7. Music toggles on the rail and in game (desktop and mobile) take effect immediately and persist; a signed-in change reaches another device.
8. Switching app/tab pauses; returning resumes.
9. iPhone: silent switch mutes game audio; the player's own music keeps playing alongside.
10. Sound effects stay clearly audible over the music; the first dice sound plays on phones.

## 9. 23.1 implementation record

Implemented 27 November 2026 as a Client/UI Pass. Playback remains presentation-only and guest-first, using the existing local/account-synced `musicEnabled` preference without new screens, storage, or APIs.

- **Files:** four modules under `src/game/client/audio/music/` (manifest, pure track rule, controller, reporting hooks); scene reporting in App; game reporting in GameScreen; Music checkboxes in MenuActionPanel and MobileMenuTakeover; three files under `src/game/client/tests/audio/` (rule tests, controller/reporting tests, shared doubles); this plan and INDEX.
- **Approved scope addition:** optional `displayLeftSpeciesId` / `displayRightSpeciesId` (`SpeciesId | null`) in `gameSession/types.ts`, populated directly in `mapVm.ts`. Music consumes these existing viewer-safe authoritative IDs, preserving unknown species instead of reading previews or formatted HUD defaults. No changes to useGameSession or server projection.
- **Approved test scope addition:** one hook mock each in `src/game/display/tests/sessionHealthBarLifecycle_test.ts` and `winStreakPresentation_test.ts`. These existing Node harnesses stub the new music reporting hook and preference hook respectively; their assertions and production behaviour are unchanged.
- **Behaviour:** one lazy singleton and one reusable audio element; lazy source assignment; synchronous activation/preference playback; quiet refusals; 1000 ms out / 500 ms in fades, or instant cuts for read-only volume; spectator looping/alternation; background pause/resume; ambient Audio Session and theme metadata where supported; cancellable timers/listeners and fenced promises/reports.
- **Approved refinements R1–R6:** App scene follows mode even on loading screens; activation is remembered while Music is off; cancelled fades restore full volume before applying the newest target; reports coalesce in a microtask while input/preference callbacks read pending values synchronously; reporting tests call the controller directly; paired pointerup/touchend events cannot duplicate a tap's playback attempt. Keep-current loops the last audible track and cancels previous spectator alternation during rematch selection.
- **Test layout:** reporting coverage shares the controller test suite; the third allowed audio test file contains reusable media/browser/storage doubles. No React rendering, new dependencies, or tooling changes.
- **Assets and guest impact:** supplied music and re-levelled sound-effect files are unchanged. No account requirement or extra guest interaction. Existing sound-effect cue/unlock code remains untouched.
- **Validation:** `npm run typecheck` passed; all 58 new audio tests passed; the full `npm run test:client -- --silent` suite passed with 1530 tests passed and 7 skipped (77 files passed, 1 skipped); `npm run lint` passed with 0 errors and the same 28 existing warnings; `npm run build` passed with separate hashed menu/xenite/centaur/ancient MP3 assets (byte-identical to the sources); tracked/new source whitespace checks passed. Existing build warnings concern the mixed static/dynamic sessionManager import and bundle size. The two approved harness mock updates resolved the initial three component-test failures; their 35 tests also passed in isolation.

Browser checks: **Not run — browser/Vite testing handled by user**. Judd supplies the repo zip for the planning assistant's Chromium activation/loading/continuity/species/rematch/spectator/toggle/visibility checks and 360px/desktop menu screenshots, then performs §8 on desktop, iPhone, and Android. Actual browser activation policy, mobile volume/audio-session support, and the wrapped three-toggle layout remain owner checks.

### 23.2 refinement record

- **Display changes:** added the shared `AudioToggle` primitive and its index export; Music and Sound now use labelled 30px speaker icons in MenuActionPanel and MobileMenuTakeover, with white/on and grey/off colours, `aria-pressed`, and the rail's pastel-purple keyboard focus outline. Health Flash retains its existing checkbox control. Existing preference/callback wiring is preserved; caller props remain accepted, so no callers needed edits.
- **Health hover:** changed only HealthTrigger in BoardStage. The summary wrapper spans both grid rows using subgrid and includes the existing 12px separation as padding. Its nested summary remains centred in row one, keeping the CombatValues anchor and the button's number-column layout width. Both sides now share a continuous descendant hit area through the gap and beneath the summary, without changing hover keys, close timing, keyboard, focus, or disabled handling.
- **Files:** `components/ui/primitives/controls/AudioToggle.tsx`, the primitives index, the two in-game menus, `game/display/layout/BoardStage.tsx` (HealthTrigger only), and this §9 record. Corrected the 23.1 audio test count to 58. No new cosmetic tests or changes to audio runtime, preferences, the menu rail, other hovers, or mobile board layouts.
- **Validation:** `npm run typecheck` passed; `npm run test:client -- --silent` passed with 1530 tests passed and 7 skipped (77 files passed, 1 skipped), including the existing menu display harnesses; `npm run lint` passed with 0 errors and the same 28 existing warnings; `npm run build` passed with the existing sessionManager import/chunk-size warnings; `git diff --check` passed. Confirmed the production CSS includes `grid-template-rows: subgrid`. No new cosmetic UI tests were added.
- **Owner checks:** browser checks **Not run — browser/Vite testing handled by user**. After Judd supplies the zip, the planning assistant re-runs the music suite, captures both menus' on/off states at desktop 1440 and mobile 360, and repeats both health hover sweeps at 1280, 1440, and 1920 to verify continuous activation and unchanged number/summary positions.
