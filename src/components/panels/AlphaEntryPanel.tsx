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
  onPlay: (playerName: string) => void | Promise<void>;
  primaryButtonLabel?: string;
  isStartingSession?: boolean;
}

/**
 * Validates player name (client-side only)
 * Rules: 3-20 characters, A-Z, a-z, 0-9 only (no spaces or special characters)
 */
function validatePlayerName(name: string): boolean {
  const regex = /^[A-Za-z0-9]{3,20}$/;
  return regex.test(name);
}

export function AlphaEntryPanel({
  onPlay,
  primaryButtonLabel = 'PLAY',
  isStartingSession = false,
}: AlphaEntryPanelProps) {
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
  const isSubmitDisabled = !isValid || isStartingSession;

  const handlePlay = () => {
    if (isSubmitDisabled) {
      return;
    }

    onPlay(playerName.trim());
  };

  const handleNameChange = (value: string) => {
    setPlayerName(value);
  };

  return (
    <div className="content-stretch flex flex-col items-center relative shrink-0 w-full">
      <div className="content-stretch relative flex w-full max-w-[600px] shrink-0 flex-col items-center gap-[40px] md:gap-[50px]">
        
        {/* Name Entry Form */}
        <div className="content-stretch relative flex w-full flex-col items-center gap-[20px] px-[20px] py-[25px] sm:px-[32px] md:px-[40px]">
          <p 
            className="font-black leading-[normal] relative shrink-0 text-[36px] text-center w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Enter your name
          </p>
          
          {/* Form */}
          <div className="content-stretch relative flex w-full shrink-0 flex-col items-start gap-[29px]">
            
            {/* Input Field */}
            <div className="w-full">
              <InputField
                value={playerName}
                onChange={handleNameChange}
                placeholder="Player name"
                error={showError}
                disabled={isStartingSession}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
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
              disabled={isSubmitDisabled}
              loading={isStartingSession}
              loadingLabel="ENTERING VOID..."
              className="w-full"
            >
              {primaryButtonLabel}
            </PrimaryButton>

          </div>
        </div>

        {/* Session Disclaimer */}
        <div className="content-stretch relative flex w-full flex-col items-center gap-[20px] px-[20px] py-[25px] sm:px-[32px] md:px-[40px]">
          <p 
            className="font-normal leading-[22px] relative shrink-0 text-[16px] text-center w-full"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            <span>
              <br aria-hidden="true" />
              Name is just for this session.
              <br aria-hidden="true" />
              3–20 letters or numbers, no spaces or symbols.
              <br aria-hidden="true" />
              1600px+ screen resolution required.
            </span>
          </p>
        </div>

      </div>
    </div>
  );
}
