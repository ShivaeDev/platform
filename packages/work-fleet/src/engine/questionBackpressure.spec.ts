import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

it.effect.skipIf(storageDatabaseUrl === undefined)("a queue-full answer retries the exact response as a worker turn on its existing thread", () => {
	let now = 100;
	let reject = false;
	return withFleetBoard(
		{
			now: () => now,
			submissionFailure: () => (reject ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined),
		},
		(fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const { decision } = yield* askWorker(fixture);
				const answer = yield* answerWorker(root, decision);
				reject = true;
				const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
				expect(queued.stage).toBe("repairing");
				expect(queued.responses).toHaveLength(1);
				reject = false;
				now = 30_099;
				yield* fixture.restart(cycle);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
				now = 30_100;
				yield* fixture.restart(cycle);
				const accepted = (yield* fleet.get("one")).value;
				expect(accepted.attempts.at(-1)).toMatchObject({ prompt: answer.body, receipt: { sessionId: decision.worker?.sessionId }, role: "worker" });
				expect(accepted.responses).toHaveLength(1);
				expect(accepted.history ?? []).toEqual([]);
				expect(fixture.launched).toHaveLength(1);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(3);
			}),
	);
});

it.effect.skipIf(storageDatabaseUrl === undefined)("a queued answer stops at an authored brief edit without submitting its launch intent", () => {
	let now = 100;
	let reject = false;
	const launch = { model: "initial-model" };
	return withFleetBoard(
		{
			launch,
			now: () => now,
			submissionFailure: () => (reject ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined),
		},
		(fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const { decision } = yield* askWorker(fixture);
				const answer = yield* answerWorker(root, decision);
				reject = true;
				const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
				expect(queued.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
				const failed = queued.attempts.at(-1);
				expect(failed).toMatchObject({ prompt: answer.body, role: "worker", settings: { model: "initial-model" }, status: "failed" });
				const current = `${source}\nNew approved criteria.\n`;
				boardHttpFiles(root).write("one.md", current);
				launch.model = "new-host-model";
				reject = false;
				now = 30_099;
				yield* fixture.restart(cycle);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
				expect((yield* fleet.get("one")).value.decision?.reason).toBe("Board context changed");
				now = 30_100;
				yield* fixture.restart(cycle);
				const accepted = (yield* fleet.get("one")).value;
				const attempt = accepted.attempts.at(-1);
				expect(accepted.stage).toBe("needs-human");
				expect(accepted.decision?.reason).toBe("Board context changed");
				expect(accepted.boardContext).toBe(source);
				expect(accepted.launchRetry).toBeUndefined();
				expect(attempt).toEqual(failed);
				expect(accepted.attempts).toEqual(queued.attempts);
				expect(accepted.responses).toEqual(queued.responses);
				expect(accepted.history ?? []).toEqual([]);
				expect(fixture.launched).toHaveLength(1);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
			}),
	);
});
