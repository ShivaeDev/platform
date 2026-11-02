import { Cause, Effect, PubSub, Schedule, Semaphore } from "effect";
import { SqlClient } from "effect/sql";
import { BadRequest, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { Fleet } from "#fleet.ts";
import { answerRecords } from "#host/answerRecords.ts";
import type { AnswerOptions } from "#host/answerWork.ts";
import type { FleetHost } from "#host/config.ts";
import { processAnswerRequest } from "#host/processAnswerRequest.ts";
import type { FleetRecord } from "#model.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";

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
	const locks = new Map<string, { readonly lock: Semaphore.Semaphore; users: number }>();
	const events = yield* fleet.answerEvents();
	function finish(request: AnswerRequest, error?: string) {
		return store
			.finish(request, error)
			.pipe(Effect.tapError(() => PubSub.publish(events, { _tag: "CompletionFailed", requestId: request.request_id, workId: request.work_id })));
	}
	const process = yield* processAnswerRequest(host, apply, finish);

	function failed(request: AnswerRequest, cause: Cause.Cause<unknown>) {
		if (Cause.hasInterrupts(cause)) {
			return Effect.failCause(cause);
		}
		return Effect.logError(`Failed to apply answer for ${request.work_id}`, cause).pipe(
			Effect.andThen(finish(request, failureMessage(Cause.squash(cause)))),
			Effect.andThen(
				PubSub.publish(events, {
					_tag: "Refused",
					decisionId: request.decision_id,
					reason: failureMessage(Cause.squash(cause)),
					requestId: request.request_id,
					workId: request.work_id,
				}),
			),
		);
	}
	const drain = Effect.fn("FleetAnswer.drain")(function* (workId: string) {
		while (true) {
			const request = (yield* store.list(workId))[0];
			if (request === undefined || request.error !== null) {
				return;
			}
			yield* process(request).pipe(
				Effect.catchCause((cause) => failed(request, cause)),
				Effect.andThen(PubSub.publish(events, { _tag: "RequestFinished", requestId: request.request_id, workId })),
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
		const queued = !release && text.trim() !== "" && ["repairing", "working"].includes(current.step);
		if (!queued && (current.step !== "waiting" || current.decision === undefined)) {
			return yield* new BadRequest({ message: `${workId} waits on no answer in step ${current.step}` });
		}
		if (!release && current.decision?.worker !== undefined && !text.trim()) {
			return yield* new BadRequest({ message: "Supply a nonempty answer for the worker as text or on stdin" });
		}
		yield* recordingStore.accept(workId, queued ? undefined : current.decision, text, release);
		yield* start(workId);
		return { ...current, attentionOwner: "automation" as const, blocker: ANSWER_RECORDED, stage: "waiting" as const };
	});
});
