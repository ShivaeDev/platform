import { Order } from "effect";
import type { Source } from "@shivaedev/releases/model.ts";

export const declarationFields = ["dependencies", "optionalDependencies", "peerDependencies"] as const;

export type Declarations = { readonly [TField in (typeof declarationFields)[number]]?: Readonly<Record<string, string>> | undefined };

export function declarationChanges(published: Declarations, current: Declarations): readonly string[] {
	return declarationFields.flatMap((field) => {
		const before = published[field] ?? {};
		const after = current[field] ?? {};
		return [...new Set([...Object.keys(before), ...Object.keys(after)])]
			.sort((left, right) => left.localeCompare(right))
			.flatMap((name) =>
				before[name] === after[name] ? [] : [`${field}.${name} is ${after[name] ?? "absent"} here and ${before[name] ?? "absent"} on npm`],
			);
	});
}

export function declarationDriftChangeset(names: readonly string[]): Source | undefined {
	const sorted = [...names].sort(Order.String);
	return sorted.length === 0
		? undefined
		: {
				name: "release-declared-dependencies.md",
				text: `---\n${sorted.map((name) => `"${name}": patch`).join("\n")}\n---\n\n### Changed\n\n${sorted.map((name) => `- \`${name}\`: Align published dependency requirements with the workspace.`).join("\n")}\n`,
			};
}
