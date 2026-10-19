import { Cause, Effect, Schedule, Semaphore } from "effect";
import { SqlClient } from "effect/sql";
import { BadRequest, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { Fleet } from "#fleet.ts";
import { answerRecords } from "#host/answerRecords.ts";
import type { AnswerOptions } from "#host/answerWork.ts";
import type { FleetHost } from "#host/config.ts";
import type { FleetRecord } from "#model.ts";
import { admissionLockKey } from "#storage/admissionLockKey.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";

const RETRY = Schedule.min([Schedule.exponential("100 millis"), Schedule.spaced("5 seconds")]);

export const answerRequests = Effect.fn("FleetDaemon.answerRequests")(function* <R>(
	host: FleetHost,
	apply: (workId: string, options: AnswerOptions<unknown>) => Effect.Effect<{ readonly value: FleetRecord }, unknown, R>,
	recordingSql?: SqlClient.SqlClient,
) {
	const scope = yield* Effect.scope;
	const fleet = yield* Fleet;
	const store = yield* answerStore(host.namespace);
	const sql = yield* SqlClient.SqlClient;
	const recordingClient = recordingSql ?? sql;
	const recordingStore = yield* answerStore(host.namespace).pipe(Effect.provideService(SqlClient.SqlClient, recordingClient));
	const commit = yield* makeFleetTransaction;
	const locks = new Map<string, { readonly lock: Semaphore.Semaphore; users: number }>();
	function queue(request: AnswerRequest) {
		return commit(
			[],
			Effect.gen(function* () {
				yield* sql`select pg_advisory_xact_lock(hashtextextended(${admissionLockKey(host.namespace)}, 0))`;
				const queued = yield* fleet.queueAnswer(request.work_id, request.text);
				yield* store.finish(request);
				return queued;
			}),
		);
	}
	const process = Effect.fn("FleetAnswer.process")(function* (request: AnswerRequest) {
		if (request.decision_id === null) {
			yield* queue(request);
			return;
		}
		if (!taken((yield* fleet.get(request.work_id)).value, request)) {
			yield* apply(request.work_id, {
				beforePublish: (response) => store.recordResponse(request, response),
				originalDecision: { code: request.decision_code ?? undefined, reason: request.decision_reason },
				queue: () => queue(request),
				release: request.release,
				text: request.text,
			});
		}
		yield* store.finish(request);
	});
	const drain = Effect.fn("FleetAnswer.drain")(function* (workId: string) {
		while (true) {
			const request = (yield* store.list(workId))[0];
			if (request === undefined || request.error !== null) {
				return;
			}
			yield* process(request).pipe(
				Effect.catchCause((cause) =>
					Cause.hasInterrupts(cause) ? Effect.failCause(cause) : store.finish(request, failureMessage(Cause.squash(cause))),
				),
			);
		}
	});
	const start = Effect.fn("FleetAnswer.start")(function* (workId: string) {
		const entry = locks.get(workId) ?? { lock: Semaphore.makeUnsafe(1), users: 0 };
		entry.users += 1;
		locks.set(workId, entry);
		yield* entry.lock.withPermit(drain(workId).pipe(Effect.tapError(Effect.logError), Effect.retry(RETRY))).pipe(
			Effect.catchCause((cause) => (Cause.hasInterrupts(cause) ? Effect.void : Effect.logError(cause))),
			Effect.ensuring(
				Effect.sync(() => {
					entry.users -= 1;
					if (entry.users === 0) {
						locks.delete(workId);
					}
				}),
			),
			Effect.forkIn(scope),
		);
	});
	for (const workId of new Set((yield* store.list()).map((request) => request.work_id))) {
		yield* start(workId);
	}
	return Effect.fn("FleetAnswer.accept")(function* (workId: string, text = "", release = false) {
		const current = (yield* answerRecords(host.namespace, workId).pipe(Effect.provideService(SqlClient.SqlClient, recordingClient)))[0];
		if (current === undefined) {
			return yield* new NotFound({ message: `Unknown Board work ${workId}` });
		}
		if (text.length > 32_768) {
			return yield* new BadRequest({ message: "Supply an answer of at most 32768 characters" });
		}
		const queued = !release && text.trim() !== "" && ["repairing", "executing"].includes(current.stage);
		if (!queued && (current.stage !== "needs-human" || current.decision === undefined)) {
			return yield* new BadRequest({ message: `${workId} waits on no answer in stage ${current.stage}` });
		}
		if (!release && current.decision?.worker !== undefined && !text.trim()) {
			return yield* new BadRequest({ message: "Supply a nonempty answer for the worker as text or on stdin" });
		}
		yield* recordingStore.accept(workId, queued ? undefined : current.decision, text, release);
		yield* start(workId);
		return { ...current, blocker: ANSWER_RECORDED };
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
		|| (record.blocker === ANSWER_RECORDED && record.stage === "needs-human" && record.decision?.id === request.response_decision_id)
	);
}
