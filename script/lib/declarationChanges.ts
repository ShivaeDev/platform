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
