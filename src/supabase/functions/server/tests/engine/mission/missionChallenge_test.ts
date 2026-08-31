import assert from "node:assert/strict";
import {
  createMissionChallengeAssignment,
  deterministicBucket,
  ensureMissionChallengeAssignment,
  evaluateMissionChallengeResult,
  getAncientForeignChallengeDefinitions,
  getOrdinaryChallengeDefinitions,
  MISSION_ASSIGNMENT_SALTS,
  MISSION_INTRO_GATE_ENABLED,
  type MissionChallengeAssignment,
  projectMissionChallengeForRequester,
  stripMissionChallengeAssignment,
} from "../../../engine/mission/MissionChallenge.ts";
import {
  getMissionPool,
  MISSION_STORIES,
  MISSION_YEAR,
  type MissionOpponentSpecies,
  type MissionSpecies,
} from "../../../engine/mission/MissionStories.ts";

const MATCHUPS: Array<[MissionSpecies, MissionOpponentSpecies, string[][]]> = [
  [
    "human",
    "human",
    [["sol-1", "rebel-alliance-human"], ["barnards-star"]],
  ],
  ["human", "xenite", [["mintaka"]]],
  ["human", "centaur", [["delta-aquarii"]]],
  ["human", "ancient", [["ancient-mysteries-human"]]],
  ["xenite", "human", [["mintaka"]]],
  ["xenite", "xenite", [["betelgeuse"]]],
  ["xenite", "centaur", [["gamma-leporis"]]],
  ["xenite", "ancient", [["ancient-mysteries-xenite"]]],
  ["centaur", "human", [["delta-aquarii"]]],
  ["centaur", "xenite", [["gamma-leporis"]]],
  [
    "centaur",
    "centaur",
    [["proxima-centauri", "rebel-alliance-centaur"]],
  ],
  ["centaur", "ancient", [["ancient-mysteries-centaur"]]],
  ["ancient", "human", [["ancient-mysteries-human"]]],
  ["ancient", "xenite", [["ancient-mysteries-xenite"]]],
  ["ancient", "centaur", [["ancient-mysteries-centaur"]]],
  ["ancient", "ancient", [["tau-ceti"]]],
];

function findSeedForBucket(
  salt: string,
  bucketCount: number,
  bucket: number,
): string {
  for (let index = 0; index < 10_000; index += 1) {
    const seed = `mission-seed-${index}`;
    if (deterministicBucket(seed, salt, bucketCount) === bucket) return seed;
  }
  throw new Error(`No seed found for bucket ${bucket}`);
}

function computerState(args: {
  gameId?: string;
  playerSpecies?: MissionSpecies;
  opponentSpecies?: MissionOpponentSpecies;
  assignment?: MissionChallengeAssignment;
} = {}) {
  return {
    gameId: args.gameId ?? "mission-game",
    status: "active",
    players: [
      {
        id: "human-player",
        role: "player",
        faction: args.playerSpecies ?? "human",
      },
      {
        id: "computer-player",
        role: "player",
        faction: args.opponentSpecies ?? "xenite",
      },
    ],
    controllersByPlayerId: {
      "human-player": { kind: "human" },
      "computer-player": {
        kind: "bot",
        speciesId: "XEN",
        chosenPlanId: "plan",
      },
    },
    gameData: {
      turnNumber: 1,
      ships: { "human-player": [], "computer-player": [] },
    },
    ...(args.assignment ? { missionChallengeAssignment: args.assignment } : {}),
  };
}

