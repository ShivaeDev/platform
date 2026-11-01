import { Effect, Schema, type SchemaAST } from "effect";
import { children, collect, collectEncodedKeys, collectFieldKeys, marked, maskedValue } from "#schemaSensitiveAst.ts";
import { isSensitiveKey } from "#sensitive.ts";

export function schemaFieldKeys(ast: SchemaAST.AST, extra: readonly string[]) {
	const keys = new Set(extra);
	const nodes = new Set<SchemaAST.AST>();
	collect(ast, nodes);
	const properties = [...nodes].flatMap((node) => (node._tag === "Objects" ? node.propertySignatures : []));
	collectFieldKeys(properties, keys, marked);
	let previousSize: number;
	do {
		previousSize = keys.size;
		collectFieldKeys(properties, keys, (node) => maskedValue(node, keys));
		for (const node of nodes) {
			collectEncodedKeys(node, keys);
		}
	} while (keys.size !== previousSize);
	return keys;
}

interface Field {
	readonly key: string;
	readonly path: string;
	readonly sensitive: boolean;
}

function fieldsOf(ast: SchemaAST.AST, schema: string, extra: readonly string[], candidates: ReadonlySet<string>): Field[] {
	const fields: Field[] = [];
	function visitIndex(
		index: SchemaAST.IndexSignature,
		path: string,
		hidden: boolean,
		seen: ReadonlySet<SchemaAST.AST>,
		encoded: ReadonlySet<string>,
	) {
		const accepts = Schema.is(Schema.make(index.parameter));
		for (const key of candidates) {
			if (accepts(key)) {
				fields.push({ key, path: `${path}[${key}]`, sensitive: hidden || encoded.has(key) || extra.includes(key) || isSensitiveKey(key) });
			}
		}
		visit(index.type, `${path}[value]`, hidden, seen, encoded);
	}
	function visitObject(node: SchemaAST.Objects, path: string, hidden: boolean, seen: ReadonlySet<SchemaAST.AST>, encoded: ReadonlySet<string>) {
		for (const property of node.propertySignatures) {
			if (typeof property.name !== "string") {
				continue;
			}
			const sensitive =
				hidden
				|| encoded.has(property.name)
				|| extra.includes(property.name)
				|| isSensitiveKey(property.name)
				|| maskedValue(property.type, schemaFieldKeys(property.type, []));
			const fieldPath = `${path}.${property.name}`;
			fields.push({ key: property.name, path: fieldPath, sensitive });
			visit(property.type, fieldPath, sensitive, seen, encoded);
		}
		for (const index of node.indexSignatures) {
			visitIndex(index, path, hidden, seen, encoded);
		}
	}
	function visit(node: SchemaAST.AST, path: string, hidden: boolean, ancestors: ReadonlySet<SchemaAST.AST>, encoded: ReadonlySet<string>) {
		if (ancestors.has(node)) {
			return;
		}
		const seen = new Set(ancestors).add(node);
		const masked = hidden || marked(node);
		if (node._tag === "Objects") {
			visitObject(node, path, masked, seen, encoded);
		} else {
			for (const [index, child] of children(node).entries()) {
				visit(child, `${path}[${index}]`, masked, seen, encoded);
			}
		}
		if (node.encoding !== undefined) {
			const keys = new Set([...encoded, ...schemaFieldKeys(node, [])]);
			for (const link of node.encoding) {
				visit(link.to, `${path}.encoded`, masked, seen, keys);
			}
		}
	}
	visit(ast, schema, false, new Set(), new Set());
	for (const key of schemaFieldKeys(ast, [])) {
		if (!fields.some((field) => field.key === key && field.sensitive)) {
			fields.push({ key, path: `${schema}.encoded.${key}`, sensitive: true });
		}
	}
	return fields;
}

export class SensitiveFieldConflict extends Schema.TaggedError<SensitiveFieldConflict>()("SensitiveFieldConflict", {
	field: Schema.String,
	message: Schema.String,
	publicSchema: Schema.String,
	sensitiveSchema: Schema.String,
}) {}

export const validateFieldScope = Effect.fn("Errors.validateFieldScope")(function* (
	schemas: readonly { readonly ast: SchemaAST.AST; readonly name: string }[],
	extra: readonly string[],
) {
	const candidates = new Set(schemas.flatMap(({ ast }) => [...schemaFieldKeys(ast, [])]));
	const fields = schemas.flatMap(({ ast, name }) => fieldsOf(ast, name, extra, candidates));
	// A masked container protects its children without making each child name sensitive.
	for (const hidden of fields.filter(
		(field) => candidates.has(field.key) && field.sensitive && !extra.includes(field.key) && !isSensitiveKey(field.key),
	)) {
		const publicField = fields.find((field) => field.key === hidden.key && !field.sensitive);
		if (publicField !== undefined) {
			return yield* new SensitiveFieldConflict({
				field: hidden.key,
				message: `Sensitive field "${hidden.key}" in schema ${hidden.path} conflicts with public field in schema ${publicField.path}; RPC diagnostics cannot distinguish these fields. Use distinct field names or mark both fields sensitive.`,
				publicSchema: publicField.path,
				sensitiveSchema: hidden.path,
			});
		}
	}
});
