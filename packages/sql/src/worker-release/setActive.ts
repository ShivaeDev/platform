import { Effect } from "effect";
import type { initializeWorkerRelease } from "./initialize.ts";

export function setActive(state: Effect.Success<typeof initializeWorkerRelease>) {
	return Effect.fn("WorkerRelease.setActive")(function* (next: boolean) {
		yield* state.lock
			.withPermits(1)(
				Effect.gen(function* () {
					if (next === state.active) {
						return;
					}
					state.active = next;
					yield* Effect.all(state.controls, { concurrency: "unbounded", discard: true });
				}),
			)
			.pipe(Effect.uninterruptible);
	});
}
