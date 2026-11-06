import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeCacheStory, untypedFiles } from "#test/biomeCacheStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

biomeCacheStory.it(
	"a killed Quality process leaves only ignored cached configs and the next run reuses them successfully",
	[],
	function* ({ cache, crashes, crashSignal, repositoryFiles, results, runs }) {
		yield* crashes();
		const cached = yield* cache();

		yield* assertThat(cached.length, (actual) => actual.toBeGreaterThan(0));
		yield* outcomes([
			["crash", () => crashSignal(), "SIGKILL"],
			["repository files", () => repositoryFiles(), [".gitignore", "biome.json", "src/value.ts"]],
		]);

		yield* runs();

		yield* assertThat(
			(yield* results()).map((run) => run.code),
			(actual) => actual.toEqual([0]),
		);
		yield* assertThat(yield* cache(), (actual) => actual.toEqual(cached));
	},
);

biomeCacheStory.it(
	"two parallel Quality runs with different Biome exceptions both pass on a cold cache",
	[untypedFiles],
	function* ({ results, runsInParallel }) {
		yield* runsInParallel();

		yield* assertThat(
			(yield* results()).map((run) => run.code),
			(actual) => actual.toEqual([0, 0]),
		);
	},
);
