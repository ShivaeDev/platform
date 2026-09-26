import postgres, { type PostgresClient, type PostgresOptionsBase } from "@prisma-next/postgres/runtime";
import { type Layer, Redacted } from "effect";
import type { PrismaError } from "./error.ts";
import { acquireConnectedClient } from "./internal/client-lifecycle.ts";
import { namespaceModels } from "./internal/database-facade.ts";
import { makeSqlDatabase } from "./internal/database-factory.ts";
import type { DatabaseIdentifier, DatabaseIdentifierLiteral, DatabaseServiceHolder, DefaultModels } from "./internal/database-types.ts";
import type { AnySqlContract } from "./internal/executor.ts";
import { fromPrismaPromise } from "./internal/promise.ts";

export type {
	AnyDatabase,
	DatabaseService,
	DatabaseServiceOf,
} from "./internal/database-types.ts";

export interface DatabaseLayerOptions extends PostgresOptionsBase {
	readonly url: string | Redacted.Redacted<string>;
}

type DatabaseFactoryOptions<Contract extends AnySqlContract> =
	| {
			readonly contract: Contract;
			readonly contractJson?: never;
	  }
	| {
			readonly contractJson: unknown;
			readonly contract?: never;
	  };

export interface DatabaseDefinition<Contract extends AnySqlContract, Identifier extends string> extends DatabaseServiceHolder<Contract, Identifier> {
	readonly layer: (options: DatabaseLayerOptions) => Layer.Layer<DatabaseIdentifier<Contract, Identifier>, PrismaError>;
}

const clientOptions = ({ url, extensions, middleware, poolOptions, verifyMarker }: DatabaseLayerOptions) => ({
	url: typeof url === "string" ? url : Redacted.value(url),
	...(extensions === undefined ? {} : { extensions }),
	...(middleware === undefined ? {} : { middleware }),
	...(poolOptions === undefined ? {} : { poolOptions }),
	...(verifyMarker === undefined ? {} : { verifyMarker }),
});

const defaultModels = <Contract extends AnySqlContract, Models extends object>(client: Pick<PostgresClient<Contract>, "contract" | "orm">): Models =>
	namespaceModels<Contract, Models>(client.contract, client.orm);

export const makeDatabase =
	<const Contract extends AnySqlContract>() =>
	<const Identifier extends string>(
		identifier: DatabaseIdentifierLiteral<Identifier>,
		options: DatabaseFactoryOptions<Contract>,
	): DatabaseDefinition<Contract, Identifier> => {
		type Models = DefaultModels<Contract>;

		return makeSqlDatabase<Contract, Identifier, DatabaseLayerOptions>(identifier, (layerOptions) => {
			const forwarded = clientOptions(layerOptions);
			const client =
				options.contract === undefined
					? postgres<Contract>({
							...forwarded,
							contractJson: options.contractJson,
						})
					: postgres<Contract>({
							...forwarded,
							contract: options.contract,
						});

			return fromPrismaPromise(() =>
				acquireConnectedClient(client, () => ({
					client,
					identity: {},
					liveness: {
						closedCode: "RUNTIME.DATABASE_CLOSED",
						open: true,
					},
					mode: "root",
					models: defaultModels<Contract, Models>(client),
					querySemaphore: undefined,
					transactionIdentity: undefined,
					transactionSemaphore: undefined,
				})),
			);
		});
	};
