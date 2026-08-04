export type PersistedRevisionToken =
  | { kind: 'valid'; revision: number }
  | { kind: 'missing' }
  | { kind: 'invalid'; rawValue: unknown };

function getPersistedRevisionToken(
  value: unknown,
  field: 'stateRevision' | 'revision',
  minimum: number,
): PersistedRevisionToken {
  if (!value || typeof value !== 'object') {
    return { kind: 'invalid', rawValue: value };
  }

  if (!Object.prototype.hasOwnProperty.call(value, field)) {
    return { kind: 'missing' };
  }

  const rawValue = (value as Record<string, unknown>)[field];
  if (
    Number.isInteger(rawValue) &&
    typeof rawValue === 'number' &&
    rawValue >= minimum
  ) {
    return { kind: 'valid', revision: rawValue };
  }

  return { kind: 'invalid', rawValue };
}

export function getPersistedStateRevisionToken(
  state: unknown,
): PersistedRevisionToken {
  return getPersistedRevisionToken(state, 'stateRevision', 1);
}

export function getPersistedHistoryRevisionToken(
  historyStore: unknown,
): PersistedRevisionToken {
  return getPersistedRevisionToken(historyStore, 'revision', 0);
}

export function getStateRevisionBase(token: PersistedRevisionToken): number {
  if (token.kind === 'valid') return token.revision;
  if (token.kind === 'missing') return 1;
  throw new Error('INVALID_PERSISTED_STATE_REVISION');
}

export function ensureStateRevision<T extends Record<string, any>>(state: T): T & {
  stateRevision: number;
} {
  const currentRevision = state?.stateRevision;
  const stateRevision =
    Number.isInteger(currentRevision) && currentRevision > 0
      ? currentRevision
      : 1;

  if (stateRevision === currentRevision) {
    return state as T & { stateRevision: number };
  }

  return {
    ...state,
    stateRevision,
  };
}

export function withStateRevisionFromBase<T extends Record<string, any>>(
  state: T,
  persistedBaseRevision: number,
): T & { stateRevision: number } {
  return {
    ...state,
    stateRevision: persistedBaseRevision + 1,
  };
}

export function withBumpedStateRevision<T extends Record<string, any>>(state: T): T & {
  stateRevision: number;
} {
  const ensuredState = ensureStateRevision(state);

  return {
    ...ensuredState,
    stateRevision: ensuredState.stateRevision + 1,
  };
}
