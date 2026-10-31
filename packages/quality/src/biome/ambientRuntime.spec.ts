import { expect } from "vitest";
import { AMBIENT_RUNTIME_CASES, ambientFiles } from "#test/ambientRuntimeFiles.ts";
import { biomeStory, presetInstalled, repositoryHas } from "#test/biomeStory.ts";

for (const [shape, expression] of AMBIENT_RUNTIME_CASES) {
	biomeStory.it(
		`ambient-runtime reports ${shape} in core and accepts it at runtime edges`,
		[presetInstalled(), repositoryHas(...ambientFiles(expression))],
		function* ({ checks, reported }) {
			yield* checks();

			expect(yield* reported("plugin")).toEqual(["src/client.ts:3", "src/core.ts:3"]);
		},
	);
}

biomeStory.it(
	"ambient-runtime accepts services yielded in the current Effect and a runner without ambient services",
	[
		presetInstalled(),
		repositoryHas({
			content: [
				"void Effect.gen(function* () {",
				"const crypto = yield* Crypto.Crypto;",
				"yield* crypto.randomBytes(16);",
				"yield* Clock.currentTimeMillis;",
				'yield* Config.string("TOKEN");',
				"yield* Random.next;",
				"yield* Effect.sleep(1);",
				"const process = yield* spawner.spawn(command);",
				"yield* process.exitCode;",
				"yield* Effect.sync(() => 1);",
				"});",
				"void Effect.runSync(Effect.succeed(1));",
			].join("\n"),
			path: "src/core.ts",
		}),
	],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("plugin")).toEqual([]);
	},
);

biomeStory.it(
	"ambient-runtime keeps its original bans at both core and entry points",
	[
		presetInstalled(),
		repositoryHas(
			...["src/core.ts", "src/cli.ts"].map((path) => ({
				content: 'Date.now();\nnew Date();\nMath.random();\nconsole.log("message");\nvoid process.env;\nvoid process["env"];\n',
				path,
			})),
		),
	],
	function* ({ checks, reported }) {
		yield* checks();

		expect(yield* reported("plugin")).toEqual([
			"src/cli.ts:1",
			"src/cli.ts:2",
			"src/cli.ts:3",
			"src/cli.ts:4",
			"src/cli.ts:5",
			"src/cli.ts:6",
			"src/core.ts:1",
			"src/core.ts:2",
			"src/core.ts:3",
			"src/core.ts:4",
			"src/core.ts:5",
			"src/core.ts:6",
		]);
	},
);
