import { Cause, Effect } from "effect";
import { BadRequest, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { Fleet } from "#fleet.ts";
import { answerRecords } from "#host/answerRecords.ts";
import type { FleetHost } from "#host/config.ts";
import type { FleetRecord } from "#model.ts";
import type { Decision } from "#policy.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";

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
	const running = new Set<string>();
	const start = Effect.fn("FleetAnswer.start")(function* (request: AnswerRequest) {
		if (running.has(request.request_id) || request.error !== null) {
			return;
		}
		running.add(request.request_id);
		yield* Effect.gen(function* () {
			const current = (yield* fleet.get(request.work_id)).value;
			const receipts = [...(current.history ?? []).flatMap((cycle) => cycle.responses ?? []), ...(current.responses ?? [])];
			if (!receipts.some((receipt) => receipt.decisionId === request.decision_id)) {
				yield* apply(request.work_id, request.text, request.release, {
					code: request.decision_code ?? undefined,
					reason: request.decision_reason,
				});
			}
			yield* store.finish(request);
		}).pipe(
			Effect.catchCause((cause) =>
				Cause.hasInterrupts(cause) ? Effect.failCause(cause) : store.finish(request, failureMessage(Cause.squash(cause))),
			),
			Effect.catchCause((cause) => (Cause.hasInterrupts(cause) ? Effect.void : Effect.logError(cause))),
			Effect.ensuring(Effect.sync(() => running.delete(request.request_id))),
			Effect.forkIn(scope),
		);
	});
	for (const request of yield* store.list()) {
		yield* start(request);
	}
	return Effect.fn("FleetAnswer.accept")(function* (workId: string, text = "", release = false) {
		const current = (yield* answerRecords(host.namespace, workId))[0];
		if (current === undefined) {
			return yield* new NotFound({ message: `Unknown Board work ${workId}` });
		}
		if (text.length > 32_768) {
			return yield* new BadRequest({ message: "Supply an answer of at most 32768 characters" });
		}
		if (!release && text.trim() !== "" && ["repairing", "executing"].includes(current.stage)) {
			return (yield* apply(workId, text, release)).value;
		}
		if (current.stage !== "needs-human" || current.decision === undefined) {
			return yield* new BadRequest({ message: `${workId} waits on no answer in stage ${current.stage}` });
		}
		if (!release && current.decision.worker !== undefined && !text.trim()) {
			return yield* new BadRequest({ message: "Supply a nonempty answer for the worker as text or on stdin" });
		}
		const request = yield* store.accept(workId, current.decision, text, release);
		yield* start(request);
		return { ...current, blocker: ANSWER_RECORDED };
	});
});
