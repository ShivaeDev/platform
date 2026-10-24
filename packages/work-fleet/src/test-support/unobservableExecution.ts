import { Effect } from "effect";
import type { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export function unobservableExecution(controls: { readonly failure: () => SessionFailure; readonly now: () => number }) {
	return engineConfiguration("unobservable execution", () => ({
		decorateTransport: (transport) => ({
			...transport,
			reconcile: () => Effect.fail(controls.failure()),
			startSession: () => Effect.fail(controls.failure()),
		}),
		now: () => controls.now(),
	}));
}
