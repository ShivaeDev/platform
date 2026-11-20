import type { Finding } from "#rule.ts";

export function unsafeFindings(findings: readonly Finding[]): readonly Finding[] {
	return findings.map((finding) => ({ ...finding, unsafe: true }));
}
