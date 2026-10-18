import { randomUUID } from "node:crypto";
import { Cause, Config, Effect, Exit, Option } from "effect";
import { expect } from "vitest";
import { databaseSetup } from "#test-support/databaseSetup.ts";

databaseSetup.it.runIf(Option.isSome(Effect.runSync(Config.option(Config.String("TEST_DATABASE_URL")))))(
	"prepares databases with the names configured in their URLs instead of the package name",
	[],
	function* ({ prepare, connectedDatabase }) {
		const name = randomUUID().replaceAll("-", "");
		const development = `postgresql://postgres:postgres@127.0.0.1:55432/local_${name}`;
		const tests = `postgresql://postgres:postgres@127.0.0.1:55432/specs_${name}`;
		yield* prepare({ "DATABASE_URL": development, "TEST_DATABASE_URL": tests });
		expect(yield* connectedDatabase(development)).toBe(`local_${name}`);
		expect(yield* connectedDatabase(tests)).toBe(`specs_${name}`);
	},
);

for (const missing of ["DATABASE_URL", "TEST_DATABASE_URL"]) {
	databaseSetup.it(`fails with a typed config error when ${missing} is missing`, [], function* ({ prepare }) {
		const name = randomUUID().replaceAll("-", "");
		const env: Record<string, string> = {
			"DATABASE_URL": `postgresql://postgres:postgres@127.0.0.1:55432/local_${name}`,
			"TEST_DATABASE_URL": `postgresql://postgres:postgres@127.0.0.1:55432/specs_${name}`,
		};
		delete env[missing];
		const exit = yield* Effect.exit(prepare(env));
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Option.getOrUndefined(Cause.findErrorOption(exit.cause))).toBeInstanceOf(Config.ConfigError);
			expect(Cause.pretty(exit.cause)).toContain(missing);
		}
	});
}
