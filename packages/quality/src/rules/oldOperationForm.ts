import ts from "typescript";
import { isTestCode } from "#naming/testName.ts";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { importBindings } from "#rules/stories/importBindings.ts";

const CONTRACT_MODULES = new Set(["@shivaedev/contract/contract.ts", "#contract.ts"]);

const HOST_PROTOCOL = "platform.";

const OPERATION_LISTS = new Set(["commands", "queries"]);

const GUIDE = "https://github.com/ShivaeDev/platform/blob/main/docs/framework/add-a-feature.md#move-an-existing-module-to-this-shape";

const REPAIR = `Write each operation as payload plus *run, list the operations in a defineModule and register it with module: in place of group and handlers, as ${GUIDE} describes.`;

interface OldModule {
	readonly call: ts.CallExpression;
	readonly name: string;
	readonly operations: number | undefined;
}

function contractCallees(source: ts.SourceFile): { readonly names: ReadonlySet<string>; readonly namespaces: ReadonlySet<string> } {
	const names = new Set<string>();
	const namespaces = new Set<string>();
	for (const [local, binding] of importBindings(source)) {
		if (CONTRACT_MODULES.has(binding.module) && binding.imported === "contract") {
			names.add(local);
		} else if (CONTRACT_MODULES.has(binding.module) && binding.imported === "*") {
			namespaces.add(local);
		}
	}
	return { names, namespaces };
}

function listed(value: ts.Expression): number | undefined {
	return ts.isArrayLiteralExpression(value) && !value.elements.some(ts.isSpreadElement) ? value.elements.length : undefined;
}

function operationsOf(declaration: ts.ObjectLiteralExpression): readonly (number | undefined)[] {
	return declaration.properties.flatMap((property) => {
		if (ts.isShorthandPropertyAssignment(property) && OPERATION_LISTS.has(property.name.text)) {
			return [undefined];
		}
		return ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && OPERATION_LISTS.has(property.name.text)
			? [listed(property.initializer)]
			: [];
	});
}

function oldModule(call: ts.CallExpression): OldModule | undefined {
	const [name, declaration] = call.arguments;
	if (name === undefined || !ts.isStringLiteralLike(name) || name.text.startsWith(HOST_PROTOCOL)) {
		return undefined;
	}
	const lists = declaration !== undefined && ts.isObjectLiteralExpression(declaration) ? operationsOf(declaration) : [];
	const operations = lists.every((count) => count !== undefined) ? lists.reduce((total, count) => total + count, 0) : undefined;
	return lists.length === 0 || operations === 0 ? undefined : { call, name: name.text, operations };
}

function oldModules(source: ts.SourceFile): readonly OldModule[] {
	const { names, namespaces } = contractCallees(source);
	if (names.size === 0 && namespaces.size === 0) {
		return [];
	}
	const found: OldModule[] = [];
	function visit(node: ts.Node): void {
		const callee = ts.isCallExpression(node) ? node.expression : undefined;
		const named = callee !== undefined && ts.isIdentifier(callee) && names.has(callee.text);
		const member =
			callee !== undefined
			&& ts.isPropertyAccessExpression(callee)
			&& callee.name.text === "contract"
			&& ts.isIdentifier(callee.expression)
			&& namespaces.has(callee.expression.text);
		const module = ts.isCallExpression(node) && (named || member) ? oldModule(node) : undefined;
		if (module !== undefined && !found.some((seen) => seen.name === module.name)) {
			found.push(module);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return found;
}

function findingsIn(file: SourceFile): readonly Finding[] {
	const source = isTestCode(file.path) ? undefined : parse(file);
	return source === undefined
		? []
		: oldModules(source).map(({ call, name, operations }) => ({
				file: file.path,
				line: source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1,
				message: `Module ${name} is written in the old operation form: contract groups its ${operations === undefined ? "" : `${String(operations)} `}queries and commands, which a hand-written handler map serves and an AppModule registers as group plus handlers. ${REPAIR}`,
				subject: name,
			}));
}

export const oldOperationForm = defineRule({
	check: ({ sources }) => sources.flatMap(findingsIn),
	description: `An application or package module declares its operations once, as payload plus *run in a defineModule. The rule reports the old operation form at a module's contract: a contract named by a string literal, called by name or through a namespace import of @shivaedev/contract/contract.ts, that lists queries or commands, whose operations are declared without run, served by a hand-written handler map (toLayer, rpcBoundaryHandlers) and registered with group plus handlers. Each finding names one module, and a file that declares two contracts under one name reports it once, so a baseline counts the modules left to move. A contract that lists only streams is accepted, because a stream keeps its own contract; so are the host's own protocol contracts, named under platform., a contract whose name is computed, and test code. Generated files are not read. ${REPAIR}`,
	id: "operations/old-form",
	registrable: false,
});
