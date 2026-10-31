import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { quality } from "./cli.ts";
import { type CliAnswer, cliVerbs } from "./cliAnswers.ts";
import { writes } from "./hookRepository.ts";
import { formatTree } from "./qualityTree.ts";
import { DEFAULT_FILES, linkPackage, type SeedFile } from "./tree.ts";

interface ExceptionEngine {
	answer: CliAnswer | undefined;
	readonly root: string;
}

const INSTALLED: readonly SeedFile[] = DEFAULT_FILES.filter((file) => file.path !== "src/value.ts");

const PRINT_CONFIG =
	'const { pathToFileURL } = await import("node:url"); const { default: config } = await import(pathToFileURL(process.argv[1]).href); console.log(JSON.stringify(config));';

const Printed = Schema.fromJsonString(Schema.Unknown);

function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		writes(root, file.path, file.content);
	}
}

function pathsOf(files: readonly SeedFile[]): string {
	return files.map((file) => file.path).join(", ");
}

function textsIn(root: string, folder = root): Readonly<Record<string, string>> {
	return Object.fromEntries(
		readdirSync(folder, { withFileTypes: true })
			.filter((entry) => entry.name !== "node_modules")
			.flatMap((entry) => {
				const path = join(folder, entry.name);
				return entry.isDirectory() ? Object.entries(textsIn(root, path)) : [[relative(root, path), readFileSync(path, "utf8")]];
			}),
	);
}

// Node imports the config in a fresh process, as the quality executable does, and prints the object it exports.
function exportedConfig(root: string, file: string): unknown {
	const run = spawnSync("node", ["--conditions=source", "--input-type=module", "-e", PRINT_CONFIG, join(root, file)], {
		cwd: root,
		encoding: "utf8",
	});
	if (run.status !== 0) {
		throw new Error(`Cannot import ${file}: ${run.stderr}`);
	}
	return Schema.decodeUnknownSync(Printed)(run.stdout);
}

export const exceptionStory = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): ExceptionEngine => {
				const root = mkdtempSync(join(tmpdir(), "quality-exceptions-"));
				writeAll(root, INSTALLED);
				linkPackage(root);
				return { answer: undefined, root };
			}),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ answer }) => ({ answer }),
	name: "Quality exceptions",
	stages: ["repository", "formatting", "migration"],
	verbs: (engine, story) => ({
		...cliVerbs(engine, story.tell),
		config: (file = "quality.config.ts") => Effect.sync(() => exportedConfig(engine.root, file)),
		files: () => Effect.sync(() => textsIn(engine.root)),
		reads: (path: string) => Effect.sync(() => (existsSync(join(engine.root, path)) ? readFileSync(join(engine.root, path), "utf8") : undefined)),
	}),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return exceptionStory.trait("repository", `the repository contains ${pathsOf(files)}`, (engine) => writeAll(engine.root, files));
}

export function biomeFormatted() {
	return exceptionStory.trait("formatting", "Biome has formatted every file, so formatting raises no finding", (engine) => {
		formatTree(engine.root);
	});
}

// The executable migrates in its own process, so the story's process imports only the migrated config.
export function exceptionsMigrated() {
	return exceptionStory.trait("migration", "quality exceptions migrate has moved the legacy exceptions into quality.config.ts", (engine) => {
		const run = quality(engine.root, "exceptions", "migrate");
		if (run.status !== 0) {
			throw new Error(`quality exceptions migrate failed: ${run.stderr}`);
		}
	});
}
