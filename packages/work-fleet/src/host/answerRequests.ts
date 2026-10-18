import { Cause, Effect, Semaphore } from "effect";
import { SqlClient } from "effect/sql";
import { BadRequest, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { Fleet } from "#fleet.ts";
import { answerRecords } from "#host/answerRecords.ts";
import type { FleetHost } from "#host/config.ts";
import type { FleetRecord } from "#model.ts";
import type { Decision } from "#policy.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";

export const answerRequests = Effect.fn("FleetDaemon.answerRequests")(function* <R>(
	host: FleetHost,
	apply: (
		workId: string,
		text: string,
		release: boolean,
		original?: Pick<Decision, "code" | "reason">,
	) => Effect.Effect<{ readonly value: FleetRecord }, unknown, R>,
) {
	const scope = yield* Effect.scope;
	const fleet = yield* Fleet;
	const store = yield* answerStore(host.namespace);
	const sql = yield* SqlClient.SqlClient;
	const commit = yield* makeFleetTransaction;
	const locks = new Map<string, Semaphore.Semaphore>();
	const process = Effect.fn("FleetAnswer.process")(function* (request: AnswerRequest) {
		if (request.decision_id === null) {
			yield* commit(
				[],
				Effect.gen(function* () {
					yield* sql`select pg_advisory_xact_lock(hashtextextended(${`work_fleet_admission:${host.namespace}`}, 0))`;
					yield* fleet.queueAnswer(request.work_id, request.text);
					yield* store.finish(request);
				}),
			);
			return;
		}
		const current = (yield* fleet.get(request.work_id)).value;
		const receipts = [...(current.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(current.responses ?? [])];
		if (!receipts.some((receipt) => receipt.decisionId === request.decision_id)) {
			yield* apply(request.work_id, request.text, request.release, {
				code: request.decision_code ?? undefined,
				reason: request.decision_reason,
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
		const lock = locks.get(workId) ?? Semaphore.makeUnsafe(1);
		locks.set(workId, lock);
		yield* lock.withPermit(drain(workId)).pipe(
			Effect.catchCause((cause) => (Cause.hasInterrupts(cause) ? Effect.void : Effect.logError(cause))),
			Effect.forkIn(scope),
		);
	});
	for (const workId of new Set((yield* store.list()).map((request) => request.work_id))) {
		yield* start(workId);
	}
	return Effect.fn("FleetAnswer.accept")(function* (workId: string, text = "", release = false) {
		const current = (yield* answerRecords(host.namespace, workId))[0];
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
		yield* store.accept(workId, queued ? undefined : current.decision, text, release);
		yield* start(workId);
		return { ...current, blocker: ANSWER_RECORDED };
	});
});
