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
	yield* storeState(fixture.host, "done", { outcome: { url: "https://example.test/pull/1" }, stage: "done", step: "done" });
	yield* storeState(fixture.host, "stuck", { decision: { reason: "Independent review rejected the change" }, stage: "waiting", step: "waiting" });
	yield* storeState(fixture.host, "gone", { stage: "released", step: "released" });
	yield* storeState(fixture.host, "busy", { blocker: "Worker is running", stage: "working", step: "working" });
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
		{ code: WAIT_EXIT.completed, stdout: "done done: https://example.test/pull/1" },
		{ code: WAIT_EXIT.waitingDecision, stdout: "stuck waiting (waiting on orchestrator): Independent review rejected the change" },
		{ code: WAIT_EXIT.released, stdout: "gone released" },
		{ code: WAIT_EXIT.timeout, stdout: "busy still working (waiting on orchestrator): Worker is running: wait timed out" },
	]);
});

const lateStory = Effect.fn("WaitTest.lateStory")(function* (fixture: HostFixture) {
	yield* withFollower(fixture.configFile, "wait", ["late"], {}, (follower) =>
		Effect.gen(function* () {
			yield* Effect.promise(() => follower.ready);
			yield* storeState(fixture.host, "late", { stage: "released", step: "released" });
			yield* untilOutput(follower, "late released");
			expect(yield* Effect.promise(() => follower.done)).toMatchObject({ code: WAIT_EXIT.released, stdout: "late released" });
		}),
	);
});
