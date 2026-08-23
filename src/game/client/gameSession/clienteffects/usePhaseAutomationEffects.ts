import { useEffect } from 'react';

export function useBuildPreviewResetEffect(args: {
  turnNumber: number;
  effectiveGameId: string | null;
  setBuildPreviewCounts: (v: Record<string, number>) => void;
}) {
  const { turnNumber, effectiveGameId, setBuildPreviewCounts } = args;

  // ============================================================================
  // CHUNK 6.1: RESET PREVIEW BUFFER ON TURN TRANSITION
  // ============================================================================
  
  // Reset preview buffer when:
  // - turnNumber changes (new turn begins)
  // - effectiveGameId changes (switched games)
  // 
  // IMPORTANT: We must NOT reset on phaseKey changes because clicking Ready
  // advances server-owned workflow state within Drawing, and we want preview
  // to persist until the turn changes.
  // 
  // This effect does NOT depend on buildPreviewCounts (avoids noise)
  useEffect(() => {
    // Reset only on turn or game change (NOT on phase/subphase changes)
    setBuildPreviewCounts({});
  }, [turnNumber, effectiveGameId]);
}
