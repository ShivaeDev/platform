import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer, Redacted, type Scope, Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { SqlClient } from "effect/unstable/sql";
import { postgresChanges } from "#postgresChanges.ts";
import { environmentVariable } from "./environment.ts";

const url = environmentVariable("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL") ?? "postgresql://integration-tests-disabled";

export interface NotifyState {
	connections: number;
	muted: boolean;
	readonly payloads?: string[];
	resyncs: number;
}

export function runNotify<A, E>(
	body: Effect.Effect<A, E, SqlClient.SqlClient | Reactivity.Reactivity | Scope.Scope>,
	state: NotifyState = { connections: 0, muted: false, resyncs: 0 },
) {
	function capture(payload: string) {
		return Effect.sync(() => {
			if (payload.startsWith("[")) {
				state.payloads?.push(payload);
			}
		});
	}
	return Effect.runPromise(
		Effect.scoped(
			Effect.gen(function* () {
				const client = yield* PgClient.PgClient;
				const original = client.listen;
				Object.assign(client, {
					listen: (channel: string) => {
						state.connections += 1;
						return original(channel).pipe(
							Stream.tap(capture),
							Stream.filter(() => !state.muted),
						);
					},
				});
				const binding = yield* Layer.build(
					postgresChanges({
						channel: `notify_${crypto.randomUUID().replaceAll("-", "")}`,
						client,
						heartbeatInterval: "50 millis",
						heartbeatTimeout: "150 millis",
						resync: Effect.sync(() => {
							state.resyncs += 1;
						}),
						retryDelay: "20 millis",
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
