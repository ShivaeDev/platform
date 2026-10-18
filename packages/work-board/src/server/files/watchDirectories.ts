import { Deferred, Effect, FileSystem, Option, Path, Stream } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { attachmentType } from "#path/attachment.ts";
import { isMarkdown, scanMarkdown } from "./list.ts";

const SETTLE = "100 millis";

type WatchRoots = readonly { readonly real: string; readonly relative: string }[];

function sameRoots(previous: WatchRoots, next: WatchRoots): boolean {
	const known = new Map(previous.map((folder) => [folder.relative, folder.real]));
	return previous.length === next.length && next.every((folder) => known.get(folder.relative) === folder.real);
}

function recordFile(contents: Map<string, number>, relative: string, info: Option.Option<FileSystem.File.Info>) {
	if (!isMarkdown(relative)) {
		return;
	}
	if (Option.isSome(info) && info.value.type === "File") {
		contents.set(relative, Option.match(info.value.mtime, { onNone: () => 0, onSome: (date) => date.getTime() }));
	} else {
		contents.delete(relative);
	}
}

export const watchDirectories = Effect.fn("WorkBoard.watchDirectories")(function* (
	root: string,
	realRoot: string,
	stale: Effect.Effect<void>,
	setWatching: (watching: boolean) => Effect.Effect<unknown>,
	publish: (paths: readonly string[]) => Effect.Effect<unknown>,
	observed: Effect.Effect<void> = Effect.void,
	settled: Effect.Effect<unknown> = Effect.void,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const cycle = Effect.scoped(
		Effect.gen(function* () {
			const { files, roots } = yield* scanMarkdown(root, realRoot);
			let contents = new Map(files.map((file) => [file.path, file.modified]));
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
			// A removed root can be reported without any descendant file events.
			streams.push(
				fs.watch(path.dirname(realRoot)).pipe(
					Stream.filter((event) => event._tag === "Remove" && path.resolve(path.dirname(realRoot), event.path) === realRoot),
					Stream.map(() => ""),
				),
			);
			const changedPath = Effect.fn("WorkBoard.changedPath")(function* (relative: string) {
				const info = yield* Effect.option(fs.stat(path.join(root, relative)));
				const removedLink = roots.some((folder) => folder.relative === relative || folder.relative.startsWith(`${relative}/`));
				if (!Option.match(info, { onNone: () => removedLink, onSome: (value) => value.type === "Directory" })) {
					recordFile(contents, relative, info);
					return isMarkdown(relative) || attachmentType(relative) !== undefined;
				}
				yield* stale;
				const next = Option.isSome(info) ? yield* scanMarkdown(root, realRoot) : undefined;
				if (next && sameRoots(roots, next.roots)) {
					const changed = next.files.length !== contents.size || next.files.some((file) => contents.get(file.path) !== file.modified);
					contents = new Map(next.files.map((file) => [file.path, file.modified]));
					return changed;
				}
				yield* Effect.forkScoped(Effect.delay(Deferred.succeed(topology, undefined), SETTLE));
				return false;
			});
			const pending = new Set<string>();
			const watch = Stream.mergeAll(streams, { concurrency: "unbounded" }).pipe(
				Stream.filter(
					(relative) => !relative.split("/").some((segment) => segment === ".board.sock.starting" || /^\.s[A-Za-z0-9]{6}$/u.test(segment)),
				),
				Stream.filterEffect((relative) =>
					Effect.gen(function* () {
						if (isMarkdown(relative) || attachmentType(relative) !== undefined) {
							yield* observed;
						}
						const changed = yield* changedPath(relative);
						if (changed) {
							pending.add(relative);
						} else if (pending.size === 0) {
							yield* settled;
						}
						return changed;
					}),
				),
				Stream.interruptWhen(Deferred.await(topology)),
				Stream.debounce(SETTLE),
				Stream.runForEach(() =>
					Effect.suspend(() => {
						const paths = [...pending];
						pending.clear();
						return publish(paths);
					}),
				),
				Effect.andThen(
					Effect.flatMap(Deferred.isDone(topology), (changed) =>
						changed
							? Effect.void
							: Effect.fail(new ServiceUnavailable({ message: "The workspace watcher ended. Retrying the watch automatically." })),
					),
				),
			);
			yield* Effect.forkScoped(Effect.delay(setWatching(true), SETTLE));
			yield* watch;
			yield* setWatching(false);
		}),
	);
	yield* Effect.forever(cycle);
});
