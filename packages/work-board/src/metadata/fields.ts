import { Option, Schema } from "effect";
import type { Diagnostic } from "./parse.ts";
import { Metadata } from "./schema.ts";

const schemas: ReadonlyMap<string, Schema.ConstraintDecoder<unknown, never>> = new Map(Object.entries(Metadata.to.fields));
const sourceKeys = new Map([["next_action", "nextAction"]]);

export function metadataFields(data: object, lines: Readonly<Record<string, number>>) {
	const fields: Record<string, unknown> = {};
	const diagnostics: Diagnostic[] = [];
	for (const [field, value] of Object.entries(data)) {
		const key = sourceKeys.get(field) ?? field;
		const schema = field === "nextAction" ? undefined : schemas.get(key);
		if (!schema) {
			diagnostics.push({ field, line: lines[field] ?? 2, message: `Unknown field ${field}; kept in the original frontmatter.` });
			continue;
		}
		const decoded = Schema.decodeUnknownOption(schema, { onExcessProperty: "error" })(value);
		if (Option.isNone(decoded)) {
			diagnostics.push({ field, line: lines[field] ?? 2, message: `Invalid ${field}; kept in the original frontmatter and not interpreted.` });
		} else {
			fields[key] = decoded.value;
		}
	}
	return { diagnostics, fields: Schema.decodeUnknownSync(Schema.toType(Metadata))(fields) };
}
