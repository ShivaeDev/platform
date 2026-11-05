import { Effect, FileSystem, Path } from "effect";
import { configureRegistered } from "@shivaedev/quality/adapters/rule.ts";
import { services } from "@shivaedev/quality/cli/runMain.ts";
import type { Finding, Findings, RegisteredRule, Rule } from "@shivaedev/quality/rule.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Run, runQuality } from "#quality/adapters/cli.ts";
import { scanned } from "#quality/adapters/imports.ts";
import { packageRoot, type SeedFile } from "#quality/adapters/tree.ts";

interface RuleEngine {
	answer: Run | undefined;
	findings: Findings | undefined;
	readonly root: string;
}

const writeAll = Effect.fn("RuleStory.writeAll")(function* (root: string, files: readonly SeedFile[]) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	for (const file of files) {
		const target = path.join(root, file.path);
		yield* fs.makeDirectory(path.dirname(target), { recursive: true });
		yield* fs.writeFileString(target, file.content);
	}
});

function pathsOf(files: readonly SeedFile[]): string {
	return files.map((file) => file.path).join(", ");
}

export function locationOf(finding: Finding): string {
	return finding.line === undefined ? finding.file : `${finding.file}:${finding.line}`;
}

function checked(engine: RuleEngine) {
	if (engine.findings === undefined) {
		return Effect.die(new Error("Check a rule before reading its findings"));
	}
	return Effect.succeed(engine.findings);
}

function answered(engine: RuleEngine) {
	if (engine.answer === undefined) {
		return Effect.die(new Error("Run the gate before reading its answer"));
	}
	return Effect.succeed(engine.answer);
}

function outcomeOf({ status }: Run): string {
	if (status === 0) {
		return "passed";
	}
	if (status === 1) {
		return "rejected";
	}
	if (status === 2) {
		return "invalid";
	}
	return `exited ${String(status)}`;
}

export function makeRuleStory() {
	const ruleStory = storyKit({
		create: () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const root = yield* fs.makeTempDirectoryScoped({ prefix: "quality-rule-" });
				const engine: RuleEngine = { answer: undefined, findings: undefined, root };
				return engine;
			}),
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
				const path = yield* Path.Path;
				const inputs = yield* Effect.promise(() => scanned(path.join(engine.root, directory)));
				engine.findings = yield* configured.check(inputs);
				return engine.findings;
			}),
			findings: () => checked(engine),
			gate: Effect.fn("RuleStory.gate")(function* () {
				story.tell("quality runs the repository gate");
				engine.answer = yield* runQuality(engine.root, "lint");
			}),
			gateOutcome: () => Effect.map(answered(engine), outcomeOf),
			gateReport: () => Effect.map(answered(engine), (answer) => answer.stdout + answer.stderr),
			gateReports: (prefix: string) =>
				Effect.map(answered(engine), (answer) =>
					answer.stdout
						.split("\n\n")
						.filter((section) => section.startsWith(`error ${prefix}`))
						.join("\n\n"),
				),
			locations: () => Effect.map(checked(engine), (findings) => findings.map(locationOf)),
			messages: () => Effect.map(checked(engine), (findings) => findings.map((finding) => finding.message)),
			optionIssues: Effect.fn("RuleStory.optionIssues")(function* (rule: RegisteredRule, options: unknown) {
				story.tell(`quality configures ${rule.id} with ${JSON.stringify(options)}`);
				const configured = yield* Effect.promise(() => configureRegistered(rule, options));
				return configured._tag === "Invalid" ? configured.issues : [];
			}),
			removes: Effect.fn("RuleStory.removes")(function* (path: string) {
				story.tell(`the author removes ${path}`);
				const fs = yield* FileSystem.FileSystem;
				const paths = yield* Path.Path;
				yield* fs.remove(paths.join(engine.root, path), { force: true, recursive: true });
			}),
			writes: (...files: readonly SeedFile[]) => {
				story.tell(`the author writes ${pathsOf(files)}`);
				return writeAll(engine.root, files);
			},
		}),
	});

	function repositoryHas(...files: readonly SeedFile[]) {
		return ruleStory.trait("repository", `the repository contains ${pathsOf(files)}`, (engine) => writeAll(engine.root, files));
	}

	function repositoryLinks(path: string, target: string) {
		return ruleStory.trait("repository", `the repository links ${path} to ${target}`, (engine) =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const paths = yield* Path.Path;
				yield* fs.makeDirectory(paths.dirname(paths.join(engine.root, path)), { recursive: true });
				yield* fs.symlink(target, paths.join(engine.root, path));
			}),
		);
	}

	function qualityInstalled() {
		return repositoryLinks("node_modules/@shivaedev/quality", packageRoot);
	}

	const harness: typeof ruleStory & {
		readonly qualityInstalled: typeof qualityInstalled;
		readonly repositoryHas: typeof repositoryHas;
		readonly repositoryLinks: typeof repositoryLinks;
	} = { ...ruleStory, qualityInstalled, repositoryHas, repositoryLinks };
	return harness;
}
