import { Effect } from "effect";
import { expect } from "vitest";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it(
	"opens, edits and deletes notes while preserving saved changes after rejected writes",
	[signedIn()],
	function* ({ actor, storedNotes, collector }) {
		const { notes: client } = actor();
		const original = yield* client.create({ title: "Original" });
		yield* outcomes([
			["get", () => client.get({ id: original.id }), original],
			["original", () => Effect.sync(() => original), expect.objectContaining({ version: 0 })],
		]);
		const saved = yield* client.update({ ...original, title: "Saved note" });
		expect(saved).toEqual({ ...original, title: "Saved note", version: 1 });
		const before = yield* storedNotes();
		const staleEdit = yield* client.update({ ...original, title: "Stale draft" }).pipe(Effect.flip);
		yield* outcomes([
			["edit rejection", () => Effect.succeed(staleEdit), expect.objectContaining({ _tag: "Conflict" })],
			["saved notes", () => storedNotes(), before],
		]);
		const staleDelete = yield* client.delete({ id: original.id, version: original.version }).pipe(Effect.flip);
		yield* outcomes([
			["delete rejection", () => Effect.succeed(staleDelete), expect.objectContaining({ _tag: "Conflict" })],
			["saved notes", () => storedNotes(), before],
		]);

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
		yield* client.delete({ id: counted.id, version: counted.version });
		yield* outcomes([
			["delete", () => client.delete({ id: saved.id, version: saved.version }).pipe(Effect.flip), expect.objectContaining({ _tag: "NotFound" })],
			["get", () => client.get({ id: saved.id }).pipe(Effect.flip), expect.objectContaining({ _tag: "NotFound" })],
			["list", () => client.list(), []],
			["update", () => client.update({ ...saved, title: "Missing" }).pipe(Effect.flip), expect.objectContaining({ _tag: "NotFound" })],
		]);
	},
);

app.it(
	"hides another account's note and requires a session to open, edit or delete it",
	[signedIn(), signedIn("bob")],
	function* ({ actor, anonymous }) {
		const { notes: alice } = actor();
		const original = yield* alice.create({ title: "Alice's note" });
		const bob = actor("bob").notes;
		yield* outcomes([
			[
				"bob delete",
				() => bob.delete({ id: original.id, version: original.version }).pipe(Effect.flip),
				expect.objectContaining({ _tag: "NotFound" }),
			],
			["bob get", () => bob.get({ id: original.id }).pipe(Effect.flip), expect.objectContaining({ _tag: "NotFound" })],
			["bob update", () => bob.update({ ...original, title: "Another account" }).pipe(Effect.flip), expect.objectContaining({ _tag: "NotFound" })],
		]);
		const signedOut = yield* anonymous();
		const signedOutRead = yield* signedOut.get({ id: original.id }).pipe(Effect.flip);
		expect(signedOutRead).toMatchObject({ _tag: "Unauthorized" });
		expect(signedOutRead).toBeInstanceOf(Unauthorized);
		const signedOutUpdate = yield* signedOut.update({ ...original, title: "Another account" }).pipe(Effect.flip);
		expect(signedOutUpdate).toMatchObject({ _tag: "Unauthorized" });
		expect(signedOutUpdate).toBeInstanceOf(Unauthorized);
		const signedOutDelete = yield* signedOut.delete({ id: original.id, version: original.version }).pipe(Effect.flip);
		yield* outcomes([
			["alice get", () => alice.get({ id: original.id }), original],
			["signed-out deletion error", () => Effect.sync(() => signedOutDelete), expect.objectContaining({ _tag: "Unauthorized" })],
			["signed-out deletion error class", () => Effect.sync(() => signedOutDelete), expect.any(Unauthorized)],
		]);
	},
);
