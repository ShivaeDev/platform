import { timeoutApp } from "./timeoutApp.ts";

declare module "vitest" {
	interface TaskMeta {
		isolation?: { closedBeforeSetup: readonly string[]; databases: readonly string[]; name: string };
		items?: readonly { value: string }[];
	}
}

timeoutApp.it(
	"times out with a running worker",
	[],
	function* ({ writeItem, sleep, readItems }, context) {
		yield* writeItem("before timeout");
		context.task.meta.items = yield* readItems();
		yield* sleep();
	},
	10_000,
);

timeoutApp.it("writes in the next isolated database", [], function* ({ writeItem, readItems, readIsolation }, context) {
	yield* writeItem("after timeout");
	context.task.meta.items = yield* readItems();
	context.task.meta.isolation = readIsolation();
});
