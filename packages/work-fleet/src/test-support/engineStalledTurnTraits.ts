import { Effect } from "effect";
import { conflictingPr } from "#engine/deliveryFailure.ts";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { stalledProgress, stalledTransport } from "#test/parkStalled.ts";

export function stalledWorker() {
	return engineConfiguration("the worker stops making progress", (state) => {
		state.now = 0;
		return { decorateTransport: stalledTransport };
	});
}
export function stalledInterruptIsObserved() {
	return engineConfiguration("interruptions of a stalled worker are observed", (state) => ({
		decorateTransport: (transport) => ({
			...transport,
			interrupt: (receipt) =>
				Effect.sync(() => {
					state.recovery.interrupted.push(receipt.turnId);
					return receipt;
				}),
			observe: (receipt) => transport.observe(receipt).pipe(Effect.map(stalledProgress)),
		}),
	}));
}
export function stalledRole(role: "repair" | "reviewer") {
	return engineConfiguration(`the ${role} stops making progress`, () => ({
		decorateTransport: (transport) => ({ ...transport, observe: (receipt) => transport.observe(receipt).pipe(Effect.map(stalledProgress)) }),
		repairs: role === "repair",
		reviewRunning: role === "reviewer",
	}));
}
export function replacementTurnCanDisappear() {
	return engineConfiguration("a replacement turn can disappear while the provider rejects capacity", (state) => {
		state.now = 0;
		return {
			decorateTransport: (transport) => ({
				...transport,
				observe: (receipt) =>
					transport
						.observe(receipt)
						.pipe(
							Effect.map((observation) => (state.recovery.turnHidden ? { ...observation, execution: "running", turnMissing: true } : observation)),
						),
			}),
			reviewRunning: true,
			submissionFailure: (call) =>
				state.providerRejects && call === "turn"
					? new SessionFailure({ capacity: "serverOverloaded", message: "Synthetic capacity rejection", reason: "rejected" })
					: undefined,
		};
	});
}
export function wedgedConflictRepair() {
	return engineConfiguration("a conflicting PR's repair thread becomes unusable", (state) => {
		state.conflicting = true;
		let rejected = false;
		const rejection = new SessionFailure({
			code: "session-active-turn-exhausted",
			message: "The provider cannot accept another operation on this thread.",
			reason: "rejected",
		});
		return {
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) => {
					if (!rejected && input.prompt.includes("Fetch and merge main")) {
						rejected = true;
						return Effect.fail(rejection);
					}
					return transport.startTurn(input);
				},
			}),
			deliveryQuery: () => (state.conflicting ? Effect.fail(conflictingPr("main-revision")) : Effect.succeed(undefined)),
		};
	});
}
