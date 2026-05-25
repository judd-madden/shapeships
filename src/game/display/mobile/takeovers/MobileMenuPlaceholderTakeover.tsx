import { MobileTakeoverShell } from './MobileTakeoverShell';

interface MobileMenuPlaceholderTakeoverProps {
  onClose: () => void;
}

export function MobileMenuPlaceholderTakeover({ onClose }: MobileMenuPlaceholderTakeoverProps) {
  return (
    <MobileTakeoverShell title="Menu" onClose={onClose}>
      {/* Placeholder-only takeover for Phase 11H-1 nav active-state validation. */}
      <div className="px-[20px] py-[18px]">
        <p className="text-[16px] font-medium leading-[20px] text-[var(--shapeships-grey-30)]">
          Menu coming soon
        </p>
      </div>
    </MobileTakeoverShell>
  );
}
