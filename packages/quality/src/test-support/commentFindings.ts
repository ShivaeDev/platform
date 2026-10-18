import type { Rule } from "#rule.ts";
import { checkRule } from "#test/inputs.ts";

export async function commentFindings(rule: Rule<string, undefined>, comment: string) {
	return (await checkRule(rule, undefined, { sources: [{ content: `export const a = 1;\n${comment}\n`, path: "src/a.ts" }] })).map(
		(finding) => `${finding.line} ${finding.message}`,
	);
}
