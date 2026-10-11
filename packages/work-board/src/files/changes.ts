import { Deferred, Effect, FileSystem, Option, Path, type PlatformError, PubSub, Ref, Schedule } from "effect";
import { registerInvalidations, trackInvalidations } from "./invalidations.ts";
import type { MarkdownFile } from "./list.ts";
import { updateFiles } from "./update.ts";
import { watchDirectories } from "./watchDirectories.ts";

export type Change = ({ readonly _tag: "Changed"; readonly paths: readonly string[] } | { readonly _tag: "Watching"; readonly watching: boolean }) & {
	readonly sequence?: number;
};

export interface Changes {
	readonly events: PubSub.PubSub<Change>;
	readonly files: Effect.Effect<readonly MarkdownFile[], PlatformError.PlatformError>;
	readonly realRoot: string;
	readonly refresh?: Effect.Effect<void>;
	readonly revision: Effect.Effect<number>;
	readonly sequence?: Effect.Effect<number>;
	readonly watching: Ref.Ref<boolean>;
}

interface Cached {
	readonly files: readonly MarkdownFile[];
	readonly generation: number;
}

const BACKLOG = 16;
const RETRY = Schedule.min([Schedule.exponential("100 millis"), Schedule.spaced("5 seconds")]);

export const watchChanges = Effect.fn("WorkBoard.watchChanges")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const realRoot = yield* fs.realPath(root);
	const events = yield* Effect.acquireRelease(PubSub.sliding<Change>(BACKLOG), PubSub.shutdown);
	const watching = yield* Ref.make(false);
	const generation = yield* Ref.make(0);
	const sequence = yield* Ref.make(0);
	function publish(change: Change) {
		return Effect.flatMap(
			Ref.updateAndGet(sequence, (value) => value + 1),
			(value) => PubSub.publish(events, { ...change, sequence: value }),
		);
	}
	const cached = yield* Ref.make(Option.none<Cached>());
	const settled = yield* Deferred.make<void>();
	let pending: Deferred.Deferred<void> | undefined;
	const observed = Effect.gen(function* () {
		if (pending === undefined) {
			pending = yield* Deferred.make<void>();
		}
	});
	const finishPending = Effect.suspend(() => {
		const done = pending;
		pending = undefined;
		return done ? Deferred.succeed(done, undefined) : Effect.void;
	});
	const invalidations = trackInvalidations();
	function invalidate(paths?: readonly string[]) {
		return Ref.update(generation, (count) => {
			invalidations.record(count + 1, paths);
			return count + 1;
		});
	}
	const stale = invalidate();
	function setWatching(now: boolean) {
		return Effect.andThen(
			Effect.flatMap(Ref.getAndSet(watching, now), (was) =>
				was === now ? Effect.void : Effect.andThen(stale, publish({ _tag: "Watching", watching: now })),
			),
			Effect.andThen(finishPending, Deferred.succeed(settled, undefined)),
		);
	}
	const attempt = watchDirectories(
		root,
		realRoot,
		stale,
		setWatching,
		(paths) => Effect.andThen(invalidate(paths), Effect.andThen(finishPending, publish({ _tag: "Changed", paths }))),
		observed,
	);
	yield* attempt.pipe(
		Effect.sandbox,
		Effect.tapError((cause) => Effect.andThen(setWatching(false), Effect.logWarning("Watching the folder failed; retrying", cause))),
		Effect.retry(RETRY),
		Effect.forkScoped,
	);
	yield* Deferred.await(settled);
	const files = Effect.gen(function* () {
		let waiting = pending;
		while (waiting) {
			yield* Deferred.await(waiting);
			waiting = pending;
		}
		const now = yield* Ref.get(generation);
		const hit = Option.filter(yield* Ref.get(cached), (entry) => entry.generation === now);
		if ((yield* Ref.get(watching)) && Option.isSome(hit)) {
			return hit.value.files;
		}
		const previous = yield* Ref.get(cached);
		const dirty = Option.isSome(previous) && (yield* Ref.get(watching)) ? invalidations.since(previous.value.generation) : undefined;
		const listed = yield* updateFiles(root, realRoot, Option.isSome(previous) ? previous.value.files : [], dirty).pipe(
			Effect.provideService(FileSystem.FileSystem, fs),
			Effect.provideService(Path.Path, path),
		);
		yield* Ref.set(cached, Option.some({ files: listed, generation: now }));
		return listed;
	});
	const changes: Changes = { events, files, realRoot, refresh: stale, revision: Ref.get(generation), sequence: Ref.get(sequence), watching };
	registerInvalidations(changes, invalidations);
	return changes;
});
