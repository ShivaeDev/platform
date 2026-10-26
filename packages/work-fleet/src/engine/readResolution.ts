import { Effect } from "effect";
import { BadRequest, Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import type { RecordedResponse } from "@shivaedev/work-board/server/integration/responses.ts";
import { releaseOnly } from "#engine/decisionCopy.ts";
import type { BoardGateway, Decision } from "#policy.ts";

export const readResolution = Effect.fn("Fleet.readResolution")(function* (
	board: typeof BoardGateway.Service,
	decision: Decision,
	responseId: string,
) {
	const published = decision.published;
	if (published === undefined) {
		return yield* Effect.fail(new Conflict({ message: "Board decision publication must be reconciled first" }));
	}
	const reading = yield* board.readDecision(published);
	if (reading._tag !== "Response" || reading.response.id !== responseId) {
		return yield* Effect.fail(new Conflict({ message: "Board response is missing, ambiguous, superseded or belongs to changed context" }));
	}
	const response = reading.response;
	if (response.response.question !== published.questionId || response.response.reviewedRevision !== published.revision) {
		return yield* Effect.fail(new Conflict({ message: "Response does not match the exact Board question" }));
	}
	if (response.response.type !== "answer") {
		return { action: undefined, published, response };
	}
	if (decision.worker !== undefined && !releaseSelected(response)) {
		if (response.body.trim().length === 0) {
			return yield* Effect.fail(new BadRequest({ message: "Record a nonempty answer for the worker" }));
		}
		return { action: "continue", published, response } as const;
	}
	const action = yield* guidedAction(response);
	if (action === "wait" && decision.code !== "session-stalled") {
		return yield* new BadRequest({ message: "Keep waiting is only available for a stalled worker" });
	}
	const explanation = releaseOnly(decision);
	if (action === "retry" && explanation !== undefined) {
		return yield* new BadRequest({ message: "This decision only permits release; choose release to stop and hand back" });
	}
	return { action, published, response } as const;
});

const guidedAction = Effect.fn("Fleet.guidedAction")(function* (response: RecordedResponse) {
	const answers = response.response.answers?.filter((answer) => answer.prompt === "fleet-action") ?? [];
	const selected = answers[0]?.selected;
	const action = selected?.[0];
	if (answers.length !== 1 || selected?.length !== 1 || (action !== "retry" && action !== "release" && action !== "wait")) {
		return yield* Effect.fail(new BadRequest({ message: "Choose one guided Fleet action; free text cannot authorize it" }));
	}
	return action;
});

function releaseSelected(response: RecordedResponse) {
	return response.response.answers?.some((answer) => answer.prompt === "fleet-action" && answer.selected.includes("release")) ?? false;
}
