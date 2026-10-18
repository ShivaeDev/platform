import postgres, { type PostgresClient, type PostgresOptionsBase } from "@prisma-next/postgres/runtime";
import { type Layer, Redacted } from "effect";
import type { DatabaseIdentifier, DatabaseIdentifierLiteral, DatabaseServiceHolder, DefaultModels } from "#databaseTypes.ts";
import { acquireConnectedClient } from "#internal/clientLifecycle.ts";
import { namespaceModels } from "#internal/databaseFacade.ts";
import type { AnySqlContract } from "#internal/executor.ts";
import { makePostgresPool } from "#internal/makePostgresPool.ts";
import { makeSqlDatabase } from "#internal/makeSqlDatabase.ts";
import { fromPrismaPromise } from "#internal/promise.ts";
import type { PrismaError } from "./error.ts";

export interface DatabaseLayerOptions extends PostgresOptionsBase {
	readonly url: string | Redacted.Redacted<string>;
}

type DatabaseFactoryOptions<TContract extends AnySqlContract> =
	| {
			readonly contract: TContract;
			readonly contractJson?: never;
	  }
	| {
			readonly contractJson: unknown;
			readonly contract?: never;
	  };

export interface DatabaseDefinition<TContract extends AnySqlContract, TIdentifier extends string>
	extends DatabaseServiceHolder<TContract, TIdentifier> {
	readonly layer: (options: DatabaseLayerOptions) => Layer.Layer<DatabaseIdentifier<TContract, TIdentifier>, PrismaError>;
}

function clientOptions({ url, extensions, middleware, poolOptions, verifyMarker }: DatabaseLayerOptions) {
	return {
		url: typeof url === "string" ? url : Redacted.value(url),
		...(extensions === undefined ? {} : { extensions }),
		...(middleware === undefined ? {} : { middleware }),
		...(poolOptions === undefined ? {} : { poolOptions }),
		...(verifyMarker === undefined ? {} : { verifyMarker }),
	};
}

function defaultModels<TContract extends AnySqlContract, TModels extends object>(
	client: Pick<PostgresClient<TContract>, "contract" | "orm">,
): TModels {
	return namespaceModels<TContract, TModels>(client.contract, client.orm);
}

export const makeDatabase =
	<const TContract extends AnySqlContract>() =>
	<const TIdentifier extends string>(
		identifier: DatabaseIdentifierLiteral<TIdentifier>,
		options: DatabaseFactoryOptions<TContract>,
	): DatabaseDefinition<TContract, TIdentifier> => {
		type Models = DefaultModels<TContract>;

		return makeSqlDatabase<TContract, TIdentifier, DatabaseLayerOptions>(identifier, (layerOptions) => {
			const forwarded = clientOptions(layerOptions);
			const client =
				options.contract === undefined
					? postgres<TContract>({
							...forwarded,
							contractJson: options.contractJson,
						})
					: postgres<TContract>({
							...forwarded,
							contract: options.contract,
						});
			const pool = makePostgresPool(forwarded.url, layerOptions.poolOptions);
			let closing: Promise<void> | undefined;
			const ownedClient = {
				...client,
				close: () => {
					closing ??= client.close().finally(() => pool.end());
					return closing;
				},
				connect: () => client.connect({ pg: pool }),
			};

			return fromPrismaPromise(() =>
				acquireConnectedClient(ownedClient, () => ({
					client: ownedClient,
					identity: {},
					liveness: {
						closedCode: "RUNTIME.DATABASE_CLOSED",
						open: true,
					},
					mode: "root",
					models: defaultModels<TContract, Models>(client),
					querySemaphore: undefined,
					transactionIdentity: undefined,
					transactionSemaphore: undefined,
				})),
			);
		});
	};
