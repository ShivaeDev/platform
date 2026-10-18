import { Effect } from "effect";
import { Conflict, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import type { daemonClient } from "#host/daemonClient.ts";
import type { FleetRecord } from "#model.ts";

type Client = Effect.Success<ReturnType<typeof daemonClient>>;

export const waitForRecord = Effect.fn("DaemonTest.waitForRecord")(
	function* (client: Client, workId: string, ready: (record: FleetRecord) => boolean) {
		while (true) {
			const record = yield* client("fleet.get", { workId }).pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
			if (record !== undefined && ready(record)) {
				return record;
			}
			yield* Effect.sleep("10 millis");
		}
	},
	(effect) => effect.pipe(Effect.timeout("10 seconds")),
);

export const dispatchAndWait = Effect.fn("DaemonTest.dispatchAndWait")(function* (client: Client, workId: string) {
	yield* client("daemon.dispatch", { workId });
	const outcome = yield* waitForDispatch(client, workId);
	if (outcome.status === "failed") {
		return yield* new ServiceUnavailable({ message: outcome.error ?? "Dispatch failed" });
	}
	return yield* waitForRecord(client, workId, (record) => record.stage !== "prepared" && record.attempts.at(-1)?.status !== "submitting");
});

export const waitForDispatch = Effect.fn("DaemonTest.waitForDispatch")(
	function* (client: Client, workId: string) {
		while (true) {
			const request = yield* client("daemon.dispatch-status", { workId });
			if (request !== null && request.status !== "pending") {
				return request;
			}
			yield* Effect.sleep("10 millis");
		}
	},
	(effect) => effect.pipe(Effect.timeout("10 seconds")),
);

export function appliedAnswer(client: Client, workId: string) {
	return Effect.gen(function* () {
		while (true) {
			const status = yield* client("daemon.status", { workId });
			const view = [...status.active, ...status.completed, ...Object.values(status.waiting).flat()].find((item) => item.workId === workId);
			if (view?.blocker?.startsWith("Answer failed: ")) {
				return yield* new Conflict({ message: view.blocker.slice("Answer failed: ".length) });
			}
			const record = yield* client("fleet.get", { workId });
			if (
				view?.blocker !== ANSWER_RECORDED
				&& record.blocker !== ANSWER_RECORDED
				&& record.attempts.at(-1)?.status !== "submitting"
				&& ((record.pendingAnswers?.length ?? 0) > 0
					|| record.responses?.at(-1)?.boardAcknowledged === true
					|| record.blocker?.startsWith("Board request acknowledgement pending:") === true)
			) {
				return record;
			}
			yield* Effect.sleep("10 millis");
		}
	}).pipe(Effect.timeout("10 seconds"));
}

export const answerAndWait = Effect.fn("DaemonTest.answerAndWait")(function* (
	client: Client,
	payload: { readonly workId: string; readonly text?: string; readonly release?: boolean },
) {
	const accepted = yield* client("daemon.answer", payload);
	return yield* accepted.blocker === ANSWER_RECORDED ? appliedAnswer(client, payload.workId) : Effect.succeed(accepted);
});
