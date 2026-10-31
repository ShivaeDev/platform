import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeRunning } from "#test/biomeRunning.ts";
import { promiseRunning } from "#test/promiseRunning.ts";
import { crashingRule, qualityLifecycle } from "#test/qualityLifecycle.ts";

qualityLifecycle.it(
	"interrupting quality while Biome checks ends the run as interrupted without an error, stops Biome and removes quality's temporary Biome config",
	[biomeRunning],
	function* ({ biomeIsRunning, interrupts, outcome, stderr, temporaryBiomeConfigExists }) {
		yield* outcomes({
			"Biome running": [biomeIsRunning(), true],
			"temporary Biome config": [temporaryBiomeConfigExists(), true],
		});

		yield* interrupts();

		yield* outcomes({
			"Biome running": [biomeIsRunning(), false],
			"error output": [stderr(), ""],
			"exit": [outcome(), "interrupted"],
			"temporary Biome config": [temporaryBiomeConfigExists(), false],
		});
	},
);

qualityLifecycle.it(
	"a local rule that throws makes quality lint invalid with an internal error that names the rule, its error and the check's own stack frame",
	[crashingRule],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* outcomes({
			"exit": [outcome(), "invalid"],
			"internal error": [stderr(), expect.stringContaining("quality: internal error")],
			"rule and error": [stderr(), expect.stringContaining("rule local/crash failed: policy crashed")],
			"stack frame": [stderr(), expect.stringMatching(/at .*crashRule.*quality\.config\.ts:\d+:\d+/u)],
		});
	},
);

qualityLifecycle.it(
	"interrupting a rule's Promise check aborts the signal the check received",
	[promiseRunning],
	function* ({ interrupts, promiseSignalAborted }) {
		expect(yield* promiseSignalAborted()).toBe(false);

		yield* interrupts();

		expect(yield* promiseSignalAborted()).toBe(true);
	},
);
