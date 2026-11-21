import { Tasks } from "#generated/test-support/Tasks.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";

export const TasksPage = adminPage({
	contract: Tasks,
	id: "tasks",
	permission: UsersPermission,
	route: { path: "/admin/tasks", title: "Tasks" },
});
