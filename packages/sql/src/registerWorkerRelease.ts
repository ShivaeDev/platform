import { Effect } from "effect";
import type { initializeWorkerRelease } from "./initializeWorkerRelease.ts";

export function registerWorkerRelease(state: Effect.Success<typeof initializeWorkerRelease>) {
	return function register<E>(control: (active: boolean) => Effect.Effect<void, E>) {
		const attach = Effect.gen(function* () {
			state.controls.add(control);
			yield* control(state.active);
		});
		const detach = Effect.sync(() => {
			state.controls.delete(control);
		});
		return Effect.acquireRelease(state.locked(attach), () => state.locked(detach));
	};
}
