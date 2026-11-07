import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type BaselineEntry, encodeBaseline } from "#baseline/format.ts";
import { qualityWithHeap, type Run } from "#testing/adapters/cli.ts";
import { linkPackage } from "#testing/adapters/tree.ts";

const SOURCE_COUNT = 4415;
const BASELINE_COUNT = 20_000;
const HEAP_MEGABYTES = 2048;
const LAST_RULE_FILE_COUNT = BASELINE_COUNT - SOURCE_COUNT * 4;
const RULE_IDS = Array.from({ length: 5 }, (_, index) => `local/baseline-${index}`);

interface Engine {
	readonly root: string;
	run: Run | undefined;
}

function writeLargeRepository(root: string): void {
	mkdirSync(join(root, "src"));
	writeFileSync(join(root, ".gitignore"), "node_modules/\n");
	writeFileSync(join(root, "biome.json"), '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n');
	writeFileSync(join(root, "package.json"), `${JSON.stringify({ name: "large-quality-fixture", private: true, type: "module" }, null, "\t")}\n`);
	writeFileSync(
		join(root, "quality.config.ts"),
		[
			'import { defineConfig } from "@shivaedev/quality/config.ts";',
			'import { defineRule } from "@shivaedev/quality/rule.ts";',
			`const local = ${JSON.stringify(RULE_IDS)}.map((id, index) => defineRule({`,
			'	id, description: "Record the generated source finding.",',
			`	check: ({ sources }) => sources.slice(0, index < 4 ? sources.length : ${LAST_RULE_FILE_COUNT}).map((source) => ({ file: source.path, message: "recorded source finding" })),`,
			"}));",
			'export default defineConfig({ local, sources: ["src"] });',
		].join("\n"),
	);
	linkPackage(root);
	const baseline: BaselineEntry[] = [];
	for (let index = 0; index < SOURCE_COUNT; index += 1) {
		const path = `src/source-${String(index).padStart(4, "0")}.ts`;
		writeFileSync(join(root, path), `export const value${index} = ${index};\n`);
		for (const rule of RULE_IDS.slice(0, index < LAST_RULE_FILE_COUNT ? 5 : 4)) {
			baseline.push({ count: 1, file: path, rule });
		}
	}
	writeFileSync(join(root, "quality-baseline.jsonl"), encodeBaseline(baseline));
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
