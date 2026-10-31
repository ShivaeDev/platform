import { Effect, type Option } from "effect";
import type { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import { type Contract, contract, type Declared, type QueryServices } from "@shivaedev/contract/contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "@shivaedev/contract/operation.ts";
import type { QueryReadPolicy, Viewer } from "@shivaedev/contract/readPolicy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";

export interface AdminRoute {
	readonly path: string;
	readonly permission: Permission;
	readonly title: string;
}

const AdminPageTypeId = Symbol.for("@shivaedev/admin/Page");

export interface AdminPage {
	readonly contract: RpcGroup.Any & {
		readonly application: RpcGroup.Any;
		readonly requests: ReadonlyMap<string, Rpc.Any>;
	};
	readonly id: string;
	readonly route: AdminRoute;
	readonly [AdminPageTypeId]: true;
}

interface PageGroup extends RpcGroup.Any {
	readonly application: RpcGroup.Any;
	middleware: (middleware: RpcMiddleware.AnyService) => PageGroup;
	readonly requests: ReadonlyMap<string, Rpc.Any>;
}

type PageQueries<TQueries extends readonly QueryShape[]> = {
	readonly [TIndex in keyof TQueries]: Omit<TQueries[TIndex], "readPolicy"> & {
		readonly readPolicy: QueryReadPolicy<
			TQueries[TIndex]["payload"]["Type"],
			TQueries[TIndex]["error"]["Type"],
			QueryServices<TQueries[TIndex]> | SessionUser
		>;
	};
};

type PageRpcs<TRpc> =
	TRpc extends Rpc.Rpc<infer TTag, infer TPayload, infer TSuccess, infer TError, infer TMiddleware, infer R>
		? Rpc.Rpc<TTag, TPayload, TSuccess, TError, TMiddleware, R | SessionUser>
		: never;

export function adminPage<
	const TId extends string,
	const TName extends string,
	const TQueries extends readonly QueryShape[],
	const TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.AnyWithProps,
	const TStreams extends readonly StreamShape[],
	TMiddleware extends RpcMiddleware.AnyService & { readonly permission: Permission },
>(page: {
	readonly id: TId;
	readonly route: Omit<AdminRoute, "permission">;
	readonly permission: TMiddleware;
	readonly contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams>;
}): AdminPage & {
	readonly id: TId;
	readonly contract: Contract<TName, PageQueries<TQueries>, TCommands, Rpc.AddMiddleware<PageRpcs<TRpcs>, TMiddleware>, TStreams>;
};
export function adminPage(page: {
	readonly id: string;
	readonly route: Omit<AdminRoute, "permission">;
	readonly permission: RpcMiddleware.AnyService & { readonly permission: Permission };
	readonly contract: {
		readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[]>;
		readonly requests: ReadonlyMap<string, Rpc.AnyWithProps>;
	};
}): AdminPage {
	const { declaration } = page.contract;
	const queries = declaration.queries.map((query) => ({
		...query,
		readPolicy: (payload: unknown, viewer: Option.Option<Viewer>) =>
			Effect.flatMap(SessionUser, (user) =>
				hasPermission(user, page.permission.permission) ? (query.readPolicy?.(payload, viewer) ?? Effect.succeed(true)) : Effect.succeed(false),
			),
	}));
	let protectedContract: PageGroup = contract(declaration.name, { ...declaration, queries });
	const original = page.contract.requests.values().next().value;
	if (original !== undefined) {
		for (const middleware of original.middlewares) {
			protectedContract = protectedContract.middleware(middleware);
		}
	}
	return {
		...page,
		route: { ...page.route, permission: page.permission.permission },
		[AdminPageTypeId]: true as const,
		contract: protectedContract.middleware(page.permission),
	};
}
