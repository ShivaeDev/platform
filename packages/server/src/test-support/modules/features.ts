import { Context, Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { AppModule } from "#AppModule.ts";
import { ToolsPermission } from "#test/permissions.ts";

export class TitleSource extends Context.Service<TitleSource, (title: string) => Effect.Effect<string>>()("test/modules/TitleSource") {}
class Notes extends Context.Service<Notes, string>()("test/modules/Notes") {}
class Tasks extends Context.Service<Tasks, string>()("test/modules/Tasks") {}

export const NotesApi = RpcGroup.make(Rpc.make("notes.read", { success: Schema.String }));
export const TasksApi = RpcGroup.make(Rpc.make("tasks.read", { success: Schema.String }));

const read = query("read", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String });
export const NotesPage = adminPage({
	contract: contract("admin.notes", { queries: [read] }),
	id: "notes",
	permission: ToolsPermission,
	route: { path: "/admin/notes", title: "Notes" },
});
export const TasksPage = adminPage({
	contract: contract("admin.tasks", { queries: [read] }),
	id: "tasks",
	permission: ToolsPermission,
	route: { path: "/admin/tasks", title: "Tasks" },
});

const migratedTitle = Effect.fnUntraced(function* (table: string) {
	const sql = yield* SqlClient.SqlClient;
	const [row] = yield* sql<{ title: string }>`select title from ${sql(table)}`;
	const source = yield* TitleSource;
	return yield* source(row?.title ?? "missing title");
});

function seedTitle(table: string, title: string) {
	return {
		apply: SqlClient.SqlClient.use((sql) => sql`insert into ${sql(table)} values (${title})`),
		name: table,
		pending: SqlClient.SqlClient.use((sql) => sql`select title from ${sql(table)}`).pipe(
			Effect.map((rows) => (rows.length === 0 ? `${table} needs its first title` : undefined)),
		),
	};
}

export const notesModule = {
	admin: registerAdmin(adminRegistry(NotesPage), { notes: NotesPage.contract.application.toLayer({ "admin.notes.read": () => Notes }) }),
	group: NotesApi,
	handlers: NotesApi.toLayer({ "notes.read": () => Notes }),
	migrations: {
		components: [seedTitle("module_notes", "A note")],
		loader: Migrator.fromRecord({
			"001_notes": SqlClient.SqlClient.use((sql) => sql`create table module_notes (title text not null)`),
		}),
	},
	ports: Layer.succeed(TitleSource, (title) => Effect.succeed(title)),
	services: Layer.effect(Notes, migratedTitle("module_notes")),
} satisfies AppModule;

export const tasksModule = {
	admin: registerAdmin(adminRegistry(TasksPage), { tasks: TasksPage.contract.application.toLayer({ "admin.tasks.read": () => Tasks }) }),
	group: TasksApi,
	handlers: TasksApi.toLayer({ "tasks.read": () => Tasks }),
	migrations: {
		components: [seedTitle("module_tasks", "A task")],
		loader: Migrator.fromRecord({
			"002_tasks": SqlClient.SqlClient.use((sql) => sql`create table module_tasks (title text not null)`),
		}),
	},
	services: Layer.effect(Tasks, migratedTitle("module_tasks")),
} satisfies AppModule;

export const Api = NotesApi.merge(TasksApi, NotesPage.contract, TasksPage.contract);
