import { Clock, Effect, FileSystem } from "effect";
import { makeResponse } from "@shivaedev/work-board/responses/make.ts";
import { publish } from "@shivaedev/work-board/responses/publish.ts";
import { responseMarkdown } from "@shivaedev/work-board/responses/records.ts";
import type { responseService } from "@shivaedev/work-board/responses/service.ts";
import type { BoardDecision } from "#board/schema.ts";
import { BoardGateway, type Decision, FleetFailure } from "#policy.ts";

export const recordDecisionResponse = Effect.fn("FleetHost.recordDecisionResponse")(function* (
	root: string,
	responses: Effect.Success<ReturnType<typeof responseService>>,
	decision: Decision & { readonly published: BoardDecision },
	action: "retry" | "release",
) {
	const board = yield* BoardGateway;
	const published = decision.published;
	const reading = yield* board.readDecision(published);
	if (reading._tag === "Stale" || reading._tag === "Ambiguous") {
		return yield* Effect.fail(new FleetFailure({ message: "Reconcile the exact decision response before answering", reason: "stale" }));
	}
	const id = `response.fleet-${action}.${published.questionId}`;
	if (reading._tag === "Response" && reading.response.id === id) {
		return id;
	}
	const input = {
		answers: [{ prompt: "fleet-action", selected: [action], text: "" }],
		author: "orchestrator",
		body: action === "release" ? "Release Fleet ownership." : "Retry Fleet work under trusted runtime policy.",
		id,
		question: published.questionId,
		...(reading._tag === "Response" ? { supersedes: reading.response.id } : {}),
		type: "answer" as const,
	};
	if (decision.worker === undefined) {
		return (yield* responses.record(input)).id;
	}
	const question = (yield* responses.read(published.questionId)).question;
	const response = makeResponse(input, question, yield* Clock.currentTimeMillis);
	const fs = yield* FileSystem.FileSystem;
	const realRoot = yield* fs.realPath(root);
	yield* publish(root, realRoot, id, responseMarkdown(response));
	return id;
});
