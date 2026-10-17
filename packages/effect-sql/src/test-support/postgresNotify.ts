import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, Queue, Redacted, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { type PostgresChangeClient, type PostgresChangesOptions, type PostgresNotification, postgresChanges } from "#postgresChanges.ts";
import { environmentVariable } from "./environment.ts";

const url = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL") ?? "postgresql://integration-tests-disabled";

export interface NotifyState {
	channel?: string;
	readonly cleanup?: Effect.Effect<void>;
	connections: number;
	muted: boolean;
	readonly payloads?: string[];
	resyncs: number;
}

const instrumentListener = Effect.fn("PostgresNotify.instrumentListener")(function* (
	listening: ReturnType<PostgresChangeClient["listen"]>,
	state: NotifyState,
) {
	const notifications = yield* listening;
	const scope = yield* Effect.scope;
	const instrumented = yield* Queue.unbounded<PostgresNotification, SqlError>();
	let registered = false;
	yield* Effect.forever(
		Effect.gen(function* () {
			const notification = yield* Queue.take(notifications);
			if (notification.payload.startsWith("[")) {
				state.payloads?.push(notification.payload);
			}
			if (!registered && state.cleanup !== undefined) {
				registered = true;
				yield* Scope.addFinalizer(scope, state.cleanup);
			}
			if (!state.muted) {
				yield* Queue.offer(instrumented, notification);
			}
		}),
	).pipe(
		Effect.catchCause((cause) => Queue.failCause(instrumented, cause)),
		Effect.forkScoped,
	);
	return instrumented;
});

export function runNotify<A, E>(
	body: Effect.Effect<A, E, SqlClient.SqlClient | Reactivity.Reactivity | Scope.Scope>,
	state: NotifyState = { connections: 0, muted: false, resyncs: 0 },
	timing: Pick<PostgresChangesOptions, "heartbeatInterval" | "heartbeatTimeout" | "retryDelay"> = {},
) {
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* PgClient.PgClient;
				state.channel = `notify_${crypto.randomUUID().replaceAll("-", "")}`;
				const original = client.listen;
				Object.assign(client, {
					listen: (channel: string) => {
						state.connections += 1;
						return instrumentListener(original(channel), state);
					},
				});
				const binding = yield* Layer.build(
					postgresChanges({
						...timing,
						channel: state.channel,
						client,
						resync: Effect.sync(() => {
							state.resyncs += 1;
						}),
					}),
				);
				return yield* body.pipe(Effect.provideContext(binding));
			}),
		).pipe(Effect.provide(Layer.merge(PgClient.layer({ url: Redacted.make(url) }), Reactivity.layer))),
	);
}

export function waitFor(check: () => boolean): Effect.Effect<void> {
	return Effect.suspend(() => (check() ? Effect.void : Effect.andThen(Effect.sleep("10 millis"), waitFor(check)))).pipe(
		Effect.timeout("5 seconds"),
		Effect.orDie,
	);
}
