import { Effect } from "effect";
import { vi } from "vitest";
import type { DraftInput } from "#browser/responses/schema.ts";
import type { FormClient } from "#client/react/FormContext.ts";

export function recordedResponse(input: DraftInput) {
	return { body: input.body, id: input.id, response: { ...input, recordedAt: 0, reviewedRevision: "a".repeat(64) } };
}
export function responseCommands(client: FormClient) {
	const register = vi.spyOn(client.responses.registerQuestion, "run").mockImplementation((input) =>
		Effect.succeed({
			context: "Reviewed context",
			id: "question.fixture",
			question: { ...input, deadline: 0, reason: "Which?", registeredAt: 0, reviewedRevision: input.revision, source: "question.md" },
		}),
	);
	const record = vi.spyOn(client.responses.recordResponse, "run").mockImplementation((input) => Effect.succeed(recordedResponse(input)));
	return { record, register };
}
