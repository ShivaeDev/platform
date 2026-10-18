import { Predicate, type Schema, type SchemaAST } from "effect";
import { Rpc, type RpcGroup } from "effect/rpc";
import { isSensitiveKey } from "#server/rpc-server/sensitive.ts";

function children(ast: SchemaAST.AST): readonly SchemaAST.AST[] {
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
function marked(ast: SchemaAST.AST, seen = new Set<SchemaAST.AST>()): boolean {
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
function collectEncodedKeys(ast: SchemaAST.AST, keys: Set<string>) {
	let source = ast;
	let sensitive = false;
	for (const link of ast.encoding ?? []) {
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
function maskedValue(ast: SchemaAST.AST, keys: ReadonlySet<string>, seen = new Set<SchemaAST.AST>()): boolean {
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
		sensitive ||= containsSensitive(source, keys);
		if (sensitive && (link.to._tag !== "Objects" || link.to.indexSignatures.length > 0)) {
			return true;
		}
		source = link.to;
	}
	const nested = ast._tag === "Objects" ? ast.indexSignatures.map((index) => index.type) : children(ast);
	return nested.some((type) => maskedValue(type, keys, seen));
}
function collect(ast: SchemaAST.AST, nodes: Set<SchemaAST.AST>, encodings = true) {
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
function collectFieldKeys(properties: SchemaAST.Objects["propertySignatures"], keys: Set<string>, sensitive: (ast: SchemaAST.AST) => boolean) {
	for (const property of properties) {
		if (typeof property.name === "string" && sensitive(property.type)) {
			keys.add(property.name);
		}
	}
}
export function schemaSensitiveKeys<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, extra: readonly string[] = []) {
	const keys = new Set(extra);
	const nodes = new Set<SchemaAST.AST>();
	function schema(value: Schema.Top) {
		collect(value.ast, nodes);
	}
	function request(rpc: Rpc.AnyWithProps) {
		schema(rpc.payloadSchema);
		schema(rpc.successSchema);
		schema(rpc.errorSchema);
		schema(rpc.defectSchema);
		for (const middleware of rpc.middlewares) {
			schema(middleware.error);
		}
	}
	for (const rpc of group.requests.values()) {
		if (Rpc.isRpc(rpc)) {
			request(rpc);
		}
	}
	const properties = [...nodes].flatMap((ast) => (ast._tag === "Objects" ? ast.propertySignatures : []));
	collectFieldKeys(properties, keys, marked);
	let previousSize: number;
	do {
		previousSize = keys.size;
		collectFieldKeys(properties, keys, (ast) => maskedValue(ast, keys));
		for (const ast of nodes) {
			collectEncodedKeys(ast, keys);
		}
	} while (keys.size !== previousSize);
	return (key: string) => keys.has(key) || isSensitiveKey(key);
}
