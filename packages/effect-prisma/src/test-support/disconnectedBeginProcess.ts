import process from "node:process";
import { Effect, Redacted } from "effect";
import { makeDatabase } from "#database.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { disconnectPostgresBegin } from "#test/disconnectPostgresBegin.ts";
import { environmentVariable } from "#test/environment.ts";

process.on("uncaughtException", (error) => {
	process.stderr.write(`uncaughtException: ${error.message}\n`);
	process.exitCode = 1;
});

const Database = makeDatabase<Contract>()("@test/InterruptedBeginDatabase", { contractJson });
const program = Effect.acquireUseRelease(
	Effect.promise(() =>
		disconnectPostgresBegin(environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL") ?? "postgresql://integration-tests-disabled"),
	),
	(proxy) =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				Effect.flatMap(Database, (db) =>
					db.transaction(
						Effect.gen(function* () {
							yield* Database;
						}),
					),
				).pipe(Effect.provide(Database.layer({ url: proxy.url }))),
			);
			const original = Redacted.value(error.reason.original);
			if (!(original instanceof Error)) {
				throw new Error("The interrupted PostgreSQL driver did not return an Error");
			}
			process.stdout.write(
				JSON.stringify({
					begins: proxy.begins(),
					kind: error.reason._tag,
					original: { kind: Reflect.get(original, "kind"), message: original.message },
				}),
			);
		}),
	(proxy) => Effect.promise(proxy.close),
);
await Effect.runPromise(program);
