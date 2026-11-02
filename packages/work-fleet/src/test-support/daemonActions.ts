import { Effect } from "effect";
import { Conflict, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import type { Fleet } from "#fleet.ts";
import type { daemonClient } from "#host/daemonClient.ts";
import type { FleetRecord } from "#model.ts";
import { type AnswerSignals, answerSignals } from "#test/answerSignals.ts";

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
	return yield* waitForRecord(client, workId, (record) => record.step !== "queued" && record.attempts.at(-1)?.status !== "submitting");
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

export const appliedAnswer = Effect.fn("DaemonTest.appliedAnswer")(function* (client: Client, workId: string, signals: AnswerSignals) {
	const outcome = yield* signals.wait((event) => event.workId === workId && (event._tag === "Applied" || event._tag === "Refused"));
	if (outcome._tag === "Refused") {
		return yield* new Conflict({ message: outcome.reason.replace(/^Answer failed: /u, "") });
	}
	yield* signals.wait((event) => event.workId === workId && event._tag === "RequestFinished");
	return yield* client("fleet.get", { workId });
});

export const answerAndWait = Effect.fn("DaemonTest.answerAndWait")(function* (
	client: Client,
	payload: { readonly workId: string; readonly text?: string; readonly release?: boolean },
	fleet: typeof Fleet.Service,
) {
	const signals = yield* answerSignals(fleet);
	const accepted = yield* client("daemon.answer", payload);
	return yield* accepted.blocker === ANSWER_RECORDED ? appliedAnswer(client, payload.workId, signals) : Effect.succeed(accepted);
});
