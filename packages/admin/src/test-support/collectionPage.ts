import { Effect, Option, Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { permissionReadPolicy } from "@shivaedev/contract/permissionReadPolicy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { adminPage } from "#page.ts";
import { ReadUsers, UsersPermission } from "#permissions.ts";

export class Workspace extends Model.Class<Workspace>("AdminCollectionWorkspace")({
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
	tenant: bucket(Schema.String),
	title: Schema.String,
}) {}

export const workspaces = collection("admin_workspaces", Schema.Int, { tenant: Schema.String });

export function collectionPage() {
	return adminPage({
		contract: contract("admin.workspaces", {
			keyScope: "session",
			queries: [
				query("all", {
					readPolicy: permissionReadPolicy(ReadUsers, (_permission, viewer) =>
						Effect.map(SessionUser, (user) => Option.isSome(viewer) && viewer.value.id === user.id && user.id !== "restricted"),
					),
					reads: () => [],
					readsCollections: [workspaces],
					success: Schema.Array(Workspace),
				}),
			],
		}),
		id: "workspaces",
		permission: UsersPermission,
		route: { path: "/admin/workspaces", title: "Workspaces" },
	});
}
