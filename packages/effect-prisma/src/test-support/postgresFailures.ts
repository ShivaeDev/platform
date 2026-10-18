import { Effect, Redacted, Stream } from "effect";
import { makeDatabase } from "#database.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { missingTableContract } from "#test/missingTableContract.ts";
import { multipleNamespaceContract } from "#test/multipleNamespaceContract.ts";
import { databaseUrl } from "#test/postgresDatabase.ts";
import { unavailablePostgresUrl } from "#test/unavailablePostgresUrl.ts";

export function postgresFailures() {
	return {
		missingTable: () =>
			Effect.gen(function* () {
				const tableName = `missing_user_${crypto.randomUUID().replaceAll("-", "")}`;
				const Database = makeDatabase<Contract>()("@test/MissingTableDatabase", { contractJson: missingTableContract(tableName) });
				const error = yield* Effect.flip(
					Effect.flatMap(Database, (db) => Stream.runCollect(db.User.stream)).pipe(
						Effect.provide(Database.layer({ url: databaseUrl ?? "postgresql://integration-tests-disabled", verifyMarker: false })),
					),
				);
				return { error, tableName };
			}),
		multipleNamespaces: () => {
			const Database = makeDatabase<Contract>()("@test/MultiSchemaDatabase", { contractJson: multipleNamespaceContract });
			return Effect.exit(Database.pipe(Effect.provide(Database.layer({ url: databaseUrl ?? "postgresql://integration-tests-disabled" }))));
		},
		refusedSocket: () =>
			Effect.gen(function* () {
				const Database = makeDatabase<Contract>()("@test/UnavailableDatabase", { contractJson });
				const url = yield* Effect.promise(() => unavailablePostgresUrl(databaseUrl ?? "postgresql://integration-tests-disabled"));
				return yield* Effect.flip(
					Effect.flatMap(Database, (db) => db.User.count()).pipe(Effect.provide(Database.layer({ url: Redacted.make(url), verifyMarker: false }))),
				);
			}),
	};
}
