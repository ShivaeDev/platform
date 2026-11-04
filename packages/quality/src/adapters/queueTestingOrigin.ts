import ts from "typescript";
import { importFrom } from "#rules/stories/importOrigin.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";

type Origin = "module" | "factory" | "controller" | "readout" | undefined;

const TESTING_MODULE = "@shivaedev/test-kits/jobs/testing.ts";

function importedOrigin(node: ts.Node): Origin {
	if (importFrom(node) !== TESTING_MODULE) {
		return undefined;
	}
	if (ts.isImportSpecifier(node)) {
		return (node.propertyName ?? node.name).text === "makePgBossTesting" ? "factory" : undefined;
	}
	return ts.isNamespaceImport(node) ? "module" : undefined;
}

export function queueTestingOrigin(checker: ts.TypeChecker) {
	const visiting = new Set<ts.Node>();
	const known = new Map<ts.Node, Origin>();

	function member(receiver: Origin, name: string): Origin {
		if (receiver === "module") {
			return name === "makePgBossTesting" ? "factory" : undefined;
		}
		return receiver === "controller" && (name === "jobs" || name === "snapshot") ? "readout" : undefined;
	}

	function symbol(value: ts.Symbol | undefined): Origin {
		const direct = value?.declarations?.map(visit).find((result) => result !== undefined);
		return direct ?? (value !== undefined && value.flags & ts.SymbolFlags.Alias ? symbol(checker.getAliasedSymbol(value)) : undefined);
	}

	function typed(node: ts.Node): Origin {
		if (!(ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertySignature(node))) {
			return undefined;
		}
		const type = node.type;
		if (type !== undefined && ts.isTypeReferenceNode(type)) {
			const value = checker.getSymbolAtLocation(type.typeName);
			if (
				value?.declarations?.some(
					(declaration) =>
						ts.isImportSpecifier(declaration)
						&& importFrom(declaration) === TESTING_MODULE
						&& (declaration.propertyName ?? declaration.name).text === "PgBossTesting",
				)
			) {
				return "controller";
			}
		}
		return undefined;
	}

	function binding(node: ts.BindingElement): Origin {
		const declaration = node.parent.parent;
		const name = node.propertyName ?? node.name;
		if ((ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === "jobsTesting") {
			return "controller";
		}
		return ts.isVariableDeclaration(declaration) && ts.isObjectBindingPattern(node.parent) && (ts.isIdentifier(name) || ts.isStringLiteral(name))
			? member(visit(declaration), name.text)
			: undefined;
	}

	function declaredOrigin(node: ts.Node): Origin {
		if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
			return typed(node) ?? (node.initializer === undefined ? undefined : visit(node.initializer));
		}
		if (ts.isShorthandPropertyAssignment(node)) {
			return symbol(checker.getShorthandAssignmentValueSymbol(node));
		}
		if (ts.isBindingElement(node)) {
			return binding(node);
		}
		return typed(node) ?? importedOrigin(node);
	}

	function reference(node: ts.Node): Origin {
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const name = memberName(node);
			return name === "jobsTesting" ? "controller" : (member(visit(node.expression), name ?? "") ?? symbol(checker.getSymbolAtLocation(node)));
		}
		if (ts.isIdentifier(node)) {
			return node.text === "jobsTesting" ? "controller" : symbol(checker.getSymbolAtLocation(node));
		}
		return declaredOrigin(node);
	}

	function origin(node: ts.Node): Origin {
		if (ts.isCallExpression(node)) {
			return visit(node.expression) === "factory" ? "controller" : undefined;
		}
		if (ts.isExpression(node) && unwrapped(node) !== node) {
			return visit(unwrapped(node));
		}
		return reference(node);
	}

	function visit(node: ts.Node): Origin {
		if (visiting.has(node) || known.has(node)) {
			return known.get(node);
		}
		visiting.add(node);
		const result = origin(node);
		visiting.delete(node);
		known.set(node, result);
		return result;
	}

	return visit;
}