Deno.test("Mission registry has the canonical directional content and Finding coverage", () => {
  assert.equal(MISSION_YEAR, 2814);
  assert.equal(MISSION_STORIES.length, 17);
  assert.equal(new Set(MISSION_STORIES.map((mission) => mission.id)).size, 17);

  for (const [playerSpecies, opponentSpecies, findingIdsByMission] of MATCHUPS) {
    const pool = getMissionPool(playerSpecies, opponentSpecies);
    assert.equal(
      pool.length,
      findingIdsByMission.length,
      `${playerSpecies} v ${opponentSpecies}`,
    );
    assert.deepEqual(
      pool.map((mission) => mission.findingIds),
      findingIdsByMission,
    );
  }

  const humanVsHuman = getMissionPool("human", "human");
  assert.deepEqual(humanVsHuman.map((mission) => mission.id), [
    "mission-human-v-human-eliminate-rebels",
    "mission-human-v-human-defend-against-pirates",
  ]);

  const pirates = MISSION_STORIES.find((mission) =>
    mission.id === "mission-human-v-human-defend-against-pirates"
  );
  assert.deepEqual(pirates, {
    id: "mission-human-v-human-defend-against-pirates",
    playerSpecies: "human",
    opponentSpecies: "human",
    findingIds: ["barnards-star"],
    title: "Defend Against Pirates",
    location: "Barnard's Star",
    author: "juddly",
    paragraphs: [
      "[player], you have been attacked by pirates! Yep - those still exist in 2814. They want your metal. We're still a long way from the safety of Barnard's Star: we must defend ourselves.",
    ],
  });

  const newAncientOpponentMissions = [
    {
      id: "mission-human-v-ancient-protect-home-system",
      playerSpecies: "human",
      opponentSpecies: "ancient",
      findingIds: ["ancient-mysteries-human"],
      title: "Protect Our Home System",
      location: "Sol",
      author: "juddly",
      paragraphs: [
        "[player], strange Ancient ships have surrounded the Sol system. They push inward from the Oort Cloud. How do they harness solar energy? We don't know yet - but they must be stopped before they reach our colonies on the outer planets.",
      ],
    },
    {
      id: "mission-xenite-v-ancient-assert-control",
      playerSpecies: "xenite",
      opponentSpecies: "ancient",
      findingIds: ["ancient-mysteries-xenite"],
      title: "Assert Control",
      location: "[unknown]",
      author: "juddly",
      paragraphs: [
        "The delusional Ancients have become a nuisance in multiple sectors. This is my galaxy. I control. I remember. They fabricate. - XAMEHBZ",
      ],
    },
    {
      id: "mission-centaur-v-ancient-prove-superiority",
      playerSpecies: "centaur",
      opponentSpecies: "ancient",
      findingIds: ["ancient-mysteries-centaur"],
      title: "Prove Our Superiority",
      location: "Epsilon Eridani",
      author: "juddly",
      paragraphs: [
        "Age does not equal power. The Ancients' time has passed. They are weak and should be put back to sleep for good. Solar energy is ephemeral. Centaur weight is forever.",
      ],
    },
    {
      id: "mission-ancient-v-ancient-defy-watchers",
      playerSpecies: "ancient",
      opponentSpecies: "ancient",
      findingIds: ["tau-ceti"],
      title: "Defy the Watchers",
      location: "Tau Ceti",
      author: "juddly",
      paragraphs: [
        "The Watcher Ancients believe we should never intervene in the affairs of the immature species. They would prefer we slumber while Humans, Xenites and Centaurs destroy the galaxy. We must act. Unfortunately, that includes eliminating some of our own.",
      ],
    },
  ];
  for (const expectedMission of newAncientOpponentMissions) {
    assert.deepEqual(
      MISSION_STORIES.find((mission) => mission.id === expectedMission.id),
      expectedMission,
    );
  }

  for (const mission of MISSION_STORIES) {
    assert.equal(mission.author, "juddly");
    assert.ok(mission.id.startsWith("mission-"));
    assert.ok(mission.paragraphs.length > 0);
    assert.ok(mission.paragraphs.every((paragraph) => paragraph.length > 0));
    assert.ok(mission.findingIds.length > 0);
  }

  assert.deepEqual(
    [...new Set(MISSION_STORIES.flatMap((mission) => mission.findingIds))]
      .sort(),
    [
      "ancient-mysteries-centaur",
      "ancient-mysteries-human",
      "ancient-mysteries-xenite",
      "barnards-star",
      "betelgeuse",
      "delta-aquarii",
      "gamma-leporis",
      "mintaka",
      "proxima-centauri",
      "rebel-alliance-centaur",
      "rebel-alliance-human",
      "sol-1",
      "tau-ceti",
    ],
  );
  assert.ok(
    MISSION_STORIES.filter((mission) => mission.findingIds.includes("mintaka"))
      .length > 1,
  );
  assert.equal(
    MISSION_STORIES.filter((mission) =>
      mission.paragraphs.some((text) => text.includes("[player]"))
    ).length,
    5,
  );

  const reclaim = MISSION_STORIES.find((mission) =>
    mission.id === "mission-xenite-v-human-reclaim-purify"
  );
  assert.equal(reclaim?.title, "Reclaim and Purify");
  assert.equal(reclaim?.location, "Mintaka system");
  assert.equal(
    reclaim?.paragraphs[0],
    "The Mintaka system is infected. Humans tear it apart for metal. I must reclaim what was always mine.\n- XAMEHBZ",
  );
  const response = MISSION_STORIES.find((mission) =>
    mission.id === "mission-xenite-v-centaur-respond-arrogance"
  );
  assert.ok(response?.paragraphs[0].endsWith("good.  -XAMEHBZ"));
  const centaur = MISSION_STORIES.find((mission) =>
    mission.id === "mission-centaur-v-centaur-defeat-rebel-cowards"
  );
  assert.ok(centaur?.paragraphs[0].startsWith("It’s time"));
});

