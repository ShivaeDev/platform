import { isAbsolute, relative } from "node:path";
import { Effect } from "effect";
import { ManifestFailure } from "#adapters/manifestInventory.ts";
import { SetupFailure } from "#failure.ts";
import { posix } from "#inventory/ignoreScope.ts";
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

function runRule(rule: ActiveRule, inputs: RuleInputs, exceptionFile: string): Effect.Effect<readonly Violation[], SetupFailure> {
	return Effect.map(
		Effect.tryPromise({
			catch: (cause) => (cause instanceof ManifestFailure ? cause : new SetupFailure({ message: `rule ${rule.id} failed: ${messageOf(cause)}` })),
			try: () => rule.check(inputs),
		}),
		(findings) => findings.map((finding) => violationOf(rule, inputs.root, finding, exceptionFile)),
	).pipe(
		Effect.catchTag("ManifestFailure", (failure) =>
			Effect.succeed([{ file: failure.path, level: "error" as const, message: failure.message, rule: "manifests/valid" }]),
		),
	);
}

export const runRules = Effect.fn("Engine.runRules")(function* (rules: readonly ActiveRule[], inputs: RuleInputs) {
	const validation = rules.find((rule) => rule.id === "manifests/valid");
	if (validation !== undefined) {
		const failures = yield* runRule(validation, inputs, inputs.configFile ?? "quality.config.ts");
		if (failures.length > 0) {
			return failures;
		}
	}
	const results = yield* Effect.forEach(
		rules.filter((rule) => rule !== validation),
		(rule) => runRule(rule, inputs, inputs.configFile ?? "quality.config.ts"),
		{ concurrency: "unbounded" },
	);
	const seen = new Set<string>();
	return results.flat().filter((finding) => {
		if (finding.rule !== "manifests/valid") {
			return true;
		}
		const duplicate = seen.has(finding.file);
		seen.add(finding.file);
		return !duplicate;
	});
});
