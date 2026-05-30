import { useCallback } from 'react';
import * as ReactDOM from 'react-dom';
import { BuildIcon } from '../../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../../components/ui/primitives/icons/BattleIcon';
import { CloseIcon } from '../../../../components/ui/primitives/icons/CloseIcon';
import { getShipHoverModel } from '../../../data/ShipRulesAdapter';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import {
  useAnchoredHoverPlacement,
  type AnchoredHoverPlacementMode,
} from '../../shared/useAnchoredHoverPlacement';

interface FleetShipHoverCardProps {
  shipId: ShipDefId;
  anchorRect: DOMRect;
  onClose?: () => void;
  preferredPlacement?: 'top' | 'bottom';
  placementMode?: AnchoredHoverPlacementMode;
  density?: 'desktop' | 'mobile';
  portal?: boolean;
  onCardElementChange?: (element: HTMLDivElement | null) => void;
}

const TAIL_SIZE_PX = 12;

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

function PowerText({ text, density }: { text: string; density: 'desktop' | 'mobile' }) {
  return (
    <div className="basis-0 content-stretch flex grow items-center justify-center min-h-px min-w-px pb-0 pt-[2px] px-0 relative shrink-0">
      <p
        className={cx(
          'basis-0 font-normal grow min-h-px min-w-px relative shrink-0 text-white whitespace-pre-wrap',
          density === 'mobile' ? 'text-[14px] leading-[18px]' : 'text-[16px] leading-[20px]'
        )}
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {text}
      </p>
    </div>
  );
}

function getPowerIconClassName(density: 'desktop' | 'mobile') {
  return cx(
    'shrink-0',
    density === 'mobile' && '!size-[20px]'
  );
}

export function FleetShipHoverCard({
  shipId,
  anchorRect,
  onClose,
  preferredPlacement,
  placementMode = 'anchored',
  density = 'desktop',
  portal = true,
  onCardElementChange,
}: FleetShipHoverCardProps) {
  const model = getShipHoverModel(shipId);
  const { placement, anchorX, anchorY, cardTransform, cardRef, cardLeft, tailX } =
    useAnchoredHoverPlacement(anchorRect, { preferredPlacement, mode: placementMode });
  const isInteractive = Boolean(onClose);
  const isMobileViewportCentered = placementMode === 'mobile-viewport-centered';
  const setCardElement = useCallback(
    (element: HTMLDivElement | null) => {
      cardRef.current = element;
      onCardElementChange?.(element);
    },
    [cardRef, onCardElementChange]
  );

  if (!model) {
    return null;
  }

  const card = (
    <div
      className="absolute pointer-events-none"
      style={{
        left: isMobileViewportCentered ? `${cardLeft ?? 16}px` : `${anchorX}px`,
        top: `${anchorY}px`,
        width: isMobileViewportCentered ? 'calc(100vw - 32px)' : '0px',
        height: '0px',
      }}
    >
      <div
        ref={setCardElement}
        className={cx(
          'relative flex flex-col items-start gap-[12px] rounded-[10px] bg-[var(--shapeships-grey-90)] px-[20px] pb-[20px] pt-[16px]',
          isMobileViewportCentered ? 'w-full max-w-none' : 'w-max max-w-[300px]'
        )}
        onPointerDown={isInteractive ? (event) => event.stopPropagation() : undefined}
        onClick={isInteractive ? (event) => event.stopPropagation() : undefined}
        style={{
          pointerEvents: isInteractive ? 'auto' : 'none',
          transform: cardTransform,
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[10px] border border-solid border-[var(--shapeships-grey-70)] pointer-events-none"
        />

        <div
          aria-hidden="true"
          className="absolute rotate-45 border-solid border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] pointer-events-none"
          style={
            placement === 'left'
              ? {
                  top: '50%',
                  right: '-1px',
                  width: `${TAIL_SIZE_PX}px`,
                  height: `${TAIL_SIZE_PX}px`,
                  transform: 'translateY(-50%)',
                  borderTopWidth: '1px',
                  borderRightWidth: '1px',
                }
              : placement === 'bottom'
              ? isMobileViewportCentered
                ? {
                    left: `${tailX ?? 24}px`,
                    top: '2px',
                    width: `${TAIL_SIZE_PX}px`,
                    height: `${TAIL_SIZE_PX}px`,
                    transform: 'translate(-50%, -50%)',
                    borderLeftWidth: '1px',
                    borderTopWidth: '1px',
                  }
                : {
                    left: 'calc(50% - 6px)',
                    top: '-1px',
                    width: `${TAIL_SIZE_PX}px`,
                    height: `${TAIL_SIZE_PX}px`,
                    transform: 'translate(-50%, -50%)',
                    borderLeftWidth: '1px',
                    borderTopWidth: '1px',
                  }
              : {
                  left: isMobileViewportCentered ? `${tailX ?? 24}px` : 'calc(50% - 6px)',
                  top: 'calc(100% + 2px)',
                  width: `${TAIL_SIZE_PX}px`,
                  height: `${TAIL_SIZE_PX}px`,
                  transform: 'translate(-50%, -50%)',
                  borderBottomWidth: '1px',
                  borderRightWidth: '1px',
                }
          }
        />

        {onClose ? (
          <button
            type="button"
            aria-label="Close ship details"
            onClick={onClose}
            className="absolute right-[4px] top-[4px] z-10 flex size-[44px] items-center justify-center text-white"
          >
            <CloseIcon className="!size-[20px]" />
          </button>
        ) : null}

        <p
          className={cx(
            isInteractive && 'pr-[34px]',
            'font-bold leading-[normal] text-white',
            density === 'mobile' ? 'text-[18px]' : 'text-[20px]'
          )}
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {model.name}
        </p>

        {model.powers.length > 0 ? (
          <div className="content-stretch flex flex-col gap-[8px] items-start relative shrink-0 w-full">
            {model.powers.map((power, index) => (
              <div
                key={`${power.icon}-${index}`}
                className="content-stretch flex gap-[6px] items-start relative shrink-0 w-full"
              >
                {power.icon === 'pencil' ? (
                  <BuildIcon className={getPowerIconClassName(density)} />
                ) : (
                  <BattleIcon className={getPowerIconClassName(density)} />
                )}
                <PowerText text={power.text} density={density} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!portal) {
    return card;
  }

  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    return null;
  }

  return ReactDOM.createPortal(card, portalTarget);
}
