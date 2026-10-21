import { expect } from "vitest";
import { prepared } from "#test/preparation.ts";
import { isolatedStorage } from "#test/storageStory.ts";

isolatedStorage.it(
	"upgrades old stages in current and archived records through the Fleet migration ledger",
	[],
	function* ({ sql, seedTextRecords, migrate, openFleetStore }) {
		const namespace = "vocabulary";
		const predecessor = 25;
		const records = ["prepared", "executing", "reviewing", "needs-human", "completed", "released"].map((stage) => ({
			attempts: [],
			boardRevision: "revision",
			cwd: "/synthetic",
			preparation: prepared(),
			prompt: "Work",
			stage,
			workId: stage,
			...(stage === "needs-human" ? { attentionOwner: "orchestrator", blocker: "Choose a direction" } : {}),
			history: [
				{
					archivedAt: 1,
					attempts: [],
					boardRevision: "old-revision",
					cwd: "/synthetic",
					preparation: prepared(),
					prompt: "Old work",
					stage: "completed",
				},
			],
		}));
		yield* seedTextRecords(namespace, records);
		yield* migrate(namespace, "advisory_reviews");
		expect(yield* sql`select max(migration_id) as latest from ${sql(`${namespace}_migrations`)}`).toEqual([{ latest: predecessor }]);
		yield* migrate(namespace);
		const store = yield* openFleetStore({ namespace });
		const values = (yield* store.list()).map((entry) => entry.value);
		expect(values.map((value) => value.stage)).toEqual(["queued", "working", "reviewing", "waiting", "done", "released"]);
		expect(values.map((value) => value.history?.[0]?.stage)).toEqual(["done", "done", "done", "done", "done", "done"]);
		expect(values[3]).toMatchObject({ attentionOwner: "orchestrator", blocker: "Choose a direction" });
		expect(yield* migrate(namespace)).toEqual([]);
		expect((yield* store.list()).map((entry) => entry.value)).toEqual(values);
	},
);
