import { childStartRun } from "#test/childStartRun.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

childStartRun.it("a run starts each child process before the rules that run in the Quality process", [], function* ({ order, runs }) {
	yield* runs();

	yield* assertThat(yield* order(), (actual) => actual.toEqual(["child started", "in-process rule", "child finished"]));
});
