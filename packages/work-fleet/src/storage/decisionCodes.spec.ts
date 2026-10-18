import { expect } from "vitest";
import { backfillDecisionCodes } from "#storage/backfillDecisionCodes.ts";
import { codedDecisionRecord, legacyDecisionRecord } from "#test/legacyDecisionRecords.ts";
import { isolatedStorage } from "#test/storageStory.ts";

isolatedStorage.it(
	"backfills current and archived decisions without changing publication receipts or existing codes",
	[],
	function* ({ namespace, sql, restoreLegacy, migrate, readDecisions }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		yield* sql`insert into ${sql(`${namespace}_records`)} (work_id, version, payload) values ('one', 1, ${JSON.stringify(legacyDecisionRecord)}::jsonb)`;
		yield* migrate(namespace, "decision_codes");
		yield* backfillDecisionCodes(namespace);
		yield* migrate(namespace);
		const rows = yield* readDecisions(namespace);
		expect(rows).toEqual([{ payload: codedDecisionRecord, version: 2 }]);
		yield* migrate(namespace);
		expect(yield* readDecisions(namespace)).toEqual(rows);
	},
);
