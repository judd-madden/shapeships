import type {
  WinStreakCreationViewModel,
  WinStreakUnfinishedGameViewModel,
} from '../../client/winStreak/types';
import { InChatButton } from '../../../components/ui/primitives/buttons/InChatButton';
import { getWinStreakWorkflowControls } from './winStreakPresentation';

export interface WinStreakWorkflowActions {
  onConfirmWinStreakAbandonment: () => Promise<unknown>;
  onCancelWinStreakAbandonment: () => void;
  onRetryWinStreakReconciliation: () => Promise<unknown>;
  onRejoinTrackedGame: () => void;
  onReleaseAmbiguousWinStreakCreation: () => Promise<void>;
  onRejoinRecoveredCreatedGame: () => Promise<void>;
}

export function WinStreakWorkflowFeedback({
  creation,
  unfinishedGame,
  actions,
  showUnfinishedNotice = false,
}: {
  creation: WinStreakCreationViewModel;
  unfinishedGame: WinStreakUnfinishedGameViewModel;
  actions: WinStreakWorkflowActions;
  showUnfinishedNotice?: boolean;
}) {
  const hasUnfinished = unfinishedGame.status !== 'none' && unfinishedGame.gameId;
  const {
    busy,
    showConfirm,
    showRejoin,
    showRetry,
    showRecovered,
    showRelease,
  } = getWinStreakWorkflowControls(creation, unfinishedGame);
  const error = unfinishedGame.error ?? creation.error;

  if (!hasUnfinished && !busy && !error && !showRecovered && !showRelease) return null;

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-[10px]">
      {showUnfinishedNotice && hasUnfinished ? (
        <p className="text-[16px] font-medium leading-[20px] text-[var(--shapeships-pastel-red)]">
          {unfinishedGame.canRejoin ? (
            <button type="button" className="underline" onClick={actions.onRejoinTrackedGame}>
              REJOIN CURRENT GAME: {unfinishedGame.gameId}.
            </button>
          ) : (
            <span>REJOIN CURRENT GAME: {unfinishedGame.gameId}.</span>
          )}{' '}
          Starting a new game now will reset your Win Streak.
        </p>
      ) : null}

      {busy ? (
        <p className="text-[14px] leading-[18px] text-[var(--shapeships-grey-20)]">
          Checking your current game…
        </p>
      ) : null}
      {error ? (
        <p className="text-[14px] leading-[18px] text-[var(--shapeships-pastel-red)]">
          We couldn’t finish that request. Rejoin your current game or retry.
        </p>
      ) : null}

      {showConfirm || showRetry || showRecovered || showRelease || showRejoin ? (
        <div className="flex max-w-full flex-wrap gap-[8px]">
          {showRejoin ? (
            <InChatButton className="w-auto" onClick={actions.onRejoinTrackedGame}>Rejoin Game</InChatButton>
          ) : null}
          {showConfirm ? (
            <InChatButton className="w-auto" onClick={() => void actions.onConfirmWinStreakAbandonment()}>
              Confirm New Game
            </InChatButton>
          ) : null}
          {showConfirm ? (
            <InChatButton className="w-auto" onClick={actions.onCancelWinStreakAbandonment}>Cancel</InChatButton>
          ) : null}
          {showRetry ? (
            <InChatButton className="w-auto" onClick={() => void actions.onRetryWinStreakReconciliation()}>
              Retry
            </InChatButton>
          ) : null}
          {showRecovered ? (
            <InChatButton className="w-auto" onClick={() => void actions.onRejoinRecoveredCreatedGame()}>
              Rejoin Created Game
            </InChatButton>
          ) : null}
          {showRelease ? (
            <InChatButton className="w-auto" onClick={() => void actions.onReleaseAmbiguousWinStreakCreation()}>
              Release Pending New Game
            </InChatButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
