import { getShipById } from "../../engine_shared/defs/ShipDefinitions.core.ts";
import type {
  BuildSubmitPayload,
  EvolverBuildChoiceEntry,
} from "./IntentTypes.ts";
import { RejectionCode } from "./IntentTypes.ts";

export const MAX_BUILD_COUNT = 50;

export type BuildSubmitPayloadValidationResult =
  | { ok: true; payload: BuildSubmitPayload }
  | {
    ok: false;
    code: typeof RejectionCode.BAD_PAYLOAD | typeof RejectionCode.INVALID_SHIP;
    message: string;
  };

function countFleetShipsByDefId(
  state: any,
  playerId: string,
  shipDefId: string,
): number {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  let count = 0;
  for (const ship of fleet) {
    if (ship?.shipDefId === shipDefId) count++;
  }
  return count;
}

function validateEvolverChoicesPayload(
  payload: BuildSubmitPayload,
  totalEvolverCount: number,
  totalXenCount: number,
):
  | { ok: true; choices: EvolverBuildChoiceEntry[] }
  | { ok: false; message: string } {
  if (payload.evolverChoices === undefined) {
    return { ok: true, choices: [] };
  }

  if (!Array.isArray(payload.evolverChoices)) {
    return {
      ok: false,
      message: "Invalid build payload: evolverChoices must be an array",
    };
  }

  if (payload.evolverChoices.length > totalEvolverCount) {
    return {
      ok: false,
      message:
        `Invalid evolverChoices length: expected at most ${totalEvolverCount}, got ${payload.evolverChoices.length}`,
    };
  }

  const seenSourceKeys = new Set<string>();
  let nonHoldCount = 0;
  for (const entry of payload.evolverChoices) {
    if (!entry || typeof entry !== "object") {
      return {
        ok: false,
        message: "Invalid evolverChoices entry: expected object",
      };
    }
    if (typeof entry.sourceKey !== "string" || entry.sourceKey.trim() === "") {
      return {
        ok: false,
        message:
          "Invalid evolverChoices entry: sourceKey must be a non-empty string",
      };
    }
    if (seenSourceKeys.has(entry.sourceKey)) {
      return {
        ok: false,
        message: `Duplicate evolverChoices sourceKey: ${entry.sourceKey}`,
      };
    }
    seenSourceKeys.add(entry.sourceKey);
    if (
      entry.choiceId !== "hold" && entry.choiceId !== "oxite" &&
      entry.choiceId !== "asterite"
    ) {
      return {
        ok: false,
        message: `Invalid evolver choiceId: ${
          String((entry as any).choiceId)
        }. Must be hold, oxite, or asterite.`,
      };
    }
    if (entry.choiceId !== "hold") nonHoldCount++;
  }

  if (nonHoldCount > totalXenCount) {
    return {
      ok: false,
      message:
        `Invalid evolverChoices: requested ${nonHoldCount} conversions but only ${totalXenCount} Xenite(s) are available.`,
    };
  }
  return { ok: true, choices: payload.evolverChoices };
}

function validateSelectedNumberArray(args: {
  raw: unknown;
  expectedCount: number;
  fieldName: string;
  required: boolean;
}): { ok: true } | { ok: false; message: string } {
  const { raw, expectedCount, fieldName, required } = args;
  if (typeof raw === "undefined") {
    return required
      ? {
        ok: false,
        message: `Invalid build payload: ${fieldName} is required`,
      }
      : { ok: true };
  }
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      message: `Invalid build payload: ${fieldName} must be an array`,
    };
  }
  if (raw.length !== expectedCount) {
    return {
      ok: false,
      message:
        `Invalid ${fieldName} length: expected ${expectedCount}, got ${raw.length}`,
    };
  }
  for (const selectedNumber of raw) {
    if (
      !Number.isInteger(selectedNumber) || selectedNumber < 1 ||
      selectedNumber > 6
    ) {
      return {
        ok: false,
        message:
          `Invalid ${fieldName} entry: ${selectedNumber}. Must be integer 1..6`,
      };
    }
  }
  return { ok: true };
}

