import type { AnyRoute } from "@tanstack/react-router";
import type { Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import type { ClientOptions } from "@shivaedev/contract/ClientOptions.ts";
import { type ActiveClient, Activity, clientActivity } from "@shivaedev/contract/clientActivity.ts";
import { type BindingComposition, composeBindings, liveBindings } from "@shivaedev/contract/composeBindings.ts";
import { type ClientContract, type ContractClients, type Contracts, type ContractsClient, makeClient } from "@shivaedev/contract/makeClient.ts";
import type { AdminNavigation, BindContracts, ClientModule, ModuleParts, RootRoute } from "#client/module.ts";

export type ModuleRoute<TModules extends readonly ClientModule[]> = TModules[number] extends ClientModule<infer TRoute> ? TRoute : never;

export interface AppConnection<TRoute extends AnyRoute = AnyRoute> extends ActiveClient, BindingComposition {
	readonly adminPages: readonly AdminNavigation[];
	readonly modules: readonly ModuleParts<TRoute>[];
	readonly routes: (root: RootRoute) => readonly TRoute[];
	readonly runtime: Atom.AtomRuntime<ContractsClient>;
	readonly sync: Effect.Effect<void, RpcClientError, ContractsClient>;
}

export interface ClientApp<TRoute extends AnyRoute = AnyRoute> {
	readonly connect: (session: unknown, registry: AtomRegistry.AtomRegistry) => AppConnection<TRoute>;
	readonly warm: (connection: AppConnection) => readonly Atom.Atom<unknown>[];
}

export type ClientAppOptions = Omit<ClientOptions, "registry">;

function bindingsOf(bound: ReadonlyMap<ClientContract, unknown>): BindContracts {
	function clientsOf<TContracts extends Contracts>(contracts: TContracts): ContractClients<TContracts>;
	function clientsOf(contracts: Contracts): Readonly<Record<string, unknown>> {
		return Object.fromEntries(Object.entries(contracts).map(([name, contract]) => [name, bound.get(contract)]));
	}
	return clientsOf;
}

function connectModules(modules: readonly ClientModule[], options: ClientAppOptions, registry: AtomRegistry.AtomRegistry): AppConnection {
	// A contract two modules name is bound once, so both read the same live queries.
	const unique = [...new Set(modules.flatMap((module) => Object.values(module.contracts)))];
	const made = makeClient(Object.fromEntries(unique.map((contract, index) => [`${index}`, contract])), { ...options, registry });
	const bound = new Map<ClientContract, unknown>(unique.map((contract, index) => [contract, made.api[`${index}`]]));
	const clientsFor = bindingsOf(bound);
	const parts = modules.map((module) => module.connect(clientsFor));
	return composeBindings(
		{
			[Activity]: clientActivity(made),
			adminPages: parts.flatMap((part) => part.admin?.pages ?? []),
			modules: parts,
			routes: (root: RootRoute) => parts.flatMap((part) => part.routes?.(root) ?? []),
			runtime: made.runtime,
			sync: made.sync,
		},
		liveBindings(made.api),
	);
}

export function clientApp<const TModules extends readonly ClientModule[]>(
	modules: TModules,
	options?: ClientAppOptions,
): ClientApp<ModuleRoute<TModules>>;
export function clientApp(modules: readonly ClientModule[], options: ClientAppOptions = {}): ClientApp {
	return {
		connect: (_session, registry) => connectModules(modules, options, registry),
		warm: (connection) => connection.modules.flatMap((part) => part.warm ?? []),
	};
}
