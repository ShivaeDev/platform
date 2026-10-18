import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"counts an edited title, rejects the pre-count edit and completes jobs for deleted notes",
	[signedIn()],
	function* ({ actor, startWorker, rejectsWith, wordCountJobs }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Old title" });
		const edited = yield* client.update({ ...original, title: "Three new words" });
		expect(edited.wordCount).toBeNull();
		const deleted = yield* client.create({ title: "Deleted before counting" });
		yield* client.delete({ id: deleted.id, version: deleted.version });
		yield* startWorker();
		const counted = { ...edited, version: 2, wordCount: 3 };
		yield* eventually(client.get({ id: edited.id }).pipe(Effect.flatMap((note) => Effect.try(() => expect(note).toEqual(counted)))), {
			interval: "50 millis",
			times: 100,
		});
		yield* client.update({ ...edited, title: "Before counting" }).pipe(rejectsWith("Conflict"));
		expect(yield* client.list()).toEqual([counted]);
		yield* eventually(
			wordCountJobs().pipe(
				Effect.flatMap((jobs) =>
					Effect.try(() => {
						expect(jobs).not.toEqual([]);
						for (const job of jobs) {
							expect(job).toEqual({ retryCount: 0, state: "completed" });
						}
					}),
				),
			),
			{ interval: "50 millis", times: 160 },
		);
	},
	15_000,
);
