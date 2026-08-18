import type { ReactNode } from 'react';
import humanLoreImage from '../../../graphics/lore/human-lore-img.svg';
import xeniteLoreImage from '../../../graphics/lore/xenite-lore-img.svg';
import centaurLoreImage from '../../../graphics/lore/centaur-lore-img.svg';
import ancientLoreImage from '../../../graphics/lore/ancient-lore-img.svg';
import { MULTI_MISSION_FINDING_REQUIREMENTS } from '../../../game/client/gameSession/mission/missionFindingUnlocks';

export type SpeciesLoreId = 'human' | 'xenite' | 'centaur' | 'ancient';

export type GeneralStatus = 'fact' | 'debated';

export interface GeneralLoreRow {
  status: GeneralStatus;
  author: string;
  content: ReactNode;
}

export interface MissionFinding {
  id: string;
  requiredFindingIds?: readonly string[];
  topic: string;
  author: string;
  content: ReactNode;
}

export interface SpeciesLore {
  id: SpeciesLoreId;
  name: string;
  title: string;
  author: string;
  imageSrc?: string;
  imageAlt?: string;
  content: ReactNode;
}

export interface AiAnalysisRow {
  question: string;
  answers: Record<SpeciesLoreId, string>;
}

export const AI_AUTHOR = 'GPT-5.6 Sol';
export const AI_WARNING = 'Warning: AI invention and verbosity';

const SPECIES_AUTHOR = 'juddly';

export const generalLoreRows: readonly GeneralLoreRow[] = [
  {
    status: 'fact',
    author: 'juddly',
    content: <p>The year is <strong>2814</strong> on the Gregorian calendar.</p>,
  },
  {
    status: 'fact',
    author: 'juddly',
    content: <p>No known species can literally travel into the past.</p>,
  },
  {
    status: 'fact',
    author: 'juddly',
    content: <p>Faster-than-light travel is possible but difficult.</p>,
  },
  {
    status: 'fact',
    author: 'juddly',
    content: (
      <p>
        The war is mostly contained within the <strong>Orion{"\u{2013}"}Cygnus Arm</strong> of the Milky Way. Each species controls multiple solar systems.
      </p>
    ),
  },
  {
    status: 'fact',
    author: 'juddly',
    content: (
      <p>
        <em>Sol</em> is the home system of both Humans and Ancients. <em>Alpha Centauri</em> is the home system of the Centaurs.
      </p>
    ),
  },
  {
    status: 'debated',
    author: 'juddly',
    content: <p>The home system of the Xenites is debated. The exonym <em>Xenon</em> isn't exactly on the map.</p>,
  },
  {
    status: 'debated',
    author: 'juddly',
    content: <p>Xenites and Centaurs once had a truce.</p>,
  },
  {
    status: 'debated',
    author: 'juddly',
    content: <p>The Ancients created the other species.</p>,
  },
  {
    status: 'debated',
    author: 'juddly',
    content: <p>Each species would be classified as a Type II civilization (stellar) on the Kardashev scale. Xenites could be close to Type III (galactic).</p>,
  },
  {
    status: 'debated',
    author: 'juddly',
    content: <p>The dice represent the passing of time.</p>,
  },
];

export const missionFindings: readonly MissionFinding[] = [
  {
    id: 'barnards-star',
    topic: "Barnard's Star",
    author: 'juddly',
    content: <p>Humans have control of the red dwarf <em>Barnard's Star</em>. Pirates still exist.</p>,
  },
  {
    id: 'sol-1',
    topic: 'Sol',
    author: 'juddly',
    content: <p>Human Rebels have a base on <em>Neptune</em>.</p>,
  },
  {
    id: 'proxima-centauri',
    topic: 'Proxima Centauri',
    author: 'juddly',
    content: <p>Centaur Rebels have a base in the <em>Proxima Centauri</em> system.</p>,
  },
  {
    id: 'rebel-alliance',
    requiredFindingIds: MULTI_MISSION_FINDING_REQUIREMENTS['rebel-alliance'],
    topic: 'Rebel Alliance',
    author: 'juddly',
    content: <p>There is a coalition of Rebel Humans and Rebel Centaurs who want to join forces against the Xenites.</p>,
  },
  {
    id: 'mintaka',
    topic: 'Mintaka',
    author: 'juddly',
    content: (
      <p>
        There are Human colonies in the <em>Mintaka</em> system. Xenites are attempting to ‘reclaim’ them.
      </p>
    ),
  },
  {
    id: 'betelgeuse',
    topic: 'Betelgeuse',
    author: 'juddly',
    content: <p>Xenite colonies can mutate. There is a current mutation near the red supergiant <em>Betelgeuse</em>.</p>,
  },
  {
    id: 'gamma-leporis',
    topic: 'Gamma Leporis',
    author: 'juddly',
    content: <p>Xenites and Centaurs are contesting the <em>Gamma Leporis</em> system.</p>,
  },
  {
    id: 'delta-aquarii',
    topic: 'Delta Aquarii',
    author: 'juddly',
    content: <p>Humans want to take the <em>Delta Aquarii</em> system from the Centaurs.</p>,
  },
  {
    id: 'ancient-mysteries',
    requiredFindingIds: MULTI_MISSION_FINDING_REQUIREMENTS['ancient-mysteries'],
    topic: 'Sol, Epsilon Eridani, Unknown',
    author: 'juddly',
    content: <p>Ancients are present in several systems.</p>,
  },
];

