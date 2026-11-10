import { rmSync } from "node:fs";
import { Effect, FileSystem, Path } from "effect";
import { afterAll } from "vitest";
import { storyKit, type Trait } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#adapters/runMain.ts";
import type { Findings, Rule, RuleServices } from "#rule.ts";
import { repositoryHas } from "#test/ruleStory.ts";
import { scanned } from "#testing/adapters/imports.ts";
import type { SeedFile } from "#testing/adapters/tree.ts";
import type { RuleEngine } from "#testing/ruleChecks.ts";
import { locationOf } from "#testing/ruleStory.ts";

type RepositoryTrait = Trait<RuleEngine, "repository", FileSystem.FileSystem | Path.Path>;

type CaseFindings = <TInput>(rule: Rule<string, TInput>, options: TInput | undefined) => Effect.Effect<Findings, unknown, RuleServices | Path.Path>;

interface CaseEngine {
	case: CaseFindings | undefined;
	findings: Findings | undefined;
}

const applyAll = Effect.fn("RuleCases.applyAll")(function* (root: string, given: readonly RepositoryTrait[]) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.makeDirectory(root, { recursive: true });
	const engine: RuleEngine = { answer: undefined, failure: undefined, findings: undefined, root };
	for (const part of given.flatMap((each) => each.parts)) {
		yield* part.apply(engine);
	}
});

function seeded(engine: CaseEngine) {
	return engine.case === undefined ? Effect.die(new Error("Seed a case of the shared repository before checking")) : Effect.succeed(engine.case);
}

function checked(engine: CaseEngine) {
	return engine.findings === undefined ? Effect.die(new Error("Check a rule before reading its findings")) : Effect.succeed(engine.findings);
}

const kit = storyKit({
	create: (): CaseEngine => ({ case: undefined, findings: undefined }),
	inspect: ({ findings }) => ({ findings }),
	layer: services,
	name: "Quality rule",
	stages: ["repository"],
	verbs: (engine, story) => ({
		check: Effect.fn("RuleCases.check")(function* <TInput>(rule: Rule<string, TInput>, options?: TInput) {
			const caseFindings = yield* seeded(engine);
			story.tell(
				options === undefined
					? `quality checks ${rule.id} once across the shared repository`
					: `quality checks ${rule.id} with ${JSON.stringify(options)} once across the shared repository`,
			);
			engine.findings = yield* caseFindings(rule, options);
			return engine.findings;
		}),
		findings: () => checked(engine),
		locations: () => Effect.map(checked(engine), (findings) => findings.map(locationOf)),
		messages: () => Effect.map(checked(engine), (findings) => findings.map((finding) => finding.message)),
	}),
});

// Every case of a spec file shares one repository, so the rule builds its TypeScript program and checker once for the whole file.
function repository(...given: readonly RepositoryTrait[]) {
	const cases: { readonly folder: string; readonly given: readonly RepositoryTrait[] }[] = [];
	const checks = new Map<string, Findings>();
	let root: string | undefined;
	afterAll(() => {
		if (root !== undefined) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	const seededRoot = Effect.fn("RuleCases.seededRoot")(function* () {
		if (root !== undefined) {
			return root;
		}
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const created = yield* fs.makeTempDirectory({ prefix: "quality-rule-cases-" });
		root = created;
		yield* applyAll(created, given);
		for (const each of cases) {
			yield* applyAll(path.join(created, each.folder), each.given);
		}
		return created;
	});

	const allFindings = Effect.fn("RuleCases.allFindings")(function* <TInput>(rule: Rule<string, TInput>, options: TInput | undefined) {
		const key = `${rule.id} ${JSON.stringify(options) ?? ""}`;
		const known = checks.get(key);
		if (known !== undefined) {
			return known;
		}
		const configured = yield* Effect.promise(() => rule.configure(options));
		if (configured._tag === "Invalid") {
			return yield* Effect.die(new Error(`${rule.id} refused its options: ${configured.issues.join("; ")}`));
		}
		const directory = yield* seededRoot();
		const findings = yield* configured.check(yield* Effect.promise(() => scanned(directory)));
		checks.set(key, findings);
		return findings;
	});

	function seededCase(...caseGiven: readonly RepositoryTrait[]) {
		const folder = `case-${String(cases.length + 1)}`;
		cases.push({ folder, given: caseGiven });
		const prefix = `${folder}/`;
		const lines = caseGiven.flatMap((each) => each.parts.map((part) => part.line)).join("; ");
		const caseFindings: CaseFindings = (rule, options) =>
			Effect.map(allFindings(rule, options), (findings) =>
				findings.flatMap((finding) => (finding.file.startsWith(prefix) ? [{ ...finding, file: finding.file.slice(prefix.length) }] : [])),
			);
		return kit.trait("repository", `the shared repository's ${folder} folder holds: ${lines}`, (engine) => {
			engine.case = caseFindings;
		});
	}

	return {
		case: seededCase,
		has: (...files: readonly SeedFile[]) => seededCase(repositoryHas(...files)),
	};
}

export const ruleCases: typeof kit & { readonly repository: typeof repository } = { ...kit, repository };
