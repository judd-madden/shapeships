import { HomeIcon } from '../../ui/primitives/icons/HomeIcon';
import { MENU_PAGES, type MenuNavigationProps } from './MenuNavigation';

export function MenuBottomNav({ activePanel, isLoreUnread, onSelect }: MenuNavigationProps) {
  return (
    <nav
      aria-label="Mobile menu"
      className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-shapeships-grey-50 bg-[linear-gradient(to_bottom,var(--shapeships-grey-70),var(--shapeships-grey-90)_160%)] px-[20px] pb-[env(safe-area-inset-bottom)] min-[400px]:px-[24px] md:hidden"
    >
      <div className="flex h-[84px] items-center justify-between">
        {MENU_PAGES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-label={id === 'welcome' ? 'Welcome' : undefined}
            aria-current={activePanel === id ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={`relative flex shrink-0 cursor-pointer items-center justify-center text-[15px] font-bold leading-[24px] text-nowrap min-[400px]:text-[17px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-shapeships-pastel-purple ${activePanel === id ? 'text-shapeships-pastel-purple' : 'text-shapeships-white'}`}
          >
            {id === 'welcome' ? <HomeIcon className="size-[24px]" /> : label}
            {activePanel === id && (
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-11px] h-[3px] bg-shapeships-pastel-purple" />
            )}
            {id === 'lore' && isLoreUnread && (
              <span aria-hidden="true" className="absolute left-1/2 top-full size-[10px] -translate-x-1/2 rounded-full bg-shapeships-pastel-purple" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
