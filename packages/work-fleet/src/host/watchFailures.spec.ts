import { describe, expect } from "@effect/vitest";
import { cliStory } from "#test/cliStory.ts";

describe("Fleet commands without a daemon", () => {
	for (const [command, args] of [
		["status", []],
		["wait", ["unknown"]],
		["watch", ["unknown"]],
		["dispatch", ["unknown"]],
		["continue", ["unknown", "Continue work"]],
		["release", ["unknown"]],
		["reassign", ["unknown", "decision", "maintainer"]],
		["name-threads", []],
		["answer", ["unknown", "Retry work"]],
	] as const) {
		cliStory.it(`${command} names the missing daemon and how to start it`, [], function* (cli) {
			const port = 0;
			const result = yield* cli.run([command, ...args, "--port", String(port)]);
			const { stderr } = result;
			const exitCode = result.code;
			expect(exitCode).toBe(1);
			expect(stderr).toContain(`No Fleet daemon is running at 127.0.0.1:${port}`);
			expect(stderr).toContain(`start work-fleet serve <board-dir> --port ${port}`);
			expect(stderr).not.toContain("PostgreSQL");
		});
	}
});
