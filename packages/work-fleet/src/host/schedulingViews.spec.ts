import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved } from "#host/admission.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { fleetHostLayer } from "#host/runtime.ts";
import { renderStatus } from "#host/status.ts";
import { waitFor } from "#host/wait.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

it.live.skipIf(storageDatabaseUrl === undefined)("area and dependency admission reasons reach status, wait and the generated Board view", () =>
	withHost(
		{
			"a.md": task("first", "approved").replace("kind: task", "kind: task\nareas: [fleet/host]"),
			"b.md": task("second", "approved").replace("kind: task", "kind: task\nareas: [fleet/host]"),
			"c.md": task("dependent", "approved").replace("kind: task", "kind: task\nrelationships:\n  - kind: depends_on\n    target: external"),
			"external.md": task("external").replace("kind: task", "kind: task\nstatus: planned"),
		},
		{},
		(fixture) =>
			Effect.gen(function* () {
				yield* admitApproved(fixture.host);
				yield* cycle;
				const fleet = yield* Fleet;
				yield* fleet.dispatch("second").pipe(Effect.result);
				const records = (yield* fleet.list()).map(({ value }) => value);
				const grouped = views(records);
				expect(grouped.waiting.automation.map((record) => record.workId)).toEqual(["second"]);
				expect(grouped.waiting.orchestrator.map((record) => record.workId)).toEqual(["dependent"]);
				const status = renderStatus(grouped);
				const board = statusMarkdown(records);
				const areaReason = "waiting for area fleet/host held by first";
				const dependencyReason = "waiting for dependency external";
				for (const view of [status, board]) {
					expect(view).toContain(areaReason);
					expect(view).toContain(dependencyReason);
				}
				const states = yield* readWaitStates(fixture.host, ["second", "dependent"]);
				expect(states.map((state) => state.blocker).join("\n")).toContain(areaReason);
				expect(states.map((state) => state.blocker).join("\n")).toContain(dependencyReason);
				for (const [workId, reason] of [
					["second", areaReason],
					["dependent", dependencyReason],
				] as const) {
					const outcome = yield* withReadDaemon(fixture.host, (port) => waitFor({ intervalMs: 1, port, timeoutMs: 100, workId }));
					expect(outcome.code).toBe(4);
					expect(outcome.summary).toContain(reason);
				}
				fixture.write("external.md", task("external").replace("kind: task", "kind: task\nstatus: done"));
				expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
			}).pipe(Effect.provide(fleetHostLayer(fixture.host, fixture.parts)), Effect.provide(NodeServices.layer)),
	),
);
