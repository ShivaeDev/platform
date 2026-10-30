import { Config, Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { appHost } from "#appHost.ts";
import { dropConnectionLedger, serverOffersTls } from "./connectionSecurity.ts";
import { Ping, pingHandlers } from "./ping.ts";
import { host } from "./story.ts";

export function databaseConnection(mode: "require" | undefined) {
	return host.trait("configured", `the database connection uses sslmode=${mode ?? "unset"}`, function* (state) {
		const url = new URL(yield* Config.String("PLATFORM_SQL_TEST_DATABASE_URL"));
		url.searchParams.delete("sslmode");
		if (mode !== undefined) {
			url.searchParams.set("sslmode", mode);
		}
		const name = `host_tls_${crypto.randomUUID().replaceAll("-", "")}`;
		state.applicationName = name;
		state.expectBootFailure = mode === "require" && !(yield* serverOffersTls());
		const table = `${name}_migrations`;
		state.cleanup.push(() => Effect.runPromise(dropConnectionLedger(table)));
		function build() {
			return appHost({
				config: { applicationName: name, databaseUrl: Redacted.make(url.toString()), host: "127.0.0.1", port: 0 },
				group: Ping,
				handlers: pingHandlers,
				migrations: { loader: Migrator.fromRecord({}), table },
				policy: "loopback",
			});
		}
		state.build = build;
	});
}
