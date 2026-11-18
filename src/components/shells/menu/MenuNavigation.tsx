export const MENU_PAGES = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'playComputer', label: 'Single Player' },
  { id: 'multiplayer', label: 'Multiplayer' },
  { id: 'rules', label: 'Rules' },
  { id: 'lore', label: 'Lore' },
] as const;

export type MenuPageId = typeof MENU_PAGES[number]['id'];

export interface MenuNavigationProps {
  activePanel: MenuPageId | 'createPrivateGame';
  isLoreUnread: boolean;
  onSelect: (panel: MenuPageId) => void;
}

export function MenuNavigation({ activePanel, isLoreUnread, onSelect }: MenuNavigationProps) {
  return (
    <nav aria-label="Menu" className="hidden w-full shrink-0 md:block min-[1025px]:w-[250px] min-[1025px]:pb-[24px] xl:w-[340px]">
      <div className="flex w-full items-start justify-between min-[1025px]:flex-col min-[1025px]:gap-y-[36px] min-[1025px]:pl-[20px] xl:gap-y-[50px] xl:pl-[40px]">
        {MENU_PAGES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-current={activePanel === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={`relative flex shrink-0 cursor-pointer items-center gap-[12px] pb-[5px] text-[24px] font-black leading-[32px] text-nowrap uppercase focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-shapeships-pastel-purple min-[1025px]:text-[28px] ${activePanel === id ? 'text-shapeships-pastel-purple' : 'text-shapeships-white hover:text-shapeships-pastel-purple/80'}`}
          >
            {activePanel === id && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-7px] h-[7px] bg-shapeships-pastel-purple" />
            )}
            {label}
            {id === 'lore' && isLoreUnread && (
              <span aria-hidden="true" className="size-[16px] rounded-full bg-shapeships-pastel-purple" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
