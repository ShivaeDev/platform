import { Data, Deferred, Effect, FileSystem, Option, Path, Stream } from "effect";
import { isMarkdown, scanMarkdown } from "./list.ts";

class WatchEnded extends Data.TaggedError("WatchEnded") {}

const SETTLE = "100 millis";
const BATCH = 256;

export const watchDirectories = Effect.fn("WorkBoard.watchDirectories")(function* (
	root: string,
	realRoot: string,
	stale: Effect.Effect<void>,
	setWatching: (watching: boolean) => Effect.Effect<unknown>,
	publish: (paths: readonly string[]) => Effect.Effect<unknown>,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const cycle = Effect.scoped(
		Effect.gen(function* () {
			const { roots } = yield* scanMarkdown(root, realRoot);
			const topology = yield* Deferred.make<void>();
			// Node's recursive watcher can miss replacement of directory symlinks.
			const parents = yield* Effect.forEach(
				roots.filter((folder) => folder.relative !== ""),
				(folder) =>
					Effect.map(fs.realPath(path.dirname(path.join(root, folder.relative))), (real) => ({ real, relative: path.dirname(folder.relative) })),
			);
			const watched = [...roots.map((folder) => ({ ...folder, recursive: true })), ...parents.map((folder) => ({ ...folder, recursive: false }))];
			const streams = watched.map((folder) =>
				fs.watch(folder.real, { recursive: folder.recursive }).pipe(
					Stream.map((event) => {
						const local = path.isAbsolute(event.path) ? path.relative(folder.real, event.path) : event.path;
						return path.join(folder.relative, local).split(path.sep).join("/");
					}),
				),
			);
			const watch = Stream.mergeAll(streams, { concurrency: "unbounded" }).pipe(
				Stream.tap(() => stale),
				Stream.tap((relative) =>
					Effect.gen(function* () {
						const info = yield* Effect.option(fs.stat(path.join(root, relative)));
						const removedLink = roots.some((folder) => folder.relative === relative || folder.relative.startsWith(`${relative}/`));
						if (Option.match(info, { onNone: () => removedLink, onSome: (value) => value.type === "Directory" })) {
							yield* Effect.forkScoped(Effect.delay(Deferred.succeed(topology, undefined), SETTLE));
						}
					}),
				),
				Stream.filter(isMarkdown),
				Stream.interruptWhen(Deferred.await(topology)),
				Stream.groupedWithin(BATCH, SETTLE),
				Stream.runForEach((paths) => publish([...new Set(paths)])),
				Effect.andThen(Effect.flatMap(Deferred.isDone(topology), (changed) => (changed ? Effect.void : Effect.fail(new WatchEnded())))),
			);
			yield* Effect.forkScoped(Effect.delay(setWatching(true), SETTLE));
			yield* watch;
			yield* setWatching(false);
		}),
	);
	yield* Effect.forever(cycle);
});