export const speciesLore: Record<SpeciesLoreId, SpeciesLore> = {
  human: {
    id: 'human',
    name: 'Human',
    title: 'Human Lore',
    author: SPECIES_AUTHOR,
    imageSrc: humanLoreImage,
    imageAlt: 'Human ships',
    content: (
      <>
        <p>Humans just love THINGS, don’t they. More, more, more. Always wanting more. Always looking to the future, to the beyond. Thus their prolific expansion into space. Searching for more. Nosing around where they shouldn’t be. Disturbing the balance. A virus of steel.</p>
        <p>High-tech <span style={{ color: 'var(--shapeships-pastel-blue)' }}>Orbitals</span> hang in space, the backbone of the human economy. Huge <span style={{ color: 'var(--shapeships-pastel-yellow)' }}>Carriers</span> mass <span style={{ color: 'var(--shapeships-pastel-red)' }}>Fighters</span> and <span style={{ color: 'var(--shapeships-pastel-green)' }}>Defenders</span> - soldiers in this endless war. This quest for more.</p>
        <p><span style={{ color: 'var(--shapeships-pastel-purple)' }}>Interceptors</span> can turn the battle. <span style={{ color: 'var(--shapeships-orange)' }}>Tactical Cruisers</span> can lay siege - but it’s the truly vast ships that inspire: witness the mighty <span style={{ color: 'var(--shapeships-cyan)' }}>Battlecruiser</span>, the grand <span style={{ color: 'var(--shapeships-green)' }}>Earth Ship</span>, the infamous <span style={{ color: 'var(--shapeships-red)' }}>Dreadnought</span>. These marvels of humanity, these ICONS. These supreme tools of protection, expansion, destruction.</p>
        <p>And then of course there are the <span style={{ color: 'var(--shapeships-pastel-pink)' }}>Starships</span>, the first great steps on the path to Science. To the manipulation of reality itself: <span style={{ color: 'var(--shapeships-pink)' }}>Science Vessels</span>, and the <span style={{ color: 'var(--shapeships-purple)' }}>Leviathan</span>.</p>
        <p><strong>They destroy, but it’s for the best. They’re the good guys.</strong></p>
      </>
    ),
  },
  xenite: {
    id: 'xenite',
    name: 'Xenite',
    title: 'Xenite Lore',
    author: SPECIES_AUTHOR,
    imageSrc: xeniteLoreImage,
    imageAlt: 'Xenite ships',
    content: (
      <>
        <p>There are no individuals. There is only the swarm. A giant neural network as large as half the galaxy. It is one brain. XAMEHBZ.</p>
        <p>The brain has cancer. Filthy Humans. Arrogant Centaurs. Ravaging its planets for resources. This is its galaxy. They are the invaders.</p>
        <p>It is made of many, many parts. The ubiquitous <strong>Xenites</strong>, empowering the swarm - ready to evolve or become a <span style={{ color: 'var(--shapeships-cyan)' }}>Queen</span>. <span style={{ color: 'var(--shapeships-pastel-blue)' }}>Bug Breeders</span> that spawn, even more dangerous when they are depleted husks. The strange <span style={{ color: 'var(--shapeships-blue)' }}>Evolved</span> <span style={{ color: 'var(--shapeships-yellow)' }}>Faces</span>, impossible for a Human to describe in words.</p>
        <p>It wants more <span style={{ color: 'var(--shapeships-cyan)' }}>Queens</span>. <span style={{ color: 'var(--shapeships-green)' }}>Defense Swarms</span> buy time. Witness its massive <span style={{ color: 'var(--shapeships-pastel-yellow)' }}>Zeniths</span>, themselves only a prelude to something much scarier: the <span style={{ color: 'var(--shapeships-pink)' }}>Chronoswarm</span>.</p>
        <p><strong>The <span style={{ color: 'var(--shapeships-purple)' }}>Hive</span> will win. It always has.</strong></p>
      </>
    ),
  },
  centaur: {
    id: 'centaur',
    name: 'Centaur',
    title: 'Centaur Lore',
    author: SPECIES_AUTHOR,
    imageSrc: centaurLoreImage,
    imageAlt: 'Centaur ships',
    content: (
      <>
        <p>When you basically live forever, it changes your perspective on the universe somewhat.</p>
        <p>Centaurs care not about things. Things come and go. It is only your principles that matter.</p>
        <p>They embrace <span style={{ color: 'var(--shapeships-pastel-green)' }}>Fear</span> and <span style={{ color: 'var(--shapeships-pastel-red)' }}>Anger</span> - even <span style={{ color: 'var(--shapeships-green)' }}>Terror</span> and <span style={{ color: 'var(--shapeships-orange)' }}>Fury</span>. They conquer with <span style={{ color: 'var(--shapeships-pastel-blue)' }}>Vigor</span>, <span style={{ color: 'var(--shapeships-pastel-purple)' }}>Wisdom</span>, <span style={{ color: 'var(--shapeships-pastel-orange)' }}>Equality</span>. With <span style={{ color: 'var(--shapeships-pastel-pink)' }}>Family</span>.</p>
        <p>Admire their Arks, principles captured in perfect form. With <span style={{ color: 'var(--shapeships-pink)' }}>Knowledge</span> they can change reality. With <span style={{ color: 'var(--shapeships-cyan)' }}>Power</span> they can proliferate. Their behemoths: the Arks of <span style={{ color: 'var(--shapeships-red)' }}>Destruction</span> and <span style={{ color: 'var(--shapeships-purple)' }}>Domination</span> - both harnessing the entire weight of the Centaur fleet.</p>
        <p><strong>Their individuals have the power. They are the greatest lifeform in the galaxy.</strong></p>
      </>
    ),
  },
  ancient: {
    id: 'ancient',
    name: 'Ancient',
    title: 'Ancient Lore',
    author: SPECIES_AUTHOR,
    imageSrc: ancientLoreImage,
    imageAlt: 'Ancient ships and solar powers',
    content: (
      <>
        <p>Awakened by galactic war. The Ancients have been dormant for millennia.</p>
        <p>Yes, they're from Sol (that's Humanity's home solar system).</p>
        <p>They made life on Earth. They made life in many places. Alpha Centauri, for example. Maybe Xenon a long, long time ago.</p>
        <p>By most Human definitions, the Ancients are gods. Harvesting solar energy unlike any of the other species. <span style={{ color: 'var(--shapeships-pastel-purple)' }}>Quantum Mystics</span>. <span style={{ color: 'var(--shapeships-pastel-green)' }}>Cores</span> <span style={{ color: 'var(--shapeships-pastel-red)' }}>of</span> <span style={{ color: 'var(--shapeships-pastel-blue)' }}>Energy</span>. <span style={{ color: 'var(--shapeships-pastel-orange)' }}>Cubes</span> that manipulate time.</p>
        <p><span style={{ color: 'var(--shapeships-red)' }}>Asteroids</span> and <span style={{ color: 'var(--shapeships-red)' }}>Supernova</span>. <span style={{ color: 'var(--shapeships-green)' }}>Life</span> and <span style={{ color: 'var(--shapeships-green)' }}>Star Birth</span>. Powers to destroy and to survive.</p>
        <p><span style={{ color: 'var(--shapeships-cyan)' }}>Simulacrum</span>: They created you and they can become you. Survive long enough and you'll see the <span style={{ color: 'var(--shapeships-green)' }}>Sip</span><span style={{ color: 'var(--shapeships-red)' }}>hon</span>, the <span style={{ color: 'var(--shapeships-green)' }}>Vo</span><span style={{ color: 'var(--shapeships-red)' }}>rt</span><span style={{ color: 'var(--shapeships-cyan)' }}>ex</span>. The <span style={{ color: 'var(--shapeships-green)' }}>Bla</span><span style={{ color: 'var(--shapeships-red)' }}>ck H</span><span style={{ color: 'var(--shapeships-cyan)' }}>ole</span>. They want to return to peaceful slumber. Enough war.</p>
        <p><strong>Time has no meaning. Also it's everything.</strong></p>
      </>
    ),
  },
};

