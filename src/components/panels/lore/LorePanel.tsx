import { useEffect, useRef, useState } from 'react';
import { SecondaryNavItem } from '../../ui/primitives/navigation/SecondaryNavItem';
import { GalacticWarPanel } from './GalacticWarPanel';
import { MissionFindingsPanel } from './MissionFindingsPanel';
import { SpeciesLorePanel } from './SpeciesLorePanel';
import { speciesLore, type SpeciesLoreId } from './loreContent';

type LoreTab = 'mission-findings' | 'galactic-war' | SpeciesLoreId;

const loreTabs: readonly { id: LoreTab; label: string }[] = [
  { id: 'mission-findings', label: 'Mission Findings' },
  { id: 'galactic-war', label: 'Galactic War' },
  { id: 'human', label: 'Human' },
  { id: 'xenite', label: 'Xenite' },
  { id: 'centaur', label: 'Centaur' },
  { id: 'ancient', label: 'Ancient' },
];

export function LorePanel() {
  const [activeTab, setActiveTab] = useState<LoreTab>('mission-findings');
  const preloadedSpeciesImagesRef = useRef<HTMLImageElement[]>([]);

  useEffect(() => {
    const preloadedImages = Object.values(speciesLore).flatMap(({ imageSrc }) => {
      if (!imageSrc) return [];

      const image = new Image();
      image.src = imageSrc;
      void image.decode().catch(() => {});

      return [image];
    });

    preloadedSpeciesImagesRef.current = preloadedImages;

    return () => {
      preloadedSpeciesImagesRef.current = [];
    };
  }, []);

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

      {activeTab === 'mission-findings' && <MissionFindingsPanel />}
      {activeTab === 'galactic-war' && <GalacticWarPanel />}
      {activeTab !== 'mission-findings' && activeTab !== 'galactic-war' && (
        <SpeciesLorePanel speciesId={activeTab} />
      )}
    </div>
  );
}
