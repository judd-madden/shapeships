import { useEffect, useRef, useState } from 'react';
import { BattleIcon } from '../../../../components/ui/primitives/icons/BattleIcon';
import { BuildIcon } from '../../../../components/ui/primitives/icons/BuildIcon';
import { CloseIcon } from '../../../../components/ui/primitives/icons/CloseIcon';
import { SHIP_DEFINITIONS_MAP } from '../../../data/ShipDefinitionsUI';
import { isShipDefId } from '../../../data/ShipDefinitions.core';
import type { ActionPanelViewModel, GameSessionActions } from '../../../client/useGameSession';
import type { ShipDefId } from '../../../types/ShipTypes.engine';
import { parseShipToken } from '../../graphics/shipToken';
import { resolveShipGraphic } from '../../graphics/resolveShipGraphic';
import {
  getShipCardModel,
  groupShipCounts,
} from '../../actionPanel/panels/catalogue/shared/ShipCardModel';
import {
  getShipEligibilityForHover,
  type ShipEligibility,
} from '../../actionPanel/panels/catalogue/shared/ShipBuildEligibility';

interface MobileShipModalProps {
  shipId: ShipDefId;
  buildCatalogue: ActionPanelViewModel['buildCatalogue'];
  actions: Pick<GameSessionActions, 'onBuildShip'>;
  onClose: () => void;
}

