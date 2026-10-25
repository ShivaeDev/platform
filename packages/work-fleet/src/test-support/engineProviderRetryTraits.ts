import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function uncertainTurnEvidence(reason: "unavailable" | "protocol" | "ambiguous") {
	return engineConfiguration(`provider turn evidence is ${reason}`, () => ({
		decorateTransport: (transport) => ({
			...transport,
			observe: () =>
				Effect.fail(new SessionFailure({ message: "No matching accepted turn is observable; absence does not authorize replay", reason })),
		}),
	}));
}
export function capacityReadsFail(lostAcknowledgement: boolean, readRetryMs?: number) {
	return engineConfiguration("provider capacity prevents reading its accepted operation", (state) => {
		state.recovery.readsFail = true;
		const failure = new SessionFailure({ capacity: "serverOverloaded", message: "Capacity unavailable for thread/turns/list", reason: "rejected" });
		return {
			concurrency: 1,
			lostAcknowledgement,
			...(readRetryMs === undefined ? {} : { readRetryMs }),
			decorateTransport: (transport) => ({
				...transport,
				observe: (receipt) => {
					state.providerReads += 1;
					return state.recovery.readsFail ? Effect.fail(failure) : transport.observe(receipt);
				},
				reconcile: (input) => {
					state.providerReads += 1;
					return state.recovery.readsFail ? Effect.fail(failure) : transport.reconcile(input);
				},
			}),
		};
	});
}
export function submissionAtCapacity(structured = false) {
	return engineConfiguration("the provider rejects submissions at model capacity", (state) => {
		state.providerRejects = true;
		return {
			submissionFailure: () =>
				state.providerRejects
					? new SessionFailure({
							...(structured ? { capacity: "serverOverloaded" } : {}),
							message: "Selected model is at capacity",
							reason: "rejected",
						})
					: undefined,
		};
	});
}
export function rejectedSubmission(message: string) {
	return engineConfiguration("the provider rejects submission", () => ({
		submissionFailure: () => new SessionFailure({ message, reason: "rejected" }),
	}));
}
export function busyThread(message: string) {
	return engineConfiguration("the provider rejects turns on a busy thread", (state) => {
		state.providerRejects = true;
		return {
			submissionFailure: (call) => (state.providerRejects && call === "turn" ? new SessionFailure({ message, reason: "rejected" }) : undefined),
		};
	});
}
export function answerQueueCanFill() {
	return engineConfiguration("the provider answer queue can fill", (state) => {
		state.providerRejects = false;
		state.recovery.launch = { model: "initial-model" };
		return {
			launch: state.recovery.launch,
			submissionFailure: () =>
				state.providerRejects ? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" }) : undefined,
		};
	});
}
export function initialQueueFull(rejectedCall: "session" | "turn") {
	return engineConfiguration(`provider capacity rejects the first ${rejectedCall}`, (state) => {
		state.providerRejects = true;
		state.recovery.launch = { model: "initial-model" };
		return {
			launch: state.recovery.launch,
			submissionFailure: (call) =>
				state.providerRejects && call === rejectedCall
					? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" })
					: undefined,
			workerGuidance: "Follow synthetic worker conventions.",
		};
	});
}
