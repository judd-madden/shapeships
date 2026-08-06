import { useEffect, useState } from 'react';
import { CloseIcon } from '../../../../components/ui/primitives/icons/CloseIcon';
import type { ActionPanelViewModel, GameSessionActions } from '../../../client/useGameSession';
import {
  isFixedAncientManualSolarPowerId,
  type ImplementedAncientManualSolarPowerId,
} from '../../../client/gameSession/ancientChargeDeclaration';
import { getShipCardModel } from '../../actionPanel/panels/catalogue/shared/ShipCardModel';
import { ShipPowerTagBadgeRow } from '../../shared/ShipPowerTagBadgeRow';
import { ShipPowerRow } from '../../shared/ShipPowerRow';

interface MobileSolarPowerModalProps {
  solarPowerId: ImplementedAncientManualSolarPowerId;
  declarationVm?: ActionPanelViewModel['ancientChargeDeclaration'];
  isDeclarationStageActive: boolean;
  actions: Pick<
    GameSessionActions,
    'onCastAncientSolarPower' | 'onOpenAncientSolarSelector'
  >;
  onViewSiphon: () => void;
  onClose: () => void;
}

type FooterAction =
  | { kind: 'button'; label: 'USE POWER' | 'VIEW POWER'; onClick: () => void }
  | { kind: 'unavailable'; label: string };

