import { Effect, Predicate } from "effect";
import { BadRequest, Conflict } from "@shivaedev/errors/taxonomy.ts";
import { Fleet } from "#fleet.ts";
import type { FleetHost } from "#host/config.ts";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import type { FleetRecord } from "#model.ts";
import type { Decision, DecisionResponse } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export interface AnswerOptions<E = never, R = never> {
	readonly background?: boolean;
	readonly beforePublish?: (response: Pick<DecisionResponse, "decisionId" | "responseId">) => Effect.Effect<void, E, R>;
	readonly originalDecision?: Pick<Decision, "code" | "reason">;
	readonly queue?: () => Effect.Effect<Versioned<FleetRecord>, E, R>;
	readonly release?: boolean;
	readonly text?: string;
}

export const answerWork = Effect.fn("FleetHost.answerWork")(function* <E = never, R = never>(
	host: FleetHost,
	workId: string,
	options: AnswerOptions<E, R> = {},
) {
	const { text = "", release = false, background = false, originalDecision, beforePublish, queue } = options;
	const fleet = yield* Fleet;
	const resolve = background ? fleet.recordResponse : fleet.resolve;
	const original = originalDecision ?? (yield* fleet.get(workId)).value.decision;
	let recorded: { readonly decisionId: string; readonly responseId: string } | undefined;
	return yield* Effect.gen(function* () {
		const current = (yield* fleet.get(workId)).value;
		if (recorded !== undefined && hasResponse(current, recorded)) {
			return yield* resolve(workId, recorded.decisionId, recorded.responseId);
		}
		if (canQueueAnswer(current, text, release)) {
			return yield* queue?.() ?? fleet.queueAnswer(workId, text);
		}
		yield* checkDecision(current, original);
		const released = release && current.decision !== undefined ? yield* fleet.releaseClosed(workId, current.decision.id) : undefined;
		if (released !== undefined) {
			return released;
		}
		const response = yield* publishAnswer(host, workId, original, text, release, beforePublish);
		recorded = response;
		return yield* resolve(workId, response.decisionId, response.responseId).pipe(
			Effect.catchTag("Conflict", (error) => decisionConflict(fleet, workId, response.decisionId, error)),
		);
	}).pipe(
		Effect.retry({
			while: (error) => Predicate.isTagged(error, "StorageConflict") || (error instanceof Conflict && error.message === "Decision changed"),
		}),
	);
});

function checkDecision(record: FleetRecord, original: Pick<Decision, "code" | "reason"> | undefined) {
	const current = record.decision;
	if (original !== undefined && (record.step !== "waiting" || current === undefined || !sameKind(original, current))) {
		return Effect.fail(
			new Conflict({
				message: `Decision changed: ${record.step === "waiting" ? (current?.reason ?? record.blocker ?? record.step) : (record.blocker ?? record.step)}`,
			}),
		);
	}
	return record.step === "waiting" && current !== undefined
		? Effect.void
		: Effect.fail(new BadRequest({ message: `${record.workId} waits on no answer in step ${record.step}` }));
}

function sameKind(original: Pick<Decision, "code" | "reason">, current: Decision) {
	return original.code === undefined ? original.code === current.code && original.reason === current.reason : original.code === current.code;
}

function hasResponse(record: FleetRecord, recorded: { readonly decisionId: string; readonly responseId: string }) {
	const receipts = [...(record.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(record.responses ?? [])];
	return receipts.some((receipt) => receipt.decisionId === recorded.decisionId && receipt.responseId === recorded.responseId);
}

const publishAnswer = Effect.fn("FleetHost.publishAnswer")(function* <E, R>(
	host: FleetHost,
	workId: string,
	original: Pick<Decision, "code" | "reason"> | undefined,
	text: string,
	release: boolean,
	beforePublish: ((response: Pick<DecisionResponse, "decisionId" | "responseId">) => Effect.Effect<void, E, R>) | undefined,
) {
	const fleet = yield* Fleet;
	const stored = yield* fleet.publishDecision(workId);
	if (canQueueAnswer(stored.value, text, release)) {
		return yield* new Conflict({ message: "Decision changed" });
	}
	yield* checkDecision(stored.value, original);
	const decision = stored.value.decision;
	if (decision?.published === undefined) {
		return yield* new BadRequest({ message: `${workId} has no published question in step ${stored.value.step}` });
	}
	if (!release && decision.worker !== undefined && !text.trim()) {
		return yield* new BadRequest({ message: "Supply a nonempty answer for the worker as text or on stdin" });
	}
	const responseId = yield* recordDecisionResponse(
		host.boardDir,
		{ ...decision, published: decision.published },
		release || (decision.worker === undefined && text.trim() === "release") ? "release" : "retry",
		text,
		(selectedId) => beforePublish?.({ decisionId: decision.id, responseId: selectedId }) ?? Effect.void,
	).pipe(
		Effect.catchIf(
			(error): error is Conflict => error instanceof Conflict,
			(error) => decisionConflict(fleet, workId, decision.id, error),
		),
	);
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
		current.step !== "waiting" || current.decision?.id !== decisionId ? new Conflict({ message: "Decision changed" }) : error,
	);
});

function canQueueAnswer(record: FleetRecord, text: string, release: boolean) {
	return !release && text.trim() !== "" && ["repairing", "working"].includes(record.step);
}
