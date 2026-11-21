import { Effect, Schema } from "effect";
import { OwnerFieldError } from "#repositoryCollection.ts";
import { serverOnlyStored } from "#serverOnly.ts";

const OWNER = "@shivaedev/sql/owner";

export function owner<TSchema extends Schema.Top & Schema.ConstraintCodec<string | null, unknown, never, never>>(
	schema: TSchema,
): TSchema["Rebuild"] {
	return schema.annotate({ [OWNER]: true });
}

// The model's one owner field, or undefined when it has none.
export const declaredOwner = Effect.fnUntraced(function* (table: string, fields: Schema.Struct.Fields) {
	const marked = Object.entries(fields).filter(([, schema]) => Schema.resolveAnnotations(schema)?.[OWNER] === true);
	const [first] = marked;
	if (first === undefined) {
		return undefined;
	}
	if (marked.length > 1) {
		return yield* new OwnerFieldError({ fields: marked.map(([name]) => name), reason: "several", tableName: table });
	}
	const [field, fieldSchema] = first;
	if (serverOnlyStored(fieldSchema) !== undefined) {
		return yield* new OwnerFieldError({ fields: [field], reason: "server-only", tableName: table });
	}
	return field;
});
