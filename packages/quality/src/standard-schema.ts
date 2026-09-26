// The Standard Schema V1 contract (standardschema.dev), copied as the specification recommends. Rule options accept any
// conforming schema, so a consumer's own Effect version, or another schema library, validates them.
export interface StandardSchemaV1<Input = unknown, Output = Input> {
	readonly "~standard": {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
		readonly types?: { readonly input: Input; readonly output: Output } | undefined;
	};
}

export type StandardResult<Output> = { readonly value: Output; readonly issues?: undefined } | { readonly issues: ReadonlyArray<StandardIssue> };

export interface StandardIssue {
	readonly message: string;
	readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
}

const segment = (part: PropertyKey | { readonly key: PropertyKey }): string => String(typeof part === "object" ? part.key : part);

export const describeIssue = (issue: StandardIssue): string =>
	issue.path === undefined || issue.path.length === 0 ? issue.message : `${issue.path.map(segment).join(".")}: ${issue.message}`;
