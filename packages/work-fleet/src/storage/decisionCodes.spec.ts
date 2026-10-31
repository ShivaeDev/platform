import { expect } from "vitest";
import { backfillDecisionCodes } from "#storage/backfillDecisionCodes.ts";
import { codedDecisionRecord, legacyDecisionRecord } from "#test/legacyDecisionRecords.ts";
import { isolatedStorage } from "#test/storageStory.ts";

isolatedStorage.it(
	"the decision code backfill codes current and archived decisions without changing receipts or existing codes, and a rerun changes nothing",
	[],
	function* ({ insertPayloads, migrate, namespace, readDecisions, restoreLegacy }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		yield* insertPayloads(namespace, [{ ...legacyDecisionRecord, workId: "one" }], () => 1);
		yield* migrate(namespace, "decision_codes");

		yield* backfillDecisionCodes(namespace);
		yield* migrate(namespace);
		yield* migrate(namespace);

		expect(yield* readDecisions(namespace)).toEqual([{ payload: codedDecisionRecord, version: 2 }]);
	},
);
