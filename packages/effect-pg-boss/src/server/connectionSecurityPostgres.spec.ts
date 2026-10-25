import { Cause, Effect, Exit, Option, Redacted } from "effect";
import { expect } from "vitest";
import { PgBossError } from "#error.ts";
import { boss, realPostgres } from "#test/boss.ts";

for (const mode of [undefined, "require"] as const) {
	const name = `boss_tls_${crypto.randomUUID().replaceAll("-", "")}`;
	boss.it(
		`honors sslmode=${mode ?? "unset"} when starting the jobs Layer`,
		[realPostgres],
		function* ({ serverTls, connectWithMode, connectionBackends }) {
			const tls = yield* serverTls();
			const result = yield* Effect.exit(connectWithMode(mode, name));
			if (mode === "require" && !tls) {
				expect(Exit.isFailure(result)).toBe(true);
				if (Exit.isFailure(result)) {
					const error = Option.getOrThrow(Cause.findErrorOption(result.cause));
					expect(error).toBeInstanceOf(PgBossError);
					if (error instanceof PgBossError) {
						expect(error.operation).toBe("start");
						expect(Redacted.value(error.original)).toMatchObject({ message: "The server does not support SSL connections" });
					}
				}
				expect(yield* connectionBackends(name)).toEqual([]);
			} else {
				expect(Exit.isSuccess(result)).toBe(true);
				const backends = yield* connectionBackends(name);
				expect(backends.length).toBeGreaterThan(0);
				expect(backends.every((backend) => backend.ssl === (mode === "require"))).toBe(true);
			}
		},
	);
}
