import { Effect } from "effect";
import { GitHub } from "#github/service.ts";
import type { Options, Snapshot } from "#model.ts";

export const observe = Effect.fn("Watcher.observe")(function* (
	options: Options,
	number: number,
	queue: ReadonlySet<number>,
	before: Snapshot | undefined,
) {
	const github = yield* GitHub;
	const snapshot = yield* github.snapshot(options, number, queue);
	if (snapshot === undefined) {
		return undefined;
	}
	return before?.queued === true && snapshot.state === "open" && !snapshot.merged && !snapshot.queued
		? yield* github.confirmQueue(options, snapshot)
		: snapshot;
});
