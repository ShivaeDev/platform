import { Context, Effect, Ref, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { adminTasksWire } from "#generated/test-support/Tasks.ts";
import { UsersPermission } from "#permissions.ts";

// Declared beside the operations that read and invalidate it; the generated browser contract copies no keys.
export const adminTasks = collection("admin_tasks", Schema.String);

export class OpenTasks extends Context.Service<OpenTasks, Ref.Ref<readonly string[]>>()("@shivaedev/admin/test/OpenTasks") {}

const Open = query("open", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [adminTasks.list],
	*run() {
		return yield* Ref.get(yield* OpenTasks);
	},
});

const Close = command("close", {
	invalidates: () => [adminTasks.list],
	payload: { title: Schema.String },
	*run({ title }) {
		yield* Ref.update(yield* OpenTasks, (open) => open.filter((task) => task !== title));
	},
});

// The page's server module: the only place its keys are declared.
export const Tasks = defineModule({
	middleware: UsersPermission,
	name: "admin.tasks",
	operations: [Open, Close],
	wire: adminTasksWire,
});
