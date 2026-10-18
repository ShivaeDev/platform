import { Clock, Effect, FileSystem, Schema } from "effect";
import { BadRequest, Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import { responses as responsesApi } from "@shivaedev/work-board/server/integration/responses.ts";
import type { BoardDecision } from "#board/schema.ts";
import { BoardGateway, type Decision } from "#policy.ts";

const { DraftInput, makeResponse, publish, Responses, responseMarkdown } = responsesApi;

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
	if (reading._tag === "Stale" || reading._tag === "Ambiguous") {
		return yield* Effect.fail(new Conflict({ message: "Reconcile the exact decision response before answering" }));
	}
	const id = `response.fleet-${action}.${published.questionId}`;
	if (reading._tag === "Response" && reading.response.id === id) {
		yield* beforePublish?.(id) ?? Effect.void;
		return id;
	}
	const input = yield* Schema.decodeUnknownEffect(DraftInput)({
		...(decision.worker !== undefined && action !== "release" ? {} : { answers: [{ prompt: "fleet-action", selected: [action], text: "" }] }),
		author: "orchestrator",
		body: text ?? (action === "release" ? "Release Fleet ownership." : "Retry Fleet work under trusted runtime policy."),
		id,
		question: published.questionId,
		...(reading._tag === "Response" ? { supersedes: reading.response.id } : {}),
		type: "answer",
	}).pipe(Effect.mapError(() => new BadRequest({ message: "Invalid Board response; text must not exceed 32768 characters" })));
	yield* beforePublish?.(id) ?? Effect.void;
	if (decision.worker === undefined && text === undefined) {
		return (yield* responses.record(input)).id;
	}
	const question = (yield* responses.read(published.questionId)).question;
	const response = makeResponse(input, question, yield* Clock.currentTimeMillis);
	const fs = yield* FileSystem.FileSystem;
	const realRoot = yield* fs.realPath(root);
	yield* publish(root, realRoot, id, responseMarkdown(response));
	return id;
});