Deno.test("Human v Human assignment selects both Mission stories deterministically", () => {
  const pool = getMissionPool("human", "human");
  assert.equal(pool.length, 2);

  for (let bucket = 0; bucket < pool.length; bucket += 1) {
    const gameId = findSeedForBucket(
      MISSION_ASSIGNMENT_SALTS.mission,
      pool.length,
      bucket,
    );
    const first = createMissionChallengeAssignment({
      gameId,
      playerId: "p1",
      playerSpecies: "human",
      opponentSpecies: "human",
    });
    const repeated = createMissionChallengeAssignment({
      gameId,
      playerId: "p1",
      playerSpecies: "human",
      opponentSpecies: "human",
    });

    assert.equal(first.missionId, pool[bucket].id);
    assert.deepEqual(repeated, first);
  }
});

Deno.test("Mission completion hints prefer remaining matchup Missions and fall back safely", () => {
  const twoMissionPool = getMissionPool("human", "human");
  const gameId = findSeedForBucket(
    MISSION_ASSIGNMENT_SALTS.mission,
    twoMissionPool.length,
    0,
  );
  const baseArgs = {
    gameId,
    playerId: "p1",
    playerSpecies: "human" as const,
    opponentSpecies: "human" as const,
  };
  const omitted = createMissionChallengeAssignment(baseArgs);
  const empty = createMissionChallengeAssignment({
    ...baseArgs,
    completedMissionIds: [],
  });
  assert.deepEqual(empty, omitted);

  const preferred = createMissionChallengeAssignment({
    ...baseArgs,
    completedMissionIds: [twoMissionPool[0].id],
  });
  assert.equal(preferred.missionId, twoMissionPool[1].id);
  assert.notEqual(preferred.missionId, omitted.missionId);
  assert.deepEqual(preferred.challenge, omitted.challenge);

  const exhausted = createMissionChallengeAssignment({
    ...baseArgs,
    completedMissionIds: twoMissionPool.map((mission) => mission.id),
  });
  assert.deepEqual(exhausted, omitted);

  const malformedValues: unknown[] = [
    null,
    "not-an-array",
    [null, 4, "", "   ", "foreign-mission", "foreign-mission"],
  ];
  for (const completedMissionIds of malformedValues) {
    assert.deepEqual(
      createMissionChallengeAssignment({ ...baseArgs, completedMissionIds }),
      omitted,
    );
  }
});

Deno.test("completed single-Mission matchups still assign their only Mission", () => {
  const pool = getMissionPool("human", "xenite");
  assert.equal(pool.length, 1);
  const assignment = createMissionChallengeAssignment({
    gameId: "single-mission-completed",
    playerId: "p1",
    playerSpecies: "human",
    opponentSpecies: "xenite",
    completedMissionIds: [pool[0].id],
  });
  assert.equal(assignment.missionId, pool[0].id);
});

