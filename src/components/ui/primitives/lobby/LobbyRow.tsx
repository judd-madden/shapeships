/**
 * Lobby Row
 * Used on Menu screens to display game lobbies
 * Variants: Default, Alternate (for striping)
 * States: Default, Selected (own game)
 * Hover: Default and Alternate states change background to Grey 70, Selected-Own has no hover
 */

interface LobbyRowProps {
  playerName: string;
  gameMode: string;
  matchType: string;
  timeControl: string;
  duration: string;
  variants?: string;
  alternate?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function LobbyRow({ 
  playerName,
  gameMode,
  matchType,
  timeControl,
  duration,
  variants,
  alternate = false,
  selected = false,
  onClick,
  className = "" 
}: LobbyRowProps) {
  // Use Tailwind classes for both default background and hover
  const bgClass = alternate ? 'bg-[#212121]' : 'bg-[#000000]'; // Grey 90 or Black
  
  if (selected) {
    return (
      <button
        onClick={onClick}
        className={`
          bg-white
          content-stretch flex flex-col gap-[10px] items-start justify-center 
          px-[40px] py-[25px] 
          relative w-full
          cursor-pointer
          ${className}
        `}
      >
        <div className="content-stretch flex font-['Roboto'] font-normal gap-[20px] items-center leading-[normal] relative text-[20px] text-black">
          <p className="relative w-[195px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {playerName}
          </p>
          <p className="relative w-[168px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {gameMode}
          </p>
          <p className="relative w-[144px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {matchType}
          </p>
          <p className="relative w-[182px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {timeControl}
          </p>
          <p className="relative w-[109px]" style={{ fontVariationSettings: "'wdth' 100" }}>
            {duration}
          </p>
        </div>
        {variants && (
          <div className="content-stretch flex items-center justify-center pl-[215px] pr-0 py-0 relative">
            <p 
              className="font-['Roboto'] font-normal leading-[normal] relative text-[15px] text-[#555555] w-[662px]"
              style={{ fontVariationSettings: "'wdth' 100" }}
            >
              {variants}
            </p>
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`
        ${bgClass}
        content-stretch flex flex-col gap-[10px] items-start justify-center 
        px-[40px] py-[25px] 
        relative w-full
        hover:!bg-[#555555]
        cursor-pointer
        ${className}
      `}
    >
      <div className="content-stretch flex font-['Roboto'] font-normal gap-[20px] items-center leading-[normal] relative text-[20px] text-white">
        <p className="relative w-[195px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {playerName}
        </p>
        <p className="relative w-[168px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {gameMode}
        </p>
        <p className="relative w-[144px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {matchType}
        </p>
        <p className="relative w-[182px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {timeControl}
        </p>
        <p className="relative w-[109px]" style={{ fontVariationSettings: "'wdth' 100" }}>
          {duration}
        </p>
      </div>
      {variants && (
        <div className="content-stretch flex items-center justify-center pl-[215px] pr-0 py-0 relative">
          <p 
            className="font-['Roboto'] font-normal leading-[normal] relative text-[15px] text-[#888888] w-[662px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            {variants}
          </p>
        </div>
      )}
    </button>
  );
}