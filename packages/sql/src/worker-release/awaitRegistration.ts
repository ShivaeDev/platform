import { Effect } from "effect";
import type { initializeWorkerRelease } from "#worker-release/initialize.ts";

export function awaitRegistration(state: Effect.Success<typeof initializeWorkerRelease>) {
	return Effect.fn("WorkerRelease.awaitRegistration")(function* () {
		yield* state.registered.await;
	});
}
