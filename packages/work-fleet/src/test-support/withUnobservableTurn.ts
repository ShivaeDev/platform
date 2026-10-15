import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration } from "#test/codex.ts";
import { type EngineFixture, prepareWork, withEngine } from "#test/engine.ts";
import { stalledCodex } from "#test/stalledCodex.ts";

export const withUnobservableTurn = Effect.fnUntraced(function* <A, E>(
	use: (
		fixture: EngineFixture,
		server: Effect.Success<ReturnType<typeof stalledCodex>>,
		advance: (minutes: number) => void,
	) => Effect.Effect<A, E, typeof Fleet.Identifier>,
) {
	const server = yield* stalledCodex();
	let now = 0;
	return yield* Effect.gen(function* () {
		const transport = yield* SessionTransport;
		return yield* withEngine({ decorateTransport: () => transport, now: () => now }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				yield* fleet.reconcile("one");
				now += 31 * 60_000;
				yield* fleet.reconcile("one");
				now += 30 * 60_000;
				const resumed = yield* fleet.reconcile("one");
				expect(resumed.value.attempts.at(-1)?.receipt).toEqual({ sessionId: "worker-thread", turnId: "turn-2" });
				server.hidden.add("turn-2");
				return yield* use(fixture, server, (minutes) => {
					now += minutes * 60_000;
				});
			}),
		);
	}).pipe(Effect.provide(codexConfiguration(server.endpoint)));
});
