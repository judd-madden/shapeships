import { getShipDefinitionUI } from '../../../data/ShipDefinitionsUI';
import type { AncientSimulacrumDisplayPresentation } from '../../../client/gameSession/types';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';

export function AncientSimulacrumLedgerGraphic({
  presentation,
}: {
  presentation: AncientSimulacrumDisplayPresentation;
}) {
  const definition = getShipDefinitionUI(presentation.copiedShipDefId);
  const resolvedGraphic = definition
    ? resolveShipGraphic(definition, {
        context: 'default',
        ...(presentation.capturedStartOfBattleCharges !== undefined
          ? { explicitCharges: presentation.capturedStartOfBattleCharges }
          : {}),
      })
    : null;
  const Graphic = resolvedGraphic?.component;

  return (
    <div className="ss-simulacrumLedgerGraphic inline-flex shrink-0 flex-col items-center justify-center">
      {Graphic ? (
        <Graphic className="block shrink-0" />
      ) : (
        <span className="pointer-events-none select-none text-center font-['Roboto'] text-[14px] font-bold leading-none text-[var(--shapeships-cyan)]">
          {presentation.copiedShipDefId}
        </span>
      )}
      {presentation.selectedNumber !== undefined ? (
        <span className="pointer-events-none mt-[4px] select-none text-center font-['Roboto'] text-[18px] font-bold leading-none text-[var(--shapeships-cyan)]">
          {presentation.selectedNumber}
        </span>
      ) : null}
    </div>
  );
}
