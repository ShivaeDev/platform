import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, rejectedNoteCommits, signedIn } from "#modules/notes/test-support/application.ts";

app.it("saves and edits notes when the queue client rejects enqueueing", [signedIn()], function* ({ actor, storedNotes, logs, failNextNoteJob }) {
	const { notes } = actor();
	yield* failNextNoteJob();
	const created = yield* notes.create({ title: "Still saved" });
	expect(logs()).toContainEqual(
		expect.objectContaining({
			message: expect.arrayContaining([
				expect.objectContaining({
					error: expect.objectContaining({ operation: "enqueue", queue: "count-note-words" }),
					event: "note_enqueue_failed",
					noteId: created.id,
				}),
			]),
		}),
	);
	yield* failNextNoteJob();
	const edited = yield* notes.update({ ...created, title: "Still edited" });
	yield* outcomes({
		"logs": [
			Effect.sync(() =>
				logs().filter(
					(entry) =>
						Array.isArray(entry.message)
						&& entry.message.some(
							(message) => typeof message === "object" && message !== null && "event" in message && message.event === "note_enqueue_failed",
						),
				),
			),
			[created, edited].map((note) =>
				expect.objectContaining({
					message: expect.arrayContaining([
						expect.objectContaining({
							error: expect.objectContaining({ operation: "enqueue", queue: "count-note-words" }),
							event: "note_enqueue_failed",
							noteId: note.id,
						}),
					]),
				}),
			),
		],
		"notes get": [notes.get({ id: created.id }), edited],
		"stored notes": [
			storedNotes(),
			[{ id: created.id, title: "Still edited", version: 1, wordCount: null }].map((note) => expect.objectContaining(note)),
		],
	});
});

app.it(
	"does not enqueue a note when its write transaction fails at commit",
	[signedIn(), rejectedNoteCommits()],
	function* ({ actor, storedNotes, collector, acceptNoteCommits }) {
		yield* outcomes({
			"actor": [actor().notes.create({ title: "Not committed" }).pipe(Effect.flip), expect.objectContaining({ _tag: "InternalServerError" })],
			"stored notes": [storedNotes(), []],
		});
		yield* acceptNoteCommits;
		const control = yield* actor().notes.create({ title: "Committed control" });
		const receiver = yield* collector();
		const stopWorker = yield* receiver.startWorker();
		yield* Effect.promise(() =>
			expect
				.poll(() => Effect.runPromise(actor().notes.get({ id: control.id })), { timeout: 8000 })
				.toEqual({ ...control, version: 1, wordCount: 2 }),
		);
		yield* Effect.promise(() =>
			expect.poll(() => receiver.spans.filter((span) => span.name === "CountWords").map((span) => span.status.code), { timeout: 8000 }).toEqual([1]),
		);
		yield* stopWorker;
		expect(receiver.spans.filter((span) => span.name === "CountWords").map((span) => span.status.code)).toEqual([1]);
	},
);
