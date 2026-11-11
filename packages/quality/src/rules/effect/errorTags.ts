import ts from "typescript";
import { type ImportBinding, importBindings } from "#rules/stories/importBindings.ts";
import { memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

export interface TaggedClass {
	readonly name: string | undefined;
	readonly node: ts.ClassLikeDeclaration;
	readonly tag: string;
}

export type ImportedTag = (binding: ImportBinding, member: string | undefined) => string | undefined;

const CONSTRUCTORS: ReadonlySet<string> = new Set(["TaggedError", "TaggedErrorClass"]);

function constructorTag(heritage: ts.Expression): string | undefined {
	const call = unwrapped(heritage);
	if (!ts.isCallExpression(call)) {
		return undefined;
	}
	const inner = ts.isCallExpression(call.expression) ? call.expression.expression : call.expression;
	const name = ts.isIdentifier(inner) ? inner.text : memberName(inner);
	const [first] = call.arguments;
	return CONSTRUCTORS.has(name ?? "") && first !== undefined && ts.isStringLiteralLike(first) ? first.text : undefined;
}

function propertyTag(node: ts.ClassLikeDeclaration): string | undefined {
	for (const member of node.members) {
		if (!(ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name) && member.name.text === "_tag")) {
			continue;
		}
		const readonly = member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword) === true;
		const literal = member.type !== undefined && ts.isLiteralTypeNode(member.type) ? member.type.literal : member.initializer;
		return readonly && literal !== undefined && ts.isStringLiteralLike(literal) ? literal.text : undefined;
	}
	return undefined;
}

function extended(node: ts.ClassLikeDeclaration): ts.Expression | undefined {
	return node.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression;
}

function importedBase(base: ts.Expression, bindings: ReadonlyMap<string, ImportBinding>, imported: ImportedTag): string | undefined {
	const namespace = ts.isPropertyAccessExpression(base) && ts.isIdentifier(base.expression) ? base.expression : undefined;
	const root = namespace ?? base;
	const binding = ts.isIdentifier(root) ? bindings.get(root.text) : undefined;
	return binding === undefined ? undefined : imported(binding, namespace === undefined ? undefined : memberName(base));
}

// A tagged error is a class built by a TaggedError constructor with a literal tag, an Error subclass with a readonly literal _tag, or a subclass of either.
export function taggedClasses(source: ts.SourceFile, imported: ImportedTag): readonly TaggedClass[] {
	const bindings = importBindings(source);
	const classes = nodesWhere(source, ts.isClassLike).filter(ts.isClassLike);
	const named = new Map(classes.flatMap((node) => (node.name === undefined ? [] : [[node.name.text, node] as const])));
	function tagOf(node: ts.ClassLikeDeclaration, seen: ReadonlySet<ts.Node>): string | undefined {
		const heritage = extended(node);
		if (heritage === undefined || seen.has(node)) {
			return undefined;
		}
		const base = unwrapped(heritage);
		const local = ts.isIdentifier(base) && !bindings.has(base.text) ? named.get(base.text) : undefined;
		return (
			constructorTag(heritage)
			?? propertyTag(node)
			?? importedBase(base, bindings, imported)
			?? (local === undefined ? undefined : tagOf(local, new Set([...seen, node])))
		);
	}
	return classes.flatMap((node) => {
		const tag = tagOf(node, new Set());
		return tag === undefined ? [] : [{ name: node.name?.text, node, tag }];
	});
}
