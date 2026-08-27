import sqlite, {
	type SqliteClient,
	type SqliteOptionsBase,
} from "@prisma-next/sqlite/runtime";
import { type Layer, Semaphore } from "effect";
import type { PrismaError } from "./error.js";
import {
	acquireConnectedClient,
	assertAvailableModelNames,
} from "./internal/client-lifecycle.js";
import {
	type DatabaseIdentifier,
	type DatabaseIdentifierLiteral,
	type DatabaseServiceHolder,
	type DefaultModels,
	makeSqlDatabase,
} from "./internal/database-factory.js";
import type { AnySqlContract } from "./internal/executor.js";
import { fromPrismaPromise } from "./internal/promise.js";
import { decodeSqliteDatetimesAsUtc } from "./internal/sqlite-datetime.js";
import {
	applySqlitePragmas,
	assertFileBackedPath,
} from "./internal/sqlite-pragmas.js";

export const defaultSqlitePragmas: ReadonlyArray<string> = ["journal_mode=WAL"];

export interface SqliteDatabaseLayerOptions extends SqliteOptionsBase {
	/** Path to the database file. In-memory databases are not supported. */
	readonly path: string;
	/**
	 * Pragmas applied once when the Layer connects. Defaults to
	 * {@link defaultSqlitePragmas}; pass `[]` to skip them.
	 */
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

export interface SqliteDatabaseDefinition<
	Contract extends AnySqlContract,
	Identifier extends string,
> extends DatabaseServiceHolder<Contract, Identifier> {
	readonly layer: (
		options: SqliteDatabaseLayerOptions,
	) => Layer.Layer<DatabaseIdentifier<Contract, Identifier>, PrismaError>;
}

export const makeSqliteDatabase =
	<const Contract extends AnySqlContract>() =>
	<const Identifier extends string>(
		identifier: DatabaseIdentifierLiteral<Identifier>,
		options: SqliteFactoryOptions<Contract>,
	): SqliteDatabaseDefinition<Contract, Identifier> => {
		type Models = DefaultModels<Contract>;

		return makeSqlDatabase<Contract, Identifier, SqliteDatabaseLayerOptions>(
			identifier,
			(layerOptions) => {
				assertFileBackedPath(layerOptions.path);
				applySqlitePragmas(
					layerOptions.path,
					layerOptions.pragmas ?? defaultSqlitePragmas,
				);

				const clientOptions = {
					path: layerOptions.path,
					extensions: layerOptions.extensions,
					middleware: layerOptions.middleware,
					verifyMarker: layerOptions.verifyMarker,
				};
				const client: SqliteClient<Contract> =
					options.contract === undefined
						? sqlite<Contract>({
								...clientOptions,
								contractJson: options.contractJson,
							})
						: sqlite<Contract>({
								...clientOptions,
								contract: options.contract,
							});

				decodeSqliteDatetimesAsUtc(client.context);

				return fromPrismaPromise(() =>
					acquireConnectedClient(client, () => {
						// The SQLite client already exposes the unbound namespace.
						const models = client.orm as Models;
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
							querySemaphore: undefined,
							transactionSemaphore: Semaphore.makeUnsafe(1),
						};
					}),
				);
			},
		) as SqliteDatabaseDefinition<Contract, Identifier>;
	};
