import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { RpcTest } from "effect/rpc";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

describe("native Fleet contract", () => {
	const test = postgresTests("test");
	test("commands and queries preserve exact session receipts and decision details", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.scoped(
				Effect.gen(function* () {
					const client = yield* RpcTest.makeClient(FleetContract.omit("fleet.$changes"), { flatten: true }).pipe(Effect.provide(fleetHandlers));
					yield* client("fleet.prepare", {
						cwd: "/synthetic",
						preparation: prepared({ ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
						prompt: "Implement one",
						workId: "one",
					});
					const dispatched = yield* client("fleet.dispatch", { workId: "one" });
					expect(dispatched.attempts[0]?.receipt).toEqual({ sessionId: "session-operation-1", turnId: "turn-operation-1" });
					finishWorkers(fixture);
					yield* client("fleet.reconcile", { workId: "one" });
					const view = yield* client("fleet.views", undefined);
					expect(view.waiting.orchestrator[0]?.sessions).toHaveLength(2);
					expect(view.waiting.orchestrator[0]?.decision?.recommendation).toContain("Merge the reviewed, green PR");
					const decisionId = view.waiting.orchestrator[0]?.decision?.id ?? "missing";
					const responseId = fixture.respond(decisionId, "release");
					const released = yield* client("fleet.resolve", { decisionId, responseId, workId: "one" });
					expect(released.step).toBe("released");
					expect((yield* client("fleet.get", { workId: "one" })).step).toBe("released");
				}),
			),
		));
});
