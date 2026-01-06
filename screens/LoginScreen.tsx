/**
 * Login Screen
 * 
 * CANONICAL ENTRY POINT for PlayerMode in Alpha v3
 * 
 * This is the first screen shown when:
 * - No player name is set
 * - No active session exists
 * - User clicks "Exit" from the menu
 * 
 * Responsibilities:
 * - Collect temporary player name (local state only)
 * - Trigger onPlay callback with player name
 * - Display game features and branding
 * - Provide links to external resources
 * 
 * Does NOT:
 * - Call backend APIs
 * - Manage session state
 * - Handle routing/navigation
 * - Implement authentication
 */

import { useState } from 'react';
import { InputField } from '../components/ui/primitives/inputs/InputField';
import { PrimaryButton } from '../components/ui/primitives/buttons/PrimaryButton';
import svgPaths from '../imports/svg-sgmbdp397k';

interface LoginScreenProps {
  onPlay: (playerName: string) => void;
}

export function LoginScreen({ onPlay }: LoginScreenProps) {
  const [playerName, setPlayerName] = useState('');

  const handlePlay = () => {
    if (playerName.trim()) {
      onPlay(playerName.trim());
    }
  };

  return (
    <div className="content-stretch flex flex-col items-center pb-[120px] pt-[60px] px-[240px] relative size-full overflow-y-auto">
      <div className="content-stretch flex flex-col gap-[80px] items-center relative shrink-0 w-full">
        
        {/* Logo + Title + Feature Highlights */}
        <div className="content-stretch flex flex-col gap-[64px] items-center relative shrink-0 w-full">
          
          {/* Logo */}
          <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
            <p className="[grid-area:1_/_1] font-['Inter'] font-bold leading-[normal] ml-[203.9px] mt-[0.49px] not-italic relative text-[105.935px] text-nowrap text-white">
              SHAPESHIPS
            </p>
            <div className="[grid-area:1_/_1] flex h-[136.015px] items-center justify-center ml-0 mt-0 relative w-[159.556px]">
              <div className="flex-none rotate-[180deg] scale-y-[-100%]">
                <div className="h-[136.015px] relative w-[159.556px]">
                  <div className="absolute inset-[-9.5%_-12.13%_-14.76%_-12.13%]">
                    <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 198.271 169.018">
                      <path d={svgPaths.p2f58ad30} fill="black" stroke="#CD8CFF" strokeMiterlimit="10" strokeWidth="13.0784" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Highlights Row */}
          <div className="content-center flex flex-wrap gap-[20px_70px] items-center justify-center relative shrink-0 w-full">
            
            {/* Feature 1: Free space battle game */}
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
              <div className="relative shrink-0 size-[48px]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
                  <path d={svgPaths.p35f60d00} fill="white" />
                </svg>
              </div>
              <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-nowrap text-white">
                A free space
                <br aria-hidden="true" />
                battle game
              </p>
            </div>

            {/* Feature 2: 1v1 Online */}
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
              <div className="relative shrink-0 size-[48px]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
                  <path d={svgPaths.p79642e0} fill="white" />
                </svg>
              </div>
              <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[127.2px]">
                1v1 Online
              </p>
            </div>

            {/* Feature 3: Simultaneous turns */}
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
              <div className="h-[40.215px] relative shrink-0 w-[42.014px]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 42.0144 40.2151">
                  <path d={svgPaths.pf9ce800} fill="white" />
                  <path d={svgPaths.p10b2b780} fill="white" />
                </svg>
              </div>
              <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[146.4px]">
                Simultaneous
                <br aria-hidden="true" />
                turns
              </p>
            </div>

            {/* Feature 4: 10-30 minute games */}
            <div className="content-stretch flex gap-[12px] items-center relative shrink-0">
              <div className="relative shrink-0 size-[48px]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
                  <path d={svgPaths.p32df6780} fill="white" />
                  <path d={svgPaths.p1c23b200} fill="white" />
                </svg>
              </div>
              <p className="font-['Inter'] font-medium leading-[24px] not-italic relative shrink-0 text-[21.6px] text-white w-[144px]">
                10-30 minute games
              </p>
            </div>

          </div>
        </div>

        {/* Login Form Content */}
        <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
          <div className="content-stretch flex flex-col gap-[50px] items-center relative shrink-0 w-[600px]">
            
            {/* Name Entry Form */}
            <div className="content-stretch flex flex-col gap-[20px] items-center px-[40px] py-[25px] relative w-full">
              <p 
                className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[36px] text-center text-white w-full"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                Enter your name
              </p>
              
              {/* Form */}
              <div className="content-stretch flex flex-col gap-[29px] items-start relative shrink-0 w-full">
                
                {/* Input Field */}
                <InputField
                  value={playerName}
                  onChange={setPlayerName}
                  placeholder="Player name"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handlePlay();
                    }
                  }}
                />
                
                {/* Play Button */}
                <PrimaryButton
                  onClick={handlePlay}
                  disabled={!playerName.trim()}
                  className="w-full"
                >
                  PLAY
                </PrimaryButton>

              </div>
            </div>

            {/* Session Disclaimer */}
            <div className="content-stretch flex flex-col gap-[20px] items-center px-[40px] py-[25px] relative w-full">
              <p 
                className="font-['Roboto'] font-normal leading-[22px] relative shrink-0 text-[16px] text-center text-white w-full"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                <span 
                  className="font-['Roboto'] font-semibold"
                  style={{ fontVariationSettings: "'wdth' 100" }}
                >
                  Online Client - Alpha Version 3.
                </span>
                <span>
                  <br aria-hidden="true" />
                  Name is just for this session.
                  <br aria-hidden="true" />
                  Games are not tracked.
                  <br aria-hidden="true" />
                  Private games only (send link to friend).
                </span>
              </p>
            </div>

          </div>
        </div>

        {/* Footer Links */}
        <div className="content-stretch flex font-['Roboto'] font-normal gap-[45px] items-center leading-[normal] relative shrink-0 text-[22px] text-nowrap text-white">
          <a
            href="https://juddmadden.com/shapeships/"
            target="_blank"
            rel="noopener noreferrer"
            className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            How to Play
          </a>
          <a
            href="https://discord.gg/MjPtf4G6Gt"
            target="_blank"
            rel="noopener noreferrer"
            className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Discord
          </a>
          <a
            href="https://www.youtube.com/@Shapeships"
            target="_blank"
            rel="noopener noreferrer"
            className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            YouTube
          </a>
          <a
            href="https://www.reddit.com/r/shapeships/"
            target="_blank"
            rel="noopener noreferrer"
            className="[text-underline-position:from-font] decoration-solid relative shrink-0 underline cursor-pointer hover:opacity-80"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Reddit
          </a>
        </div>

      </div>
    </div>
  );
}