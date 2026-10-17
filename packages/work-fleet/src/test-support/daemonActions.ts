import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import type { daemonClient } from "#host/daemonClient.ts";
import type { FleetRecord } from "#model.ts";

type Client = Effect.Success<ReturnType<typeof daemonClient>>;

export const waitForRecord = Effect.fn("DaemonTest.waitForRecord")(
	function* (client: Client, workId: string, ready: (record: FleetRecord) => boolean) {
		while (true) {
			const record = yield* client("fleet.get", { workId });
			if (ready(record)) {
				return record;
			}
			yield* Effect.sleep("10 millis");
		}
	},
	(effect) => effect.pipe(Effect.timeout("10 seconds")),
);

export const dispatchAndWait = Effect.fn("DaemonTest.dispatchAndWait")(function* (client: Client, workId: string) {
	yield* client("daemon.dispatch", { workId });
	return yield* waitForRecord(client, workId, (record) => record.stage !== "prepared" && record.attempts.at(-1)?.status !== "submitting");
});

export function appliedAnswer(client: Client, workId: string) {
	return waitForRecord(
		client,
		workId,
		(record) =>
			record.blocker !== ANSWER_RECORDED
			&& record.attempts.at(-1)?.status !== "submitting"
			&& (record.responses?.at(-1)?.boardAcknowledged === true || record.blocker?.startsWith("Board request acknowledgement pending:") === true),
	);
}

export const answerAndWait = Effect.fn("DaemonTest.answerAndWait")(function* (
	client: Client,
	payload: { readonly workId: string; readonly text?: string; readonly release?: boolean },
) {
	const accepted = yield* client("daemon.answer", payload);
	return yield* accepted.blocker === ANSWER_RECORDED ? appliedAnswer(client, payload.workId) : Effect.succeed(accepted);
});
