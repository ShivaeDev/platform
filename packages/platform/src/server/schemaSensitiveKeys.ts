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
function marked(ast: SchemaAST.AST, seen = new Set<SchemaAST.AST>()): boolean {
	if (seen.has(ast)) {
		return false;
	}
	seen.add(ast);
	if (
		ast.annotations?.sensitive === true
		|| ast.context?.annotations?.sensitive === true
		|| (Predicate.hasProperty(ast.annotations?.representation, "id") && ast.annotations.representation.id === "effect/schema/Redacted")
	) {
		return true;
	}
	const nested = ast._tag === "Objects" ? ast.indexSignatures.map((index) => index.type) : children(ast);
	return (ast.encoding?.some((link) => marked(link.to, seen)) ?? false) || nested.some((type) => marked(type, seen));
}
function collect(ast: SchemaAST.AST, keys: Set<string>, seen: Set<SchemaAST.AST>) {
	if (seen.has(ast)) {
		return;
	}
	seen.add(ast);
	if (ast._tag === "Objects") {
		for (const property of ast.propertySignatures) {
			if (typeof property.name === "string" && marked(property.type)) {
				keys.add(property.name);
			}
		}
	}
	for (const child of children(ast)) {
		collect(child, keys, seen);
	}
	for (const link of ast.encoding ?? []) {
		collect(link.to, keys, seen);
	}
}
export function schemaSensitiveKeys<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>, extra: readonly string[] = []) {
	const keys = new Set(extra);
	const seen = new Set<SchemaAST.AST>();
	function schema(value: Schema.Top) {
		collect(value.ast, keys, seen);
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
	return (key: string) => keys.has(key) || isSensitiveKey(key);
}
