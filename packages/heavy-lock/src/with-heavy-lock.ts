import { Effect, Layer, Scope } from "effect";
import { acquireHeavyLock, type HeavyLockOptions, type HeavyLockServices } from "./acquire.ts";
import type { HeavyLockError } from "./error.ts";
import { HeldLock } from "./held-lock.ts";

export function withHeavyLock<A, E, R>(
	effect: Effect.Effect<A, E, R>,
	options?: HeavyLockOptions,
): Effect.Effect<A, E | HeavyLockError, Exclude<R, HeldLock> | HeavyLockServices> {
	return Effect.scopedWith((scope) =>
		Effect.flatMap(Effect.provideService(acquireHeavyLock(options), Scope.Scope, scope), (held) => Effect.provideService(effect, HeldLock, held)),
	);
}

export function heavyLockLayer(options?: HeavyLockOptions): Layer.Layer<HeldLock, HeavyLockError, HeavyLockServices> {
	return Layer.effect(HeldLock, acquireHeavyLock(options));
}
