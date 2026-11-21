import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { adminPage } from "@shivaedev/admin/page.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { registerAdmin } from "@shivaedev/admin/server/registerAdmin.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { AppModule } from "#AppModule.ts";
import { ToolsPermission } from "#test/permissions.ts";

const Titles = query("titles", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	*run() {
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql<{ title: string }>`select title from defined_notes order by id`;
		const titles: readonly string[] = rows.map(({ title }) => title);
		return titles;
	},
});

const Usage = defineModule({
	name: "admin.usage",
	operations: [Titles],
	wire: { titles: { rejections: {}, success: Schema.Array(Schema.String) } },
});

export const UsagePage = adminPage({ contract: Usage, id: "usage", permission: ToolsPermission, route: { path: "/admin/usage", title: "Usage" } });

// Serves only an admin page, so it names no group, handlers, name or services.
export const usageModule = { admin: registerAdmin(adminRegistry(UsagePage), { usage: Usage }) } satisfies AppModule;

// Declares a queue and nothing that names it, so a duplicate-queue refusal can only describe it.
export const remindersModule = { queues: [{ name: "reminders.send" }] } satisfies AppModule;
