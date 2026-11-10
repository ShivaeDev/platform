import { byText } from "#byText.ts";
import type { DeclaredClass, Failure } from "#facts.ts";

// Never rejections: the wire adds the automatic two to every operation, and the others are infrastructure or policy outcomes.
const NOT_REJECTIONS: ReadonlySet<string> = new Set([
	"@shivaedev/contract QueryReadDenied",
	"@shivaedev/errors InternalServerError",
	"@shivaedev/errors ServiceUnavailable",
	"effect SchemaError",
]);

export interface Rejection {
	readonly declared: DeclaredClass;
	readonly tag: string;
}

export function isRejection(packageName: string | undefined, declared: DeclaredClass): boolean {
	return !NOT_REJECTIONS.has(`${packageName ?? ""} ${declared.className}`);
}

function refusalOf(label: string, failure: Failure): string | undefined {
	switch (failure.kind) {
		case "untagged":
			return `${label}: run fails with ${failure.text}, which has no _tag; fail with an exported tagged error class instead`;
		case "unexported":
			return `${label}: run fails with ${failure.text} (${failure.tag}), which is not an exported class; export its class so the browser can decode it`;
		case "class":
			return failure.schema
				? undefined
				: `${label}: run fails with ${failure.declared.className} (${failure.tag}), which is not a Schema class, so the browser cannot decode it; declare it as a Schema tagged error, such as class ${failure.declared.className} extends Schema.TaggedError<${failure.declared.className}>()("${failure.tag}", { ... })`;
		case "retryable":
			return undefined;
	}
}

export function rejectionsOf(label: string, failures: readonly Failure[], packageOf: (file: string) => string | undefined) {
	const refusals: string[] = [];
	const byTag = new Map<string, Rejection>();
	for (const failure of failures) {
		const rejection = failure.kind !== "class" || isRejection(packageOf(failure.declared.file), failure.declared);
		const refusal = rejection ? refusalOf(label, failure) : undefined;
		if (refusal !== undefined) {
			refusals.push(refusal);
		}
		if (failure.kind === "class" && rejection) {
			const known = byTag.get(failure.tag);
			if (known !== undefined && (known.declared.file !== failure.declared.file || known.declared.className !== failure.declared.className)) {
				refusals.push(
					`${label}: run fails with two classes tagged ${failure.tag}, from ${known.declared.file} and ${failure.declared.file}; raise one of them`,
				);
			}
			byTag.set(failure.tag, failure);
		}
	}
	const rejections = [...byTag.values()].sort((left, right) => byText(left.tag, right.tag));
	return { refusals, rejections };
}
