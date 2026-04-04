import * as ReactDOM from 'react-dom';
import { BuildIcon } from '../../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../../components/ui/primitives/icons/BattleIcon';
import { getShipHoverModel } from '../../../data/ShipRulesAdapter';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import { useAnchoredHoverPlacement } from '../../shared/useAnchoredHoverPlacement';

interface FleetShipHoverCardProps {
  shipId: ShipDefId;
  anchorRect: DOMRect;
}

const TAIL_SIZE_PX = 12;

function PowerText({ text }: { text: string }) {
  return (
    <div className="basis-0 content-stretch flex grow items-center justify-center min-h-px min-w-px pb-0 pt-[2px] px-0 relative shrink-0">
      <p
        className="basis-0 font-normal grow leading-[20px] min-h-px min-w-px relative shrink-0 text-[16px] text-white whitespace-pre-wrap"
        style={{ fontVariationSettings: "'wdth' 100" }}
      >
        {text}
      </p>
    </div>
  );
}

export function FleetShipHoverCard({ shipId, anchorRect }: FleetShipHoverCardProps) {
  const model = getShipHoverModel(shipId);
  const { placement, anchorX, anchorY, cardTransform, cardRef } =
    useAnchoredHoverPlacement(anchorRect);

  if (!model) {
    return null;
  }

  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${anchorX}px`,
        top: `${anchorY}px`,
        width: '0px',
        height: '0px',
      }}
    >
      <div
        ref={cardRef}
        className="relative flex w-max max-w-[300px] flex-col items-start gap-[12px] rounded-[10px] bg-[#212121] px-[20px] pb-[20px] pt-[16px]"
        style={{
          pointerEvents: 'none',
          transform: cardTransform,
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[10px] border border-solid border-[#555] pointer-events-none"
        />

        <div
          aria-hidden="true"
          className="absolute rotate-45 border-solid border-[#555] bg-[#212121] pointer-events-none"
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
              : {
                  left: 'calc(50% - 6px)',
                  top: 'calc(100% + 2px)',
                  width: `${TAIL_SIZE_PX}px`,
                  height: `${TAIL_SIZE_PX}px`,
                  transform: 'translate(-50%, -50%)',
                  borderBottomWidth: '1px',
                  borderRightWidth: '1px',
                }
          }
        />

        <p
          className="font-bold leading-[normal] text-[20px] text-white"
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
                  <BuildIcon className="shrink-0" />
                ) : (
                  <BattleIcon className="shrink-0" />
                )}
                <PowerText text={power.text} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    portalTarget
  );
}
