import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { expect } from "vitest";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");

for (const type of ["clarify", "not_now"] as const) {
	test(`native Maintainer waiting query shows ${type} response blockers while retaining its decision`, () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.scoped(
				Effect.gen(function* () {
					yield* prepareWork("one");
					const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
					yield* client("fleet.dispatch", { workId: "one" });
					finishWorkers(fixture);
					const denied = yield* client("fleet.reconcile", { workId: "one" });
					const decisionId = denied.decision?.id ?? "missing";
					const responseId = fixture.respond(decisionId, "retry", type);
					yield* client("fleet.resolve", { decisionId, responseId, workId: "one" });
					const item = (yield* client("fleet.views", undefined)).waiting.maintainer[0];
					expect(item?.stage).toBe("needs-human");
					expect(item?.blocker).toBe(
						type === "clarify" ? `Human requested clarification: ${responseId}` : `Human deferred this decision: ${responseId}`,
					);
					expect(item?.decision?.reason).toBe(denied.decision?.reason);
					expect(item?.decision?.reason).not.toBe(item?.blocker);
				}),
			),
		));
}

test("native Automation waiting query exposes backlog admission blockers with the prepared stage", () =>
	withEngine({ backlog: 1, foreignBacklog: true }, () =>
		Effect.scoped(
			Effect.gen(function* () {
				yield* prepareWork("one");
				const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
				yield* client("fleet.dispatch", { workId: "one" }).pipe(Effect.result);
				const item = (yield* client("fleet.views", undefined)).waiting.automation[0];
				expect(item?.stage).toBe("prepared");
				expect(item?.blocker).toBe("backlog capacity is occupied (limit 1)");
				expect(item?.sessions).toEqual([]);
			}),
		),
	));

test("native Automation waiting query exposes the exact quota admission blocker", () =>
	withEngine({ unknownQuota: true }, () =>
		Effect.scoped(
			Effect.gen(function* () {
				yield* prepareWork("one");
				const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
				yield* client("fleet.dispatch", { workId: "one" }).pipe(Effect.result);
				const result = yield* client("fleet.views", undefined);
				expect(result.waiting.automation[0]?.stage).toBe("prepared");
				expect(result.waiting.automation[0]?.blocker).toBe("Fresh available provider quota is required");
			}),
		),
	));

test("native Automation waiting query preserves dependency blockers without preventing unrelated dispatch", () =>
	withEngine({}, () =>
		Effect.scoped(
			Effect.gen(function* () {
				yield* prepareWork("dependent");
				yield* prepareWork("two");
				const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
				yield* client("fleet.dispatch", { workId: "dependent" }).pipe(Effect.result);
				yield* client("fleet.dispatch", { workId: "two" });
				const result = yield* client("fleet.views", undefined);
				expect(result.waiting.automation.find((item) => item.workId === "dependent")?.blocker).toContain(
					"accepted outcome for current Board revision board-one",
				);
				expect(result.waiting.orchestrator).toEqual([]);
				expect(result.active.find((item) => item.workId === "two")?.stage).toBe("executing");
			}),
		),
	));

test("native Active query clears capacity blockers after successful replacement admission", () =>
	withEngine({ concurrency: 1 }, (fixture) =>
		Effect.scoped(
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* prepareWork("two");
				const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
				yield* client("fleet.dispatch", { workId: "one" });
				yield* client("fleet.dispatch", { workId: "two" }).pipe(Effect.result);
				expect((yield* client("fleet.views", undefined)).waiting.automation.find((item) => item.workId === "two")?.blocker).toContain(
					"execution capacity is occupied (limit 1)",
				);
				finishWorkers(fixture);
				yield* client("fleet.reconcile", { workId: "one" });
				yield* client("fleet.dispatch", { workId: "two" });
				const result = yield* client("fleet.views", undefined);
				expect(result.completed.find((item) => item.workId === "one")?.outcome).toBeDefined();
				expect(result.active.find((item) => item.workId === "two")?.stage).toBe("executing");
				expect(result.active.find((item) => item.workId === "two")?.blocker).toBeUndefined();
			}),
		),
	));

test("native Maintainer waiting query prioritizes its concrete decision over previous admission failure", () =>
	withEngine({}, (fixture) =>
		Effect.scoped(
			Effect.gen(function* () {
				yield* prepareWork("dependent");
				const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
				yield* client("fleet.dispatch", { workId: "dependent" }).pipe(Effect.result);
				fixture.editWork("dependent", "changed-context");
				yield* client("fleet.dispatch", { workId: "dependent" });
				const item = (yield* client("fleet.views", undefined)).waiting.maintainer[0];
				expect(item?.stage).toBe("needs-human");
				expect(item?.blocker).toBe("Work is no longer approved");
				expect(item?.decision?.reason).toBe(item?.blocker);
			}),
		),
	));
