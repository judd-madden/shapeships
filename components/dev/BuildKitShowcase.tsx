/**
 * Build Kit Showcase
 * Displays all UI primitives with their various states
 * Accessible via Development Dashboard
 */

import { useState } from 'react';
import {
  PrimaryButton,
  MenuButton,
  ReadyButton,
  ActionButton,
  ActionButtonSmall,
  InputField,
  LobbyRow,
  RadioButton,
  Checkbox,
  Tab,
  SecondaryNavItem,
  ChevronDown,
  BuildIcon,
  BattleIcon,
  Dice
} from '../ui/primitives';

export function BuildKitShowcase() {
  const [inputValue, setInputValue] = useState('');
  const [errorInput, setErrorInput] = useState('');
  const [radio1, setRadio1] = useState(false);
  const [radio2, setRadio2] = useState(true);
  const [checkbox1, setCheckbox1] = useState(false);
  const [checkbox2, setCheckbox2] = useState(true);
  const [selectedTab, setSelectedTab] = useState('tab2');
  const [selectedNav, setSelectedNav] = useState('nav1');

  return (
    <div className="bg-black p-8 min-h-screen text-white">
      <div className="max-w-[1200px] mx-auto space-y-12">
        
        <section>
          <h1 className="text-3xl font-black mb-2">Build Kit Showcase</h1>
          <p className="text-[#888888] mb-8">Reusable UI primitives for Shapeships</p>
        </section>

        {/* Primary Button */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Login Screens Button</h2>
          <div className="max-w-[400px]">
            <p className="text-sm text-[#888888] mb-2">Hover to see scale effect</p>
            <div className="w-[360px]">
              <PrimaryButton>CREATE ACCOUNT</PrimaryButton>
            </div>
          </div>
        </section>

        {/* Input Field */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Login Screens Input Field</h2>
          <div className="grid grid-cols-2 gap-4 max-w-[800px]">
            <div>
              <p className="text-sm text-[#888888] mb-2">Default / Hover / Focus</p>
              <div className="w-[360px]">
                <InputField value={inputValue} onChange={setInputValue} placeholder="Input Field" />
              </div>
            </div>
            <div>
              <p className="text-sm text-[#888888] mb-2">Error State</p>
              <div className="w-[360px]">
                <InputField value={errorInput} onChange={setErrorInput} placeholder="Input Field" error />
              </div>
            </div>
          </div>
        </section>

        {/* Menu Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Menu Screens Buttons</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-4">
              <p className="text-sm text-[#888888]">Private</p>
              <MenuButton variant="private">CREATE PRIVATE GAME</MenuButton>
              <MenuButton variant="private" selected>CREATE PRIVATE GAME</MenuButton>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[#888888]">Public</p>
              <MenuButton variant="public">CREATE LOBBY GAME</MenuButton>
              <MenuButton variant="public" selected>CREATE LOBBY GAME</MenuButton>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[#888888]">Join (Default / Available)</p>
              <MenuButton variant="join">JOIN LOBBY GAME</MenuButton>
              <MenuButton variant="join" selected>JOIN LOBBY GAME</MenuButton>
            </div>
          </div>
        </section>

        {/* Lobby Row */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Lobby Row</h2>
          <div className="space-y-2 max-w-[958px]">
            <p className="text-sm text-[#888888]">Default</p>
            <LobbyRow
              playerName="Guest 12"
              gameMode="Standard"
              matchType="X v Any"
              timeControl="10m + 30s"
              duration="45m"
              variants="Epic Health, Accelerated Game, No Destruction"
            />
            <p className="text-sm text-[#888888] mt-4">Alternate (for zebra striping)</p>
            <LobbyRow
              playerName="Guest 12"
              gameMode="Standard"
              matchType="X v Any"
              timeControl="10m + 30s"
              duration="45m"
              variants="Epic Health, Accelerated Game, No Destruction"
              alternate
            />
            <p className="text-sm text-[#888888] mt-4">Selected-Own (no hover)</p>
            <LobbyRow
              playerName="Guest 12"
              gameMode="Standard"
              matchType="X v Any"
              timeControl="10m + 30s"
              duration="45m"
              variants="Epic Health, Accelerated Game, No Destruction"
              selected
            />
          </div>
        </section>

        {/* Icons */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Icons</h2>
          <div className="flex gap-8">
            <div>
              <p className="text-sm text-[#888888] mb-2">Chevron Down</p>
              <ChevronDown />
            </div>
            <div>
              <p className="text-sm text-[#888888] mb-2">Build</p>
              <BuildIcon />
            </div>
            <div>
              <p className="text-sm text-[#888888] mb-2">Battle</p>
              <BattleIcon />
            </div>
          </div>
        </section>

        {/* Radio & Checkbox */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Selection Controls</h2>
          <div className="flex gap-12">
            <div className="space-y-4">
              <p className="text-sm text-[#888888]">Radio Button</p>
              <div className="flex gap-4">
                <RadioButton selected={radio1} onClick={() => { setRadio1(true); setRadio2(false); }} />
                <RadioButton selected={radio2} onClick={() => { setRadio2(true); setRadio1(false); }} />
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[#888888]">Checkbox</p>
              <div className="flex gap-4">
                <Checkbox checked={checkbox1} onChange={setCheckbox1} />
                <Checkbox checked={checkbox2} onChange={setCheckbox2} />
              </div>
            </div>
          </div>
        </section>

        {/* Tabs & Secondary Nav */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Navigation</h2>
          <div className="grid grid-cols-2 gap-8 max-w-[600px]">
            <div className="space-y-2">
              <p className="text-sm text-[#888888]">Tabs</p>
              <div className="flex gap-2">
                <Tab label="Tab 1" selected={selectedTab === 'tab1'} onClick={() => setSelectedTab('tab1')} />
                <Tab label="Tab 2" selected={selectedTab === 'tab2'} onClick={() => setSelectedTab('tab2')} />
                <Tab label="Tab 3" selected={selectedTab === 'tab3'} onClick={() => setSelectedTab('tab3')} />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-[#888888]">Secondary Nav</p>
              <div className="flex gap-2">
                <SecondaryNavItem label="Nav 1" selected={selectedNav === 'nav1'} onClick={() => setSelectedNav('nav1')} />
                <SecondaryNavItem label="Nav 2" selected={selectedNav === 'nav2'} onClick={() => setSelectedNav('nav2')} />
              </div>
            </div>
          </div>
        </section>

        {/* Dice */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Dice</h2>
          <div className="flex gap-4 flex-wrap">
            {([1, 2, 3, 4, 5, 6] as const).map(value => (
              <div key={value}>
                <p className="text-sm text-[#888888] mb-2">Dice {value}</p>
                <Dice value={value} />
              </div>
            ))}
          </div>
        </section>

        {/* Ready Button */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Game Screen - Ready Button</h2>
          <div className="grid grid-cols-2 gap-4 max-w-[700px]">
            <div>
              <p className="text-sm text-[#888888] mb-2">Default</p>
              <div className="w-[300px]">
                <ReadyButton note="[Conditional note]" />
              </div>
            </div>
            <div>
              <p className="text-sm text-[#888888] mb-2">Selected</p>
              <div className="w-[300px]">
                <ReadyButton selected note="[Conditional note]" />
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[#DA41B9]">Action Buttons</h2>
          <div className="grid grid-cols-2 gap-8 max-w-[600px]">
            <div className="space-y-4">
              <p className="text-sm text-[#888888]">Large - Default</p>
              <ActionButton label="Action" detail="(charge count)" />
              <p className="text-sm text-[#888888] mt-4">Large - Selected (Yellow ship)</p>
              <ActionButton label="Action" detail="(charge count)" selected backgroundColor="#FCFF81" />
              <p className="text-sm text-[#888888] mt-4">Large - Selected (Blue ship, white text)</p>
              <ActionButton label="Action" detail="(charge count)" selected backgroundColor="#2555FF" textColor="white" />
            </div>
            <div className="space-y-4">
              <p className="text-sm text-[#888888]">Small - Default</p>
              <ActionButtonSmall label="Hold Charge" />
              <p className="text-sm text-[#888888] mt-4">Small - Selected (Yellow ship)</p>
              <ActionButtonSmall label="Hold Charge" selected backgroundColor="#FCFF81" />
              <p className="text-sm text-[#888888] mt-4">Small - Selected (Blue ship, white text)</p>
              <ActionButtonSmall label="Hold Charge" selected backgroundColor="#2555FF" textColor="white" />
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}