export function MobileSolarPowerModal({
  solarPowerId,
  declarationVm,
  isDeclarationStageActive,
  actions,
  onViewSiphon,
  onClose,
}: MobileSolarPowerModalProps) {
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const model = getShipCardModel(solarPowerId);
  const headingValue = declarationVm?.solarHoverValuesById[solarPowerId];

  useEffect(() => {
    setRulesExpanded(false);
  }, [solarPowerId]);

  if (!model) {
    return null;
  }

  const declarationAvailable =
    isDeclarationStageActive &&
    declarationVm?.stage === 'powers' &&
    declarationVm.attemptUnresolved !== true &&
    declarationVm.rejectionRecoveryPending !== true;
  const hasRulesNote = Boolean(model.italicNotes);
  const shouldCollapseRules = model.italicNotes
    ? model.italicNotes.includes('\n') || model.italicNotes.length > 86
    : false;

  function closeThen(callback: () => void) {
    onClose();
    callback();
  }

  const footerAction: FooterAction = (() => {
    if (solarPowerId === 'SSIP') {
      if (declarationAvailable && declarationVm?.siphonSelector.canOpen === true) {
        return {
          kind: 'button',
          label: 'VIEW POWER',
          onClick: () =>
            closeThen(() => actions.onOpenAncientSolarSelector('siphon')),
        };
      }
      return {
        kind: 'button',
        label: 'VIEW POWER',
        onClick: () => closeThen(onViewSiphon),
      };
    }

    if (!declarationAvailable || !declarationVm) {
      return { kind: 'unavailable', label: 'Power unavailable' };
    }

    if (isFixedAncientManualSolarPowerId(solarPowerId)) {
      if (declarationVm.canCastManualSolarPowerById[solarPowerId] === true) {
        return {
          kind: 'button',
          label: 'USE POWER',
          onClick: () =>
            closeThen(() => actions.onCastAncientSolarPower(solarPowerId)),
        };
      }
      return { kind: 'unavailable', label: 'Not enough energy' };
    }

    if (solarPowerId === 'SSIM') {
      if (declarationVm.simulacrumSelector.canOpen) {
        return {
          kind: 'button',
          label: 'VIEW POWER',
          onClick: () =>
            closeThen(() => actions.onOpenAncientSolarSelector('simulacrum')),
        };
      }
      return declarationVm.simulacrumSelector.hasLegalTargetBeforeAffordability
        ? { kind: 'unavailable', label: 'Not enough energy' }
        : { kind: 'unavailable', label: 'No eligible targets' };
    }

    if (declarationVm.blackHoleSelector.canOpen) {
      return {
        kind: 'button',
        label: 'VIEW POWER',
        onClick: () =>
          closeThen(() => actions.onOpenAncientSolarSelector('blackHole')),
      };
    }
    return { kind: 'unavailable', label: 'Not enough energy' };
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-black/45" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${model.name} Solar Power details`}
        className="fixed bottom-[24px] left-[26px] right-[26px] flex max-h-[calc(100dvh-48px)] w-[calc(100vw-52px)] flex-col rounded-[10px] border border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] shadow-[0_0_60px_20px_rgba(0,0,0,1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`Close ${model.name} Solar Power details`}
          onClick={onClose}
          className="absolute right-[8px] top-[8px] z-10 flex size-[44px] items-center justify-center text-[30px] font-normal leading-none text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          <CloseIcon className="!size-[20px]" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-[20px] pb-[14px] pt-[18px]">
          <div className="flex flex-col gap-[12px] pr-[34px]">
            <div className="flex flex-col gap-[8px]">
              <div className="flex min-w-0 items-center gap-[16px] pr-[10px]">
                <p
                  className="min-w-0 flex-1 text-[22px] font-bold leading-[26px] text-white"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {model.name}
                </p>
                {solarPowerId !== 'SSIP' && headingValue ? (
                  <SolarPreview value={headingValue} />
                ) : null}
              </div>

              {solarPowerId === 'SSIP' && headingValue ? (
                <div className="flex flex-wrap items-center gap-[6px]">
                  {headingValue.label ? (
                    <span
                      className="text-[13px] font-normal text-white"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      {headingValue.label}
                    </span>
                  ) : null}
                  <SolarPreview value={headingValue} />
                </div>
              ) : null}

              <ShipPowerTagBadgeRow labels={model.powerTagLabels} />
            </div>

            {model.powers.length > 0 ? (
              <div className="flex flex-col gap-[9px]">
                {model.powers.map((power, index) => (
                  <ShipPowerRow key={index} iconKind={power.iconKind}>
                    <p
                      className="min-w-0 flex-1 whitespace-pre-wrap text-[16px] font-normal leading-[20px] text-white"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      {power.text}
                    </p>
                  </ShipPowerRow>
                ))}
              </div>
            ) : null}

            {hasRulesNote && model.italicNotes ? (
              shouldCollapseRules ? (
                <div className="flex flex-col gap-[8px]">
                  <button
                    type="button"
                    onClick={() => setRulesExpanded((current) => !current)}
                    className="w-fit text-left text-[14px] font-bold italic leading-[18px] text-white"
                    style={{ fontVariationSettings: "'wdth' 100" }}
                  >
                    {rulesExpanded ? '- Close Rules Notes' : '+ Expand Rules Notes'}
                  </button>
                  {rulesExpanded ? (
                    <p
                      className="whitespace-pre-wrap text-[13px] font-normal italic leading-[18px] text-white"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      {model.italicNotes}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p
                  className="whitespace-pre-wrap text-[13px] font-normal italic leading-[18px] text-white"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {model.italicNotes}
                </p>
              )
            ) : null}
          </div>
        </div>

        <div className="shrink-0 px-[20px] pb-[20px]">
          <div className="mb-[16px] h-px w-full bg-[var(--shapeships-grey-70)]" />
          {footerAction.kind === 'button' ? (
            <button
              type="button"
              onClick={footerAction.onClick}
              className="flex h-[50px] w-full items-center justify-center rounded-[10px] bg-white px-[16px] text-[18px] font-black leading-none text-black active:scale-[0.99]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {footerAction.label}
            </button>
          ) : (
            <p
              className="text-[17px] font-medium leading-[20px] text-[var(--shapeships-grey-50)]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {footerAction.label}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SolarPreview({
  value,
}: {
  value: {
    healing?: number;
    damage?: number;
  };
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center justify-end gap-[6px] text-right">
      {value.healing !== undefined ? (
        <span
          className="text-[20px] font-black text-[var(--shapeships-pastel-green)]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {value.healing}
        </span>
      ) : null}
      {value.damage !== undefined ? (
        <span
          className="text-[20px] font-black text-[var(--shapeships-pastel-red)]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          {value.damage}
        </span>
      ) : null}
    </div>
  );
}
