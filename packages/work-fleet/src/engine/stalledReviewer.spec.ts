import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";
import { Fleet } from "#fleet.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration } from "#test/codex.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { stalledCodex } from "#test/stalledCodex.ts";

postgresTests("test", "isolated")("a stalled reviewer continues its own thread with read-only access", function* () {
	const server = yield* stalledCodex();
	const clock = yield* Clock.Clock;
	yield* Effect.gen(function* () {
		const transport = yield* SessionTransport;
		yield* withEngine({ decorateTransport: () => transport, now: () => clock.currentTimeMillisUnsafe() }, () =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				server.states.set("turn-1", "completed");
				expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
				yield* TestClock.adjust("31 minutes");
				yield* fleet.reconcile("one");
				yield* TestClock.adjust("30 minutes");
				const retried = yield* fleet.reconcile("one");
				expect(retried.value.attempts.at(-1)).toMatchObject({
					receipt: { sessionId: "reviewer-thread", turnId: "turn-3" },
					reviewHead: "head-one-0",
					role: "reviewer",
					stallRecovery: { count: 2 },
				});
				expect(server.requests.filter((request) => request.method === "turn/steer").at(-1)?.params).toMatchObject({
					expectedTurnId: "turn-2",
					threadId: "reviewer-thread",
				});
				expect(server.requests.filter((request) => request.method === "turn/start").at(-1)?.params).toMatchObject({
					approvalPolicy: "never",
					sandboxPolicy: { networkAccess: true, type: "readOnly" },
					threadId: "reviewer-thread",
				});
				expect(server.requests.filter((request) => request.method === "thread/start")).toHaveLength(2);
			}),
		);
	}).pipe(Effect.provide(codexConfiguration(server.endpoint)));
});
