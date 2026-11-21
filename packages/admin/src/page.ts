import type { Context } from "effect";
import type { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { Contract } from "@shivaedev/contract/contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "@shivaedev/contract/operation.ts";
import type { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import type { IdentityFailures } from "@shivaedev/identity/middleware.ts";

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
		readonly requests: ReadonlyMap<string, Rpc.AnyWithProps>;
	};
	readonly id: string;
	readonly permissionKey: string;
	readonly route: AdminRoute;
	readonly [AdminPageTypeId]: true;
}

export function adminPage<
	const TId extends string,
	const TRoute extends Omit<AdminRoute, "permission">,
	const TName extends string,
	const TQueries extends readonly QueryShape[],
	const TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.AnyWithProps,
	const TStreams extends readonly StreamShape[],
	TMiddleware extends RpcMiddleware.AnyService & PagePermission,
	const TScope extends "session" | undefined = undefined,
>(page: {
	readonly id: TId;
	readonly route: TRoute;
	readonly permission: TMiddleware;
	readonly contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams, TScope>;
}): AdminPage & {
	readonly route: TRoute & { readonly permission: Permission };
	readonly id: TId;
	readonly permissionKey: TMiddleware["key"];
	readonly contract: Contract<TName, TQueries, TCommands, Rpc.AddMiddleware<TRpcs, TMiddleware>, TStreams, TScope>;
};
// The browser calls the page through its generated contract; registerAdmin serves the page from its server module.
export function adminPage(page: {
	readonly id: string;
	readonly route: Omit<AdminRoute, "permission">;
	readonly permission: PagePermission & RpcMiddleware.AnyService;
	readonly contract: AdminPage["contract"] & { middleware: (middleware: RpcMiddleware.AnyService) => AdminPage["contract"] };
}): AdminPage {
	const { permission, ...definition } = page;
	return {
		...definition,
		permissionKey: permission.key,
		route: { ...page.route, permission: page.permission.permission },
		[AdminPageTypeId]: true as const,
		contract: page.contract.middleware(page.permission),
	};
}
