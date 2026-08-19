/**
 * INTENT FLOWS
 * 
 * Extracted intent submission logic (commit/reveal sequences).
 * These functions do NOT import authenticatedPost/authenticatedGet/ensureSession.
 * All network calls are injected via submitIntent callback.
 */

import type React from 'react';
import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { ComputerBotSpeciesId, EvolverChoiceId } from './types';
import { buildPowerAction } from './powerIntents';
import {
  classifyRenderableFirstStrikeActions,
  getAllocatedTargetIdsForRenderableAction,
  getRenderableActionChoiceIds,
  getRenderableServerChoiceActions,
  isRenderableTargetedAction,
} from './availableActions';
import {
  getDefaultCubeDiceChoiceId,
  isRenderableCubeDiceChoiceAction,
} from './cubeDiceChoice';
import {
  findPlayerByIdentity,
  getCommitmentForPlayer,
  getPhaseKey,
  getTurnCommitments,
  getTurnNumber,
  isCommitmentCommitted,
  isCommitmentRevealed,
} from './selectors';
import type { FrozenAncientChargeDeclarationAttempt } from './ancient/ancientChargeDeclaration';
import {
  canSubmitDrawingBuild,
  constructCarrierPreludeBatch,
  normalizeDrawingPrelude,
  validateProjectedCarrierActions,
  type DrawingStage,
  type DrawingViewerParticipation,
  type NormalizedDrawingPrelude,
  type ProjectedCarrierAction,
} from './drawingPrelude';

const INTENT_TIMEOUT_MS = 8000; // fail fast to avoid wedged commits

export interface SpeciesSubmitTransportPayload {
  species: SpeciesId;
  botSpecies?: ComputerBotSpeciesId;
  completedMissionIds?: string[];
}

export function buildSpeciesSubmitPayload(args: {
  selectedSpecies: SpeciesId;
  botSpecies?: ComputerBotSpeciesId;
  completedMissionIds?: readonly string[];
}): SpeciesSubmitTransportPayload {
  if (!args.botSpecies) {
    return { species: args.selectedSpecies };
  }

  return {
    species: args.selectedSpecies,
    botSpecies: args.botSpecies,
    completedMissionIds: [...(args.completedMissionIds ?? [])],
  };
}

export type CanonicalBuildSubmitPayload = {
  builds: Array<{ shipDefId: string; count: number }>;
  frigateTriggers?: number[];
  quantumMysticSelections?: number[];
  evolverChoices?: Array<{ sourceKey: string; choiceId: EvolverChoiceId }>;
};

export type PhaseCommitCache<TPayload extends object> = {
  setCache: (key: string, payload: TPayload, nonce: string) => void;
  getCache: (key: string) => { payload?: TPayload; nonce?: string };
  clearCache: (key: string) => void;
};

function isRetryableIntentError(err: any): boolean {
  const name = err?.name || '';
  const msg = String(err?.message || '');
  // AbortError is typical when AbortController triggers
  if (name === 'AbortError') return true;
  // Some environments stringify this differently
  if (msg.toLowerCase().includes('abort')) return true;
  if (msg.toLowerCase().includes('network')) return true;
  return false;
}

/**
 * Count DICE_ROLLED events in an event array
 * Supports multiple naming conventions: DICE_ROLLED, dice.rolled, dice_rolled
 */
function countDiceRolledEvents(events: any[]): number {
  if (!Array.isArray(events)) return 0;
  let n = 0;
  for (const e of events) {
    const t = e?.type;
    if (t === 'DICE_ROLLED' || t === 'dice.rolled' || t === 'dice_rolled') {
      n++;
    }
  }
  return n;
}

function logIgnoredIntentState(context: string, payload: any): void {
  if (payload?.state == null) {
    return;
  }

  console.log(`[useGameSession] ${context}: intent returned state; ignoring it and waiting for /game-state refresh`);
}

async function readFailureResponseText(response: Response): Promise<string> {
  return response.text();
}

async function resolveAvailableActionsOrAbort(args: {
  phaseKey: string;
  availableActions: any[] | null;
  getLatestAvailableActions: () => any[] | null;
  refreshGameStateOnce: () => Promise<void>;
}): Promise<any[] | null> {
  if (Array.isArray(args.availableActions)) {
    return args.availableActions;
  }

  console.log(`[useGameSession] ${args.phaseKey}: availableActions missing, refreshing once before ready`);
  await args.refreshGameStateOnce();

  const refreshedAvailableActions = args.getLatestAvailableActions();
  if (!Array.isArray(refreshedAvailableActions)) {
    console.warn(`[useGameSession] ${args.phaseKey}: aborting ready because availableActions are still unavailable`);
    return null;
  }

  return refreshedAvailableActions;
}

/**
 * Canonical build payload builder
 * Ensures consistent ordering and structure for hash computation
 */
