import { isAbsolute, relative } from "node:path";
import { Effect } from "effect";
import { SetupFailure } from "#failure.ts";
import { posix } from "#inventory/ignore-scope.ts";
import type { Finding, Findings, RuleInputs } from "#rule.ts";
import type { ActiveLevel, Violation } from "./violation.ts";

export interface ActiveRule {
	readonly check: (inputs: RuleInputs) => Promise<Findings>;
	readonly description: string;
	readonly family: boolean;
	readonly id: string;
	readonly level: ActiveLevel;
	readonly registrable?: boolean;
}

const messageOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// Registry and baseline entries match on the path, so every finding names its file the same way.
const repositoryPath = (root: string, file: string): string => posix(isAbsolute(file) ? relative(root, file) : file).replace(/^(\.\/)+/u, "");

function exceptionHint(rule: ActiveRule, finding: Finding, file: string, config: string): string {
	const id = rule.family && finding.subject !== undefined ? `${rule.id}/${finding.subject}` : rule.id;
	const biome = /^biome\/(?:lint|assist)\/[a-zA-Z]+\/[a-zA-Z]+$/u.test(id);
	if (!biome && rule.registrable === false) {
		return "";
	}
	const shape = JSON.stringify({
		files: [file],
		reason: "Explain why this exception is permanent.",
		rules: [id],
		...(!rule.family && finding.subject !== undefined ? { subject: finding.subject } : {}),
	});
	return ` For a permanent exception, add to exceptions in ${config}: ${shape}.`;
}

const violationOf = (rule: ActiveRule, root: string, finding: Finding, exceptionFile: string): Violation => ({
	...finding,
	file: repositoryPath(root, finding.file),
	level: rule.level,
	message: finding.message + exceptionHint(rule, finding, repositoryPath(root, finding.file), exceptionFile),
	rule: rule.family && finding.subject !== undefined ? `${rule.id}/${finding.subject}` : rule.id,
});

const runRule = (rule: ActiveRule, inputs: RuleInputs, exceptionFile: string): Effect.Effect<readonly Violation[], SetupFailure> =>
	Effect.map(
		Effect.tryPromise({
			catch: (cause) => new SetupFailure({ message: `rule ${rule.id} failed: ${messageOf(cause)}` }),
			try: () => rule.check(inputs),
		}),
		(findings) => findings.map((finding) => violationOf(rule, inputs.root, finding, exceptionFile)),
	);

export const runRules = (rules: readonly ActiveRule[], inputs: RuleInputs): Effect.Effect<readonly Violation[], SetupFailure> =>
	Effect.map(
		Effect.forEach(rules, (rule) => runRule(rule, inputs, inputs.configFile ?? "quality.config.ts"), { concurrency: "unbounded" }),
		(results) => results.flat(),
	);
