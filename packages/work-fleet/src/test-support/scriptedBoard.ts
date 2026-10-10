import { Effect, Layer } from "effect";
import type { RecordedResponse } from "@shivaedev/work-board/browser/responses/schema.ts";
import type { BoardDecision, BoardDecisionAcknowledgement } from "#board/schema.ts";
import { BoardFailure, BoardGateway, type BoardWork } from "#policy.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function scriptedBoard(options: EngineOptions, decisions: string[], getWork: (id: string) => Effect.Effect<BoardWork, BoardFailure>) {
	const publications = new Map<string, BoardDecision>();
	const responses = new Map<string, RecordedResponse>();
	const acknowledgements: BoardDecisionAcknowledgement[] = [];
	const acknowledgementAttempts: BoardDecisionAcknowledgement[] = [];
	let acknowledgementFailed = false;
	let failed = false;
	let count = 0;
	const layer = Layer.succeed(BoardGateway)({
		acknowledgeDecision: (input) =>
			Effect.gen(function* () {
				acknowledgementAttempts.push(input);
				if (options.acknowledgementQuery !== undefined) {
					yield* options.acknowledgementQuery(input);
				}
				if (options.acknowledgeFailure && !acknowledgementFailed) {
					acknowledgementFailed = true;
					return yield* Effect.fail(new BoardFailure({ message: "Board request acknowledgement unavailable" }));
				}
				if (!acknowledgements.some((prior) => prior.decision.questionId === input.decision.questionId)) {
					acknowledgements.push(input);
				}
			}),
		decision: (workId, input, original) =>
			Effect.gen(function* () {
				if (options.publishGate !== undefined) {
					yield* options.publishGate;
				}
				if (options.publishFailure && !failed) {
					failed = true;
					return yield* Effect.fail(new BoardFailure({ message: "Board publication unavailable" }));
				}
				const work = yield* original === undefined ? getWork(workId) : Effect.succeed(original);
				const receipt: BoardDecision = {
					itemId: `decision.${input.id}`,
					questionId: `question.${input.id}`,
					request: input.id,
					revision: "a".repeat(64),
					sourcePath: `responses/decision.${input.id}.md`,
					workId,
					workRevision: work.revision,
					workSourcePath: work.sourcePath,
				};
				publications.set(input.id, receipt);
				decisions.push(input.reason);
				return receipt;
			}),
		get: getWork,
		readDecision: (receipt) =>
			Effect.gen(function* () {
				if ((yield* getWork(receipt.workId)).revision !== receipt.workRevision) {
					return { _tag: "Stale" as const, reason: "Board work context changed" };
				}
				const response = responses.get(receipt.questionId);
				return response === undefined ? { _tag: "Pending" as const } : { _tag: "Response" as const, response };
			}),
	});
	function respond(decisionId: string, action: "retry" | "release", type: "answer" | "clarify" | "not_now" = "answer") {
		const receipt = publications.get(decisionId);
		if (receipt === undefined) {
			throw new Error("Decision must be published before a response is recorded");
		}
		count += 1;
		const id = `response.${count}`;
		responses.set(receipt.questionId, {
			body: "Human context",
			id,
			response: {
				answers: [{ prompt: "fleet-action", selected: [action], text: "" }],
				author: "Maintainer label",
				question: receipt.questionId,
				recordedAt: count,
				reviewedRevision: receipt.revision,
				type,
			},
		});
		return id;
	}
	return { acknowledgementAttempts, acknowledgements, layer, respond };
}
