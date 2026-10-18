import { Effect } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { SessionFailure, type StartSession } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

const missing = new SessionFailure({
	code: "session-turn-missing",
	message: "No matching accepted turn is observable; absence does not authorize replay",
	reason: "ambiguous",
});
const unavailable = new SessionFailure({ code: "session-unavailable", message: "Provider read unavailable", reason: "ambiguous" });
export function reviewTurnDisappears(readFailures: boolean) {
	return engineConfiguration("the submitted review turn disappears at the provider", (state) => {
		state.missingReviewOperation = undefined;
		state.providerReads = 0;
		return {
			decorateTransport: (transport) => ({
				...transport,
				reconcile: (input) => {
					if (input.operationId !== state.missingReviewOperation) {
						return transport.reconcile(input);
					}
					state.providerReads += 1;
					return Effect.fail(readFailures && state.providerReads < 4 ? unavailable : missing);
				},
				startTurn: (input) => {
					if (input.access !== "read-only" || state.missingReviewOperation !== undefined) {
						return transport.startTurn(input);
					}
					state.missingReviewOperation = input.operationId;
					return Effect.fail(readFailures ? unavailable : missing);
				},
			}),
			denyDelivery: true,
		};
	});
}
export function missingReviewSharesProviderBudget() {
	return engineConfiguration("missing review turns share a budget with provider rejections", (state) => {
		state.providerReviews = 0;
		return {
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) => {
					if (input.access !== "read-only") {
						return transport.startTurn(input);
					}
					state.providerReviews += 1;
					return Effect.fail(
						state.providerReviews < 5
							? missing
							: new SessionFailure({ capacity: "serverOverloaded", message: "Provider at capacity", reason: "rejected" }),
					);
				},
			}),
		};
	});
}
const native = codexAdapter(() => Effect.die("A lost thread has no provider lookup"), {
	beforeTurn: () => Effect.succeed({}),
	provisioning: "unknown",
	threadStart: () => ({}),
});
export function reviewAcknowledgementIsLost(exhausted: boolean) {
	return engineConfiguration("review acknowledgements are lost within the shared provider budget", (state) => {
		state.lostReviews = exhausted ? 4 : 1;
		state.providerReads = 0;

		function loseThread(input: StartSession, sessionId: string) {
			if (input.access !== "read-only") {
				return Effect.succeed(sessionId);
			}
			state.lostReviews -= 1;
			if (state.lostReviews < 0) {
				return Effect.succeed(sessionId);
			}
			state.providerReads += 1;
			return native.reconcile({ operationId: input.operationId }).pipe(
				Effect.mapError((error) => new SessionFailure({ code: "session-unavailable", message: error.message, reason: error.reason })),
				Effect.flatMap(() => Effect.die("A lost thread cannot be reconciled")),
			);
		}
		return {
			decorateTransport: (transport) => ({
				...transport,
				reconcile: (input) => {
					state.providerReads += 1;
					return native.reconcile(input);
				},
				startSession: (input) => transport.startSession(input).pipe(Effect.flatMap((sessionId) => loseThread(input, sessionId))),
			}),
			denyDelivery: true,
			submissionFailure: (call) =>
				call === "turn" && state.lostReviews < 0 && exhausted
					? new SessionFailure({ capacity: "serverOverloaded", message: "Provider at capacity", reason: "rejected" })
					: undefined,
		};
	});
}
