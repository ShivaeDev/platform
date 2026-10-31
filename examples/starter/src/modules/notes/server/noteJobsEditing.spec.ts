import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"counts an edited title, rejects the pre-count edit and completes jobs for deleted notes",
	[signedIn()],
	function* ({ actor, collector, wordCountCompletions }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Old title" });
		const edited = yield* client.update({ ...original, title: "Three new words" });
		expect(edited.wordCount).toBeNull();
		const deleted = yield* client.create({ title: "Deleted before counting" });
		yield* client.delete({ id: deleted.id, version: deleted.version });
		const receiver = yield* collector();
		const stopWorker = yield* receiver.startWorker();
		const counted = { ...edited, version: 2, wordCount: 3 };
		yield* Effect.promise(() => expect.poll(() => Effect.runPromise(client.get({ id: edited.id })), { timeout: 8000 }).toEqual(counted));
		const rejectedEdit = yield* client.update({ ...edited, title: "Before counting" }).pipe(Effect.flip);
		yield* outcomes([
			["edit rejection", () => Effect.succeed(rejectedEdit), expect.objectContaining({ _tag: "Conflict" })],
			["saved notes", () => client.list(), [counted]],
		]);

		yield* Effect.promise(() =>
			expect
				.poll(() => receiver.spans.filter((span) => span.name === "CountWords").map((span) => span.status.code), { timeout: 8000 })
				.toEqual([1, 1, 1]),
		);
		yield* Effect.promise(() =>
			expect
				.poll(() => Effect.runPromise(wordCountCompletions()), { timeout: 8000 })
				.toMatchObject([
					{ acknowledgement: { affected: 1 }, attempt: { retryCount: 0 }, queue: "count-note-words" },
					{ acknowledgement: { affected: 1 }, attempt: { retryCount: 0 }, queue: "count-note-words" },
					{ acknowledgement: { affected: 1 }, attempt: { retryCount: 0 }, queue: "count-note-words" },
				]),
		);
		yield* stopWorker;
		expect(receiver.spans.filter((span) => span.name === "CountWords").map((span) => span.status.code)).toEqual([1, 1, 1]);
	},
	15_000,
);
