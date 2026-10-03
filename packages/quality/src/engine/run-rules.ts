import { isAbsolute, relative } from "node:path";
import { Effect } from "effect";
import { SetupFailure } from "../failure.ts";
import { posix } from "../inventory/ignore-scope.ts";
import type { Finding, Findings, RuleInputs } from "../rule.ts";
import type { ActiveLevel, Violation } from "./violation.ts";

export interface ActiveRule {
	readonly check: (inputs: RuleInputs) => Promise<Findings>;
	readonly description: string;
	readonly family: boolean;
	readonly id: string;
	readonly level: ActiveLevel;
}

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// Registry and baseline entries match on the path, so every finding names its file the same way.
const repositoryPath = (root: string, file: string): string => posix(isAbsolute(file) ? relative(root, file) : file).replace(/^(\.\/)+/u, "");

const violationOf = (rule: ActiveRule, root: string, finding: Finding): Violation => ({
	...finding,
	file: repositoryPath(root, finding.file),
	level: rule.level,
	rule: rule.family && finding.subject !== undefined ? `${rule.id}/${finding.subject}` : rule.id,
});

const runRule = (rule: ActiveRule, inputs: RuleInputs): Effect.Effect<readonly Violation[], SetupFailure> =>
	Effect.map(
		Effect.tryPromise({
			catch: (cause) => new SetupFailure({ message: `rule ${rule.id} failed: ${messageOf(cause)}` }),
			try: () => rule.check(inputs),
		}),
		(findings) => findings.map((finding) => violationOf(rule, inputs.root, finding)),
	);

export const runRules = (rules: readonly ActiveRule[], inputs: RuleInputs): Effect.Effect<readonly Violation[], SetupFailure> =>
	Effect.map(
		Effect.forEach(rules, (rule) => runRule(rule, inputs), { concurrency: "unbounded" }),
		(results) => results.flat(),
	);
