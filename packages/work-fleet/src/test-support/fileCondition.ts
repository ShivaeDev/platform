import { watch } from "node:fs";
import { Effect } from "effect";
import { changeSignal } from "#test/changeSignal.ts";

export function fileCondition<A, E, R>(root: string, read: Effect.Effect<A, E, R>, ready: (value: A) => boolean) {
	return Effect.scoped(
		Effect.gen(function* () {
			const changed = changeSignal();
			yield* Effect.acquireRelease(
				Effect.sync(() => watch(root, { recursive: true }, () => changed.notify())),
				(watcher) => Effect.sync(() => watcher.close()),
			);
			return yield* changed.wait(read, ready);
		}),
	);
}
