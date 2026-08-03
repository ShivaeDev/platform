import type { Semaphore } from "effect";
import { Effect } from "effect";

export const executeQuery = <A, E, R>(
	executor: { readonly querySemaphore: Semaphore.Semaphore | undefined },
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
	executor.querySemaphore === undefined
		? effect
		: executor.querySemaphore.withPermit(Effect.uninterruptible(effect));
