/**
 * Game Screen
 * Main in-match layout shell for Alpha
 * Composition with light display orchestration for screen-level UI timing.
 * 
 * CHUNK 9.1: BOOT GATING (Loading screen until valid server state)
 * 
 * LAYOUT:
 * - Full viewport (100vw x 100vh, overflow hidden)
 * - Two columns: LeftRail (fixed width) + MainStage (flex)
 * - Loading screen: centered "LOADING GAME" until first valid server state
 * 
 * CONTROLLER:
 * - Uses useGameSession hook for ALL state and actions
 * - Passes view-models down to layout components
 */

import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo } from 'react';
import { useGameSound } from '../client/audio/useGameSound';
import { type GameSessionViewModel, useGameSession } from '../client/useGameSession';
import { LeftRail } from './layout/LeftRail';
import { MainStage } from './layout/MainStage';
import { StarsBackground } from './graphics/StarsBackground';
import { MobileGameLayout } from './mobile/MobileGameLayout';
import { useMobileGameLayout } from './mobile/useMobileGameLayout';
import { useMatchupIntroPresentation } from './matchup/useMatchupIntroPresentation';
import type { ResolvedHealthCompletionIdentity } from '../client/gameSession/types';
import { useSessionHealthBarPresentation } from './healthBars/useSessionHealthBarPresentation';
import type { ReactUpdateDiagnostic } from '../client/gameSession/clienteffects/useEndOfTurnPresentation';

const FIRST_TURN_BUILD_HELPER_FADE_MS = 150;
const SOUND_ENABLED_STORAGE_KEY = 'shapeships.soundEnabled.v1';
const BOARD_FLASH_ENABLED_STORAGE_KEY = 'shapeships.boardFlashEnabled.v1';
const MOBILE_LANDSCAPE_BLOCKER_QUERY =
  '(orientation: landscape) and (hover: none) and (pointer: coarse)';

interface GameScreenProps {
  gameId: string;
  playerName: string;
  onBack: () => void;
  onNavigateToGame?: (gameId: string) => void;
}

type DiagnosticFields = ReturnType<Parameters<ReactUpdateDiagnostic>[1]>;
interface DiagnosticEvent {
  label: string;
  fields: DiagnosticFields;
  dependencyChanges: Record<string, boolean>;
  firstSequence: number;
  lastSequence: number;
  count: number;
  firstMs: number;
  lastMs: number;
}

