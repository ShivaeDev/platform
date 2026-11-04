import { Effect } from "effect";
import { GitHub } from "#GitHub.ts";
import type { Options, Snapshot } from "#model.ts";

export const observe = Effect.gen(function* () {
	const github = yield* GitHub;
	return (options: Options, number: number, queue: ReadonlySet<number>, before: Snapshot | undefined) =>
		Effect.gen(function* () {
			const snapshot = yield* github.snapshot(options, number, queue);
			if (snapshot === undefined) {
				return undefined;
			}
			return before?.queued === true && snapshot.state === "open" && !snapshot.merged && !snapshot.queued
				? yield* github.confirmQueue(options, snapshot)
				: snapshot;
		});
});
