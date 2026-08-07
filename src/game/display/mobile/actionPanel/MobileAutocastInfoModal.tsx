import { AncientAutocastInfoContent } from '../../actionPanel/panels/catalogue/ancient/AncientAutocastInfoContent';

interface MobileAutocastInfoModalProps {
  onClose: () => void;
}

export function MobileAutocastInfoModal({
  onClose,
}: MobileAutocastInfoModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/45"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Autocast information"
        className="fixed bottom-[24px] left-[26px] right-[26px] flex max-h-[calc(100dvh-48px)] w-[calc(100vw-52px)] flex-col rounded-[10px] border border-[var(--shapeships-grey-70)] bg-[var(--shapeships-grey-90)] shadow-[0_0_60px_20px_rgba(0,0,0,1)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-[20px] pb-[18px] pt-[20px]">
          <h2
            className="mb-[20px] text-[22px] font-black leading-none text-white"
          >
            AUTOCAST
          </h2>
          <AncientAutocastInfoContent className="text-[16px] font-normal leading-[20px] text-white" />
        </div>

        <div className="shrink-0 px-[20px] pb-[20px]">
          <div className="mb-[16px] h-px w-full bg-[var(--shapeships-grey-70)]" />
          <button
            type="button"
            onClick={onClose}
            className="flex h-[50px] w-full items-center justify-center rounded-[10px] bg-white px-[16px] text-[18px] font-black leading-none text-black active:scale-[0.99]"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
