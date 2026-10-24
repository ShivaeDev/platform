import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { TIMEOUT, timeoutProvider } from "#test/timeoutProvider.ts";

export function timedOutSubmission(landed: boolean, priorTurn: boolean) {
	return engineConfiguration("the worker's submission times out before its acceptance is known", (state) => {
		const provider = timeoutProvider(landed, priorTurn);
		state.recovery.timeout = provider.state;
		return { decorateTransport: provider.decorateTransport, denyDelivery: true };
	});
}
export function providerReadsKeepTimingOut() {
	return engineConfiguration("provider acceptance and every recovery read time out", () => ({
		decorateTransport: (transport) => ({
			...transport,
			reconcile: () => Effect.fail(new SessionFailure({ message: TIMEOUT, reason: "unavailable" })),
		}),
		submissionFailure: () => new SessionFailure({ message: TIMEOUT, reason: "unavailable" }),
	}));
}
