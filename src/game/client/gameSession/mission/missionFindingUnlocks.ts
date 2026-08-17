export interface MissionFindingUnlockDefinition {
  id: string;
  requiredFindingIds?: readonly string[];
}

export const MULTI_MISSION_FINDING_REQUIREMENTS = {
  'rebel-alliance': [
    'rebel-alliance-human',
    'rebel-alliance-centaur',
  ],
  'ancient-mysteries': [
    'ancient-mysteries-human',
    'ancient-mysteries-xenite',
    'ancient-mysteries-centaur',
  ],
} as const satisfies Record<string, readonly string[]>;

const groupedFindingIds = new Set<string>([
  ...Object.keys(MULTI_MISSION_FINDING_REQUIREMENTS),
  ...Object.values(MULTI_MISSION_FINDING_REQUIREMENTS).flat(),
]);

export function isMissionFindingUnlocked(
  finding: MissionFindingUnlockDefinition,
  seenFindingIds: ReadonlySet<string>,
): boolean {
  const requiredFindingIds = finding.requiredFindingIds ?? [finding.id];
  return requiredFindingIds.every((findingId) => seenFindingIds.has(findingId));
}

export function didUnlockAnyMissionFinding(
  previousSeenFindingIds: ReadonlySet<string>,
  seenFindingIds: ReadonlySet<string>,
): boolean {
  const unlockedSingleIdFinding = Array.from(seenFindingIds).some(
    (findingId) =>
      !previousSeenFindingIds.has(findingId) && !groupedFindingIds.has(findingId),
  );
  if (unlockedSingleIdFinding) return true;

  return Object.entries(MULTI_MISSION_FINDING_REQUIREMENTS).some(
    ([id, requiredFindingIds]) => {
      const finding = { id, requiredFindingIds };
      return (
        !isMissionFindingUnlocked(finding, previousSeenFindingIds) &&
        isMissionFindingUnlocked(finding, seenFindingIds)
      );
    },
  );
}
