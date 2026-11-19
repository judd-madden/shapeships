export function SinglePlayerFeatures() {
  return (
    <section aria-labelledby="single-player-features" className="w-full text-white">
      <h3
        id="single-player-features"
        className="mb-[16px] text-center text-[16px] font-bold leading-normal text-shapeships-grey-20 md:mb-[32px] md:pl-[32px] md:text-left md:text-[20px]"
      >
        SINGLE PLAYER FEATURES
      </h3>

      <dl className="flex flex-col gap-[6px] md:gap-[8px]">
        <div className="grid grid-cols-[100px_minmax(0,1fr)] rounded-[8px] bg-shapeships-grey-90 p-[16px] md:grid-cols-[150px_minmax(0,1fr)] md:px-[32px] md:py-[24px]">
          <dt className="text-[15px] font-bold leading-[1.3] md:text-[20px] md:leading-[24px]">Win Streaks</dt>
          <dd className="text-[13px] font-normal leading-[1.3] md:text-[20px] md:leading-[24px]">
            Winning against the computer makes the next game harder.
          </dd>
        </div>
        <div className="grid grid-cols-[100px_minmax(0,1fr)] rounded-[8px] bg-[#171717] p-[16px] md:grid-cols-[150px_minmax(0,1fr)] md:px-[32px] md:py-[24px]">
          <dt className="text-[15px] font-bold leading-[1.3] md:text-[20px] md:leading-[24px]">Missions</dt>
          <dd className="text-[13px] font-normal leading-[1.3] md:text-[20px] md:leading-[24px]">
            Win different species matchups to unlock Lore.
          </dd>
        </div>
        <div className="grid grid-cols-[100px_minmax(0,1fr)] rounded-[8px] bg-[#101010] p-[16px] md:grid-cols-[150px_minmax(0,1fr)] md:px-[32px] md:py-[24px]">
          <dt className="text-[15px] font-bold leading-[1.3] md:text-[20px] md:leading-[24px]">Challenges</dt>
          <dd className="text-[13px] font-normal leading-[1.3] md:text-[20px] md:leading-[24px]">
            Optional each game. Win <em>with</em> or <em>without</em> a random ship.
          </dd>
        </div>
      </dl>
    </section>
  );
}
