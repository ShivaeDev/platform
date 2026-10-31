import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import type { Finding, Findings, Rule } from "#rule.ts";
import { scanned } from "./imports.ts";
import type { SeedFile } from "./tree.ts";

interface RuleEngine {
	findings: Findings | undefined;
	readonly root: string;
}

function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		const path = join(root, file.path);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.content);
	}
}

function pathsOf(files: readonly SeedFile[]): string {
	return files.map((file) => file.path).join(", ");
}

export function locationOf(finding: Finding): string {
	return finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
}

function checked(engine: RuleEngine): Findings {
	if (engine.findings === undefined) {
		throw new Error("Check a rule before reading its findings");
	}
	return engine.findings;
}

export const ruleStory = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): RuleEngine => ({ findings: undefined, root: mkdtempSync(join(tmpdir(), "quality-rule-")) })),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ findings }) => ({ findings }),
	layer: services,
	name: "Quality rule",
	stages: ["repository"],
	verbs: (engine, story) => ({
		check: Effect.fn("RuleStory.check")(function* <TInput>(rule: Rule<string, TInput>, options?: TInput, directory = ".") {
			story.tell(options === undefined ? `quality checks ${rule.id}` : `quality checks ${rule.id} with ${JSON.stringify(options)}`);
			const configured = yield* Effect.promise(() => rule.configure(options));
			if (configured._tag === "Invalid") {
				return yield* Effect.die(new Error(`${rule.id} refused its options: ${configured.issues.join("; ")}`));
			}
			const inputs = yield* Effect.promise(() => scanned(join(engine.root, directory)));
			engine.findings = yield* configured.check(inputs);
			return engine.findings;
		}),
		findings: () => Effect.sync(() => checked(engine)),
		locations: () => Effect.sync(() => checked(engine).map(locationOf)),
		messages: () => Effect.sync(() => checked(engine).map((finding) => finding.message)),
		optionIssues: <TInput>(rule: Rule<string, TInput>, options: TInput) =>
			Effect.promise(async () => {
				story.tell(`quality configures ${rule.id} with ${JSON.stringify(options)}`);
				const configured = await rule.configure(options);
				return configured._tag === "Invalid" ? configured.issues : [];
			}),
		removes: (path: string) =>
			Effect.sync(() => {
				story.tell(`the author removes ${path}`);
				rmSync(join(engine.root, path), { force: true, recursive: true });
			}),
		writes: (...files: readonly SeedFile[]) =>
			Effect.sync(() => {
				story.tell(`the author writes ${pathsOf(files)}`);
				writeAll(engine.root, files);
			}),
	}),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return ruleStory.trait("repository", `the repository contains ${pathsOf(files)}`, (engine) => writeAll(engine.root, files));
}

export function repositoryLinks(path: string, target: string) {
	return ruleStory.trait("repository", `the repository links ${path} to ${target}`, (engine) => {
		mkdirSync(dirname(join(engine.root, path)), { recursive: true });
		symlinkSync(target, join(engine.root, path));
	});
}
