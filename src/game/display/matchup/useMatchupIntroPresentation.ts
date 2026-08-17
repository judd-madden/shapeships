import { useEffect, useRef, useState } from 'react';
import type { MatchupIntroViewModel } from '../../client/gameSession/matchupIntro';

export const MATCHUP_INTRO_MOTION_DURATION_MS = 3_150;
export const MATCHUP_INTRO_SPECIES_STAGGER_MS = 150;

export const MATCHUP_INTRO_VISUAL_DURATION_MS =
  MATCHUP_INTRO_MOTION_DURATION_MS + MATCHUP_INTRO_SPECIES_STAGGER_MS;

export function useMatchupIntroPresentation(args: {
  gameId: string;
  authoritativeMatchupIntro: MatchupIntroViewModel | null;
  isFinished: boolean;
}): MatchupIntroViewModel | null {
  const { gameId, authoritativeMatchupIntro, isFinished } = args;
  const [presentedMatchupIntro, setPresentedMatchupIntro] =
    useState<MatchupIntroViewModel | null>(null);
  const gameIdRef = useRef(gameId);
  const activeKeyRef = useRef<string | null>(null);
  const completedKeyRef = useRef<string | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (gameIdRef.current === gameId) return;

    gameIdRef.current = gameId;
    activeKeyRef.current = null;
    completedKeyRef.current = null;
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    setPresentedMatchupIntro(null);
  }, [gameId]);

  useEffect(() => {
    if (!isFinished) return;

    activeKeyRef.current = null;
    completedKeyRef.current = null;
    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    setPresentedMatchupIntro(null);
  }, [isFinished]);

  useEffect(() => {
    if (isFinished || !authoritativeMatchupIntro) return;

    const presentationKey = authoritativeMatchupIntro.presentationKey;
    if (
      activeKeyRef.current === presentationKey ||
      completedKeyRef.current === presentationKey
    ) {
      return;
    }

    if (cleanupTimerRef.current !== null) {
      window.clearTimeout(cleanupTimerRef.current);
    }

    activeKeyRef.current = presentationKey;
    setPresentedMatchupIntro(authoritativeMatchupIntro);
    cleanupTimerRef.current = window.setTimeout(() => {
      cleanupTimerRef.current = null;
      activeKeyRef.current = null;
      completedKeyRef.current = presentationKey;
      setPresentedMatchupIntro((current) =>
        current?.presentationKey === presentationKey ? null : current
      );
    }, MATCHUP_INTRO_VISUAL_DURATION_MS);
  }, [authoritativeMatchupIntro, isFinished]);

  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current !== null) {
        window.clearTimeout(cleanupTimerRef.current);
        cleanupTimerRef.current = null;
      }
      activeKeyRef.current = null;
    };
  }, []);

  return !isFinished && gameIdRef.current === gameId ? presentedMatchupIntro : null;
}
