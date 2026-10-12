import { Effect } from "effect";
import type { Question, RecordedResponse } from "#browser/responses/schema.ts";
import { browserClient } from "#client/client.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";
import { type FileSystemWrapper, folder, startBoard } from "#test/board.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

export const responseWorkspace = Effect.fn("Test.responseWorkspace")(function* (source = questionnaireSource, wrap?: FileSystemWrapper) {
	const notes = folder({ "proposal.md": source, "task.md": "# Affected work" });
	yield* Effect.addFinalizer(() => Effect.sync(() => notes.remove()));
	const board = yield* startBoard(notes.root, undefined, wrap, true);
	const client = browserClient(board.url);
	yield* Effect.addFinalizer(() => Effect.sync(() => client.registry.dispose()));
	return {
		board,
		client,
		notes,
		register: async () => {
			const preview = await client.run(client.responses.question.run({ item: "investigation.choices", request: "direction" }));
			return client.mutate(
				client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
			);
		},
	};
});

export function largeQuestion(question: Question): Question {
	const context = `${question.context}\n${"x".repeat(256 * 1024)}`;
	const reviewedRevision = revisionOf(context);
	return {
		context,
		id: questionId(question.question.item, question.question.request, reviewedRevision, question.question.source),
		question: { ...question.question, reviewedRevision },
	};
}

export function recordedEdgeResponse(question: Question, body = "Review the context."): RecordedResponse {
	return {
		body,
		id: "response.edge",
		response: {
			author: "reviewer",
			question: question.id,
			recordedAt: question.question.registeredAt + 1,
			reviewedRevision: question.question.reviewedRevision,
			type: "answer",
		},
	};
}
