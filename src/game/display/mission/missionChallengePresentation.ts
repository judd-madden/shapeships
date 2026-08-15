import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { MissionChallengeResultViewModel } from '../../client/gameSession/types';

export type MissionOverlayMode = 'initial' | 'reopen' | 'result';

export const BASIC_CHALLENGE_NOTE =
  'Only ships in final fleet are counted, ships may be used in upgrades';
export const ANCIENT_FOREIGN_CHALLENGE_NOTE =
  'Use Simulacrum to copy opponent ships, use their species tab for upgrades';

export function formatMissionSystem(location: string): string {
  return location.replace(/ system$/i, '');
}

export function interpolateMissionPlayer(
  paragraph: string,
  playerName: string,
): string {
  return paragraph.split('[player]').join(playerName);
}

export function getChallengeExplanatoryCopy(args: {
  playerSpecies: SpeciesId;
  targetSpecies: string;
  targetShipType: string;
}): string | null {
  const targetSpecies = args.targetSpecies.toLowerCase();

  if (args.playerSpecies === 'ancient' && targetSpecies !== 'ancient') {
    return ANCIENT_FOREIGN_CHALLENGE_NOTE;
  }

  if (args.playerSpecies !== 'ancient' && args.targetShipType === 'Basic') {
    return BASIC_CHALLENGE_NOTE;
  }

  return null;
}

export function getMissionPresentationIdentity(args: {
  gameId: string;
  missionId: string;
  mode: MissionOverlayMode | null;
}): string | null {
  return args.mode === null
    ? null
    : `${args.gameId}\u0000${args.missionId}\u0000${args.mode}`;
}

export function isNewVisibleMissionPresentation(
  previousIdentity: string | null,
  currentIdentity: string | null,
): boolean {
  return currentIdentity !== null && currentIdentity !== previousIdentity;
}

export function shouldLockMissionInteraction(args: {
  introPending: boolean;
  overlayVisible: boolean;
}): boolean {
  return args.introPending || args.overlayVisible;
}

export function shouldShowMissionChallengeAction(args: {
  hasMission: boolean;
  isPlayerViewer: boolean;
  isFinished: boolean;
  introPending: boolean;
}): boolean {
  return (
    args.hasMission &&
    args.isPlayerViewer &&
    !args.isFinished &&
    !args.introPending
  );
}

export function shouldShowPostgameMissionChallengeAction(args: {
  hasMission: boolean;
  isPlayerViewer: boolean;
  isFinished: boolean;
  hasResult: boolean;
}): boolean {
  return (
    args.hasMission &&
    args.isPlayerViewer &&
    args.isFinished &&
    args.hasResult
  );
}

export function getMissionChallengeResultPresentation(
  result: MissionChallengeResultViewModel,
): {
  missionLabel: 'COMPLETE' | 'FAILED';
  missionSucceeded: boolean;
  challengeLabel: 'COMPLETE' | 'INCOMPLETE';
  challengeSucceeded: boolean;
} {
  return {
    missionLabel: result.missionSucceeded ? 'COMPLETE' : 'FAILED',
    missionSucceeded: result.missionSucceeded,
    challengeLabel: result.challengeSucceeded ? 'COMPLETE' : 'INCOMPLETE',
    challengeSucceeded: result.challengeSucceeded,
  };
}
