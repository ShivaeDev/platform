import { Deferred, Effect, FileSystem, Option, Path, Stream } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { attachmentType } from "#path/attachment.ts";
import { isMarkdown, type MarkdownFile, scanMarkdown } from "./list.ts";
import { folderEvents, SETTLE, watchedScan } from "./watchedScan.ts";

type WatchRoots = readonly { readonly real: string; readonly relative: string }[];

function changedFiles(previous: ReadonlyMap<string, number>, next: ReadonlyMap<string, number>) {
	return [...new Set([...previous.keys(), ...next.keys()])].filter((file) => previous.get(file) !== next.get(file));
}

function sameRoots(previous: WatchRoots, next: WatchRoots): boolean {
	const known = new Map(previous.map((folder) => [folder.relative, folder.real]));
	return previous.length === next.length && next.every((folder) => known.get(folder.relative) === folder.real);
}

function directoryEvent(relative: string, info: Option.Option<FileSystem.File.Info>, roots: WatchRoots, contents: ReadonlyMap<string, number>) {
	if (Option.isSome(info)) {
		return info.value.type === "Directory";
	}
	return (
		roots.some((folder) => folder.relative === relative || folder.relative.startsWith(`${relative}/`))
		|| [...contents.keys()].some((file) => file.startsWith(`${relative}/`))
	);
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

export interface WatchHooks {
	readonly listed: (files: readonly MarkdownFile[]) => Effect.Effect<unknown>;
	readonly observed?: Effect.Effect<void>;
	readonly publish: (paths: readonly string[]) => Effect.Effect<unknown>;
	readonly settled?: Effect.Effect<unknown>;
	readonly setWatching: (watching: boolean) => Effect.Effect<unknown>;
	readonly stale: Effect.Effect<unknown>;
}

export const watchDirectories = Effect.fn("WorkBoard.watchDirectories")(function* (
	root: string,
	realRoot: string,
	{ listed, observed = Effect.void, publish, setWatching, settled = Effect.void, stale }: WatchHooks,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const cycle = Effect.scoped(
		Effect.gen(function* () {
			const { files, listing, rootEvents, roots } = yield* watchedScan(root, realRoot);
			let contents = new Map(files.map((file) => [file.path, file.modified]));
			if (listing) {
				yield* listed(listing);
			}
			const topology = yield* Deferred.make<void>();
			// Node's recursive watcher can miss replacement of directory symlinks.
			const parents = yield* Effect.forEach(
				roots.filter((folder) => folder.relative !== ""),
				(folder) =>
					Effect.map(fs.realPath(path.dirname(path.join(root, folder.relative))), (real) => ({ real, relative: path.dirname(folder.relative) })),
			);
			const streams = [
				rootEvents,
				...(yield* Effect.forEach(
					[
						...roots.filter((folder) => folder.relative !== "").map((folder) => ({ ...folder, recursive: true })),
						...parents.map((folder) => ({ ...folder, recursive: false })),
					],
					folderEvents,
				)),
			];
			// A removed root can be reported without any descendant file events.
			streams.push(
				fs.watch(path.dirname(realRoot)).pipe(
					Stream.filter((event) => event._tag === "Remove" && path.resolve(path.dirname(realRoot), event.path) === realRoot),
					Stream.map(() => ""),
				),
			);
			const pending = new Set<string>();
			let rescan = false;
			const changedPath = Effect.fn("WorkBoard.changedPath")(function* (relative: string) {
				const relevant = isMarkdown(relative) || attachmentType(relative) !== undefined;
				if (relevant) {
					yield* observed;
				}
				const info = yield* Effect.option(fs.stat(path.join(root, relative)));
				if (directoryEvent(relative, info, roots, contents)) {
					if (!relevant) {
						yield* observed;
					}
					rescan = true;
					return true;
				}
				recordFile(contents, relative, info);
				if (relevant) {
					pending.add(relative);
				}
				return relevant;
			});
			const flush = Effect.gen(function* () {
				if (rescan) {
					rescan = false;
					const next = yield* scanMarkdown(root, realRoot);
					if (!sameRoots(roots, next.roots)) {
						return yield* Deferred.succeed(topology, undefined);
					}
					const snapshot = new Map(next.files.map((file) => [file.path, file.modified]));
					for (const file of changedFiles(contents, snapshot)) {
						pending.add(file);
					}
					contents = snapshot;
				}
				const paths = [...pending];
				pending.clear();
				return yield* paths.length > 0 ? publish(paths) : settled;
			});
			const watch = Stream.mergeAll(streams, { concurrency: "unbounded" }).pipe(
				Stream.filter((relative) =>
					relative.split("/").every((segment) => segment === "." || (!segment.startsWith(".") && segment !== "node_modules")),
				),
				Stream.filterEffect(changedPath),
				Stream.interruptWhen(Deferred.await(topology)),
				Stream.debounce(SETTLE),
				Stream.runForEach(() => flush),
				Effect.andThen(
					Effect.flatMap(Deferred.isDone(topology), (changed) =>
						changed
							? Effect.void
							: Effect.fail(new ServiceUnavailable({ message: "The workspace watcher ended. Retrying the watch automatically." })),
					),
				),
			);
			yield* Effect.forkScoped(listing ? setWatching(true) : Effect.delay(Effect.andThen(stale, setWatching(true)), SETTLE));
			yield* watch;
			yield* setWatching(false);
		}),
	);
	yield* Effect.forever(cycle);
});