export function MobileShipModal({
  shipId,
  buildCatalogue,
  actions,
  onClose,
}: MobileShipModalProps) {
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const autoCloseAfterBuildRef = useRef(false);
  const model = getShipCardModel(shipId);
  const eligibility = getShipEligibilityForHover({ shipId, buildCatalogue });

  useEffect(() => {
    setRulesExpanded(false);
    autoCloseAfterBuildRef.current = false;
  }, [shipId]);

  useEffect(() => {
    if (!autoCloseAfterBuildRef.current) {
      return;
    }

    if (
      eligibility.state === 'NOT_ENOUGH_LINES' ||
      eligibility.state === 'NEED_COMPONENTS' ||
      eligibility.state === 'MAX_LIMIT'
    ) {
      autoCloseAfterBuildRef.current = false;
      onClose();
    }
  }, [eligibility.state, onClose]);

  if (!model) {
    return null;
  }

  function handleBuild() {
    autoCloseAfterBuildRef.current = true;
    actions.onBuildShip(shipId);
  }

  const displayCost = buildCatalogue.displayCostByShipId[shipId] ?? model.cost;
  const hasRulesNote = Boolean(model.italicNotes);
  const shouldCollapseRules = model.italicNotes
    ? model.italicNotes.includes('\n') || model.italicNotes.length > 86
    : false;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/45"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${model.name} details`}
        className="fixed bottom-[24px] left-[26px] right-[26px] flex max-h-[calc(100dvh-48px)] w-[calc(100vw-52px)] flex-col rounded-[10px] border border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] shadow-[0_0_60px_20px_rgba(0,0,0,1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close ship details"
          onClick={onClose}
          className="absolute right-[8px] top-[8px] z-10 flex size-[44px] items-center justify-center text-[30px] font-normal leading-none text-white"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          <CloseIcon className="!size-[20px]" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-[20px] pb-[14px] pt-[18px]">
          <div className="flex flex-col gap-[12px] pr-[34px]">
            <div className="flex flex-col gap-[6px]">
              <div className="flex min-w-0 items-center gap-[7px] text-[22px] leading-none text-white">
                <p
                  className="shrink-0 font-black"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {model.cost}
                </p>
                <p
                  className="min-w-0 font-bold leading-[26px]"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {model.name}
                </p>
              </div>

              {model.phaseLabel ? (
                <p
                  className="text-[13px] font-normal uppercase leading-[16px] text-[var(--shapeships-grey-20)]"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {model.phaseLabel}
                </p>
              ) : null}
            </div>

            {model.joiningLines ? (
              <p
                className="text-[15px] font-medium leading-[16px] text-[var(--shapeships-grey-50)]"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                <span className="font-bold">{model.joiningLines}</span>
                <span className="font-normal"> joining lines</span>
              </p>
            ) : null}

            {model.powers.length > 0 ? (
              <div className="flex flex-col gap-[9px]">
                {model.powers.map((power, index) => (
                  <div key={index} className="flex items-start gap-[8px]">
                    {power.icon === 'build' ? (
                      <BuildIcon className="mt-[1px] shrink-0" />
                    ) : (
                      <BattleIcon className="mt-[1px] shrink-0" />
                    )}
                    <p
                      className="min-w-0 flex-1 whitespace-pre-wrap text-[16px] font-normal leading-[20px] text-white"
                      style={{ fontVariationSettings: "'wdth' 100" }}
                    >
                      {power.text}
                    </p>
                  </div>
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
                  className="text-[13px] font-normal italic leading-[18px] text-white"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  {model.italicNotes}
                </p>
              )
            ) : null}
          </div>
        </div>

        <MobileShipModalFooter
          displayCost={displayCost}
          modelComponentShipIds={model.componentShipIds}
          eligibility={eligibility}
          onBuild={handleBuild}
        />
      </div>
    </div>
  );
}

function MobileShipModalFooter({
  displayCost,
  modelComponentShipIds,
  eligibility,
  onBuild,
}: {
  displayCost: number;
  modelComponentShipIds: readonly string[];
  eligibility: ShipEligibility;
  onBuild: () => void;
}) {
  const content = (() => {
    if (eligibility.state === 'CAN_BUILD') {
      return (
        <button
          type="button"
          onClick={onBuild}
          className="flex h-[50px] w-full items-center justify-center rounded-[10px] bg-white px-[16px] text-[18px] font-black leading-none text-black active:scale-[0.99]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          BUILD - {displayCost} lines
        </button>
      );
    }

    if (eligibility.state === 'NEED_COMPONENTS') {
      return (
        <div className="flex flex-col gap-[12px]">
          <UnavailableText>Need component ships</UnavailableText>
          <MobileComponentShips shipIds={eligibility.missingComponentShipIds ?? []} />
        </div>
      );
    }

    if (eligibility.state === 'REFERENCE_ONLY') {
      return modelComponentShipIds.length > 0
        ? <MobileComponentShips shipIds={modelComponentShipIds} />
        : null;
    }

    if (eligibility.state === 'NOT_ENOUGH_LINES') {
      return <UnavailableText>Not enough lines</UnavailableText>;
    }

    if (eligibility.state === 'MAX_LIMIT') {
      return <UnavailableText>Ship limit reached</UnavailableText>;
    }

    if (eligibility.state === 'BUILD_STATE_UNAVAILABLE') {
      return <UnavailableText>Build in Drawing Phase</UnavailableText>;
    }

    if (eligibility.state === 'RULE_RESTRICTED') {
      return (
        <UnavailableText>
          {eligibility.restrictionReason === 'FOREIGN_BASIC'
            ? 'Foreign basic ships cannot be built'
            : 'In development'}
        </UnavailableText>
      );
    }

    return null;
  })();

  if (!content) {
    return null;
  }

  return (
    <div className="shrink-0 px-[20px] pb-[20px]">
      <div className="mb-[16px] h-px w-full bg-[var(--shapeships-grey-70)]" />
      {content}
    </div>
  );
}

function UnavailableText({ children }: { children: string }) {
  return (
    <p
      className="text-[17px] font-medium leading-[20px] text-[var(--shapeships-grey-50)]"
      style={{ fontVariationSettings: "'wdth' 100" }}
    >
      {children}
    </p>
  );
}

function MobileComponentShips({ shipIds }: { shipIds: readonly string[] }) {
  if (shipIds.length === 0) {
    return null;
  }

  const grouped = groupShipCounts(shipIds);

  return (
    <div className="flex flex-wrap items-center gap-x-[16px] gap-y-[12px]">
      {grouped.map(({ token, count }) => {
        const { baseId, explicitCharges } = parseShipToken(token);

        if (!isShipDefId(baseId)) {
          console.warn(`[MobileShipModal] Invalid ship id for token: ${token} (baseId: ${baseId})`);
          return null;
        }

        const ship = SHIP_DEFINITIONS_MAP?.[baseId];
        if (!ship) {
          console.warn(`[MobileShipModal] Ship not found for token: ${token} (baseId: ${baseId})`);
          return null;
        }

        const graphic = resolveShipGraphic(ship, {
          context: 'hover',
          explicitCharges,
        });
        const ShipGraphic = graphic?.component;

        return (
          <div key={token} className="flex items-center gap-[7px]">
            <div className="h-[34px] shrink-0">
              {ShipGraphic ? <ShipGraphic className="h-full w-auto max-w-none" /> : null}
            </div>
            {count > 1 ? (
              <p
                className="text-[21px] font-black leading-none text-white"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {count}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
