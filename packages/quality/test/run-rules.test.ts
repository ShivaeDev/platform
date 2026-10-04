import { Cause, Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";
import { type ActiveRule, runRules } from "#engine/run-rules.ts";
import type { Findings } from "#rule.ts";
import { inputsOf } from "#test/support/inputs.ts";

const rule = (id: string, level: ActiveRule["level"], check: () => Promise<Findings>): ActiveRule => ({
	check,
	description: id,
	family: false,
	id,
	level,
});

describe("running rules", () => {
	it("tags each finding with its rule and level", async () => {
		const violations = await Effect.runPromise(
			runRules(
				[
					rule("local/a", "error", async () => [{ file: "src/a.ts", line: 2, message: "a" }]),
					rule("local/b", "warn", async () => [{ file: "src/b.ts", message: "b", subject: "x" }]),
				],
				inputsOf({}),
			),
		);
		expect(violations).toEqual([
			{ file: "src/a.ts", level: "error", line: 2, message: "a", rule: "local/a" },
			{ file: "src/b.ts", level: "warn", message: "b", rule: "local/b", subject: "x" },
		]);
	});

	it("names every file relative to the root, so registry and baseline entries match", async () => {
		const violations = await Effect.runPromise(
			runRules(
				[
					rule("local/a", "error", async () => [
						{ file: "./src/a.ts", message: "dotted" },
						{ file: "/virtual/src/b.ts", message: "absolute" },
						{ file: "src\\c.ts", message: "backslashed" },
					]),
				],
				inputsOf({}),
			),
		);
		expect(violations.map((violation) => violation.file)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
	});

	it("fails with the rule's id when a rule throws", async () => {
		const exit = await Effect.runPromiseExit(runRules([rule("local/boom", "error", () => Promise.reject(new Error("boom")))], inputsOf({})));
		expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain("rule local/boom failed: boom");
	});
});
