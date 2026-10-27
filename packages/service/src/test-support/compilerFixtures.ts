import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));

function compile(arguments_: readonly string[]) {
	return spawnSync(join(packageDirectory, "node_modules", ".bin", "tsc"), arguments_, {
		cwd: packageDirectory,
		encoding: "utf8",
	});
}

function invalidArguments(fixtures: readonly string[]) {
	return [
		"--ignoreConfig",
		"--noEmit",
		"--noErrorTruncation",
		"--pretty",
		"false",
		"--strict",
		"--skipLibCheck",
		"--target",
		"ESNext",
		"--module",
		"ESNext",
		"--moduleResolution",
		"Bundler",
		"--allowImportingTsExtensions",
		"--customConditions",
		"source",
		...fixtures.map((fixture) => `src/test-support/fixtures/invalid/${fixture}.ts`),
	];
}

export function compileValidFixture() {
	const output = mkdtempSync(join(tmpdir(), "service-"));
	try {
		const result = compile(["-p", "src/test-support/fixtures/tsconfig.json", "--outDir", output]);
		const diagnostics = result.stderr || result.stdout;
		if (result.status !== 0 || diagnostics !== "") {
			throw result.error ?? new Error(`Valid fixture compilation failed (${result.status}): ${diagnostics}`);
		}
		return readFileSync(join(output, "src/test-support/fixtures/valid.d.ts"), "utf8");
	} finally {
		rmSync(output, { force: true, recursive: true });
	}
}

export function compileInvalidFixtures(fixtures: readonly string[]) {
	const result = compile(invalidArguments(fixtures));
	const diagnostics = (result.stderr || result.stdout).split(/(?=^src\/test-support\/fixtures\/invalid\/)/mu);
	return {
		diagnostics: Object.fromEntries(
			fixtures.map((fixture) => [
				fixture,
				diagnostics.filter((message) => message.startsWith(`src/test-support/fixtures/invalid/${fixture}.ts(`)).join("\n"),
			]),
		),
		status: result.status,
	};
}

export const compilerStory = storyKit({
	create: () => ({ compileInvalidFixtures, compileValidFixture }),
	name: "service definition compiler",
	stages: [],
	verbs: (compiler, story) => ({
		declarations: () => {
			story.tell("the compiler emits the valid service declaration");
			return Effect.sync(() => compiler.compileValidFixture());
		},
		invalid: (fixtures: readonly string[]) => {
			story.tell("the compiler checks the invalid service definitions");
			return Effect.sync(() => compiler.compileInvalidFixtures(fixtures));
		},
	}),
});
