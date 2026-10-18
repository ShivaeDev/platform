import type { Findings, Rule } from "@shivaedev/quality/rule.ts";

export async function checkRule(rule: Rule<string, undefined>, texts: Readonly<Record<string, string>>): Promise<Findings> {
	const configured = await rule.configure(undefined);
	if (configured._tag === "Invalid") {
		throw new Error(configured.issues.join("; "));
	}
	return configured.check({
		files: Object.keys(texts),
		readText: (path: string) => Promise.resolve(texts[path]),
		root: "/virtual",
		sources: [],
	});
}
