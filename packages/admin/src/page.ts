import { type Context, Effect, type Option } from "effect";
import type { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import { type Contract, contract, type Declared, type QueryServices } from "@shivaedev/contract/contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "@shivaedev/contract/operation.ts";
import type { QueryReadPolicy, Viewer } from "@shivaedev/contract/readPolicy.ts";
import { type Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import type { IdentityFailures } from "@shivaedev/identity/middleware.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";

export interface AdminRoute {
	readonly detail?: string;
	readonly path: string;
	readonly permission: Permission;
	readonly title: string;
}

const AdminPageTypeId = Symbol.for("@shivaedev/admin/Page");

type PagePermission = Context.Key<unknown, RpcMiddleware.RpcMiddleware<Identity | SessionUser, IdentityFailures, never>> & {
	readonly permission: Permission;
};

export interface AdminPage {
	readonly contract: RpcGroup.Any & {
		readonly application: RpcGroup.Any;
		readonly requests: ReadonlyMap<string, Rpc.Any>;
	};
	readonly id: string;
	readonly permissionKey: string;
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
	const TRoute extends Omit<AdminRoute, "permission">,
	const TName extends string,
	const TQueries extends readonly QueryShape[],
	const TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.AnyWithProps,
	const TStreams extends readonly StreamShape[],
	TMiddleware extends RpcMiddleware.AnyService & PagePermission,
>(page: {
	readonly id: TId;
	readonly route: TRoute;
	readonly permission: TMiddleware;
	readonly contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams>;
}): AdminPage & {
	readonly route: TRoute & { readonly permission: Permission };
	readonly id: TId;
	readonly permissionKey: TMiddleware["key"];
	readonly contract: Contract<TName, PageQueries<TQueries>, TCommands, Rpc.AddMiddleware<PageRpcs<TRpcs>, TMiddleware>, TStreams>;
};
export function adminPage(page: {
	readonly id: string;
	readonly route: Omit<AdminRoute, "permission">;
	readonly permission: PagePermission & RpcMiddleware.AnyService;
	readonly contract: {
		readonly declaration: Declared<string, readonly QueryShape[], readonly CommandShape[], readonly StreamShape[]>;
		readonly requests: ReadonlyMap<string, Rpc.AnyWithProps>;
	};
}): AdminPage {
	const { declaration } = page.contract;
	const queries = declaration.queries.map((query) => ({
		...query,
		readPolicy: Object.assign(
			(payload: unknown, viewer: Option.Option<Viewer>) =>
				Effect.flatMap(SessionUser, (user) =>
					hasPermission(user, page.permission.permission) ? (query.readPolicy?.(payload, viewer) ?? Effect.succeed(true)) : Effect.succeed(false),
				),
			query.readPolicy,
		),
	}));
	let protectedContract: PageGroup = contract(declaration.name, { ...declaration, queries });
	const original = page.contract.requests.values().next().value;
	if (original !== undefined) {
		for (const middleware of original.middlewares) {
			protectedContract = protectedContract.middleware(middleware);
		}
	}
	const { permission, ...definition } = page;
	return {
		...definition,
		permissionKey: permission.key,
		route: { ...page.route, permission: page.permission.permission },
		[AdminPageTypeId]: true as const,
		contract: protectedContract.middleware(page.permission),
	};
}
