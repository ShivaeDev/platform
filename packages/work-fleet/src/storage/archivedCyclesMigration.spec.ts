import { Effect } from "effect";
import { expect } from "vitest";
import { legacyVocabulary } from "#test/legacyVocabulary.ts";
import { migrationRecords } from "#test/migrationRecords.ts";
import { isolatedStorage } from "#test/storageStory.ts";

isolatedStorage.it(
	"migration removes only archived cycles without attempts, decisions or responses",
	[],
	function* ({ namespace, sql, restoreLegacy, migrate, openFleetStore }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		const record = migrationRecords()[1];
		const attempted = record?.history?.[0];
		if (record === undefined || attempted === undefined) {
			return yield* Effect.die("Missing migration fixture");
		}
		const empty = { ...attempted, archivedAt: 201, attempts: [] };
		const decided = {
			...empty,
			archivedAt: 202,
			decision: { code: "incomplete-context" as const, id: "decision", links: [], reason: "Human input", recommendation: "Answer" },
		};
		const answered = {
			...empty,
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
		const values = [
			{ ...record, history: [empty, attempted, { ...empty, responses: [] }, decided, answered] },
			{ ...record, history: [empty], workId: "empty" },
			{ ...record, history: undefined, workId: "absent" },
		];
		for (const value of values) {
			yield* sql`insert into ${sql(`${namespace}_records`)} (work_id, version, payload) values (${value.workId}, 7, ${JSON.stringify(legacyVocabulary(value))}::jsonb)`;
		}
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		expect((yield* store.load(record.workId))?.value).toEqual({ ...record, history: [attempted, decided, answered] });
		expect((yield* store.load("empty"))?.value).toEqual({ ...record, history: [], workId: "empty" });
		expect((yield* store.load("absent"))?.value).toEqual({ ...record, history: undefined, workId: "absent" });
		const migrated = yield* store.list();
		expect(yield* migrate(namespace)).toEqual([]);
		expect(yield* store.list()).toEqual(migrated);
	},
);
