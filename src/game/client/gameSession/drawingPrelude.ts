/**
 * Pure client helpers for the requester-local Drawing prelude.
 *
 * The server remains authoritative for workflow state, projected choices, and
 * action legality. This module only normalizes that requester-safe projection
 * and constructs fail-closed client submissions from it.
 */

export type DrawingViewerParticipation =
  | 'participant'
  | 'non_participant'
  | 'unresolved';

export type DrawingPreludePassIndex = 1 | 2;

export type NormalizedDrawingPrelude =
  | { kind: 'not_applicable'; reason: 'outside_drawing' | 'non_participant' }
  | { kind: 'unresolved' }
  | { kind: 'missing' }
  | { kind: 'stale'; turnNumber: number }
  | { kind: 'invalid' }
  | {
      kind: 'awaiting_actions';
      turnNumber: number;
      passIndex: DrawingPreludePassIndex;
      passCount: DrawingPreludePassIndex;
    }
  | {
      kind: 'complete';
      turnNumber: number;
      passIndex: DrawingPreludePassIndex;
      passCount: DrawingPreludePassIndex;
    };

export type DrawingStage =
  | { kind: 'passive' }
  | { kind: 'blocked' }
  | { kind: 'prelude'; passIndex: DrawingPreludePassIndex }
  | { kind: 'submitted' }
  | { kind: 'normal' };

export type ProjectedCarrierAction = {
  kind: 'choice';
  actionId: 'CAR#0';
  shipDefId: 'CAR';
  sourceInstanceId: string;
  passIndex: DrawingPreludePassIndex;
  choices: Array<{ choiceId: 'defender' | 'fighter' | 'hold' }>;
};

export type CarrierPreludeActionValidation =
  | { ok: true; actions: ProjectedCarrierAction[] }
  | { ok: false; reason: string };

export type CarrierPreludeBatchAction = {
  actionType: 'power';
  actionId: 'CAR#0';
  sourceInstanceId: string;
  choiceId: 'defender' | 'fighter' | 'hold';
  passIndex: DrawingPreludePassIndex;
};

export type CarrierPreludeBatchResult =
  | { ok: true; actions: CarrierPreludeBatchAction[] }
  | { ok: false; reason: string };

