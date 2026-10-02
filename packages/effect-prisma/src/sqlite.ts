import sqlite, { type SqliteClient, type SqliteOptionsBase } from "@prisma-next/sqlite/runtime";
import { type Layer, Semaphore } from "effect";
import type { PrismaError } from "./error.ts";
import { acquireConnectedClient, assertAvailableModelNames } from "./internal/client-lifecycle.ts";
import { contractModels } from "./internal/database-facade.ts";
import { makeSqlDatabase } from "./internal/database-factory.ts";
import type { DatabaseIdentifier, DatabaseIdentifierLiteral, DatabaseServiceHolder, DefaultModels } from "./internal/database-types.ts";
import type { AnySqlContract } from "./internal/executor.ts";
import { fromPrismaPromise } from "./internal/promise.ts";
import { decodeSqliteDatetimesAsUtc } from "./internal/sqlite-datetime.ts";
import { applySqlitePragmas, assertFileBackedPath } from "./internal/sqlite-pragmas.ts";

export const defaultSqlitePragmas: ReadonlyArray<string> = ["journal_mode=WAL"];

export interface SqliteDatabaseLayerOptions extends SqliteOptionsBase {
	readonly path: string;
	readonly pragmas?: ReadonlyArray<string>;
}

type SqliteFactoryOptions<Contract extends AnySqlContract> =
	| {
			readonly contract: Contract;
			readonly contractJson?: never;
	  }
	| {
			readonly contractJson: unknown;
			readonly contract?: never;
	  };

export interface SqliteDatabaseDefinition<Contract extends AnySqlContract, Identifier extends string>
	extends DatabaseServiceHolder<Contract, Identifier> {
	readonly layer: (options: SqliteDatabaseLayerOptions) => Layer.Layer<DatabaseIdentifier<Contract, Identifier>, PrismaError>;
}

const clientOptions = ({ path, extensions, middleware, verifyMarker }: SqliteDatabaseLayerOptions) => ({
	path,
	...(extensions === undefined ? {} : { extensions }),
	...(middleware === undefined ? {} : { middleware }),
	...(verifyMarker === undefined ? {} : { verifyMarker }),
});

export const makeSqliteDatabase =
	<const Contract extends AnySqlContract>() =>
	<const Identifier extends string>(
		identifier: DatabaseIdentifierLiteral<Identifier>,
		options: SqliteFactoryOptions<Contract>,
	): SqliteDatabaseDefinition<Contract, Identifier> => {
		type Models = DefaultModels<Contract>;

		return makeSqlDatabase<Contract, Identifier, SqliteDatabaseLayerOptions>(identifier, (layerOptions) => {
			assertFileBackedPath(layerOptions.path);
			applySqlitePragmas(layerOptions.path, layerOptions.pragmas ?? defaultSqlitePragmas);

			const forwarded = clientOptions(layerOptions);
			const client: SqliteClient<Contract> =
				options.contract === undefined
					? sqlite<Contract>({
							...forwarded,
							contractJson: options.contractJson,
						})
					: sqlite<Contract>({
							...forwarded,
							contract: options.contract,
						});

			decodeSqliteDatetimesAsUtc(client.context);

			return fromPrismaPromise(() =>
				acquireConnectedClient(client, () => {
					// The SQLite client already exposes the unbound namespace.
					const models = contractModels<Models>(client.orm);
					const accessSemaphore = Semaphore.makeUnsafe(1);
					assertAvailableModelNames(Object.keys(models));
					return {
						client,
						identity: {},
						liveness: {
							closedCode: "RUNTIME.DATABASE_CLOSED",
							open: true,
						},
						mode: "root",
						models,
						querySemaphore: accessSemaphore,
						transactionIdentity: undefined,
						transactionSemaphore: accessSemaphore,
					};
				}),
			);
		});
	};
