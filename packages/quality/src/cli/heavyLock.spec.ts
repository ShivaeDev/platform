import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heavyLint } from "#test/heavyLint.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

heavyLint.it(
	"a parallel lint waits until the lint running Biome releases the shared heavy-process lock",
	[],
	function* ({ biomeStarted, finishes, lockExists, nextEvent, starts }) {
		yield* starts("first");
		yield* outcomes([
			["first lint", () => nextEvent("first"), "Biome started"],
			["lock", () => lockExists(), true],
		]);

		yield* starts("second");
		yield* outcomes([
			["second lint", () => nextEvent("second"), "Waiting for lock"],
			["second Biome", () => biomeStarted("second"), false],
		]);

		yield* finishes("first");
		yield* outcomes([
			["first lint", () => nextEvent("first"), "Exited 0"],
			["second lint", () => nextEvent("second"), "Biome started"],
		]);

		yield* finishes("second");
		yield* outcomes([
			["second lint", () => nextEvent("second"), "Exited 0"],
			["lock", () => lockExists(), false],
		]);
	},
	CLI_TIMEOUT,
);

heavyLint.it(
	"interrupting a lint releases its hold and lets a waiting lint reach Biome",
	[],
	function* ({ finishes, interrupts, lockExists, nextEvent, starts }) {
		yield* starts("first");
		yield* assertThat(yield* nextEvent("first"), (actual) => actual.toBe("Biome started"));
		yield* starts("second");
		yield* assertThat(yield* nextEvent("second"), (actual) => actual.toBe("Waiting for lock"));

		yield* interrupts("first");
		yield* outcomes([
			["first lint", () => nextEvent("first"), "Exited 130"],
			["second lint", () => nextEvent("second"), "Biome started"],
		]);

		yield* finishes("second");
		yield* outcomes([
			["second lint", () => nextEvent("second"), "Exited 0"],
			["lock", () => lockExists(), false],
		]);
	},
	CLI_TIMEOUT,
);
