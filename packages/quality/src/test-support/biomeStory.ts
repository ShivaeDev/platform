import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#adapters/runMain.ts";
import { loadConfig } from "#config/load.ts";
import type { Findings } from "#rule.ts";
import { biome } from "#rules/biome.ts";
import { pluginOf } from "#test/namingFindings.ts";
import { presetBelowError, recommendedRules } from "#test/recommendedRules.ts";
import { scanned } from "#testing/adapters/imports.ts";
import { DEFAULT_FILES, linkPackage, type SeedFile } from "#testing/adapters/tree.ts";
import { locationOf } from "#testing/ruleStory.ts";

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
			const config = yield* loadConfig(engine.root, undefined);
			const inputs = yield* Effect.promise(() => scanned(engine.root));
			engine.findings = yield* configured.check({ ...inputs, exceptions: config.exceptions });
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
		// A rule named beyond Biome's own list stands in for one a Biome upgrade adds to its recommended preset.
		presetBelowError: (...added: readonly string[]) => {
			story.tell("quality compares its shipped preset with the rules Biome's recommended preset enables");
			return Effect.flatMap(recommendedRules(), (rules) => presetBelowError([...rules, ...added]));
		},
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