export function validateBuildSubmitPayload(args: {
  state: any;
  playerId: string;
  payload: unknown;
}): BuildSubmitPayloadValidationResult {
  if (
    !args.payload || typeof args.payload !== "object" ||
    !Array.isArray((args.payload as any).builds)
  ) {
    return {
      ok: false,
      code: RejectionCode.BAD_PAYLOAD,
      message: "Invalid build payload: must have builds array",
    };
  }

  const payload = args.payload as BuildSubmitPayload;
  for (const build of payload.builds) {
    if (
      !build || typeof build !== "object" ||
      !build.shipDefId || typeof build.shipDefId !== "string"
    ) {
      return {
        ok: false,
        code: RejectionCode.INVALID_SHIP,
        message: "Each build must have a valid shipDefId",
      };
    }
    if (!getShipById(build.shipDefId)) {
      return {
        ok: false,
        code: RejectionCode.INVALID_SHIP,
        message: `Unknown shipDefId: ${build.shipDefId}`,
      };
    }
    if (build.shipDefId === "OXI" || build.shipDefId === "AST") {
      return {
        ok: false,
        code: RejectionCode.BAD_PAYLOAD,
        message:
          "Invalid build payload: OXI and AST cannot be built directly; use Evolver conversion.",
      };
    }
    if (!Number.isInteger(build.count) || build.count < 1) {
      return {
        ok: false,
        code: RejectionCode.BAD_PAYLOAD,
        message:
          `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be positive integer.`,
      };
    }
    if (build.count > MAX_BUILD_COUNT) {
      return {
        ok: false,
        code: RejectionCode.BAD_PAYLOAD,
        message:
          `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be 1..${MAX_BUILD_COUNT}`,
      };
    }
  }

  const frigateBuildCount = payload.builds
    .filter((build) => build.shipDefId === "FRI")
    .reduce((sum, build) => sum + (build.count ?? 0), 0);
  const frigateValidation = validateSelectedNumberArray({
    raw: payload.frigateTriggers,
    expectedCount: frigateBuildCount,
    fieldName: "frigateTriggers",
    required: false,
  });
  if (!frigateValidation.ok) {
    return {
      ok: false,
      code: RejectionCode.BAD_PAYLOAD,
      message: frigateValidation.message,
    };
  }

  const quantumBuildCount = payload.builds
    .filter((build) => build.shipDefId === "QUA")
    .reduce((sum, build) => sum + (build.count ?? 0), 0);
  const quantumValidation = validateSelectedNumberArray({
    raw: payload.quantumMysticSelections,
    expectedCount: quantumBuildCount,
    fieldName: "quantumMysticSelections",
    required: quantumBuildCount > 0,
  });
  if (!quantumValidation.ok) {
    return {
      ok: false,
      code: RejectionCode.BAD_PAYLOAD,
      message: quantumValidation.message,
    };
  }

  const existingEvolverCount = countFleetShipsByDefId(
    args.state,
    args.playerId,
    "EVO",
  );
  const existingXenCount = countFleetShipsByDefId(
    args.state,
    args.playerId,
    "XEN",
  );
  const builtEvolverCount = payload.builds
    .filter((build) => build.shipDefId === "EVO")
    .reduce((sum, build) => sum + build.count, 0);
  const builtXenCount = payload.builds
    .filter((build) => build.shipDefId === "XEN")
    .reduce((sum, build) => sum + build.count, 0);
  const evolverValidation = validateEvolverChoicesPayload(
    payload,
    existingEvolverCount + builtEvolverCount,
    existingXenCount + builtXenCount,
  );
  if (!evolverValidation.ok) {
    return {
      ok: false,
      code: RejectionCode.BAD_PAYLOAD,
      message: evolverValidation.message,
    };
  }

  return { ok: true, payload };
}
