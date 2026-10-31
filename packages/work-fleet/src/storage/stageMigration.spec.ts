import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { prepared } from "#test/preparation.ts";
import { isolatedStorage } from "#test/storageStory.ts";

const NAMESPACE = "vocabulary";
const RECORDS = ["prepared", "executing", "reviewing", "needs-human", "completed", "released"].map((stage) => ({
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

isolatedStorage.it(
	"the stage migration renames old stages in current and archived records and keeps a waiting record's owner and blocker",
	[],
	function* ({ migrate, openFleetStore, seedTextRecords }) {
		yield* seedTextRecords(NAMESPACE, RECORDS);
		yield* migrate(NAMESPACE, "advisory_reviews");

		yield* migrate(NAMESPACE);

		const values = (yield* openFleetStore({ namespace: NAMESPACE })).list().pipe(Effect.map((entries) => entries.map(({ value }) => value)));
		yield* outcomes([
			[
				"stages",
				() => values.pipe(Effect.map((found) => found.map(({ stage }) => stage))),
				["queued", "working", "reviewing", "waiting", "done", "released"],
			],
			[
				"archived stages",
				() => values.pipe(Effect.map((found) => found.map(({ history }) => history?.[0]?.stage))),
				["done", "done", "done", "done", "done", "done"],
			],
			[
				"waiting record",
				() => values.pipe(Effect.map((found) => found[3])),
				expect.objectContaining({ attentionOwner: "orchestrator", blocker: "Choose a direction" }),
			],
		]);
	},
);
