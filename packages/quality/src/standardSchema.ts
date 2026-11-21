// The Standard Schema V1 contract (standardschema.dev), copied as the specification recommends. Rule options accept any
// conforming schema, so a consumer's own Effect version, or another schema library, validates them.
export interface StandardSchemaV1<TInput = unknown, TOutput = TInput> {
	readonly "~standard": {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) => StandardResult<TOutput> | Promise<StandardResult<TOutput>>;
		readonly types?: { readonly input: TInput; readonly output: TOutput } | undefined;
	};
}

export type StandardResult<TOutput> = { readonly value: TOutput; readonly issues?: undefined } | { readonly issues: readonly StandardIssue[] };

export interface StandardIssue {
	readonly message: string;
	readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

// Biome's noBaseToString does not narrow the ternary in segment, so the key is stringified behind a PropertyKey parameter.
function keyText(key: PropertyKey): string {
	return key.toString();
}

function segment(part: PropertyKey | { readonly key: PropertyKey }): string {
	return keyText(typeof part === "object" ? part.key : part);
}

export function describeIssue(issue: StandardIssue): string {
	return issue.path === undefined || issue.path.length === 0 ? issue.message : `${issue.path.map(segment).join(".")}: ${issue.message}`;
}
