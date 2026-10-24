import { Effect } from "effect";
import type { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function exhaustedQuestionThread(controls: {
	readonly unusableSession: () => string | undefined;
	readonly rejection: () => SessionFailure;
	readonly now: () => number;
}) {
	return (): EngineOptions => ({
		decorateTransport: (transport) => ({
			...transport,
			startTurn: (input) => (input.sessionId === controls.unusableSession() ? Effect.fail(controls.rejection()) : transport.startTurn(input)),
		}),
		now: () => controls.now(),
	});
}

export function failedAnswerSubmission(controls: { readonly fail: () => boolean; readonly failure: () => SessionFailure }) {
	return (): EngineOptions => ({
		submissionFailure: (call) => (controls.fail() && call === "turn" ? controls.failure() : undefined),
	});
}
