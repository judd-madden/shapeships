declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
  readTextFile(path: URL): Promise<string>;
};

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
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
