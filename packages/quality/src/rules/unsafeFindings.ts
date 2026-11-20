import { inAdapters, inTestSupport } from "#naming/unsafeFolders.ts";
import type { Finding, RuleInputs } from "#rule.ts";

// adapters/ permits what these rules forbid, so they read it only when an active rule needs what they find there as evidence.
export function skipsUnsafeFolder(inputs: Pick<RuleInputs, "collectsEvidence">, path: string): boolean {
	return inTestSupport(path) || (inputs.collectsEvidence !== true && inAdapters(path));
}

export function unsafeFindings(findings: readonly Finding[]): readonly Finding[] {
	return findings.map((finding) => ({ ...finding, unsafe: true }));
}
