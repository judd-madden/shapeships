import { useEffect, useState } from 'react';
import type { HealthResolutionPresentationVm, HealthResolutionSideVm } from '../../../client/gameSession/types';

interface HealthResolutionPanelProps {
  vm: HealthResolutionPresentationVm;
}

const PANEL_STAGGER_MS = 100;
const PANEL_TRANSITION_MS = 300;
const EXIT_START_MS = 2500;
const BACKDROP_TRANSITION_MS = 500;

function getValueColor(side: HealthResolutionSideVm): string {
  switch (side.valueTone) {
    case 'damage':
      return 'var(--shapeships-pastel-red)';
    case 'heal':
      return 'var(--shapeships-pastel-green)';
    case 'neutral':
    default:
      return 'var(--shapeships-grey-50)';
  }
}

function HealthResolutionSentence({ side }: { side: HealthResolutionSideVm }) {
  return (
    <p
      className="font-['Roboto'] font-normal text-[44px] leading-[1.1] text-white whitespace-nowrap"
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      <span>{side.prefixText}</span>
      <span
        className={side.valueWeight === 'black' ? 'font-black' : 'font-normal'}
        style={{ color: getValueColor(side) }}
      >
        {side.valueText}
      </span>
      <span>{side.suffixText}</span>
    </p>
  );
}

export function HealthResolutionPanel({ vm }: HealthResolutionPanelProps) {
  const [showBackdrop, setShowBackdrop] = useState(false);
  const [showDivider, setShowDivider] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  useEffect(() => {
    setShowBackdrop(false);
    setShowDivider(false);
    setShowLeft(false);
    setShowRight(false);
    const timeoutIds: number[] = [];
    let raf1: number | null = null;
    let raf2: number | null = null;

    function scheduleIn(delayMs: number, callback: () => void) {
      if (delayMs <= 0) {
        callback();
        return;
      }

      timeoutIds.push(window.setTimeout(callback, delayMs));
    }

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        scheduleIn(0, () => {
          setShowBackdrop(true);
          setShowDivider(true);
        });
        scheduleIn(PANEL_STAGGER_MS, () => setShowLeft(true));
        scheduleIn(PANEL_STAGGER_MS * 2, () => setShowRight(true));
        scheduleIn(EXIT_START_MS, () => {
          setShowBackdrop(false);
          setShowRight(false);
        });
        scheduleIn(EXIT_START_MS + PANEL_STAGGER_MS, () => setShowLeft(false));
        scheduleIn(EXIT_START_MS + PANEL_STAGGER_MS * 2, () => setShowDivider(false));
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
  }, [vm.presentationKey]);

  return (
    <div className="size-full relative overflow-hidden">
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-black transition-opacity ease-out ${
          showBackdrop ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${BACKDROP_TRANSITION_MS}ms` }}
      />
      <div
        aria-hidden="true"
        className={`absolute top-[40px] bottom-[40px] w-px bg-[#555555] transition-all duration-300 ease-out ${
          showDivider ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-90'
        }`}
        style={{ left: '49.74%' }}
      />

      <div
        className={`absolute top-0 bottom-0 left-[40px] flex items-center justify-end transition-all duration-300 ease-out ${
          showLeft ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[4px]'
        }`}
        style={{ right: 'calc(50.26% + 50px)' }}
      >
        <div className="text-right">
          <HealthResolutionSentence side={vm.left} />
        </div>
      </div>

      <div
        className={`absolute top-0 bottom-0 right-[40px] flex items-center justify-start transition-all duration-300 ease-out ${
          showRight ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-[4px]'
        }`}
        style={{ left: 'calc(49.74% + 50px)' }}
      >
        <div className="text-left">
          <HealthResolutionSentence side={vm.right} />
        </div>
      </div>
    </div>
  );
}
