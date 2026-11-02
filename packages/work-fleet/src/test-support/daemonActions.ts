import { type Context, Effect, Option } from "effect";
import type { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { Conflict, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import type { Fleet } from "#fleet.ts";
import type { daemonClient } from "#host/daemonClient.ts";
import type { FleetRecord } from "#model.ts";
import { type AnswerSignals, answerSignals } from "#test/answerSignals.ts";
import { committed } from "#test/committed.ts";

type Client = Effect.Success<ReturnType<typeof daemonClient>>;

export function waitForRecord(
	client: Client,
	workId: string,
	ready: (record: FleetRecord) => boolean,
	context: Context.Context<typeof LiveServer.Identifier>,
) {
	return committed(
		context,
		workId,
		client("fleet.get", { workId }).pipe(
			Effect.map(Option.some),
			Effect.catchTag("NotFound", () => Effect.succeed(Option.none())),
		),
		(record) => Option.isSome(record) && ready(record.value),
	).pipe(Effect.map(Option.getOrThrow));
}

export const dispatchAndWait = Effect.fn("DaemonTest.dispatchAndWait")(function* (
	client: Client,
	workId: string,
	context: Context.Context<typeof LiveServer.Identifier>,
) {
	yield* client("daemon.dispatch", { workId });
	const outcome = yield* waitForDispatch(client, workId, context);
	if (outcome.status === "failed") {
		return yield* new ServiceUnavailable({ message: outcome.error ?? "Dispatch failed" });
	}
	return yield* waitForRecord(client, workId, (record) => record.step !== "queued" && record.attempts.at(-1)?.status !== "submitting", context);
});

export function waitForDispatch(client: Client, workId: string, context: Context.Context<typeof LiveServer.Identifier>) {
	return committed(
		context,
		workId,
		client("daemon.dispatch-status", { workId }).pipe(Effect.map(Option.fromNullishOr)),
		(request) => Option.isSome(request) && request.value.status !== "pending",
	).pipe(Effect.map(Option.getOrThrow));
}

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
