import { Context, Effect, FileSystem, Option, Path, PubSub, Schedule, Semaphore, Stream } from "effect";
import { isMarkdown } from "#path/isMarkdown.ts";
import { type Change, type Changes, watchChanges } from "#server/files/changes.ts";
import { IndexProgress } from "./IndexProgress.ts";
import { type Snapshot, searchSnapshot } from "./snapshot.ts";

function changedPaths(before: Snapshot, after: Snapshot) {
	const previous = new Map(before.documents.map((document) => [document.file, document]));
	const next = new Map(after.documents.map((document) => [document.file, document]));
	return [...new Set([...before.modified.keys(), ...after.modified.keys()])].filter(
		(file) => previous.get(file) !== next.get(file) || before.modified.get(file) !== after.modified.get(file),
	);
}

export const watchIndex = Effect.fn("WorkBoard.watchIndex")(function* (root: string, home?: string, maintainer?: string) {
	const platform = (yield* Effect.context<FileSystem.FileSystem | Path.Path>()).pipe(Context.pick(FileSystem.FileSystem, Path.Path));
	const source = yield* watchChanges(root);
	const indexing = yield* Effect.serviceOption(IndexProgress);
	const snapshot = yield* searchSnapshot(root, home, source, maintainer, Option.getOrUndefined(indexing));
	const read = snapshot.pipe(Effect.provideContext(platform));
	const events = yield* Effect.acquireRelease(PubSub.sliding<Change>(16), PubSub.shutdown);
	const subscription = yield* PubSub.subscribe(source.events);
	const semaphore = yield* Semaphore.make(1);
	let previous: Snapshot | undefined;
	let sequence = 0;
	function publish(change: Change) {
		sequence += 1;
		return PubSub.publish(events, { ...change, sequence });
	}
	function synchronize(change?: Change) {
		return semaphore.withPermit(
			Effect.gen(function* () {
				if (change?._tag === "Watching") {
					yield* publish(change);
				}
				const current = yield* read;
				const paths = previous ? changedPaths(previous, current) : [];
				previous = current;
				const attachments = change?._tag === "Changed" ? change.paths.filter((file) => !isMarkdown(file)) : [];
				if (paths.length + attachments.length > 0) {
					yield* publish({ _tag: "Changed", paths: [...new Set([...paths, ...attachments])] });
				}
			}),
		);
	}
	const check = Effect.andThen(source.refresh ?? Effect.void, synchronize());
	function recover<A, E>(effect: Effect.Effect<A, E>) {
		return effect.pipe(Effect.catch((error) => Effect.logWarning("The Board index could not refresh", error)));
	}
	yield* Effect.forkScoped(
		Effect.gen(function* () {
			yield* recover(synchronize());
			yield* Stream.fromSubscription(subscription).pipe(Stream.runForEach((change) => recover(synchronize(change))));
		}),
	);
	yield* recover(check).pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.delay("1 minute"), Effect.forkScoped);
	const changes: Changes = { ...source, events, sequence: Effect.sync(() => sequence) };
	return { changes, read, reconcile: check };
});
