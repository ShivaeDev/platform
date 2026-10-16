import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { parkStalled, stalledProgress } from "#test/parkStalled.ts";
import { postgresTests } from "#test/postgres.ts";

for (const action of ["retry", "release"] as const) {
	postgresTests("test")(`a stalled running turn can ${action} without provider cooperation and rejects late output`, () => {
		let now = 0;
		const interrupted: string[] = [];
		return withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					interrupt: (receipt) =>
						Effect.sync(() => {
							interrupted.push(receipt.turnId);
							return receipt;
						}),
					observe: (receipt) => transport.observe(receipt).pipe(Effect.map(stalledProgress)),
				}),
				now: () => now,
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					const stalled = yield* parkStalled(() => {
						now += 31 * 60_000;
					});
					expect(stalled.value.decision?.code).toBe("session-stalled");
					const attempt = stalled.value.attempts[0];
					const receipt = attempt?.receipt;
					if (attempt === undefined || receipt === undefined) {
						return yield* Effect.die("Missing stalled attempt");
					}
					const decisionId = stalled.value.decision?.id ?? "missing";
					const responseId = fixture.respond(decisionId, action);
					const resolved = yield* fixture.restart(fleet.resolve("one", decisionId, responseId));
					expect(resolved.value.stage).toBe(action === "retry" ? "prepared" : "released");
					expect(resolved.value.attempts[0]).toMatchObject({
						abandoned: { at: now, observation: { execution: "running", output: attempt.output, receipt } },
						sessionUnusable: true,
						status: "failed",
					});
					expect(interrupted).toEqual([receipt.turnId, receipt.turnId]);
					expect((yield* fixture.acknowledgeTurn(attempt.operationId, receipt).pipe(Effect.result))._tag).toBe("Failure");
					fixture.observations.set(receipt.turnId, { execution: "completed", output: "Late abandoned output", provisioning: "ready", receipt });
					if (action === "retry") {
						const fresh = yield* fixture.restart(fleet.dispatch("one"));
						expect(fresh.value.attempts).toHaveLength(2);
						expect(fresh.value.attempts[1]?.receipt?.sessionId).not.toBe(receipt.sessionId);
						expect(fresh.value.attempts[1]?.receipt?.turnId).not.toBe(receipt.turnId);
						expect(fixture.starts).toHaveLength(2);
					} else {
						const other = yield* prepareWork("two");
						expect((yield* fleet.dispatch(other.value.workId)).value.stage).toBe("executing");
					}
					const afterLateOutput = yield* fixture.restart(fleet.reconcile("one"));
					expect(afterLateOutput.value.attempts[0]?.output).toBeUndefined();
					expect(afterLateOutput.value.result).toBeUndefined();
					expect((yield* fleet.resolve("one", decisionId, responseId)).value.attempts).toEqual(afterLateOutput.value.attempts);
				}),
		);
	});
}
