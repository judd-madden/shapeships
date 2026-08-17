import { useState } from 'react';
import { SecondaryNavItem } from '../../ui/primitives/navigation/SecondaryNavItem';
import { LoreOverviewPanel } from './LoreOverviewPanel';
import { SpeciesLorePanel } from './SpeciesLorePanel';
import type { SpeciesLoreId } from './loreContent';

type LoreTab = 'overview' | SpeciesLoreId;

const loreTabs: readonly { id: LoreTab; label: string }[] = [
  { id: 'overview', label: 'Shapeships Lore' },
  { id: 'human', label: 'Human' },
  { id: 'xenite', label: 'Xenite' },
  { id: 'centaur', label: 'Centaur' },
  { id: 'ancient', label: 'Ancient' },
];

export function LorePanel() {
  const [activeTab, setActiveTab] = useState<LoreTab>('overview');

  const handleNavigate = (tab: LoreTab) => {
    setActiveTab(tab);

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  return (
    <div className="@container relative flex w-full min-w-0 max-w-[1200px] flex-col items-start gap-[32px] sm:gap-[50px]">
      <nav aria-label="Lore sections" className="relative flex w-full flex-wrap items-center gap-[10px] pb-[8px] md:pb-[16px] lg:pb-[24px]">
        {loreTabs.map((tab) => (
          <SecondaryNavItem
            key={tab.id}
            label={tab.label}
            selected={activeTab === tab.id}
            onClick={() => handleNavigate(tab.id)}
          />
        ))}
      </nav>

      {activeTab === 'overview' ? <LoreOverviewPanel /> : <SpeciesLorePanel speciesId={activeTab} />}
    </div>
  );
}
