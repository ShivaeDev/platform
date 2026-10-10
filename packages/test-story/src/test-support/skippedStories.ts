import { expect, it } from "vitest";
import { bakery } from "#test/bakery.ts";

const executed: string[] = [];
const recordsSetup = bakery.trait("pantry", "records story setup", () => {
	executed.push("setup");
});

function recordsBody() {
	executed.push("body");
	return undefined;
}

bakery.it.skip("skips a story the way Vitest skips a test", [recordsSetup], recordsBody);
bakery.it.skipIf(true)("skips a story when the condition holds", [recordsSetup], recordsBody);
bakery.it.runIf(false)("runs a story only when the condition holds", [recordsSetup], recordsBody);

it("does not execute skipped story setup or bodies", () => {
	expect(executed).toEqual([]);
});
