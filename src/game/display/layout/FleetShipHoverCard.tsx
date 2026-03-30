import * as ReactDOM from 'react-dom';
import { BuildIcon } from '../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../components/ui/primitives/icons/BattleIcon';
import { getShipHoverModel } from '../../data/ShipRulesAdapter';
import type { ShipDefId } from '../../types/ShipTypes.engine';

interface FleetShipHoverCardProps {
  shipId: ShipDefId;
  anchorRect: DOMRect;
}

const HOVER_GAP_PX = 8;
const TAIL_SIZE_PX = 12;
const TAIL_APEX_OFFSET_PX = TAIL_SIZE_PX / Math.sqrt(2);

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

  if (!model) {
    return null;
  }

  const portalTarget = document.getElementById('ship-hover-layer');
  if (!portalTarget) {
    return null;
  }

  const left = anchorRect.left + (anchorRect.width / 2);
  const top = anchorRect.top - HOVER_GAP_PX - TAIL_APEX_OFFSET_PX;

  return ReactDOM.createPortal(
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: '0px',
        height: '0px',
      }}
    >
      <div
        className="relative flex w-max max-w-[300px] flex-col items-start gap-[12px] rounded-[10px] bg-[#212121] px-[20px] pb-[20px] pt-[16px]"
        style={{
          pointerEvents: 'none',
          transform: 'translate(-50%, -100%)',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-[10px] border border-solid border-[#555] pointer-events-none"
        />

        <div
          aria-hidden="true"
          className="absolute left-1/2 top-full size-[12px] -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-solid border-[#555] bg-[#212121] pointer-events-none"
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
