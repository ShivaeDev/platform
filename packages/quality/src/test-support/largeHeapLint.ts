import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type BaselineEntry, encodeBaseline } from "#baseline/format.ts";
import { manifest } from "#test/applicationFiles.ts";
import { qualityWithHeap, type Run } from "#testing/adapters/cli.ts";
import { formatTree } from "#testing/adapters/qualityTree.ts";
import { linkPackage, packageRoot } from "#testing/adapters/tree.ts";

const SOURCE_COUNT = 4415;
const BASELINE_COUNT = 20_000;
const HEAP_MEGABYTES = 2048;
const LAST_RULE_FILE_COUNT = BASELINE_COUNT - SOURCE_COUNT * 4;
const RULE_IDS = Array.from({ length: 5 }, (_, index) => `local/baseline-${index}`);
const packageManifest: { readonly version: string } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const { version } = packageManifest;
const effectManifest: { readonly version: string } = JSON.parse(readFileSync(join(packageRoot, "../../node_modules/effect/package.json"), "utf8"));

interface Engine {
	readonly root: string;
	run: Run | undefined;
}

function writeLargeRepository(root: string): void {
	mkdirSync(join(root, "src"));
	writeFileSync(join(root, ".gitignore"), "node_modules/\n");
	writeFileSync(join(root, "biome.json"), '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n');
	writeFileSync(
		join(root, "package.json"),
		manifest("package.json", {
			dependencies: { effect: effectManifest.version },
			devDependencies: { "@shivaedev/quality": version },
			exports: { "./*.ts": "./src/*.ts" },
			name: "large-quality-fixture",
			private: true,
			type: "module",
		}).content,
	);
	writeFileSync(
		join(root, "quality.config.ts"),
		[
			'import { defineConfig } from "@shivaedev/quality/config.ts";',
			'import { defineRule } from "@shivaedev/quality/rule.ts";',
			"",
			`const local = ${JSON.stringify(RULE_IDS)}.map((id, index) =>`,
			"\tdefineRule({",
			`\t\tcheck: ({ sources }) => sources.slice(0, index < 4 ? sources.length : ${LAST_RULE_FILE_COUNT}).map((source) => ({`,
			"\t\t\tfile: source.path,",
			'\t\t\tmessage: "recorded source finding",',
			"\t\t})),",
			'\t\tdescription: "Record the generated source finding.",',
			"\t\tid,",
			"\t}),",
			");",
			"",
			'export default defineConfig({ local, sources: ["src"] });',
		].join("\n"),
	);
	linkPackage(root);
	symlinkSync(join(packageRoot, "../../node_modules/effect"), join(root, "node_modules/effect"), "dir");
	const baseline: BaselineEntry[] = [];
	for (let index = 0; index < SOURCE_COUNT; index += 1) {
		const name = `source${String(index).padStart(4, "0")}`;
		const inputName = `Source${name.slice("source".length)}Input`;
		const path = `src/${name}.ts`;
		const content = [
			'import { Effect } from "effect";',
			"",
			`interface ${inputName} { readonly enabled: boolean; readonly value: string; readonly values: readonly string[] }`,
			`export const ${name} = Effect.fn("${name}")(function* (input: ${inputName}) {`,
			'\treturn yield* Effect.succeed(input.enabled ? input.value + ":" + input.values.join(":") : input.value);',
			"});",
		].join("\n");
		writeFileSync(join(root, path), content);
		for (const rule of RULE_IDS.slice(0, index < LAST_RULE_FILE_COUNT ? 5 : 4)) {
			baseline.push({ count: 1, file: path, rule });
		}
	}
	writeFileSync(join(root, "quality-baseline.jsonl"), encodeBaseline(baseline));
	formatTree(root);
}

export const largeHeapLint = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): Engine => ({ root: mkdtempSync(join(tmpdir(), "quality-large-heap-")), run: undefined })),
			({ root }) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
		),
	inspect: ({ run }) => ({ run }),
	name: "Quality large-repository heap",
	stages: ["repository", "lint"],
	verbs: (engine, story) => ({
		lintWithinHeap: () =>
			Effect.sync(() => {
				story.tell(`the author runs quality lint with a ${HEAP_MEGABYTES} MB Node heap`);
				engine.run = qualityWithHeap(engine.root, HEAP_MEGABYTES, "lint");
			}),
		outcome: () =>
			Effect.sync(() => {
				if (engine.run === undefined) {
					throw new Error("Run quality lint before reading its result");
				}
				return engine.run.status === 0 ? "passed" : `exited ${String(engine.run.status)}`;
			}),
	}),
});

export function largeRepository() {
	return largeHeapLint.trait("repository", "the repository has 4,415 source files and 20,000 baseline entries", (engine) => {
		writeLargeRepository(engine.root);
	});
}