function makeCanonicalBuildPayload(
  buildPreviewCounts: Record<string, number>,
  frigateTriggers: number[],
  quantumMysticSelections: number[],
  evolverChoiceSourceRowIds: string[],
  evolverChoicesByRowId: Record<string, EvolverChoiceId>
): CanonicalBuildSubmitPayload {
  const buildsArray: Array<{ shipDefId: string; count: number }> = [];
  
  for (const [shipDefId, count] of Object.entries(buildPreviewCounts)) {
    // Only include entries with count > 0
    if (count <= 0) continue;
    
    // Include any shipDefId with count > 0 (UI-only; server remains authoritative)
    
    buildsArray.push({ shipDefId, count });
  }
  
  // Sort by shipDefId ascending for consistent ordering
  buildsArray.sort((a, b) => a.shipDefId.localeCompare(b.shipDefId));
  
  const frigateCount = buildsArray.find(b => b.shipDefId === 'FRI')?.count ?? 0;
  const quantumMysticCount = buildsArray.find(b => b.shipDefId === 'QUA')?.count ?? 0;
  const payload: CanonicalBuildSubmitPayload = { builds: buildsArray };

  // Only include frigateTriggers when we are actually building Frigates.
  // Length must match; otherwise omit (server will default triggers to 1).
  if (frigateCount > 0 && Array.isArray(frigateTriggers) && frigateTriggers.length === frigateCount) {
    payload.frigateTriggers = [...frigateTriggers];
  }

  if (quantumMysticCount > 0) {
    payload.quantumMysticSelections = [...quantumMysticSelections];
  }

  if (Array.isArray(evolverChoiceSourceRowIds) && evolverChoiceSourceRowIds.length > 0) {
    payload.evolverChoices = evolverChoiceSourceRowIds.map((sourceKey) => ({
      sourceKey,
      choiceId: evolverChoicesByRowId[sourceKey] ?? 'hold',
    }));
  }

  return payload;
}

export async function runSpeciesConfirmFlow(args: {
  selectedSpecies: SpeciesId;
  botSpecies?: ComputerBotSpeciesId;
  completedMissionIds?: readonly string[];
  phaseKey: string;
  phaseInstanceKey: string;
  effectiveGameId: string | null;
  turnNumber: number;

  speciesCommitDoneByPhase: Record<string, boolean>;
  speciesRevealDoneByPhase: Record<string, boolean>;
  setSpeciesCommitDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setSpeciesRevealDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  speciesCommitCache: PhaseCommitCache<{ species: SpeciesId; botSpecies?: ComputerBotSpeciesId }>;
  generateNonce: () => string;
  makeCommitHash: (payload: any, nonce: string) => Promise<string>;
  submitIntent: (body: any) => Promise<Response>;
  appendEvents: (events: any[], meta?: { label?: string; turn?: number; phaseKey?: string }) => void;
  refreshGameStateOnce: () => Promise<void>;
  mySessionId: string;
  getLatestRawState: () => any;
  bumpDiceRollSeq: (n: number) => void;
}): Promise<boolean> {
  try {
    const {
      selectedSpecies,
      botSpecies,
      completedMissionIds,
      phaseKey,
      phaseInstanceKey,
      effectiveGameId,
      turnNumber,
      speciesCommitDoneByPhase,
      setSpeciesCommitDoneByPhase,
      setSpeciesRevealDoneByPhase,
      generateNonce,
      makeCommitHash,
      submitIntent,
      appendEvents,
      refreshGameStateOnce,
      mySessionId,
      getLatestRawState,
      bumpDiceRollSeq,
    } = args;

    // Guard: cannot submit intents without a usable gameId
    if (!effectiveGameId) {
      console.warn('[intents] runSpeciesConfirmFlow called without effectiveGameId');
      return false;
    }

    const payload = buildSpeciesSubmitPayload({
      selectedSpecies,
      botSpecies,
      completedMissionIds,
    });
    
    // Check if already submitted (using commit done flag for backward compatibility)
    const commitDone = !!speciesCommitDoneByPhase[phaseInstanceKey];

    console.log('[useGameSession] onConfirmSpecies', phaseInstanceKey, { commitDone });

    if (commitDone) return false;

    // PART D: Submit SPECIES_SUBMIT (single atomic intent with nonce)
    console.log('[useGameSession] Submitting SPECIES_SUBMIT...');

    // Generate nonce
    const nonce = generateNonce();

    const response = await submitIntent({
      gameId: effectiveGameId,
      intentType: 'SPECIES_SUBMIT',
      turnNumber,
      payload,
      nonce,
    });

    if (!response.ok) {
      const errorText = await readFailureResponseText(response);
      console.error('[useGameSession] SPECIES_SUBMIT failed:', errorText);
      return false;
    }

    const result = await response.json();

    if (!result.ok) {
      logIgnoredIntentState('SPECIES_SUBMIT rejected', result);
      console.error('[useGameSession] SPECIES_SUBMIT rejected:', result.rejected);
      return false;
    }
    logIgnoredIntentState('SPECIES_SUBMIT succeeded', result);

    const events = result.events || [];
    appendEvents(events, {
      label: `SPECIES_SUBMIT (${selectedSpecies.toUpperCase()})`,
      turn: turnNumber,
      phaseKey,
    });
    
    const diceCount = countDiceRolledEvents(events);
    if (diceCount > 0) {
      bumpDiceRollSeq(diceCount);
    }

    // Refresh game state immediately to pull server's updated commitments
    await refreshGameStateOnce();

    // Verify server state reflects the selection via commitments (authoritative)
    const s = getLatestRawState();

    const commitKey = `SPECIES_${turnNumber}`;
    const me = findPlayerByIdentity(s, mySessionId);
    const serverPlayerId = me?.id ?? me?.playerId ?? me?.sessionId ?? mySessionId;
    const commitment =
      getCommitmentForPlayer(s, commitKey, serverPlayerId) ??
      getCommitmentForPlayer(s, commitKey, mySessionId);
    const serverCommitDone =
      isCommitmentCommitted(commitment) && isCommitmentRevealed(commitment);
    const turnCommitments = getTurnCommitments(s);

    if (!serverCommitDone) {
      console.warn('[SPECIES_SUBMIT] server commitments did not reflect selection after refresh', {
        mySessionId,
        serverPlayerId,
        selectedSpecies,
        submittedTurnNumber: turnNumber,
        serverTurnNumber: getTurnNumber(s),
        submittedPhaseKey: phaseKey,
        serverPhaseKey: getPhaseKey(s),
        commitKey,
        commitment: commitment ?? null,
        commitmentKeys: Object.keys(turnCommitments?.[commitKey] ?? {}),
        debugPlayerId: me?.id,
      });
      // Do not mark as done - allow user to retry
      return false;
    }

    setSpeciesCommitDoneByPhase(prev => ({ ...prev, [phaseInstanceKey]: true }));
    setSpeciesRevealDoneByPhase(prev => ({ ...prev, [phaseInstanceKey]: true }));
    console.log('✅ [useGameSession] SPECIES_SUBMIT succeeded');
    console.log('✅ [useGameSession] Species selection complete!');
    return true;
  } catch (err: any) {
    console.error('[useGameSession] Species confirmation error:', err);
    return false;
  }
}

