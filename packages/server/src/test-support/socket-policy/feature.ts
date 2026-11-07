import { Effect, Option, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { permissionReadPolicy } from "@shivaedev/contract/permissionReadPolicy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { hasPermission } from "@shivaedev/identity/permission.ts";
import { roleView } from "#test/socket-policy/role/service.ts";

export class List extends Model.Class<List>("SocketList")({ id: Schema.Number, owner: bucket(Schema.String) }) {}
export class Note extends Model.Class<Note>("SocketNote")({ id: Schema.Number, listId: bucket(Schema.Number), title: Schema.String }) {}
export const lists = collection("socket_lists", Schema.Number, { owner: Schema.String });
export const notes = collection("socket_notes", Schema.Number, { listId: Schema.Number });
export const ManageNotes = { name: "notes.manage", strength: "any" } as const;
export const Api = contract("socketNotes", {
	commands: [
		command("createList", { invalidates: () => [], payload: { id: Schema.Number, owner: Schema.String } }),
		command("save", { invalidates: () => [], payload: { id: Schema.Number, listId: Schema.Number, title: Schema.String } }),
	],
	queries: [
		query("role", {
			readPolicy: () =>
				Effect.gen(function* () {
					const user = yield* SessionUser;
					return (yield* roleView.use((view) => view.read())).role === user.role;
				}),
			reads: () => [notes.bucket.listId(1)],
			success: Schema.Struct({ callerRole: Schema.String, capturedRole: Schema.String, role: Schema.String }),
		}),
		query("timeline", {
			payload: { owner: Schema.String },
			readPolicy: ({ owner }, viewer) => Effect.succeed(Option.exists(viewer, ({ id }) => id === owner)),
			reads: ({ owner }) => [lists.bucket.owner(owner)],
			serverReads: ({ owner }) =>
				SqlClient.SqlClient.use((sql) => sql<{ id: number }>`select id from socket_lists where owner = ${owner}`).pipe(
					Effect.map((rows) => rows.map(({ id }) => notes.bucket.listId(id))),
					Effect.orDie,
				),
			success: Schema.Array(Schema.String),
		}),
		query("all", {
			readPolicy: permissionReadPolicy(ManageNotes, (permission) => Effect.map(SessionUser, (user) => hasPermission(user, permission))),
			reads: () => [],
			readsCollections: [notes],
			success: Schema.Array(Schema.String),
		}),
	],
}).middleware(AuthenticatedUser);
