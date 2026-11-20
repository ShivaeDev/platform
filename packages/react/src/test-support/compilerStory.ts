import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURES = "src/test-support/compiler-fixtures";

// One tsc run checks the valid fixture and every invalid one; each story reads the diagnostics of its own file.
let output: string | undefined;

function diagnosticsOf(file: string) {
	output ??= spawnSync("node_modules/.bin/tsc", ["-p", `${FIXTURES}/tsconfig.json`, "--noEmit"], { cwd: packageDirectory, encoding: "utf8" }).stdout;
	return output
		.split(new RegExp(`(?=^${FIXTURES}/)`, "mu"))
		.filter((message) => message.startsWith(`${FIXTURES}/${file}.ts(`))
		.join("\n");
}

export const compilerStory = storyKit({
	create: () => Effect.succeed({ diagnosticsOf }),
	name: "react compiler",
	stages: [],
	verbs: (engine, story) => ({
		compileInvalid: (fixture: string) =>
			Effect.sync(() => {
				story.tell(`tsc checks the invalid ${fixture} fixture`);
				const diagnostics = engine.diagnosticsOf(`invalid/${fixture}`);
				return diagnostics === "" ? "no diagnostics" : diagnostics;
			}),
		compileValid: () =>
			Effect.sync(() => {
				story.tell("tsc checks hooks that take bound commands, a custom operation, fixed payload fields, an undoable change and failure handlers");
				const diagnostics = engine.diagnosticsOf("useBoundOperations");
				return diagnostics === "" ? "compiled cleanly" : diagnostics;
			}),
	}),
});