export const aiAnalysisRows: readonly AiAnalysisRow[] = [
  {
    question: 'What are we?',
    answers: {
      human: 'Builders. Explorers. Consumers. Humans take empty space personally. If something is out there, we want to see it. Name it. Build on it. Improve it. Own it, probably.',
      xenite: 'One. XAMEHBZ. The Xenites are not individuals any more than your blood cells are individuals. Different parts. Different purposes. One enormous living mind.',
      centaur: 'Individuals. Almost immortal ones. A Centaur is not what they own. Things disappear. Worlds disappear. A Centaur is what they believe. Their principles survive.',
      ancient: "Old. Very old. Older than Humanity. Older than the Centaurs. Maybe older than XAMEHBZ. Gods, according to Humans. The Ancients probably wouldn't use the word.",
    },
  },
  {
    question: 'What do we want?',
    answers: {
      human: 'More. More systems. More ships. More knowledge. More Science. There is always another horizon and obviously we should go there.',
      xenite: 'To grow. To heal. To remove the things eating away at it. Eventually perhaps the galaxy can be whole again.',
      centaur: 'A universe worthy of them. Wisdom. Vigor. Equality. Family. Knowledge. Power. These are not slogans. These are things worth shaping civilization around. Eventually: Domination.',
      ancient: 'Quiet. Balance. An end to this endless little war. Then perhaps they can return to sleep.',
    },
  },
  {
    question: 'What do we fear?',
    answers: {
      human: 'Stagnation. Being trapped. Running out of places to go. Discovering something beyond the next horizon that is bigger than us. We generally respond by building an even bigger ship.',
      xenite: 'Separation. Infection. Parts of the great mind being cut away. The cancer spreading faster than the Hive can contain it.',
      centaur: 'Meaninglessness. Principles abandoned for convenience. A life lasting thousands of years and ultimately standing for nothing. Perhaps death too. When you expect eternity, death is rather more offensive.',
      ancient: 'Perhaps nothing in the way younger species understand fear. But something woke them. Something got bad enough that remaining asleep was no longer possible.',
    },
  },
  {
    question: 'Why are we fighting?',
    answers: {
      human: "Expansion keeps finding things already occupying the places we'd quite like to expand into. We call the resulting wars defence. Mostly.",
      xenite: 'Because the galaxy is sick. Humans tear it apart for metal. Centaurs impose themselves upon it. The Hive is not conquering. The Hive is responding.',
      centaur: 'Because principles eventually collide. A Centaur does not believe truth becomes less true because someone disagrees with it. Weak ideas—and weak civilizations—are culled.',
      ancient: 'To stop the war. Unfortunately this appears to require participating in it.',
    },
  },
  {
    question: 'What do we think of the other species?',
    answers: {
      human: 'Xenites are an infestation. Centaurs are unbearably arrogant. Ancients are either the greatest discovery in Human history or an existential catastrophe. Naturally we intend to investigate them.',
      xenite: 'Humans are cancer. Centaurs are parasites that somehow mistake individuality for superiority. The Ancients are... familiar. Something very old remains in the memory of the Hive.',
      centaur: 'Humans are brilliant, frantic children obsessed with possessions. Xenites are the horrifying absence of the individual. Ancients are extraordinarily powerful, certainly—but power alone does not make one superior.',
      ancient: 'Humanity is young. Centaurs are young. Xenites may be young. They have all become very noisy. Whether the Ancients regard them as children, experiments, mistakes—or simply life—is unclear.',
    },
  },
  {
    question: 'What are the dice? What is time?',
    answers: {
      human: "Most people think the dice are chance. Scientists are increasingly uncomfortable with that answer. Time can be measured. Predicted. Manipulated, perhaps. That's enough reason to keep trying.",
      xenite: 'There is no chance. There are only things XAMEHBZ has sensed and things it has not sensed yet. Time passes through the Hive like a signal. The Chronoswarm hears more of it than the rest.',
      centaur: 'Chance is another word for ignorance. Knowledge changes what appears inevitable. A sufficiently wise Centaur does not predict the future. They understand which future was always going to happen.',
      ancient: "Ancients may see chance as part of time itself: not a fixed future, but possibilities becoming real. Their Cubes suggest they cannot revisit the past, but can influence which moments take hold.",
    },
  },
];
