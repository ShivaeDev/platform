import { Context, Effect, Option, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import type { SessionUserValue } from "@shivaedev/identity/identity.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { permissionReadPolicy } from "#permissionReadPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";

export class Workspace extends Model.Class<Workspace>("CollectionWorkspace")({
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
	tenant: bucket(Schema.String),
	title: Schema.String,
}) {}

export class Permissions extends Context.Service<Permissions, Map<string, SessionUserValue>>()("test/CollectionPermissions") {}
export class Guard extends RpcMiddleware.Service<Guard>()("test/CollectionGuard", {
	error: Schema.Union([MissingReadPolicy, QueryReadDenied]),
}) {}

export const ManageWorkspaces = { name: "workspaces.manage", strength: "any" } as const;
export const workspaces = collection("workspaces", Schema.Int, { tenant: Schema.String });
export const adminPolicy = permissionReadPolicy(ManageWorkspaces, (permission, viewer) =>
	Effect.map(Permissions, (people) => {
		const user = Option.isSome(viewer) ? people.get(viewer.value.id) : undefined;
		return user !== undefined && hasPermission(user, permission);
	}),
);

export function collectionContract() {
	return contract("workspaces", {
		keyScope: "session",
		queries: [
			query("all", {
				readPolicy: adminPolicy,
				reads: () => [],
				readsCollections: [workspaces],
				success: Schema.Array(Workspace),
			}),
		],
	}).middleware(Guard);
}
