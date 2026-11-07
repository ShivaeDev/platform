import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeRunning } from "#test/biomeRunning.ts";
import { knipRunning } from "#test/knipRunning.ts";
import { promiseRunning } from "#test/promiseRunning.ts";
import { crashingRule, qualityLifecycle } from "#test/qualityLifecycle.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

qualityLifecycle.it(
	"interrupting quality while Biome checks stops Biome, keeps its cached config and lets the next run check the repository",
	[biomeRunning],
	function* ({ toolIsRunning, interrupts, outcome, stderr, toolConfigExists, runs, strayBiomeConfigs }) {
		yield* outcomes([
			["Biome running", () => toolIsRunning(), true],
			["cached Biome config", () => toolConfigExists(), true],
		]);

		yield* interrupts();

		yield* outcomes([
			["Biome running", () => toolIsRunning(), false],
			["error output", () => stderr(), ""],
			["exit", () => outcome(), "interrupted"],
			["cached Biome config", () => toolConfigExists(), true],
			["stray Biome configs", () => strayBiomeConfigs(), []],
		]);

		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
	CLI_TIMEOUT,
);

qualityLifecycle.it(
	"a local rule that throws makes quality lint invalid with an internal error that names the rule, its error and the check's own stack frame",
	[crashingRule],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "invalid"],
				["internal error", () => stderr(), expect.stringContaining("quality: internal error")],
				["rule and error", () => stderr(), expect.stringContaining("rule local/crash failed: policy crashed")],
				["stack frame", () => stderr(), expect.stringMatching(/at .*crashRule.*quality\.config\.ts:\d+:\d+/u)],
			]),
		);
	},
	CLI_TIMEOUT,
);

qualityLifecycle.it(
	"interrupting a rule's Promise check aborts the signal the check received",
	[promiseRunning],
	function* ({ interrupts, promiseSignalAborted }) {
		yield* assertThat(yield* promiseSignalAborted(), (actual) => actual.toBe(false));

		yield* interrupts();

		yield* assertThat(yield* promiseSignalAborted(), (actual) => actual.toBe(true));
	},
	CLI_TIMEOUT,
);

qualityLifecycle.it(
	"interrupting quality stops knip, removes both generated configs and ends the run as interrupted without an error",
	[knipRunning],
	function* ({ interrupts, outcome, stderr, temporaryKnipSourceConfigExists, toolConfigExists, toolIsRunning }) {
		yield* outcomes([
			["knip running", () => toolIsRunning(), true],
			["temporary knip config", () => toolConfigExists(), true],
			["temporary source config", () => temporaryKnipSourceConfigExists(), true],
		]);

		yield* interrupts();

		yield* outcomes([
			["knip running", () => toolIsRunning(), false],
			["temporary knip config", () => toolConfigExists(), false],
			["temporary source config", () => temporaryKnipSourceConfigExists(), false],
			["exit", () => outcome(), "interrupted"],
			["error output", () => stderr(), ""],
		]);
	},
	CLI_TIMEOUT,
);
