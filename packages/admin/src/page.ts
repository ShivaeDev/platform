import type { Rpc, RpcGroup } from "effect/rpc";
import type { Contract } from "@shivaedev/effect-contract/contract.ts";
import type { CommandShape, QueryShape, StreamShape } from "@shivaedev/effect-contract/operation.ts";
import { AdminPermission } from "#permissions.ts";

export interface AdminRoute {
	readonly path: string;
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
>(page: {
	readonly id: TId;
	readonly route: AdminRoute;
	readonly contract: Contract<TName, TQueries, TCommands, TRpcs, TStreams>;
}): AdminPage & {
	readonly id: TId;
	readonly contract: Contract<TName, TQueries, TCommands, Rpc.AddMiddleware<TRpcs, typeof AdminPermission>, TStreams>;
} {
	return { ...page, [AdminPageTypeId]: true as const, contract: page.contract.middleware(AdminPermission) };
}
