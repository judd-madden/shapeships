import ts from 'typescript';
import * as React from 'react';

/** Browser-only trace collector; no trace event updates React state. */
export function installEquDiagnostics() {
  const events: any[] = [];
  let serial = 0;
  let identity = 0;
  const identities = new WeakMap<object, number>();
  const id = (value: any) => {
    if (value == null || typeof value !== 'object') return value;
    if (!identities.has(value)) identities.set(value, ++identity);
    return identities.get(value);
  };
  const copy = (value: any) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
  };
  const differences = (before: any, after: any, prefix = '', result: any[] = []) => {
    if (Object.is(before, after)) return result;
    if (before && after && typeof before === 'object' && typeof after === 'object') {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        differences(before[key], after[key], prefix ? prefix + '.' + key : key, result);
      }
    } else result.push({path: prefix, before, after});
    return result;
  };
  const diagnostic: any = {
    events, errors: [], ready: false, session: null,
    firstTargetSerial: null, countsAfterFirstTarget: {},
    identity: id,
    queues(states: Record<string, any>) {
      if (!(diagnostic.queueSamples > 0)) return undefined;
      diagnostic.queueSamples--;
      // Read-only React 18 development diagnostics; never mutate hook queues or lanes.
      const owner = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentOwner.current;
      const result: any = {fiberLanes: owner?.lanes, alternateLanes: owner?.alternate?.lanes, hooks: []};
      const lanes = (tail: any) => {
        const values: number[] = [];
        if (tail) { let item = tail.next; do { values.push(item.lane); item = item.next; } while (item && item !== tail.next && values.length < 30); }
        return values;
      };
      let hook = owner?.memoizedState;
      while (hook) {
        for (const [name, state] of Object.entries(states)) if (state && typeof state === 'object' && hook.memoizedState === state) {
          result.hooks.push({name, stateId: id(state), baseStateId: id(hook.baseState),
            baseQueue: lanes(hook.baseQueue), pending: lanes(hook.queue?.pending)});
        }
        hook = hook.next;
      }
      return result;
    },
    dispatch(name: string, action: () => any) {
      diagnostic.emit('dispatch', {name});
      return action();
    },
    emit(kind: string, value: any) {
      if (kind === 'interaction.target') {
        diagnostic.queueSamples = 12;
        diagnostic.firstTargetSerial ??= serial + 1;
      }
      if (diagnostic.firstTargetSerial != null) diagnostic.countsAfterFirstTarget[kind] =
        (diagnostic.countsAfterFirstTarget[kind] ?? 0) + 1;
      events.push({serial: ++serial, at: performance.now(), kind, value: copy(value)});
      if (events.length > 2000) events.splice(0, events.length - 2000);
    },
    update(name: string, before: any, compute: () => any) {
      const next = compute();
      diagnostic.emit('updater.' + name, {beforeId: id(before), afterId: id(next),
        changed: !Object.is(before, next), differences: differences(before, next)});
      return next;
    },
    export() { return {events: [...events], errors: [...diagnostic.errors], settings: diagnostic.settings,
      firstTargetSerial: diagnostic.firstTargetSerial, countsAfterFirstTarget: {...diagnostic.countsAfterFirstTarget}}; },
  };
  (globalThis as any).__equDiagnostic = diagnostic;
  for (const name of ['error', 'unhandledrejection']) window.addEventListener(name, (event: any) => {
    const message = String(event.error?.stack ?? event.reason?.stack ?? event.message ?? event.reason);
    diagnostic.errors.push(message);
    diagnostic.emit('browser.' + name, {message});
  });
  return diagnostic;
}

