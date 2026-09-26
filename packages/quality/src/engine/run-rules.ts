import { isAbsolute, relative } from "node:path";
import { Effect } from "effect";
import { SetupFailure } from "../failure.ts";
import { posix } from "../inventory/ignore-scope.ts";
import type { Finding, Findings, RuleInputs } from "../rule.ts";
import type { ActiveLevel, Violation } from "./violation.ts";

export interface ActiveRule {
	readonly id: string;
	readonly description: string;
	readonly level: ActiveLevel;
	readonly check: (inputs: RuleInputs) => Promise<Findings>;
}

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// Registry and baseline entries match on the path, so every finding names its file the same way.
const repositoryPath = (root: string, file: string): string => posix(isAbsolute(file) ? relative(root, file) : file).replace(/^(\.\/)+/, "");

const violationOf = (rule: ActiveRule, root: string, finding: Finding): Violation => ({
	...finding,
	file: repositoryPath(root, finding.file),
	level: rule.level,
	rule: rule.id,
});

const runRule = (rule: ActiveRule, inputs: RuleInputs): Effect.Effect<ReadonlyArray<Violation>, SetupFailure> =>
	Effect.map(
		Effect.tryPromise({
			try: () => rule.check(inputs),
			catch: (cause) => new SetupFailure({ message: `rule ${rule.id} failed: ${messageOf(cause)}` }),
		}),
		(findings) => findings.map((finding) => violationOf(rule, inputs.root, finding)),
	);

export const runRules = (rules: ReadonlyArray<ActiveRule>, inputs: RuleInputs): Effect.Effect<ReadonlyArray<Violation>, SetupFailure> =>
	Effect.map(
		Effect.forEach(rules, (rule) => runRule(rule, inputs), { concurrency: "unbounded" }),
		(results) => results.flat(),
	);
