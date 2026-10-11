import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { cliProcess } from "#test/fleetCli.ts";

describe("work-fleet daemon command", () => {
	it.live("serve exposes the daemon port and replaces run", function* () {
		const help = yield* Effect.promise(() => cliProcess(["serve", "--help"]));
		expect(help.code).toBe(0);
		expect(help.stdout).toContain("serve");
		expect(help.stdout).toContain("--port");
		const root = yield* Effect.promise(() => cliProcess(["--help"]));
		expect(root.stdout).toContain("serve");
		expect(root.stdout).not.toMatch(/work-fleet run\b/u);
		const removed = yield* Effect.promise(() => cliProcess(["run", "."]));
		expect(removed.code).toBe(1);
	});
});
