/**
 * Ready Button
 * Used on Game screens
 * States: Default, Hover, Selected, SelectedHover
 * Optional icon (tick) and conditional note
 */

interface ReadyButtonProps {
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  note?: string;
}

function TickIcon() {
  return (
    <div className="relative shrink-0 size-[20px]">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <path 
          d="M19.0317 3.43563C18.643 3.05527 18.021 3.05527 17.6323 3.43563L6.1274 14.6944L2.25826 10.9229C1.86893 10.5434 1.24686 10.545 0.858845 10.9259L0.818806 10.9659C0.41856 11.3588 0.419175 12.0041 0.820759 12.3956L5.35982 16.8204C5.57862 17.0337 5.87104 17.1267 6.15377 17.0997C6.42144 17.112 6.6927 17.0182 6.89888 16.8165L19.0717 4.90536C19.4725 4.51315 19.4725 3.86787 19.0717 3.47567L19.0317 3.43563Z" 
          fill="black" 
        />
      </svg>
    </div>
  );
}

export function ReadyButton({ 
  selected = false, 
  onClick, 
  disabled = false, 
  className = "", 
  note 
}: ReadyButtonProps) {
  if (selected) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          bg-[#00BD13]
          h-[50px] 
          relative rounded-[10px] 
          w-full
          hover:scale-105
          transition-transform
          cursor-pointer
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
      >
        <div className="flex flex-row items-center justify-center size-full">
          <div className="content-stretch flex gap-[4px] items-center justify-center px-[20px] py-[19px] relative size-full">
            <TickIcon />
            <p 
              className="font-['Roboto'] font-black leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              READY
            </p>
            {note && (
              <p 
                className="font-['Roboto'] font-black font-normal leading-[normal] relative shrink-0 text-[18px] text-black text-nowrap"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                <span style={{ fontVariationSettings: "'wdth' 100" }}>- </span>
                <span style={{ fontVariationSettings: "'wdth' 100" }}>{note}</span>
              </p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${disabled ? 'bg-[#888888]' : 'bg-white'}
        h-[50px] 
        relative rounded-[10px] 
        w-full
        ${disabled ? 'cursor-not-allowed' : 'hover:scale-105 cursor-pointer'}
        transition-transform
        ${className}
      `}
    >
      <div className="flex flex-row items-center justify-center size-full">
        <div className="content-stretch flex font-['Roboto'] font-black gap-[4px] items-center justify-center px-[20px] py-[19px] relative size-full text-[18px] text-black text-nowrap">
          <p className="leading-[normal] relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
            READY
          </p>
          {note && (
            <p className="font-normal leading-[normal] relative shrink-0" style={{ fontVariationSettings: "'wdth' 100" }}>
              <span style={{ fontVariationSettings: "'wdth' 100" }}>- </span>
              <span style={{ fontVariationSettings: "'wdth' 100" }}>{note}</span>
            </p>
          )}
        </div>
      </div>
    </button>
  );
}