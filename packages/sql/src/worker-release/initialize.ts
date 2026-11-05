import { Effect, Semaphore } from "effect";

export const initializeWorkerRelease = Effect.sync(() => ({
	active: false,
	controls: new Set<Effect.Effect<void, unknown>>(),
	lock: Semaphore.makeUnsafe(1),
}));
