import { Effect } from "effect";
import type { initializeWorkerRelease } from "./initializeWorkerRelease.ts";

export function setWorkerReleaseActive(state: Effect.Success<typeof initializeWorkerRelease>) {
	return (next: boolean) =>
		state
			.locked(
				Effect.gen(function* () {
					if (next === state.active) {
						return;
					}
					state.active = next;
					yield* Effect.forEach(state.controls, (control) => control(state.active), { concurrency: "unbounded", discard: true });
				}),
			)
			.pipe(Effect.uninterruptible);
}
