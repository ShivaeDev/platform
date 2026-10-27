import { Effect, FileSystem } from "effect";
import { BadRequest, Conflict } from "@shivaedev/errors/taxonomy.ts";
import { responses as responsesApi } from "@shivaedev/work-board/server/integration/responses.ts";
import { decisionResponseInput, publishDecisionResponse } from "#board/recordDecisionResponse.ts";
import type { BoardDecision } from "#board/schema.ts";
import { BoardGateway, type Decision } from "#policy.ts";

const { Responses } = responsesApi;

export const recordDecisionResponse = Effect.fn("FleetHost.recordDecisionResponse")(function* <E = never, R = never>(
	root: string,
	decision: Decision & { readonly published: BoardDecision },
	action: "retry" | "release",
	text?: string,
	beforePublish?: (responseId: string) => Effect.Effect<void, E, R>,
) {
	const responses = yield* Responses;
	const board = yield* BoardGateway;
	const published = decision.published;
	const reading = yield* board.readDecision(published);
	if (reading._tag !== "Pending" && reading._tag !== "Response") {
		return yield* Effect.fail(new Conflict({ message: "Reconcile the exact decision response before answering" }));
	}
	const id = `response.fleet-${action}.${published.questionId}`;
	if (reading._tag === "Response" && reading.response.id === id) {
		yield* beforePublish?.(id) ?? Effect.void;
		return id;
	}
	const input = yield* decisionResponseInput(decision, reading, action, text).pipe(
		Effect.mapError(() => new BadRequest({ message: "Invalid Board response; text must not exceed 32768 characters" })),
	);
	yield* beforePublish?.(id) ?? Effect.void;
	if (decision.worker === undefined && text === undefined) {
		return (yield* responses.record(input)).id;
	}
	const question = (yield* responses.read(published.questionId)).question;
	const fs = yield* FileSystem.FileSystem;
	return yield* publishDecisionResponse(root, yield* fs.realPath(root), input, question);
});
