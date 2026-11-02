import { Effect, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { ANSWER_RECORDED } from "#attention.ts";
import { Fleet } from "#fleet.ts";
import type { AnswerOptions } from "#host/answerWork.ts";
import type { FleetHost } from "#host/config.ts";
import type { FleetRecord } from "#model.ts";
import { admissionLockKey } from "#storage/admissionLockKey.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";

export const processAnswerRequest = Effect.fn("FleetAnswer.processAnswerRequest")(function* <R>(
	host: FleetHost,
	apply: (workId: string, options: AnswerOptions<unknown>) => Effect.Effect<{ readonly value: FleetRecord }, unknown, R>,
	finish: (request: AnswerRequest) => Effect.Effect<void, unknown>,
) {
	const fleet = yield* Fleet;
	const store = yield* answerStore(host.namespace);
	const sql = yield* SqlClient.SqlClient;
	const commit = yield* makeFleetTransaction;
	const events = yield* fleet.answerEvents();
	function applied(request: AnswerRequest, record: FleetRecord) {
		return PubSub.publish(events, {
			_tag: "Applied",
			decisionId: request.decision_id,
			record,
			responseId: request.response_id,
			workId: request.work_id,
		});
	}
	function queue(request: AnswerRequest) {
		return commit(
			[],
			Effect.gen(function* () {
				yield* sql`select pg_advisory_xact_lock(hashtextextended(${admissionLockKey(host.namespace)}, 0))`;
				const queued = yield* fleet.queueAnswer(request.work_id, request.text);
				yield* finish(request);
				return queued;
			}),
		);
	}
	return Effect.fn("FleetAnswer.process")(function* (request: AnswerRequest) {
		if (request.decision_id === null) {
			const queued = yield* queue(request);
			yield* applied(request, queued.value);
			return;
		}
		const current = (yield* fleet.get(request.work_id)).value;
		let settled = current.blocker === ANSWER_RECORDED ? undefined : current;
		if (!taken(current, request)) {
			const result = yield* apply(request.work_id, {
				beforePublish: (response) => store.recordResponse(request, response),
				originalDecision: { code: request.decision_code ?? undefined, reason: request.decision_reason },
				queue: () => queue(request),
				release: request.release,
				text: request.text,
			});
			settled = result.value.blocker === ANSWER_RECORDED ? undefined : result.value;
		}
		yield* finish(request);
		if (settled !== undefined) {
			yield* applied(request, settled);
		}
	});
});

// Fleet records a background answer with the ANSWER_RECORDED blocker and adds the receipt only once the Board
// resolution applies it, so a retry in between must not publish or queue the same answer again.
function taken(record: FleetRecord, request: AnswerRequest) {
	if (request.response_decision_id === null) {
		return false;
	}
	const receipts = [...(record.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(record.responses ?? [])];
	return (
		receipts.some((receipt) => receipt.decisionId === request.response_decision_id && receipt.responseId === request.response_id)
		|| (record.blocker === ANSWER_RECORDED && record.step === "waiting" && record.decision?.id === request.response_decision_id)
	);
}