/** Stores scalars only. Weak identities never retain dependency objects/DTOs. */
function createReact185Recorder() {
  const startedAt = Date.now();
  let sequence = 0;
  let identitySerial = 0;
  let epoch: string | null = null;
  let context: DiagnosticFields = {};
  let initial: DiagnosticEvent[] = [];
  let recent: DiagnosticEvent[] = [];
  let previousTurn: DiagnosticEvent[] = [];
  let reported = false;
  const identities = new WeakMap<object, number>();
  const sites = new Map<string, {
    dependencies: DiagnosticFields;
    signature: string;
    event: DiagnosticEvent | null;
    attempts: number;
  }>();
  const scalar = (value: unknown): DiagnosticFields[string] => {
    if (typeof value === 'string') return value.slice(0, 160);
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
    return null;
  };
  const record: ReactUpdateDiagnostic = (label, read, dependencies = {}) => {
    try {
      if (reported) return;
      label = label.slice(0, 64);
      const fields = Object.fromEntries(Object.entries(read()).slice(0, 16)
        .map(([key, value]) => [key.slice(0, 40), scalar(value)]));
      // Only the session's render observation advances the epoch. Old timers cannot rewind it.
      if (label === 'session.context.render') {
        const nextEpoch = JSON.stringify([fields.gameId, fields.turnNumber]);
        if (epoch !== nextEpoch) {
          previousTurn = recent.slice(-16);
          initial = []; recent = []; sites.clear(); epoch = nextEpoch;
        }
        context = { gameId: fields.gameId, turnNumber: fields.turnNumber,
          phaseKey: fields.phaseKey, stateRevision: fields.stateRevision };
      }
      let site = sites.get(label);
      if (!site) {
        if (sites.size >= 32) return;
        site = { dependencies: {}, signature: '', event: null, attempts: 0 };
        sites.set(label, site);
      }
      const dependencyChanges: Record<string, boolean> = {};
      const nextDependencies: DiagnosticFields = {};
      for (const [rawKey, value] of Object.entries(dependencies).slice(0, 16)) {
        const key = rawKey.slice(0, 40);
        let token: DiagnosticFields[string];
        if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
          let id = identities.get(value);
          if (id === undefined) { id = ++identitySerial; identities.set(value, id); }
          token = `ref:${id}`;
        } else token = `${typeof value}:${String(value).slice(0, 160)}`;
        nextDependencies[key] = token;
        dependencyChanges[key] = site.attempts === 0 || site.dependencies[key] !== token;
      }
      site.dependencies = nextDependencies;
      site.attempts += 1;
      const now = Date.now() - startedAt;
      const currentSequence = ++sequence;
      const payload = { ...context, ...fields };
      const signature = JSON.stringify([payload, dependencyChanges]);
      if (site.signature === signature && site.event &&
          (initial.includes(site.event) || recent.includes(site.event))) {
        site.event.count += 1;
        site.event.lastSequence = currentSequence;
        site.event.lastMs = now;
        const index = recent.indexOf(site.event);
        if (index >= 0) recent.splice(index, 1);
        recent.push(site.event);
        if (recent.length > 40) recent.shift();
        return;
      }
      const event: DiagnosticEvent = { label, fields: payload, dependencyChanges,
        firstSequence: currentSequence, lastSequence: currentSequence, count: 1, firstMs: now, lastMs: now };
      site.signature = signature; site.event = event;
      if (initial.length < 24) initial.push(event);
      recent.push(event);
      if (recent.length > 40) recent.shift();
    } catch { /* Recording cannot alter the observed dispatch path. */ }
  };
  return {
    record,
    fail(error: Error, info: ErrorInfo): void {
      if (reported) return;
      reported = true;
      try {
        const report = JSON.stringify({ version: 1, capturedAt: new Date().toISOString(),
          error: { message: String(error.message).slice(0, 2000), stack: error.stack?.slice(0, 16000),
            componentStack: info.componentStack?.slice(0, 16000) },
          scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean).slice(0, 32)
            .map((src) => src.slice(0, 512)),
          context, observations: sequence, initial, recent, previousTurn,
          counters: Object.fromEntries([...sites].map(([label, site]) => [label, site.attempts])),
          limits: { initial: 24, recent: 40, previousTurn: 16, labels: 32 },
          interpretation: 'Render observations and dispatch attempts are not committed changes. Repeats may interleave; sequence ranges are not contiguous. The first initiating update may be absent.',
        });
        (window as Window & { __shapeshipsReact185Diagnostic?: string }).__shapeshipsReact185Diagnostic = report;
        console.error('[React185Diagnostic] ' + report);
      } catch { /* Error reporting must not replace the original failure. */ }
    },
  };
}

class React185DiagnosticBoundary extends Component<GameScreenProps, { failed: boolean }> {
  state = { failed: false };
  private readonly recorder = createReact185Recorder();
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { this.recorder.fail(error, info); }
  render() {
    return this.state.failed ? null : <GameScreenContent {...this.props} onReactDiagnostic={this.recorder.record} />;
  }
}

function DiagnosticGameScreen(props: GameScreenProps) {
  return <React185DiagnosticBoundary key={props.gameId} {...props} />;
}

function react185DiagnosticsEnabled(): boolean {
  try { return new URLSearchParams(window.location.search).get('react185Diagnostic') === '1'; }
  catch { return false; }
}

// Opt in on page load; the normal entry keeps its existing component and hooks.
const GameScreen = react185DiagnosticsEnabled() ? DiagnosticGameScreen : GameScreenContent;
export default GameScreen;

