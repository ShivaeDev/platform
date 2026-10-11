import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { WAIT_EXIT } from "#host/wait.ts";
import { storeState, waitProcess, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("work-fleet wait against PostgreSQL and HTTP", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);

	test("the wait process exits distinctly on each terminal state and on timeout", function* () {
		yield* withHost({}, {}, (fixture) =>
			Effect.gen(function* () {
				yield* storeState(fixture.host, "done", { outcome: { url: "https://example.test/pull/1" }, stage: "completed" });
				yield* storeState(fixture.host, "stuck", { decision: { reason: "Independent review rejected the change" }, stage: "needs-human" });
				yield* storeState(fixture.host, "gone", { stage: "released" });
				yield* storeState(fixture.host, "busy", { blocker: "Worker is running", stage: "executing" });
				const runs = yield* Effect.promise(() =>
					Promise.all([
						waitProcess(fixture.configFile, "done"),
						waitProcess(fixture.configFile, "stuck"),
						waitProcess(fixture.configFile, "gone"),
						waitProcess(fixture.configFile, "busy", { timeoutSeconds: 1 }),
					]),
				);
				expect(runs).toEqual([
					{ code: WAIT_EXIT.completed, stdout: "done completed: https://example.test/pull/1" },
					{ code: WAIT_EXIT.waitingDecision, stdout: "stuck needs-human (waiting on orchestrator): Independent review rejected the change" },
					{ code: WAIT_EXIT.released, stdout: "gone released" },
					{ code: WAIT_EXIT.timeout, stdout: "busy still executing (waiting on orchestrator): Worker is running: wait timed out" },
				]);
			}),
		);
	}, 60_000);

	test("wait keeps polling until Fleet first records the work", function* () {
		yield* withHost({}, {}, (fixture) =>
			Effect.gen(function* () {
				const waiting = waitProcess(fixture.configFile, "late");
				yield* Effect.sleep("3 seconds");
				yield* storeState(fixture.host, "late", { stage: "released" });
				expect(yield* Effect.promise(() => waiting)).toEqual({ code: WAIT_EXIT.released, stdout: "late released" });
			}),
		);
	}, 30_000);
});
