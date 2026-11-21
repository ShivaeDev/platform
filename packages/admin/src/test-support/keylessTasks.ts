import { Schema } from "effect";
import { clientContract } from "@shivaedev/contract/clientContract.ts";
import type { ClientMatchesModule } from "@shivaedev/contract/clientMatchesModule.ts";
import { adminTasksWire } from "#generated/test-support/Tasks.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";
import type { Tasks } from "#test/Tasks.ts";

// Stands in for the generated browser contract of Tasks with none of the module's keys, so only the server module can name them.
export const KeylessTasks = clientContract({
	commands: { close: {} },
	middleware: UsersPermission,
	name: "admin.tasks",
	payloads: { close: { title: Schema.String } },
	queries: { open: { reads: () => [] } },
	wire: adminTasksWire,
});

export const keylessTasksMatchModule: ClientMatchesModule<typeof KeylessTasks, typeof Tasks> = true;

export const TasksPage = adminPage({
	contract: KeylessTasks,
	id: "tasks",
	permission: UsersPermission,
	route: { path: "/admin/tasks", title: "Tasks" },
});
