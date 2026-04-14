import { useEffect, useState } from 'react';
import type { HealthResolutionPresentationVm, HealthResolutionSideVm } from '../../../client/gameSession/types';

interface HealthResolutionPanelProps {
  vm: HealthResolutionPresentationVm;
}

const PANEL_PRESENTATION_MS = 3500;
const PANEL_STAGGER_MS = 30;
const PANEL_TRANSITION_MS = 100;
const PANEL_EXIT_START_MS = PANEL_PRESENTATION_MS - 160;

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
  const [showDivider, setShowDivider] = useState(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  useEffect(() => {
    setShowDivider(false);
    setShowLeft(false);
    setShowRight(false);
    let enterDividerTimer: number | null = null;
    let enterLeftTimer: number | null = null;
    let enterRightTimer: number | null = null;
    let exitRightTimer: number | null = null;
    let exitLeftTimer: number | null = null;
    let exitDividerTimer: number | null = null;
    let raf1: number | null = null;
    let raf2: number | null = null;

    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        enterDividerTimer = window.setTimeout(() => {
          setShowDivider(true);
        }, 0);
        enterLeftTimer = window.setTimeout(() => {
          setShowLeft(true);
        }, PANEL_STAGGER_MS);
        enterRightTimer = window.setTimeout(() => {
          setShowRight(true);
        }, PANEL_STAGGER_MS * 2);

        exitRightTimer = window.setTimeout(() => {
          setShowRight(false);
        }, PANEL_EXIT_START_MS);
        exitLeftTimer = window.setTimeout(() => {
          setShowLeft(false);
        }, PANEL_EXIT_START_MS + PANEL_STAGGER_MS);
        exitDividerTimer = window.setTimeout(() => {
          setShowDivider(false);
        }, PANEL_EXIT_START_MS + PANEL_STAGGER_MS * 2);
      });
    });

    return () => {
      if (raf1 !== null) {
        window.cancelAnimationFrame(raf1);
      }
      if (raf2 !== null) {
        window.cancelAnimationFrame(raf2);
      }
      if (enterDividerTimer !== null) {
        window.clearTimeout(enterDividerTimer);
      }
      if (enterLeftTimer !== null) {
        window.clearTimeout(enterLeftTimer);
      }
      if (enterRightTimer !== null) {
        window.clearTimeout(enterRightTimer);
      }
      if (exitRightTimer !== null) {
        window.clearTimeout(exitRightTimer);
      }
      if (exitLeftTimer !== null) {
        window.clearTimeout(exitLeftTimer);
      }
      if (exitDividerTimer !== null) {
        window.clearTimeout(exitDividerTimer);
      }
    };
  }, [
    vm.left.prefixText,
    vm.left.valueText,
    vm.left.suffixText,
    vm.right.prefixText,
    vm.right.valueText,
    vm.right.suffixText,
  ]);

  return (
    <div className="size-full relative overflow-hidden">
      <div
        aria-hidden="true"
        className={`absolute top-[40px] bottom-[40px] w-px bg-[#555555] transition-all ease-out ${
          showDivider ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-90'
        }`}
        style={{
          left: '49.74%',
          transitionDuration: `${PANEL_TRANSITION_MS}ms`,
        }}
      />

      <div
        className={`absolute top-0 bottom-0 left-[40px] flex items-center justify-end transition-all ease-out ${
          showLeft ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[4px]'
        }`}
        style={{
          right: 'calc(50.26% + 50px)',
          transitionDuration: `${PANEL_TRANSITION_MS}ms`,
        }}
      >
        <div className="text-right">
          <HealthResolutionSentence side={vm.left} />
        </div>
      </div>

      <div
        className={`absolute top-0 bottom-0 right-[40px] flex items-center justify-start transition-all ease-out ${
          showRight ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-[4px]'
        }`}
        style={{
          left: 'calc(49.74% + 50px)',
          transitionDuration: `${PANEL_TRANSITION_MS}ms`,
        }}
      >
        <div className="text-left">
          <HealthResolutionSentence side={vm.right} />
        </div>
      </div>
    </div>
  );
}
