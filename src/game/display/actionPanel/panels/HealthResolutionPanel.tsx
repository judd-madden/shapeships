import { useEffect, useState } from 'react';
import type { HealthResolutionPresentationVm, HealthResolutionSideVm } from '../../../client/gameSession/types';

interface HealthResolutionPanelProps {
  vm: HealthResolutionPresentationVm;
}

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

    const dividerTimer = window.setTimeout(() => {
      setShowDivider(true);
    }, 0);
    const leftTimer = window.setTimeout(() => {
      setShowLeft(true);
    }, 30);
    const rightTimer = window.setTimeout(() => {
      setShowRight(true);
    }, 60);

    return () => {
      window.clearTimeout(dividerTimer);
      window.clearTimeout(leftTimer);
      window.clearTimeout(rightTimer);
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
        className={`absolute top-[40px] bottom-[40px] w-px bg-[#555555] transition-all duration-100 ease-out ${
          showDivider ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-90'
        }`}
        style={{ left: '49.74%' }}
      />

      <div
        className={`absolute top-0 bottom-0 left-[40px] flex items-center justify-end transition-all duration-100 ease-out ${
          showLeft ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-[4px]'
        }`}
        style={{
          right: 'calc(50.26% + 50px)',
        }}
      >
        <div className="text-right">
          <HealthResolutionSentence side={vm.left} />
        </div>
      </div>

      <div
        className={`absolute top-0 bottom-0 right-[40px] flex items-center justify-start transition-all duration-100 ease-out ${
          showRight ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-[4px]'
        }`}
        style={{
          left: 'calc(49.74% + 50px)',
        }}
      >
        <div className="text-left">
          <HealthResolutionSentence side={vm.right} />
        </div>
      </div>
    </div>
  );
}
