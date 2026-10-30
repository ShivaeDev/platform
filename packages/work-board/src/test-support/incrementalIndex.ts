import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, PlatformError, PubSub, Ref } from "effect";
import type { Change, Changes } from "#server/files/changes.ts";
import { registerInvalidations, trackInvalidations } from "#server/files/invalidations.ts";
import { updateFiles } from "#server/files/update.ts";
import { searchSnapshot } from "#server/search/snapshot.ts";
import { fullIndex } from "./fullIndex.ts";

export const incrementalIndex = Effect.fn("Test.incrementalIndex")(function* (root: string, home?: string) {
	const reads: string[] = [];
	let checks = 0;
	function checked<A, E>(read: Effect.Effect<A, E>) {
		return Effect.suspend(() => {
			checks += 1;
			return read;
		});
	}
	const blocked = new Set<string>();
	const services = Layer.effect(
		FileSystem.FileSystem,
		Effect.map(Effect.service(FileSystem.FileSystem), (fs) => ({
			...fs,
			lstat: (path) => checked(fs.lstat(path)),
			readFileString: (path, encoding) =>
				Effect.suspend(() => {
					reads.push(path);
					return blocked.has(path)
						? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
						: fs.readFileString(path, encoding);
				}),
			realPath: (path) => checked(fs.realPath(path)),
			stat: (path) => checked(fs.stat(path)),
		})),
	).pipe(Layer.provideMerge(NodeServices.layer));
	const context = yield* Layer.build(services);
	const revision = yield* Ref.make(0);
	const watching = yield* Ref.make(true);
	const tracker = trackInvalidations();
	let listed: { readonly files: Effect.Success<ReturnType<typeof updateFiles>>; readonly revision: number } | undefined;
	const files = Effect.gen(function* () {
		const now = yield* Ref.get(revision);
		const current = yield* Ref.get(watching);
		if (current && listed?.revision === now) {
			return listed.files;
		}
		const dirty = listed && current ? tracker.since(listed.revision) : undefined;
		const next = yield* updateFiles(root, root, listed?.files ?? [], dirty);
		listed = { files: next, revision: now };
		return next;
	});
	const changes: Changes = {
		events: yield* PubSub.unbounded<Change>(),
		files: files.pipe(Effect.provide(context)),
		realRoot: root,
		revision: Ref.get(revision),
		watching,
	};
	registerInvalidations(changes, tracker);
	const index = yield* searchSnapshot(root, home, changes).pipe(Effect.provide(context));
	return {
		blocked,
		changes,
		checks: () => checks,
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
