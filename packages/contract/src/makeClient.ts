import { Context, type Effect, type Layer, type Scope } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { Rpc, RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { bindingOwner } from "#adapters/bindingOwner.ts";
import { automaticLive, type LiveBound } from "#automaticLive.ts";
import type { Bound } from "#Bound.ts";
import { bindOperations } from "#bindOperations.ts";
import type { ClientOptions } from "#ClientOptions.ts";
import type { ActiveClient } from "#clientActivity.ts";
import { clientOperations } from "#clientOperations.ts";
import type { Contract, Declared } from "#contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "#operation.ts";
import { rpcClient } from "#rpcClient.ts";

// Every client made from contracts shares this service identity, so a contract's bound type does not depend on the record it was made from.
export interface ContractsClient {
	readonly ContractsClient: unique symbol;
}

export interface ClientContract {
	readonly annotations: Context.Context<never>;
	readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[], "session" | undefined>;
	readonly requests: ReadonlyMap<string, Rpc.Any>;
}

export type Contracts = Readonly<Record<string, ClientContract>>;

export type ContractClient<TContract> =
	TContract extends Contract<infer TName, infer TQueries, infer TCommands, infer TRpcs, infer TStreams, infer _TScope>
		? Bound<TName, TQueries, TCommands, TRpcs, ContractsClient, TStreams> & LiveBound
		: never;

export type ContractClients<TContracts extends Contracts> = { readonly [TKey in keyof TContracts]: ContractClient<TContracts[TKey]> };

type ContractRpcs<TContracts extends Contracts> = { [TKey in keyof TContracts]: RpcGroup.Rpcs<TContracts[TKey]> }[keyof TContracts];

type KeyScope<TContracts extends Contracts> = TContracts[keyof TContracts]["declaration"]["keyScope"];

export type MadeClient<TContracts extends Contracts> = Layer.Layer<ContractsClient> &
	ActiveClient & {
		readonly api: ContractClients<TContracts>;
		readonly Client: AtomRpc.AtomRpcClient<ContractsClient, string, ContractRpcs<TContracts>>;
		readonly client: Effect.Effect<
			RpcClient.RpcClient<ContractRpcs<TContracts>, RpcClientError>,
			never,
			Scope.Scope | Rpc.MiddlewareClient<ContractRpcs<TContracts>>
		>;
		readonly runtime: Atom.AtomRuntime<ContractsClient>;
		readonly sync: Effect.Effect<void, RpcClientError, ContractsClient>;
	};

export function makeClient<const TContracts extends Contracts>(
	contracts: TContracts,
	...options: "session" extends KeyScope<TContracts>
		? [options: ClientOptions & { readonly registry: AtomRegistry.AtomRegistry }]
		: [options?: ClientOptions]
): MadeClient<TContracts>;
export function makeClient(contracts: Contracts, options: ClientOptions = {}): Layer.Layer<never> {
	const list = Object.values(contracts);
	const source = {
		annotations: Context.mergeAll(...list.map((contract) => contract.annotations)),
		requests: new Map(list.flatMap((contract) => [...contract.requests])),
	};
	const { activity, connection } = rpcClient("@shivaedev/contract/Contracts", source, options);
	const { registry, resume, resumeWindow } = options;
	const bound = Object.entries(contracts).map(([key, { declaration }]) => {
		const owner = bindingOwner(declaration.keyScope, registry);
		const automatic = automaticLive(connection.Client, activity, declaration.name, owner, resume, resumeWindow);
		const operations = clientOperations(connection.Client, activity, automatic, owner);
		return { api: [key, bindOperations(declaration, operations, automatic.subscription)] as const, owner, sync: operations.sync };
	});
	// A sync runs through the session's registry when the record holds a session-scoped contract, as that contract's own calls do.
	const sync = (bound.find((binding) => binding.owner !== undefined) ?? bound[0])?.sync;
	return Object.assign(connection, { api: Object.fromEntries(bound.map((binding) => binding.api)), sync });
}
