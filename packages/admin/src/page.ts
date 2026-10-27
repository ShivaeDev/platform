import type { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { Contract } from "@shivaedev/contract/contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "@shivaedev/contract/operation.ts";

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

export function adminPage<
	const TId extends string,
	const TName extends string,
	const TQueries extends readonly QueryShape[],
	const TCommands extends readonly CommandShape[],
	TRpcs extends Rpc.Any,
	const TStreams extends readonly StreamShape[],
	TMiddleware extends RpcMiddleware.AnyService & { readonly permission: Permission },
>(page: {
	readonly id: TId;
	readonly route: Omit<AdminRoute, "permission">;
	readonly permission: TMiddleware;
	readonly contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams>;
}): AdminPage & {
	readonly id: TId;
	readonly contract: Contract<TName, TQueries, TCommands, Rpc.AddMiddleware<TRpcs, TMiddleware>, TStreams>;
} {
	return {
		...page,
		route: { ...page.route, permission: page.permission.permission },
		[AdminPageTypeId]: true as const,
		contract: page.contract.middleware(page.permission),
	};
}
