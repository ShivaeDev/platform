import { Data, Deferred, Effect, FileSystem, Option, Path, type PlatformError, PubSub, Ref, Schedule, Stream } from "effect";
import { isMarkdown, listMarkdown, type MarkdownFile } from "./list.ts";

export type Change = { readonly _tag: "Changed"; readonly paths: ReadonlyArray<string> } | { readonly _tag: "Watching"; readonly watching: boolean };

export interface Changes {
	readonly events: PubSub.PubSub<Change>;
	readonly files: Effect.Effect<ReadonlyArray<MarkdownFile>, PlatformError.PlatformError>;
	readonly realRoot: string;
	readonly watching: Ref.Ref<boolean>;
}

interface Cached {
	readonly files: ReadonlyArray<MarkdownFile>;
	readonly generation: number;
}

class WatchEnded extends Data.TaggedError("WatchEnded") {}

const SETTLE = "100 millis";
const BATCH = 256;
const BACKLOG = 16;
const RETRY = Schedule.min([Schedule.exponential("100 millis"), Schedule.spaced("5 seconds")]);

export const watchChanges = Effect.fn("WorkBoard.watchChanges")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const realRoot = yield* fs.realPath(root);
	const events = yield* Effect.acquireRelease(PubSub.sliding<Change>(BACKLOG), PubSub.shutdown);
	const watching = yield* Ref.make(false);
	const generation = yield* Ref.make(0);
	const cached = yield* Ref.make(Option.none<Cached>());
	const settled = yield* Deferred.make<void>();
	const stale = Ref.update(generation, (count) => count + 1);
	const relative = (changed: string) => (path.isAbsolute(changed) ? path.relative(root, changed) : changed).split(path.sep).join("/");
	const setWatching = (now: boolean) =>
		Effect.andThen(
			Effect.flatMap(Ref.getAndSet(watching, now), (was) =>
				was === now ? Effect.void : Effect.andThen(stale, PubSub.publish(events, { _tag: "Watching", watching: now })),
			),
			Deferred.succeed(settled, undefined),
		);
	const watchOnce = fs.watch(root, { recursive: true }).pipe(
		Stream.tap(() => stale),
		Stream.map((event) => relative(event.path)),
		Stream.filter(isMarkdown),
		Stream.groupedWithin(BATCH, SETTLE),
		Stream.runForEach((paths) => PubSub.publish(events, { _tag: "Changed", paths: [...new Set(paths)] })),
		Effect.andThen(Effect.fail(new WatchEnded())),
	);
	const attempt = Effect.scoped(Effect.andThen(Effect.forkScoped(Effect.delay(setWatching(true), SETTLE)), watchOnce));
	yield* attempt.pipe(
		Effect.sandbox,
		Effect.tapError((cause) => Effect.andThen(setWatching(false), Effect.logWarning("Watching the folder failed; retrying", cause))),
		Effect.retry(RETRY),
		Effect.forkScoped,
	);
	yield* Deferred.await(settled);
	const files = Effect.gen(function* () {
		const now = yield* Ref.get(generation);
		const hit = Option.filter(yield* Ref.get(cached), (entry) => entry.generation === now);
		if ((yield* Ref.get(watching)) && Option.isSome(hit)) {
			return hit.value.files;
		}
		const listed = yield* listMarkdown(root, realRoot).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path));
		yield* Ref.set(cached, Option.some({ files: listed, generation: now }));
		return listed;
	});
	const changes: Changes = { events, files, realRoot, watching };
	return changes;
});
