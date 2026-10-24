import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Read-only originals stay outside the checkout; no captured credentials are used. */
export const captureDirectory = process.env.EQU_CAPTURE_DIR ??
  path.resolve(process.cwd(), '../gpt-snapshots/crash');

export async function loadEquCapture() {
  const state = JSON.parse(await readFile(path.join(captureDirectory, 'game-state.txt'), 'utf8'));
  const har = JSON.parse(await readFile(path.join(captureDirectory, 'equ-crash.har'), 'utf8'));
  const responses = har.log.entries.map((entry: any, index: number) => {
    const content = entry.response.content;
    const text = content?.encoding === 'base64'
      ? Buffer.from(content.text, 'base64').toString('utf8') : content?.text;
    return {
      index, route: new URL(entry.request.url).pathname,
      method: entry.request.method, start: Date.parse(entry.startedDateTime),
      duration: entry.time, status: entry.response.status,
      request: entry.request.postData?.text ? JSON.parse(entry.request.postData.text) : null,
      body: text ? JSON.parse(text) : null,
    };
  });
  const preview = responses.find((response: any) =>
    response.method === 'POST' && response.route.includes('/charge-declaration-preview/') && response.status === 200);
  const action = state.requester.availableActions.find((candidate: any) => candidate.shipDefId === 'EQU');
  if (!action || !preview) throw new Error('Capture must include EQU and a successful charge preview');
  return { state, responses, preview, action };
}

