/**
 * Alpha Entry Panel
 * 
 * Panel component for Alpha v3 player name entry.
 * Contains ONLY the form body (not the header/footer chrome).
 * 
 * Responsibilities:
 * - Collect temporary player name (local state only)
 * - Validate player name client-side (3-20 alphanumeric chars)
 * - Trigger onPlay callback with player name
 * 
 * Does NOT:
 * - Render branding/logo/title (handled by LoginShell)
 * - Render footer links (handled by LoginShell)
 * - Call backend APIs
 * - Manage session state
 */

import { useState } from 'react';
import { InputField } from '../ui/primitives/inputs/InputField';
import { PrimaryButton } from '../ui/primitives/buttons/PrimaryButton';

interface AlphaEntryPanelProps {
  onPlay: (playerName: string) => void;
}

/**
 * Validates player name (client-side only)
 * Rules: 3-20 characters, A-Z, a-z, 0-9 only (no spaces or special characters)
 */
function validatePlayerName(name: string): boolean {
  const regex = /^[A-Za-z0-9]{3,20}$/;
  return regex.test(name);
}

export function AlphaEntryPanel({ onPlay }: AlphaEntryPanelProps) {
  const [playerName, setPlayerName] = useState('');

  // Validation logic
  const onlyValidChars = /^[A-Za-z0-9]*$/.test(playerName);
  const hasInvalidChars = playerName.length > 0 && !onlyValidChars;
  const isTooLong = playerName.length > 20;
  
  // Show error if:
  // 1. Has invalid characters (immediate error)
  // 2. OR (has only valid chars AND length >= 3 AND too long) (deferred error)
  const showError = hasInvalidChars || (onlyValidChars && playerName.length >= 3 && isTooLong);
  
  // Button enabled only when fully valid (3-20 alphanumeric characters)
  const isValid = validatePlayerName(playerName);

  const handlePlay = () => {
    if (isValid) {
      onPlay(playerName.trim());
    }
  };

  const handleNameChange = (value: string) => {
    setPlayerName(value);
  };

  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
      <div className="content-stretch flex flex-col gap-[50px] items-center relative shrink-0 w-[600px]">
        
        {/* Name Entry Form */}
        <div className="content-stretch flex flex-col gap-[20px] items-center px-[40px] py-[25px] relative w-full">
          <p 
            className="font-black leading-[normal] relative shrink-0 text-[36px] text-center w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Enter your name
          </p>
          
          {/* Form */}
          <div className="content-stretch flex flex-col gap-[29px] items-start relative shrink-0 w-full">
            
            {/* Input Field */}
            <div className="w-full">
              <InputField
                value={playerName}
                onChange={handleNameChange}
                placeholder="Player name"
                error={showError}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePlay();
                  }
                }}
              />
              {showError && (
                <p className="font-normal text-[14px] text-[#FF8282] mt-2">
                  Name must be 3–20 letters or numbers only (no spaces or symbols)
                </p>
              )}
            </div>
            
            {/* Play Button */}
            <PrimaryButton
              onClick={handlePlay}
              disabled={!isValid}
              className="w-full"
            >
              PLAY
            </PrimaryButton>

          </div>
        </div>

        {/* Session Disclaimer */}
        <div className="content-stretch flex flex-col gap-[20px] items-center px-[40px] py-[25px] relative w-full">
          <p 
            className="font-normal leading-[22px] relative shrink-0 text-[16px] text-center w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <span 
              className="font-semibold"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              Online Client - Alpha Version 3.
            </span>
            <span>
              <br aria-hidden="true" />
              Name is just for this session.
              <br aria-hidden="true" />
              3–20 letters or numbers, no spaces or symbols
              <br aria-hidden="true" />
              Games are not tracked.
              <br aria-hidden="true" />
              Private games only (send link to friend).
            </span>
          </p>
        </div>

      </div>
    </div>
  );
}