Deno.test("ordinary and Ancient foreign challenge pools remain distinct", () => {
  assert.equal(getOrdinaryChallengeDefinitions("human").length, 15);
  assert.equal(getOrdinaryChallengeDefinitions("xenite").length, 17);
  assert.equal(getOrdinaryChallengeDefinitions("centaur").length, 15);
  assert.equal(getOrdinaryChallengeDefinitions("ancient").length, 7);

  const ordinaryXeniteIds = getOrdinaryChallengeDefinitions("xenite").map((
    definition,
  ) => definition.id);
  assert.ok(ordinaryXeniteIds.includes("OXI"));
  assert.ok(ordinaryXeniteIds.includes("AST"));
  assert.ok(
    getOrdinaryChallengeDefinitions("ancient").every((definition) =>
      definition.shipType === "Basic"
    ),
  );

  for (const species of ["human", "xenite", "centaur"] as const) {
    const pool = getAncientForeignChallengeDefinitions(species);
    assert.equal(pool.length, 15);
    assert.ok(
      pool.every((definition) => definition.species.toLowerCase() === species),
    );
    assert.ok(
      pool.every((definition) =>
        definition.shipType === "Basic" || definition.shipType === "Upgraded"
      ),
    );
  }
  const foreignXeniteIds = getAncientForeignChallengeDefinitions("xenite").map((
    definition,
  ) => definition.id);
  assert.equal(foreignXeniteIds.includes("OXI"), false);
  assert.equal(foreignXeniteIds.includes("AST"), false);
});

Deno.test("Ancient assignment uses an exact deterministic foreign bucket and independent target rules", () => {
  const foreignSeed = findSeedForBucket(
    MISSION_ASSIGNMENT_SALTS.ancientForeignBranch,
    4,
    0,
  );
  const foreign = createMissionChallengeAssignment({
    gameId: foreignSeed,
    playerId: "p1",
    playerSpecies: "ancient",
    opponentSpecies: "xenite",
  });
  assert.equal(foreign.challenge.condition, "with");
  assert.ok(
    getAncientForeignChallengeDefinitions("xenite").some((definition) =>
      definition.id === foreign.challenge.shipDefId
    ),
  );

  for (const bucket of [1, 2, 3]) {
    const ownSeed = findSeedForBucket(
      MISSION_ASSIGNMENT_SALTS.ancientForeignBranch,
      4,
      bucket,
    );
    const own = createMissionChallengeAssignment({
      gameId: ownSeed,
      playerId: "p1",
      playerSpecies: "ancient",
      opponentSpecies: "human",
    });
    assert.ok(
      getOrdinaryChallengeDefinitions("ancient").some((definition) =>
        definition.id === own.challenge.shipDefId
      ),
    );
  }

  const ownWithSeed = Array.from(
    { length: 10_000 },
    (_, index) => `ancient-with-${index}`,
  ).find((seed) =>
    deterministicBucket(
        seed,
        MISSION_ASSIGNMENT_SALTS.ancientForeignBranch,
        4,
      ) !== 0 &&
    deterministicBucket(
        seed,
        MISSION_ASSIGNMENT_SALTS.challengeCondition,
        2,
      ) === 0
  );
  const ownWithoutSeed = Array.from(
    { length: 10_000 },
    (_, index) => `ancient-without-${index}`,
  ).find((seed) =>
    deterministicBucket(
        seed,
        MISSION_ASSIGNMENT_SALTS.ancientForeignBranch,
        4,
      ) !== 0 &&
    deterministicBucket(
        seed,
        MISSION_ASSIGNMENT_SALTS.challengeCondition,
        2,
      ) === 1
  );
  assert.ok(ownWithSeed);
  assert.ok(ownWithoutSeed);
  assert.equal(
    createMissionChallengeAssignment({
      gameId: ownWithSeed!,
      playerId: "p1",
      playerSpecies: "ancient",
      opponentSpecies: "human",
    }).challenge.condition,
    "with",
  );
  assert.equal(
    createMissionChallengeAssignment({
      gameId: ownWithoutSeed!,
      playerId: "p1",
      playerSpecies: "ancient",
      opponentSpecies: "human",
    }).challenge.condition,
    "without",
  );
});

