import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { it } from "@shivaedev/effect-test/it.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { prepared } from "#test/preparation.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("native Fleet contract", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);
	test("commands and queries preserve exact session receipts and decision details", () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.scoped(
				Effect.gen(function* () {
					const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
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
					expect(view.needsHuman[0]?.sessions).toHaveLength(2);
					expect(view.needsHuman[0]?.decision?.recommendation).toContain("trusted runtime policy");
					const decisionId = view.needsHuman[0]?.decision?.id ?? "missing";
					const released = yield* client("fleet.resolve", { action: "release", decisionId, workId: "one" });
					expect(released.stage).toBe("released");
					expect((yield* client("fleet.get", { workId: "one" })).stage).toBe("released");
				}),
			),
		));
});