export async function runReadyToggleFlow(args: {
  // stop conditions / gating
  isFinished: boolean;
  readyEnabled: boolean;
  readyDisabledReason: string | null;
  resumeSyncLocked: boolean;

  // phase + identity
  phaseKey: string;
  myRole: 'player' | 'spectator' | 'unknown';
  mySessionId: string | null;
  drawingParticipation: DrawingViewerParticipation;
  normalizedDrawingPrelude: NormalizedDrawingPrelude;
  drawingStage: DrawingStage;
  currentCarrierActions: ProjectedCarrierAction[] | null;
  carrierChoiceIdBySourceInstanceId: Record<string, string>;
  requesterPlayerId: string | null;

  // core routing
  effectiveGameId: string | null;
  turnNumber: number;

  // build commit context
  buildInstanceKey: string;
  buildPreviewCounts: Record<string, number>;

  frigateSelectedTriggers: number[];
  quantumMysticSelectedNumbers: number[];
  evolverChoiceSourceRowIds: string[];
  evolverChoicesByRowId: Record<string, EvolverChoiceId>;
  // build submitted tracking
  setBuildSubmittedByTurn: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;

  // done flags (legacy, kept for compatibility)
  buildCommitDoneByPhase: Record<string, boolean>;
  buildRevealDoneByPhase: Record<string, boolean>;
  setBuildCommitDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setBuildRevealDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // cache
  buildCommitCache: PhaseCommitCache<CanonicalBuildSubmitPayload>;

  // raw state + reveal sync latch
  rawState: any;
  me: any;
  setAwaitingBuildRevealSync: (value: boolean) => void;

  // helpers
  generateNonce: () => string;
  makeCommitHash: (payload: any, nonce: string) => Promise<string>;
  submitIntent: (body: any, timeoutMs?: number) => Promise<Response>;
  appendEvents: (events: any[], meta?: { label?: string; turn?: number; phaseKey?: string }) => void;
  onIntentResult?: (result: any, meta?: { label?: string; turn?: number; phaseKey?: string }) => void;
  refreshGameStateOnce: () => Promise<void>;
  maybeAutoRevealBuild: (args: any) => Promise<void>;
  bumpDiceRollSeq: (n: number) => void;

  // charge panel context (Prompt 9)
  availableActions: any[] | null;
  getLatestAvailableActions: () => any[] | null;
  getLatestRawState: () => any;
  selectedChoiceIdBySourceInstanceId: Record<string, string>;
  allocatedDestroyTargetIdsBySourceInstanceId: Record<string, string[]>;
  allocatedDestroyTargetIdBySourceInstanceId: Record<string, string>;
  destroyTargetSatisfiedBySourceInstanceId: Record<string, boolean>;
  ancientChargeDeclarationAttempt?: FrozenAncientChargeDeclarationAttempt | null;
  onAncientDeclarationExplicitRejection?: () => void;
  onAncientDeclarationEventsHandled?: () => void;
}): Promise<void> {
  const {
    isFinished,
    readyEnabled,
    readyDisabledReason,
    resumeSyncLocked,
    phaseKey,
    myRole,
    mySessionId,
    drawingParticipation,
    normalizedDrawingPrelude,
    drawingStage,
    currentCarrierActions,
    carrierChoiceIdBySourceInstanceId,
    requesterPlayerId,
    effectiveGameId,
    turnNumber,
    buildInstanceKey,
    buildPreviewCounts,
    frigateSelectedTriggers,
    quantumMysticSelectedNumbers,
    evolverChoiceSourceRowIds,
    evolverChoicesByRowId,
    setBuildSubmittedByTurn,
    buildCommitDoneByPhase,
    buildRevealDoneByPhase,
    setBuildCommitDoneByPhase,
    setBuildRevealDoneByPhase,
    buildCommitCache,
    generateNonce,
    makeCommitHash,
    submitIntent,
    appendEvents,
    onIntentResult,
    refreshGameStateOnce,
    maybeAutoRevealBuild,
    bumpDiceRollSeq,
    rawState,
    me,
    setAwaitingBuildRevealSync,
  } = args;

  if (!effectiveGameId) {
    console.warn('[intents] runReadyToggleFlow called without effectiveGameId');
    return;
  }

  // Hard stop if game finished
  if (isFinished) {
    console.log('[useGameSession] onReadyToggle ignored: game finished');
    return;
  }

  if (resumeSyncLocked) {
    console.log('[useGameSession] onReadyToggle ignored: resume sync lock active');
    return;
  }
  
  // Early guard: mySessionId required for build commit caching
  if (!mySessionId) {
    console.error('[useGameSession] Ready: cannot proceed because mySessionId is not set yet');
    return;
  }
  
  console.log(
    `[useGameSession] onReadyToggle clicked (enabled=${readyEnabled}) reason=${readyDisabledReason ?? 'none'}`
  );
  
  // Keep existing readyEnabled guard
  if (!readyEnabled) {
    console.log(`[useGameSession] Ready disabled: ${readyDisabledReason}`);
    return;
  }
  
  try {
    if (
      phaseKey === 'battle.charge_declaration' &&
      args.ancientChargeDeclarationAttempt
    ) {
      const attempt = args.ancientChargeDeclarationAttempt;
      let response: Response;

      try {
        response = await submitIntent(attempt.body, INTENT_TIMEOUT_MS);
      } catch (error) {
        if (!isRetryableIntentError(error)) {
          console.error('[useGameSession] CHARGE_DECLARATION_SUBMIT uncertain failure:', error);
          await refreshGameStateOnce();
          return;
        }

        console.warn('[useGameSession] CHARGE_DECLARATION_SUBMIT transport failure - retrying once');
        try {
          response = await submitIntent(attempt.body, INTENT_TIMEOUT_MS);
        } catch (retryError) {
          console.error('[useGameSession] CHARGE_DECLARATION_SUBMIT retry remains uncertain:', retryError);
          await refreshGameStateOnce();
          return;
        }
      }

      if (!response.ok) {
        if (response.status === 400) {
          try {
            const rejection = await response.clone().json();
            if (rejection?.ok === false && rejection?.rejected?.code) {
              console.error('[useGameSession] CHARGE_DECLARATION_SUBMIT rejected:', rejection.rejected);
              args.onAncientDeclarationExplicitRejection?.();
              await refreshGameStateOnce();
              return;
            }
          } catch {
            // A malformed error body is ambiguous; preserve the frozen attempt.
          }
        }

        console.error(
          `[useGameSession] CHARGE_DECLARATION_SUBMIT uncertain HTTP failure (${response.status})`
        );
        await refreshGameStateOnce();
        return;
      }

      let result: any;
      try {
        result = await response.json();
      } catch (error) {
        console.error('[useGameSession] CHARGE_DECLARATION_SUBMIT returned malformed success JSON:', error);
        await refreshGameStateOnce();
        return;
      }

      if (result?.ok !== true) {
        console.error('[useGameSession] CHARGE_DECLARATION_SUBMIT returned an uncertain success payload');
        await refreshGameStateOnce();
        return;
      }

      logIgnoredIntentState('CHARGE_DECLARATION_SUBMIT succeeded', result);
      if (!attempt.eventsHandled) {
        const events = Array.isArray(result.events) ? result.events : [];
        appendEvents(events, {
          label: 'CHARGE_DECLARATION_SUBMIT',
          turn: turnNumber,
          phaseKey,
        });
        onIntentResult?.(result, {
          label: 'CHARGE_DECLARATION_SUBMIT',
          turn: turnNumber,
          phaseKey,
        });
        args.onAncientDeclarationEventsHandled?.();
      }

      await refreshGameStateOnce();
      return;
    }

    if (phaseKey === 'build.drawing' && drawingStage.kind === 'prelude') {
      if (
        normalizedDrawingPrelude.kind !== 'awaiting_actions' ||
        normalizedDrawingPrelude.passIndex !== drawingStage.passIndex ||
        currentCarrierActions == null
      ) {
        console.warn('[useGameSession] build.drawing: blocking Carrier submit for invalid initial workflow');
        return;
      }

      await refreshGameStateOnce();
      const refreshedState = args.getLatestRawState();
      const refreshedTurnNumber = getTurnNumber(refreshedState);
      const refreshedPrelude = normalizeDrawingPrelude({
        phaseKey: getPhaseKey(refreshedState),
        turnNumber: refreshedTurnNumber,
        participation: drawingParticipation,
        requesterDrawingPrelude: refreshedState?.requester?.drawingPrelude,
      });
      if (
        refreshedPrelude.kind !== 'awaiting_actions' ||
        refreshedPrelude.turnNumber !== normalizedDrawingPrelude.turnNumber ||
        refreshedPrelude.passIndex !== drawingStage.passIndex
      ) {
        console.warn('[useGameSession] build.drawing: Carrier workflow changed during refresh; aborting');
        return;
      }

      const refreshedProjection = validateProjectedCarrierActions(
        args.getLatestAvailableActions(),
        refreshedPrelude.passIndex,
      );
      if (!refreshedProjection.ok) {
        console.warn(
          `[useGameSession] build.drawing: invalid refreshed Carrier projection (${refreshedProjection.reason})`,
        );
        return;
      }

      const batch = constructCarrierPreludeBatch({
        previousActions: currentCarrierActions,
        refreshedActions: refreshedProjection.actions,
        selectedChoiceIdBySourceInstanceId: carrierChoiceIdBySourceInstanceId,
      });
      if (!batch.ok) {
        console.warn(`[useGameSession] build.drawing: Carrier batch aborted (${batch.reason})`);
        return;
      }

      const batchResponse = await submitIntent({
        gameId: effectiveGameId,
        intentType: 'ACTIONS_SUBMIT',
        turnNumber: refreshedTurnNumber,
        payload: { actions: batch.actions },
        nonce: generateNonce(),
      });
      if (!batchResponse.ok) {
        const errorText = await readFailureResponseText(batchResponse);
        console.error('[useGameSession] Drawing-prelude ACTIONS_SUBMIT failed:', errorText);
        return;
      }

      const result = await batchResponse.json();
      if (!result.ok) {
        logIgnoredIntentState('Drawing-prelude ACTIONS_SUBMIT rejected', result);
        console.error('[useGameSession] Drawing-prelude ACTIONS_SUBMIT rejected:', result.rejected);
        return;
      }
      logIgnoredIntentState('Drawing-prelude ACTIONS_SUBMIT succeeded', result);
      const events = Array.isArray(result.events) ? result.events : [];
      appendEvents(events, {
        label: `ACTIONS_SUBMIT (${batch.actions.length})`,
        turn: refreshedTurnNumber,
        phaseKey,
      });
      onIntentResult?.(result, {
        label: `ACTIONS_SUBMIT (${batch.actions.length})`,
        turn: refreshedTurnNumber,
        phaseKey,
      });
      await refreshGameStateOnce();
      return;
    }

    // ========================================================================
    // SERVER-CHOICE PHASES: Batch submit ACTIONS_SUBMIT for all selected choices, then DECLARE_READY
    // ========================================================================
    if (
      phaseKey === 'build.dice_roll' ||
      phaseKey === 'battle.first_strike' ||
      phaseKey === 'battle.charge_declaration'
    ) {
      console.log(`[useGameSession] ${phaseKey}: preparing batch submission...`);
      const resolvedAvailableActions = await resolveAvailableActionsOrAbort({
        phaseKey,
        availableActions: args.availableActions,
        getLatestAvailableActions: args.getLatestAvailableActions,
        refreshGameStateOnce,
      });

      if (resolvedAvailableActions == null) {
        return;
      }

      {
        if (phaseKey === 'battle.first_strike') {
          const firstStrikeClassification =
            classifyRenderableFirstStrikeActions(resolvedAvailableActions);
          if (firstStrikeClassification.unmappedActions.length > 0) {
            for (const action of firstStrikeClassification.unmappedActions) {
              console.error(
                `[useGameSession] battle.first_strike: blocking ready for unmapped renderable action actionKey=${action.actionId} kind=${action.kind} shipDefId=${action.shipDefId}`
              );
            }
            return;
          }
        }

        const choiceActions = getRenderableServerChoiceActions(phaseKey, resolvedAvailableActions);

        const diceRollActions =
          phaseKey === 'build.dice_roll' && Array.isArray(resolvedAvailableActions)
            ? resolvedAvailableActions
            : [];
        const cubeDiceChoiceAction =
          phaseKey === 'build.dice_roll'
            ? diceRollActions.filter(
                (action: any) =>
                  action?.actionId === 'CUB#0' && action?.shipDefId === 'CUB'
              )
            : [];
        const knowledgeDiceChoiceActions =
          phaseKey === 'build.dice_roll'
            ? diceRollActions.filter(
                (action: any) =>
                  action?.actionId === 'KNO#0' && action?.shipDefId === 'KNO'
              )
            : [];

        if (
          cubeDiceChoiceAction.length > 0 &&
          knowledgeDiceChoiceActions.length > 0
        ) {
          console.error(
            '[useGameSession] build.dice_roll: blocking ready because CUB#0 and KNO#0 were projected together'
          );
          return;
        }

        if (cubeDiceChoiceAction.length > 1) {
          console.error(
            `[useGameSession] build.dice_roll: blocking ready because ${cubeDiceChoiceAction.length} CUB#0 aggregate actions were projected`
          );
          return;
        }

        if (
          cubeDiceChoiceAction.length === 1 &&
          !isRenderableCubeDiceChoiceAction(cubeDiceChoiceAction[0])
        ) {
          console.error(
            '[useGameSession] build.dice_roll: blocking ready because the CUB#0 aggregate action is malformed'
          );
          return;
        }

        const submissionChoiceActions =
          cubeDiceChoiceAction.length === 1
            ? choiceActions.filter(
                (action) =>
                  action.actionId === 'CUB#0' && action.shipDefId === 'CUB'
              )
            : choiceActions;

        const incompleteTargetedAction = submissionChoiceActions.find((action) =>
          isRenderableTargetedAction(action) &&
          args.destroyTargetSatisfiedBySourceInstanceId[action.sourceInstanceId] !== true
        );

        if (incompleteTargetedAction) {
          console.warn(
            `[useGameSession] ${phaseKey}: blocking ready because targeted action is incomplete for ${incompleteTargetedAction.sourceInstanceId}`
          );
          return;
        }
        
        console.log(`[useGameSession] Found ${submissionChoiceActions.length} renderable server actions to process`);
        
        // Build batch actions array (skip 'hold')
        const actions: any[] = [];
        
        for (const action of submissionChoiceActions) {
          const { sourceInstanceId, actionId } = action;
          
          // Determine selected choiceId
          const selectedChoiceId = args.selectedChoiceIdBySourceInstanceId[sourceInstanceId];
          const availableChoiceIds = getRenderableActionChoiceIds(action);
          const choiceId =
            phaseKey === 'build.dice_roll' &&
            actionId === 'CUB#0' &&
            action.shipDefId === 'CUB'
              ? (
                  selectedChoiceId && availableChoiceIds.includes(selectedChoiceId)
                    ? selectedChoiceId
                    : getDefaultCubeDiceChoiceId(action)
                )
              : selectedChoiceId || availableChoiceIds[0];

          if (!choiceId) {
            console.error(
              `[useGameSession] ${phaseKey}: blocking ready because no valid choice is available for actionKey=${actionId}`
            );
            return;
          }
          
          // KNO hold is stateful because it stops later reroll passes; ordinary hold means "submit no action".
          const shouldSubmitHold =
            phaseKey === 'build.dice_roll' &&
            actionId === 'KNO#0' &&
            choiceId === 'hold';

          if (choiceId === 'hold' && !shouldSubmitHold) {
            continue;
          }

          if (isRenderableTargetedAction(action)) {
            const targetInstanceIds = getAllocatedTargetIdsForRenderableAction(
              action,
              args.allocatedDestroyTargetIdsBySourceInstanceId,
              args.allocatedDestroyTargetIdBySourceInstanceId
            );
            if (targetInstanceIds.length === 0) {
              console.log(
                `[useGameSession] Skipping incomplete targeted first-strike action for ${sourceInstanceId}: no allocated target available`
              );
              continue;
            }

            actions.push(buildPowerAction({
              actionId,
              sourceInstanceId,
              choiceId,
              targetInstanceId: targetInstanceIds[0],
              targetInstanceIds,
            }));
            continue;
          }
          
          // Add to batch
          actions.push(buildPowerAction({
            actionId,
            sourceInstanceId,
            choiceId,
          }));
        }
        
        // Submit batch if any actions exist
        if (actions.length > 0) {
          console.log(`[useGameSession] ${phaseKey}: submitting ACTIONS_SUBMIT count=${actions.length}`);
          
          const batchResponse = await submitIntent({
            gameId: effectiveGameId,
            intentType: 'ACTIONS_SUBMIT',
            turnNumber,
            payload: { actions },
          });
          
          if (!batchResponse.ok) {
            const errorText = await readFailureResponseText(batchResponse);
            console.error('[useGameSession] ACTIONS_SUBMIT failed:', errorText);
            return;
          }
          
          const result = await batchResponse.json();
          
          if (!result.ok) {
            logIgnoredIntentState('ACTIONS_SUBMIT rejected', result);
            console.error('[useGameSession] ACTIONS_SUBMIT rejected:', result.rejected);
            return;
          }
          logIgnoredIntentState('ACTIONS_SUBMIT succeeded', result);
          
          const events = result.events || [];
          appendEvents(events, {
            label: `ACTIONS_SUBMIT (${actions.length})`,
            turn: turnNumber,
            phaseKey,
          });
          onIntentResult?.(result, {
            label: `ACTIONS_SUBMIT (${actions.length})`,
            turn: turnNumber,
            phaseKey,
          });
          
          const diceCount = countDiceRolledEvents(events);
          if (diceCount > 0) {
            bumpDiceRollSeq(diceCount);
          }
          
          console.log(`✅ [useGameSession] ACTIONS_SUBMIT accepted (${actions.length})`);
        } else {
          console.log('[useGameSession] No actions to submit (all hold or no choices)');
        }
      }
      
      // After ACTIONS_SUBMIT (or if no actions), submit DECLARE_READY
      console.log(`[useGameSession] ${phaseKey}: submitting DECLARE_READY...`);
      
      const readyResponse = await submitIntent({
        gameId: effectiveGameId,
        intentType: 'DECLARE_READY',
        turnNumber,
      });
      
      if (!readyResponse.ok) {
        const errorText = await readFailureResponseText(readyResponse);
        console.error('[useGameSession] DECLARE_READY failed:', errorText);
        return;
      }
      
      const readyResult = await readyResponse.json();
      
      if (!readyResult.ok) {
        logIgnoredIntentState('DECLARE_READY rejected', readyResult);
        console.error('[useGameSession] DECLARE_READY rejected:', readyResult.rejected);
        return;
      }
      logIgnoredIntentState('DECLARE_READY succeeded', readyResult);
      
      const readyEvents = readyResult.events || [];
      appendEvents(readyEvents, {
        label: 'DECLARE_READY',
        turn: turnNumber,
        phaseKey,
      });
      onIntentResult?.(readyResult, {
        label: 'DECLARE_READY',
        turn: turnNumber,
        phaseKey,
      });
      
      const readyDiceCount = countDiceRolledEvents(readyEvents);
      if (readyDiceCount > 0) {
        bumpDiceRollSeq(readyDiceCount);
      }
      
      console.log('✅ [useGameSession] DECLARE_READY accepted');
      await refreshGameStateOnce();
      return;
    }
    
    // A2) build.drawing → BUILD_SUBMIT only (no DECLARE_READY)
    if (phaseKey === 'build.drawing') {
      const latestState = args.getLatestRawState();
      const serverTurnNumber = getTurnNumber(latestState);
      const latestNormalizedPrelude = normalizeDrawingPrelude({
        phaseKey: getPhaseKey(latestState),
        turnNumber: serverTurnNumber,
        participation: drawingParticipation,
        requesterDrawingPrelude: latestState?.requester?.drawingPrelude,
      });
      if (!canSubmitDrawingBuild({
        participation: drawingParticipation,
        phaseKey: getPhaseKey(latestState),
        turnNumber: serverTurnNumber,
        normalizedPrelude: latestNormalizedPrelude,
      })) {
        console.warn('[useGameSession] build.drawing: BUILD_SUBMIT blocked by requester prelude gate');
        return;
      }

      if (
        isCommitmentCommitted(
          getCommitmentForPlayer(latestState, buildInstanceKey, requesterPlayerId),
        )
      ) {
        console.log('[useGameSession] build.drawing: requester build is already committed');
        return;
      }

      console.log('[useGameSession] build.drawing: submitting BUILD_SUBMIT...');
      
      console.log('[useGameSession] Using authoritative serverTurnNumber:', serverTurnNumber);
      
      // Track the turn number we're submitting for local gating
      const submittedTurnNumber = serverTurnNumber;
      
      // Construct canonical payload from current local preview counts
      const canonicalPayload = makeCanonicalBuildPayload(
        buildPreviewCounts,
        frigateSelectedTriggers,
        quantumMysticSelectedNumbers,
        evolverChoiceSourceRowIds,
        evolverChoicesByRowId
      );
      const payload = canonicalPayload;
      
      console.log('[useGameSession] BUILD_SUBMIT payload:', payload);
      
      // Generate nonce
      const nonce = generateNonce();
      
      // Submit BUILD_SUBMIT with timeout + single retry on abort/network error
      const body = {
        gameId: effectiveGameId,
        intentType: 'BUILD_SUBMIT',
        turnNumber: serverTurnNumber,
        payload,
        nonce,
      };
      
      let response: Response | null = null;
      
      try {
        response = await submitIntent(body, INTENT_TIMEOUT_MS);
      } catch (err: any) {
        if (isRetryableIntentError(err)) {
          console.warn('[useGameSession] BUILD_SUBMIT timed out/aborted - retrying once');
          // One retry only
          response = await submitIntent(body, INTENT_TIMEOUT_MS);
        } else {
          throw err;
        }
      }
      
      if (!response.ok) {
        const errorText = await readFailureResponseText(response);
        console.error('[useGameSession] BUILD_SUBMIT failed:', errorText);
        return;
      }
      
      const result = await response.json();
      
      // Derive canonical turn from server response (server may have normalized)
      const canonicalTurnNumber =
        result?.state?.gameData?.turnData?.turnNumber ??
        result?.state?.gameData?.turnNumber ??
        serverTurnNumber;
      
      if (!result.ok) {
        logIgnoredIntentState('BUILD_SUBMIT rejected', result);

        // Handle DUPLICATE_SUBMIT/DUPLICATE_COMMIT: treat as success locally
        if (
          result.rejected?.code === 'DUPLICATE_SUBMIT' ||
          result.rejected?.code === 'DUPLICATE_COMMIT'
        ) {
          console.warn('[useGameSession] BUILD_SUBMIT duplicate detected, treating as success', {
            serverTurnNumber,
            canonicalTurnNumber,
            code: result.rejected.code,
          });
          
          // Mark as submitted locally using the turn we actually submitted
          setBuildSubmittedByTurn(prev => ({ ...prev, [submittedTurnNumber]: true }));
          
          // Refresh state to get latest (server already set readiness via BUILD_SUBMIT)
          await refreshGameStateOnce();
          return;
        }
        
        console.error('[useGameSession] BUILD_SUBMIT rejected:', result.rejected);
        return;
      }
      logIgnoredIntentState('BUILD_SUBMIT succeeded', result);
      
      const events = result.events || [];
      appendEvents(events, {
        label: 'BUILD_SUBMIT',
        turn: canonicalTurnNumber,
        phaseKey,
      });
      onIntentResult?.(result, {
        label: 'BUILD_SUBMIT',
        turn: canonicalTurnNumber,
        phaseKey,
      });
      
      const diceCount = countDiceRolledEvents(events);
      if (diceCount > 0) {
        bumpDiceRollSeq(diceCount);
      }
      
      console.log('✅ [useGameSession] BUILD_SUBMIT accepted');
      
      // Mark as submitted locally using the turn we actually submitted
      setBuildSubmittedByTurn(prev => ({ ...prev, [submittedTurnNumber]: true }));
      
      // Refresh state to get latest (server already set readiness via BUILD_SUBMIT)
      await refreshGameStateOnce();
      return;
    }
    
    // A3) All other phases → DECLARE_READY
    console.log('[useGameSession] Submitting DECLARE_READY...');
    
    const response = await submitIntent({
      gameId: effectiveGameId,
      intentType: 'DECLARE_READY',
      turnNumber,
    });
    
    if (!response.ok) {
      const errorText = await readFailureResponseText(response);
      console.error('[useGameSession] DECLARE_READY failed:', errorText);
      return;
    }
    
    const result = await response.json();
    
    if (!result.ok) {
      logIgnoredIntentState('DECLARE_READY rejected', result);
      console.error('[useGameSession] DECLARE_READY rejected:', result.rejected);
      return;
    }
    logIgnoredIntentState('DECLARE_READY succeeded', result);
    
    // Append events to tape
    const events = result.events || [];
    appendEvents(events, {
      label: 'DECLARE_READY',
      turn: turnNumber,
      phaseKey,
    });
    onIntentResult?.(result, {
      label: 'DECLARE_READY',
      turn: turnNumber,
      phaseKey,
    });
    
    const diceCount = countDiceRolledEvents(events);
    if (diceCount > 0) {
      bumpDiceRollSeq(diceCount);
    }
    
    console.log('✅ [useGameSession] DECLARE_READY accepted');
    
    // Refresh game state immediately after declare ready
    await refreshGameStateOnce();
    
  } catch (err: any) {
    console.error('[useGameSession] onReadyToggle error:', err);
  }
}

