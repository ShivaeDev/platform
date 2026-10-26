import { Cause, Option } from "effect";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { databaseConnection } from "#test/app-host/databaseConnection.ts";
import { host } from "#test/app-host/story.ts";

for (const mode of [undefined, "require"] as const) {
	const name = `host_tls_${crypto.randomUUID().replaceAll("-", "")}`;
	host.it(
		`honors sslmode=${mode ?? "unset"} when starting its database`,
		[databaseConnection(mode, name)],
		function* ({ serverTls, connectionBackends, bootFailure }) {
			if (mode === "require" && !(yield* serverTls())) {
				const cause = bootFailure();
				expect(Option.getOrUndefined(Cause.findErrorOption(cause))).toBeInstanceOf(SqlError);
				expect(Cause.pretty(cause)).toContain("Server refused TLS");
				expect(yield* connectionBackends(name)).toEqual([]);
			} else {
				const backends = yield* connectionBackends(name);
				expect(backends.length).toBeGreaterThan(0);
				expect(backends.every((backend) => backend.ssl === (mode === "require"))).toBe(true);
			}
		},
	);
}
