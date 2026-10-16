import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { parkStalled } from "#test/parkStalled.ts";
import { postgresTests } from "#test/postgres.ts";

for (const role of ["repair", "reviewer"] as const) {
	postgresTests("test")(`a stalled ${role} retries in a fresh session with its original role and PR`, () => {
		let now = 0;
		return withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					observe: (receipt) => transport.observe(receipt).pipe(Effect.map((observation) => ({ ...observation, progress: [{ id: "unchanged" }] }))),
				}),
				now: () => now,
				repairs: role === "repair",
				reviewRunning: role === "reviewer",
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					finishWorkers(fixture);
					yield* fleet.reconcile("one");
					const stalled = yield* parkStalled(() => {
						now += 31 * 60_000;
					});
					expect(stalled.value.decision?.code).toBe("session-stalled");
					const previous = stalled.value.attempts.at(-1);
					expect(previous?.role).toBe(role);
					const decisionId = stalled.value.decision?.id ?? "missing";
					yield* fixture.restart(fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry")));
					yield* fixture.restart(fleet.reconcile("one"));
					const retried = yield* fixture.restart(fleet.reconcile("one"));
					expect(retried.value.attempts).toHaveLength(stalled.value.attempts.length + 1);
					expect(retried.value.attempts.at(-1)).toMatchObject({ role, status: "running" });
					expect(retried.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(previous?.receipt?.sessionId);
					expect(retried.value.result).toEqual(stalled.value.result);
					if (role === "reviewer") {
						expect(fixture.starts.at(-1)?.access).toBe("read-only");
						expect(retried.value.attempts.at(-1)?.reviewHead).toBe(previous?.reviewHead);
					} else {
						expect(fixture.starts.at(-1)?.prompt).toContain("same branch and PR");
					}
				}),
		);
	});
}