function GameScreenContent({ gameId, playerName, onBack, onNavigateToGame, onReactDiagnostic }:
  GameScreenProps & { onReactDiagnostic?: ReactUpdateDiagnostic }) {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      const storedValue = window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
      return storedValue === null ? true : storedValue === 'true';
    } catch {
      return true;
    }
  });
  const [boardFlashEnabled, setBoardFlashEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }

    try {
      const storedValue = window.localStorage.getItem(BOARD_FLASH_ENABLED_STORAGE_KEY);
      return storedValue === null ? true : storedValue === 'true';
    } catch {
      return true;
    }
  });
  const isMobileGameLayout = useMobileGameLayout();
  const [healthBarCompletion, setHealthBarCompletion] = useState<ResolvedHealthCompletionIdentity | null>(null);
  const { vm, actions } = useGameSession(gameId, playerName, {
    onReactDiagnostic,
    boardFlashEnabled,
    onNavigateToGame,
    healthBarsEnabled: true,
    healthBarCompletion,
  });
  const isMobileLandscapeBlocked = useMobileLandscapeBlocker();
  const isFinished = Boolean(vm.actionPanel.endOfGame);
  const presentedMatchupIntro = useMatchupIntroPresentation({
    gameId,
    authoritativeMatchupIntro: vm.matchupIntro,
    isFinished,
  });
  const healthBarPresentation = useSessionHealthBarPresentation({
    onReactDiagnostic,
    presentation: vm.resolvedHealth, session: vm.resolvedHealthSession,
    orientation: isMobileGameLayout ? 'mobile' : 'desktop',
    canAccept: !vm.isBootstrapping && vm.board.mode === 'board' && !presentedMatchupIntro &&
      vm.missionChallenge?.introPending !== true,
    onComplete: setHealthBarCompletion,
  });
  const firstTurnBuildHelper = useFirstTurnBuildHelper(
    gameId,
    vm,
    actions.onReadyToggle,
    presentedMatchupIntro === null
  );
  const voidShipInstanceIds = useMemo(() => {
    if (vm.board.mode !== 'board') {
      return undefined;
    }

    return [...vm.board.myVoidFleet, ...vm.board.opponentVoidFleet].flatMap(
      (fleetSummary) => fleetSummary.memberInstanceIds
    );
  }, [vm.board]);

  const mainStageActions = {
    ...actions,
    onReadyToggle: firstTurnBuildHelper.handleReadyToggle,
  };

  const celebrateOnFinish = isFinished;

  useEffect(() => {
    try {
      window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(soundEnabled));
    } catch {
      // Keep the preference in memory if browser storage is unavailable.
    }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      window.localStorage.setItem(BOARD_FLASH_ENABLED_STORAGE_KEY, String(boardFlashEnabled));
    } catch {
      // Keep the preference in memory if browser storage is unavailable.
    }
  }, [boardFlashEnabled]);

  useGameSound({
    enabled: soundEnabled,
    active: !vm.isBootstrapping,
    diceAnimateKey: vm.leftRail.diceAnimateKey,
    voidShipInstanceIds,
    shipEffects: vm.board.mode === 'board' ? vm.board.shipEffectAudio : undefined,
  });

  const mobileBoardVm = isMobileGameLayout && (
    vm.board.mode === 'board' ||
    vm.board.mode === 'choose_species'
  ) ? vm.board : null;

  function toggleSound() {
    setSoundEnabled((current) => !current);
  }

  function toggleBoardFlash() {
    setBoardFlashEnabled((current) => !current);
  }

  async function handleReturnToMainMenu() {
    if (vm.viewer.isSpectator) {
      try {
        await actions.onLeaveSpectator();
      } catch (error) {
        console.warn('[GameScreen] Spectator leave failed:', error);
      }
    }

    onBack();
  }

  // ============================================================================
  // CHUNK 9.1: BOOT GATING — Show loading screen until valid server state
  // ============================================================================
  
  if (vm.isBootstrapping) {
    return (
      <div className="w-full h-full min-h-0 overflow-hidden flex items-center justify-center bg-black">
        <div className="text-sm font-bold tracking-wide text-white">
          LOADING GAME
        </div>
      </div>
    );
  }

  if (isMobileLandscapeBlocked) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black px-6 text-center text-[18px] leading-7 text-white">
        Rotate your device to portrait to play Shapeships.
      </div>
    );
  }

  // ============================================================================
  // NORMAL GAME UI (After bootstrap complete)
  // ============================================================================

  return (
    <div className="ss-playerRoot ss-gameboardRoot relative w-full h-full min-h-0 overflow-hidden">
      {/* Stars background layer (behind everything in this screen) */}
      <div className="absolute inset-0 z-0">
        <StarsBackground celebrateOnFinish={celebrateOnFinish} celebrationSeed={gameId} />
      </div>

      <div
        aria-hidden="true"
        className={`absolute inset-0 z-[1] pointer-events-none bg-black transition-opacity ease-linear ${
          celebrateOnFinish
            ? 'opacity-50 delay-[5000ms] duration-[5000ms]'
            : 'opacity-0 delay-0 duration-300'
        }`}
      />

      {/* Foreground layout (existing UI) */}
      {mobileBoardVm ? (
        <div className="relative z-10 w-full h-full min-h-0">
          <MobileGameLayout
            gameId={gameId}
            healthBarPresentation={healthBarPresentation}
            hudVm={vm.hud}
            boardVm={mobileBoardVm}
            leftRailVm={vm.leftRail}
            turnPhasesVm={vm.turnPhases}
            turnPhasePresentation={vm.turnPhasePresentation}
            bottomActionRailVm={vm.bottomActionRail}
            actionPanelVm={vm.actionPanel}
            thisTurn={vm.thisTurn}
            presentedThisTurnStats={vm.presentedThisTurnStats}
            gameStats={vm.gameStats}
            viewer={vm.viewer}
            matchupIntro={presentedMatchupIntro}
            missionChallenge={vm.missionChallenge}
            winStreak={vm.winStreak}
            actions={mainStageActions}
            firstTurnBuildHelperEligible={firstTurnBuildHelper.firstTurnBuildHelperEligible}
            firstTurnBuildHelperDismissSignal={firstTurnBuildHelper.firstTurnBuildHelperDismissSignal}
            onFirstTurnBuildHelperDismiss={firstTurnBuildHelper.dismissFirstTurnBuildHelper}
            soundEnabled={soundEnabled}
            boardFlashEnabled={boardFlashEnabled}
            onSoundEnabledChange={setSoundEnabled}
            onBoardFlashEnabledChange={setBoardFlashEnabled}
            onToggleSound={toggleSound}
            onToggleBoardFlash={toggleBoardFlash}
            onReturnToMainMenu={handleReturnToMainMenu}
          />

          {/* Global Ship Hover Layer (PASS 2) - Portal target for catalogue hover cards */}
          <div
            id="ship-hover-layer"
            className="fixed inset-0 z-[40] pointer-events-none"
          />
        </div>
      ) : (
        <div className="relative z-10 w-full h-full min-h-0 flex items-stretch gap-5 px-[30px] min-[768px]:max-[1599px]:gap-3 min-[768px]:max-[1599px]:px-[16px]">
          {/* Left Rail - fixed width */}
          <LeftRail
            vm={vm.leftRail}
            turnPhases={vm.turnPhases}
            turnPhasePresentation={vm.turnPhasePresentation}
            actions={actions}
            winStreak={vm.winStreak}
            canResign={vm.actionPanel.menu.canResign}
            isFinished={isFinished}
            isPlayerViewer={vm.viewer.isPlayerViewer}
          />

          {/* Main Stage - fills remaining width */}
          <MainStage
            desktopHealthPresentation={healthBarPresentation}
            desktopDicePresentation={{
              diceValue: vm.leftRail.diceValue,
              diceAnimateKey: vm.leftRail.diceAnimateKey,
              diceManipulationSlots: vm.leftRail.diceManipulationSlots,
              firstTurnBuildHelperEligible: firstTurnBuildHelper.firstTurnBuildHelperEligible,
              firstTurnBuildHelperDismissSignal: firstTurnBuildHelper.firstTurnBuildHelperDismissSignal,
              onFirstTurnBuildHelperDismiss: firstTurnBuildHelper.dismissFirstTurnBuildHelper,
            }}
            gameId={gameId}
            hudVm={vm.hud}
            boardVm={vm.board}
            bottomActionRailVm={vm.bottomActionRail}
            actionPanelVm={vm.actionPanel}
            thisTurn={vm.thisTurn}
            presentedThisTurnStats={vm.presentedThisTurnStats}
            gameStats={vm.gameStats}
            viewer={vm.viewer}
            matchupIntro={presentedMatchupIntro}
            missionChallenge={vm.missionChallenge}
            winStreak={vm.winStreak}
            actions={mainStageActions}
            soundEnabled={soundEnabled}
            boardFlashEnabled={boardFlashEnabled}
            onSoundEnabledChange={setSoundEnabled}
            onBoardFlashEnabledChange={setBoardFlashEnabled}
            onReturnToMainMenu={handleReturnToMainMenu}
          />

          {/* Global Ship Hover Layer (PASS 2) - Portal target for catalogue hover cards */}
          <div
            id="ship-hover-layer"
            className="fixed inset-0 z-[60] pointer-events-none"
          />
        </div>
      )}
    </div>
  );
}

