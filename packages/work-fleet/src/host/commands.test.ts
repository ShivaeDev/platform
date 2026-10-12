import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect } from "@effect/vitest";
import { Clock, Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { admitApproved } from "#host/admission.ts";
import { dispatchWork, hostLayer, runFleet } from "#host/commands.ts";
import type { FleetHost } from "#host/config.ts";
import { fleetStatus, renderStatus } from "#host/status.ts";
import { WAIT_EXIT, waitFor } from "#host/wait.ts";
import { finishWorkers } from "#test/engine.ts";
import type { EngineProvider } from "#test/engineProvider.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { readOnlySql } from "#test/readOnlySql.ts";

const until = Effect.fn("FleetHostTest.until")(function* (condition: () => boolean, timeoutMs = 20_000) {
	const deadline = (yield* Clock.currentTimeMillis) + timeoutMs;
	while (!condition()) {
		if ((yield* Clock.currentTimeMillis) > deadline) {
			return yield* Effect.die(new Error("condition was not reached in time"));
		}
		yield* Effect.sleep("20 millis");
	}
});

function prompts(provider: EngineProvider) {
	return [...provider.observations.values()].map((observation) => observation.output);
}

function record(host: FleetHost, workId: string, parts: Parameters<typeof hostLayer>[1]) {
	return Effect.gen(function* () {
		return (yield* (yield* Fleet).get(workId)).value;
	}).pipe(Effect.provide(hostLayer(host, parts)));
}

describe("work-fleet host against PostgreSQL", () => {
	const test = postgresTests("live");

	test("run launches each approved Board revision once and wait reports the automation blocker", function* () {
		const files = { "a.md": task("a", "approved"), "b.md": task("b"), "c.md": task("c", "draft") };
		yield* withHost(files, {}, (fixture) =>
			Effect.gen(function* () {
				const runner = yield* runFleet(fixture.host, fixture.parts).pipe(Effect.forkChild);
				yield* until(() => fixture.provider.launched.length === 1);
				yield* Effect.sleep("2500 millis");
				expect(fixture.provider.launched).toHaveLength(1);
				expect(prompts(fixture.provider)).toEqual([expect.stringContaining("id: a")]);
				finishWorkers(fixture.provider);
				const outcome = yield* withReadDaemon(fixture.host, (port) =>
					waitFor({
						intervalMs: 100,
						port,
						timeoutMs: 15_000,
						workId: "a",
					}),
				);
				yield* Fiber.interrupt(runner);
				expect(outcome.code).toBe(WAIT_EXIT.waitingDecision);
				expect(outcome.summary).toMatch(/^a needs-human \(waiting on automation\): /u);
				const status = renderStatus(yield* fleetStatus(fixture.host).pipe(Effect.provide(readOnlySql(fixture.host))));
				expect(status).toContain("Active (0)");
				expect(status).toContain("Waiting on automation (1)\n  a  needs-human");
				const board = readFileSync(join(fixture.host.boardDir, "fleet/status.md"), "utf8");
				expect(board).toContain("## Waiting on automation\n\n### a");
				expect(board).toContain("Stage: needs-human");
				expect(readFileSync(join(fixture.host.boardDir, "a.md"), "utf8")).toBe(files["a.md"]);
			}),
		);
	}, 40_000);

	test("dispatch denies unapproved work and launches the current approved brief", function* () {
		const files = { "a.md": task("a", "approved", "First revision."), "b.md": task("b") };
		yield* withHost(files, {}, (fixture) =>
			Effect.gen(function* () {
				const denied = yield* dispatchWork(fixture.host, "b", fixture.parts).pipe(Effect.flip);
				expect(denied).toMatchObject({ _tag: "Forbidden", message: 'b needs "fleet: approved" in its Board frontmatter' });

				yield* admitApproved(fixture.host).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
				const first = yield* record(fixture.host, "a", fixture.parts);
				expect(first.stage).toBe("prepared");

				fixture.write("a.md", task("a", "approved", "Second revision."));
				yield* admitApproved(fixture.host).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
				expect((yield* record(fixture.host, "a", fixture.parts)).boardRevision).not.toBe(first.boardRevision);
				expect(fixture.provider.launched).toHaveLength(0);

				const { value } = yield* dispatchWork(fixture.host, "a", fixture.parts);
				expect(value.stage).toBe("executing");
				expect(value.boardRevision).not.toBe(first.boardRevision);
				expect(fixture.provider.launched).toHaveLength(1);
				expect(prompts(fixture.provider)).toEqual([expect.stringContaining("Second revision.")]);
			}),
		);
	});

	test("cloud workers get the worker prompt and the host launch defaults under a task's fleet-launch", function* () {
		const files = {
			"a.md": "---\nid: a\nkind: task\nfleet: approved\nfleet-launch:\n  model: task-model\n---\n# a\n\nReport the main revision.\n",
			"b.md": "---\nid: b\nkind: task\nfleet: approved\nfleet-launch: fast\n---\n# b\n",
		};
		const config = {
			cloud: { cwd: "/workspace/repository", environmentId: "environment-test" },
			launch: { effort: "high", model: "host-model", serviceTier: "fast" },
			provider: "cloud",
			worker: { branchPrefix: "fleet/", sharedEnvironment: "/workspace/env.sh" },
		} as const;
		yield* withHost(files, config, (fixture) =>
			Effect.gen(function* () {
				yield* dispatchWork(fixture.host, "a", fixture.parts);
				expect(fixture.provider.settings.map((call) => call.settings)).toEqual([
					{ effort: "high", model: "task-model", serviceTier: "fast" },
					{ effort: "high", model: "task-model", serviceTier: "fast" },
				]);
				const [prompt] = prompts(fixture.provider);
				expect(prompt).toMatch(/^Work Board task: a\n/u);
				expect(prompt).toContain("create fleet/a from that exact current revision");
				expect(prompt).toContain("Source /workspace/env.sh");
				expect(prompt).toContain("Report the main revision.");
				const invalid = yield* dispatchWork(fixture.host, "b", fixture.parts).pipe(Effect.flip);
				expect(invalid).toMatchObject({ message: "b has an invalid fleet-launch; use model, effort and serviceTier strings" });
			}),
		);
	});
});
