import { AsyncLocalStorage } from "node:async_hooks";
import { Effect } from "effect";

export const authCallSignal = new AsyncLocalStorage<AbortSignal>();

export function authCall<A>(call: (signal: AbortSignal) => Promise<A>) {
	return Effect.tryPromise((signal) => authCallSignal.run(signal, () => call(signal)));
}
