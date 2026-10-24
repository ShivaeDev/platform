import { Effect } from "effect";
import type { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export function exhaustedQuestionThread(controls: {
	readonly unusableSession: () => string | undefined;
	readonly rejection: () => SessionFailure;
	readonly now: () => number;
}) {
	return engineConfiguration("exhausted question thread", () => ({
		decorateTransport: (transport) => ({
			...transport,
			startTurn: (input) => (input.sessionId === controls.unusableSession() ? Effect.fail(controls.rejection()) : transport.startTurn(input)),
		}),
		now: () => controls.now(),
	}));
}

export function failedAnswerSubmission(controls: { readonly fail: () => boolean; readonly failure: () => SessionFailure }) {
	return engineConfiguration("failed answer submission", () => ({
		submissionFailure: (call) => (controls.fail() && call === "turn" ? controls.failure() : undefined),
	}));
}