export async function maybeAutoRevealBuild(args: {
  // guards
  phaseKey: string;
  effectiveGameId: string | null;

  // core routing
  turnNumber: number;
  buildInstanceKey: string;

  // done flags
  buildCommitDoneByPhase: Record<string, boolean>;
  buildRevealDoneByPhase: Record<string, boolean>;
  setBuildRevealDoneByPhase: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  // cache
  buildCommitCache: PhaseCommitCache<CanonicalBuildSubmitPayload>;

  // server state for truth checking
  rawState: any;
  me: any;
  mySessionId: string | null;
  
  // reveal sync latch (prevents fleet flicker)
  setAwaitingBuildRevealSync?: React.Dispatch<React.SetStateAction<boolean>>;

  // helpers
  submitIntent: (body: any) => Promise<Response>;
  appendEvents: (events: any[], meta?: { label?: string; turn?: number; phaseKey?: string }) => void;
  refreshGameStateOnce: () => Promise<void>;
  bumpDiceRollSeq: (n: number) => void;
}): Promise<void> {
  const {
    phaseKey,
    effectiveGameId,
    turnNumber,
    buildInstanceKey,
    buildCommitDoneByPhase,
    buildRevealDoneByPhase,
    setBuildRevealDoneByPhase,
    buildCommitCache,
    rawState,
    me,
    mySessionId,
    setAwaitingBuildRevealSync,
    submitIntent,
    appendEvents,
    refreshGameStateOnce,
    bumpDiceRollSeq,
  } = args;

  try {
    if (!effectiveGameId) {
      console.warn('[maybeAutoRevealBuild] Cannot auto-reveal: effectiveGameId is not set');
      return;
    }

    // Early guard: mySessionId required for cache key stability
    if (!mySessionId) {
      console.warn('[maybeAutoRevealBuild] Cannot auto-reveal: mySessionId is not set');
      return;
    }
    
    // ========================================================================
    // SERVER-AUTHORITATIVE GATING FOR BUILD_REVEAL
    // ========================================================================
    
    // Check server state for actual commit existence
    const commitments = rawState?.gameData?.turnData?.commitments ?? {};
    const buildCommitKey = `BUILD_${turnNumber}`;
    const myServerCommit = commitments?.[buildCommitKey]?.[me?.id];
    const hasServerBuildCommit = !!myServerCommit?.commitHash;
    const hasServerBuildReveal = !!myServerCommit?.revealPayload || typeof myServerCommit?.revealedAt === 'number';
    
    // Gate 1: Server must have a BUILD commit for me for this turn
    if (!hasServerBuildCommit) {
      console.log('[maybeAutoRevealBuild] Skip: no server commit found for turn', turnNumber);
      return;
    }
    
    // Gate 2: Server must NOT already have a reveal
    if (hasServerBuildReveal) {
      console.log('[maybeAutoRevealBuild] Skip: already revealed on server for turn', turnNumber);
      return;
    }
    
    // Retrieve cached payload + nonce from client-side cache
    const buildCacheKey = `${effectiveGameId}:${mySessionId}:${buildInstanceKey}`;
    let cached = buildCommitCache.getCache(buildCacheKey);
    let cachedPayload = cached.payload;
    let cachedNonce = cached.nonce;
    
    // Fallback: Load from localStorage if in-memory cache is missing
    const storageKey = `shapeships:buildCommit:${effectiveGameId}:${mySessionId}:${buildInstanceKey}`;
    
    if (!cachedPayload || !cachedNonce) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.nonce && Array.isArray(parsed?.builds)) {
            cachedPayload = { builds: parsed.builds };
            cachedNonce = parsed.nonce;
            // Repopulate in-memory cache for the rest of this session
            if (cachedNonce) {
                buildCommitCache.setCache(buildCacheKey, cachedPayload, cachedNonce);
            }
            console.log('[maybeAutoRevealBuild] Loaded build cache from localStorage');
          }
        }
      } catch (e) {
        console.warn('[maybeAutoRevealBuild] Failed to load from localStorage', e);
      }
    }
    
    if (!cachedPayload || !cachedNonce) {
      console.error(
        '[maybeAutoRevealBuild] Cannot auto-reveal: missing cached payload/nonce. ' +
        'This indicates the client lost its nonce after committing.'
      );
      return;
    }
    
    // Set reveal sync latch BEFORE submitting (prevents fleet flicker)
    if (setAwaitingBuildRevealSync) {
      setAwaitingBuildRevealSync(true);
    }
    
    const revealResponse = await submitIntent({
      gameId: effectiveGameId,
      intentType: 'BUILD_REVEAL',
      turnNumber,
      payload: cachedPayload,
      nonce: cachedNonce,
    });
    
    if (!revealResponse.ok) {
      const errorText = await revealResponse.text();
      console.error('[useGameSession] Auto BUILD_REVEAL failed:', errorText);
      return; // keep cache for retry
    }
    
    const revealResult = await revealResponse.json();
    
    if (!revealResult.ok) {
      logIgnoredIntentState('BUILD_REVEAL rejected', revealResult);
      console.error('[useGameSession] Auto BUILD_REVEAL rejected:', revealResult.rejected);
      return; // keep cache for retry
    }
    logIgnoredIntentState('BUILD_REVEAL succeeded', revealResult);
    
    const events = revealResult.events || [];
    appendEvents(events, {
      label: 'BUILD_REVEAL (auto @ battle.reveal)',
      turn: turnNumber,
      phaseKey,
    });
    
    const diceCount = countDiceRolledEvents(events);
    if (diceCount > 0) {
      bumpDiceRollSeq(diceCount);
    }
    
    setBuildRevealDoneByPhase(prev => ({ ...prev, [buildInstanceKey]: true }));
    buildCommitCache.clearCache(buildCacheKey);
    
    // Clear persisted cache from localStorage (prevent stale data across turns)
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('[maybeAutoRevealBuild] Failed to clear localStorage cache', e);
    }
    
    console.log('✅ [useGameSession] Auto BUILD_REVEAL succeeded');
    
    await refreshGameStateOnce();
  } catch (err: any) {
    console.error('[useGameSession] Auto BUILD_REVEAL error:', err);
  }
}
