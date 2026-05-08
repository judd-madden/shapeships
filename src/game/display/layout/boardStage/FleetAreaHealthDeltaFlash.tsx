import { useEffect, useState } from 'react';
import type { FleetAreaHealthDeltaFlashVm } from '../../../client/useGameSession';

interface FleetAreaHealthDeltaFlashProps {
  vm?: FleetAreaHealthDeltaFlashVm;
}

const EXIT_START_MS = 2000;
const FLASH_TRANSITION_MS = 400;

function getFlashBackground(tone: FleetAreaHealthDeltaFlashVm['tone']): string {
  const color =
    tone === 'max'
      ? 'white'
      : tone === 'heal'
        ? 'var(--shapeships-green)'
        : 'var(--shapeships-red)';

  return `radial-gradient(circle closest-side at center, ${color} 0%, transparent 72%)`;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mediaQuery) {
      return;
    }

    const update = () => setPrefersReducedMotion(Boolean(mediaQuery.matches));

    update();
    mediaQuery.addEventListener?.('change', update);

    return () => {
      mediaQuery.removeEventListener?.('change', update);
    };
  }, []);

  return prefersReducedMotion;
}

export function FleetAreaHealthDeltaFlash({ vm }: FleetAreaHealthDeltaFlashProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);

    if (!vm) {
      return;
    }

    const timeoutIds: number[] = [];
    let raf1: number | null = null;
    let raf2: number | null = null;

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setIsVisible(true);
        timeoutIds.push(window.setTimeout(() => setIsVisible(false), EXIT_START_MS));
      });
    });

    return () => {
      if (raf1 !== null) {
        window.cancelAnimationFrame(raf1);
      }
      if (raf2 !== null) {
        window.cancelAnimationFrame(raf2);
      }
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [vm?.presentationKey]);

  if (!vm) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none transition-opacity ease-out"
      style={{
        background: getFlashBackground(vm.tone),
        opacity: isVisible ? vm.peakOpacity : 0,
        transitionDuration: `${prefersReducedMotion ? 0 : FLASH_TRANSITION_MS}ms`,
      }}
    />
  );
}
