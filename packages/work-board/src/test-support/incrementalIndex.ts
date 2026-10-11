import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, ManagedRuntime, PlatformError, PubSub, Ref } from "effect";
import type { Change, Changes } from "#files/changes.ts";
import { registerInvalidations, trackInvalidations } from "#files/invalidations.ts";
import { listMarkdown } from "#files/list.ts";
import { searchSnapshot } from "#search/snapshot.ts";
import { fullIndex } from "./fullIndex.ts";

export async function incrementalIndex(root: string, home?: string) {
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
	const runtime = ManagedRuntime.make(services);
	const revision = Effect.runSync(Ref.make(0));
	const watching = Effect.runSync(Ref.make(true));
	const tracker = trackInvalidations();
	const changes: Changes = {
		events: Effect.runSync(PubSub.unbounded<Change>()),
		files: listMarkdown(root, root).pipe(Effect.provide(NodeServices.layer)),
		realRoot: root,
		revision: Ref.get(revision),
		watching,
	};
	registerInvalidations(changes, tracker);
	const index = await runtime.runPromise(searchSnapshot(root, home, changes));
	return {
		blocked,
		changes,
		close: () => runtime.dispose(),
		fresh: () => runtime.runPromise(fullIndex(root, home)),
		read: () => runtime.runPromise(index),
		reads,
		update(paths?: readonly string[]) {
			const next = Effect.runSync(Ref.updateAndGet(revision, (value) => value + 1));
			tracker.record(next, paths);
			reads.length = 0;
		},
	};
}
