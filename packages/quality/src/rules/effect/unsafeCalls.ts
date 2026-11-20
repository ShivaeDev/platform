import ts from "typescript";
import { inTestSupport } from "#naming/unsafeFolders.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { boundaryReference, moduleBinder } from "#rules/effect/boundaryReference.ts";
import { parses } from "#rules/parse.ts";
import { unsafeFindings } from "#rules/unsafeFindings.ts";

const UNSAFE_NAME = /[a-z0-9]Unsafe$/u;

const UNCHECKED_FILE = /\.(?:config|test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/u;

const EFFECT_MODULE = /^(?:effect|@effect\/[^./]+)[./]/u;

const WRAPPER = /^effect(?:\.Effect|\/Effect)\.(?:sync|try|suspend)$/u;

const OPTION_REPAIR = "which returns an Option, and give the invalid input a typed outcome";

const COUNTERPARTS: Readonly<Record<string, string>> = {
	"DateTime.fromDateUnsafe": `Use DateTime.fromDate, ${OPTION_REPAIR}.`,
	"DateTime.makeUnsafe": `Use DateTime.make, ${OPTION_REPAIR}.`,
	"DateTime.makeZonedUnsafe": `Use DateTime.makeZoned, ${OPTION_REPAIR}.`,
	"DateTime.nowUnsafe": "Yield DateTime.now.",
	"DateTime.setZoneNamedUnsafe": `Use DateTime.setZoneNamed, ${OPTION_REPAIR}.`,
	"DateTime.zoneMakeNamedUnsafe": `Use DateTime.zoneMakeNamed, ${OPTION_REPAIR}.`,
	"Duration.fromInputUnsafe": `Use Duration.fromInput, ${OPTION_REPAIR}, a Duration constructor such as Duration.seconds for a fixed value, or pass the Duration.Input on to the API that accepts it, such as Duration.toMillis.`,
	"Queue.offerUnsafe":
		"Yield Queue.offer; for a callback source, build the stream with Stream.callback and register the callback inside Effect.sync.",
};

const GENERIC_REPAIR =
	"Yield the Effect that Effect ships beside it, usually the same name without Unsafe, or wrap the call in Effect.sync, Effect.try or Effect.suspend when it is a real side effect.";

function memberName(node: ts.Node): string | undefined {
	const named = ts.isMethodDeclaration(node) ? node.name : undefined;
	const holder =
		(ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && (ts.isPropertyAssignment(node.parent) || ts.isPropertyDeclaration(node.parent))
			? node.parent.name
			: undefined;
	const name = named ?? holder;
	return name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
}

// The ambient-runtime Biome plugin reports unsafe clock reads, and Context.makeUnsafe neither throws nor acts: it only builds a Context from a raw map.
function ownedElsewhere(key: string): boolean {
	return key.endsWith("currentTimeMillisUnsafe") || key === "Context.makeUnsafe";
}

function nameOf(node: ts.Node): string | undefined {
	if (ts.isIdentifier(node)) {
		return node.text;
	}
	return ts.isPropertyAccessExpression(node) ? node.name.text : undefined;
}

// A wrapper runs its thunk as an Effect again, and an object or class member named …Unsafe implements an unsafe member of an interface whose caller owns the risk.
function accepted(checker: ts.TypeChecker, node: ts.Node): boolean {
	for (let child = node, parent = node.parent; parent !== undefined; child = parent, parent = parent.parent) {
		if (
			ts.isCallExpression(parent)
			&& parent.arguments.some((argument) => argument === child)
			&& WRAPPER.test(boundaryReference(checker, parent.expression) ?? "")
		) {
			return true;
		}
		if (ts.isFunctionLike(parent) && UNSAFE_NAME.test(memberName(parent) ?? "")) {
			return true;
		}
	}
	return false;
}

function unsafeKey(checker: ts.TypeChecker, node: ts.Expression, called: boolean): string | undefined {
	const name = nameOf(node) ?? "";
	if (!UNSAFE_NAME.test(name)) {
		return undefined;
	}
	const reference = boundaryReference(checker, node);
	if (reference !== undefined && EFFECT_MODULE.test(reference)) {
		return `${reference.split(".").at(-2)?.split("/").at(-1) ?? ""}.${name}`;
	}
	return called && ts.isPropertyAccessExpression(node) && reference === undefined ? name : undefined;
}

function callFindings(checker: ts.TypeChecker, path: string, source: ts.SourceFile): readonly Finding[] {
	const found: Finding[] = [];
	function report(node: ts.Expression, called: boolean) {
		const key = unsafeKey(checker, node, called);
		if (key === undefined || ownedElsewhere(key) || accepted(checker, node)) {
			return;
		}
		found.push({
			file: path,
			line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
			message: `${node.getText(source)} ${called ? "runs" : "is passed to run"} outside an Effect, so it throws on bad input or acts at once. ${COUNTERPARTS[key] ?? GENERIC_REPAIR}`,
		});
	}
	function visit(node: ts.Node) {
		if (ts.isCallExpression(node)) {
			report(node.expression, true);
			for (const argument of node.arguments) {
				report(argument, false);
			}
		}
		ts.forEachChild(node, visit);
	}
	ts.forEachChild(source, visit);
	return found;
}

function checked(file: SourceFile): boolean {
	return parses(file) && !inTestSupport(file.path) && !UNCHECKED_FILE.test(file.path) && /[a-z0-9]Unsafe\b/u.test(file.text);
}

export const unsafeCalls = defineRule({
	check: ({ sources }) => {
		const { checker, parsed } = moduleBinder(sources.filter(checked));
		return unsafeFindings([...parsed].flatMap(([path, source]) => callFindings(checker, path, source)));
	},
	description:
		"Core code does not call Effect's …Unsafe functions bare: they run synchronously outside an Effect, so they throw on bad input (DateTime.makeUnsafe) or perform their side effect at once (Queue.offerUnsafe). The rule reports calls of …Unsafe functions imported from effect or @effect/*, such functions passed as an argument, and …Unsafe member calls on a value such as reactivity.registerUnsafe(keys). A call inside an Effect.sync, Effect.try or Effect.suspend thunk, including a callback written inside it, is accepted, as is the body of an object-literal or class member named …Unsafe, which implements an unsafe member of an interface; a function or variable named …Unsafe gets no such exemption. A repository's own …Unsafe function or module export is not reported. The finding names the safe counterpart where Effect ships one: DateTime.make and Duration.fromInput return an Option, the Duration constructors build a fixed value, Queue.offer is an Effect and Stream.callback turns a callback into a stream. Tests, tool configs, adapters/ and test-support/ are not checked. currentTimeMillisUnsafe stays with the ambient-runtime Biome plugin, and Context.makeUnsafe, which neither throws nor acts but only builds a Context from a raw map, is not reported; no-double-cast reports a Context retagged through mapUnsafe.",
	id: "effect/unsafe-calls",
	registrable: false,
});
