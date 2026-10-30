import { timeoutApp } from "./timeoutApp.ts";

timeoutApp.it(
	"hangs past its timeout with a job worker running",
	[],
	function* ({ database, writeItem, items, hang }, context) {
		yield* writeItem("before timeout");
		context.task.meta.timeout = { database: database(), role: "the hanging story", wrote: yield* items() };
		yield* hang();
	},
	10_000,
);

timeoutApp.it("writes through its job worker after the hanging story", [], function* ({ closedBeforeSetup, database, writeItem, items }, context) {
	yield* writeItem("after timeout");
	context.task.meta.timeout = { closedBeforeSetup: closedBeforeSetup(), database: database(), role: "the next story", wrote: yield* items() };
});
