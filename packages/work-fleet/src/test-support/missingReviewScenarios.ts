import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineScenario } from "#test/engineScenario.ts";

const missing = new SessionFailure({
	code: "session-turn-missing",
	message: "No matching accepted turn is observable; absence does not authorize replay",
	reason: "ambiguous",
});
const unavailable = new SessionFailure({ code: "session-unavailable", message: "Provider read unavailable", reason: "ambiguous" });

export function reviewTurnDisappears(readFailures: boolean) {
	return engineScenario("the submitted review turn disappears at the provider", () => {
		let now = 100;
		let operationId: string | undefined;
		let reads = 0;
		return {
			context: {
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
				get operationId() {
					return operationId;
				},
				set operationId(value: typeof operationId) {
					operationId = value;
				},
				get reads() {
					return reads;
				},
				set reads(value: typeof reads) {
					reads = value;
				},
			},
			options: {
				decorateTransport: (transport) => ({
					...transport,
					reconcile: (input) => {
						if (input.operationId !== operationId) {
							return transport.reconcile(input);
						}
						reads += 1;
						return Effect.fail(readFailures && reads < 4 ? unavailable : missing);
					},
					startTurn: (input) => {
						if (input.access !== "read-only" || operationId !== undefined) {
							return transport.startTurn(input);
						}
						operationId = input.operationId;
						return Effect.fail(readFailures ? unavailable : missing);
					},
				}),
				denyDelivery: true,
				now: () => now,
			},
		};
	});
}
export function missingReviewSharesProviderBudget() {
	return engineScenario("missing review turns share a budget with provider rejections", () => {
		let now = 100;
		let reviews = 0;
		return {
			context: {
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
				get reviews() {
					return reviews;
				},
				set reviews(value: typeof reviews) {
					reviews = value;
				},
			},
			options: {
				decorateTransport: (transport) => ({
					...transport,
					startTurn: (input) => {
						if (input.access !== "read-only") {
							return transport.startTurn(input);
						}
						reviews += 1;
						return Effect.fail(
							reviews < 5 ? missing : new SessionFailure({ capacity: "serverOverloaded", message: "Provider at capacity", reason: "rejected" }),
						);
					},
				}),
				now: () => now,
			},
		};
	});
}
