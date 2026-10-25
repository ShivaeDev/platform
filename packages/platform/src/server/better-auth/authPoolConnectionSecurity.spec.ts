import { Effect, Exit } from "effect";
import { expect } from "vitest";
import { authPool, openAuthPool } from "#test/better-auth/pool.ts";

for (const mode of [undefined, "require"] as const) {
	const name = `auth_tls_${crypto.randomUUID().replaceAll("-", "")}`;
	authPool.it(
		`honors sslmode=${mode ?? "unset"} when querying through authDatabase`,
		[openAuthPool({ "application_name": name }, mode ?? "unset")],
		function* ({ query, serverTls, connectionBackends }) {
			const tls = yield* serverTls();
			const result = yield* Effect.exit(query());
			if (mode === "require" && !tls) {
				expect(result).toMatchObject({ _tag: "Failure" });
				if (Exit.isFailure(result)) {
					expect(result.cause.toString()).toContain("The server does not support SSL connections");
				}
				expect(yield* connectionBackends(name)).toEqual([]);
			} else {
				expect(Exit.isSuccess(result)).toBe(true);
				const connections = yield* connectionBackends(name);
				expect(connections.length).toBeGreaterThan(0);
				expect(connections.every((connection) => connection.ssl === (mode === "require"))).toBe(true);
			}
		},
	);
}
