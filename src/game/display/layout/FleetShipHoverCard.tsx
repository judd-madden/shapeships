import * as ReactDOM from 'react-dom';
import { BuildIcon } from '../../../components/ui/primitives/icons/BuildIcon';
import { BattleIcon } from '../../../components/ui/primitives/icons/BattleIcon';
import { getShipHoverModel } from '../../data/ShipRulesAdapter';
import type { ShipDefId } from '../../types/ShipTypes.engine';

interface FleetShipHoverCardProps {
  shipId: ShipDefId;
  anchorRect: DOMRect;
}

function PowerText({ text }: { text: string }) {
  return (
    <div className="min-w-0 grow pb-0 pt-[2px]">
      <p
        className="font-normal leading-[20px] text-[16px] text-white whitespace-pre-wrap"
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

  const gap = 8;
  const left = anchorRect.left + (anchorRect.width / 2);
  const top = anchorRect.top - gap;

  return ReactDOM.createPortal(
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div
        className="relative flex w-max max-w-[300px] flex-col items-start gap-[12px] rounded-[10px] bg-[#212121] px-[20px] pb-[20px] pt-[16px]"
        style={{ pointerEvents: 'none' }}
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
          <div className="flex w-full flex-col items-start gap-[8px]">
            {model.powers.map((power, index) => (
              <div key={`${power.icon}-${index}`} className="flex w-full items-start gap-[6px]">
                {power.icon === 'pencil' ? <BuildIcon /> : <BattleIcon />}
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
