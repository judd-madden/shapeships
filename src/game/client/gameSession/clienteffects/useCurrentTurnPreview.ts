import { useEffect, useRef, useState } from 'react';
import {
  createCurrentTurnPreviewScheduler,
  type CurrentTurnPreviewCandidateInput,
  type CurrentTurnPreviewScheduler,
  type CurrentTurnPreviewState,
  type CurrentTurnPreviewTransport,
} from '../currentTurnPreview';

export function useCurrentTurnPreview(args: {
  gameId: string | null;
  candidate: CurrentTurnPreviewCandidateInput | null;
  pausedReason: string | null;
  transport: CurrentTurnPreviewTransport;
}): CurrentTurnPreviewState {
  const [state, setState] = useState<CurrentTurnPreviewState>({ kind: 'idle' });
  const schedulerRef = useRef<CurrentTurnPreviewScheduler | null>(null);

  useEffect(() => {
    const scheduler = createCurrentTurnPreviewScheduler({
      transport: args.transport,
      onStateChange: setState,
    });
    schedulerRef.current = scheduler;
    setState({ kind: 'idle' });
    return () => {
      scheduler.dispose();
      if (schedulerRef.current === scheduler) schedulerRef.current = null;
    };
  }, [args.gameId, args.transport]);

  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;
    if (args.pausedReason) {
      scheduler.pause(args.pausedReason);
    } else if (scheduler.getState().kind === 'paused') {
      scheduler.resume(args.candidate);
    } else {
      scheduler.setCandidate(args.candidate);
    }
  }, [args.candidate, args.pausedReason]);

  return state;
}
