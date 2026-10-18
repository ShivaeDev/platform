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
