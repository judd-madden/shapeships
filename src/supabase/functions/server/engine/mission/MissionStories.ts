export type MissionSpecies = "human" | "xenite" | "centaur" | "ancient";
export type MissionOpponentSpecies = Exclude<MissionSpecies, "ancient">;

export type MissionStory = {
  id: string;
  playerSpecies: MissionSpecies;
  opponentSpecies: MissionOpponentSpecies;
  findingIds: string[];
  title: string;
  location: string;
  author: string;
  paragraphs: string[];
};

export const MISSION_YEAR = 2814 as const;

export const MISSION_STORIES: readonly MissionStory[] = [
  {
    id: "mission-human-v-human-eliminate-rebels",
    playerSpecies: "human",
    opponentSpecies: "human",
    findingIds: ["sol-1", "rebel-alliance"],
    title: "Eliminate the Human Rebels",
    location: "Sol system",
    author: "juddly",
    paragraphs: [
      "We must eliminate the Rebel Humans in our home system. Neptune is overrun by these traitors to our species, our history. They want an alliance with the Centaur against the Xenite. Do they not remember the past? Humans can only rely on HUMANS. Right, [player]?",
    ],
  },
  {
    id: "mission-human-v-xenite-save-colonies",
    playerSpecies: "human",
    opponentSpecies: "xenite",
    findingIds: ["mintaka"],
    title: "Save Our Colonies from Xenite Invasion",
    location: "Mintaka system",
    author: "juddly",
    paragraphs: [
      "We have detected a Xenite cluster moving against Mintaka. This is a crucial Human system, with mining and civilian colonies. The vast Xenite mind is ruthless and must be stopped. Millions of innocent lives are in your hands [player].",
    ],
  },
  {
    id: "mission-human-v-centaur-take-over-outer-system",
    playerSpecies: "human",
    opponentSpecies: "centaur",
    findingIds: ["delta-aquarii"],
    title: "Take Over This Outer Centaur System",
    location: "Delta Aquarii system",
    author: "juddly",
    paragraphs: [
      "Few Centaurs remain in the Delta Aquarii system, it is ours for the taking. We need more resources for our growing colonies. These Centaurs COULD just move to a nearby system, but they're quite stubborn when it comes to territory - got it, [player]?",
    ],
  },
  {
    id: "mission-xenite-v-human-reclaim-purify",
    playerSpecies: "xenite",
    opponentSpecies: "human",
    findingIds: ["mintaka"],
    title: "Reclaim and Purify",
    location: "Mintaka system",
    author: "juddly",
    paragraphs: [
      "The Mintaka system is infected. Humans tear it apart for metal. I must reclaim what was always mine.\n- XAMEHBZ",
    ],
  },
  {
    id: "mission-xenite-v-xenite-remove-mutation",
    playerSpecies: "xenite",
    opponentSpecies: "xenite",
    findingIds: ["betelgeuse"],
    title: "Remove the Mutation",
    location: "Betelgeuse system",
    author: "juddly",
    paragraphs: [
      "Xenites have mutated within the central Betelgeuse system. I must remove them and restore Hive alignment. - XAMEHBZ",
    ],
  },
  {
    id: "mission-xenite-v-centaur-respond-arrogance",
    playerSpecies: "xenite",
    opponentSpecies: "centaur",
    findingIds: ["gamma-leporis"],
    title: "Respond to Arrogance",
    location: "Gamma Leporis system",
    author: "juddly",
    paragraphs: [
      "Centaurs are overstepping their lines with increasing frequency. They must pay for this disobedience. Perhaps it's time I eliminated them from this system for good.  -XAMEHBZ",
    ],
  },
  {
    id: "mission-centaur-v-human-preserve-ours",
    playerSpecies: "centaur",
    opponentSpecies: "human",
    findingIds: ["delta-aquarii"],
    title: "Preserve What Is Ours",
    location: "Delta Aquarii system",
    author: "juddly",
    paragraphs: [
      "The Humans are moving against one of our outer systems. We must preserve what is ours. These materialists have come far enough. We've seen what they do to a planet. With such short lives, they can simply never reach our weight.",
    ],
  },
  {
    id: "mission-centaur-v-xenite-crush-soulless",
    playerSpecies: "centaur",
    opponentSpecies: "xenite",
    findingIds: ["gamma-leporis"],
    title: "Crush the Soulless",
    location: "Gamma Leporis system",
    author: "juddly",
    paragraphs: [
      "We have given the Xenites far too much respect for far too long. Gamma Leporis is ours. They are tiny insects compared to us. The lines of old are redrawn as befits the victors.",
    ],
  },
  {
    id: "mission-centaur-v-centaur-defeat-rebel-cowards",
    playerSpecies: "centaur",
    opponentSpecies: "centaur",
    findingIds: ["proxima-centauri", "rebel-alliance"],
    title: "Defeat the Centaur Rebel Cowards",
    location: "Proxima Centauri system",
    author: "juddly",
    paragraphs: [
      "It’s time to crush the Centaur Rebel stronghold in Proxima Centauri. These defectors want to join weights with the Humans against the Xenite! This is an unacceptable admission of weakness. We are superior. We do not need the Humans.",
    ],
  },
  {
    id: "mission-ancient-v-human-quiet-humans",
    playerSpecies: "ancient",
    opponentSpecies: "human",
    findingIds: ["ancient-mysteries-human"],
    title: "Quiet the Noisy Humans",
    location: "Sol system",
    author: "juddly",
    paragraphs: [
      "We'll start at the Oort Cloud and push them back in. Typical juvenile behaviour - but it's getting a bit disruptive.",
    ],
  },
  {
    id: "mission-ancient-v-xenite-remind-place",
    playerSpecies: "ancient",
    opponentSpecies: "xenite",
    findingIds: ["ancient-mysteries-xenite"],
    title: "Remind the Xenite Mind of its Place",
    location: "[unknown]",
    author: "juddly",
    paragraphs: [
      "XAMEHBZ needs a reminder of its place in the galaxy. Old and massive it may be - but we are larger. And older.",
    ],
  },
  {
    id: "mission-ancient-v-centaur-quell-centaurs",
    playerSpecies: "ancient",
    opponentSpecies: "centaur",
    findingIds: ["ancient-mysteries-centaur"],
    title: "Quell the Boisterous Centaurs",
    location: "Epsilon Eridani system",
    author: "juddly",
    paragraphs: [
      "Another juvenile species creating far too much noise. They think of themselves as long-lived! The arrogance. Let there be quiet again.",
    ],
  },
];

export function getMissionStoryById(missionId: string): MissionStory | null {
  return MISSION_STORIES.find((mission) => mission.id === missionId) ?? null;
}

export function getMissionPool(
  playerSpecies: MissionSpecies,
  opponentSpecies: MissionOpponentSpecies,
): MissionStory[] {
  return MISSION_STORIES.filter((mission) =>
    mission.playerSpecies === playerSpecies &&
    mission.opponentSpecies === opponentSpecies
  );
}
