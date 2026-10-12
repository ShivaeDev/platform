import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { Fleet } from "#fleet.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { SessionFailure } from "#session/schema.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("provider capacity retry persists automation ownership across restart and clears it after acceptance", () => {
	let now = 100;
	let reject = true;
	return withEngine(
		{
			now: () => now,
			submissionFailure: () => (reject ? new SessionFailure({ message: "Request queue is full", reason: "rejected" }) : undefined),
		},
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				const queued = (yield* fleet.dispatch("one")).value;
				expect(queued).toMatchObject({ attentionOwner: "automation", launchRetry: { retryAt: 30_100 }, stage: "prepared" });
				expect(queued.decision).toBeUndefined();
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						expect((yield* restarted.get("one")).value.attentionOwner).toBe("automation");
						const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
						const waiting = yield* client("fleet.views", undefined);
						expect(waiting.waiting.automation).toMatchObject([{ attentionOwner: "automation", stage: "prepared", workId: "one" }]);
						expect(waiting.waiting.automation[0]?.blocker).toContain("Waiting for provider capacity");
						expect(waiting.waiting.maintainer).toEqual([]);
						expect(waiting.waiting.orchestrator).toEqual([]);
						expect(waiting.active).toEqual([]);
						reject = false;
						now = 30_099;
						expect((yield* restarted.dispatch("one")).value.attentionOwner).toBe("automation");
						expect(fixture.launched).toHaveLength(1);
						now = 30_100;
						const accepted = (yield* restarted.dispatch("one")).value;
						expect(accepted.stage).toBe("executing");
						expect(accepted.launchRetry).toBeUndefined();
						expect(accepted.attentionOwner).toBeUndefined();
						const active = yield* client("fleet.views", undefined);
						expect(active.active).toMatchObject([{ stage: "executing", workId: "one" }]);
						expect(active.waiting.automation).toEqual([]);
						expect(fixture.launched).toHaveLength(2);
					}).pipe(Effect.scoped),
				);
			}),
	);
});
