import postgres, {
	type PostgresClient,
	type PostgresOptionsBase,
} from "@prisma-next/postgres/runtime";
import { type Layer, Redacted } from "effect";
import type { PrismaError } from "./error.js";
import { acquireConnectedClient } from "./internal/client-lifecycle.js";
import {
	type DatabaseIdentifier,
	type DatabaseServiceHolder,
	type DefaultModels,
	makeSqlDatabase,
	namespaceModels,
} from "./internal/database-factory.js";
import type {
	AnySqlContract,
	ExecutorIdentifier,
} from "./internal/executor.js";
import { fromPrismaPromise } from "./internal/promise.js";

export type {
	AnyDatabase,
	DatabaseRequirement,
	DatabaseService,
	DatabaseServiceOf,
} from "./internal/database-factory.js";

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

export interface DatabaseDefinition<
	Contract extends AnySqlContract,
	Requirement = ExecutorIdentifier<DefaultModels<Contract>>,
> extends DatabaseServiceHolder<Contract, Requirement> {
	readonly layer: (
		options: DatabaseLayerOptions,
	) => Layer.Layer<DatabaseIdentifier<Contract> | Requirement, PrismaError>;
}

const defaultModels = <Contract extends AnySqlContract, Models extends object>(
	client: Pick<PostgresClient<Contract>, "contract" | "orm">,
): Models => namespaceModels<Contract, Models>(client.contract, client.orm);

export const makeDatabase = <const Contract extends AnySqlContract>(
	identifier: string,
	options: DatabaseFactoryOptions<Contract>,
): DatabaseDefinition<Contract> => {
	type Models = DefaultModels<Contract>;

	return makeSqlDatabase<Contract, DatabaseLayerOptions>(
		identifier,
		(layerOptions) => {
			const clientOptions = {
				url:
					typeof layerOptions.url === "string"
						? layerOptions.url
						: Redacted.value(layerOptions.url),
				extensions: layerOptions.extensions,
				middleware: layerOptions.middleware,
				poolOptions: layerOptions.poolOptions,
				verifyMarker: layerOptions.verifyMarker,
			};
			const client =
				options.contract === undefined
					? postgres<Contract>({
							...clientOptions,
							contractJson: options.contractJson,
						})
					: postgres<Contract>({
							...clientOptions,
							contract: options.contract,
						});

			return fromPrismaPromise(() =>
				acquireConnectedClient(client, () => ({
					client,
					models: defaultModels<Contract, Models>(client),
					querySemaphore: undefined,
					transactional: false,
				})),
			);
		},
	) as DatabaseDefinition<Contract>;
};
