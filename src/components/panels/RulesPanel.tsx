/**
 * RULES PANEL
 * 
 * Container for all Rules pages
 * Owns secondary navigation tabs and routes to individual page panels
 */

import React, { useState } from 'react';
import { SecondaryNavItem } from '../ui/primitives/navigation/SecondaryNavItem';
import { CoreRulesPanel } from './CoreRulesPanel';
import { TurnTimingsPanel } from './TurnTimingsPanel';
import { SpeciesRulesPanel } from './SpeciesRulesPanel';

type RulesTab = 'core' | 'human' | 'xenite' | 'centaur' | 'ancient' | 'timings';

export function RulesPanel() {
  const [activeTab, setActiveTab] = useState<RulesTab>('core');

  const handleNavigate = (tab: RulesTab) => {
    setActiveTab(tab);
  };

  return (
    <div className="content-stretch flex flex-col gap-[90px] items-start relative w-full max-w-[1200px]">
      {/* Secondary Navigation */}
      <div className="content-center flex flex-wrap gap-[10px] items-center pb-[24px] relative shrink-0 w-full">
        <SecondaryNavItem 
          label="Core Rules" 
          selected={activeTab === 'core'} 
          onClick={() => handleNavigate('core')} 
        />
        <SecondaryNavItem 
          label="Human" 
          selected={activeTab === 'human'} 
          onClick={() => handleNavigate('human')} 
        />
        <SecondaryNavItem 
          label="Xenite" 
          selected={activeTab === 'xenite'} 
          onClick={() => handleNavigate('xenite')} 
        />
        <SecondaryNavItem 
          label="Centaur" 
          selected={activeTab === 'centaur'} 
          onClick={() => handleNavigate('centaur')} 
        />
        <SecondaryNavItem 
          label="Ancient" 
          selected={activeTab === 'ancient'} 
          onClick={() => handleNavigate('ancient')} 
        />
        <SecondaryNavItem 
          label="Turn Timings" 
          selected={activeTab === 'timings'} 
          onClick={() => handleNavigate('timings')} 
        />
      </div>

      {/* Page Content */}
      {activeTab === 'core' && <CoreRulesPanel onNavigate={handleNavigate} />}
      {activeTab === 'human' && <SpeciesRulesPanel species="Human" onNavigate={handleNavigate} />}
      {activeTab === 'xenite' && <SpeciesRulesPanel species="Xenite" onNavigate={handleNavigate} />}
      {activeTab === 'centaur' && <SpeciesRulesPanel species="Centaur" onNavigate={handleNavigate} />}
      {activeTab === 'ancient' && <SpeciesRulesPanel species="Ancient" onNavigate={handleNavigate} />}
      {activeTab === 'timings' && <TurnTimingsPanel onNavigate={handleNavigate} />}
    </div>
  );
}