function useMobileLandscapeBlocker(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setMatches(false);
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_LANDSCAPE_BLOCKER_QUERY);
    const updateMatches = () => setMatches(mediaQuery.matches);

    updateMatches();
    mediaQuery.addEventListener?.('change', updateMatches);

    return () => {
      mediaQuery.removeEventListener?.('change', updateMatches);
    };
  }, []);

  return matches;
}

function useFirstTurnBuildHelper(
  gameId: string,
  vm: GameSessionViewModel,
  onReadyToggle: () => void,
  matchupPresentationComplete: boolean
) {
  const [hasDismissedFirstTurnBuildHelper, setHasDismissedFirstTurnBuildHelper] = useState(false);
  const [firstTurnBuildHelperDismissSignal, setFirstTurnBuildHelperDismissSignal] = useState(0);
  const isFirstTurnBuildHelperReadyPassInFlightRef = useRef(false);
  const firstTurnBuildHelperReadyDelayRef = useRef<number | null>(null);
  const firstTurnBuildHelperInvalidationTokenRef = useRef(0);

  const phaseKey = vm.actionPanel.menu.phaseKey;
  const firstTurnBuildHelperEligible =
    vm.board.mode !== 'choose_species' &&
    matchupPresentationComplete &&
    vm.leftRail.turn === 1 &&
    typeof phaseKey === 'string' &&
    phaseKey.startsWith('build.') &&
    vm.missionChallenge?.introPending !== true &&
    vm.actionPanel.menu.canResign === true;

  function dismissFirstTurnBuildHelperInternal(): boolean {
    if (!firstTurnBuildHelperEligible || hasDismissedFirstTurnBuildHelper) {
      return false;
    }

    setHasDismissedFirstTurnBuildHelper(true);
    setFirstTurnBuildHelperDismissSignal((current) => current + 1);
    return true;
  }

  useEffect(() => {
    firstTurnBuildHelperInvalidationTokenRef.current += 1;
    isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
    if (firstTurnBuildHelperReadyDelayRef.current !== null) {
      window.clearTimeout(firstTurnBuildHelperReadyDelayRef.current);
      firstTurnBuildHelperReadyDelayRef.current = null;
    }
    setHasDismissedFirstTurnBuildHelper(false);
    setFirstTurnBuildHelperDismissSignal(0);
  }, [gameId]);

  useEffect(() => {
    return () => {
      firstTurnBuildHelperInvalidationTokenRef.current += 1;
      isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
      if (firstTurnBuildHelperReadyDelayRef.current !== null) {
        window.clearTimeout(firstTurnBuildHelperReadyDelayRef.current);
        firstTurnBuildHelperReadyDelayRef.current = null;
      }
    };
  }, []);

  function dismissFirstTurnBuildHelper() {
    dismissFirstTurnBuildHelperInternal();
  }

  async function handleReadyToggle() {
    if (!firstTurnBuildHelperEligible || hasDismissedFirstTurnBuildHelper) {
      await Promise.resolve(onReadyToggle());
      return;
    }

    if (isFirstTurnBuildHelperReadyPassInFlightRef.current) {
      return;
    }

    isFirstTurnBuildHelperReadyPassInFlightRef.current = true;
    const didDismiss = dismissFirstTurnBuildHelperInternal();
    const invalidationToken = firstTurnBuildHelperInvalidationTokenRef.current;

    if (!didDismiss) {
      try {
        await Promise.resolve(onReadyToggle());
      } finally {
        if (firstTurnBuildHelperInvalidationTokenRef.current === invalidationToken) {
          isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
        }
      }
      return;
    }

    await new Promise<void>((resolve) => {
      firstTurnBuildHelperReadyDelayRef.current = window.setTimeout(() => {
        firstTurnBuildHelperReadyDelayRef.current = null;
        resolve();
      }, FIRST_TURN_BUILD_HELPER_FADE_MS);
    });

    try {
      if (firstTurnBuildHelperInvalidationTokenRef.current !== invalidationToken) {
        return;
      }

      await Promise.resolve(onReadyToggle());
    } finally {
      if (firstTurnBuildHelperInvalidationTokenRef.current === invalidationToken) {
        isFirstTurnBuildHelperReadyPassInFlightRef.current = false;
      }
    }
  }

  return {
    firstTurnBuildHelperEligible,
    firstTurnBuildHelperDismissSignal,
    dismissFirstTurnBuildHelper,
    handleReadyToggle,
  };
}
