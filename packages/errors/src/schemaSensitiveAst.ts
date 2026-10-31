import { Predicate, type SchemaAST } from "effect";
import { isSensitiveKey } from "#sensitive.ts";

export function children(ast: SchemaAST.AST): readonly SchemaAST.AST[] {
	switch (ast._tag) {
		case "Objects":
			return [...ast.propertySignatures.map((property) => property.type), ...ast.indexSignatures.flatMap((index) => [index.parameter, index.type])];
		case "Arrays":
			return [...ast.elements, ...ast.rest];
		case "Union":
			return ast.types;
		case "Declaration":
			return ast.typeParameters;
		case "Suspend":
			return [ast.thunk()];
		default:
			return [];
	}
}
function sensitiveCheck(check: SchemaAST.Check<never>): boolean {
	return check.annotations?.sensitive === true || (check._tag === "FilterGroup" && check.checks.some(sensitiveCheck));
}
export function marked(ast: SchemaAST.AST, seen = new Set<SchemaAST.AST>()): boolean {
	if (seen.has(ast)) {
		return false;
	}
	seen.add(ast);
	if (
		ast.annotations?.sensitive === true
		|| ast.context?.annotations?.sensitive === true
		|| ast.checks?.some(sensitiveCheck)
		|| (Predicate.hasProperty(ast.annotations?.representation, "id") && ast.annotations.representation.id === "effect/schema/Redacted")
	) {
		return true;
	}
	const nested = ast._tag === "Objects" ? ast.indexSignatures.map((index) => index.type) : children(ast);
	return (ast.encoding?.some((link) => marked(link.to, seen)) ?? false) || nested.some((type) => marked(type, seen));
}
function containsSensitive(ast: SchemaAST.AST, keys: ReadonlySet<string>): boolean {
	return (
		marked(ast)
		|| propertiesOf(ast).some((property) => typeof property.name === "string" && (keys.has(property.name) || isSensitiveKey(property.name)))
	);
}
function preservesFields(source: SchemaAST.AST, target: SchemaAST.AST): boolean {
	return (
		source._tag === "Declaration"
		&& Predicate.hasProperty(source.annotations?.representation, "id")
		&& source.annotations.representation.id === "effect/schema/Option"
		&& target._tag === "Union"
		&& target.types.some((type) => type._tag === "Null")
	);
}
export function collectEncodedKeys(ast: SchemaAST.AST, keys: Set<string>) {
	let source = ast;
	let sensitive = false;
	for (const link of ast.encoding ?? []) {
		if (preservesFields(source, link.to)) {
			source = link.to;
			continue;
		}
		sensitive ||= containsSensitive(source, keys);
		if (sensitive) {
			for (const property of propertiesOf(link.to)) {
				if (typeof property.name === "string") {
					keys.add(property.name);
				}
			}
		}
		source = link.to;
	}
}
function fixedOutput(ast: SchemaAST.AST): boolean {
	if (ast._tag === "Union") {
		return ast.types.every(fixedOutput);
	}
	return ast._tag === "Objects" && ast.indexSignatures.length === 0;
}
export function maskedValue(ast: SchemaAST.AST, keys: ReadonlySet<string>, seen = new Set<SchemaAST.AST>()): boolean {
	if (seen.has(ast)) {
		return false;
	}
	seen.add(ast);
	if (marked(ast)) {
		return true;
	}
	let source = ast;
	let sensitive = false;
	for (const link of ast.encoding ?? []) {
		if (preservesFields(source, link.to)) {
			source = link.to;
			continue;
		}
		sensitive ||= containsSensitive(source, keys);
		if (sensitive && !fixedOutput(link.to)) {
			return true;
		}
		source = link.to;
	}
	const nested = ast._tag === "Objects" ? ast.indexSignatures.map((index) => index.type) : children(ast);
	return nested.some((type) => maskedValue(type, keys, seen));
}
export function collect(ast: SchemaAST.AST, nodes: Set<SchemaAST.AST>, encodings = true) {
	if (nodes.has(ast)) {
		return;
	}
	nodes.add(ast);
	for (const child of [...children(ast), ...(encodings ? (ast.encoding?.map((link) => link.to) ?? []) : [])]) {
		collect(child, nodes, encodings);
	}
}
function propertiesOf(ast: SchemaAST.AST) {
	const nodes = new Set<SchemaAST.AST>();
	collect(ast, nodes, false);
	return [...nodes].flatMap((node) => (node._tag === "Objects" ? node.propertySignatures : []));
}
export function collectFieldKeys(properties: SchemaAST.Objects["propertySignatures"], keys: Set<string>, sensitive: (ast: SchemaAST.AST) => boolean) {
	for (const property of properties) {
		if (typeof property.name === "string" && sensitive(property.type)) {
			keys.add(property.name);
		}
	}
}
