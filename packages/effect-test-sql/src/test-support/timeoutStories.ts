import { expect } from "vitest";
import { timeoutApp } from "./timeoutApp.ts";

timeoutApp.it(
	"times out with a running worker",
	[],
	function* ({ writeItem, sleep, readItems }) {
		yield* writeItem("before timeout");
		expect(yield* readItems()).toEqual([{ value: "seed" }, { value: "before timeout" }]);
		yield* sleep();
	},
	10_000,
);

timeoutApp.it("writes in the next isolated database", [], function* ({ writeItem, readItems, readIsolation }) {
	const isolation = readIsolation();
	yield* writeItem("after timeout");
	expect(yield* readItems()).toEqual([{ value: "seed" }, { value: "after timeout" }]);
	expect(isolation.closedBeforeSetup).toEqual([isolation.databases[0]]);
	expect(isolation.name).not.toBe(isolation.databases[0]);
});
