import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeRunning } from "#test/biomeRunning.ts";
import { knipRunning } from "#test/knipRunning.ts";
import { promiseRunning } from "#test/promiseRunning.ts";
import { crashingRule, qualityLifecycle } from "#test/qualityLifecycle.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

qualityLifecycle.it(
	"interrupting quality while Biome checks ends the run as interrupted without an error, stops Biome and removes quality's temporary Biome config",
	[biomeRunning],
	function* ({ toolIsRunning, interrupts, outcome, stderr, temporaryToolConfigExists }) {
		yield* outcomes([
			["Biome running", () => toolIsRunning(), true],
			["temporary Biome config", () => temporaryToolConfigExists(), true],
		]);

		yield* interrupts();

		yield* outcomes([
			["Biome running", () => toolIsRunning(), false],
			["error output", () => stderr(), ""],
			["exit", () => outcome(), "interrupted"],
			["temporary Biome config", () => temporaryToolConfigExists(), false],
		]);
	},
	CLI_TIMEOUT,
);

qualityLifecycle.it(
	"a local rule that throws makes quality lint invalid with an internal error that names the rule, its error and the check's own stack frame",
	[crashingRule],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "invalid"],
			["internal error", () => stderr(), expect.stringContaining("quality: internal error")],
			["rule and error", () => stderr(), expect.stringContaining("rule local/crash failed: policy crashed")],
			["stack frame", () => stderr(), expect.stringMatching(/at .*crashRule.*quality\.config\.ts:\d+:\d+/u)],
		]);
	},
	CLI_TIMEOUT,
);

qualityLifecycle.it(
	"interrupting a rule's Promise check aborts the signal the check received",
	[promiseRunning],
	function* ({ interrupts, promiseSignalAborted }) {
		expect(yield* promiseSignalAborted()).toBe(false);

		yield* interrupts();

		expect(yield* promiseSignalAborted()).toBe(true);
	},
	CLI_TIMEOUT,
);

qualityLifecycle.it(
	"interrupting quality stops knip, removes both generated configs and ends the run as interrupted without an error",
	[knipRunning],
	function* ({ interrupts, outcome, stderr, temporaryKnipSourceConfigExists, temporaryToolConfigExists, toolIsRunning }) {
		yield* outcomes([
			["knip running", () => toolIsRunning(), true],
			["temporary knip config", () => temporaryToolConfigExists(), true],
			["temporary source config", () => temporaryKnipSourceConfigExists(), true],
		]);

		yield* interrupts();

		yield* outcomes([
			["knip running", () => toolIsRunning(), false],
			["temporary knip config", () => temporaryToolConfigExists(), false],
			["temporary source config", () => temporaryKnipSourceConfigExists(), false],
			["exit", () => outcome(), "interrupted"],
			["error output", () => stderr(), ""],
		]);
	},
	CLI_TIMEOUT,
);
