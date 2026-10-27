import { Clock, Effect, Schema } from "effect";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { type Question, type DraftInput as ResponseInput, responses } from "@shivaedev/work-board/server/integration/responses.ts";
import { decisionReading } from "#board/decisionReading.ts";
import type { BoardDocument } from "#board/documents.ts";
import { recordBoardSource } from "#board/readPass.ts";
import type { BoardDecision, BoardDecisionReading } from "#board/schema.ts";
import { BoardFailure, type Decision } from "#policy.ts";

const { DraftInput, makeResponse, publish, readResponses, responseMarkdown } = responses;

export function recordDecisionResponse(root: string, realRoot: string, documents: Effect.Effect<readonly BoardDocument[], BoardFailure>) {
	return Effect.fn("FleetBoard.respond")(function* (
		decision: Decision & { readonly published: BoardDecision },
		action: "retry" | "release",
		text?: string,
	) {
		const reading = yield* decisionReading(documents)(decision.published);
		if (reading._tag !== "Pending" && reading._tag !== "Response") {
			return yield* new BoardFailure({ message: "Reconcile the exact decision response before answering" });
		}
		const id = `response.fleet-${action}.${decision.published.questionId}`;
		if (reading._tag === "Response" && reading.response.id === id) {
			return id;
		}
		const input = yield* decisionResponseInput(decision, reading, action, text).pipe(
			Effect.mapError(() => new BoardFailure({ message: "Invalid Board response; text must not exceed 32768 characters" })),
		);
		const all = yield* documents;
		const snapshot = Effect.succeed({
			documents: all,
			entries: [],
			model: board.metadataModel(all),
			modified: new Map<string, number>(),
			revision: 0,
			unavailable: [],
		});
		const { question } = yield* readResponses(snapshot)(decision.published.questionId).pipe(
			Effect.mapError((error) => new BoardFailure({ message: error.message })),
		);
		return yield* publishDecisionResponse(root, realRoot, input, question).pipe(
			Effect.mapError((error) => new BoardFailure({ message: error.message })),
		);
	});
}

export function decisionResponseInput(
	decision: Decision & { readonly published: BoardDecision },
	reading: Extract<BoardDecisionReading, { readonly _tag: "Pending" | "Response" }>,
	action: "retry" | "release",
	text?: string,
) {
	return Schema.decodeUnknownEffect(DraftInput)({
		...(decision.worker !== undefined && action !== "release" ? {} : { answers: [{ prompt: "fleet-action", selected: [action], text: "" }] }),
		author: "orchestrator",
		body: text ?? (action === "release" ? "Release Fleet ownership." : "Retry Fleet work under trusted runtime policy."),
		id: `response.fleet-${action}.${decision.published.questionId}`,
		question: decision.published.questionId,
		...(reading._tag === "Response" ? { supersedes: reading.response.id } : {}),
		type: "answer",
	});
}

export const publishDecisionResponse = Effect.fn("FleetBoard.publishDecisionResponse")(function* (
	root: string,
	realRoot: string,
	input: ResponseInput,
	question: Question,
) {
	const content = responseMarkdown(makeResponse(input, question, yield* Clock.currentTimeMillis));
	yield* publish(root, realRoot, input.id, content);
	yield* recordBoardSource(realRoot, `responses/${input.id}.md`, content);
	return input.id;
});
