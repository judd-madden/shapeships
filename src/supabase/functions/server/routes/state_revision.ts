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

export function withBumpedStateRevision<T extends Record<string, any>>(state: T): T & {
  stateRevision: number;
} {
  const ensuredState = ensureStateRevision(state);

  return {
    ...ensuredState,
    stateRevision: ensuredState.stateRevision + 1,
  };
}
