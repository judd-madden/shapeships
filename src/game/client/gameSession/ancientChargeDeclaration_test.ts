declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
  readTextFile(path: URL): Promise<string>;
};

import { deriveAncientAutocastEntryDecision } from './ancientAutocastDecision.ts';
import { ANCIENT_SIPHON_MINIMUM_SPEND } from '../../data/ancientSiphonRules.ts';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message = 'values differ'): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${message}: ${actualJson} !== ${expectedJson}`);
}

function deriveDecision(
  green: number,
  red: number,
  blue: number,
  hasEligibleSimulacrumTarget = false
) {
  return deriveAncientAutocastEntryDecision({
    remainingEnergy: { green, red, blue },
    hasEligibleSimulacrumTarget,
    siphonMinimumSpend: ANCIENT_SIPHON_MINIMUM_SPEND,
  });
}

const helperUrl = new URL('./ancientChargeDeclaration.ts', import.meta.url);
const runtimeUrl = new URL('../useGameSession.ts', import.meta.url);
const definitionUrl = new URL('../../data/ShipDefinitions.engine.ts', import.meta.url);

Deno.test('Ancient declaration routing uses only ordinary projected action count', async () => {
  const helper = await Deno.readTextFile(helperUrl);
  const runtime = await Deno.readTextFile(runtimeUrl);
  assert(helper.includes("return ordinaryChargeActions.length > 0 ? 'charges' : 'powers';"));
  assert(runtime.includes('stage: deriveAncientChargeDeclarationInitialStage(ancientDeclarationActions)'));
});

Deno.test('Ancient declaration payload and Energy replay use the narrowed authoritative contract', async () => {
  const helper = await Deno.readTextFile(helperUrl);
  const runtime = await Deno.readTextFile(runtimeUrl);
  const removedChoiceKey = ['solar', 'Grid', 'Choices'].join('');
  const removedPreviewHelper = ['derive', 'Provisional', 'Ancient', 'Energy'].join('');
  assert(!helper.includes(removedChoiceKey));
  assert(!helper.includes(removedPreviewHelper));
  assert(helper.includes('ordinaryChargeActions: ordinaryActions'));
  assert(helper.includes('solarCasts: args.localManualSolarCasts.map'));
  assert(runtime.includes('startingPool: authoritativeAncientEnergy'));
});

Deno.test('SOL client definition retains charge consumption without player-choice activation', async () => {
  const definitions = await Deno.readTextFile(definitionUrl);
  const start = definitions.indexOf("'SOL': {");
  const end = definitions.indexOf("\n  'INT':", start);
  assert(start >= 0 && end > start);
  const solarGridOverride = definitions.slice(start, end);
  assert(solarGridOverride.includes('kind: EffectKind.GAIN_ENERGY'));
  assert(solarGridOverride.includes('chargesRequired: 1'));
  assert(!solarGridOverride.includes('requiresCharge: true'));
});

Deno.test('Ancient Autocast pauses only for available manual-only Solar Powers', () => {
  assertEquals(deriveDecision(1, 1, 1), {
    availableManualOnlySolarPowerIds: [],
    requiresManualPause: false,
  });
  assertEquals(deriveDecision(2, 2, 1), {
    availableManualOnlySolarPowerIds: [],
    requiresManualPause: false,
  });
  assertEquals(deriveDecision(2, 2, 2).availableManualOnlySolarPowerIds, ['SVOR']);
  assertEquals(deriveDecision(1, 8, 0), {
    availableManualOnlySolarPowerIds: [],
    requiresManualPause: false,
  });
  assertEquals(deriveDecision(4, 4, 0).availableManualOnlySolarPowerIds, ['SSIP']);
  assertEquals(deriveDecision(4, 4, 4).availableManualOnlySolarPowerIds, [
    'SSIP',
    'SVOR',
    'SBLA',
  ]);
});

Deno.test('Ancient Autocast SSIM pause uses the affordable eligible-target signal', () => {
  assert(!deriveDecision(2, 0, 5, false).requiresManualPause, 'a 6-cost target at 5 blue must not pause');
  assertEquals(deriveDecision(2, 0, 5, true).availableManualOnlySolarPowerIds, ['SSIM']);
  assert(!deriveDecision(0, 0, 9, false).requiresManualPause, 'a max-quantity-blocked target must not pause');
});

Deno.test('Ancient Autocast Black Hole pause does not depend on enemy targets', () => {
  assert(deriveDecision(4, 4, 4, false).availableManualOnlySolarPowerIds.includes('SBLA'));
});

Deno.test('Ancient auto-entry integration preserves manual recovery and the shared submission path', async () => {
  const runtime = await Deno.readTextFile(runtimeUrl);
  assert(runtime.includes("entryDisposition: 'unresolved'"));
  assert(runtime.includes("entryDisposition: 'manual'"));
  assert(runtime.includes("entryDisposition: 'auto-submitting'"));
  assert(runtime.includes('ancientAutoEntryGuardWorkflowKeyRef.current === ancientChargeDeclarationWorkflowKey'));
  assert(runtime.includes("void handleReadyToggle('auto-entry')"));
  assert(runtime.includes("void handleReadyToggle('manual')"));
  assert(runtime.includes("activeAncientChargeDeclarationWorkflow.entryDisposition === 'unresolved'"));
  assert(runtime.includes('hasEligibleSimulacrumTarget: ancientSimulacrumTargeting.hasEligibleTarget'));
  assert(!runtime.includes('hasEligibleSimulacrumTarget: ancientSimulacrumTargeting.hasLegalTargetBeforeAffordability'));
  assert(runtime.includes('declarationId: generateNonce()'));
  assert(runtime.includes('actions: ancientDeclarationActions'));
});
