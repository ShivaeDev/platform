import { Schema } from "effect";
import { Declaration } from "./declarations.ts";

const GLOB = /[*!?[\]{}]/u;
const DIRECTORY = /^\.?[^./\\*!?[\]{}]+$/u;
const INDIVIDUAL = /^(?:lint|assist)\/(?!domains\/)[a-zA-Z]+\/[a-zA-Z]+$/u;

function namedExclusion(pattern: string): boolean {
	const segments = pattern.slice(pattern.startsWith("!**/") ? 4 : 1).split("/");
	return pattern.startsWith("!") && DIRECTORY.test(segments.at(-1) ?? "") && segments.every((segment) => segment === "*" || DIRECTORY.test(segment));
}

export const ConsumerDeclaration = Declaration.check(
	Schema.makeFilter(
		({ includes, rule }) =>
			rule === "files/includes"
				? includes.includes("**") && includes.length > 1 && includes.every((pattern) => pattern === "**" || namedExclusion(pattern))
				: INDIVIDUAL.test(rule) && includes.every((path) => !GLOB.test(path) && /[^/]+\.[^/]+$/u.test(path)),
		{
			message:
				"Declare one lint rule or assist action for explicit files, or files/includes with ** and named directory exclusions. Whole checks, groups and blanket scopes cannot be weakened.",
		},
	),
);
