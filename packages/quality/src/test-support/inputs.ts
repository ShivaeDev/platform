import { linesOf } from "#inventory/collect.ts";
import type { Findings, Rule, RuleInputs } from "#rule.ts";
import type { SeedFile } from "./tree.ts";

export interface Seed {
	readonly files?: readonly string[];
	readonly sources?: readonly SeedFile[];
	readonly texts?: Readonly<Record<string, string>>;
}

export const inputsOf = (seed: Seed): RuleInputs => {
	const sources = (seed.sources ?? []).map((file) => ({ lines: linesOf(file.content), path: file.path, text: file.content }));
	return {
		files: seed.files ?? sources.map((file) => file.path),
		readText: (path) => Promise.resolve(seed.texts?.[path]),
		root: "/virtual",
		sources,
	};
};

export const checkRule = async <Input>(rule: Rule<string, Input>, options: Input | undefined, seed: Seed): Promise<Findings> => {
	const configured = await rule.configure(options);
	if (configured._tag === "Invalid") {
		throw new Error(`invalid options: ${configured.issues.join("; ")}`);
	}
	return configured.check(inputsOf(seed));
};

export const issuesOf = async (rule: Rule, options: unknown): Promise<readonly string[]> => {
	const configured = await rule.configure(options);
	return configured._tag === "Invalid" ? configured.issues : [];
};
