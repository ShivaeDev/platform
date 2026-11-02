import { Effect, Exit, Predicate, Schema, type SchemaAST } from "effect";
import { REDACTED } from "#sensitive.ts";

export class InvalidRedactionMask extends Schema.TaggedError<InvalidRedactionMask>()("InvalidRedactionMask", {
	field: Schema.String,
	message: Schema.String,
}) {}

type Ancestors = ReadonlySet<SchemaAST.AST>;

const objectMask = Effect.fnUntraced(function* (ast: SchemaAST.Objects, field: string, seen: Ancestors) {
	const entries: [PropertyKey, unknown][] = [];
	for (const property of ast.propertySignatures) {
		if (!property.type.context?.isOptional) {
			entries.push([property.name, yield* wireMask(property.type, `${field}.${String(property.name)}`, seen)]);
		}
	}
	return Object.fromEntries(entries);
});
const arrayMask = Effect.fnUntraced(function* (ast: SchemaAST.Arrays, field: string, seen: Ancestors) {
	const items: unknown[] = [];
	for (const [index, element] of ast.elements.entries()) {
		if (!element.context?.isOptional) {
			items.push(yield* wireMask(element, `${field}[${index}]`, seen));
		}
	}
	return items;
});
const unionMask = Effect.fnUntraced(function* (ast: SchemaAST.Union, field: string, seen: Ancestors) {
	for (const member of ast.types) {
		const candidate = yield* Effect.result(wireMask(member, field, seen));
		if (candidate._tag === "Success") {
			return candidate.success;
		}
	}
	return undefined;
});
function genericMask(ast: SchemaAST.AST, field: string, seen: Ancestors): Effect.Effect<unknown, InvalidRedactionMask> {
	switch (ast._tag) {
		case "String":
		case "Unknown":
		case "Any":
			return Effect.succeed(REDACTED);
		case "Number":
			return Effect.succeed(0);
		case "Boolean":
			return Effect.succeed(false);
		case "Null":
			return Effect.succeed(null);
		case "Undefined":
		case "Void":
			return Effect.succeed(undefined);
		case "Literal":
			return Effect.succeed(ast.literal);
		case "Objects":
			return objectMask(ast, field, seen);
		case "Arrays":
			return arrayMask(ast, field, seen);
		case "Union":
			return unionMask(ast, field, seen);
		case "Suspend":
			return wireMask(ast.thunk(), field, seen);
		default:
			return Effect.succeed(REDACTED);
	}
}

export const wireMask = Effect.fnUntraced(function* (
	ast: SchemaAST.AST,
	field: string,
	ancestors: Ancestors = new Set(),
): Effect.fn.Return<unknown, InvalidRedactionMask> {
	function invalid() {
		return new InvalidRedactionMask({
			field,
			message: `Sensitive field "${field}" needs a schema-compatible mask; supply a redactionMask annotation on its wire schema.`,
		});
	}
	if (ancestors.has(ast)) {
		return yield* invalid();
	}
	const seen = new Set(ancestors).add(ast);
	const Annotations = Schema.resolveAnnotations(Schema.make(ast));
	let value: unknown;
	if (Predicate.hasProperty(Annotations, "redactionMask")) {
		value = Annotations.redactionMask;
	} else {
		value = ast.encoding === undefined ? yield* genericMask(ast, field, seen) : yield* wireMask(ast.encoding.at(-1)?.to ?? ast, field, seen);
	}
	if (Exit.isFailure(Schema.decodeUnknownExit(Schema.toCodecJson(Schema.make<Schema.Codec<unknown>>(ast)))(value))) {
		return yield* invalid();
	}
	return value;
});
