import { browserClient } from "#browser/client.ts";
import type { Question, RecordedResponse } from "#browser/responses/schema.ts";
import { questionId, revisionOf } from "#responses/records.ts";
import { type FileSystemWrapper, folder, startBoard } from "#test/board.ts";
import { questionnaireSource } from "#test/questionnaire.ts";

export async function responseWorkspace(source = questionnaireSource, wrap?: FileSystemWrapper) {
	const notes = folder({ "proposal.md": source, "task.md": "# Affected work" });
	const board = await startBoard(notes.root, undefined, wrap, true);
	const client = browserClient(board.url);
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
		stop: async () => {
			client.registry.dispose();
			await board.stop();
			notes.remove();
		},
	};
}

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
