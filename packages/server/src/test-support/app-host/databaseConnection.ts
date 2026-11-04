import { Redacted } from "effect";
import { Migrator } from "effect/sql";
import { appHost } from "#appDatabase.ts";
import { serverOffersTls } from "./connectionSecurity.ts";
import { Ping, pingHandlers } from "./ping.ts";
import { databaseOf } from "./state.ts";
import { postgresHost } from "./story.ts";

export function databaseConnection(mode: "require" | undefined) {
	return postgresHost.trait("configured", `the database connection uses sslmode=${mode ?? "unset"}`, function* (state) {
		const url = new URL(Redacted.value(databaseOf(state).url));
		url.searchParams.delete("sslmode");
		if (mode !== undefined) {
			url.searchParams.set("sslmode", mode);
		}
		const name = "host_tls";
		state.applicationName = name;
		state.expectBootFailure = mode === "require" && !(yield* serverOffersTls(state));
		const table = `${name}_migrations`;
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
