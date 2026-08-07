export type AncientManualOnlySolarPowerId = 'SSIM' | 'SSIP' | 'SVOR' | 'SBLA';

export interface AncientAutocastDecisionEnergy {
  green: number;
  red: number;
  blue: number;
}

export const ANCIENT_VORTEX_PREVIEW_COST: AncientAutocastDecisionEnergy = {
  green: 2,
  red: 2,
  blue: 2,
};

export const ANCIENT_BLACK_HOLE_PREVIEW_COST: AncientAutocastDecisionEnergy = {
  green: 4,
  red: 4,
  blue: 4,
};

export function deriveAncientAutocastEntryDecision(args: {
  remainingEnergy: AncientAutocastDecisionEnergy;
  hasEligibleSimulacrumTarget: boolean;
  siphonMinimumSpend: number;
}): {
  availableManualOnlySolarPowerIds: AncientManualOnlySolarPowerId[];
  requiresManualPause: boolean;
} {
  const availableManualOnlySolarPowerIds: AncientManualOnlySolarPowerId[] = [];

  if (args.hasEligibleSimulacrumTarget) {
    availableManualOnlySolarPowerIds.push('SSIM');
  }
  if (
    args.remainingEnergy.green >= args.siphonMinimumSpend &&
    args.remainingEnergy.red >= args.siphonMinimumSpend
  ) {
    availableManualOnlySolarPowerIds.push('SSIP');
  }
  if (
    args.remainingEnergy.green >= ANCIENT_VORTEX_PREVIEW_COST.green &&
    args.remainingEnergy.red >= ANCIENT_VORTEX_PREVIEW_COST.red &&
    args.remainingEnergy.blue >= ANCIENT_VORTEX_PREVIEW_COST.blue
  ) {
    availableManualOnlySolarPowerIds.push('SVOR');
  }
  if (
    args.remainingEnergy.green >= ANCIENT_BLACK_HOLE_PREVIEW_COST.green &&
    args.remainingEnergy.red >= ANCIENT_BLACK_HOLE_PREVIEW_COST.red &&
    args.remainingEnergy.blue >= ANCIENT_BLACK_HOLE_PREVIEW_COST.blue
  ) {
    availableManualOnlySolarPowerIds.push('SBLA');
  }

  return {
    availableManualOnlySolarPowerIds,
    requiresManualPause: availableManualOnlySolarPowerIds.length > 0,
  };
}
