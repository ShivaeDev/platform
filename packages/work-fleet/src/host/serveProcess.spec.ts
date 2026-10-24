import { describe, expect } from "@effect/vitest";
import { cliStory } from "#test/cliStory.ts";

describe("work-fleet daemon command", () => {
	cliStory.it("serve exposes the daemon port and replaces run", [], function* (cli) {
		const help = yield* cli.run(["serve", "--help"]);
		expect(help.code).toBe(0);
		expect(help.stdout).toContain("serve");
		expect(help.stdout).toContain("--port");
		const root = yield* cli.run(["--help"]);
		expect(root.stdout).toContain("serve");
		expect(root.stdout).not.toMatch(/work-fleet run\b/u);
		const removed = yield* cli.run(["run", "."]);
		expect(removed.code).toBe(1);
	});
});
