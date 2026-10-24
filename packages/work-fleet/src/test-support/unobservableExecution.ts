import { Effect } from "effect";
import type { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function unobservableExecution(controls: { readonly failure: () => SessionFailure; readonly now: () => number }) {
	return (): EngineOptions => ({
		decorateTransport: (transport) => ({
			...transport,
			reconcile: () => Effect.fail(controls.failure()),
			startSession: () => Effect.fail(controls.failure()),
		}),
		now: () => controls.now(),
	});
}
