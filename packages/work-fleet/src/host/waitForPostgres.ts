import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Schedule } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { databaseAddress } from "@shivaedev/sql/databaseAddress.ts";
import { type FleetHost, HostFailure } from "#host/config.ts";

export const waitForPostgres = Effect.fn("FleetDaemon.waitForPostgres")(function* (host: FleetHost) {
	const url = Redacted.make(host.databaseUrl);
	let waiting = false;
	const probe = Effect.scoped(
		Effect.gen(function* () {
			const sql = yield* PgClient.makeClient({ ...databaseAddress(url), applicationName: "work-fleet-startup", url });
			yield* sql`select 1`;
		}),
	).pipe(Effect.provide(Reactivity.layer));
	yield* probe.pipe(
		Effect.tapError(() => {
			if (waiting) {
				return Effect.void;
			}
			waiting = true;
			return Effect.logInfo("Waiting for PostgreSQL at database.url; retrying with backoff (1–10 seconds) for up to 5 minutes");
		}),
		Effect.retry(Schedule.min([Schedule.exponential("1 second"), Schedule.spaced("10 seconds")])),
		Effect.timeoutOrElse({
			duration: "5 minutes",
			orElse: () => Effect.fail(new HostFailure({ message: "Timed out after 5 minutes waiting for PostgreSQL at database.url" })),
		}),
	);
	if (waiting) {
		yield* Effect.logInfo("PostgreSQL at database.url is ready; starting Fleet daemon");
	}
});
