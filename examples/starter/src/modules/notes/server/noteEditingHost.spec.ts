import { Effect } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"opens, edits and deletes notes while preserving saved changes after rejected writes",
	[signedIn()],
	function* ({ actor, storedNotes, collector }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Original" });
		expect(original).toMatchObject({ version: 0 });
		expect(yield* client.get({ id: original.id })).toEqual(original);
		const saved = yield* client.update({ ...original, title: "  Saved note  " });
		expect(saved).toEqual({ ...original, title: "Saved note", version: 1 });
		const before = yield* storedNotes();
		expect(yield* client.update({ ...original, title: "Stale draft" }).pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
		expect(yield* storedNotes()).toEqual(before);
		expect(yield* client.delete({ id: original.id, version: original.version }).pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
		expect(yield* storedNotes()).toEqual(before);
		const receiver = yield* collector();
		const stopWorker = yield* receiver.startWorker();
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(client.get({ id: saved.id })), { timeout: 8000 }).toEqual({ ...saved, version: 2, wordCount: 2 }),
		);
		yield* Effect.promise(() =>
			expect
				.poll(() => receiver.spans.filter((span) => span.name === "CountWords").map((span) => span.status.code), { timeout: 8000 })
				.toEqual([1, 1]),
		);
		yield* stopWorker;
		expect(receiver.spans.filter((span) => span.name === "CountWords").map((span) => span.status.code)).toEqual([1, 1]);
		const counted = yield* client.get({ id: saved.id });
		expect(yield* client.update({ ...saved, title: "   " }).pipe(Effect.flip)).toMatchObject({
			_tag: "Invalid",
			field: "title",
			message: "Enter a title",
		});
		expect(yield* client.get({ id: saved.id })).toEqual(counted);
		yield* client.delete({ id: counted.id, version: counted.version });
		expect(yield* client.list()).toEqual([]);
		expect(yield* client.get({ id: saved.id }).pipe(Effect.flip)).toMatchObject({ _tag: "NotFound" });
		expect(yield* client.update({ ...saved, title: "Missing" }).pipe(Effect.flip)).toMatchObject({ _tag: "NotFound" });
		expect(yield* client.delete({ id: saved.id, version: saved.version }).pipe(Effect.flip)).toMatchObject({ _tag: "NotFound" });
	},
);

app.it(
	"hides another account's note and requires a session to open, edit or delete it",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous }) {
		const { notes: alice } = actor();
		const original = yield* alice.create({ title: "Alice's note" });
		const bob = actor("bob").notes;
		expect(yield* bob.get({ id: original.id }).pipe(Effect.flip)).toMatchObject({ _tag: "NotFound" });
		expect(yield* bob.update({ ...original, title: "Another account" }).pipe(Effect.flip)).toMatchObject({ _tag: "NotFound" });
		expect(yield* bob.delete({ id: original.id, version: original.version }).pipe(Effect.flip)).toMatchObject({ _tag: "NotFound" });
		const signedOut = yield* anonymous();
		const signedOutRead = yield* signedOut.get({ id: original.id }).pipe(Effect.flip);
		expect(signedOutRead).toMatchObject({ _tag: "Unauthorized" });
		expect(signedOutRead).toBeInstanceOf(Unauthorized);
		const signedOutUpdate = yield* signedOut.update({ ...original, title: "Another account" }).pipe(Effect.flip);
		expect(signedOutUpdate).toMatchObject({ _tag: "Unauthorized" });
		expect(signedOutUpdate).toBeInstanceOf(Unauthorized);
		const signedOutDelete = yield* signedOut.delete({ id: original.id, version: original.version }).pipe(Effect.flip);
		expect(signedOutDelete).toMatchObject({ _tag: "Unauthorized" });
		expect(signedOutDelete).toBeInstanceOf(Unauthorized);
		expect(yield* alice.get({ id: original.id })).toEqual(original);
	},
);
