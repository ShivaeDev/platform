import { Effect } from "effect";
import type { SessionObservation } from "#session/schema.ts";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

const QUEUE_FULL = "Codex rejected the protocol request: App-server request queue is full. Please retry.";

export function providerCapacityRejected(rejectedCall?: "session" | "turn") {
	return engineConfiguration(`provider capacity rejects ${rejectedCall ?? "every submission"}`, (state) => {
		state.providerRejects = true;
		return {
			submissionFailure: (call) =>
				state.providerRejects && (rejectedCall === undefined || call === rejectedCall)
					? new SessionFailure({ code: "session-queue-full", message: QUEUE_FULL, reason: "rejected" })
					: undefined,
		};
	});
}

export function permanentProviderRejection() {
	return engineConfiguration("the provider permanently rejects submission despite queue-full wording", () => ({
		submissionFailure: () => new SessionFailure({ code: "session-rejected", message: QUEUE_FULL, reason: "rejected" }),
	}));
}

export function ambiguousProviderRejection() {
	return engineConfiguration("the provider cannot establish whether the queue-full submission was accepted", () => ({
		submissionFailure: () => new SessionFailure({ message: QUEUE_FULL, reason: "ambiguous" }),
	}));
}

export function terminalCapacity(reviewer: boolean, message: string, capacity?: SessionObservation["capacity"]) {
	return engineConfiguration("the terminal turn reports provider capacity", (state) => {
		state.providerRejects = true;
		function failCapacity(observation: SessionObservation): SessionObservation {
			const isReviewer = observation.output.includes("FLEET_REVIEW:");
			return state.providerRejects && isReviewer === reviewer ? { ...observation, capacity, error: message, execution: "failed" } : observation;
		}
		return { decorateTransport: (transport) => ({ ...transport, observe: (receipt) => transport.observe(receipt).pipe(Effect.map(failCapacity)) }) };
	});
}

export const terminalCapacityCases = (["serverOverloaded", undefined] as const).flatMap((capacity) =>
	[false, true].flatMap((reviewer) =>
		[false, true].map((clears) => ({
			capacity,
			clears,
			message: capacity === undefined ? "Selected model is at capacity. Please try a different model." : "Selected model is at capacity",
			reviewer,
		})),
	),
);
