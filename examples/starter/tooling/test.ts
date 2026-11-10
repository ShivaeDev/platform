import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, Exit, Option, Runtime } from "effect";
import { assertLocalDatabase } from "@shivaedev/local-postgres/server/assertLocalDatabase.ts";
import { LocalPostgresError } from "@shivaedev/local-postgres/server/LocalPostgresError.ts";
import { main } from "@shivaedev/vitest-rerun/main.ts";

const program = Effect.gen(function* () {
	const database = yield* Config.String("TEST_DATABASE_URL").pipe(Config.option);
	if (Option.isSome(database)) {
		const url = yield* Effect.try({
			catch: () => new LocalPostgresError({ message: "Invalid local test database URL." }),
			try: () => new URL(database.value),
		});
		yield* Effect.fromResult(assertLocalDatabase(database.value, [url.pathname.slice(1)], ["55432", "5432"]));
	}
	return yield* main(process.argv.slice(2), process.cwd());
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)), {
	teardown: (exit, onExit) => (Exit.isSuccess(exit) ? onExit(Number(exit.value)) : Runtime.defaultTeardown(exit, onExit)),
});
