import { Cause, Effect, FileSystem, Path, Queue, Schedule } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

const PREFIX = ".work-board-watch-";

export const READINESS_WITHIN = "5 seconds";

// Node's watchers have no registered event, and macOS drops a write made right after fs.watch returns now and then.
const RETOUCH = Schedule.spaced("50 millis");

export function isWatchSentinel(path: string): boolean {
	return (path.split(/[\\/]/u).at(-1) ?? "").startsWith(PREFIX);
}

export function watcherEnded() {
	return new ServiceUnavailable({ message: "The workspace watcher ended. Retrying the watch automatically." });
}

export const watchSentinel = Effect.fn("WorkBoard.watchSentinel")(function* (
	realRoot: string,
	events: Queue.Dequeue<string, PlatformError | Cause.Done>,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const name = `${PREFIX}${crypto.randomUUID()}`;
	const file = path.join(realRoot, name);
	// Events before the sentinel's precede the first scan, which reads their files anyway.
	const reported = Queue.take(events).pipe(
		Effect.repeat({ until: (relative) => relative === name }),
		Effect.catchIf(Cause.isDone, () => Effect.fail(watcherEnded())),
	);
	const touched = Effect.uninterruptible(fs.writeFileString(file, "")).pipe(Effect.repeat(RETOUCH), Effect.andThen(Effect.never));
	yield* Effect.raceFirst(reported, touched).pipe(
		Effect.timeoutOrElse({
			duration: READINESS_WITHIN,
			orElse: () =>
				Effect.fail(
					new ServiceUnavailable({
						message: `The workspace watcher did not report a change within ${READINESS_WITHIN}. Retrying the watch automatically.`,
					}),
				),
		}),
		Effect.ensuring(Effect.ignore(fs.remove(file, { force: true }))),
	);
});
