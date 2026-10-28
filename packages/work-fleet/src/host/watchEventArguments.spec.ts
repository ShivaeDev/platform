import { expect } from "@effect/vitest";
import { cliStory } from "#test/cliStory.ts";

cliStory.it("watch rejects unknown event kinds before connecting to Fleet", [], function* (cli) {
	const result = yield* cli.run(["watch", "--board", "/missing-board", "--events", "done,unknown"]);
	const exitCode = result.code;
	expect(exitCode).toBe(1);
	expect(result.stdout).toBe("");
	expect(result.stderr).toContain("Unknown event kind: unknown");
});
