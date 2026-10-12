import { Deferred, Effect, Fiber } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { type EngineFixture, finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const recover = Effect.fnUntraced(function* (fixture: EngineFixture, gate: Deferred.Deferred<void>, action: "retry" | "release") {
	yield* prepareWork("one");
	const fleet = yield* Fleet;
	yield* fleet.dispatch("one");
	const stopped = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
	expect(stopped.value.decision?.reason).toContain("Lost thread acknowledgement");
	const decisionId = stopped.value.decision?.id ?? "missing";
	const responseId = fixture.respond(decisionId, action);
	const resolve = Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decisionId, responseId)));
	const resolved = yield* fixture.restart(resolve);
	expect(resolved.value.stage).toBe(action === "retry" ? "prepared" : "released");
	expect(resolved.value.attempts[0]).toMatchObject({ status: "failed" });
	yield* Deferred.succeed(gate, undefined);
	yield* Effect.yieldNow;
	expect((yield* fixture.acknowledgeTurn("operation-1", { sessionId: "session-operation-1", turnId: "late" }).pipe(Effect.result))._tag).toBe(
		"Failure",
	);
	expect((yield* fleet.get("one")).value.attempts[0]?.sessionId).toBeUndefined();
	expect(fixture.operations.size).toBe(0);
	expect((yield* fixture.restart(resolve)).value.responses).toEqual(resolved.value.responses);
	if (action === "retry") {
		const fresh = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.dispatch("one"))));
		expect(fresh.value.attempts.at(-1)?.receipt?.turnId).toBe("turn-operation-2");
	}
});

for (const action of ["retry", "release"] as const) {
	postgresTests("live", "isolated")(
		`lost thread acknowledgement ${action} fences a late session before any turn starts`,
		function* () {
			const gate = yield* Deferred.make<void>();
			const native = codexAdapter(() => Effect.die("Unacknowledged recovery must not call the provider"), {
				beforeTurn: () => Effect.succeed({}),
				provisioning: "unknown",
				threadStart: () => ({}),
			});
			yield* withEngine(
				{
					decorateTransport: (transport) => ({ ...transport, reconcile: native.reconcile }),
					sessionAcknowledgementGate: Deferred.await(gate),
				},
				(fixture) => recover(fixture, gate, action),
			);
		},
		30_000,
	);
}

const acknowledgementWins = Effect.fnUntraced(function* (
	fixture: EngineFixture,
	gates: {
		readonly session: Deferred.Deferred<void>;
		readonly retiring: Deferred.Deferred<void>;
		readonly commit: Deferred.Deferred<void>;
		readonly turn: Deferred.Deferred<void>;
	},
) {
	yield* prepareWork("one");
	const fleet = yield* Fleet;
	yield* fleet.dispatch("one");
	const stopped = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
	const decisionId = stopped.value.decision?.id ?? "missing";
	const responseId = fixture.respond(decisionId, "release");
	const resolve = Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decisionId, responseId)));
	const retiring = yield* fixture.restart(resolve.pipe(Effect.result)).pipe(Effect.forkChild);
	yield* Deferred.await(gates.retiring);
	yield* Deferred.succeed(gates.session, undefined);
	yield* Deferred.await(gates.turn);
	yield* Deferred.succeed(gates.commit, undefined);
	const rejected = yield* Fiber.join(retiring);
	expect(rejected).toMatchObject({ _tag: "Failure", failure: { _tag: "Conflict" } });
	expect((yield* fleet.get("one")).value.attempts[0]?.sessionId).toBe("session-operation-1");
	expect((yield* fleet.get("one")).value.stage).toBe("needs-human");
	while ((yield* fleet.get("one")).value.attempts[0]?.receipt === undefined) {
		yield* Effect.yieldNow;
	}
	finishWorkers(fixture);
	expect((yield* fixture.restart(resolve)).value.stage).toBe("released");
	expect(fixture.operations.size).toBe(1);
});

postgresTests("live", "isolated")(
	"acknowledgement winning the retirement race retains execution until terminal observation",
	function* () {
		const gates = {
			commit: yield* Deferred.make<void>(),
			retiring: yield* Deferred.make<void>(),
			session: yield* Deferred.make<void>(),
			turn: yield* Deferred.make<void>(),
		};
		const native = codexAdapter(() => Effect.die("Unacknowledged recovery must not call the provider"), {
			beforeTurn: () => Effect.succeed({}),
			provisioning: "unknown",
			threadStart: () => ({}),
		});
		yield* withEngine(
			{
				decorateTransport: (transport) => ({
					...transport,
					reconcile: native.reconcile,
					startTurn: (input) => transport.startTurn(input).pipe(Effect.tap(() => Deferred.succeed(gates.turn, undefined))),
				}),
				sessionAcknowledgementGate: Deferred.await(gates.session),
				writeGate: (value) =>
					value.stage === "needs-human" && value.attempts[0]?.status === "failed"
						? Deferred.succeed(gates.retiring, undefined).pipe(Effect.andThen(Deferred.await(gates.commit)))
						: Effect.void,
			},
			(fixture) => acknowledgementWins(fixture, gates),
		);
	},
	30_000,
);
