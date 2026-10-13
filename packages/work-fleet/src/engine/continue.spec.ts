import { describe, expect } from "@effect/vitest";
import { Effect, Result } from "effect";
import { RpcTest } from "effect/rpc";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { settled } from "#host/wait.ts";
import { allAttempts } from "#model.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

describe("Fleet continuation against PostgreSQL", () => {
	const test = postgresTests("test", "isolated");

	test("continues needs-human work through native RPC and replaces the old result with the new output", () =>
		withEngine(
			{
				checksFailure: true,
				resultQuery: (_board, observation) => Effect.succeed({ evidence: [observation.output], head: "current-main", kind: "no-change" }),
			},
			(fixture) =>
				Effect.scoped(
					Effect.gen(function* () {
						yield* prepareWork("one");
						const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
						const first = yield* client("fleet.dispatch", { workId: "one" });
						finishWorkers(fixture);
						const stopped = yield* client("fleet.reconcile", { workId: "one" });
						expect(stopped.stage).toBe("needs-human");
						expect(stopped).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
						const continued = yield* client("fleet.continue", { message: "Fix the remaining criterion", workId: "one" });
						expect(continued.stage).toBe("executing");
						expect(continued.attempts[0]).toMatchObject({
							prompt: "Fix the remaining criterion",
							receipt: { sessionId: first.attempts[0]?.receipt?.sessionId },
							role: "repair",
						});
						expect(continued.history?.[0]?.decision).toEqual(stopped.decision);
						expect(continued.result).toBeUndefined();
						expect(continued.outcome).toBeUndefined();
						expect(settled("one", continued)).toBeUndefined();
						const active = yield* client("fleet.views", undefined);
						expect(active.waiting).toEqual({ automation: [], maintainer: [], orchestrator: [] });
						expect(active.active[0]?.blocker).toBeUndefined();
						finishWorkers(fixture);
						const completed = yield* client("fleet.reconcile", { workId: "one" });
						expect(completed.stage).toBe("completed");
						expect(completed.result).toMatchObject({ evidence: ["Fix the remaining criterion"] });
						expect(settled("one", completed)?.summary).toBe("one completed: Fix the remaining criterion");
						expect(views([completed]).completed[0]?.outcome).toEqual({ evidence: ["Fix the remaining criterion"] });
						expect(fixture.acknowledgements).toContainEqual(expect.objectContaining({ disposition: "superseded" }));
					}),
				),
		));

	test("continues completed work and reconciles a lost acknowledgement after restart without replay", () =>
		withEngine({ noChange: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				fixture.loseAcknowledgement();
				const continued = yield* fleet.continue("one", "Check one more case");
				expect(continued.value.stage).toBe("executing");
				expect(continued.value.attempts[0]).toMatchObject({ prompt: "Check one more case", sessionId: "session-operation-1", status: "submitting" });
				expect(continued.value.attempts[0]?.receipt).toBeUndefined();
				expect(yield* fleet.continue("one", "Do not replay").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						const observed = yield* restarted.reconcile("one");
						expect(observed.value.attempts[0]?.receipt).toEqual({ sessionId: "session-operation-1", turnId: "turn-operation-3" });
						finishWorkers(fixture);
						expect((yield* restarted.reconcile("one")).value.stage).toBe("completed");
					}),
				);
				expect(fixture.settings.filter((call) => call.operationId === "operation-3")).toHaveLength(1);
				expect(fixture.launched).toHaveLength(3);
				expect(allAttempts((yield* fleet.get("one")).value)).toHaveLength(4);
			}),
		));

	test("refuses running and released work without submitting another turn", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				expect(yield* fleet.continue("one", "Still running").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
				expect(fixture.operations.size).toBe(1);
				finishWorkers(fixture);
				const stopped = yield* fleet.reconcile("one");
				const decisionId = stopped.value.decision?.id ?? "missing";
				yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "release"));
				expect(yield* fleet.continue("one", "Released").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
				expect(fixture.operations.size).toBe(2);
			}),
		));

	test("concurrent continuation requests reserve exactly one turn", () =>
		withEngine({ noChange: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				const results = yield* Effect.all([fleet.continue("one", "First"), fleet.continue("one", "Second")].map(Effect.result), {
					concurrency: "unbounded",
				});
				expect(results.filter(Result.isSuccess)).toHaveLength(1);
				expect(fixture.operations.size).toBe(3);
				expect((yield* fleet.get("one")).value.attempts).toHaveLength(1);
			}),
		));
});
