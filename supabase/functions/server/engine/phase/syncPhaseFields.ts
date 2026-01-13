/**
 * syncPhaseFields
 *
 * Normalizes phase fields so all representations stay in sync.
 * Does NOT advance phases.
 * Safe to call at any time.
 *
 * Keeps these consistent:
 * - state.currentPhase / state.currentSubPhase (legacy top-level)
 * - state.gameData.currentPhase / currentSubPhase (preferred)
 * - state.gameData.turnData.currentMajorPhase / currentSubPhase (compat)
 */

export function syncPhaseFields<T extends Record<string, any>>(state: T): T {
  const gd = state.gameData ?? {};
  const td = gd.turnData ?? {};

  // Prefer explicit gameData fields, then turnData, then legacy top-level
  const major =
    gd.currentPhase ??
    td.currentMajorPhase ??
    state.currentPhase;

  const sub =
    gd.currentSubPhase ??
    td.currentSubPhase ??
    state.currentSubPhase;

  // If either is missing, return unchanged (safe no-op)
  if (!major || !sub) {
    return state;
  }

  return {
    ...state,
    currentPhase: major,
    currentSubPhase: sub,
    gameData: {
      ...gd,
      currentPhase: major,
      currentSubPhase: sub,
      turnData: {
        ...td,
        currentMajorPhase: major,
        currentSubPhase: sub,
      },
    },
  };
}
