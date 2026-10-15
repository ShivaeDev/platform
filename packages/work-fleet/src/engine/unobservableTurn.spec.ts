import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { postgresTests } from "#test/postgres.ts";
import { withUnobservableTurn } from "#test/withUnobservableTurn.ts";

const test = postgresTests("test", "isolated");
const reconcile = Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one")));

test("a stall recovery turn becomes visible after two observation passes across restart", () =>
	withUnobservableTurn((fixture, server, advance) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			for (let pass = 0; pass < 2; pass += 1) {
				advance(1);
				const pending = yield* fixture.restart(reconcile);
				expect(pending.value.stage).toBe("executing");
				expect(pending.value.attempts.at(-1)?.missingSince).toBeDefined();
				expect(pending.value.decision).toBeUndefined();
			}
			server.hidden.delete("turn-2");
			const visible = yield* fleet.reconcile("one");
			expect(visible.value.stage).toBe("executing");
			expect(visible.value.attempts.at(-1)?.missingSince).toBeUndefined();
			expect(visible.value.attempts.at(-1)?.status).toBe("running");
			expect(server.requests.filter((request) => request.method === "turn/start")).toHaveLength(2);
			expect(fixture.decisions).toHaveLength(0);
		}),
	));

for (const progressingTurn of ["turn-1", "provider-followup"]) {
	test(`progress on ${progressingTurn} keeps an invisible acknowledged turn executing past its grace period`, () =>
		withUnobservableTurn((fixture, server, advance) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* fleet.reconcile("one");
				server.states.set(progressingTurn, "inProgress");
				for (let pass = 0; pass < 3; pass += 1) {
					advance(6);
					server.addItem();
					const current = yield* fixture.restart(reconcile);
					expect(current.value.stage).toBe("executing");
					expect(current.value.attempts.at(-1)?.progress?.at).toBe((61 + (pass + 1) * 6) * 60_000);
					expect(current.value.decision).toBeUndefined();
				}
				expect(server.requests.filter((request) => request.method === "turn/start")).toHaveLength(2);
				expect(fixture.decisions).toHaveLength(0);
			}),
		));
}

test("an invisible turn resumes once on the same thread and a second consecutive loss asks and can be released across restart", () =>
	withUnobservableTurn((fixture, server, advance) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* fleet.reconcile("one");
			advance(4);
			expect((yield* fleet.reconcile("one")).value.attempts).toHaveLength(2);
			advance(1);
			const resumed = yield* fixture.restart(reconcile);
			expect(resumed.value.stage).toBe("executing");
			expect(resumed.value.decision).toBeUndefined();
			expect(resumed.value.attempts.at(-1)).toMatchObject({ observationRetries: 1, receipt: { sessionId: "worker-thread", turnId: "turn-3" } });
			expect(resumed.value.attempts[1]?.status).toBe("failed");
			server.hidden.add("turn-3");
			yield* fixture.restart(reconcile);
			advance(5);
			const lost = yield* fixture.restart(reconcile);
			expect(lost.value).toMatchObject({
				decision: { code: "session-turn-missing", reason: expect.stringContaining("one automatic resume") },
				stage: "needs-human",
			});
			expect(executing(lost.value)).toBe(true);
			expect(server.requests.filter((request) => request.method === "turn/start")).toHaveLength(3);
			expect(server.requests.filter((request) => request.method === "thread/start")).toHaveLength(1);
			expect(fixture.decisions).toHaveLength(1);
			const decisionId = lost.value.decision?.id ?? "missing";
			const released = yield* fixture.restart(
				Fleet.pipe(Effect.flatMap((restarted) => restarted.resolve("one", decisionId, fixture.respond(decisionId, "release")))),
			);
			expect(released.value.stage).toBe("released");
			expect(released.value.attempts.at(-1)?.sessionUnusable).toBe(true);
		}),
	));

test("observing the resumed turn resets consecutive visibility losses", () =>
	withUnobservableTurn((fixture, server, advance) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* fleet.reconcile("one");
			advance(5);
			yield* fleet.reconcile("one");
			const visible = yield* fixture.restart(reconcile);
			expect(visible.value.attempts.at(-1)?.observationRetries).toBeUndefined();
			server.hidden.add("turn-3");
			yield* fleet.reconcile("one");
			advance(5);
			const resumed = yield* fixture.restart(reconcile);
			expect(resumed.value.stage).toBe("executing");
			expect(resumed.value.attempts.at(-1)?.receipt?.turnId).toBe("turn-4");
			expect(fixture.decisions).toHaveLength(0);
		}),
	));
