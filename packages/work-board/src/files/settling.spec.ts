import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, Fiber, FileSystem, Layer, PubSub, Stream } from "effect";
import { expect, it } from "vitest";
import { searchSnapshot } from "#search/snapshot.ts";
import { folder } from "#test/board.ts";
import { watchChanges } from "./changes.ts";

it("waits for an observed edit to settle before returning a cached snapshot", async () => {
	const notes = folder({ "note.md": "# Before" });
	const events = Effect.runSync(PubSub.unbounded<FileSystem.WatchEvent>());
	const entered = Effect.runSync(Deferred.make<void>());
	const release = Effect.runSync(Deferred.make<void>());
	let held = false;
	const services = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			stat: (path) =>
				Effect.gen(function* () {
					if (held && path === join(notes.root, "note.md")) {
						yield* Deferred.succeed(entered, undefined);
						yield* Deferred.await(release);
					}
					return yield* fs.stat(path);
				}),
			watch: () => Stream.fromPubSub(events),
		})),
	).pipe(Layer.provideMerge(NodeServices.layer));
	try {
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const changes = yield* watchChanges(notes.root);
					const index = yield* searchSnapshot(notes.root, undefined, changes);
					yield* index;
					notes.write("note.md", "# After");
					held = true;
					const event: FileSystem.WatchEvent = { _tag: "Update", path: "note.md" };
					yield* PubSub.publish(events, event);
					yield* Deferred.await(entered);
					const read = index.pipe(
						Effect.tap((snapshot) => {
							expect(snapshot.documents[0]?.parsed.body).toBe("# After");
							return Effect.void;
						}),
					);
					const fiber = yield* Effect.forkScoped(read);
					yield* Effect.yieldNow;
					yield* Deferred.succeed(release, undefined);
					yield* Fiber.join(fiber);
				}),
			).pipe(Effect.provide(services)),
		);
	} finally {
		notes.remove();
	}
});
