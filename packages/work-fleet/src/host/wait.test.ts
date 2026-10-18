import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { WAIT_EXIT } from "#host/wait.ts";
import { waitProcess } from "#test/fleetCli.ts";
import { type HostFixture, withHost } from "#test/fleetHost.ts";
import { untilOutput, withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { storeState } from "#test/storeState.ts";

describe("work-fleet wait against PostgreSQL and HTTP", () => {
	const test = postgresTests("live");

	test("the wait process exits distinctly on each terminal state and on timeout", () => withHost({}, {}, terminalStates), 60_000);

	test("wait follows a commit when Fleet first records the work", () => withHost({}, {}, lateStory));
});

const terminalStates = Effect.fn("WaitTest.terminalStates")(function* (fixture: HostFixture) {
	yield* storeState(fixture.host, "done", { outcome: { url: "https://example.test/pull/1" }, stage: "completed" });
	yield* storeState(fixture.host, "stuck", { decision: { reason: "Independent review rejected the change" }, stage: "needs-human" });
	yield* storeState(fixture.host, "gone", { stage: "released" });
	yield* storeState(fixture.host, "busy", { blocker: "Worker is running", stage: "executing" });
	const runs = yield* withReadDaemon(fixture.host, () =>
		Effect.promise(() =>
			Promise.all([
				waitProcess(fixture.host.boardDir, "done"),
				waitProcess(fixture.host.boardDir, "stuck"),
				waitProcess(fixture.host.boardDir, "gone"),
				waitProcess(fixture.host.boardDir, "busy", { timeoutSeconds: 1 }),
			]),
		),
	);
	expect(runs).toEqual([
		{ code: WAIT_EXIT.completed, stdout: "done completed: https://example.test/pull/1" },
		{ code: WAIT_EXIT.waitingDecision, stdout: "stuck needs-human (waiting on orchestrator): Independent review rejected the change" },
		{ code: WAIT_EXIT.released, stdout: "gone released" },
		{ code: WAIT_EXIT.timeout, stdout: "busy still executing (waiting on orchestrator): Worker is running: wait timed out" },
	]);
});

const lateStory = Effect.fn("WaitTest.lateStory")(function* (fixture: HostFixture) {
	yield* withFollower(fixture.configFile, "wait", ["late"], {}, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => follower.ready);
			yield* storeState(fixture.host, "late", { stage: "released" });
			yield* untilOutput(follower, "late released");
			expect(yield* Effect.promise(() => follower.done)).toMatchObject({ code: WAIT_EXIT.released, stdout: "late released" });
		}),
	);
});
