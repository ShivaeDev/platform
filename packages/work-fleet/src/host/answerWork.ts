import { Effect } from "effect";
import { BadRequest, Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import type { FleetRecord } from "#model.ts";
import type { Decision } from "#policy.ts";

export function answerWork(host: FleetHost, workId: string, text = "", release = false) {
	return withDecisionResponses(
		host,
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const original = (yield* fleet.get(workId)).value.decision;
			let recorded: { readonly decisionId: string; readonly responseId: string } | undefined;
			return yield* Effect.gen(function* () {
				const current = (yield* fleet.get(workId)).value;
				if (recorded !== undefined && hasResponse(current, recorded)) {
					return yield* fleet.resolve(workId, recorded.decisionId, recorded.responseId);
				}
				if (canQueueAnswer(current, text, release)) {
					return yield* fleet.queueAnswer(workId, text);
				}
				yield* checkDecision(current, original);
				const response = yield* publishAnswer(host, workId, original, text, release);
				recorded = response;
				return yield* fleet
					.resolve(workId, response.decisionId, response.responseId)
					.pipe(Effect.catchTag("Conflict", (error) => decisionConflict(fleet, workId, response.decisionId, error)));
			}).pipe(
				Effect.retry({ while: (error) => error._tag === "StorageConflict" || (error._tag === "Conflict" && error.message === "Decision changed") }),
			);
		}),
	);
}

function checkDecision(record: FleetRecord, original: Decision | undefined) {
	const current = record.decision;
	if (original !== undefined && (record.stage !== "needs-human" || current === undefined || !sameKind(original, current))) {
		return Effect.fail(
			new Conflict({
				message: `Decision changed: ${record.stage === "needs-human" ? (current?.reason ?? record.blocker ?? record.stage) : (record.blocker ?? record.stage)}`,
			}),
		);
	}
	return record.stage === "needs-human" && current !== undefined
		? Effect.void
		: Effect.fail(new BadRequest({ message: `${record.workId} waits on no answer in stage ${record.stage}` }));
}

function sameKind(original: Decision, current: Decision) {
	return original.code === undefined ? original.code === current.code && original.reason === current.reason : original.code === current.code;
}

function hasResponse(record: FleetRecord, recorded: { readonly decisionId: string; readonly responseId: string }) {
	const receipts = [...(record.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(record.responses ?? [])];
	return receipts.some((receipt) => receipt.decisionId === recorded.decisionId && receipt.responseId === recorded.responseId);
}

const publishAnswer = Effect.fn("FleetHost.publishAnswer")(function* (
	host: FleetHost,
	workId: string,
	original: Decision | undefined,
	text: string,
	release: boolean,
) {
	const fleet = yield* Fleet;
	const stored = yield* fleet.publishDecision(workId);
	if (canQueueAnswer(stored.value, text, release)) {
		return yield* new Conflict({ message: "Decision changed" });
	}
	yield* checkDecision(stored.value, original);
	const decision = stored.value.decision;
	if (decision?.published === undefined) {
		return yield* new BadRequest({ message: `${workId} has no published question in stage ${stored.value.stage}` });
	}
	if (!release && decision.worker !== undefined && !text.trim()) {
		return yield* new BadRequest({ message: "Supply a nonempty answer for the worker as text or on stdin" });
	}
	const responseId = yield* recordDecisionResponse(
		host.boardDir,
		{ ...decision, published: decision.published },
		release ? "release" : "retry",
		text,
	).pipe(Effect.catchTag("Conflict", (error) => decisionConflict(fleet, workId, decision.id, error)));
	return { decisionId: decision.id, responseId };
});

const decisionConflict = Effect.fn("FleetHost.decisionConflict")(function* (
	fleet: typeof Fleet.Service,
	workId: string,
	decisionId: string,
	error: Conflict,
) {
	const current = (yield* fleet.get(workId)).value;
	return yield* Effect.fail(
		current.stage !== "needs-human" || current.decision?.id !== decisionId ? new Conflict({ message: "Decision changed" }) : error,
	);
});

function canQueueAnswer(record: FleetRecord, text: string, release: boolean) {
	return !release && text.trim() !== "" && ["repairing", "executing"].includes(record.stage);
}
