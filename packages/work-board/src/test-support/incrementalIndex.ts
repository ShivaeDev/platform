import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, PlatformError, PubSub, Ref } from "effect";
import type { Change, Changes } from "#files/changes.ts";
import { registerInvalidations, trackInvalidations } from "#files/invalidations.ts";
import { listMarkdown } from "#files/list.ts";
import { searchSnapshot } from "#search/snapshot.ts";
import { fullIndex } from "./fullIndex.ts";

export const incrementalIndex = Effect.fn("Test.incrementalIndex")(function* (root: string, home?: string) {
	const reads: string[] = [];
	const blocked = new Set<string>();
	const services = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			readFileString: (path, encoding) =>
				Effect.suspend(() => {
					reads.push(path);
					return blocked.has(path)
						? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
						: fs.readFileString(path, encoding);
				}),
		})),
	).pipe(Layer.provideMerge(NodeServices.layer));
	const context = yield* Layer.build(services);
	const revision = yield* Ref.make(0);
	const watching = yield* Ref.make(true);
	const tracker = trackInvalidations();
	const changes: Changes = {
		events: yield* PubSub.unbounded<Change>(),
		files: listMarkdown(root, root).pipe(Effect.provide(NodeServices.layer)),
		realRoot: root,
		revision: Ref.get(revision),
		watching,
	};
	registerInvalidations(changes, tracker);
	const index = yield* searchSnapshot(root, home, changes).pipe(Effect.provide(context));
	return {
		blocked,
		changes,
		fresh: () => fullIndex(root, home).pipe(Effect.provide(context)),
		read: () => index.pipe(Effect.provide(context)),
		reads,
		update: Effect.fn("Test.update")(function* (paths?: readonly string[]) {
			const next = yield* Ref.updateAndGet(revision, (value) => value + 1);
			tracker.record(next, paths);
			reads.length = 0;
		}),
	};
});
