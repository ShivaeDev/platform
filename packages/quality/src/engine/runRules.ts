import { isAbsolute, relative } from "node:path";
import { Effect } from "effect";
import { posix } from "#inventory/ignoreScope.ts";
import type { Finding, RuleCheck, RuleInputs, RuleServices } from "#rule.ts";
import type { ActiveLevel, Violation } from "./violation.ts";

export interface ActiveRule {
	readonly check: RuleCheck;
	readonly description: string;
	readonly family: boolean;
	readonly id: string;
	readonly level: ActiveLevel;
	readonly registrable?: boolean;
}

function messageOf(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

// Registry and baseline entries match on the path, so every finding names its file the same way.
function repositoryPath(root: string, file: string): string {
	return posix(isAbsolute(file) ? relative(root, file) : file).replace(/^(?:\.\/)+/u, "");
}

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

function violationOf(rule: ActiveRule, root: string, finding: Finding, exceptionFile: string): Violation {
	return {
		...finding,
		file: repositoryPath(root, finding.file),
		level: rule.level,
		message: finding.message + exceptionHint(rule, finding, repositoryPath(root, finding.file), exceptionFile),
		rule: rule.family && finding.subject !== undefined ? `${rule.id}/${finding.subject}` : rule.id,
	};
}

function runRule(rule: ActiveRule, inputs: RuleInputs, exceptionFile: string): Effect.Effect<readonly Violation[], never, RuleServices> {
	return Effect.suspend(() => rule.check(inputs)).pipe(
		Effect.orDie,
		Effect.map((findings) => findings.map((finding) => violationOf(rule, inputs.root, finding, exceptionFile))),
		Effect.catchDefect((cause) => Effect.die(new Error(`rule ${rule.id} failed: ${messageOf(cause)}`, { cause }))),
	);
}

export function runRules(rules: readonly ActiveRule[], inputs: RuleInputs): Effect.Effect<readonly Violation[], never, RuleServices> {
	return Effect.map(
		Effect.forEach(rules, (rule) => runRule(rule, inputs, inputs.configFile ?? "quality.config.ts"), { concurrency: "unbounded" }),
		(results) => results.flat(),
	);
}
