import { Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { appHost } from "#appDatabase.ts";
import { databaseIdentity } from "#test/app-host/databaseVerbs.ts";
import { Ping } from "#test/app-host/ping.ts";
import { databaseOf } from "#test/app-host/state.ts";
import { postgresHost } from "#test/app-host/story.ts";

export function databaseAddress(source: "authority" | "parameters") {
	return postgresHost.trait("configured", `PostgreSQL uses the DATABASE_URL ${source} address`, function* (state) {
		const url = new URL(Redacted.value(databaseOf(state).url));
		url.hostname = "127.0.0.1";
		if (source === "parameters") {
			url.searchParams.set("host", url.hostname);
			url.searchParams.set("port", url.port);
			url.hostname = "unused.invalid";
			url.port = "1";
		}
		state.env.DATABASE_URL = url.toString();
		function build() {
			return appHost({
				config: state.config,
				group: Ping,
				handlers: Ping.toLayer({ ping: () => databaseIdentity.pipe(Effect.map(JSON.stringify), Effect.orDie) }),
				migrations: { loader: Migrator.fromRecord({}) },
				policy: "loopback",
				postgresSettings: {},
			});
		}
		state.build = build;
	});
}
