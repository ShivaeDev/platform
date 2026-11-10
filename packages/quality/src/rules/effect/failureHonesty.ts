import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";
import { failureFindings } from "#rules/effect/failureFindings.ts";
import { workspaceProgram } from "#rules/effect/workspaceProgram.ts";

const checkFailures = Effect.fn("FailureHonesty.checkFailures")(function* (inputs: RuleInputs) {
	const program = yield* workspaceProgram(inputs);
	const checker = program.getTypeChecker();
	return inputs.sources.flatMap((file) => {
		const source = program.getSourceFile(join(inputs.root, file.path));
		const testSupport = /(?:^|\/)test-support\//u.test(file.path);
		const findings: Finding[] = [];
		const reported = new Set<string>();
		function report(node: ts.Node, message: string): void {
			const key = `${node.pos}:${message}`;
			if (source !== undefined && !reported.has(key)) {
				reported.add(key);
				findings.push({ file: file.path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message });
			}
		}
		function visit(node: ts.Node): void {
			if (ts.isCallExpression(node)) {
				for (const finding of failureFindings(checker, node, testSupport)) {
					report(finding.node, finding.message);
				}
			}
			ts.forEachChild(node, visit);
		}
		if (source !== undefined) {
			visit(source);
		}
		return findings;
	});
});

export const failureHonesty = defineRule({
	check: (inputs) => {
		const groups = new Map<string, RuleInputs["sources"][number][]>();
		for (const source of inputs.sources) {
			if (
				!(
					/\.[cm]?[jt]sx?$/u.test(source.path)
					&& /\b(?:catch|catchAll|catchCause|catchAllCause|retry|forever|option|orElseSucceed)\b/u.test(source.text)
				)
			) {
				continue;
			}
			const group = /^(?:packages|examples)\/[^/]+/u.exec(source.path)?.[0] ?? ".";
			const sources = groups.get(group) ?? [];
			sources.push(source);
			groups.set(group, sources);
		}
		return Effect.map(
			Effect.forEach(groups.values(), (sources) => checkFailures({ ...inputs, sources })),
			(found) => found.flat(),
		);
	},
	description:
		"Keep failures typed and observable: no forked forever/orDie loops, retry({ while }) without times or a pacing Schedule, blanket catch-to-success, or FileSystem option/orElseSucceed. Catch a named reason, use a Schedule that paces retries or model an explicit unavailable state. In test-support/, a blanket catch whose handler derives its value from the caught error is a readout translation and is accepted. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/failure-honesty",
	registrable: false,
});
