import { useState } from 'react';
import { HealthBarPair } from '../../game/display/healthBars/HealthBar';
import { HEALTH_BAR_EXAMPLES, HEALTH_BAR_EXAMPLE_AXIS_LENGTHS, type HealthBarExample } from './healthBarExampleFixtures';

export function HealthBarExamplePreview({ example, stageIndex }: { readonly example: HealthBarExample; readonly stageIndex: number }) {
  const stage = example.stages[stageIndex] ?? example.stages[0];
  return (
    <div className="flex flex-wrap items-start gap-[40px] overflow-x-auto px-[16px] py-[20px]">
      {(['desktop', 'mobile'] as const).map((orientation) => (
        <div key={orientation} className="flex flex-col gap-[16px]">
          <p className="text-[12px] text-[var(--shapeships-grey-50)]">
            {orientation === 'desktop' ? 'Desktop: A left / B right' : 'Mobile: A upper / B lower'}<br />
            Example inner axis: {HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]}px
          </p>
          <HealthBarPair scale={example.scales[orientation]} orientation={orientation}
            axisLength={HEALTH_BAR_EXAMPLE_AXIS_LENGTHS[orientation]}
            left={stage.left} right={stage.right} leftLabel="Player A" rightLabel="Player B" />
        </div>
      ))}
    </div>
  );
}

export function HealthBarExamples() {
  const [scenarioId, setScenarioId] = useState(HEALTH_BAR_EXAMPLES[0].id);
  const [stageIndex, setStageIndex] = useState(0);
  const example = HEALTH_BAR_EXAMPLES.find((item) => item.id === scenarioId) ?? HEALTH_BAR_EXAMPLES[0];
  const stage = example.stages[stageIndex] ?? example.stages[0];
  const source = example.presentation.mode === 'live' ? example.presentation.snapshot : null;
  return (
    <section aria-labelledby="health-bar-examples-title" className="bg-black p-[20px] text-white">
      <h2 id="health-bar-examples-title" className="mb-[12px] text-[20px]">Health Bars</h2>
      <p className="mb-[16px] text-[12px] text-[var(--shapeships-grey-50)]">
        Static presentation states. Example dimensions only. Cap ticks and compression cues await visual review.
      </p>
      <div className="flex flex-wrap gap-[16px]">
        <label className="flex min-w-0 flex-col gap-[4px] text-[14px]">
          Scenario
          <select value={scenarioId} onChange={(event) => { setScenarioId(event.target.value); setStageIndex(0); }}
            className="max-w-full border border-[var(--shapeships-grey-50)] bg-[var(--shapeships-grey-90)] p-[8px] text-white">
            {HEALTH_BAR_EXAMPLES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-[4px] text-[14px]">
          Stage
          <select value={stageIndex} onChange={(event) => setStageIndex(Number(event.target.value))}
            className="border border-[var(--shapeships-grey-50)] bg-[var(--shapeships-grey-90)] p-[8px] text-white">
            {example.stages.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}
          </select>
        </label>
      </div>
      {source && <div className="mt-[16px] text-[12px] text-[var(--shapeships-grey-50)]">
        {[source.left, source.right].map((s, index) => (
          <p key={s.playerId}>Player {index === 0 ? 'A' : 'B'}: start {s.startHealth}, damage {s.damageTaken}, healing {s.grossHealingReceived}, final {s.finalHealth}, cap {s.maxHealth}</p>
        ))}
        <p>Displayed health: A {stage.left.health}, B {stage.right.health}. Retained domain: {example.scales.desktop.domainMin} to {example.scales.desktop.domainMax}.</p>
      </div>}
      <HealthBarExamplePreview example={example} stageIndex={stageIndex} />
    </section>
  );
}
