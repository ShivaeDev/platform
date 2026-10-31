import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { legacyVocabulary } from "#test/legacyVocabulary.ts";
import { archivedMigrationCycle, migrationRecords } from "#test/migrationRecords.ts";
import { isolatedStorage } from "#test/storageStory.ts";

const [, RECORD] = migrationRecords();
const ATTEMPTED = archivedMigrationCycle();
const EMPTY = { ...ATTEMPTED, archivedAt: 201, attempts: [] };
const DECIDED = {
	...EMPTY,
	archivedAt: 202,
	decision: { code: "incomplete-context" as const, id: "decision", links: [], reason: "Human input", recommendation: "Answer" },
};
const ANSWERED = {
	...EMPTY,
	archivedAt: 203,
	responses: [
		{
			decisionId: "decision",
			processedAt: 100,
			questionId: "question",
			questionRevision: "revision",
			responseId: "response",
			type: "answer" as const,
		},
	],
};

isolatedStorage.it(
	"the model migration drops only archived cycles without attempts, decisions or responses",
	[],
	function* ({ insertPayloads, migrate, namespace, openFleetStore, restoreLegacy }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		yield* insertPayloads(
			namespace,
			[
				{ ...RECORD, history: [EMPTY, ATTEMPTED, { ...EMPTY, responses: [] }, DECIDED, ANSWERED] },
				{ ...RECORD, history: [EMPTY], workId: "empty" },
				{ ...RECORD, history: undefined, workId: "absent" },
			].map(legacyVocabulary),
			() => 7,
		);
		const store = yield* openFleetStore({ namespace });

		yield* migrate(namespace);

		function history(workId: string) {
			return store.load(workId).pipe(Effect.map((entry) => entry?.value.history));
		}
		yield* outcomes([
			["kept cycles", () => history(RECORD.workId), [ATTEMPTED, DECIDED, ANSWERED]],
			["only empty cycles", () => history("empty"), []],
			["no history", () => history("absent"), undefined],
		]);
	},
);

isolatedStorage.it(
	"rerunning the model migration applies nothing and keeps the records",
	[],
	function* ({ migrate, migration, namespace, openFleetStore, restoreLegacy, insertPayloads }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		yield* insertPayloads(namespace, [legacyVocabulary({ ...RECORD, history: [EMPTY, ATTEMPTED] })], () => 7);
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		const migrated = yield* store.list();

		const rerun = yield* migration(namespace);

		expect(rerun).toBe("nothing to apply");
		expect(yield* store.list()).toEqual(migrated);
	},
);
