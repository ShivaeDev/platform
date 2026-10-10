import { describe, expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { WAIT_EXIT, waitFor } from "#host/wait.ts";
import { storeState, waitProcess, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("work-fleet wait against PostgreSQL", () => {
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
					{ code: WAIT_EXIT.needsHuman, stdout: "stuck needs-human: Independent review rejected the change" },
					{ code: WAIT_EXIT.released, stdout: "gone released" },
					{ code: WAIT_EXIT.timeout, stdout: "busy still executing: Worker is running: wait timed out" },
				]);
				expect((yield* Effect.promise(() => waitProcess(`${fixture.configFile}.missing`, "done"))).code).toBe(WAIT_EXIT.error);
			}),
		);
	}, 60_000);

	test("a hundred waiters and many wait processes all observe one completion", function* () {
		yield* withHost({}, {}, (fixture) =>
			Effect.gen(function* () {
				yield* storeState(fixture.host, "many", { stage: "executing" });
				const options = {
					databaseUrl: fixture.host.databaseUrl,
					intervalMs: 500,
					namespace: fixture.host.namespace,
					timeoutMs: 45_000,
					workId: "many",
				};
				const inProcess = yield* Effect.all(
					Array.from({ length: 100 }, () => waitFor(options)),
					{ concurrency: "unbounded" },
				).pipe(Effect.forkChild);
				const processes = Promise.all(
					Array.from({ length: 10 }, () => waitProcess(fixture.configFile, "many", { intervalSeconds: 0.5, timeoutSeconds: 45 })),
				);
				yield* Effect.sleep("5 seconds");
				yield* storeState(fixture.host, "many", { outcome: { evidence: ["main already contains it"] }, stage: "completed" });
				const outcomes = yield* Fiber.join(inProcess);
				const runs = yield* Effect.promise(() => processes);
				expect(new Set(outcomes.map((outcome) => `${outcome.code} ${outcome.summary}`))).toEqual(
					new Set(["0 many completed: main already contains it"]),
				);
				expect(new Set(runs.map((run) => `${run.code} ${run.stdout}`))).toEqual(new Set(["0 many completed: main already contains it"]));
			}),
		);
	}, 90_000);

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
