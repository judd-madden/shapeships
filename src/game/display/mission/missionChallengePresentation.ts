import type { SpeciesId } from '../../../components/ui/primitives/buttons/SpeciesCardButton';
import type { MissionChallengeResultViewModel } from '../../client/gameSession/types';

export type MissionOverlayMode = 'initial' | 'reopen' | 'result';

export const ANCIENT_FOREIGN_CHALLENGE_NOTE =
  'Use Simulacrum to copy opponent ships, use their species tab for upgrades';

export function getChallengePresentationCopy(args: {
  condition: 'with' | 'without';
  playerSpecies: SpeciesId;
  targetSpecies: string;
  targetShipType: string;
  targetShipName: string;
  targetPluralShipName: string;
}): {
  heading: string;
  explanatoryCopy: string | null;
} {
  const heading = args.condition === 'with'
    ? `Win with ${/^[aeiou]/i.test(args.targetShipName) ? 'an' : 'a'} ${args.targetShipName}`
    : `Win without ${args.targetPluralShipName}`;
  const targetSpecies = args.targetSpecies.toLowerCase();

  if (args.playerSpecies === 'ancient' && targetSpecies !== 'ancient') {
    return {
      heading,
      explanatoryCopy: ANCIENT_FOREIGN_CHALLENGE_NOTE,
    };
  }

  if (args.condition === 'without') {
    return {
      heading,
      explanatoryCopy: `No ${args.targetPluralShipName} in your final fleet.`,
    };
  }

  if (args.playerSpecies !== 'ancient' && args.targetShipType === 'Basic') {
    return {
      heading,
      explanatoryCopy: `At least one ${args.targetShipName} in your final fleet. ${args.targetPluralShipName} consumed by upgrades don't count.`,
    };
  }

  if (
    args.targetShipType === 'Upgraded' ||
    args.targetShipType === 'Basic - Evolved'
  ) {
    return {
      heading,
      explanatoryCopy: `At least one ${args.targetShipName} in your final fleet.`,
    };
  }

  return { heading, explanatoryCopy: null };
}

export function formatMissionSystem(location: string): string {
  return location.replace(/ system$/i, '');
}

export function interpolateMissionPlayer(
  paragraph: string,
  playerName: string,
): string {
  return paragraph.split('[player]').join(playerName);
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
