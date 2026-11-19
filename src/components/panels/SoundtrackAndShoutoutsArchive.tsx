// Disabled by owner decision, 19 November 2026 (Phase 22B.2). Not imported anywhere. To restore: uncomment, export a component, and mount it where the owner chooses.
//
// import React from 'react';
// import { MusicIcon } from '../ui/primitives/icons/MusicIcon';
//
// interface SectionHeadingProps {
//   children: React.ReactNode;
// }
//
// const SOUNDTRACK_LINKS = [
//   {
//     label: 'Human Theme',
//     href: 'https://colourhigh.bandcamp.com/track/sonder',
//     color: 'var(--shapeships-pastel-blue)',
//   },
//   {
//     label: 'Xenite Theme',
//     href: 'https://colourhigh.bandcamp.com/track/outworld-destroyer',
//     color: 'var(--shapeships-pastel-green)',
//   },
//   {
//     label: 'Centaur Theme',
//     href: 'https://colourhigh.bandcamp.com/track/rain-sample',
//     color: 'var(--shapeships-pastel-red)',
//   },
//   {
//     label: 'Ancient Theme',
//     href: 'https://colourhigh.bandcamp.com/track/all-lower',
//     color: 'var(--shapeships-pastel-purple)',
//   },
// ] as const;
//
// const PLAYER_SHOUT_OUTS = [
//   'aleph_one',
//   'Alex',
//   'Amphethis',
//   'Bevan',
//   'Chris',
//   'Dan',
//   'Danny',
//   'Erniemist',
//   'Eeriemist',
//   'Happy7',
//   'James Harrison',
//   'loredude',
//   'Luke',
//   'Sandcastle',
//   'thomaslf',
//   'Tom',
//   'zergo',
//   'ZHOZN',
// ] as const;
//
// function SectionHeading({ children }: SectionHeadingProps) {
//   return (
//     <div className="flex w-full items-center gap-[12px]">
//       <div
//         aria-hidden="true"
//         className="h-px min-w-0 flex-1 bg-gradient-to-r from-transparent to-[var(--shapeships-white)] opacity-30"
//       />
//       <h3
//         className="shrink-0 text-center text-[clamp(18px,2.5cqw,20px)] font-bold leading-[normal] text-shapeships-white"
//       >
//         {children}
//       </h3>
//       <div
//         aria-hidden="true"
//         className="h-px min-w-0 flex-1 bg-gradient-to-r from-[var(--shapeships-white)] to-transparent opacity-30"
//       />
//     </div>
//   );
// }
//
// function SoundtrackAndShoutoutsArchive() {
//   return (
//     <>
//         <section className="mb-[clamp(56px,8.1cqw,80px)] flex w-full max-w-[800px] flex-col items-center">
//           <MusicIcon className="hidden sm:block mb-[12px] text-shapeships-white" />
//           <SectionHeading>Soundtrack on Bandcamp</SectionHeading>
//           <div className="mt-[20px] flex flex-wrap items-center justify-center gap-x-[32px] gap-y-[16px]">
//             {SOUNDTRACK_LINKS.map((link) => (
//               <a
//                 key={link.label}
//                 href={link.href}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="text-[clamp(16px,2.25cqw,18px)] font-normal leading-[normal] hover:underline"
//                 style={{
//                   color: link.color,
//                 }}
//               >
//                 {link.label}
//               </a>
//             ))}
//           </div>
//         </section>
//
//         <section className="flex w-full max-w-[800px] flex-col items-center">
//           <SectionHeading>Player Shout-outs</SectionHeading>
//           <div className="mt-[24px] flex max-w-[670px] flex-wrap items-center justify-center gap-x-[20px] gap-y-[16px]">
//             {PLAYER_SHOUT_OUTS.map((name) => (
//               <span
//                 key={name}
//                 className="text-[clamp(14px,1.875cqw,15px)] font-normal leading-[normal] text-shapeships-white"
//               >
//                 {name}
//               </span>
//             ))}
//           </div>
//         </section>
//     </>
//   );
// }
//