const CARRIER_CHOICE_IDS = new Set(['defender', 'fighter', 'hold']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPassIndex(value: unknown): value is DrawingPreludePassIndex {
  return value === 1 || value === 2;
}

export function normalizeDrawingPrelude(args: {
  phaseKey: string;
  turnNumber: number;
  participation: DrawingViewerParticipation;
  requesterDrawingPrelude: unknown;
}): NormalizedDrawingPrelude {
  if (args.phaseKey !== 'build.drawing') {
    return { kind: 'not_applicable', reason: 'outside_drawing' };
  }

  if (args.participation === 'non_participant') {
    return { kind: 'not_applicable', reason: 'non_participant' };
  }

  if (args.participation === 'unresolved') {
    return { kind: 'unresolved' };
  }

  if (args.requesterDrawingPrelude == null) {
    return { kind: 'missing' };
  }

  if (!isRecord(args.requesterDrawingPrelude)) {
    return { kind: 'invalid' };
  }

  const { turnNumber, status, passIndex, passCount } = args.requesterDrawingPrelude;
  if (!Number.isInteger(turnNumber) || typeof turnNumber !== 'number') {
    return { kind: 'invalid' };
  }

  if (turnNumber !== args.turnNumber) {
    return { kind: 'stale', turnNumber };
  }

  if (
    (status !== 'awaiting_actions' && status !== 'complete') ||
    !isPassIndex(passIndex) ||
    !isPassIndex(passCount) ||
    passIndex > passCount
  ) {
    return { kind: 'invalid' };
  }

  return {
    kind: status,
    turnNumber,
    passIndex,
    passCount,
  };
}

export function deriveDrawingStage(args: {
  normalizedPrelude: NormalizedDrawingPrelude;
  hasExistingDrawingCommitment: boolean;
}): DrawingStage {
  switch (args.normalizedPrelude.kind) {
    case 'not_applicable':
      return { kind: 'passive' };
    case 'unresolved':
    case 'missing':
    case 'stale':
    case 'invalid':
      return { kind: 'blocked' };
    case 'awaiting_actions':
      return { kind: 'prelude', passIndex: args.normalizedPrelude.passIndex };
    case 'complete':
      return args.hasExistingDrawingCommitment
        ? { kind: 'submitted' }
        : { kind: 'normal' };
  }
}

export function getDrawingPhaseInstanceSuffix(stage: DrawingStage): string {
  return stage.kind === 'prelude'
    ? `prelude:${stage.passIndex}`
    : stage.kind;
}

export function validateProjectedCarrierActions(
  availableActions: unknown,
  passIndex: DrawingPreludePassIndex,
): CarrierPreludeActionValidation {
  if (!Array.isArray(availableActions) || availableActions.length === 0) {
    return { ok: false, reason: 'missing projected Carrier actions' };
  }

  const seenSources = new Set<string>();
  const actions: ProjectedCarrierAction[] = [];

  for (const value of availableActions) {
    if (!isRecord(value)) {
      return { ok: false, reason: 'malformed projected Carrier action' };
    }

    const sourceInstanceId = value.sourceInstanceId;
    if (
      value.kind !== 'choice' ||
      value.actionId !== 'CAR#0' ||
      value.shipDefId !== 'CAR' ||
      value.passIndex !== passIndex ||
      typeof sourceInstanceId !== 'string' ||
      sourceInstanceId.length === 0 ||
      !Array.isArray(value.choices) ||
      value.choices.length === 0
    ) {
      return { ok: false, reason: 'invalid projected Carrier action' };
    }

    if (seenSources.has(sourceInstanceId)) {
      return { ok: false, reason: 'duplicate projected Carrier source' };
    }

    const seenChoices = new Set<string>();
    const choices: ProjectedCarrierAction['choices'] = [];
    for (const rawChoice of value.choices) {
      if (!isRecord(rawChoice)) {
        return { ok: false, reason: 'malformed projected Carrier choice' };
      }
      const choiceId = rawChoice.choiceId;
      if (
        typeof choiceId !== 'string' ||
        !CARRIER_CHOICE_IDS.has(choiceId) ||
        seenChoices.has(choiceId)
      ) {
        return { ok: false, reason: 'invalid projected Carrier choice' };
      }
      seenChoices.add(choiceId);
      choices.push({ choiceId: choiceId as ProjectedCarrierAction['choices'][number]['choiceId'] });
    }

    if (!seenChoices.has('hold')) {
      return { ok: false, reason: 'projected Carrier action is missing Hold' };
    }

    seenSources.add(sourceInstanceId);
    actions.push({
      kind: 'choice',
      actionId: 'CAR#0',
      shipDefId: 'CAR',
      sourceInstanceId,
      passIndex,
      choices,
    });
  }

  return { ok: true, actions };
}

export function constructCarrierPreludeBatch(args: {
  previousActions: readonly ProjectedCarrierAction[];
  refreshedActions: readonly ProjectedCarrierAction[];
  selectedChoiceIdBySourceInstanceId: Readonly<Record<string, string>>;
}): CarrierPreludeBatchResult {
  if (args.refreshedActions.length === 0) {
    return { ok: false, reason: 'cannot submit an empty Carrier batch' };
  }

  const previousSources = new Set(args.previousActions.map((action) => action.sourceInstanceId));
  const refreshedBySource = new Map(
    args.refreshedActions.map((action) => [action.sourceInstanceId, action] as const),
  );
  for (const sourceInstanceId of previousSources) {
    const refreshedAction = refreshedBySource.get(sourceInstanceId);
    const selectedChoiceId = args.selectedChoiceIdBySourceInstanceId[sourceInstanceId];
    if (
      !refreshedAction ||
      typeof selectedChoiceId !== 'string' ||
      !refreshedAction.choices.some((choice) => choice.choiceId === selectedChoiceId)
    ) {
      return { ok: false, reason: 'a selected Carrier choice is no longer projected' };
    }
  }

  const actions: CarrierPreludeBatchAction[] = [];
  for (const action of args.refreshedActions) {
    const choiceId = previousSources.has(action.sourceInstanceId)
      ? args.selectedChoiceIdBySourceInstanceId[action.sourceInstanceId]
      : action.choices[0]?.choiceId;

    if (
      typeof choiceId !== 'string' ||
      !action.choices.some((choice) => choice.choiceId === choiceId)
    ) {
      return { ok: false, reason: 'a projected Carrier source has no valid selection' };
    }

    actions.push({
      actionType: 'power',
      actionId: 'CAR#0',
      sourceInstanceId: action.sourceInstanceId,
      choiceId: choiceId as CarrierPreludeBatchAction['choiceId'],
      passIndex: action.passIndex,
    });
  }

  return actions.length === args.refreshedActions.length
    ? { ok: true, actions }
    : { ok: false, reason: 'Carrier batch is incomplete' };
}

export function canSubmitDrawingBuild(args: {
  participation: DrawingViewerParticipation;
  phaseKey: string;
  turnNumber: number;
  normalizedPrelude: NormalizedDrawingPrelude;
}): boolean {
  return (
    args.participation === 'participant' &&
    args.phaseKey === 'build.drawing' &&
    args.normalizedPrelude.kind === 'complete' &&
    args.normalizedPrelude.turnNumber === args.turnNumber
  );
}
