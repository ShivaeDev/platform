import { Effect, Semaphore } from "effect";

export const initializeWorkerRelease = Effect.sync(() => ({
	active: false,
	controls: new Set<(active: boolean) => Effect.Effect<void, unknown>>(),
	locked: Semaphore.makeUnsafe(1).withPermits(1),
}));
