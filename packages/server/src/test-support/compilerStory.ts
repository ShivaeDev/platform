import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));

export const compilerStory = storyKit({
	create: (): { output: string } => ({ output: "" }),
	name: "server compiler",
	stages: [],
	verbs: (engine, story) => ({
		compile: () =>
			Effect.sync(() => {
				story.tell("tsc checks the module registrations in the compiler fixtures");
				const result = spawnSync(
					join(packageDirectory, "node_modules", ".bin", "tsc"),
					["-p", "src/test-support/compiler-fixtures/tsconfig.json", "--pretty", "false"],
					{ cwd: packageDirectory, encoding: "utf8" },
				);
				engine.output = result.stdout + result.stderr;
			}),
		diagnostics: (fixture: string) =>
			Effect.sync(() =>
				engine.output
					.split(/(?=^src\/test-support\/compiler-fixtures\/)/mu)
					.filter((message) => message.startsWith(`src/test-support/compiler-fixtures/${fixture}.ts(`))
					.join("\n"),
			),
	}),
});
