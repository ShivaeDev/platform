import { Effect } from "effect";
import type { initializeWorkerRelease } from "./initialize.ts";

export function registerWorkerRelease(state: Effect.Success<typeof initializeWorkerRelease>) {
	return Effect.fn("WorkerRelease.register")(function* <E>(control: (active: boolean) => Effect.Effect<void, E>) {
		const registered = Effect.suspend(() => control(state.active));
		const attach = Effect.gen(function* () {
			state.controls.add(registered);
			yield* registered;
		});
		const detach = Effect.sync(() => {
			state.controls.delete(registered);
		});
		return yield* Effect.acquireRelease(state.lock.withPermits(1)(attach), () => state.lock.withPermits(1)(detach));
	});
}
