import { Predicate, type Schema, type SchemaAST } from "effect";
import { Rpc, type RpcGroup } from "effect/rpc";
import { isSensitiveKey } from "#sensitive.ts";

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
function fixedOutput(ast: SchemaAST.AST): boolean {
	if (ast._tag === "Union") {
		return ast.types.every(fixedOutput);
	}
	return ast._tag === "Objects" && ast.indexSignatures.length === 0;
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
		if (sensitive && !fixedOutput(link.to)) {
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
	const requests: Rpc.AnyWithProps[] = [];
	for (const rpc of group.requests.values()) {
		if (Rpc.isRpc(rpc)) {
			requests.push(rpc);
		}
	}
	for (const rpc of requests) {
		const schemas: Schema.Top[] = [
			rpc.payloadSchema,
			rpc.successSchema,
			rpc.errorSchema,
			rpc.defectSchema,
			...[...rpc.middlewares].map((m) => m.error),
		];
		for (const schema of schemas) {
			collect(schema.ast, nodes);
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
	const roots = requests.map((rpc) => ({
		die: maskedValue(rpc.defectSchema.ast, keys),
		fail: [rpc.errorSchema, ...[...rpc.middlewares].map((m) => m.error)].some((schema) => maskedValue(schema.ast, keys)),
		tag: rpc._tag,
	}));
	return Object.assign((key: string) => keys.has(key) || isSensitiveKey(key), {
		maskFailure: (tag: string | undefined, reason: "Fail" | "Die") =>
			roots.some((root) => (tag === undefined || tag === root.tag) && (reason === "Fail" ? root.fail : root.die)),
	});
}
