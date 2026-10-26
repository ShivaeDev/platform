import { Config, Effect } from "effect";
import { Migrator } from "effect/sql";
import { appHost } from "#server/appHost.ts";
import { databaseIdentity } from "./databaseVerbs.ts";
import { Ping } from "./ping.ts";
import { host } from "./story.ts";

export function databaseAddress(source: "authority" | "parameters") {
	return host.trait("configured", `PostgreSQL uses the DATABASE_URL ${source} address`, function* (state) {
		const url = new URL(yield* Config.String("PLATFORM_SQL_TEST_DATABASE_URL"));
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
			});
		}
		state.build = build;
	});
}
