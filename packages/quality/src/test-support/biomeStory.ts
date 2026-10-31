import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { recommendedRules } from "#biome/recommendedRules.ts";
import { services } from "#cli/runMain.ts";
import type { Findings } from "#rule.ts";
import { biome } from "#rules/biome.ts";
import { scanned } from "./imports.ts";
import { pluginOf } from "./namingFindings.ts";
import { locationOf } from "./ruleStory.ts";
import { DEFAULT_FILES, linkPackage, type SeedFile } from "./tree.ts";

interface BiomeEngine {
	findings: Findings | undefined;
	readonly root: string;
}

const PRESET: readonly SeedFile[] = DEFAULT_FILES.filter((file) => file.path !== "src/value.ts");

function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		const path = join(root, file.path);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.content);
	}
}

function checked(engine: BiomeEngine): Findings {
	if (engine.findings === undefined) {
		throw new Error("Check the repository with Biome before reading its findings");
	}
	return engine.findings;
}

// Biome crashes on a root reached through a symlink, such as macOS's /var/folders temporary directory.
function temporaryRoot(): BiomeEngine {
	return { findings: undefined, root: realpathSync(mkdtempSync(join(tmpdir(), "quality-biome-"))) };
}

export const biomeStory = storyKit({
	create: () =>
		Effect.acquireRelease(Effect.sync(temporaryRoot), (engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true }))),
	inspect: ({ findings }) => ({ findings }),
	layer: services,
	name: "Biome",
	stages: ["repository"],
	verbs: (engine, story) => ({
		checks: Effect.fn("BiomeStory.checks")(function* () {
			story.tell("quality checks the repository with its biome rule");
			const configured = yield* Effect.promise(() => biome.configure(undefined));
			if (configured._tag === "Invalid") {
				return yield* Effect.die(new Error(`biome refused its options: ${configured.issues.join("; ")}`));
			}
			engine.findings = yield* configured.check(yield* Effect.promise(() => scanned(engine.root)));
		}),
		listsRecommendedRules: () => {
			story.tell("quality asks Biome for the rules its recommended preset enables");
			return recommendedRules();
		},
		plugins: (path: string) =>
			Effect.sync(() =>
				checked(engine)
					.filter((finding) => finding.file === path && finding.subject === "plugin")
					.map((finding) => `${finding.line ?? 0} ${pluginOf(finding.message)}`)
					.toSorted(),
			),
		reported: (subject: string) =>
			Effect.sync(() =>
				checked(engine)
					.filter((finding) => finding.subject === subject)
					.toSorted((left, right) => left.file.localeCompare(right.file) || (left.line ?? 0) - (right.line ?? 0))
					.map(locationOf),
			),
	}),
});

export function presetInstalled() {
	return biomeStory.trait("repository", "Quality is installed, biome.json extends its preset and .gitignore keeps node_modules out", (engine) => {
		writeAll(engine.root, PRESET);
		linkPackage(engine.root);
	});
}

export function repositoryHas(...files: readonly SeedFile[]) {
	return biomeStory.trait("repository", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) =>
		writeAll(engine.root, files),
	);
}
