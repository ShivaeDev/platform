import * as PgClient from "@effect/sql-pg/PgClient";
import { expect } from "@effect/vitest";
import { Effect, Redacted } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import { answerStore } from "#storage/answerStore.ts";
import { type PrDaemonClient, withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { busyAdmission } from "#test/busyAdmission.ts";
import { answerAndWait, waitForRecord } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { postgresTests } from "#test/postgres.ts";

const SEED = "Keep keyboard focus.";
const messages = ["Keep the loading indicator visible.", "Preserve the empty state."];

for (const stage of ["executing", "repairing"] as const) {
	postgresTests("live")(`answers during ${stage} confirm before admission and queue messages in order after it frees`, () =>
		withApprovedPrDaemon((fixture) => {
			const queueAnswers = Effect.fn("AnswerQueueSpec.queueAnswers")(function* (client: PrDaemonClient, port: number) {
				const ready = yield* fixture.ready(client);
				let current = ready;
				if (stage === "executing") {
					fixture.github.state.mergeable = "CONFLICTING";
					yield* client("fleet.reconcile", { workId: "one" });
					current = yield* fixture.started(client, "repair");
					fixture.github.state.mergeable = "MERGEABLE";
				} else {
					current = yield* client("fleet.resolve", fixture.answer(ready, "Retain the existing layout."));
				}
				expect(current.stage).toBe(stage);
				yield* answerAndWait(client, { text: SEED, workId: "one" });
				const free = yield* busyAdmission(fixture.host);
				yield* Effect.addFinalizer(() => free);
				for (const text of messages) {
					let stderr = "";
					function captureError(chunk: string) {
						stderr += chunk;
					}
					const result = yield* Effect.promise(() =>
						cliProcess(["answer", "one", text, "--port", String(port)], {
							onError: captureError,
						}),
					).pipe(Effect.timeout("5 seconds"));
					expect(result).toEqual({ code: 0, stdout: `one ${stage}: ${ANSWER_RECORDED}` });
					expect(stderr).not.toContain("unconfirmed");
				}
				const stored = yield* answerStore(fixture.host.namespace).pipe(
					Effect.flatMap((store) => store.list("one")),
					Effect.provide(PgClient.layer({ maxConnections: 1, url: Redacted.make(fixture.host.databaseUrl) })),
				);
				expect(stored.map((request) => request.text)).toEqual(messages);
				const pending = yield* daemonRequest(port, (peer) => peer("daemon.status", {}), "status", 500);
				expect([...pending.active, ...Object.values(pending.waiting).flat()]).toContainEqual(
					expect.objectContaining({ blocker: ANSWER_RECORDED, workId: "one" }),
				);
				yield* free;
				const queued = yield* waitForRecord(client, "one", (record) => record.pendingAnswers?.length === messages.length + 1);
				expect(queued.pendingAnswers).toEqual([SEED, ...messages]);
				expect(queued.attempts).toEqual(current.attempts);
			}, Effect.scoped);
			return fixture.serve(queueAnswers);
		}),
	);
}
