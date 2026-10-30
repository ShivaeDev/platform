import { Option, Schema } from "effect";
import type { Diagnostic } from "#integration/metadata.ts";
import { Metadata } from "#metadata/schema.ts";
import { invalidField, questionFields } from "./vocabulary.ts";

const addonFields = new Set(["fleet-launch", "fleet-priority"]);
const schemas: ReadonlyMap<string, Schema.ConstraintDecoder<unknown, never>> = new Map(Object.entries(Metadata.to.fields));
const sourceKeys = new Map([
	["next_action", "nextAction"],
	["request_receipt", "requestReceipt"],
]);
type Field = { readonly key: string; readonly value: unknown } | { readonly diagnostic: Diagnostic };
function readField(field: string, value: unknown, lines: Readonly<Record<string, number>>): Field | undefined {
	const key = sourceKeys.get(field) ?? field;
	const schema = field === "nextAction" || field === "requestReceipt" ? undefined : schemas.get(key);
	const line = lines[field] ?? 2;
	if (!schema) {
		if (addonFields.has(field)) {
			return undefined;
		}
		const action = ["fleet-deliverable", "superseded_by", "replaced_by"].includes(field) ? " Run work-board migrate <board dir>." : "";
		return { diagnostic: { field, line, message: `Unknown field ${field}; kept in the original frontmatter.${action}` } };
	}
	const decoded = Schema.decodeUnknownOption(schema, { onExcessProperty: "error" })(value);
	return Option.isNone(decoded) ? { diagnostic: { field, line, message: invalidField(field) } } : { key, value: decoded.value };
}
export function metadataFields(data: object, lines: Readonly<Record<string, number>>) {
	const fields: Record<string, unknown> = {};
	const diagnostics: Diagnostic[] = [];
	for (const [field, value] of Object.entries(data)) {
		const result = readField(field, value, lines);
		if (!result) {
			continue;
		}
		if ("diagnostic" in result) {
			diagnostics.push(result.diagnostic);
		} else {
			fields[result.key] = result.value;
		}
	}
	diagnostics.push(...questionFields(fields, lines));
	const invalid = diagnostics.some((problem) => /work-board migrate/u.test(problem.message));
	return { diagnostics, fields: Schema.decodeUnknownSync(Schema.toType(Metadata))(invalid ? {} : fields) };
}
