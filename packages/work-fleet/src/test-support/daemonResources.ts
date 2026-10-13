import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Fiber, Layer, Redacted, Ref } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";
import { SessionTransport } from "#session/service.ts";

export const daemonResources = Effect.fn("DaemonTest.daemonResources")(function* (source: Layer.Layer<SessionTransport, unknown>, host?: FleetHost) {
	let providers = 0;
	let releases = 0;
	const provider = Layer.effect(SessionTransport)(
		Effect.gen(function* () {
			providers += 1;
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					releases += 1;
				}),
			);
			return yield* SessionTransport;
		}).pipe(Effect.provide(source)),
	);
	const control =
		host === undefined
			? undefined
			: Context.get(
					yield* Layer.build(PgClient.layer({ applicationName: "work-fleet-test", maxConnections: 1, url: Redacted.make(host.databaseUrl) })),
					SqlClient.SqlClient,
				);
	// PostgreSQL itself reports the daemon's open sessions, whatever client library opened them.
	const connections = Effect.gen(function* () {
		if (control === undefined) {
			return yield* Effect.die("daemonResources needs the host to observe connections");
		}
		const [row] = yield* control<{
			readonly count: bigint;
		}>`select count(*) as count from pg_stat_activity where datname = current_database() and application_name = 'work-fleet'`;
		return Number(row?.count ?? 0n);
	}).pipe(Effect.orDie);
	return {
		connections,
		peakConnections: Effect.fn("DaemonTest.peakConnections")(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
			const peak = yield* Ref.make(0);
			const sampler = yield* connections.pipe(
				Effect.flatMap((count) => Ref.update(peak, (current) => Math.max(current, count))),
				Effect.andThen(Effect.sleep("5 millis")),
				Effect.forever,
				Effect.forkChild,
			);
			const value = yield* effect.pipe(Effect.ensuring(Fiber.interrupt(sampler)));
			return { peak: yield* Ref.get(peak), value };
		}),
		provider,
		get providers() {
			return providers;
		},
		get releases() {
			return releases;
		},
	};
});