/** In-memory instrumentation only. Original files and dependency arrays stay untouched. */
export function instrumentEquSource(source: string, fileName: string, guardStats = false, detailed = false, guardDraft = false) {
  let code = source.replace(/\r\n/g, '\n');
  const diagnostic = '(globalThis as any).__equDiagnostic';
  if (guardDraft && fileName.endsWith('/destroyTargeting.ts')) {
    const anchor = '    setDestroyTargetDraft((prev) =>\n      areDestroyTargetDraftStatesEqual(prev, reconciledDraft)';
    if (!code.includes(anchor)) throw new Error('Draft guard experiment anchor changed');
    code = code.replace(anchor, `    if (areDestroyTargetDraftStatesEqual(destroyTargetDraft, reconciledDraft)) return;
${anchor}`);
    code = code.replace('  }, [\n    allocatedDestroyTargetIdsBySourceInstanceId,\n    cleanedDestroyTargetLocatorKeysBySourceInstanceId,',
      '  }, [\n    destroyTargetDraft,\n    allocatedDestroyTargetIdsBySourceInstanceId,\n    cleanedDestroyTargetLocatorKeysBySourceInstanceId,');
  }
  if (guardStats && fileName.endsWith('/useGameSession.ts')) {
    // Controlled experiment: run the same synchronizer, but dispatch only a changed result.
    // Never written back to the production file.
    const match = code.match(/setTurnStartStatPresentationState\(\(current\) =>\s*syncTurnStartStatPresentation\(current, (\{[\s\S]*?\n      \})\)\s*\);/);
    if (!match) throw new Error('Stats guard experiment anchor changed');
    code = code.replace(match[0], `const nextStats = syncTurnStartStatPresentation(turnStartStatPresentationState, ${match[1]});
    ${diagnostic}.emit('experiment.stats-guard', {changed: nextStats !== turnStartStatPresentationState});
    if (nextStats !== turnStartStatPresentationState) setTurnStartStatPresentationState(nextStats);`);
  }
  const parsed = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits: Array<{start: number; end: number; value: string}> = [];
  const tracked = new Set(['setTurnStartStatPresentationState', 'setDestroyTargetDraft',
    'setDestroyTargetFocus', 'setShipChoiceSelectionByInstanceId']);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && tracked.has(node.expression.getText(parsed))) {
      const updater = node.arguments[0];
      if (updater && ts.isArrowFunction(updater) && updater.parameters.length === 1) {
        const param = updater.parameters[0].name.getText(parsed);
        const body = updater.body.getText(parsed);
        const compute = ts.isBlock(updater.body) ? `() => ${body}` : `() => (${body})`;
        edits.push({start: updater.body.getStart(parsed), end: updater.body.end,
          value: `${diagnostic}.update(${JSON.stringify(node.expression.getText(parsed))}, ${param}, ${compute})`});
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    code = code.slice(0, edit.start) + edit.value + code.slice(edit.end);
  }
  // Dispatch call sites distinguish an invoked setter from an evaluated updater.
  if (detailed) {
  const dispatchTree = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const dispatchEdits: Array<{at: number; text: string}> = [];
  const dispatchVisit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const name = node.expression.text;
      if ((/^set[A-Z]/.test(name) && !['setTimeout', 'setInterval'].includes(name)) || name === 'commitCapture') {
        const line = dispatchTree.getLineAndCharacterOfPosition(node.getStart(dispatchTree)).line + 1;
        dispatchEdits.push({at: node.getStart(dispatchTree), text: `${diagnostic}.dispatch(${JSON.stringify(fileName.split('/').at(-1) + ':' + line + ':' + name)}, () => `});
        dispatchEdits.push({at: node.end, text: ')'});
      }
    }
    ts.forEachChild(node, dispatchVisit);
  };
  dispatchVisit(dispatchTree);
  for (const edit of dispatchEdits.sort((a, b) => b.at - a.at)) code = code.slice(0, edit.at) + edit.text + code.slice(edit.at);
  }
  if (fileName.endsWith('/destroyTargeting.ts')) {
    const tree = ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let reconciliationBody = '';
    const findReconciliation = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') {
        const setup = node.arguments[0];
        if (setup && ts.isArrowFunction(setup) && setup.body.getText(tree).includes('const reconciledDraft:')) reconciliationBody = setup.body.getText(tree);
      }
      ts.forEachChild(node, findReconciliation);
    };
    findReconciliation(tree);
    if (!reconciliationBody) throw new Error('Production reconciliation callback unavailable');
    const anchor = '  const allocatedDestroyTargetIdBySourceInstanceId: Record<string, string> = {};';
    if (!code.includes(anchor)) throw new Error('Target diagnostics anchor changed');
    code = code.replace(anchor, `
  ${diagnostic}.targetSetters = {draft: setDestroyTargetDraft, hover: setHoveredDestroyTargetLocatorKey};
  ${diagnostic}.reconcileTargetDraft = () => ${reconciliationBody};
  ${diagnostic}.emit('target.render', {phaseKey, phaseInstanceKey,
    queues: ${diagnostic}.queues({draft: destroyTargetDraft, focus: destroyTargetFocus}),
    choices: shipChoiceSelectionByInstanceId, draft: destroyTargetDraft, focus: destroyTargetFocus,
    hover: hoveredDestroyTargetLocatorKey, cleaned: cleanedDestroyTargetLocatorKeysBySourceInstanceId,
    allocated: allocatedDestroyTargetIdsBySourceInstanceId,
    analysis: destroyTargetSourceAnalysisBySourceInstanceId,
    fleet: {my: myShips.map(s => s.instanceId), opponent: opponentShipsVisible.map(s => s.instanceId)}});
${anchor}`);
  }
  if (fileName.endsWith('/useGameSession.ts')) {
    const capturedName = code.includes('const capturedThisTurnPresentation =')
      ? 'capturedThisTurnPresentation' : 'thisTurnPresentation';
    const statsCall = code.indexOf(guardStats ? 'const nextStats =' : 'setTurnStartStatPresentationState',
      code.indexOf('const [turnStartStatPresentationState') + 100);
    const effectOpen = '  useLayoutEffect(() => {';
    const effectStart = code.lastIndexOf(effectOpen, statsCall);
    if (effectStart < 0) throw new Error('Stats diagnostics anchor changed');
    const payload = `{gameId: effectiveGameId, orientation: thisTurnStatOrientationKey, turnNumber,
      queues: ${diagnostic}.queues({stats: turnStartStatPresentationState}),
      pendingTurn: turnStartStatPresentationState.pendingTurnNumber,
      settledTurn: presentedTurnDiceSettledTurnNumber,
      resolvedSnapshot: thisTurnResolutionSnapshot,
      resolvedSnapshotId: ${diagnostic}.identity(thisTurnResolutionSnapshot),
      capturedId: ${diagnostic}.identity(${capturedName}),
      recoveredId: ${diagnostic}.identity(thisTurnPresentation),
      previousId: ${diagnostic}.identity(lastPresentedThisTurnRef.current),
      firstTurnRollStatPresentationActive,
      captured: ${capturedName}, recovered: thisTurnPresentation,
      previous: lastPresentedThisTurnRef.current, stats: turnStartStatPresentationState,
      choices: shipChoiceSelectionByInstanceId, declaration: chargeDeclarationBuild,
      candidate: currentTurnPreviewCandidate, preview: currentTurnPreview,
      pausedReason: currentTurnPreviewPausedReason}`;
    code = code.slice(0, effectStart) + `  ${diagnostic}.emit('session.render', ${payload});
  useLayoutEffect(() => { ${diagnostic}.emit('session.commit', ${payload}); });
  useLayoutEffect(() => {
    ${diagnostic}.emit('stats.effect', {});` + code.slice(effectStart + effectOpen.length);
    const returnAnchor = '  return {\n    vm: { ...vm, board: presentedBoard';
    if (!code.includes(returnAnchor)) throw new Error('Session exposure anchor changed');
    code = code.replace(returnAnchor, `  ${diagnostic}.refresh = refreshGameStateOnce;
  ${diagnostic}.session = {vm: {...vm, board: presentedBoard}, actions};
${returnAnchor}`);
    const refAnchor = '    lastPresentedThisTurnRef.current = effectiveGameId && ' + capturedName;
    code = code.replace(refAnchor, `    ${diagnostic}.emit('previous.write', {captured: ${capturedName}});
${refAnchor}`);
  }
  if (fileName.endsWith('/FleetArea.tsx')) {
    code = code.replace('key={ship.renderKey}\n        ref={displayMode',
      'key={ship.renderKey} data-equ-side={side} data-equ-stack-key={ship.stackKey}\n        ref={displayMode');
  }
  return code;
}
