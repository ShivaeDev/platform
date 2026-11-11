import ts from "typescript";
import { isTestSupport } from "#naming/testName.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { type ImportBinding, importBindings } from "#rules/stories/importBindings.ts";
import { memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

const SERVER_MODULES = new Set(["http", "https", "net"]);
const CONSTRUCTORS: ReadonlyMap<string, ts.SyntaxKind> = new Map([
	["createServer", ts.SyntaxKind.CallExpression],
	["Server", ts.SyntaxKind.NewExpression],
]);
const HELPERS =
	"loopbackServer from @shivaedev/test-story/server/adapters/loopback.ts, which listens on a loopback port and closes it with the story's scope, or fake an outside HTTP API with fakeHttpService from @shivaedev/test-story/server/fakeHttpService.ts.";
const REPAIR = `Hand the server to ${HELPERS}`;
const NET_REPAIR = `For a free port or a listening endpoint, hand a node:http server to ${HELPERS}`;

function serverModule(binding: ImportBinding | undefined): string | undefined {
	const name = binding?.module.replace(/^node:/u, "");
	return name !== undefined && SERVER_MODULES.has(name) ? `node:${name}` : undefined;
}

type Construction = ts.CallExpression | ts.NewExpression;

function isConstruction(node: ts.Node): node is Construction {
	return ts.isCallExpression(node) || ts.isNewExpression(node);
}

function constructedFrom(node: Construction, bindings: ReadonlyMap<string, ImportBinding>): string | undefined {
	const callee = unwrapped(node.expression);
	if (ts.isIdentifier(callee)) {
		const binding = bindings.get(callee.text);
		return binding !== undefined && CONSTRUCTORS.get(binding.imported) === node.kind ? serverModule(binding) : undefined;
	}
	const receiver = ts.isPropertyAccessExpression(callee) ? unwrapped(callee.expression) : undefined;
	const binding = receiver !== undefined && ts.isIdentifier(receiver) ? bindings.get(receiver.text) : undefined;
	return CONSTRUCTORS.get(memberName(callee) ?? "") === node.kind ? serverModule(binding) : undefined;
}

function outermost(node: ts.Node): ts.Node {
	const parent = node.parent;
	const wraps =
		ts.isParenthesizedExpression(parent)
		|| ts.isAsExpression(parent)
		|| ts.isSatisfiesExpression(parent)
		|| ts.isNonNullExpression(parent)
		|| ts.isAwaitExpression(parent);
	return wraps ? outermost(parent) : node;
}

function boundName(node: ts.Node): string | undefined {
	const parent = node.parent;
	if (ts.isVariableDeclaration(parent) && parent.initializer === node && ts.isIdentifier(parent.name)) {
		return parent.name.text;
	}
	const assigned = ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === node;
	return assigned && ts.isIdentifier(parent.left) ? parent.left.text : undefined;
}

// A node:net server that handles its own sockets speaks a protocol other than HTTP, which neither shared helper serves.
function handlesSockets(created: Construction): boolean {
	return (created.arguments ?? [])
		.map(unwrapped)
		.some((value) => ts.isArrowFunction(value) || ts.isFunctionExpression(value) || ts.isIdentifier(value));
}

function socketPath(argument: ts.Expression | undefined): boolean {
	const value = argument === undefined ? undefined : unwrapped(argument);
	if (value === undefined || !ts.isObjectLiteralExpression(value)) {
		return value !== undefined && (ts.isStringLiteralLike(value) || ts.isTemplateExpression(value));
	}
	return value.properties.some((property) => property.name !== undefined && ts.isIdentifier(property.name) && property.name.text === "path");
}

// loopbackServer serves a loopback TCP port, so a server listening on a Unix socket or pipe path has no shared replacement.
function portListeners(source: ts.SourceFile): readonly ts.Node[] {
	return nodesWhere(
		source,
		(node) => ts.isCallExpression(node) && memberName(node.expression) === "listen" && !socketPath(node.arguments[0]),
	).flatMap((call) => {
		const callee = ts.isCallExpression(call) ? unwrapped(call.expression) : undefined;
		return callee !== undefined && ts.isPropertyAccessExpression(callee) ? [unwrapped(callee.expression)] : [];
	});
}

function findings(file: SourceFile): readonly Finding[] {
	const source = isTestSupport(file.path) && file.text.includes("listen") ? parse(file) : undefined;
	if (source === undefined) {
		return [];
	}
	const bindings = importBindings(source);
	const listeners = portListeners(source);
	const names = new Set(listeners.flatMap((listener) => (ts.isIdentifier(listener) ? [listener.text] : [])));
	return nodesWhere(source, isConstruction)
		.filter(isConstruction)
		.flatMap((created) => {
			const module = constructedFrom(created, bindings);
			const name = boundName(outermost(created));
			const listened = listeners.includes(created) || (name !== undefined && names.has(name));
			if (module === undefined || !listened || (module === "node:net" && handlesSockets(created))) {
				return [];
			}
			return [
				{
					file: file.path,
					line: source.getLineAndCharacterOfPosition(created.getStart(source)).line + 1,
					message: `Starts a ${module} server with listen in test-support. ${module === "node:net" ? NET_REPAIR : REPAIR}`,
				},
			];
		});
}

export const rawServers = defineRule({
	check: ({ sources }) => sources.flatMap(findings),
	description:
		"Test-support listens on no loopback port with a node:http, node:https or node:net server of its own: hand a Node HTTP server to test-story's loopbackServer, or fake an outside HTTP API with fakeHttpService. Unix socket listeners and node:net servers that handle their own sockets are accepted.",
	id: "tests/raw-servers",
});
