import * as PgClient from "@effect/sql-pg/PgClient";
import { Channel, Effect, Layer, Redacted, Scope, Stream } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { SqlClient } from "effect/unstable/sql";
import { type PostgresChangeClient, postgresChanges } from "#postgresChanges.ts";
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

function instrumentListener(stream: ReturnType<PostgresChangeClient["listen"]>, state: NotifyState) {
	return Stream.fromChannel(
		Channel.fromTransform((upstream, scope) => {
			let registered = false;
			const tapped = stream.pipe(
				Stream.tap((payload) =>
					Effect.gen(function* () {
						if (payload.startsWith("[")) {
							state.payloads?.push(payload);
						}
						if (!registered && state.cleanup !== undefined) {
							registered = true;
							yield* Scope.addFinalizer(scope, state.cleanup);
						}
					}),
				),
				Stream.filter(() => !state.muted),
			);
			return Channel.toTransform(tapped.channel)(upstream, scope);
		}),
	);
}

export function runNotify<A, E>(
	body: Effect.Effect<A, E, SqlClient.SqlClient | Reactivity.Reactivity | Scope.Scope>,
	state: NotifyState = { connections: 0, muted: false, resyncs: 0 },
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
						channel: state.channel,
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
