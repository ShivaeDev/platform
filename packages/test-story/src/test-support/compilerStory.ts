import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { storyKit } from "#storyKit.ts";

const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));

export const compilerStory = storyKit({
	create: (): { output: string; status: number | null } => ({ output: "", status: null }),
	name: "story kit compiler",
	stages: [],
	verbs: (engine, story) => ({
		compile: () =>
			Effect.sync(() => {
				story.tell("compile the invalid story kits");
				const result = spawnSync(
					join(packageDirectory, "node_modules", ".bin", "tsc"),
					["-p", "src/test-support/compiler-fixtures/tsconfig.json", "--pretty", "false", "--noErrorTruncation"],
					{ cwd: packageDirectory, encoding: "utf8" },
				);
				engine.output = result.stdout + result.stderr;
				engine.status = result.status;
			}),
		diagnostics: (fixture: string) =>
			Effect.sync(() =>
				engine.output
					.split(/(?=^src\/test-support\/compiler-fixtures\/)/mu)
					.filter((message) => message.startsWith(`src/test-support/compiler-fixtures/${fixture}.ts(`))
					.join("\n"),
			),
		output: () => Effect.sync(() => engine.output),
		status: () => Effect.sync(() => engine.status),
	}),
});