Deno.test("Ancient v Ancient uses the ordinary Ancient challenge path", () => {
  const ancientVsAncientSeed = Array.from(
    { length: 10_000 },
    (_, index) => `ancient-v-ancient-${index}`,
  ).find((seed) =>
    deterministicBucket(
        seed,
        MISSION_ASSIGNMENT_SALTS.ancientForeignBranch,
        4,
      ) === 0 &&
    deterministicBucket(
        seed,
        MISSION_ASSIGNMENT_SALTS.challengeCondition,
        2,
      ) === 1
  );
  assert.ok(ancientVsAncientSeed);

  const assignment = createMissionChallengeAssignment({
    gameId: ancientVsAncientSeed,
    playerId: "p1",
    playerSpecies: "ancient",
    opponentSpecies: "ancient",
  });
  assert.equal(assignment.challenge.condition, "without");
  assert.ok(
    getOrdinaryChallengeDefinitions("ancient").some((definition) =>
      definition.id === assignment.challenge.shipDefId
    ),
  );
});

Deno.test("assignment covers every matchup and strict ensure reconstructs but never replaces", () => {
  assert.equal(MISSION_INTRO_GATE_ENABLED, true);

  for (const [playerSpecies, opponentSpecies] of MATCHUPS) {
    const first = createMissionChallengeAssignment({
      gameId: "stable-game",
      playerId: "p1",
      playerSpecies,
      opponentSpecies,
    });
    const repeated = createMissionChallengeAssignment({
      gameId: "stable-game",
      playerId: "p1",
      playerSpecies,
      opponentSpecies,
    });
    assert.deepEqual(repeated, first);
    assert.equal(first.introPending, true);
    assert.equal(
      getMissionPool(playerSpecies, opponentSpecies).some((mission) =>
        mission.id === first.missionId
      ),
      true,
    );
  }

  const missing = computerState();
  const recovered = ensureMissionChallengeAssignment(missing);
  assert.ok(recovered.missionChallengeAssignment);
  assert.deepEqual(
    recovered.missionChallengeAssignment,
    createMissionChallengeAssignment({
      gameId: "mission-game",
      playerId: "human-player",
      playerSpecies: "human",
      opponentSpecies: "xenite",
    }),
  );

  const existing: MissionChallengeAssignment = {
    playerId: "human-player",
    missionId: "legacy-stable-id",
    challenge: { shipDefId: "DEF", condition: "without" },
    introPending: false,
  };
  const withExisting = computerState({ assignment: existing });
  const preserved = ensureMissionChallengeAssignment(withExisting);
  assert.strictEqual(preserved, withExisting);
  assert.strictEqual(preserved.missionChallengeAssignment, existing);

  const multiplayer = { ...computerState(), controllersByPlayerId: undefined };
  assert.strictEqual(
    ensureMissionChallengeAssignment(multiplayer),
    multiplayer,
  );
});