/** Browser bootstrap: only transport and identity storage are doubled. React remains real. */
export function equBrowserEntry(sourcePrefix = '/src') {
  return `
import React, { Profiler, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { installEquDiagnostics } from '/src/game/client/tests/gameSession/helpers/equFirstTargetDiagnostics.ts';

const capture = await (await fetch('/__equ/capture')).json();
const settings = Object.fromEntries(new URLSearchParams(location.search));
const diagnostic = installEquDiagnostics();
document.documentElement.classList.add('app-ready'); // same reveal gate as production main.tsx
diagnostic.capture = capture;
diagnostic.settings = settings;
const nativeFetch = window.fetch.bind(window);
const player = capture.state.players.find(p => (p.id ?? p.playerId) === capture.state.requester.playerId);
sessionStorage.setItem('ss_sessionToken', 'investigation-offline-token');
sessionStorage.setItem('ss_sessionId', capture.state.requester.playerId);
sessionStorage.setItem('ss_displayName', player?.name ?? player?.playerName ?? 'qwe');
localStorage.setItem('shapeships.soundEnabled.v1', 'false');
let currentState = settings.lifecycle === 'turn4'
  ? capture.responses.find(r => r.route.includes('/game-state/') && r.body).body : capture.state;
const pending = [];
diagnostic.releasePreviews = () => pending.splice(0).forEach(resolve => resolve());
diagnostic.setState = state => { currentState = state; };
diagnostic.replayTurn4 = async () => {
  // Original full DTOs in capture order. Collapse repeated idle polls, not state transitions.
  const states = capture.responses.filter(r => r.route.includes('/game-state/') && r.body);
  const transitions = states.filter((r, i) => i === 0 || r.body.stateRevision !== states[i-1].body.stateRevision);
  for (const response of transitions.slice(1)) {
    diagnostic.emit('replay.recorded-state', {index: response.index, start: response.start,
      duration: response.duration, revision: response.body.stateRevision});
    currentState = response.body;
    await diagnostic.refresh();
    await new Promise(resolve => setTimeout(resolve, response.duration));
  }
};
window.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString(), location.href);
  if (url.origin === location.origin) return nativeFetch(input, init);
  const route = url.pathname;
  const body = init.body ? JSON.parse(init.body) : null;
  diagnostic.emit('network.request', { route, body });
  const reply = (data, status = 200) => {
    diagnostic.emit('network.response', { route, status, revision: data?.stateRevision });
    return new Response(JSON.stringify(data), { status, headers: {'Content-Type': 'application/json'} });
  };
  if (route.includes('/join-game/')) return reply({success: true}); // bootstrap scaffold, absent from HAR
  if (route.includes('/game-state-head/')) return reply({gameId: currentState.gameId,
    stateRevision: currentState.stateRevision, status: currentState.status,
    turnNumber: currentState.turnNumber, phaseKey: currentState.currentPhase + '.' + currentState.currentSubPhase,
    clock: currentState.clock});
  if (route.includes('/game-state/')) return reply(currentState);
  if (route.includes('/chat-state/')) {
    const recorded = capture.responses.find(r => r.route.includes('/chat-state/') && r.body);
    return reply(recorded?.body ?? {messages: [], spectators: []});
  }
  if (route.includes('/game-history/')) {
    // Not captured. Explicit unavailable transport, rather than invented history rows.
    diagnostic.emit('network.missing-history', {});
    return reply({reason: 'history_not_in_capture'}, 503);
  }
  if (route.includes('/charge-declaration-preview/')) {
    const expected = capture.preview.request.declaration;
    const fields = d => JSON.stringify({ordinaryChargeActions: d?.ordinaryChargeActions,
      solarCasts: d?.solarCasts, autocastEnabled: d?.autocastEnabled});
    if (fields(body?.declaration) !== fields(expected)) {
      diagnostic.emit('network.unrecorded-preview', {declaration: body?.declaration});
      // No invented successful estimate for EQU's completed pair.
      return reply({reason: 'investigation_has_no_matching_capture'}, 409);
    }
    if (settings.preview === 'pending') await new Promise(resolve => pending.push(resolve));
    // Request token is transport correlation; all estimate facts/identity are captured.
    return reply({...capture.preview.body, requestToken: body.requestToken});
  }
  diagnostic.emit('network.unexpected', {route});
  throw new Error('Offline replay has no response for ' + route);
};

const { default: GameScreen } = await import('${sourcePrefix}/game/display/GameScreen.tsx');
const { useGameSession } = await import('${sourcePrefix}/game/client/useGameSession.ts');
const { createTurnStartStatPresentationState, syncTurnStartStatPresentation } = await import('${sourcePrefix}/game/client/gameSession/clienteffects/turnStartPresentationGates.ts');
const healthHookPath = '${sourcePrefix}' + '/game/display/healthBars/useSessionHealthBarPresentation.ts';
const useSessionHealthBarPresentation = settings.probe === 'true'
  ? (await import(/* @vite-ignore */ healthHookPath)).useSessionHealthBarPresentation : null;
function SessionProbe(props) {
  const [completion, setCompletion] = React.useState(null);
  const {vm, actions} = useGameSession(props.gameId, props.playerName,
    {healthBarsEnabled: true, healthBarCompletion: completion});
  useSessionHealthBarPresentation({presentation: vm.resolvedHealth, session: vm.resolvedHealthSession,
    canAccept: !vm.isBootstrapping && vm.board.mode === 'board', onComplete: setCompletion});
  if (vm.board.mode !== 'board') return null;
  return React.createElement('div', null, ...['my', 'opponent'].flatMap(side => {
    const fleet = side === 'my' ? vm.board.myFleet : vm.board.opponentFleet;
    return fleet.map(ship => React.createElement('button', {key: side + ship.stackKey,
      'data-equ-side': side, 'data-equ-stack-key': ship.stackKey,
      onMouseDown: () => actions.onDestroyTargetStackMouseDown(side, ship.stackKey)}, side + ship.stackKey));
  }));
}
function SchedulingProbe() {
  // Reduced scheduler experiment derived after the captured full-screen failure.
  // Transition priority stands in for pending lower-priority enter/reconcile work.
  const [draft, setDraft] = React.useState({targets: []});
  const [hover, setHover] = React.useState(null);
  const metric = {current: {state: 'zero', turnNumber: 4, source: 'estimated', total: 0, rows: []},
    last: {state: 'zero', turnNumber: 3, source: 'last_actual', total: 0, rows: []}};
  const presentation = {turnNumber: 4, phaseKey: 'battle.charge_declaration', liveLog: null,
    me: {playerId: 'me', damage: metric, healing: metric}, opponent: {playerId: 'opponent', damage: metric, healing: metric},
    archiveHandoff: null, mobile: {pairKey: 'scheduler::4', opponentDetail: 'this_turn'}};
  const args = {gameId: 'scheduler', orientationKey: 'player', turnNumber: 4,
    presentation, settledTurnNumber: 4, firstTurnRollPresentationActive: false};
  const [stats, setStats] = React.useState(() => createTurnStartStatPresentationState(args));
  diagnostic.emit('scheduler.render', {draft, hover, queues: diagnostic.queues({draft, stats})});
  React.useLayoutEffect(() => {
    diagnostic.emit('scheduler.commit', {draft, hover});
    if (settings.guard === 'true') {
      const next = syncTurnStartStatPresentation(stats, args);
      if (next !== stats) setStats(next);
    } else setStats(current => diagnostic.update('scheduler.stats', current, () => syncTurnStartStatPresentation(current, args)));
  }, [presentation]);
  diagnostic.triggerScheduling = () => {
    diagnostic.queueSamples = 12;
    React.startTransition(() => {
      setDraft(current => current); // queued equivalent reconciliation
      setHover('target'); // pending lower-priority work prevents eager click-state reuse
    });
    flushSync(() => setDraft(current => ({...current, targets: ['first-target']})));
  };
  return React.createElement('div', null, draft.targets.length + ' targets');
}
const root = createRoot(document.getElementById('root'));
const screen = React.createElement(settings.probe === 'scheduling' ? SchedulingProbe : settings.probe === 'true' ? SessionProbe : GameScreen, {gameId: capture.state.gameId,
  playerName: player?.name ?? player?.playerName ?? 'qwe', onBack() {}});
root.render(React.createElement(Profiler, {id: 'game', onRender: (...args) => diagnostic.emit('react.commit', {phase: args[1]})},
  settings.strict === 'true' ? React.createElement(StrictMode, null, screen) : screen));
diagnostic.interact = (kind, side) => {
  diagnostic.emit('interaction', {kind, side});
  const sourceId = capture.action.sourceInstanceId;
  flushSync(() => {
    const {actions, vm} = diagnostic.session;
    if (kind === 'choice') actions.onSelectShipChoiceForInstance(sourceId, 'damage');
    if (kind === 'hold') actions.onSelectShipChoiceForInstance(sourceId, 'hold');
    if (kind === 'target') {
      const target = side === 'my' ? capture.action.validOwnTargets[0] : capture.action.validOpponentTargets[0];
      const fleet = side === 'my' ? vm.board.myFleet : vm.board.opponentFleet;
      const summary = fleet.find(s => s.memberInstanceIds?.includes(target.instanceId));
      if (!summary) throw new Error('Target not visible in production view model: ' + target.instanceId);
      diagnostic.emit('interaction.target', {side, instanceId: target.instanceId, stackKey: summary.stackKey});
      actions.onDestroyTargetStackMouseDown(side, summary.stackKey);
    }
  });
};
diagnostic.targetPoint = side => {
  const target = side === 'my' ? capture.action.validOwnTargets[0] : capture.action.validOpponentTargets[0];
  const fleet = side === 'my' ? diagnostic.session.vm.board.myFleet : diagnostic.session.vm.board.opponentFleet;
  const summary = fleet.find(s => s.memberInstanceIds?.includes(target.instanceId));
  const element = [...document.querySelectorAll('[data-equ-stack-key]')].find(e =>
    e.dataset.equSide === side && e.dataset.equStackKey === summary.stackKey);
  if (!element) throw new Error('Production target DOM cell not found: ' + summary.stackKey);
  diagnostic.targetCell = element;
  element.scrollIntoView({block: 'center'});
  const rect = element.getBoundingClientRect();
  diagnostic.emit('interaction.target', {side, instanceId: target.instanceId, stackKey: summary.stackKey, input: 'mouse'});
  diagnostic.targetStackKey = summary.stackKey;
  return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
};
diagnostic.targetOverlap = side => {
  diagnostic.targetPoint(side);
  // Deterministically exercise the overlap seen with real enter/press events.
  // State, target allocation, focus, and synchronization are production code.
  React.startTransition(() => {
    diagnostic.reconcileTargetDraft(); // the production effect callback, at controlled priority
    const key = side + '::' + diagnostic.targetStackKey;
    diagnostic.targetSetters.hover(current => current === key ? null : key);
  });
  flushSync(() => diagnostic.session.actions.onDestroyTargetStackMouseDown(side, diagnostic.targetStackKey));
};
diagnostic.targetBurst = side => {
  diagnostic.targetPoint(side);
  // One browser task models enter+press before the next paint. React assigns its
  // real continuous/discrete event priorities; no hooks or scheduler are mocked.
  diagnostic.targetCell.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
  diagnostic.targetCell.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, button: 0}));
  diagnostic.targetCell.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, button: 0}));
};
diagnostic.emit('environment', {innerWidth, innerHeight, mobile: matchMedia('(max-width: 767px)').matches,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches});
diagnostic.ready = true;
`;
}
