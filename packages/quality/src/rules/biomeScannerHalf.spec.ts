import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const FLOATING_PROMISE = {
	content:
		"export async function load(): Promise<number> {\n\treturn await Promise.resolve(1);\n}\n\nexport function start(): void {\n\tload();\n}\n",
	path: "src/adapters/load.ts",
};

const AWAITED_PROMISE = {
	content:
		"export async function load(): Promise<number> {\n\treturn await Promise.resolve(1);\n}\n\nexport async function start(): Promise<void> {\n\tawait load();\n}\n",
	path: "src/adapters/load.ts",
};

const FLOATING_EXCEPTION = {
	content:
		'export default {\n\texceptions: [{ files: ["src/adapters/load.ts"], reason: "The loader starts in the background.", rules: ["biome/lint/nursery/noFloatingPromises"] }],\n};\n',
	path: "quality.config.ts",
};

repositoryStory.it(
	"a fast lint leaves the Biome rules that need its project scanner to the scanner half, and a full lint reports them under the biome rule",
	[qualityInstalled(), repositoryHas(FLOATING_PROMISE)],
	function* ({ runs }) {
		const fast = yield* runs("lint");
		const full = yield* runs("lint", "--full");

		yield* withMatchers((expect) =>
			outcomes([
				["fast report", () => Effect.succeed(fast.stdout), expect.not.stringContaining("noFloatingPromises")],
				["fast closing line", () => Effect.succeed(fast.stdout), expect.stringContaining("biome scanner half")],
				[
					"full report",
					() => Effect.succeed(full.stdout),
					expect.stringContaining("error biome/lint/nursery/noFloatingPromises (1)\n  src/adapters/load.ts:6"),
				],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality baseline write records a scanner-half finding as its entry's deep share, which a fast lint sets aside",
	[qualityInstalled(), repositoryHas(FLOATING_PROMISE)],
	function* ({ reads, runs }) {
		yield* runs("baseline", "write");
		const fast = yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				[
					"baseline",
					() => reads("quality-baseline.jsonl"),
					expect.stringContaining('{"path":"src/adapters/load.ts","rule":"biome/lint/nursery/noFloatingPromises","count":1,"deep":1}\n'),
				],
				["fast lint", () => Effect.succeed(fast.outcome), "passed"],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"a fast lint sets an exception for a scanner rule aside, and a full lint names it stale once its finding is gone",
	[qualityInstalled(), repositoryHas(FLOATING_EXCEPTION, AWAITED_PROMISE)],
	function* ({ runs }) {
		const fast = yield* runs("lint");
		const full = yield* runs("lint", "--full");

		yield* withMatchers((expect) =>
			outcomes([
				["fast lint", () => Effect.succeed(fast.outcome), "passed"],
				["full lint", () => Effect.succeed(full.outcome), "rejected"],
				["full report", () => Effect.succeed(full.stdout), expect.stringContaining("matches no finding")],
			]),
		);
	},
	CLI_TIMEOUT,
);