Deno.test("finished results use only winner truth and the assigned active final fleet", () => {
  const assignment: MissionChallengeAssignment = {
    playerId: "human-player",
    missionId: MISSION_STORIES[0].id,
    challenge: { shipDefId: "DEF", condition: "with" },
    introPending: false,
  };
  const base = computerState({ assignment });
  const finished = {
    ...base,
    status: "finished" as const,
    winnerPlayerId: "human-player",
    gameData: {
      ...base.gameData,
      ships: {
        "human-player": [{ instanceId: "foreign-or-owned", shipDefId: "DEF" }],
        "computer-player": [],
      },
      voidShipsByPlayerId: {
        "human-player": [{ instanceId: "void-def", shipDefId: "DEF" }],
      },
    },
  };
  assert.deepEqual(evaluateMissionChallengeResult(finished, assignment), {
    missionSucceeded: true,
    fleetConditionMet: true,
    challengeSucceeded: true,
  });
  assert.equal(
    evaluateMissionChallengeResult({
      ...finished,
      winnerPlayerId: "computer-player",
    }, assignment)?.challengeSucceeded,
    false,
  );
  assert.equal(
    evaluateMissionChallengeResult(
      { ...finished, winnerPlayerId: null },
      assignment,
    )?.missionSucceeded,
    false,
  );
  assert.equal(
    evaluateMissionChallengeResult({
      ...finished,
      gameData: {
        ...finished.gameData,
        ships: { "human-player": [], "computer-player": [] },
      },
    }, assignment)?.fleetConditionMet,
    false,
  );

  const withoutAssignment = {
    ...assignment,
    challenge: { shipDefId: "DEF", condition: "without" as const },
  };
  assert.equal(
    evaluateMissionChallengeResult(finished, withoutAssignment)
      ?.fleetConditionMet,
    false,
  );
  assert.equal(
    evaluateMissionChallengeResult({
      ...finished,
      gameData: {
        ...finished.gameData,
        ships: { "human-player": [], "computer-player": [] },
      },
    }, withoutAssignment)?.challengeSucceeded,
    true,
  );
  assert.equal(
    evaluateMissionChallengeResult(
      { ...finished, status: "active" },
      assignment,
    ),
    null,
  );

  for (
    const resultReason of [
      "decisive",
      "narrow",
      "mutual_destruction",
      "resignation",
      "timeout",
      "timeout_draw",
      "agreement",
    ] as const
  ) {
    assert.deepEqual(
      evaluateMissionChallengeResult(
        { ...finished, resultReason } as any,
        assignment,
      ),
      evaluateMissionChallengeResult(finished, assignment),
    );
  }

  const ancientForeignAssignment: MissionChallengeAssignment = {
    playerId: "human-player",
    missionId: "mission-ancient-v-xenite-remind-place",
    challenge: { shipDefId: "XEN", condition: "with" },
    introPending: false,
  };
  const ancientForeignFinalFleet = {
    ...finished,
    gameData: {
      ...finished.gameData,
      ships: {
        "human-player": [{ instanceId: "copied-xenite", shipDefId: "XEN" }],
        "computer-player": [],
      },
    },
  };
  assert.equal(
    evaluateMissionChallengeResult(
      ancientForeignFinalFleet,
      ancientForeignAssignment,
    )?.challengeSucceeded,
    true,
  );
  assert.equal(
    evaluateMissionChallengeResult({
      ...ancientForeignFinalFleet,
      gameData: {
        ...ancientForeignFinalFleet.gameData,
        ships: { "human-player": [], "computer-player": [] },
        voidShipsByPlayerId: {
          "human-player": [{ instanceId: "destroyed-copy", shipDefId: "XEN" }],
        },
      },
    }, ancientForeignAssignment)?.fleetConditionMet,
    false,
  );
});

Deno.test("projection resolves personal content while structural stripping removes canonical assignment", () => {
  const assigned = ensureMissionChallengeAssignment(computerState());
  const projection = projectMissionChallengeForRequester(
    assigned,
    "human-player",
  );
  assert.equal(projection?.mission.year, 2814);
  assert.equal(projection?.mission.author, "juddly");
  assert.equal(projection?.introPending, true);

  const persistedAcknowledged = {
    ...assigned,
    missionChallengeAssignment: {
      ...assigned.missionChallengeAssignment,
      introPending: false,
    },
  };
  assert.equal(
    projectMissionChallengeForRequester(
      persistedAcknowledged,
      "human-player",
    )?.introPending,
    false,
  );
  assert.equal(
    projectMissionChallengeForRequester(assigned, "computer-player"),
    null,
  );

  const spectatorState = {
    ...assigned,
    players: [...assigned.players, { id: "spectator", role: "spectator" }],
  };
  assert.equal(
    projectMissionChallengeForRequester(spectatorState, "spectator"),
    null,
  );
  const stripped = stripMissionChallengeAssignment(assigned);
  assert.equal("missionChallengeAssignment" in stripped, false);
  assert.ok("missionChallengeAssignment" in assigned);
});
